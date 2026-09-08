# 어드민 사용자 활동 대시보드 — 데이터 소스 조사 (묶음 A, 2026-09-08)

## 0. 먼저 알아야 할 것 — 스키마 정본과 코드 위치

| 항목 | 위치 | 비고 |
|---|---|---|
| **DB 스키마 정본** | `~/shared-api/prisma/schema.prisma` (1466줄) | ★`ai_mp/prisma/schema.prisma`(752줄)는 **구버전**이다. `provider`, `lastLoginAt`, `referredBy`, `EbookProject`, `Lc*` 등이 통째로 빠져 있다. 활동 지표를 여기서 판단하면 오답이 나온다. |
| **어드민 API 실제 구현** | `~/shared-api/routes/aimp/admin*.ts` (서버1, 포트 3020) | `ai_mp/api/`는 레거시다. `api/router.ts`가 404 스텁이고, `vercel.json`의 `/api/admin/:path*` → `http://34.50.27.95:3020/api/aimp/admin/:path*` rewrite가 모든 요청을 서버1로 넘긴다. |
| **DB 접속** | `10.178.0.2:5432/aichat` (내부 IP) | Vercel 서버리스는 VPC 밖이라 DB 타임아웃이 난다(개발AI·인버스 트레이더가 같은 이유로 서버1로 이전됨). **집계 엔드포인트를 `ai_mp/api/`에 두면 동작하지 않는다.** |
| DB 세션 타임존 | `UTC`, 컬럼은 전부 `timestamp without time zone`(UTC 값 저장) | KST 일자 = `"createdAt" + interval '9 hours'`. |

## 1. 활동을 담고 있는 기존 테이블 (전수)

| 테이블 | 활동 신호 | 사용자 식별 | 시각 컬럼 |
|---|---|---|---|
| `User` | 가입, 최종 접속, 게스트/정회원, 추천인 | `id` | `createdAt`, `lastLoginAt`(★최신값 1개만) |
| `ChatSession` | 대화방 생성/갱신 | `userId` | `createdAt`, `updatedAt` |
| `Message` | 실제 채팅 발화 | 없음 → `ChatSession.userId` 조인 | `createdAt` (`role`: user / assistant / model) |
| `PointTransaction` | 포인트 적립·차감 + 사유 | `userId` | `createdAt` (`type`, `description`, `amount`, `balanceAfter`) |
| `MenuUsageLog` | **기능별 사용 로그** | `userId` | `createdAt` (`feature`) |
| `AiUsageLog` | AI 호출 원가·토큰 | `userId`(nullable) | `createdAt` |
| `ChannelSignup` (raw SQL 테이블, prisma 미반영) | ref 유입코드 → 가입 | `userId` (UNIQUE) | `createdAt` (`code`) |
| `ReferralVisit` (raw SQL 테이블, prisma 미반영) | ref 링크 방문 | 없음(익명) | `createdAt` (`code`) |
| `GuestCohortStat` | 삭제된 게스트 코호트 보존 통계 | 없음(집계값) | `cohortDate`(YYYY-MM-DD 문자열) |
| `Star` | 별풍선 후원 | `fromUserId` | `createdAt` |
| 기능별 결과 테이블 (`StockAnalysis`, `EbookProject`, `Webtoon`, `AgeTransform`, `ResearchHistory`, `MathTutorHistory`, `LuxuryVerification`, `InsuranceAnalysis`, `UsedItemListing`, `LcAttempt` …) | 해당 기능 산출물 | `userId` | `createdAt` |

### ref 유입코드 — 컬럼이 아니라 별도 테이블
`User`에 `ref` 컬럼은 **없다**. 유입 측정은 두 갈래다.
- 회원 추천: `User.referralCode`(내 코드) / `User.referredBy`(정수 userId) / `User.referralRewarded`
- 마케팅 채널: `ChannelSignup(code, userId)` — `lib/referral.ts`의 `CHANNEL_CODES` + `SHORTS_` 접두사에 걸리면 `referredBy` 대신 여기에 적재된다.

## 2. 지표별 계산 가능 여부

