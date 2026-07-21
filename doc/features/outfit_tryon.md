# 프로필 사진 (2026-07-21, 전통의상 체험에서 완전 교체)

내 얼굴 사진만 올리면, **6가지 컨셉**(실사 1 + 지브리풍 + 픽사풍 + 한국민화풍 + 베이비 + 치비)에 맞춘 **프로필 사진**을 AI가 만들어준다. 헤어 합성과 같은 엔진·패턴을 복제하되, 이미지 모델은 `gemini-2.5-flash-image`(preview로 밀림)에서 정식 출시된 **`gemini-3.1-flash-image`(Nano Banana 2)**로 업그레이드.

> 이전 버전(2026-07-12~07-21): "전통의상 체험" — 나라별(한복/기모노/치파오) 왕실 의상을 입은 전신 화보. 사장 지시로 완전 교체(병행 유지 안 함). DB 테이블(`OutfitStyle`)·라우트 경로(`/api/outfit/*`)·GCS 경로(`outfit-tryon/`)는 그대로 재사용, 데이터·프롬프트만 교체.
> 같은 날 1차 후속: 실사 배경 3종(실내/야외/판타지) + 화풍 3종(지브리/픽사/한국민화) = 6종으로 출시.
> 같은 날 2차 후속(최종): 사장이 "실사 3종은 버리고 실사 하나만" 요청 → 실내/야외/판타지를 실사 1종으로 통합. 동시에 베이비·치비 캐릭터 컨셉 신규 추가, 민화 프롬프트 보강(단청·달항아리·북촌 한옥마을). **최종 컨셉 = 실사 1 + 지브리 + 픽사 + 민화(보강) + 베이비 + 치비 = 6종**. 카드 UI도 `HairStyleBoard` 패턴(견본사진이 카드 전체를 채움)으로 교체.
> 같은 날 3차 후속(배경 하드코딩 문제 발견 및 수정): 사장이 "지브리는 무조건 정원, 픽사는 무조건 골프장이냐"고 지적 — 실제로 DB `promptEn`에 배경(정원/골프장 등)이 화풍과 분리되지 않고 그대로 박혀있었음을 확인. "원본 사진과 어울리게 랜덤하게 하고 싶다"는 요청에 따라 **6개 컨셉 전부의 `promptEn`에 배경-재해석 공통 문구(BG_HINT)를 추가** — 화풍/스타일은 유지하되 배경은 원본 사진 맥락에 맞춰 자연스럽게 재해석하도록 수정. 도서관 배경 vs 해변 배경 테스트 얼굴로 검증 완료(같은 지브리 컨셉이어도 원본 배경에 따라 결과 배경이 다르게 나옴).
> 같은 날 4차 후속(견본사진 남녀 분리): 카드 견본사진을 성별 공용 1장→**남녀 각각(총 12장)**으로 분리, 참고 얼굴은 여성=윤채린 페르소나·남성=강지훈 페르소나 사용, 이미지 사이즈는 `imageConfig.aspectRatio:'1:1'`로 통일.

## 흐름
1. 윤채린 채팅 '프로필사진' 버튼 (또는 기능 둘러보기 카드 "프로필 사진")
2. 내 얼굴 사진 업로드(정면 셀카 OK) → 성별(👸 여성/🤴 남성, **디폴트 여성**) → 컨셉 선택(6종 견본사진 카드, 2줄×3열, 성별에 맞는 견본사진 표시)
3. "✨ 프로필 사진 만들기" → ~10초 → 프로필 사진 결과(실사/지브리/픽사/민화=상반신, 베이비/치비=전신) + 📥 갤러리 저장 + 🔍 크게 보기 + 친구에게 자랑하기

## 구성

### DB — OutfitStyle (남6/여6=12건)
`styleKey · name · country(→컨셉명으로 재사용) · gender · emoji · imageUrl(컨셉 견본사진, 남녀 각각 별도 파일) · promptEn(→배경/화풍 프롬프트로 재사용) · order · isVisible · framing · styleMode`.

**framing**: `upperbody`(기본, 가슴~머리 구도) | `fullbody`(베이비·치비 전용, 전신)
**styleMode**: `realistic`(기본, 얼굴 정확 보존) | `stylized`(베이비·치비 전용, 닮은꼴·캐릭터화 우선)

**최종 컨셉 6종** (order 순):
- 실사(`realistic_male`/`realistic_female`, order 1): 부드러운 스튜디오 톤, 자연광
- 지브리풍(`ghibli_male`/`ghibli_female`, order 2): 손그림 수채화, 파스텔톤 동화 분위기
- 픽사풍(`pixar_male`/`pixar_female`, order 3): 밝은 3D 애니메이션, 큰 눈, 부드러운 렌더링
- 한국민화풍(`minhwa_male`/`minhwa_female`, order 4): 민화+3D 하이브리드, 한지질감·단청·달항아리·북촌 한옥마을·매화
- 베이비(`baby_male`/`baby_female`, order 5, **fullbody+stylized**): 아기 버전 캐릭터, 통통한 볼, 반짝이는 큰 눈
- 치비(`chibi_male`/`chibi_female`, order 6, **fullbody+stylized**): SD 치비 캐릭터, 2등신 비율, 게임 캐릭터풍

