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
| 채팅 | 메시지당 레벨별 **100→50pt** (XP↑ 할인, STAGE_COSTS) | `deductPointsForMessage` |

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
- 현재 상태(2026-06-17): 클라이언트 키(테스트) 등록 완료→결제창 열림 확인. 시크릿 키는 미등록(추후)→실제 충전 완료는 시크릿 키 등록 후.

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

## 윤채린 "미래의 나" — 개당 과금 (2026-06-21)
- 나이 변환(agetransform): 나이대별 목표나이 중 **선택형(최대 3개)** → **개당 100pt**(고른 개수 × 단가). 1~3개=100~300pt.
- 생성(/generate) 시 잔액 사전검사=개당×개수(402), 차감은 **저장(/save) 시 개당×개수**("미래의 나 N장"). 취소=미저장·무과금. 상세 [features/age_transform.md](features/age_transform.md).
- 헤어와 같은 나노바나나 쿼터 → 생성 신호등(lib/imageGenBusy) 공유, 혼잡 시 사전 안내.

## 결제(토스) 오픈 상태 (2026-06-18)
- confirm 코드 안전장치 완비: 금액 화이트리스트(5000/10000/50000), 토스 서버검증(시크릿키), orderId UNIQUE 중복차단(1차 조회+DB unique), 지급실패 `[지급실패-수동보정필요]` 로깅.
- 클라이언트키(test_ck) 빌드 포함·SDK 로드 라이브 확인됨 → **결제창은 뜸**.
- ⚠️**마지막 차단점 = `TOSS_SECRET_KEY` 미설정**(서버1 .env). 키 입력+reload 시 충전 완료(confirm) 동작. 테스트키(test_sk)로 검증 후 라이브 전환 권장(클라이언트·시크릿 키 짝 맞출 것).

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
