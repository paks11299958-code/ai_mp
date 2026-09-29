# 충전 유도 문구 A/B 테스트 (charge_copy)

> 작성 2026-09-29 · 묶음 A(현황 조사 + 실험 설계 + 데이터 모델). 운영 화면은 이 묶음에서 바꾸지 않았다.
> 다음 묶음(B: 노출·클릭·체크아웃 기록 + 변형 렌더, C: 집계 화면)은 이 문서를 기준으로 한다.

## 1. 현황 조사

### 1-1. 충전 모달(PointModal) 구조

- `frontend/components/PointModal.tsx:8` — 패키지가 **코드에 박혀 있다**.

  | id | 이름 | 가격(원) | 지급(P) | 현재 배지 | 실제 추가분 |
  |---|---|---|---|---|---|
  | basic | 기본 | 5,000 | 5,000 | 없음 | 0 |
  | popular | 인기 | 10,000 | 11,000 | `10% 보너스` | +1,000P |
  | premium | 프리미엄 | 50,000 | 60,000 | `20% 보너스` | +10,000P |

- 패키지 버튼을 누르면 `handlePurchase`(`:35`)가 `orderId = ${userId}_${pkg.id}_${Date.now()}`(`:44`)를 만들고
  토스 `requestPayment('카드', { amount: pkg.price, orderId, ... successUrl: origin + '/' })`로 넘긴다.
  → 결제창 이동 = 페이지 이탈. 돌아오면 `/`로 리다이렉트되어 **클라이언트 메모리 상태(배정된 변형 등)는 사라진다.**
- 체험계정(`provider === 'guest'`)에게는 PointModal이 아니라 `GuestUpgradeModal`이 뜬다(`App.tsx:2100`, `:2679`).
  → **실험 대상은 정회원뿐**이다.

### 1-2. 충전 모달을 여는 곳 (전부 `setShowPointModal(true)` → App이 렌더)

`showPointModal` 상태는 `frontend/contexts/PointsContext.tsx`에 있고, 렌더는 App.tsx 두 곳이다.

| # | 위치 | 계기 | 사유상자(insufficient) |
|---|---|---|---|
| 1 | `App.tsx:1194` `insufficient-points` 이벤트 리스너 | 서버 402(전역). `services/apiService.ts:34`, `MathTutorBoard:71`, `HotKeywordBoard:88`, `InsuranceBoard:78`, `LuxuryBoard:106`, `TodayNewsBoard:213`가 이벤트를 쏜다 | 있음(detail 있을 때) |
| 2 | `App.tsx:1335` 채팅 전송 `INSUFFICIENT_POINTS` 안전망 | 채팅 402 | 1번 이벤트가 채움 |
| 3 | `App.tsx:1649` 딥링크 가이드 `onNeedCharge` | 기능 진입 중 잔액 부족 | 초기화(null) |
| 4 | `App.tsx:1674` 진입화면 채팅 모달(EntryChatModal) `onNeedCharge` | 채팅 10P 부족 | 유지(402가 채운 값) |
| 5 | `App.tsx:1785` 비로그인/체험 메인화면 `onChargeClick` | 직접 '충전' 클릭 | 없음 |
| 6 | `App.tsx:2023` 메인화면 `onChargeClick` | 직접 '충전' 클릭 | 없음 |
| 7 | `App.tsx:157` `handleNudgePrimary` (PointNudgeModal '충전하기') | 넛지(소진 임박·대화 횟수) | 없음 |
| 8 | `App.tsx:2696` PointDashboard '충전하기 →' | 직접 클릭 | 없음 |
| 9 | `PointsContext.tsx:49` `requirePoints()` | 사전 잔액 체크 실패. 사용처: HairStyle·UsedItem·FaceReading·Lookalike·StockAnalysis·PalmReading·MathTutor·HotKeyword·Insurance·Outfit·Luxury Board/Modal | 없음 |

렌더 지점 두 곳의 차이: `App.tsx:2107`(메인 레이아웃)은 `onInviteClick`을 넘겨 '친구 초대 +1,000P' CTA가 보이고,
`App.tsx:2686`(채팅 레이아웃)은 넘기지 않아 CTA가 없다. 변형 비교에는 영향이 같으므로(양쪽 모두 무작위 배정) 편향은 없지만,
집계 때 "어느 화면에서 떴는가"를 나누고 싶어지면 현재 스키마로는 구분이 안 된다(§5 위험 참조).

