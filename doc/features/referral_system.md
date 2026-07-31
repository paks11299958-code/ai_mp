# 추천인(레퍼럴) 시스템

> 작성: 2026-06-21 | **구현·배포·실증 완료: 2026-06-22**
> 목적: 기존 유저가 친구를 데려오면 양쪽에 포인트 보상 → 바이럴 유입. 광고비 대신 보상으로 유저 확보.

---

## 0. 구현 현황 (2026-06-22)

**사장 결정 확정**: 보상 **양방향 각 1000pt** / 지급 시점 **친구가 기능 1회 사용 시**(어뷰징 방어) / 진입점 **전용 '친구 초대' 화면**.

**배포**: 프론트 ai_mp master `7ed770d`+`4009155`(Vercel 자동). 백엔드 shared-api main `aacc1ab`(서버1 수동배포 완료 + DB 컬럼 raw SQL 선반영).

**백엔드(shared-api)**
- `lib/referral.ts`: `ensureReferralCode`(8자 base32, 혼동문자 제외, 충돌 재시도) / `recordReferredBy`(자가추천·중복·없는코드 방어) / `tryGrantReferral`(친구 기능1회 사용 시 양쪽 1000pt, `PointTransaction type='REFERRAL'` + `User.referralRewarded` 플래그로 중복방어, 별도 트랜잭션이라 실패해도 기능엔 무영향) / `getReferralStats`(현황).
- `routes/aimp/auth.ts`: register/verify-register/kakao 3경로에서 코드 발급 + `ref` 수신→referredBy 기록. **카카오는 OAuth `state`로 ref 전달**. `GET /referral` 현황 API.
- `lib/points.ts`: `deductMenuPoints` 성공 후 `tryGrantReferral` 트리거(전 기능 차감 공통지점) + `tryReferralAfterActivity` 헬퍼를 `sessions.ts` 채팅 차감 직후 호출(채팅도 활성행동으로 인정).

**프론트(ai_mp)**
- `services/referral.ts`: `captureRefFromUrl`(부팅 시 `?ref` localStorage 보관+URL정리) / `getStoredRef`(가입 요청 동봉) / `clearStoredRef`(가입 후 제거) / `buildReferralLink` / `buildFeatureShareLink`(`?f=key&ref=내코드`) / `shareResultImage`(결과 이미지 파일+딥링크 동시 공유) / `setMy·getMyReferralCode`(내 코드 localStorage 캐시).
- `components/InviteFriendModal.tsx`: 전용 친구초대 화면(내 링크·복사·navigator.share·현황 N명/적립pt).
- 진입점: 메인 우하단 플로팅 `🎁 친구 초대 +1000P` 버튼 + 채팅 헤더 ⋮ 메뉴 항목.
- 공유버튼(`?p`/`?f`)에 내 `?ref` 자동 부착 → 페르소나/기능 공유가 곧 추천 링크. 결과 자랑 버튼(미래의나·헤어)도 동일.
- `apiService`: register/verify에 `ref` 동봉 + `authApi.referral()`. 카카오 href에 `?ref`.

**DB(서버1 raw SQL 선반영)**: `User`에 `referralCode TEXT UNIQUE`(인덱스 `User_referralCode_key`)·`referredBy INTEGER`·`referralRewarded BOOLEAN DEFAULT false`.

**실증(서버1 실 HTTP)**: A가입→코드 발급 / B(`ref=`)가입→referredBy 기록 / B 채팅1건(차감)→A·B 각 +1000pt + REFERRAL 거래 2건 + referralRewarded=true. 테스트계정 정리 완료.

> 아래는 최초 기획 문서(설계 레퍼런스). 실제 구현은 위 0번이 정본.

---

## 1. 핵심 컨셉

```
유저A(추천인) → 고유 추천링크/코드 공유 → 친구B가 그 링크로 가입
   → 조건 충족 시 A와 B 둘 다 포인트 받음
```

기존 자산 재활용: 포인트 지급(`grantSignupPoints`/`PointTransaction`), 충전모달, 온보딩 미션(RewardAlertModal).

---

## 2. 결정 필요 항목 (★ = 사장님 결정)

