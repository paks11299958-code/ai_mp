# 포인트 & 결제 시스템

## 포인트 종류
| 종류 | 설명 | 차감 순서 |
|------|------|----------|
| `bonusPoints` | 가입·레벨업·추천 무료 포인트 | 먼저 차감 |
| `paidPoints` | 결제로 구매한 유료 포인트 | bonusPoints 소진 후 차감 |

- 포인트 부족 시 **402** 응답 + "포인트가 부족합니다." 에러
- `api/_lib/points.ts` — `deductMenuPoints()`, `LEVELUP_BONUS` export

---

## 가입 보너스 & 온보딩 미션 (2026-06-07)

신규 가입 시 무료 bonusPoints 지급 + 행동 유도 미션:

| 항목 | 지급 | 함수 | 비고 |
|------|------|------|------|
| 가입 축하금 | 5,000P | `grantSignupPoints` | 일반/인증/카카오 3경로 모두 호출 (1pt=1원 전환으로 ×10) |
| 미션1 — 페르소나 첫 등록 | 5,000P | `grantMissionPoints(.., 'persona')` | 즐겨찾기 페르소나(`PUT /user/favorite-personas`) 첫 등록 |
| 미션2 — AI 기능 첫 등록 | 5,000P | `grantMissionPoints(.., 'feature')` | 즐겨찾기 기능(`PUT /user/favorites`) 첫 등록 |
| 추천 보상 (추천인) | 1,000P | `tryGrantReferral` | 내가 초대한 친구가 기능 1회 사용 시 |
| 추천 보상 (신규) | 1,000P | `tryGrantReferral` | 추천코드로 가입 후 기능 1회 사용 시 |

- **추천인 시스템(2026-06-22)**: 양방향 각 1000pt, 지급시점=친구 기능 1회 사용(어뷰징 방어). `type='REFERRAL'`(결산에서 무상지급 그룹) + `User.referralRewarded` 플래그로 중복방어. 차감 공통지점(`deductMenuPoints`)·채팅(`tryReferralAfterActivity`)에서 트리거. 상세 [features/referral_system.md](features/referral_system.md).
- (2026-06-17 1pt=1원 전환으로 500→5,000. `MISSION_REWARD=5000`, `grantSignupPoints`도 5000.)
- **중복방지**: `pointTransaction`에 `type='MISSION'` + description 기록이 이미 있으면 재지급 안 함(`awarded:false`) — 즐겨찾기 넣다뺐다 반복해도 1회만.
- bonusPoints는 `{increment:MISSION_REWARD}`로 누적. ⚠️ `grantSignupPoints`는 `=5000` 고정.
- 즐겨찾기 PUT 응답: `{ok, mission:{awarded, amount, balanceAfter}|null}`. 프론트 `useFavorites` onMissionAwarded 콜백 → `RewardAlertModal`(축하) + 잔액 갱신.
- 가입 직후 환영 모달(welcome): 축하금 + 남은 미션 안내. `lib/points.ts grantMissionPoints`, `routes/aimp/user.ts`, `frontend/components/RewardAlertModal.tsx`.

---

## 💸 대화 전면 무료화 (2026-07-08 사장 결정)

- **회원 일반 채팅 = 포인트 차감 0**. 기능·이미지(관상/손금/헤어/타로 등 MenuLimit) 과금은 불변.
- **하루 100회 한도**(KST 자정 리셋): `DAILY_FREE_CHAT_LIMIT`(shared-api lib/points.ts). 초과 시 **429 `DAILY_CHAT_LIMIT`** → 프론트는 충전 모달이 아니라 채팅 내 안내 말풍선(App.tsx).
- **XP+1·레벨업 보너스는 유지**: `recordFreeChatActivity` — 0원 CHAT 거래는 안 남기고 LEVELUP 거래만 기록.
- **레퍼럴 트리거 보존**: `tryReferralAfterActivity`는 활동(메시지) 기준이라 무료화와 무관하게 동작.
- 한도 판정 성능: Message(sessionId,createdAt)·ChatSession(userId) 인덱스 신설(서버1 raw SQL).
- **롤백 경로**: `deductPointsForMessage` 함수 보존(sessions.ts 호출부만 교체됨). `refundLastChatDeduction`은 무과금이면 no-op라 유지(레거시 차감 커버).
- 근거: 대화 원가 실측 건당 ≈0.4원(AiUsageLog) — 성장 단계에서 진입장벽 제거가 우선.