**모든 컨셉 `promptEn`에 배경-재해석 공통 문구(BG_HINT) 포함**: "Reinterpret the background/setting from the original photo naturally in this style (do not force a specific unrelated location) — if the original background is unclear or plain, use a softly blurred, tasteful setting that fits the style." → 화풍/스타일은 컨셉별로 고정하되, 배경 자체는 하드코딩하지 않고 사용자가 올린 원본 사진의 배경 맥락을 따라가도록 함.

**견본사진(카드 이미지)**: 실제 서비스와 동일한 `generateProfilePhoto()` 로직으로, 여성=윤채린·남성=강지훈 페르소나 얼굴을 참고해 6개 컨셉 각각 합성 → GCS `profile-photo-concepts/{styleKey}.png`(남녀 각각 별도 파일, 총 12장)로 저장 → `OutfitStyle.imageUrl`에 반영. 정사각형 통일(`imageConfig.aspectRatio:'1:1'`). 스크립트: `gen-profile-samples-v4.cjs`(1회성).

**DB 정리 이력**(1회성 스크립트, 순서대로 실행됨):
- `replace-outfit-to-profile-concepts.cjs`: 한복/기모노/치파오 6건 삭제 → 실내/야외/판타지 6건 삽입(1차)
- `add-profile-concepts-v2.cjs`: 지브리/픽사/민화 6건 추가(1차 후속)
- `reorganize-profile-concepts-v3.cjs`: 실내/야외/판타지 6건 삭제 → 실사 1종(2건) 신규, 민화 프롬프트 보강, 베이비·치비 신규(각 2건), `framing`/`styleMode` 컬럼 사용(최종 재구성)
- `gen-profile-samples-v4.cjs`: 남녀 각각 견본사진 12장 재생성 + `imageUrl` DB 갱신(견본사진 남녀 분리)

### 백엔드 (shared-api routes/aimp/outfit.ts, 라우트 경로 그대로 재사용)
- `GET /outfit/styles?gender=male|female` — 컨셉 목록(공개)
- `GET /outfit/status` — 합성 혼잡 신호등(헤어·나이변환과 공용 imageGenBusy)
- `GET /outfit/image?path=outfit-tryon/*` — GCS CORS 우회 중계(저장·공유 blob용, 경로 화이트리스트 그대로)
- `POST /outfit/analyze` — 인증. DB에서 `framing`/`styleMode`도 함께 select해 `generateProfilePhoto()`에 전달. 합성 성공 시에만 차감(429=무과금).

### ★ 합성 = gemini-3.1-flash-image (lib/gemini.ts generateProfilePhoto, 구 generateOutfitTryOn에서 리네임)
얼굴 사진만으로 **프로필 사진을 새로 생성**. ⚠️global 리전만(getImageAI).

**함수 시그니처**: `generateProfilePhoto(imageBase64, mimeType, conceptEn, gender, framing, styleMode)`

**프롬프트 구조 = 컨셉(DB promptEn) + 공통 연출(코드) + 프레이밍/얼굴보존 분기(코드)**:
- 컨셉 = DB `promptEn`(화풍·분위기 묘사 + 배경-재해석 BG_HINT 공통 문구)
- **framingRule**: `upperbody`(기본) = 가슴~머리 정중앙 구도, 카메라 정면 응시 / `fullbody`(베이비·치비) = 전신 정중앙 구도
- **faceRule**: `realistic`(기본, 실사/지브리/픽사/민화) = "얼굴은 원본 정확 복제(눈·코·입·얼굴형·턱선·나이 유지, 성형·미화 금지)" 엄격 문구(2026-07-13 A/B 검증) / `stylized`(베이비·치비 전용) = "눈매·헤어스타일·분위기로 알아볼 수 있는 닮은꼴 수준, 비율·형태는 캐릭터화를 위해 과감히 과장·재해석 허용" — 아기 비율·2등신 자체가 원본 얼굴형과 다를 수밖에 없어 별도 완화 문구 필요
- 공통 연출(코드) = 자연스러운 어깨·미소·캐주얼한 옷차림, 얕은 피사계심도로 배경 보케 처리, 품질 부스터 문구(masterpiece, 8K, professional color grading, cinematic lighting 등)
- `gender` 파라미터(디폴트 female): 여성=`an elegant woman`, 남성=`a confident man`.
- 모델 단가: `gemini-2.5-flash-image` $0.039/장 → `gemini-3.1-flash-image` $0.067/장(약 1.7배, `lib/aiUsage.ts` COST_PER_1K에 신규 항목 추가). 200pt 과금 대비 원가 영향 미미. 정식(stable) 출시 모델이라 장기 안정적.

### DB 스키마 변경 (2026-07-21)
`OutfitStyle`에 `framing String @default("upperbody")`, `styleMode String @default("realistic")` 컬럼 추가. 베이비·치비만 `fullbody`/`stylized`, 나머지 4종은 기본값 유지. `npx prisma generate` 반영 완료.