### ★2-1. 보상 구조 — **후보: 양방향 각 1000pt (추천)**
| 안 | 추천인 | 신규 | 비용/건 |
|---|---|---|---|
| A. 양방향 각 1000pt | 1000 | 1000 | 2000pt (=2000원 상당) |
| B. 추천인만 1000pt | 1000 | 0 | 1000pt |
| C. 직접 입력 | 사장님 지정 | 사장님 지정 | - |
- 권장 A: "친구도 이득"이 공유 동기를 키움. 단가가 1pt=1원이라 1건당 실비는 포인트(미사용시 부채)지 현금 아님.

### ★2-2. 지급 시점 — **어뷰징 방어의 핵심**
| 안 | 시점 | 어뷰징 위험 | 전환 효과 |
|---|---|---|---|
| A. 가입 즉시 | 친구 가입 완료 | 높음(가짜계정 양산) | 즉각적 |
| B. 친구 첫 결제 시 | 충전 발생 | 매우 낮음 | 전환 직결, 단 허들 높음 |
| C. 친구 기능 1회 사용 시 | 차감 발생 | 낮음 | 균형적(권장 후보) |
- ⚠️ 우리는 가입이 이메일/전화/카카오. **전화 인증 가입**은 어뷰징 어렵지만, 이메일은 쉬움.
- 권장: **C(친구가 기능 1회 사용)** — 가짜계정은 기능 안 쓰므로 자연 차단 + 활성유저만 보상.

### ★2-3. 자가 추천/중복 방어 규칙
- 추천인 = 신규 본인 불가(같은 디바이스/IP 휴리스틱은 추후)
- 한 신규는 추천인 1명만 인정(최초 1회), 이미 가입한 유저는 추천 대상 아님
- 추천인 보상은 신규 1명당 1회만(중복 차단: PointTransaction type='REFERRAL' + 신규userId 기록)

---

## 3. 데이터 모델 (서버1 raw SQL, db push 금지)

```sql
-- User에 추천 관련 컬럼 추가
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT UNIQUE;     -- 내 추천코드(가입 시 생성, 예: 8자리)
ALTER TABLE "User" ADD COLUMN "referredBy" INTEGER;           -- 나를 추천한 유저 id (가입 시 1회 기록)
ALTER TABLE "User" ADD COLUMN "referralRewarded" BOOLEAN NOT NULL DEFAULT false;  -- 이 유저로 인한 추천보상 지급 완료 여부(2-2 조건 충족 시 true)
```
- PointTransaction.type 에 `'REFERRAL'` 추가(결산에서 '무상지급'으로 집계 — 기존 SIGNUP/MISSION 그룹).
- referralCode 생성: 가입 시 nanoid 8자(충돌 시 재시도) 또는 base62(userId+salt).

---

## 4. 백엔드 (shared-api)

1. **가입 시 코드 생성**: `register`/`verify`/`kakao` 가입 경로 전부에서 referralCode 발급.
2. **추천 코드 수신**: 가입 요청 body에 `ref`(추천코드) 받으면 → 해당 코드의 userId를 `referredBy`에 기록(본인/존재X면 무시).
3. **보상 트리거**(2-2 결정에 따름):
   - C안이면: `deductMenuPoints` 또는 기능 사용 성공 지점에서 "이 유저가 referredBy 있고 아직 referralRewarded=false면 → 추천인+신규에 REFERRAL 포인트 지급 + referralRewarded=true". 공통 헬퍼 `tryGrantReferral(userId)`로 묶어 각 기능 진입점에서 1줄 호출.
4. **조회 API**: `GET /referral` → 내 코드/링크, 추천한 인원수, 받은 포인트 합계.

---

## 5. 프론트 (ai_mp)

1. **가입 폼**: URL `?ref=코드`를 읽어 hidden으로 가입 요청에 포함(localStorage에 잠깐 보관 → 가입 시 전송). 카카오 가입도 동일.
2. **내 추천 화면**(UserProfileModal 또는 신규 탭): 내 추천링크 + 복사/카카오공유 버튼 + "N명 초대, M pt 적립" 현황.
3. **공유 UX**: `navigator.share`(모바일 네이티브 공유) + 링크 복사 폴백. 카카오 공유 SDK는 선택.
4. **보상 알림**: 추천 보상 지급 시 RewardAlertModal 재사용("친구가 가입했어요! +1000pt").

---

## 6. 단계별 구현 순서 (작은 단위로)