## XP & 레벨별 비용

(2026-06-17 1pt=1원 전환으로 비용·보너스 ×10)

| Lv | XP 범위 | 메시지 비용 | 레벨업 보너스 |
|----|---------|-----------|-------------|
| 1 | 0~29 | 100pt | — |
| 2 | 30~149 | 90pt | +200pt |
| 3 | 150~499 | 80pt | +500pt |
| 4 | 500~1199 | 70pt | +1,000pt |
| 5 | 1200~2499 | 60pt | +2,000pt |
| 6 | 2500+ | 50pt | +5,000pt |

---

## 가입 보너스
- 일반 가입: **200pt** (bonusPoints) — 결과카드 1회 무료 체험 가능

---

## 기능별 비용 (★1pt=1원 전환 2026-06-17)

**환산: 1pt = 1원** (2026-06-17 전환. 이전 1pt≈9~10원에서 모든 포인트 ×10). 충전 5,000원=5,000pt.
단가는 **DB `MenuLimit` 테이블**(feature×role) → `checkMenuAccess` 실시간 조회. **어드민 '메뉴권한' 탭에서 코드 배포 없이 조정 + 수익률(%) 표시**(원가 추정 FEATURE_COST_KRW).

| 단가(=원) | 기능 (menuKey) | 성격 |
|------|------|------|
| **100pt** | 오늘뉴스(news) | 가벼운 조회 |
| **300pt** | 관상(face)·손금(palm)·핫키워드(hot-keyword)·AI쌤 수학(mathtutor) | 단발성·일상·학생 |
| **500pt** | 주식(stock)·명품(luxury)·중고(used-item)·보험(insurance)·운세/퀵메뉴(quick-menu)·골프(golf) | 무거운 전문 분석 |
| **1000pt** | 헤어스타일 진단(hair) | 합성 실비 높음(~57원) |
| (사장 설정) | 닮은 연예인 찾기(lookalike) | 텍스트 1회 분석, 실비 ~2원, 바이럴 미끼 저가 의도. **MenuLimit 미등록 시 기본 50pt**(checkMenuAccess 폴백) |
| 채팅 | **무료**(2026-07-08, 일 100회 한도. 구: 레벨별 100→50pt) | `recordFreeChatActivity` |

- ⚠️ **1pt=1원 전환 시 ×10한 것**: STAGE_COSTS·LEVELUP_BONUS·가입보너스(5000)·미션(5000)·충전 PACKAGES·MenuLimit 단가·**기존 User 잔액(paidPoints·bonusPoints)**. 구매력 동일, 화폐만 직관화. 배포순서 shared-api→DB ×10 즉시→ai_mp.
- ⚠️ **수학(mathtutor)은 원래 운세와 같은 `quick-menu` 키였다가 분리** → 단가 독립.
- `PointTransaction.type = 'MENU'`(기능) / `'CHAT'`(채팅)
- 포인트 부족 시 **402** → 충전 모달(전역). 일일 제한 기능은 어드민 예외.
- **수익성**: AI 실비(Gemini Flash/Claude구독, 건당 1~57원) ≪ 차감(100~1000원) → 전 기능 흑자.
- **무료 기능(차감 없음)**: 웹툰 보기·모임(출첵)·전자책 만들기(추후 검토).

### ⭐ 포인트 부족 → 충전 모달 전역 처리 (2026-06-17)
- 모든 API 호출이 거치는 **공통 fetch 헬퍼에서 402 감지 → `window` 전역 이벤트 `insufficient-points` 발생 → App이 듣고 충전 모달(PointModal) 표시**.
- 프론트 API 경로가 둘이라 **양쪽 모두** 처리: `services/apiService.ts`의 `request`(헤어·관상·명품·수학 등) + `lib/boardFetch.ts`(주식분석·중고판매). 채팅 stream은 기존 코드 처리.
- 각 보드의 `alert(e.message)`/`setError`는 `INSUFFICIENT_POINTS` 영문 노출을 가드(전역 모달이 뜨므로 중복 알림 억제).
- 이전엔 채팅만 충전 모달이 떴고 보드 기능들은 에러 텍스트만 떴던 문제 해결.

