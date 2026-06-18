# 윤채린 헤어스타일 진단 + AI 헤어 합성 (2026-06-16)

내 사진을 올리고 헤어스타일을 고르면, 윤채린(뷰티 컨설턴트)이 **어울림을 진단**하고 **내 얼굴에 그 헤어를 입힌 합성 이미지**를 보여준다.

## 흐름
1. 윤채린 채팅 → "헤어스타일 진단" 버튼 (또는 기능 둘러보기 카드)
2. 내 사진 업로드(정면) → 성별(여/남) → 헤어 갤러리에서 선택
3. "✨ 합성하고 진단받기" → ~10초 후:
   - **Before/After 합성 이미지** (원본 vs 헤어 입힌 내 모습)
   - 윤채린 진단 텍스트: 얼굴형 · 어울림 · 스타일링 팁 · 대안 추천 · 총평

## 구성

### DB — HairStyle (남8/여8)
`styleKey · name · gender · imageUrl · promptEn · order · isVisible`. 견본은 Imagen 생성물, GCS `hairstyles/`. (db_schema.md 참조)

### 헤어 견본 생성 (일회성)
- 모델 `imagen-3.0-generate-002` (Vertex, **us-central1**)
- ⚠️ Imagen 분당 쿼터가 빡빡(2~3건/분) → 429 시 70초 대기 재시도 + 장당 18초 간격으로 16장 생성
- 추가/교체 시에만 재생성. 어드민 등록 화면은 아직 없음(필요 시 추가)

### 백엔드 (shared-api)
- `GET /api/aimp/hair/styles?gender=` — 목록(공개)
- `POST /api/aimp/hair/analyze` — 인증 필요. 텍스트 진단 + 합성을 **Promise.all 병렬**
  - `analyzeHairStyle()` — Gemini 2.5 Flash, 사진 inlineData → JSON 진단 (관상/손금과 동일 패턴, 윤채린 systemInstruction 주입)
  - `generateHairTryOn()` — **합성**. 합성 실패해도 null 반환해 텍스트 진단은 살림
- `lib/gemini.ts`에 두 함수, `routes/aimp/hair.ts` 라우트

### ★ AI 헤어 합성 (gemini-2.5-flash-image / nano-banana)
- 사진 + 헤어 영문 설명 → **얼굴·피부톤·배경·표정 유지 + 헤어만 교체**한 이미지 생성 → GCS `hair-tryon/`
- ⚠️ **이 모델은 `global` 리전에서만 제공** (us-central1은 404) → `getImageAI()` 별도 클라이언트(location:'global')
- 실측: 9.3초, 안경 쓴 곱슬 사진으로도 얼굴 동일성·안경 완벽 유지
- 비용 ~53원/장 (텍스트 진단 ~2.7원 별도). gpt-image-1보다 얼굴 보존 우위(인상·안경 유지)

### 프론트 (HairStyleBoard.tsx)
- 4단계 화면 + 결과(Before/After 이미지 + 진단). 모바일 우선
- **윤채린 채팅 버튼**: `personaFeatures.ts`의 NAME_FALLBACK['윤채린']=['hair'] (강지훈→ebook 패턴 동일)
- `App.tsx` FEATURE_ACTIONS.hair + 보드 렌더 2곳, vercel.json `/api/hair` 프록시

## 주의·교훈
- **EXIF 회전 필수**: 폰 사진은 EXIF 회전정보로 화면엔 똑바로/픽셀은 누워있음 → AI 합성결과가 옆으로 90도 돌아 나옴. `createImageBitmap(file,{imageOrientation:'from-image'})`로 픽셀에 회전 적용 + canvas 1280 축소 후 전송.
- **로딩 UX**: 10초+ 단건은 단계 로딩 오버레이(사진분석→합성→진단 타이머 순차)가 맞음. 주식분석식 비동기 큐는 "오래걸림+여러개+백그라운드"일 때만(헤어엔 과함).
- **이미지 모델 리전**: imagen=us-central1, gemini-2.5-flash-image=global. 모델마다 제공 리전 다름.
- 포인트 차감 미적용(현재 무료). 관상처럼 menuAccess 'hair' 키 등록하면 차감 가능.

## 향후
- 어드민 헤어 등록 화면, 여러 헤어 동시 비교(이땐 큐), 포인트 차감