1. DB 컬럼 + referralCode 생성(가입 경로) + `GET /referral` — 코드 발급·조회만
2. 가입 시 `ref` 수신 → referredBy 기록 (프론트 ?ref 읽기 + 가입 폼 전달)
3. 보상 트리거(2-2 결정 지점) + 중복방어 + RewardAlertModal
4. 내 추천 화면(링크·공유·현황)

---

## 7. 미결/주의
- ★ 보상 구조(2-1)·지급 시점(2-2) 사장님 결정 후 착수.
- 어뷰징: 1차는 "지급 시점을 활성 행동 뒤로"(C/B)로 방어. IP/디바이스 핑거프린팅은 과하면 추후.
- 단가/보상은 DB나 상수로 빼서 조정 가능하게(어드민 노출은 추후).
- 카카오 가입은 ref 전달 경로(OAuth 콜백) 별도 처리 필요.

상세 포인트 시스템: [points_payment.md](../points_payment.md)

---

## 8. 활성화 P1+P2 (2026-07-07 구현 — "작동"에서 "성과"로)

06-22 구현 후 실적 0(42명 중 추천가입 0) 원인=노출·동기·측정 부재 → 활성화 2단계 구현.

### P1 측정
- **`ReferralVisit` 테이블**(서버1 raw SQL, prisma schema 미반영): code·ipHash(salt 해시, PII 최소)·ua·createdAt.
  ★유니크 인덱스 `(code, ipHash, (createdAt::date))` = 같은 사람 하루 1회만(스팸/중복 방어, ON CONFLICT DO NOTHING).
- **`POST /api/aimp/auth/referral/visit`**(비로그인 OK): 프론트 `captureRefFromUrl()`이 ref 캡처 성공 시
  fire-and-forget 호출. 서버 오류도 200 반환(측정 실패가 방문자 경험을 해치지 않게).
- **어드민 '레퍼럴' 탭**(회원·포인트 그룹, `ReferralStatsPanel.tsx`): 퍼널 카드(방문→가입→활성+전환율),
  일별 방문 14일 막대(div, 라이브러리 없음), 초대 순위 표. `GET /admin/referral-stats`($queryRawUnsafe).

### P2 노출
- ★**402 충전모달 초대 CTA**: `PointModal`에 `onInviteClick` prop — "충전 대신 친구 초대하고 +1,000P 받기"
  버튼 → 충전모달 닫고 `InviteFriendModal` 열기. 돈 내기 싫은 순간=초대 동기 최대.
- **공유 보상 안내**: `shareResultImage()` 공유 문구·클립보드 토스트에 "친구가 가입하면 두 분 다 +1000P"
  1줄(내 추천코드가 붙는 공유일 때만).

### 남은 것
- **P3 OG 동적 미리보기**: ?p/?f별 이미지·타이틀. 정적 meta 한계 → Vercel Edge Middleware(봇 UA에만
  메타 주입) or 프리렌더 중 방식 결정 필요. 별건.
- (사장 결정) 온보딩 '친구 초대 성공' 미션 보상액 / 메인 초대 배너(HeroCard 어드민 업로드=개발 0).
- 관찰 신호: 어드민 레퍼럴 탭 방문 수치 → 방문↑·가입 전환↓이면 P3 착수 가치 확인.

## 레퍼럴 링크 방문자 임시계정 자동체험 (2026-07-21 — 사장 제안)

**문제**: `?ref=코드`로 들어온 비회원은 무조건 가입폼(AuthModal register)이 떠서 체험 없이 가입부터 강요당했음(`arrivedViaReferral` 분기). 처음엔 임베드 위젯(`?embed=`)의 "가입없이 3회체험" 방식을 그대로 이식하려 했으나, 그건 페르소나 1명과 격리된 미니 채팅 API(`routes/aimp/embed.ts`)라 정식 사이트의 포인트/여러 페르소나 시스템을 못 쓴다는 한계가 있어 방향 전환.