`PointNudgeModal.tsx`는 자체 충전 UI가 없다 — `onPrimary`가 7번 경로로 PointModal을 연다.
`PointDashboard.tsx`도 잔액·내역 화면이고 `onCharge`로 8번 경로를 탄다. 두 파일 모두 실험 대상 문구는 없다.

### 1-3. 결제 승인·포인트 적립은 어디서?

- 프론트: `frontend/hooks/usePayment.ts` — 리다이렉트 쿼리(paymentKey/orderId/amount)를 읽어
  `pointApi.confirmPayment` → `POST /api/payments/confirm`.
- `vercel.json:130` — `/api/payments/*` → `http://34.50.27.95:3020/api/aimp/payments/*` 프록시.
  **ai_mp `api/`에는 결제 핸들러가 없다.**
- 실제 처리: **shared-api(서버1)** `routes/aimp/payments.ts`
  - `:19` 서버 쪽 패키지표 `{ 5000: 5000, 10000: 11000, 50000: 60000 }` — **금액으로** 지급 포인트를 정한다.
  - **orderId를 파싱하지 않는다.** pkgId도, orderId 앞의 userId도 읽지 않는다(토큰의 userId만 씀).
    → orderId 형식을 바꿔도 서버1 결제가 깨지지는 않지만, 지시대로 **형식은 그대로 둔다**
      (다른 곳 — 운영 SQL·수동보정 습관 — 이 `split_part(orderId,'_',2)`로 패키지를 읽을 수 있다).
  - `:61` 적립 시 `PointTransaction { userId, amount: points, type: 'CHARGE', description: '충전 ' + orderId, orderId, balanceAfter }` 기록.
  - `:56` 전액(보너스분 포함)을 `paidPoints`에 increment.

### 1-4. PointTransaction에 남는 것

- `orderId` — **남는다**(`@unique`). → 체크아웃 이벤트의 orderId와 조인하면 결제 성사 여부를 확정할 수 있다.
- 결제액(원) — **컬럼 없음.** `amount`는 지급 포인트다. 단, 지급 포인트↔가격이 1:1 대응(5000↔5000, 11000↔10000, 60000↔50000)이라
  환산 가능하고, orderId의 두 번째 토막이 pkgId다.

## 2. '가장 많이 선택' 근거 조회

2026-09-29 운영 DB(aichat, 읽기 전용) 조회:

```sql
SELECT amount, count(*), count(DISTINCT "userId"), min("createdAt")::date, max("createdAt")::date
FROM "PointTransaction" WHERE type='CHARGE' GROUP BY amount;
-- 5000 | 2 | 2 | 2026-07-10 | 2026-07-12   ← 전부

SELECT split_part("orderId",'_',2), count(*) FROM "PointTransaction"
WHERE type='CHARGE' AND "orderId" IS NOT NULL GROUP BY 1;
-- basic | 2
```

- 전체 충전 **2건, 둘 다 basic**. popular는 **0건**. (관리자·매니저 결제는 0건)
- ⇒ **popular는 최다 선택이 아니다. '가장 많이 선택' 문구는 쓸 수 없다. badge 변형의 문구는 `추천`으로 한다.**
- 다시 '가장 많이 선택'을 쓰려면: 최근 90일 CHARGE에서 popular가 **단독 최다**이고 표본이 의미 있는 수(예: 30건 이상)일 때만,
  조회 SQL·일자를 이 문서에 새로 적은 뒤 바꾼다. 결제 분포는 변하므로 한 번 확인하고 영구히 쓰는 문구가 아니다.

## 3. 실험 설계

### 3-1. 변형 (가격·지급 포인트는 절대 바꾸지 않는다)

| variant | popular 카드 | premium 카드 | basic 카드 |
|---|---|---|---|
| `control` | `10% 보너스` (현재 그대로) | `20% 보너스` | 없음 |
| `badge` | 현재 배지 + **`추천`** 배지 | `20% 보너스` (그대로) | 없음 |
| `bonus` | **`+1,000P 추가 증정`** | **`+10,000P 추가 증정`** | 없음 |