---

## 결제 시스템 (토스페이먼츠 v1)

### 결제 금액별 포인트 (1pt=1원, 2026-06-17)
| 결제금액 | 포인트 | 보너스율 |
|---------|--------|---------|
| 5,000원 | **5,000pt** | — |
| 10,000원 | **11,000pt** | +10% |
| 50,000원 | **60,000pt** | +20% |

### 결제 플로우
```
1. PointModal에서 패키지 선택
2. toss.requestPayment('카드', { amount, orderId, successUrl, failUrl })
   - orderId: {userId}_{packageId}_{timestamp}
3. 완료 → Toss가 successUrl(/) 로 리다이렉트
   - /?paymentKey=xxx&orderId=xxx&amount=5000
4. App.tsx: URL 파라미터 감지 → 히스토리 클린업
5. 로그인 확인 후 POST /api/payments/confirm 호출
6. 서버: Toss API 검증 → paidPoints 지급 → CHARGE 트랜잭션
7. 프론트: 포인트 갱신 + "N pt 충전 완료!" 토스트
```

### 중복 처리 방지 (2026-06-17 강화)
- `PointTransaction.orderId TEXT @unique` 컬럼(raw SQL ALTER + unique 인덱스). 충전 시 orderId 저장.
- 1차: orderId 정확 매칭 조회 → 있으면 409. 2차(근본): 동시요청 race로 통과해도 INSERT가 **unique 위반(P2002) → 409**로 DB 레벨 차단.
- 토스 승인 후 지급 트랜잭션 실패 시 → `[지급실패-수동보정필요] userId/orderId/amount/paymentKey` 상세 로깅 + 사용자 안내("결제됐으나 지급실패, 고객센터"). 수동 보정 추적용.

### ⚠️ 토스 키 설정 (2026-06-17, 보안 분리)
- **클라이언트 키**(`VITE_TOSS_CLIENT_KEY`, `test_ck_...`/`live_ck_...`) = **공개값**(브라우저 번들 노출 정상) → `frontend/.env.production`에 두고 **git 커밋**. Vite가 빌드 시 `import.meta.env`로 주입(Vercel 자체 빌드라 .env.local은 안 들어감→.env.production 필요).
- **시크릿 키**(`TOSS_SECRET_KEY`, `test_sk_...`/`live_sk_...`) = **민감값** → **git 절대 금지**. 서버1 `.env`에만 직접 등록 + pm2 reload. `routes/aimp/payments.ts`의 `/confirm`이 사용(없으면 "결제 설정 오류" 500).
- 키 없을 때 증상: 클라이언트 키 없음→PointModal에서 "결제 설정이 준비되지 않았습니다"(결제창 안 열림). 시크릿 키 없음→결제창은 열리나 승인(confirm) 단계 500.
- ✅**라이브 전환 완료(2026-07-10) — 첫 실결제 5,000원 검증**. 이 과정의 함정 3개(재발 방지 필독):
  1. **키는 상점(MID)별×연동방식별 쌍**: 토스는 연동 신청마다 상점(MID)을 따로 만들어 개별 심사(우리 계정 3개: daichaojij=계약완료, 나머지 2개=심사중). **심사중 상점 키를 쓰면 402 "업체 사정으로 결제를 일시 중지"** — 키 자체는 인증되니 헷갈림. 반드시 상점관리자에서 **계약완료 상점**을 선택한 화면의 키 쌍을 쓸 것.
  2. **결제위젯 키(live_gck_) ≠ API 개별 연동 키(live_ck_)**: 우리 코드는 v1 결제창(requestPayment)이라 **API 개별 연동** 탭의 쌍만 유효. 클라·시크릿은 같은 탭에서 같이 복사.
  3. **시크릿 유효성 무해 검증**: `curl -u "KEY:" https://api.tosspayments.com/v1/payments/없는ID` → 404=인증OK, 401=키 불량 (결제 없이 확인 가능).