**구현**: 레퍼럴 방문자에게 **임시계정**을 자동 발급해 정식 사이트를 페르소나·기능 제한 없이 자유 체험시킨다.
- `POST /auth/guest-register`: `provider='guest'` 계정 생성+로그인+보너스포인트 1,000P 지급(`grantSignupPoints` 재사용). IP당 10분 5회 레이트리밋(임베드의 `IP_BURST` 패턴과 동일 취지).
- 프론트(`App.tsx`): `arrivedViaReferral`이면 가입폼 대신 자동으로 `guest-register` 호출 → 성공 시 "친구 초대로 오셨네요! 체험용 1,000P 드렸어요" 환영 알럿(`RewardAlertModal` kind='guestWelcome' 추가) → 정식 사이트 바로 체험.
- 포인트 소진 시: 기존 충전모달(`PointModal`) 대신 신규 **정식전환 모달**(`GuestUpgradeModal.tsx`)로 이메일/전화 인증(기존 `send-verify`/`pendingVerification` 재사용) 후 닉네임·비밀번호 설정 유도. `POST /auth/upgrade-guest`가 `verify-register` 패턴을 재사용하되 `create` 대신 기존 게스트 row를 `update`(대화기록·포인트 그대로 유지, `provider`만 `local`로 전환).

**★레퍼럴 보상 지급 시점**: 기존 `tryGrantReferral`은 "가입 즉시"가 아니라 "친구가 기능 1회 사용 시" 지급하는 어뷰징 방지 설계(위 0번 참고)였는데, 게스트는 임시계정 상태로도 바로 기능을 쓸 수 있어 그대로면 정식전환 없이도 보상이 나갈 위험이 있었음 → `tryGrantReferral`에 `provider==='guest'`면 스킵하는 가드를 추가하고, 보상은 **`upgrade-guest`(정식전환) 성공 직후에만** 트리거하도록 변경. 즉 임시계정으로 아무리 활동해도 보상은 안 나가고, 실제로 이메일/전화 인증까지 마쳐야 초대자+본인 각 1,000P가 지급된다.

파일: `shared-api/routes/aimp/auth.ts`(`guest-register`·`upgrade-guest`), `shared-api/lib/referral.ts`(`tryGrantReferral` 가드), `ai_mp/frontend/components/GuestUpgradeModal.tsx`(신규), `ai_mp/frontend/App.tsx`. 배포: shared-api `33bf1f1`, ai_mp `7a4d8d8`+`50632d3`(닉네임 필수화 후속).

### 체험 퍼널 개선 + 코호트 보존 (2026-07-28 — 실측 기반)

**실측**: 게스트 25명 중 **23명이 1,000P를 1P도 안 쓰고 이탈**, 레퍼럴 유입 19명 중 **정식전환 0명**. 실제 사용은 관상 4건·헤어 2건뿐. 전환 모달이 "잔액 부족 시"에만 뜨는 구조라 **아무도 그 지점에 도달한 적이 없었다**.

원인 3가지를 함께 수정:

1. **도착지가 깨져 있었다** — 공유 딥링크 `?f=swing`이 스윙 보드가 아니라 설아 채팅으로 빠졌다. `featureBoardOpeners`에 `FEATURES_GRID`의 키인 `swing`이 없었음(`golf-swing`/`golf-record`는 채팅 내 기능버튼 키라 별개). `tarot`도 누락. 친구 결과물을 보고 온 사람이 낯선 채팅창에 떨어지니 포인트를 쓸 이유가 없었다.
2. **공유 문구가 아무 정보도 주지 않았다** — 무엇을 공유하든 제목이 `AI 페르소나 채팅` 고정 → 기능명을 앞에 붙임(`featureShareTitle`, `services/referral.ts`).
3. **첫 사용의 심리적 문턱** — 잔액이 있어도 "얼마 나가는지" 앞에서 주저한다 → **게스트 첫 기능 1회 무료**(`deductMenuPoints`가 차감 단일 지점이라 여기 한 곳으로 전 기능 적용, 0원 MENU 거래 `체험 첫 1회 무료`로 멱등 판정). 어뷰징은 `guest-register`의 IP 제한이 1차 방어.

**지급액 1,000P → 500P**(`GUEST_SIGNUP_BONUS`): 주력기능 단가가 대부분 200P라 1,000P는 5회분 = 체험 중 절대 소진되지 않는 금액이었다. 500P + 첫1회무료 = **3~4회 체험 후 자연스럽게 잔액이 바닥나 전환 지점에 닿는다**(검증: 500→500→300→100→차단). `grantSignupPoints`에 `amount` 인자를 추가해 게스트만 분리 — **정식가입/카카오는 1,000P 그대로**. 프론트의 하드코딩 `1000`도 서버 응답값(`u.bonusPoints`)으로 교체(안 그러면 화면만 거짓 안내).

