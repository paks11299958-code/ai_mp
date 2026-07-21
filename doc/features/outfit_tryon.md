# 프로필 사진 (2026-07-21, 전통의상 체험에서 완전 교체)

내 얼굴 사진만 올리면, **6가지 컨셉**(실사 배경 3종 + 화풍 3종)에 맞춘 **상반신 프로필 사진**을 AI가 만들어준다. 헤어 합성과 같은 엔진·패턴을 복제하되, 이미지 모델은 `gemini-2.5-flash-image`(preview로 밀림)에서 정식 출시된 **`gemini-3.1-flash-image`(Nano Banana 2)**로 업그레이드.

> 이전 버전(2026-07-12~07-21): "전통의상 체험" — 나라별(한복/기모노/치파오) 왕실 의상을 입은 전신 화보. 사장 지시로 완전 교체(병행 유지 안 함). DB 테이블(`OutfitStyle`)·라우트 경로(`/api/outfit/*`)·GCS 경로(`outfit-tryon/`)는 그대로 재사용, 데이터·프롬프트만 교체.
> 같은 날 후속(1차 배포 직후): 사장이 제공한 애니메이션풍 프롬프트 참고해 화풍 컨셉 3종(지브리/픽사/한국민화) 추가 — 아래 "컨셉 확장" 참고.

## 흐름
1. 윤채린 채팅 '프로필사진' 버튼 (또는 기능 둘러보기 카드 "프로필 사진")
2. 내 얼굴 사진 업로드(정면 셀카 OK) → 성별(👸 여성/🤴 남성, **디폴트 여성**) → 컨셉 선택(6종 대표 이미지 카드, 2줄×3열)
3. "✨ 프로필 사진 만들기" → ~10초 → 상반신 프로필 사진 결과 + 📥 갤러리 저장 + 🔍 크게 보기 + 친구에게 자랑하기

## 구성

### DB — OutfitStyle (남6/여6=12건, 컬럼 재사용)
`styleKey · name · country(→컨셉명으로 재사용) · gender · emoji · imageUrl(컨셉 대표 이미지) · promptEn(→배경/화풍 프롬프트로 재사용) · order · isVisible`. 스키마 변경 없음.

**1차(실사 배경 3종)** — `replace-outfit-to-profile-concepts.cjs`(1회성)로 기존 6건(한복/기모노/치파오×남녀) 삭제 후 신규 6건 삽입:
- 실내(`indoor_male`/`indoor_female`, order 1): 카페·서재 배경
- 야외(`outdoor_male`/`outdoor_female`, order 2): 공원·거리 배경
- 판타지(`fantasy_male`/`fantasy_female`, order 3): 몽환적 판타지 배경

**2차(화풍 3종, 같은 날 후속)** — `add-profile-concepts-v2.cjs`(1회성)로 기존 6건에 이어 추가(order 4~6):
- 지브리풍(`ghibli_male`/`ghibli_female`, order 4): 손그림 수채화·몽환적 정원
- 픽사풍(`pixar_male`/`pixar_female`, order 5): 밝은 3D 애니메이션·골프장
- 한국민화풍(`minhwa_male`/`minhwa_female`, order 6): 민화+3D 하이브리드, 한지질감·전통색상·한옥

**컨셉 대표 이미지**: 국기 이미지(twemoji SVG) 대신 `gemini-3.1-flash-image`로 컨셉별 정사각 일러스트 6장을 새로 생성(`gen-profile-concept-thumbs.cjs`+`gen-profile-concept-thumbs-v2.cjs`, 1회성) → GCS `profile-photo-concepts/{key}.png`에 저장 → `OutfitStyle.imageUrl`에 반영. 프론트는 `<img src={s.imageUrl}>`로 표시(국기 매핑 코드 `FLAG_FILE`/`CountryFlag`는 완전 삭제). 카드 그리드는 `repeat(3, 1fr)` 고정이라 6개 카드가 자동으로 2줄 배치됨(코드 변경 불필요).

### 백엔드 (shared-api routes/aimp/outfit.ts, 라우트 경로 그대로 재사용)
- `GET /outfit/styles?gender=male|female` — 컨셉 목록(공개)
- `GET /outfit/status` — 합성 혼잡 신호등(헤어·나이변환과 공용 imageGenBusy)
- `GET /outfit/image?path=outfit-tryon/*` — GCS CORS 우회 중계(저장·공유 blob용, 경로 화이트리스트 그대로)
- `POST /outfit/analyze` — 인증. 합성 성공 시에만 차감(429=무과금). gender를 gemini에 전달.

