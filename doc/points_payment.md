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
| 가입 축하금 | 500P | `grantSignupPoints` | 일반/인증/카카오 3경로 모두 호출 |
| 미션1 — 페르소나 첫 등록 | 500P | `grantMissionPoints(.., 'persona')` | 즐겨찾기 페르소나(`PUT /user/favorite-personas`) 첫 등록 |
| 미션2 — AI 기능 첫 등록 | 500P | `grantMissionPoints(.., 'feature')` | 즐겨찾기 기능(`PUT /user/favorites`) 첫 등록 |

- **중복방지**: `pointTransaction`에 `type='MISSION'` + description 기록이 이미 있으면 재지급 안 함(`awarded:false`) — 즐겨찾기 넣다뺐다 반복해도 1회만. **스키마 변경 없음**.
- bonusPoints는 `{increment:500}`로 누적(가입 500P 덮어쓰기 방지). ⚠️ `grantSignupPoints`는 `=500` 고정인 것과 다름.
- 즐겨찾기 PUT 응답: `{ok, mission:{awarded, amount, balanceAfter}|null}`. 프론트 `useFavorites` onMissionAwarded 콜백 → `RewardAlertModal`(축하) + 잔액 갱신.
- 가입 직후 환영 모달(welcome): 축하금 + 남은 미션 안내. `lib/points.ts grantMissionPoints`, `routes/aimp/user.ts`, `frontend/components/RewardAlertModal.tsx`.

---

## XP & 레벨별 비용

| Lv | XP 범위 | 메시지 비용 | 레벨업 보너스 |
|----|---------|-----------|-------------|
| 1 | 0~29 | 10pt | — |
| 2 | 30~149 | 9pt | +20pt |
| 3 | 150~499 | 8pt | +50pt |
| 4 | 500~1199 | 7pt | +100pt |
| 5 | 1200~2499 | 6pt | +200pt |
| 6 | 2500+ | 5pt | +500pt |

---

## 가입 보너스
- 일반 가입: **200pt** (bonusPoints) — 결과카드 1회 무료 체험 가능

---

## 기능별 비용

| 기능 | 비용 | 처리 위치 | 일일 제한 |
|------|------|----------|----------|
| 시운의 흐름 / 성취와 재물 / 인연의 결 | **50pt** | `/api/quick-menu-result` | 없음 |
| 관상학 | **50pt** | `/api/face-reading` | 없음 |
| 꿈해몽 | **50pt** | `/api/quick-menu-activate` (메뉴 선택 시) | 없음 |
| 스윙 분석 (골프) | **50pt** | `/api/swing-analysis/analyze` | 없음 |
| 주식 분석 | **50pt** | `/api/stock-analysis` POST | 1회/일 |
| 중고 판매 분석 | **50pt** | `/api/used-item` POST | 1회/일 |
| 명품 진위 감정 | **50pt** | `/api/luxury-verify` POST | 1회/일 |

- `PointTransaction.type = 'MENU'`
- 일일 제한 기능: 어드민 계정(`paks1012@naver.com`) 예외
- 포인트 부족 시 **402** 응답 (`INSUFFICIENT_POINTS`)
- **환산**: 1pt ≈ 10원 (5,000원 결제 시 500pt 기준)

---

## 결제 시스템 (토스페이먼츠 v1)

### 결제 금액별 포인트
| 결제금액 | 포인트 | 보너스율 |
|---------|--------|---------|
| 5,000원 | **500pt** | — |
| 10,000원 | **1,100pt** | +10% |
| 50,000원 | **6,000pt** | +20% |

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

### 중복 처리 방지
- PointTransaction.description에 orderId 포함 저장
- 동일 orderId 재요청 시 **409** 반환

### 관련 파일
- `frontend/components/PointModal.tsx`
- `frontend/services/pointService.ts` — `confirmPayment()`
- `api/router.ts` — payments 도메인
- `api/_lib/points.ts`
- `frontend/index.html` — Toss SDK CDN

---

## 레퍼럴 시스템 (구현 예정)

→ [features/referral_system.md](features/referral_system.md) 참조