**★코호트 통계 보존**: 게스트 계정은 7일 후 cleanup 크론이 삭제하므로(위 적체 방지) **개선 효과를 7일 뒤엔 검증할 수 없었다**. 삭제 직전에 가입일(KST) 단위 집계를 `GuestCohortStat`에 누적 upsert — 유입수/1회이상사용/무료체험사용/잔액소진(전환지점 도달)/총소진P. 개인정보 없이 카운트만.
- 지표는 **반드시 삭제 전에** 읽는다(`PointTransaction`이 Cascade로 함께 사라짐).
- 삭제 실패분은 집계 제외(다음 회차 재시도되므로 중복 계상 방지).
- `GET /admin/guest-cohorts` — 살아있는 계정(실시간 집계)과 삭제분(보존 통계)을 합쳐 하나의 추세로 반환.

**퀵메뉴 기능 딥링크 자동실행 + 카드 3종 승격(같은 날 후속)**: 전용 보드가 없는 기능(꿈해몽·관상·운세·재물·인연)은 `?f=`로 와도 도결 선생 채팅만 열려 "뭘 하라는 건지" 알 수 없었다 → `FEATURE_QUICK_MENU_LABEL`(기능키→`quickMenuJson`의 label) 매핑 후 채팅 진입 시 해당 퀵메뉴 자동 실행. 딥링크 처리부가 `handleQuickMenuSelect`보다 위라 TDZ가 나므로 **예약 state + useEffect**로 처리(조기반환보다 앞에 둬 훅 순서 안전).
또 **전생·손금·우정은 메인 카드가 없어 공유 버튼조차 없었다** — 퀵메뉴 사용량 70건(헤어 88 다음)인데 바이럴 경로만 막힌 상태였다. `rebirth`/`palm`/`friendship` 카드로 승격(id 26~28)하니 공유링크·검색·즐겨찾기가 자동 적용. 기능카드 24→27개.
★**새 기능 카드 추가 시 4곳을 함께 갱신**해야 완성된다: ⑴`FEATURES_GRID`(카드) ⑵진입경로(`featureBoardOpeners` 또는 `FEATURE_QUICK_MENU_LABEL`) ⑶`FEATURE_SHARE_LABELS`(공유 제목) ⑷`FEATURE_SYNONYMS`(검색). 하나라도 빠지면 카드는 보이는데 링크가 엉뚱한 데로 가거나 검색이 안 된다. 27개 전부 누락 0 검증 완료.

**초대 링크 목적지 선택(2026-07-28 후속, 사장 지적)**: 초대 모달(`InviteFriendModal`)이 만드는 링크는 `?ref=코드`뿐이라 **받는 사람이 아무 맥락 없이 메인에 떨어졌다** — 기능/페르소나 공유 버튼(`?f=`·`?p=`)과 달리 목적지가 없었다. 공유 문구도 "미래 얼굴·헤어·관상" 고정이라 무엇을 소개하든 같았다. 최다 초대자(뿌니, 코드 `D3USRYVH`, 게스트 10명 유입)가 데려온 사람 중 8명이 1P도 안 쓴 것과 무관하지 않다.
→ 초대자가 목적지를 고르면 그 화면으로 바로 도착하고(`buildInviteLink`), **공유 제목·본문도 함께 바뀐다**(`buildInviteMessage`).
★**페르소나/기능 2단계로 나누지 않았다**: `FEATURES_GRID` 기준 13명 중 **9명이 기능을 1개만** 가져(은비=명품감정, 설아=스윙, 유나=타로, 채원=주식…) 두 단계가 같은 결과를 낸다 — 선택만 두 번 하게 된다. 대신 한 목록에서 고르되 기능 아래 담당 페르소나명을 함께 표기. 여러 기능을 가진 건 도결(8)·아린(4)·채린(4)·지우(2)뿐.
기본값은 모달을 연 시점의 페르소나 기능(은비 채팅 → '명품 감정' 자동 선택)이고 그 항목을 목록 맨 위로 올린다. 링크 위에 "OO 화면으로 바로 도착"을 표시.

