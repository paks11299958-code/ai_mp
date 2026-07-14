# 시간 여행 (윤채린) — 구현 완료 (구 "미래의 나")

> 갱신: 2026-07-13 | 상태: **✅ 구현·배포 완료** (아래 "기획" 본문은 초기안 히스토리)

## ★최종 사양 (2026-07-13 "시간 여행" 개편)
- **이름**: "미래의 나" → **"시간 여행"** (헤더·버튼·카드·약관·검색 동의어 통일).
- **컨셉**: 내 사진 + 현재 나이 → **회춘(과거)·노화(미래) 모두**. (종전 '노화만'에서 07-13 회춘 재도입 — 사장 "진짜 시간여행" 지시)
- **나이 체계**: 10대~80대를 각 연대 대표나이(연대+5 = 15,25,…,85)로. 백엔드 `DECADE_AGES=[15,25,…,85]`, `isAllowedAge(t,cur)`=대표나이이고 내 연대와 다르면 허용(회춘·노화 모두, 위변조 방어). (종전 futureTargetAges 표 룩업 폐기)
- **1개 선택 + 100pt**: 볼 나이 **1개만** 선택(라디오). MenuLimit `agetransform` 100pt(어드민 조정). 실비 ~57원/장이라 흑자.
- **UI**: 현재나이=**세로 휠 다이얼**(AgeDial, 스크롤 스냅·가운데값=선택, 1~99). 볼 나이=**10~80대 한 줄 균등분할 칩**(flex-1, 스크롤 없이 다 보임, 내 연대 제외). 라벨 'N년 전↩/후↪'.
- **Before/After 슬라이더**: 결과는 원본(지금)↔결과 드래그 슬라이더로 겹쳐보기 + 탭 전환.
- **생성 신호등(헤어와 공유)**: 같은 나노바나나 쿼터 → `lib/imageGenBusy.ts` 공용(429시 90초). `GET /age-transform/status`·`/hair/status` 둘 다 사용. 프론트 15초 폴링→🟢/🔴, 혼잡 시 버튼 비활성.
- **저장/취소**: 생성분 미저장 → 저장 눌러야 DB확정+개당×개수 차감, 취소=미저장(GCS만, gcs-cleanup).
- **백엔드** `routes/aimp/age-transform.ts`: generate(selectedAges `isAllowedAge` 위변조 방어)/save/list/status. **AI** `generateAgeTransform`(lib/gemini.ts, 회춘/노화 프롬프트 분기). **프론트** `AgeTransformBoard.tsx`. DB `AgeTransform`(imagesJson={"42":url,...}). 상세 메모리 [[project_age_transform]].

---
<!-- 아래는 초기 기획안(4구간·400pt·과거포함) — 히스토리 보존용. 실제 구현은 위 최종 사양 참조. -->

# (초기안) 나이 변환 (윤채린) — 기획

> 작성: 2026-06-21 | 상태: 초기 기획 (이후 위 최종 사양으로 개편됨)
> 컨셉: 내 사진을 올리면 여러 나이대(10·30·50·70대)의 내 얼굴을 AI로 생성, 슬라이더로 나이대를 바꿔보며 감상. 저장/취소 선택.

---

## 1. 핵심 결정 (확정)
- **구간 = 4개**: 10대 / 30대 / 50대 / 70대 (7구간은 ~60초·비용 7배라 4구간으로 절반. 핵심 나이대 커버)
- **생성 = 한 번에 전 구간**: 업로드 후 4장 다 생성 → 구간 선택 시 즉시 전환(대기 없음). 사장 구상의 "선택하면 자동으로 바뀜" 충족.
- 단가: ★미정 (헤어 200pt 기준 4장이면 그 이상. 제안 300~500pt). 결정 후 MenuLimit 등록.

## 2. 기술 — 헤어 합성(generateHairTryOn) 재활용
- 모델: `gemini-2.5-flash-image`(나노바나나, **global 리전**, getImageAI). 얼굴·정체성 유지하며 편집 → 나이변환에 적합.
- 신규 함수 `generateAgeTransform(imageBase64, mimeType, ageLabel)`:
  - 프롬프트: "Change only the apparent age of the person to {10s/30s/50s/70s}. Keep the exact same identity, face structure, skin tone(자연스런 노화 반영), background. Photorealistic." (헤어 프롬프트 변형)
  - 429 재시도(5→10→15s)·GCS 업로드(`age-transform/{userId}/...png`) 패턴 그대로.