- confirm 거절 시 서버 로그에 사유 기록(`[payments/confirm] 토스 거절 code=... orderId=...`, 2026-07-10 추가) + 프론트 usePayment가 승인 실패를 **alert로 사용자에게 표시**(종전 console만 → 회원이 결제된 줄 오인했던 사고 후 수정).

### 관련 파일
- `frontend/components/PointModal.tsx` — 패키지 선택 + `toss.requestPayment`
- `frontend/.env.production` — `VITE_TOSS_CLIENT_KEY`(공개)
- `shared-api routes/aimp/payments.ts` — `/confirm`(시크릿 키 사용, 운영 백엔드)
- `frontend/index.html` — Toss SDK CDN (`js.tosspayments.com/v1/payment`)
- (레거시) `api/router.ts` payments 도메인 — Vercel api

---

## 신규 유저 지급 포인트 (2026-06-18)
- 가입 보너스 **1000pt**(이전 5000), 온보딩 미션(페르소나·기능 첫 등록) 보상 **각 1000pt**(이전 5000). 미션 2개 다 완료 시 가입1000+미션2000=**3000pt**.
- 코드: `lib/points.ts` `grantSignupPoints`(bonusPoints/amount/balanceAfter 1000) + `MISSION_REWARD=1000`, `routes/aimp/auth.ts` register/verify 응답 `bonusPoints:1000` 동기화. RewardAlertModal은 금액을 백엔드 값으로 표시 → 프론트 무수정.

## ★게스트(레퍼럴 체험계정) 포인트 정책 (2026-07-28 개편)
- **지급액 500pt** (`GUEST_SIGNUP_BONUS`) — 정식가입/카카오는 **1000pt 그대로**. `grantSignupPoints(prisma, userId, amount?)`로 인자 분리해 게스트만 다르게 준다.
- ~~첫 기능 1회 무료~~ → **당일 폐지**(사장 판단). 도입했다가 몇 시간 만에 되돌렸다: 500P가 이미 주력기능(200P) 2~3회분인데 무료 1회까지 얹으면 "빨리 소진돼 전환 지점에 닿게 한다"는 500P 조정의 의도가 절반 희석된다. **이제 게스트도 첫 사용부터 정상 차감**(검증: 500→300→100→차단).
  - `GUEST_FREE_TRIAL_DESC`('체험 첫 1회 무료') 상수는 **지우지 말 것** — `GuestCohortStat`·`GET /admin/guest-cohorts`가 이 문자열로 **이미 적재된** 0원 거래를 집계한다. 새로 기록되지는 않는다.
  - 화면 문구도 함께 정리: 환영 모달 "첫 기능 1회는 무료" → "이 포인트로 자유롭게", 메인 배너 "첫 번째 기능은 무료" → "체험 포인트 500P를 드렸어요". ★`MarketingBoard`의 '첫 1회 무료체험'은 **전 회원 대상 별개 정책**이라 유지.
  - 환영 모달의 "포인트를 다 쓰면 인증으로 정식 회원" 안내도 제거 — 지금 막 들어온 사람에게 전환 조건을 먼저 알리면 "나중에 떨어지면 그때 하지"가 되어 오히려 미루게 만든다. 전환 안내는 실제로 잔액이 부족해진 시점의 `GuestUpgradeModal`이 담당.
- **왜 바꿨나(실측 2026-07-28)**: 게스트 25명 중 **23명이 1000P를 1P도 안 씀**, 레퍼럴 유입 19명 중 **정식전환 0명**. 전환 모달(`GuestUpgradeModal`)이 "잔액 부족 시"에만 뜨는데 주력기능 단가가 대부분 200P라 **1000P=5회분 = 체험 중 절대 소진 불가** → 아무도 전환 지점에 도달한 적이 없었다. 500P+첫1회무료 = **3~4회 후 자연 소진**(실검증 `500→500→300→100→차단`).
- 프론트는 지급액을 **하드코딩하지 말 것** — `App.tsx`가 `1000`을 박아두고 있어 서버만 바꾸면 화면이 거짓 안내를 하게 된다. 서버 응답 `u.bonusPoints`를 쓴다.
- 효과 측정: 게스트는 7일 후 삭제되므로 `GuestCohortStat`에 삭제 직전 집계를 보존(=db_schema.md). 조회 `GET /admin/guest-cohorts`. **먼저 볼 신호는 `freeTrialCount`**(무료체험 실사용자 수).