**게스트 환영 모달 문구(같은 날)**: "체험용 포인트를 드렸어요"뿐이라 **가입 없이 체험 계정으로 로그인된 사실 자체를 알 수 없었다**(사장 지적). 제목을 "체험 회원으로 시작해요"로, 본문에 "가입 없이 바로 쓰는 체험 계정으로 로그인했어요 / 첫 기능 1회는 무료"를 넣고, 포인트 소진 시 이메일·전화 인증으로 정식 전환되며 **대화·포인트가 그대로 유지된다**는 안내를 미리 노출. 이게 없으면 나중에 뜨는 정식전환 모달이 뜬금없다.

### 초대 링크 목적지 선택 + 딥링크 도착 경험 (2026-07-28 후속, 사장 실사용 지적 연속)

**초대 링크에 목적지가 없었다**: `InviteFriendModal`이 만드는 링크는 `?ref=코드`뿐이라 받는 사람이 아무 맥락 없이 메인에 떨어졌다(기능·페르소나 공유 버튼과 달리 `?f=`·`?p=`가 없음). 문구도 "미래 얼굴·헤어·관상" 고정.
→ 초대자가 **페르소나를 고르고 그 안에서 기능을 선택**(선택 안 함 = 페르소나 채팅)하면 그 목적지로 도착하고 공유 문구도 함께 바뀐다(`buildInviteLink` / `buildInviteMessage`).
★**페르소나/기능 2단계로 나누지 않았다**: 13명 중 9명이 기능 1개라 두 단계가 같은 결과를 낸다. 대신 **페르소나는 기본 선택된 채 접어두고(바꾸기로 펼침), 기능 목록은 항상 노출**한다 — 접으면 "선택 안 함(대화로 시작)"이라는 선택지가 있다는 걸 모른다. UI는 아코디언→리스트박스 2개→현재 형태로 3차 수정(사장 피드백).
※ 모달에 목록이 들어가며 길어져 **닫기(X)가 화면 밖으로 잘리는 사고** — `maxHeight: calc(100dvh - 32px)` + 헤더 고정(shrink-0) + 본문만 스크롤로 해소. 414×667에서 검증.

**딥링크 도착 전 관문 2개 제거**:
1. `handlePersonaClick`이 **경로와 무관하게 항상 인트로(입장 영상)**를 띄웠다 → `skipIntro` 옵션.
2. 그걸 끄자 가려져 있던 **명부(생년월일) 자동 모달**이 드러났다(`useQuickMenu`가 채팅 진입만으로 노출) → `suppressAutoBirthModal`.
둘 다 **딥링크에서만** 끄고 직접 진입은 그대로. ★막힌 흐름은 한 겹이 아닐 수 있으니 뚫은 뒤 반드시 다시 통과시켜 볼 것.

**안내 모달**: 기능 딥링크는 사용법(`FEATURE_DEEPLINK_GUIDE` 8종), 페르소나 딥링크는 소개+기능 카드. 카드는 **눌러서 바로 실행**된다(처음엔 안내용 텍스트라 눌러도 무반응이었음). 명부를 쓰는 페르소나면 "적어두시면 더 정확하게"를 미리 안내 — 나중에 명부 모달이 떠도 뜬금없지 않게. 명부 모달 자체에도 "왜 묻는지" 한 줄 추가.
디자인은 사장 지시로 전면 개편: 얼굴 원형 96px + 상단 blur circle + 글래스 카드 + `#8B5CF6→#EC4899` CTA(`{이름}과 시작하기`, 받침 조사 자동).
★반영하지 않은 제안 2건 — ⑴기능 4개 배치(대화·기념일·사진공유)는 **실재하지 않는 기능**이라 누르면 무반응이 된다. 카드는 실제 실행되는 기능만. ⑵"만나러 가기"는 이 모달이 **14명 공용**이라 도결 선생에겐 어색하다.

**소개문은 `Persona.introText`(DB)로**: 매 렌더마다 `systemInstruction`을 파싱하던 걸 저장으로 전환(=db_schema.md). 어드민 '공유 링크 소개문'에서 편집. 줄바꿈은 `whiteSpace: pre-line`으로 살린다(14명 중 9명이 두 줄로 작성).

