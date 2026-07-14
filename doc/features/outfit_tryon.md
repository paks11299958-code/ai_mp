# 전통의상 체험 (2026-07-12)

내 얼굴 사진만 올리면, 세계 각국 **왕실 전통의상**을 입은 **전신 스튜디오 화보**를 AI가 만들어준다. 헤어 합성(gemini-2.5-flash-image)과 같은 엔진·패턴을 복제.

## 흐름
1. 윤채린 채팅 '전통의상' 버튼 (또는 기능 둘러보기 카드)
2. 내 얼굴 사진 업로드(정면 셀카 OK, 전신 불필요) → 성별(👸 여성/🤴 남성, **디폴트 여성**) → 나라 선택(국기 카드)
3. "✨ 입어보기" → ~10초 → 전신 화보 결과 + 📥 갤러리 저장 + 🔍 크게 보기 + 친구에게 자랑하기

## 구성

### DB — OutfitStyle (남3/여3)
`styleKey · name · country · gender · emoji · imageUrl(nullable) · promptEn · order · isVisible`. HairStyle 구조 복제(gender→성별, country 추가). raw SQL CREATE + schema.prisma 반영(generate).

**★국기 표시(2026-07-13)**: 카드에 나라 국기를 보여준다. 국기 이모지(🇰🇷)는 **Windows 크롬에서 'KR' 글자로 폴백돼 깨짐**(OS별 지역표시문자 지원 차이) → **twemoji 국기 SVG(MIT)를 `public/flags/kr·jp·cn.svg`에 저장**하고 `<img src="/flags/{code}.svg">`로 표시(외부 CDN 의존 X, 모든 OS 동일). `FLAG_FILE` 매핑(나라명→코드). 새 나라 추가 시 SVG 파일 + 매핑 한 줄. (DB emoji 컬럼은 유지하나 카드는 국기 이미지 사용)
- 남: 한복(왕)곤룡포 · 기모노(천황) · 용포(황제)
- 여: 한복(왕비)원삼 · 기모노(황후) · 봉의(황후)

### 백엔드 (shared-api routes/aimp/outfit.ts)
- `GET /outfit/styles?gender=male|female` — 목록(공개)
- `GET /outfit/status` — 합성 혼잡 신호등(헤어·나이변환과 공용 imageGenBusy)
- `GET /outfit/image?path=outfit-tryon/*` — GCS CORS 우회 중계(저장·공유 blob용, 경로 화이트리스트)
- `POST /outfit/analyze` — 인증. 합성 성공 시에만 차감(429=무과금). gender를 gemini에 전달.

### ★ 합성 = gemini-2.5-flash-image (lib/gemini.ts generateOutfitTryOn)
얼굴 사진만으로 **전신을 새로 생성**(헤어처럼 부분 교체가 아니라 전신 생성). ⚠️global 리전만(getImageAI).
**프롬프트 구조 = 나라별 의상(DB) + 공통 연출(코드):**
- 나라별 의상 = DB `promptEn` (왕실 완전세트를 나라마다 명시: 관모+상의+하의)
- 공통 연출(코드) = ①왕실 완전세트(head-to-toe, no bare head/missing lower garment) ②8등신·작은 얼굴 모델 비율(small head, 8-head-tall, long slender legs) ③은은한 대칭 비네팅 배경(★split/diagonal/abrupt boundary 금지 = 반반색 오류 방지, 완전 균일 단색은 밋밋해서 회피) ④여성=발끝까지 긴 치마로 다리 완전히 덮기(맨다리 노출 합성오류 방지)
- **★얼굴 보존 프롬프트 강화(2026-07-13, A/B 검증 후 배포)**: 전신 생성 과정에서 얼굴이 어리고 갸름한 미인형으로 변형되던 문제 → 기존 "Keep the exact same facial features and identity" 한 줄을 "얼굴은 원본 정확 복제(눈·코·입·얼굴형·턱선·나이 유지, 성형·미화 금지)"로 강화. ★헤어와 달리 **"몸·의상·배경은 새로 생성 유지"를 명시**(전신 생성 기능이라 "얼굴만 변경금지"만 넣으면 안 됨). A/B(여왕비·남왕) 원본 얼굴 보존 확연 개선 실증. 원가 영향 없음(이미지 정액과금). 헤어 동일 강화와 세트. 시간여행(age-transform)은 **의도적 미적용**(노화=얼굴 변형이 목적).
- `gender` 파라미터(디폴트 female): 여성=`as an elegant graceful woman`+다리 덮기 규칙, 남성=`as a dignified man`.
- 비용/속도 ~53원·9~10초(헤어와 동일 엔진).

### 프론트 (OutfitBoard.tsx)
HairStyleBoard 복제. 얼굴 업로드→성별 토글→나라 카드→합성→결과(저장/크게보기/자랑하기). `App.tsx` FEATURE_ACTIONS.outfit + 보드 렌더 2곳 + 윤채린 컨텍스트 분기(lookalike/hair/outfit). personaFeatures NAME_FALLBACK['윤채린']에 outfit. vercel.json `/api/outfit` 프록시. apiService outfitApi.

### 기능 등록 (7항목)
FEATURES_GRID id23(icon 'outfit' 신규 SVG) + FEATURE_SYNONYMS outfit(전통의상·한복·기모노·나라의상 등) + MpnFeatureIcon outfit case + 공지 초안 id22(isVisible:false, add-outfit-announcement.cjs). 과금 200pt(헤어 동일). 카드순서=미지정 시 최신 자동노출.

## 주의·교훈
- **얼굴만→전신 생성**: 몸·포즈·비율을 AI가 지어냄(체형이 실제와 다를 수 있으나 "전통의상 입은 내 얼굴" 재미 컨셉엔 무방). 그래서 8등신 모델 비율 조정이 가능.
- **왕실은 세트로**: 관모/왕관+상의+하의+신발을 같은 스타일로 명시 안 하면 하의가 빠지거나 관모가 안 맞음.
- **여성 복식 다리 노출**: 앞자락 예복만 강조되고 받쳐입는 치마가 생략돼 맨다리가 나오던 합성오류 → "발끝까지 긴 치마, no bare legs" 강제.
- **배경 반반색**: "gentle shadows"가 배경을 좌우로 갈리게 함 → 대칭 비네팅만 허용+split/diagonal 금지. 단 완전 균일 단색은 밋밋.
- **표시 전용 vs 합성**: 견본 이미지는 화면 표시용(합성은 promptEn 텍스트만)이라 견본 없이 이모지로도 시작 가능.
- 앞으로 나라 추가 = DB promptEn(관모+상의+하의 세트 명시)만 넣으면 공통 연출은 자동 적용.

## 향후
- 나라 확장(아오자이·사리 등), 견본 이미지, 어드민 등록기(현재 수동 raw SQL), 극단 비율/배경 톤 옵션.
