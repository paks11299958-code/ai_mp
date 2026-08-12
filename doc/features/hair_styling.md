# 윤채린 헤어스타일 진단 + AI 헤어 합성 (2026-06-16)

내 사진을 올리고 헤어스타일을 고르면, 윤채린(뷰티 컨설턴트)이 **어울림을 진단**하고 **내 얼굴에 그 헤어를 입힌 합성 이미지**를 보여준다.

## 흐름
1. 윤채린 채팅 → "헤어스타일 진단" 버튼 (또는 기능 둘러보기 카드)
2. 내 사진 업로드(정면) → 성별(여/남) → 헤어 갤러리에서 선택
3. "✨ 합성하고 진단받기" → **~30초**(운영로그 122건 실측: 중앙 14.5초·최대 79초) 후:
   - **Before/After 합성 이미지** (원본 vs 헤어 입힌 내 모습)
   - 윤채린 진단 텍스트: 얼굴형 · 어울림 · 스타일링 팁 · 대안 추천 · 총평

## 구성

### DB — HairStyle (남24/여24, 총 48종 · 2026-07-13 트렌디 16종 추가)
`styleKey · name · gender · imageUrl · promptEn · order · isVisible`. 견본은 gemini-2.5-flash-image 생성물, GCS `hairstyles/{styleKey}.png`. (db_schema.md 참조)
- **2026-07-13 트렌디 16종 추가**(32→48): 여8=커튼뱅레이어드·글램웨이브·허쉬울프·물결펌·슬릭번·숏울프·태슬컷·플로우펌 / 남8=리젠트·커튼컷·다운펌·힙합펌·이루마펌·페이드·가르마다운펌·물결펌 (order 32~47). 프론트 `/styles` 실시간 조회라 **배포 불필요, 새로고침 즉시 반영**.

### 헤어 견본 생성 (일회성)
- 모델: 초기 imagen-3.0 → **2026-07-13부터 `gemini-2.5-flash-image`(합성과 동일, Vertex global)** text→image로 견본 생성. 완성도 imagen 동등 이상.
- 상주 스크립트: `shared-api/scripts/gen_hair_samples.ts`(SAMPLES 배열만 교체→서버1 로컬 저장) + `upload_hair_samples.ts`(GCS 업로드+DB upsert; ★prisma/storage는 dotenv 이후 **동적 import** 필수). 워크플로=파일럿 2~3종 검수→통과 후 전체→전부 검수(기존 규격 재현: 정면 상반신·라이트그레이 배경·무지니트·1024 정사각).
- (구) 모델 `imagen-3.0-generate-002` (Vertex, **us-central1**)
- ⚠️ Imagen 분당 쿼터가 빡빡(2~3건/분) → 429 시 70초 대기 재시도 + 장당 18초 간격으로 16장 생성
- 추가/교체 시에만 재생성. 어드민 등록 화면은 아직 없음(필요 시 추가)

### 백엔드 (shared-api)
- `GET /api/aimp/hair/styles?gender=` — 목록(공개)
- `POST /api/aimp/hair/analyze` — 인증 필요. 텍스트 진단 + 합성을 **Promise.all 병렬**
  - `analyzeHairStyle()` — Gemini 2.5 Flash, 사진 inlineData → JSON 진단 (관상/손금과 동일 패턴, 윤채린 systemInstruction 주입)
  - `generateHairTryOn()` — **합성**. 합성 실패해도 null 반환해 텍스트 진단은 살림
    - **★얼굴 보존 프롬프트 강화(2026-07-13, A/B 검증 후 배포)**: 합성 시 얼굴이 갸름·V라인화되던 문제 → "헤어만 변경, 눈·코·입·얼굴형·턱선·나이 원본 정확 보존, 성형·미화 금지"로 강화. **우리는 Gemini(나노바나나) API라 SD계열 ControlNet/InsightFace/Denoising Strength 개념 없음** → 프롬프트 강화가 정답. A/B(여·남) 원본 얼굴 보존 확연 개선 실증. 원가 영향 없음(이미지 정액과금).
- `lib/gemini.ts`에 두 함수, `routes/aimp/hair.ts` 라우트

### ★ AI 헤어 합성 (gemini-3.1-flash-image / Nano Banana 2)
- 사진 + 헤어 영문 설명 → **얼굴·피부톤·배경·표정 유지 + 헤어만 교체**한 이미지 생성 → GCS `hair-tryon/`
- ⚠️ **이 모델은 `global` 리전에서만 제공** (us-central1은 404) → `getImageAI()` 별도 클라이언트(location:'global')
- 실측: 9.3초, 안경 쓴 곱슬 사진으로도 얼굴 동일성·안경 완벽 유지
- 비용 ~53원/장 (텍스트 진단 ~2.7원 별도). gpt-image-1보다 얼굴 보존 우위(인상·안경 유지)
- **2026-07-21**: 프로필사진 기능에 맞춰 합성 모델을 `gemini-2.5-flash-image`(preview로 밀림)에서 `gemini-3.1-flash-image`(정식)로 통일. 견본사진(위 DB 항목)은 구모델로 만든 기존 것 그대로 재사용 — 견본은 화면 표시 전용이라 합성 모델과 무관.