**인사말 선생성**: 인트로를 끄자 "모달 닫으면 인사말 기다리는" 텀이 드러남 → 딥링크 처리 전에 `prefetchOnly`로 시작해 안내 모달 읽는 동안 끝나게 한다. ★첫 시도의 중복방지 가드가 실효 없어 **세션이 2회 생성**됐다(운영 실측 = 인사말 2번 = AI 비용). `finally`에서 즉시 해제한 게 원인 — '진행 중'이 아니라 **'한 번이라도 시작함'을 기억**하도록 재수정, 계정 전환 시 `clearSessionGuard()`.

**지식iN 답변 링크**(`rag/kin_answer_worker.py`): `?embed=위젯` → **`?f=기능키&ref=KIN`**. 2차 때 `?p=`를 피한 이유(비로그인이 가입 화면으로 강제 이동)가 게스트 자동로그인·인트로 제거로 해소됐다. `KEYWORD_FEATURE_KEY`로 키워드→기능 매핑(꿈해몽·관상·손금·전생·타로·사주·운세·궁합), 매핑 없으면 `?p=` 폴백. `CHANNEL_CODES`에 `KIN` 추가(프론트+백엔드 양쪽). ★**이미 생성된 답변 초안·게시분은 옛 링크 그대로** — 재생성해야 새 링크가 적용된다.

### 안내 모달 27개 기능 전체 확대 + 링크 전수 테스트 (2026-07-28 마무리)

**모든 도착 경로에 같은 모달을 쓴다**: 기능 링크(`?f=`)도 페르소나 모달과 동일한 디자인(얼굴 96px·글래스 카드·`#8B5CF6→#EC4899` CTA)으로 통일하고, 기능 카드는 해당 하나만 넣는다. 얼굴이 보여야 "누가 해주는지" 알고, 카드로 바로 다시 실행할 수도 있다. CTA는 담당 페르소나 이름(`personaName` 필드) — 기능 링크는 title이 기능명이라 "🌙 꿈해몽과 시작하기"가 되어 어색하다.
**보드형 17개**(헤어·프로필·전자책 등)도 바로 보드를 열지 않고 안내 모달을 먼저 띄운다. CTA를 누르면 그때 실행 — ★모달만 띄우고 `opener()`를 안 부르면 닫아도 아무 일이 없어 길을 잃는다.
`FEATURE_EMOJI`로 27개 이모지를 단일 출처로 정의(`FEATURES_GRID.catch`의 이모지는 카피용이라 기능 성격과 안 맞는 게 섞여 있다 — 꿈해몽 💭, 관상 😌).

★**보드형 확대가 그대로 사고로 이어졌다**: 안내 모달 JSX가 `screen === 'main'` 조기 return **뒤**에 있어, `goTo('chat')` 없이 모달만 띄우면 **메인에 머문 채 아무 화면도 안 열린다**. `?f=hair`가 모달도 보드도 없이 메인에 남았고, 배포 후 실측으로 발견했다. 웹툰도 같은 원인(`setActivePersonaId`만 호출). **딥링크는 목적지가 무엇이든 먼저 `goTo('chat')`으로 컨텍스트를 옮길 것.**

**`scripts/test-all-links.cjs`**(신설): 페르소나 14 + 기능 27 = 41개를 실제 브라우저로 전수 검사한다.
- 판정: ⑴렌더됨 ⑵치명 에러 없음 ⑶**도착 신호 있음**. 세 번째가 핵심 — "메인 화면에 그대로 남음"을 실패로 잡지 않으면 위 보드형 버그가 전부 통과로 나온다.
- ★**테스트 자체가 두 번 대규모 오탐**을 냈다: ⑴링크마다 게스트를 새로 만들어 **IP 제한(10분 5개)**에 걸려 38개가 "렌더 실패"(실제 사이트는 정상) → 토큰 1개 발급 후 재사용. ⑵딥링크는 모달이 **2겹**(체험 환영 → 기능 안내)인데 한 번만 닫아 6건 중 5건 오탐 → 2회 닫기.
- 실패율이 비정상적으로 높으면 **코드보다 도구를 먼저 의심**하고 수동으로 1건 확인할 것.

**보는 법**: 게스트 `bonusPoints`가 500 미만으로 떨어진 계정이 생기면 "실제로 써봤다", 50P 미만이 쌓이면 "전환 모달까지 도달했다"는 뜻.