- **허위 표시 금지 규칙**: bonus 변형의 숫자는 문구에 하드코딩하지 않고 `pkg.points - pkg.price`로 계산해 넣는다.
  추가분이 0인 패키지(basic)에는 증정 문구를 붙이지 않는다.
  1pt=1원이므로 `points - price`가 곧 추가 증정 포인트다(1pt=1원 정책이 바뀌면 이 식도 바뀌어야 한다).
- 가격·지급량의 진실은 **서버1 `payments.ts:19` 패키지표**다. 프론트 `PACKAGES`와 어긋나면 화면 문구가 거짓이 된다.
  B 묶음에서 두 표가 같은지 확인하는 테스트(최소한 값 대조 주석+단위 테스트)를 둔다.
- 설정의 문구를 관리자가 바꿀 수 있게 하더라도 badge 라벨은 허용 목록(`추천` 등)으로 제한하고,
  bonus 문구는 `{bonus}` 치환 템플릿만 허용한다(숫자를 직접 쓰게 하면 지급량과 어긋날 수 있다).

### 3-2. 배정

- 단위: **회원(userId)**. 같은 회원은 모달을 몇 번 열어도 같은 변형을 본다.
- 방식: `hash(experimentKey + ':' + userId) mod 100`을 가중치 구간에 매핑(결정적 해시, 저장 불필요).
  결제 후 페이지가 새로 떠도 같은 변형이 다시 계산된다.
- ★실험 도중 **가중치를 바꾸지 않는다** — 해시 구간이 움직여 이미 본 회원이 다른 변형으로 넘어간다.
  비율을 바꾸려면 `experimentKey`를 새로 정해(예: `charge_copy_v2`) 새 실험으로 시작한다.
- 제외: 체험계정(PointModal 자체가 안 뜸), `ADMIN`·`MANAGE`·`MANAGER`(기록하지 않음 — 운영자 클릭이 분모를 오염시킨다).
- 설정이 없거나 JSON이 깨졌거나 `enabled=false`면 **전원 control, 이벤트 기록 안 함**(현재 화면과 동일 = 안전한 기본값).

### 3-3. 설정 — AppConfig 키 `ab.charge_copy` (새 테이블 없음)

```json
{
  "enabled": false,
  "experimentKey": "charge_copy_v1",
  "weights": { "control": 34, "badge": 33, "bonus": 33 },
  "copy": {
    "badge": { "packageId": "popular", "label": "추천" },
    "bonus": { "template": "+{bonus}P 추가 증정" }
  }
}
```

- 읽기: shared-api `GET /api/settings`(`routes/aimp/settings.ts:8`)가 AppConfig 전체를 **비로그인에도** 돌려준다
  → 프론트가 그대로 읽을 수 있다. 공개돼도 되는 값만 넣는다(비밀 없음).
- 쓰기: 같은 파일 `PUT /api/settings`가 ADMIN이면 임의 키를 upsert한다(값은 문자열 → JSON.stringify해서 저장).

### 3-4. 이벤트 (ChargeAbEvent)

| event | 언제 | packageId | orderId |
|---|---|---|---|
| `exposure` | PointModal이 실험 대상 회원에게 렌더될 때(모달 1회 열림당 1행) | null | null |
| `click` | 패키지 버튼을 눌러 `handlePurchase`에 들어올 때(로딩 가드 통과 후) | 누른 패키지 | null |
| `checkout` | orderId를 만든 직후, `requestPayment` 호출 직전 | 누른 패키지 | 생성한 orderId |

- **결제 전환(paid)은 따로 기록하지 않는다.** `checkout.orderId = PointTransaction.orderId AND type='CHARGE'`로 조인해 판정한다
  (승인 진실은 결제 원장 한 곳. 이중 기록은 어긋남만 만든다). 조인 시 `userId`도 같이 맞춘다.
- 이벤트 기록 실패는 **결제 흐름을 절대 막지 않는다**(fire-and-forget, 실패 무시). 특히 checkout 기록을 await하다
  결제창이 안 뜨면 매출 손실이다.
- click과 checkout은 지금 코드에선 거의 같은 순간이다(키 누락·모듈 미로딩으로 그 사이 빠지는 경우만 차이). 그래도
  둘을 나눠 두면 "결제 모듈 준비 안 됨" 이탈을 볼 수 있다.

### 3-5. 지표

