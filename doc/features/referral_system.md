# 추천인(레퍼럴) 시스템 — 기획

> 작성: 2026-06-21 | 상태: **기획 (미구현)**
> 목적: 기존 유저가 친구를 데려오면 양쪽에 포인트 보상 → 바이럴 유입. 광고비 대신 보상으로 유저 확보.

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