| 지표 | 가능? | 근거 / 계산식 | 한계 |
|---|---|---|---|
| **DAU(일별 활동 고유 유저)** | ✅ 가능(대리지표) | `Message`(role='user', ChatSession 조인) ∪ `PointTransaction`(type ∈ MENU/CHAT/STAR/BALLOON/CHARGE) ∪ `MenuUsageLog` 의 userId를 KST 일자별 DISTINCT | ★**진짜 접속(세션/페이지뷰) 로그가 없다.** "무료 기능만 둘러보고 나간 사람"은 잡히지 않는다 → 실제 DAU의 하한선이다. |
| **신규 가입 수** | ✅ 가능 | `User.createdAt` KST 일자별 COUNT, `provider='guest'` 분리 | 게스트는 7일 후 크론이 삭제 → 과거 구간은 실제보다 작게 나온다(`GuestCohortStat`로 보완 가능). |
| **채팅 횟수** | ✅ 가능 | `Message` where `role='user'` 일자별 COUNT + DISTINCT 유저 | 스트리밍 실패로 저장 안 된 발화는 누락. |
| **포인트 사용량(차감 합)** | ✅ 가능 | `PointTransaction` 중 type ∈ MENU/CHAT/STAR/BALLOON 의 `SUM(GREATEST(0, -amount))` | MENU 타입의 **양수**는 실패 환불이라 차감에서 제외해야 한다. |
| **기능별 사용 건수** | ✅ 가능 | `MenuUsageLog` 를 (일자, feature)로 GROUP BY | ①`checkMenuAccess`가 **잔액 ≥ 단가일 때만** 기록 → 잔액부족 시도는 미집계. ②차감 전에 기록 → 생성 실패도 1건으로 잡힌다. ③무료 기능(채팅 등)은 아예 안 남는다. |
| **누적 회원 수** | ⚠️ 근사만 가능 | `count(User.createdAt < from)` 을 기준선으로 잡고 일별 가입을 누적 | 탈퇴·게스트 삭제분이 과거에서 통째로 빠져 **역사적 누적치가 실제보다 낮게** 나온다. 정회원(`provider<>'guest'`) 누적을 함께 내려 판단을 돕는다. |
| **채널별 유입/전환** | ✅ 가능 | `ChannelSignup` / `ReferralVisit` | 이미 `/admin/referral-stats`, `/admin/marketing-daily`가 제공 — 이번 엔드포인트에선 중복 구현하지 않는다. |
| 리텐션(D1/D7/D30) | ⚠️ 근사만 | 위 활동 UNION 을 코호트로 재집계하면 가능 | 접속 로그가 없어 "활동=포인트/채팅"인 정의에 종속. 묶음 A 범위 밖. |
| **세션 수 / 체류시간** | ❌ **계측 없음** | — | 페이지뷰·세션 시작/종료 로그가 존재하지 않는다. |
| **일별 로그인 수 / 재방문** | ❌ **계측 없음** | — | `User.lastLoginAt`은 **최신값 1개**뿐이라 과거 일자별 로그인은 복원 불가. 필요하면 `LoginLog` 신설이 필요(스키마 변경 = 이번 묶음 범위 밖, '필요함'만 보고). |
| **화면·메뉴 진입 경로(클릭 스트림)** | ❌ **계측 없음** | — | 프론트 이벤트 트래킹이 없다. |
| **이탈/퍼널 단계별 드롭** | ❌ **계측 없음** | — | 위 두 항목이 없어 계산 불가. |
| **기기·브라우저·유입 레퍼러** | ❌ **계측 없음** | — | User-Agent/Referer를 저장하는 테이블이 없다. |

★ **없는 지표는 하드코딩하거나 더미로 채우지 않았다.** API 응답의 `instrumentation.missing` 배열에 위 ❌ 항목을 그대로 실어 보낸다 — 프론트(묶음 B)가 "계측 없음"으로 표시할 수 있게 하기 위함이다.

## 3. 기존 엔드포인트와의 관계 (중복 구현 금지)

| 엔드포인트 | 이미 주는 것 | 새 `activity-stats`가 더하는 것 |
|---|---|---|
| `GET /admin/marketing-daily` | 일별 가입(게스트/정회원), 채널, MENU 사용자·건수, 시간대별 가입 | — |
| `GET /admin/point-settlement` | 일자×type 포인트 결산, 미사용 포인트 부채 | — |
| `GET /admin/referral-stats` | 레퍼럴 퍼널·초대 순위·채널 | — |
| `GET /admin/ai-usage` | AI 원가·토큰 | — |
| **`GET /admin/activity-stats` (신규)** | | **DAU(활동 UNION)**, **채팅 횟수/채팅 유저**, **누적 회원 수**, **`MenuUsageLog` 기반 기능별 사용 건수**(기존은 PointTransaction.description 기반), 그리고 이 전부를 **빈 날 0으로 채운 하나의 날짜 축**으로 묶어 차트가 끊기지 않게 한 것 |

## 4. 발견한 위험

1. **`/admin/point-settlement`의 KST 변환이 뒤집혀 있다.** `DATE("createdAt" AT TIME ZONE 'Asia/Seoul')`는 naive UTC 값을 *서울시각으로 해석*해 timestamptz로 바꾸므로 결과가 **-9시간** 이동한다(세션 TZ=UTC 확인). 올바른 형태는 `marketing-daily`가 쓰는 `"createdAt" + interval '9 hours'`. → 이번 묶음은 읽기 전용/신규 추가 범위라 **고치지 않고 보고만 한다.**
2. `ai_mp/prisma/schema.prisma`가 정본과 크게 어긋나 있다. 활동 지표 작업을 이 파일 기준으로 하면 오답이 난다.
3. 접속(로그인/페이지뷰) 계측이 아예 없어, 대시보드의 "DAU"는 **과금·채팅 활동 기준 하한선**이라는 점을 화면에도 반드시 명시해야 한다.