### ★ 합성 = gemini-3.1-flash-image (lib/gemini.ts generateProfilePhoto, 구 generateOutfitTryOn에서 리네임)
얼굴 사진만으로 **상반신 프로필 사진을 새로 생성**(전신이 아닌 가슴~머리 구도로 프레이밍 축소). ⚠️global 리전만(getImageAI).
**프롬프트 구조 = 배경 컨셉(DB) + 공통 연출(코드):**
- 배경 컨셉 = DB `promptEn`(실내/야외/판타지 배경·분위기 묘사)
- 공통 연출(코드) = ①상반신·정중앙 구도, 카메라 정면 응시(social media profile picture 톤) ②자연스러운 어깨·미소·캐주얼한 옷차림 ③얕은 피사계심도로 배경 보케 처리(인물이 초점) ④품질 부스터 문구(masterpiece, 8K, professional color grading, cinematic lighting 등 — 사장이 공유한 프롬프트 참고 자료에서 인물사진에 유효한 부분만 발췌 반영)
- **얼굴 보존 프롬프트는 그대로 재사용**(2026-07-13 A/B 검증된 문구): "얼굴은 원본 정확 복제(눈·코·입·얼굴형·턱선·나이 유지, 성형·미화 금지)", "몸/포즈/의상/배경만 새로 생성"
- 왕실 세트·8등신·다리노출방지 등 전통의상 전용 문구는 전부 제거(프로필 사진 컨셉과 무관).
- `gender` 파라미터(디폴트 female): 여성=`an elegant woman`, 남성=`a confident man`.
- 모델 단가: `gemini-2.5-flash-image` $0.039/장 → `gemini-3.1-flash-image` $0.067/장(약 1.7배, `lib/aiUsage.ts` COST_PER_1K에 신규 항목 추가). 200pt 과금 대비 원가 영향 미미. 정식(stable) 출시 모델이라 장기 안정적(구 모델은 preview 등급으로 밀림, 관련 프리뷰 모델들은 2026-06-25 서비스 종료 예정이었음 — 실사용 확인 결과 2.5-flash-image 자체는 아직 preview로 살아있음).

### 프론트 (OutfitBoard.tsx)
헤더 "📸 프로필 사진", 선택 화면 라벨 "③ 컨셉 선택"(실사·화풍이 섞여 "배경 컨셉"이라는 표현은 부정확해 "컨셉"으로 통일), 컨셉 카드(국기 대신 이미지), 결과 화면 비율 `4/5`(전신)→`1/1`(상반신)로 변경. `App.tsx` FEATURE_ACTIONS.outfit + 보드 렌더 2곳(ErrorBoundary label "프로필 사진 화면 오류") + 윤채린 컨텍스트 분기(lookalike/hair/outfit, key는 유지) 그대로. personaFeatures 라벨 '전통의상'→'프로필사진', icon 'Globe'→'Image'. apiService outfitApi(함수명·경로 유지).

### 기능 등록 (7항목, 메뉴명만 갱신)
FEATURES_GRID id23(name/catch/desc 갱신 — "실사부터 지브리·픽사풍까지", icon 'outfit' SVG를 카메라 아이콘으로 교체) + FEATURE_SYNONYMS outfit(프로필사진·프사·실내·야외·판타지·지브리·픽사·민화 등, '전통의상'은 구검색어로 유지) + MpnFeatureIcon outfit case(카메라 아이콘) + AdminPanel 메뉴권한 표시명('전통의상 체험'→'프로필 사진'). 과금 200pt 그대로 유지(변경 요청 없었음).

## 주의·교훈 (이전 버전에서 이어지는 것)
- **얼굴만→새로 생성**: 옷·포즈·배경을 AI가 지어냄 — 프로필 사진 컨셉엔 오히려 자연스러움(전신 왕실 화보와 달리 상반신이라 체형 왜곡 이슈가 적음).
- **얼굴 보존 프롬프트는 이 기능의 핵심 자산**: 07-13 A/B 검증으로 확립된 "얼굴은 정확 복제, 몸/배경만 생성" 문구는 컨셉이 바뀌어도 그대로 재사용해야 함.
- **참고 프롬프트 자료 적용 시 주의**: 사장이 공유한 범용 프로필사진 프롬프트 예시들은 "완전히 새로운 가상 캐릭터 생성"(real person과 다르게)이 목적이라, 그 핵심 지시("Do not resemble any real person")는 우리 기능(얼굴 보존이 핵심)과 정반대라 반영하면 안 됨 — 품질 부스터 키워드·구도 지시만 선별 차용.
- **표시 전용 vs 합성**: 컨셉 카드 이미지(GCS `profile-photo-concepts/`)는 화면 표시용이고, 실제 합성은 `promptEn` 텍스트만 사용.
- **함수 무수정으로 컨셉 확장 검증됨**: 화풍 3종(지브리/픽사/민화) 추가 시 `generateProfilePhoto()` 코드는 전혀 안 건드리고 DB `promptEn` 데이터만 추가해서 완전히 다른 화풍 결과가 나오는 것을 실증(공통 얼굴보존·구도 문구 + 컨셉별 화풍 묘사의 분리 설계가 유효함을 확인). 새 컨셉 추가는 항상 이 방식(DB 데이터만)으로 충분.
- **이미지 생성 API 429(RESOURCE_EXHAUSTED) 간헐 발생**: 짧은 시간에 여러 장을 연속 생성하면 할당량 제한에 걸림 — 스크립트에서 지수 백오프 재시도(10~15초 간격)로 대응. 정식 기능(`generateProfilePhoto`)에도 이미 3회 재시도 로직이 있음(429 시 5초×attempt 대기).

## 향후
- 컨셉 추가(스튜디오, 여행지, 다른 화풍 등 — DB 데이터만으로 확장 가능), 어드민 등록기(현재 수동 raw SQL), 톤/조명 옵션 커스터마이징.