- ⚠️헤어와 동일 주의: 폰사진 **EXIF 회전보정**(createImageBitmap from-image) 프론트에서 필수. 합성은 분당 쿼터 빡빡 → 4장 **순차**(병렬은 429 폭증) 또는 간격.

## 3. 흐름 (UI)
```
1. 사진 업로드 (헤어와 동일 컴포넌트 패턴, EXIF 보정·1280 축소)
2. "나이 변환 시작" → 단계 로딩(4장 순차 생성, ~30초, '10대 생성중→30대...' 진행표시)
3. 결과: 슬라이더/탭(10·30·50·70) → 이미지 즉시 전환(이미 다 생성됨) + Before(원본)/After
4. [💾 저장] → DB 기록 유지 / [✕ 취소] → 생성분 저장 안 하고 닫기
```

## 4. ★저장/취소 — 헤어엔 없던 부분 (핵심 신규)
- **취소 시 저장 안 함**이 요구사항 → 생성 직후엔 임시 상태, **저장 눌러야 DB 확정**.
- 방식 결정 필요:
  - A) 생성 즉시 GCS 업로드(이미지는 GCS에 있음)하되 **DB row는 저장 시에만** 생성. 취소하면 GCS 고아 이미지 남음 → gcs-cleanup cron이 정리(기존 스킬 있음).
  - B) 생성분을 응답으로만 들고 있다가 저장 시 GCS+DB 한번에. 취소하면 GCS에도 안 올라감(깔끔). → **권장**(고아 이미지 없음). 단 저장 시 4장 업로드 시간 약간.

## 5. 데이터 모델 (저장 시, 서버1 raw SQL·db push 금지)
```sql
CREATE TABLE "AgeTransform" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "originalUrl" TEXT,              -- 원본(선택)
  "imagesJson" TEXT NOT NULL,      -- {"10s":"url","30s":"url","50s":"url","70s":"url"}
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
- 차감: MenuLimit feature `agetransform` (퀵메뉴 키분리 사례[mathtutor]처럼 독립 키). 차감 시점 = **생성 성공 후**(헤어 패턴, 4장 중 1장이라도 나오면? or 전부?) → 제안: 전 구간 성공 후 1회 차감, 부분 실패 시 무과금 or 비례. ★결정 필요.

## 6. 백엔드 (shared-api routes/aimp/age-transform.ts 신규)
- `POST /age-transform/generate` (인증): body 사진 → 4장 생성(GCS 업로드) → URL 4개 반환. **DB 저장 안 함**(미저장 상태). 잔액 사전검사(402).
- `POST /age-transform/save` (인증): 생성된 4 URL → AgeTransform row 생성 + **차감**(성공 후). 저장 확정.
- `GET /age-transform` (인증): 내 저장 목록.
- vercel.json `/api/age-transform` 프록시 추가.

## 7. 프론트 (ai_mp)
- `AgeTransformBoard.tsx` 신규(HairStyleBoard 패턴 복제): 업로드→로딩→슬라이더 결과→저장/취소.
- personaFeatures.ts: FeatureKey에 `agetransform` 추가 + `NAME_FALLBACK['윤채린']=['hair','agetransform']` + FEATURE_REGISTRY 항목. 기능카드(life 카테고리)도.
- 단계 로딩 오버레이(헤어 c609bc9 패턴): 4장이라 '10대→30대→50대→70대' 진행.

## 8. 구현 순서
1. 백엔드 generateAgeTransform + generate/save/list API + DB 테이블
2. 프론트 AgeTransformBoard(업로드→생성→슬라이더→저장/취소) + 윤채린 기능 등록 + 프록시
3. 차감(MenuLimit) + 단계로딩 + 모바일 검증(Playwright 390)

## 9. ★미결 (사장 결정)
- 단가(제안 300~500pt) / 차감 시점(전 구간 성공 후 1회) / 저장방식(B 권장=취소 시 GCS도 안 올림).
- 구간 라벨 표기(10대/30대… or 17세/35세… 구체 나이?).

관련: 헤어 [[project_hair_styling]], 포인트 [points_payment.md](../points_payment.md).