파일: `shared-api/lib/points.ts`(무료체험·`GUEST_SIGNUP_BONUS`), `shared-api/routes/aimp/internal-cron.ts`(집계 보존), `shared-api/routes/aimp/admin.ts`(조회 API), `ai_mp/frontend/App.tsx`·`components/MainPageNew.tsx`·`services/referral.ts`. 배포: shared-api `28dc13e`+`41f00c8`+`488b385`, ai_mp `8228690`+`987de4b`.

## 마케팅 채널 코드 (2026-07-15 — 유튜브 숏츠 QR 연계)

- **개념**: `?ref=YOUTUBE` 같은 채널 코드는 회원 추천코드가 아니라 **유입 소스 표시**. 보상 없음, 측정만.
- **코드 목록**: `CHANNEL_CODES` = YOUTUBE/SHORTS/INSTA/INSTAGRAM/THREADS/BLOG/NAVER — **프론트(`services/referral.ts`)와 백엔드(`shared-api/lib/referral.ts`) 양쪽 상수**. 새 채널 추가 시 둘 다 갱신.
- **가입 측정**: `referredBy`는 유저 id(int)라 채널 코드 저장 불가 → `recordReferredBy`가 채널 코드면 **`ChannelSignup`**(raw SQL 테이블, userId UNIQUE=멱등)에 기록. 가입 3경로(이메일·휴대폰·카카오) 모두 커버.
- **어드민**: 레퍼럴 탭 '마케팅 채널 유입' 표 — ReferralVisit(방문)과 ChannelSignup(가입) JOIN, 전환율 표시(`GET /admin/referral-stats` 응답 `channels`).
- **가입 배너**: 채널 코드 유입 = "환영" 배너(1,000P), 친구 코드 = 기존 "친구 초대" 배너 (AuthModal 분기).

## ⚠️ 초대링크 재진입마다 체험계정이 새로 생기던 버그 (2026-07-31 수정, `561d357`)

- **증상**: 같은 브라우저로 초대 링크(`?ref=`)를 열 때마다 게스트 계정이 새로 생성됐다.
  운영 실측: 3회 진입 → user id **230 → 231 → 232**.
- **원인(경합)**: 게스트 자동생성 `useEffect`가 `!user`로 비회원을 판단하는데, `user`는
  `me()` **응답이 와야** 채워진다. 이 effect는 첫 렌더 직후 곧바로 돌기 때문에 그 시점엔
  localStorage에 토큰이 멀쩡히 있어도 `user`가 `null` → "비회원"으로 오판해 또 만들었다.
  `isAuthChecking`은 렌더 쪽 조기 return에만 쓰이고 있어 이 effect는 무방비였다.
- **수정**: `if (isAuthChecking) return;` + **의존성 배열에도 추가**
  (안 넣으면 확인 완료 후 재실행이 안 돼 게스트가 아예 안 생긴다).
- **영향**: 계정 자체는 7일 뒤 cleanup이 삭제하지만(`internal-cron/cleanup`, 매일 21시,
  `provider='guest' AND createdAt<7d`, `deleteMany`=실삭제), **집계는 삭제 전에
  `guestCohortStat`에 적립**되므로 부풀려진 수치가 통계에 영구히 남는다(전환율 분모↑).
  07-28 "뿌니 게스트 10명 중 8명 미사용" 판단도 실인원이 아닐 수 있다.
  포인트도 계정당 500P가 이미 발행된 뒤라 회수되지 않는다.
  - 실측 DB(07-31): 전체 216명 중 **게스트 157명(73%)**, 그중 156명이 최근 7일 이내 생성.
  - ※추천보상 1000P는 "가입 후 기능 1회 사용" 조건이라 자동 지급되지 않는다(안전).
  - ※`guest-register`엔 IP당 레이트리밋이 있어 대량 악용은 원래 막힌다 — 이 버그의 실제
    피해자는 악의적 어뷰저가 아니라 **"링크를 두 번 누른 평범한 사용자"**다.
- **검증**: 수정 전 4회→230/231/232… / 수정 후 4회→236 고정 / **운영 배포 후 4회→237 고정**(에러 0건).
- 파일: `ai_mp/frontend/App.tsx`(게스트 자동생성 useEffect).