### 프론트 (HairStyleBoard.tsx)
- 4단계 화면 + 결과(Before/After 이미지 + 진단). 모바일 우선
- **윤채린 채팅 버튼**: `personaFeatures.ts`의 NAME_FALLBACK['윤채린']=['hair'] (강지훈→ebook 패턴 동일)
- `App.tsx` FEATURE_ACTIONS.hair + 보드 렌더 2곳, vercel.json `/api/hair` 프록시

### 결과 저장·크게 보기 (2026-07-12)
- **버튼 2개**(밑줄 링크 폐지): 🔍 크게 보기(라이트박스) · 📥 갤러리에 저장.
- **갤러리 저장 = 사진 파일만**(`handleSaveImage`): iOS=`navigator.share({files:[file]})`(이미지만 담은 공유시트→'이미지 저장'이 사진앱; iPad는 UA가 Mac이라 `maxTouchPoints>1`로 보정) / 그 외=`<a download>`. ★링크·캡션 미포함(공유=자랑하기 전용과 분리).
- **크게 보기 라이트박스**: z-85 오버레이(헤어창 z-70 위), 하단 [닫기·저장] + 우상단 ✕. ★버블링 버그 주의: 라이트박스가 최상위 div(onClick=onClose)의 자식이라, 닫기/배경 클릭이 부모로 버블링되면 헤어 진단 창까지 닫힘 → 배경·✕·닫기 전부 `stopPropagation` 필수.
- **★GCS CORS 우회 중계 라우트** `GET /api/hair/image?path=hair-tryon/*.png|jpg|webp`(shared-api hair.ts): 저장·공유의 blob fetch가 CORS 필요한데 **ai-mp-media 버킷 CORS 설정 권한 없음**(SA=storage.buckets.update 거부, VM 스코프=read_only) → 버킷 대신 서버가 GCS 원본을 받아 같은 출처로 재전송(경로 화이트리스트=조작 차단, 24h 캐시). 프론트는 `imageUrl`을 `/api/hair/image?path=` 로 변환(`proxyImageUrl`)해 저장·공유·자랑하기에 사용.
- **견본 썸네일 lazy-load**(`<img loading="lazy" decoding="async">`): 스타일 개수 늘어도 초기 로딩 일정. ★근본은 견본 원본이 장당 ~1.3MB(성별당 16장). 견본은 화면 표시 전용(합성은 `promptEn` 텍스트만 씀=화질 무관)이라 대량 추가 시 썸네일 축소(40배)가 정석.

## 주의·교훈
- **EXIF 회전 필수**: 폰 사진은 EXIF 회전정보로 화면엔 똑바로/픽셀은 누워있음 → AI 합성결과가 옆으로 90도 돌아 나옴. `createImageBitmap(file,{imageOrientation:'from-image'})`로 픽셀에 회전 적용 + canvas 1280 축소 후 전송.
- **로딩 UX**: 단건은 단계 로딩 오버레이(사진분석→합성→진단 타이머 순차)가 맞음. 주식분석식 비동기 큐는 "오래걸림+여러개+백그라운드"일 때만.
  - ★**2026-08-12 정정**: "10초+"라는 전제 자체가 틀렸다. 운영로그 122건 실측은 **중앙 14.5초·최대 79.4초**인데 화면은 "보통 10초쯤"이라 안내하고 있었다. 안내보다 오래 걸리면 회원은 성공할 작업을 **'실패했다'고 판단하고 화면을 닫는다.** → 경과 초 실시간 표시 + 40초/75초 구간 안내 + 75초 초과 시 "실패한 게 아니니 화면을 닫지 마세요"로 교체(`ai_mp cef8acf`). 단계 전환 타이머도 2.5s·8s → **6s·18s**(종전 값은 8초 만에 마지막 단계에 도달해 남은 시간 내내 멈춘 것처럼 보였다).
  - ★큐가 "과함"이라던 판단도 재검토 대상이다 — 최대 79초면 큐가 맞는 구간이다. 프로필사진·나이변환과 함께 **백그라운드 큐 전환**이 할 일로 등록돼 있다(메모리 `project_todo`).
  - ★**429 완화**: 헤어·프로필사진·나이변환이 **한 GCP 프로젝트의 Vertex 한도를 공유**한다. 동시 호출이 서로를 밀어내므로 `runImageGenSerialized()`로 직렬화했다(`shared-api de5e60a`). ★헤어는 **이미지 생성만** 게이트를 태운다 — 텍스트 분석(`analyzeHairStyle`)은 이미지 쿼터를 쓰지 않아 같이 줄 세우면 괜히 느려진다.
- **이미지 모델 리전**: imagen=us-central1, gemini-3.1-flash-image(및 구 2.5)=global. 모델마다 제공 리전 다름.
- 포인트 차감 미적용(현재 무료). 관상처럼 menuAccess 'hair' 키 등록하면 차감 가능.

## 향후
- 어드민 헤어 등록 화면, 여러 헤어 동시 비교(이땐 큐), 포인트 차감