### 프론트 (OutfitBoard.tsx)
헤더 "📸 프로필 사진", 선택 화면 라벨 "③ 컨셉 선택"(실사·화풍이 섞여 "배경 컨셉"이라는 표현은 부정확해 "컨셉"으로 통일). **컨셉 카드를 `HairStyleBoard` 패턴으로 교체** — `padding:0`, 견본사진이 카드 전체를 채움(`width:100%, aspectRatio:1, objectFit:cover`), 선택 시 강조 테두리·그림자. `App.tsx` FEATURE_ACTIONS.outfit + 보드 렌더 2곳(ErrorBoundary label "프로필 사진 화면 오류") + 윤채린 컨텍스트 분기(lookalike/hair/outfit, key는 유지) 그대로. personaFeatures 라벨 '전통의상'→'프로필사진', icon 'Globe'→'Image'. apiService outfitApi(함수명·경로 유지).

### 기능 등록
FEATURES_GRID id23(catch: "실사부터 지브리·베이비까지, 나만의 프사 📸", desc: 실사/지브리/픽사/민화풍/베이비/치비 캐릭터까지 갱신) + FEATURE_SYNONYMS outfit(프로필사진·프사·실사·지브리·픽사·민화·베이비·치비·아기·애니메이션·캐릭터 등, 실내/야외/판타지 검색어는 제거, '전통의상'은 구검색어로 유지) + MpnFeatureIcon outfit case(카메라 아이콘) + AdminPanel 메뉴권한 표시명('전통의상 체험'→'프로필 사진'). 과금 200pt 그대로 유지.

## 주의·교훈 (이전 버전에서 이어지는 것)
- **얼굴만→새로 생성**: 옷·포즈·배경을 AI가 지어냄.
- **얼굴 보존 프롬프트는 이 기능의 핵심 자산**: 07-13 A/B 검증으로 확립된 "얼굴은 정확 복제, 몸/배경만 생성" 문구는 `realistic` 모드(실사/지브리/픽사/민화)에서 그대로 재사용. `stylized` 모드(베이비/치비)는 캐릭터화가 목적이라 이 문구를 그대로 쓰면 모순되므로 별도 완화 문구를 만들어야 했음 — 컨셉별로 "정확 보존"과 "캐릭터화"가 상충할 수 있다는 걸 이번에 처음 겪음.
- **배경을 화풍과 분리하지 않고 참고 자료를 통째로 가져다 쓰면 안 됨(중요)**: 사장이 준 지브리/픽사 참고 프롬프트에는 "dreamy garden"(지브리), "a beautiful golf course"(픽사)처럼 예시 배경이 포함돼 있었는데, 이를 그대로 DB `promptEn`에 반영해버려서 **모든 사용자가 같은 배경**으로 나오는 문제가 발생(사장이 직접 지적). 프롬프트 설계 시 반드시 "화풍/스타일" 지시와 "배경/장소" 지시를 분리하고, 배경은 원본 사진 맥락에 맞춰 재해석하도록(BG_HINT) 별도 처리해야 함. 참고 자료의 예시 배경은 어디까지나 예시일 뿐 그대로 하드코딩하면 안 됨.
- **참고 프롬프트 자료 적용 시 추가 주의**: 사장이 공유한 범용 프로필사진 프롬프트 예시들은 "완전히 새로운 가상 캐릭터 생성"(real person과 다르게)이 목적이라, 그 핵심 지시("Do not resemble any real person")는 우리 기능(얼굴 보존이 핵심)과 정반대라 반영하면 안 됨 — 품질 부스터 키워드·구도 지시만 선별 차용.
- **표시 전용 vs 합성**: 컨셉 카드 이미지(GCS `profile-photo-concepts/`)는 화면 표시용이고, 실제 합성은 `promptEn` 텍스트만 사용. 견본사진은 실제 서비스 프롬프트가 바뀌면 함께 재생성해야 화면과 결과물의 괴리가 안 생김(이번에 배경-재해석 방식 도입 후 견본사진도 재생성한 이유).
- **함수 무수정으로 컨셉 확장 검증됨**: 화풍 3종(지브리/픽사/민화) 추가, 민화 프롬프트 보강 모두 `generateProfilePhoto()` 코드 무수정, DB `promptEn` 데이터만으로 처리 가능했음. 단, 베이비/치비처럼 "얼굴 비율 자체가 바뀌는" 컨셉은 예외 — `framing`/`styleMode` 컬럼과 함수 파라미터 확장이 필요했던 유일한 케이스.
- **이미지 생성 API 429(RESOURCE_EXHAUSTED) 간헐 발생**: 짧은 시간에 여러 장을 연속 생성하면 할당량 제한에 걸림 — 스크립트에서 지수 백오프 재시도(10~15초 간격)로 대응. 정식 기능(`generateProfilePhoto`)에도 이미 3회 재시도 로직이 있음(429 시 5초×attempt 대기).

## 향후
- 컨셉 추가(다른 화풍, 시대극 등 — DB 데이터만으로 확장 가능, 단 인물 비율이 바뀌는 컨셉이면 framing/styleMode 지정 필요), 어드민 등록기(현재 수동 raw SQL), 톤/조명 옵션 커스터마이징.