## ★차감 시점 정책 (2026-06-18) — "결과 못 받으면 과금 안 됨"
- **동기 기능 = 'AI/결과 성공 후 차감'**: 분석 전엔 잔액 사전검사(402 차단)만 하고 **실제 차감은 결과 성공 후**. 차감이 드물게 실패해도 결과는 이미 나왔으니 반환.
  - 관상(face)·손금(palm): 선차감→증발 위험이었던 것을 성공후차감으로 수정(`e9743ee`). 손금은 사진불명확(422)도 과금 X → `refundMenuPoints` 제거.
  - 뉴스(news): 조회 성공 후 차감으로 수정(`8a7ffc9`).
  - 헤어(hair): 원래부터 합성 성공 후 차감(429 쿼터 실패 시 무과금).
- **비동기 기능 = '선차감 + 실패 환불'**(큐라 결과를 기다릴 수 없음): 주식·명품·보험·중고·스윙. `workers/_shared.ts runWorker`의 `refund:{menuKey,label}` 옵션 → 실패 task userId로 **menuLimit 직접조회**(checkMenuAccess는 menuUsageLog 부수효과라 회피)→환불.
- **혼합**: 핫키워드(hot-keyword)는 n8n 발송이 비동기라 선차감 유지 + 발송 실패(502/500) 시 환불(`8a7ffc9`, userId·deductedCost를 핸들러 스코프에 둬 catch에서 접근). 수학·퀵메뉴는 선차감+실패환불.
- `refundMenuPoints`는 `type='MENU'` 양수 거래로 기록(결산에서 '환불'로 분류).
- ⚠️교훈: 차감을 무조건 결과 뒤로 미루면 비동기·악용(창 닫기·잔액0 만들기)에 취약 → "성공 후 차감" 또는 "선차감+실패환불" 둘 중 하나로 통일.

## 포인트 사전 안내 (2026-06-18)
- 기능 실행 **전** 비용 인지 + 잔액 부족 시 헛로딩 없이 충전 유도. 방식: **실행 버튼에만 단가 "· N pt" 표시**(카드 둘러보기엔 숨김=돈냄새 최소화), 잔액<단가면 **누르는 즉시 충전모달**.
- 백엔드: `GET /api/aimp/points/menu-prices`(인증, USER 단가 일괄 `{feature:pointsCost}`).
- 프론트: `PointsContext`에 `menuPrices` 로드 + `priceOf(feature)`/`requirePoints(feature)` 헬퍼. requirePoints는 잔액<단가면 충전모달 띄우고 false(실행차단), 단가정보 없으면 막지 않음(서버 402 폴백).
- 적용 9개: 명품·중고·주식·보험·헤어·관상·손금·수학(풀이+출제)·핫키워드. 뉴스는 화면 차감 트리거 없어 제외.