- 1차: **노출 회원 대비 클릭 회원 비율**(회원 단위, 변형별). 2차: 체크아웃 회원 비율, 결제 성사 회원 비율, 회원당 결제액(원 환산).
- 참고 지표: 패키지 믹스(popular·premium 선택 비중) — badge/bonus가 큰 패키지로 옮겨 가는지.

```sql
-- 변형별 퍼널(회원 단위)
WITH e AS (
  SELECT variant, "userId", event, "orderId" FROM "ChargeAbEvent" WHERE "experimentKey" = 'charge_copy_v1'
)
SELECT variant,
  count(DISTINCT "userId") FILTER (WHERE event='exposure') AS exposed,
  count(DISTINCT "userId") FILTER (WHERE event='click')    AS clicked,
  count(DISTINCT "userId") FILTER (WHERE event='checkout') AS checkout,
  count(DISTINCT e."userId") FILTER (WHERE event='checkout' AND t.id IS NOT NULL) AS paid
FROM e LEFT JOIN "PointTransaction" t
  ON t."orderId" = e."orderId" AND t."userId" = e."userId" AND t.type = 'CHARGE'
GROUP BY variant;
```

### 3-6. 표본 현실 (★기대치 조정)

- 7/10~9/29 약 80일간 충전 2건. **결제 전환으로는 이 실험이 결론을 낼 수 없다.**
- 클릭률 5% → 7.5% 차이를 유의수준 5%·검정력 80%로 잡으려면 **변형당 노출 회원 약 1,470명**이 필요하다.
  B 묶음 배포 후 1~2주 노출 수를 보고, 부족하면 변형을 2개(control vs 하나)로 줄이는 것을 검토한다.
- 결론 전에 조기 종료·재해석(중간 엿보기)하지 않도록 종료 기준(기간 또는 표본 수)을 시작 시 AppConfig와 함께 정해 둔다.

## 4. 데이터 모델 (이번 묶음 반영분)

- `prisma/schema.prisma` — `ChargeAbEvent` 추가(`id, userId, experimentKey, variant, event, packageId?, orderId?, createdAt`,
  `@@index([userId])`, `@@index([experimentKey])`). User FK 없음(탈퇴로 과거 실험 행이 지워지지 않게).
- `scripts/create-charge-ab-event-table.cjs` — `CREATE TABLE/INDEX IF NOT EXISTS`만 사용(추가 전용, 멱등).
- `npx prisma generate` 통과.
- ★**운영 DB에는 아직 실행하지 않았다**(prisma-migration 절차상 실행 전 사용자 확인 필요). 실행:
  `DATABASE_URL=<.env.local 값, 호스트만 10.178.0.2> node scripts/create-charge-ab-event-table.cjs`

## 5. 위험 요소·다음 묶음이 알아야 할 것

1. **이벤트 기록 API는 shared-api(서버1)에 들어가야 한다.** `/api/*`는 서버1로 프록시되고, Vercel 함수는 VPC 밖이라
   DB 타임아웃 전례가 있다(개발AI·인버스 이전 사례). 이번 묶음 지시는 shared-api 수정 금지였으므로 B에서 결정 필요.
2. **shared-api는 자기 `prisma/schema.prisma`와 생성 클라이언트(`generated/prisma`)를 따로 쓴다.** ai_mp 스키마에만
   ChargeAbEvent를 넣으면 shared-api의 `prisma.chargeAbEvent`는 없다 → B에서 shared-api 스키마에도 같은 모델을 넣고
   generate하거나, raw SQL로 INSERT한다. vercel.json에도 새 경로 rewrite 등록이 필요하다(누락 시 404 전례 3f26334).
3. 진입 경로(부족해서 자동으로 떴는지 / 직접 눌렀는지)를 저장할 칸이 없다. 부족 상태의 전환율이 훨씬 높을 것이므로
   변형 간 비교는 무작위 배정으로 공정하지만, 세분 분석이 필요하면 추가 전용으로 `source` 컬럼을 더하는 것을 검토.
4. 결제 서버는 orderId의 userId가 토큰 userId와 같은지 검사하지 않는다(기존 동작, 이번 범위 밖). 퍼널 조인은 userId까지 맞춰 방어한다.
5. `src/generated/prisma`가 이번 generate 전부터 낡아 있었다(DevProject의 `useReview`·`brief` 누락). 이번 generate로 함께 갱신되어
   diff가 ChargeAbEvent보다 크다 — 의도된 동기화다.