## 무료였던 기능 차감 기능화 — 웹툰·모임·전자책 (2026-06-18)
무료였던 3개를 차감으로 전환. 어드민 메뉴권한 탭(FEATURE_LABELS)에 webtoon/club/ebook 등록 → 단가 조정 가능. 기능별 차감 시점이 달라 개별 설계.
- **웹툰 보기 (webtoon, 100pt)**: `GET /webtoon/:id` **첫 열람 시** 차감. `WebtoonView`(userId+webtoonId 유니크) 테이블로 기록 → **재열람 무료**(네이버웹툰식 영구소장). 동시요청은 열람기록 먼저 create(P2002로 중복차감 방지) 후 차감. **제목='에필로그' 회차는 무료**, 어드민/매니저 무료 미리보기. 열람 전 잔액검사(402).
- **모임 (club, 100pt)**: 모임 **개설**(`POST /clubs`) 시 1회 차감. **출석체크는 무료**(매번 하는 행위라 과금 시 출석률 저하). 생성 전 잔액검사(402), 생성 성공 후 차감.
- **전자책 (ebook, 500pt)**: 차감 시점 = 사용자가 **.docx를 받을 때**(`POST /:id/docx`). 본문은 새벽 cron이 **잔액 무관 무료 생성**(클로드 구독 ₩0이라 미리 만들어도 무손실). docx 요청 시: 미차감이면 **잔액 확인→부족하면 402(docx 안 줌=외상 원천차단)**, 충분하면 docx 생성 후 차감 + `EbookProject.charged=true`. **재다운로드·재생성은 무료**(이미 charged). ⚠️초기 'cron 본문생성 후 차감'은 잔액부족 시 외상+재시도 거의 안 되는 구멍이라 폐기.
- 교훈: 무료→차감은 "결과물 손에 쥐는 시점"이 기능마다 달라 차감 지점 개별 설계. 외상 방지=결과물 주기 전 잔액확인. 첫 1회만 과금엔 기록 테이블/플래그. 반복 행위(출첵)엔 과금 금지.

## 윤채린 "시간 여행"(구 미래의 나) — 개당 과금 (2026-06-21, 07-13 개편)
- 나이 변환(agetransform): 볼 나이 **1개 선택**(07-13 개편, 종전 최대 3개) → **100pt**. 회춘·노화 모두 지원. 상세 [features/age_transform.md](features/age_transform.md), 메모리 [[project_age_transform]].
- 생성(/generate) 시 잔액 사전검사(402), 차감은 **저장(/save) 시 개당×개수**. 취소=미저장·무과금.
- 헤어와 같은 나노바나나 쿼터 → 생성 신호등(lib/imageGenBusy) 공유, 혼잡 시 사전 안내.

## 어드민 포인트 관리 누락 수정 (2026-07-13)
- `MenuLimitsPanel`의 **FEATURE_LABELS 목록으로 표시 항목이 정해짐**(`ALL_FEATURES=Object.keys`). 여기 없으면 DB에 단가가 있어도 **어드민 화면에 안 뜸** → 조회·조정 불가.
- **agetransform(시간여행)·outfit(전통의상)이 누락**돼 있던 것 발견(DB엔 각각 100·200pt 있었음) → 라벨+실비추정(57원, nano-banana) 추가. DB 전체 대조로 이 둘만 누락 확인.
- ★교훈: 새 과금 기능 추가 시 **MenuLimit DB 등록만으로 끝이 아니라 AdminPanel FEATURE_LABELS에도 등록**해야 사장이 어드민에서 단가를 볼 수 있다.

## 결제(토스) 오픈 상태 — ✅ 실결제 오픈 (2026-07-10)
- confirm 코드 안전장치 완비: 금액 화이트리스트(5000/10000/50000), 토스 서버검증(시크릿키), orderId UNIQUE 중복차단(1차 조회+DB unique), 지급실패 `[지급실패-수동보정필요]` 로깅.
- ✅**2026-07-10 첫 실결제 성공**: 라이브 키(계약완료 상점 daichaojij, API 개별 연동 쌍) 전환 → 5,000원 실충전 → confirm 200 → CHARGE +5,000P(balanceAfter 정합) → 화면 실시간 반영까지 전 구간 실전 검증. 키 함정 3개는 위 "토스 키 설정" 절 참조.

## 환불 (2026-06-17, 정책 갱신은 위 "차감 시점 정책 2026-06-18" 참조)
- `refundMenuPoints`는 `type='MENU'` 양수 거래로 기록(결산에서 '환불'로 분류).

## 결산 & 내역 (2026-06-17)
- **어드민 전사 결산**: `GET /api/aimp/admin/point-settlement?days=` (ADMIN). PointTransaction을 KST 일자×type 집계 → 충전(매출)·소비·무상지급·환불 일별 + 미사용 잔액(부채). 어드민 '포인트 통계' 탭 상단에 요약카드+일별표(7/30/90일).
- **사용자 거래내역**: `GET /api/aimp/points`(기존)의 `transactions`(최근 50건) → 내정보>페르소나 통계 탭에 시간순 명세(충전/사용/보너스, type별 한글라벨). 본인 것만(어드민 결산과 분리).
- ⚠️ `points/stats`(개인 통계)와 `admin/point-settlement`(전사 결산)는 별개 — 전자는 userId 기준이라 결산용 아님.

## 레퍼럴 시스템 (구현 예정)

→ [features/referral_system.md](features/referral_system.md) 참조

## 포인트 부족(402) → 충전모달 트리거 (2026-06-24 점검·수정)

차감 기능 클릭 시 포인트가 부족하면 백엔드가 **402 "포인트가 부족합니다."**(사전 잔액검사, 차감 전 차단)를 주고, 프론트는 **`insufficient-points` 커스텀 이벤트**를 dispatch → App.tsx 리스너가 `setShowPointModal(true)`로 전역 충전모달을 띄운다.

- **자동 처리(원칙)**: `services/apiService.ts`의 `request`(라인34)와 `lib/boardFetch.ts`(라인9)가 402를 받으면 자동으로 이벤트를 쏜다. **차감 기능은 이 헬퍼를 쓰는 게 원칙.**
- ⚠️**raw fetch 함정**: 보드가 `fetch()`를 직접 쓰면 위 자동처리를 안 타서, 402가 와도 충전모달이 안 뜨고 에러 텍스트만 보인다. **수동으로 `if (res.status===402) window.dispatchEvent(new CustomEvent('insufficient-points'))` 추가 필수.**
- 2026-06-24 누락 수정: 명품·보험·수학(공통 apiFetch 래퍼)·핫키워드(인라인)·오늘뉴스. PointModal z-index 50→70(보드 위 표시).
- 점검법: `grep -c "await fetch"` (raw) vs `grep -cE "boardFetch|request|insufficient-points"` (안전).

## 2026-07-05 전수 감사 + 보안·경합·환불 정비 (shared-api `eac077c`)

차감 20지점·충전·환불 전수 감사 후 6건 수정. 배포 완료(서버1).

- **quick-menu /activate 취약점 제거**: body.cost 그대로 차감(조작 가능)하던 것 → 서버가 MenuLimit('quick-menu') 단가 결정 + 일일한도 적용. 클라이언트 cost는 무시.
- **경합(lost update) 방어**: `deductMenuPoints`/`deductPointsForMessage` = 읽은 잔액 그대로일 때만 감액(조건부 updateMany) + 재시도 3회. 환불·충전·가입보너스·레벨업 = `increment` 원자 가산. **원칙: 포인트 잔액에 절대값 set 금지.**
- **실패 환불 신설**: AI쌤 수학 풀이(출제와 동일 패턴) + 채팅 응답 실패 시 `refundLastChatDeduction`(lib/points) — 최근 5분 내 CHAT 차감 1건당 CHAT_REFUND 1건(멱등), 무과금자(관리자) no-op. chat-stream catch에서 호출.
- **menuAccess**: 잔액부족 요청은 menuUsageLog 미기록(일일한도 선소모 방지). MenuLimit 미등록 기능이 기본 50P 적용될 때 `[menuAccess][단가미등록]` 에러 로그(어드민 에러카드에서 발견 → 사장이 메뉴권한 탭에 등록).
- **워커 환불액 정확화**: StockAnalysis·LuxuryVerification·UsedItemListing·InsuranceAnalysis에 `pointsCharged` 컬럼(raw SQL) — 요청 시 실제 차감액 저장, `workers/_shared` 환불이 이 값 우선(옛 레코드는 단가 재조회 폴백).
- 검증 완료(양호 확인): 충전=패키지 화이트리스트+토스 서버검증+orderId UNIQUE(실DB 인덱스 확인) / AI 성공 후 차감군(관상·손금·닮은꼴·헤어·미래의나·전자책·웹툰) / 선차감+자동환불군(퀵메뉴·출제·핫키워드·마케팅·비동기워커 4종).
