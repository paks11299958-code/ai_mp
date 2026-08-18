# 🎨 리버스 프롬프트 (reverse-prompt)

이미지 1장을 올리면 **Midjourney 프롬프트와 Stable Diffusion 프롬프트(positive/negative)를
한 번의 AI 호출로 동시에** 뽑아주는 기능. 화풍·구도·조명·색·분위기까지 분석해 그대로 따라
만들 수 있게 한다. 2026-08-14~18 개발(묶음 A~E), **2026-08-18 운영 배포 + 진입점 오픈**.

★이름 주의: 전자책의 **'그림 프롬프트 뽑기'**(`ebook_image_prompt`)는 **글 → 그림 프롬프트**로
방향이 반대다. 그래서 이 기능의 표시 라벨은 **"이미지 → 프롬프트"**로 붙였다.

## 진입 경로

- 메인 **기능 둘러보기** 탭 → 카드 **이미지 → 프롬프트**(이아린) 클릭
- 직접 주소 `/reverse-prompt` (보관함 `/reverse-prompt/library`)
- ★라우팅은 React Router가 아니라 `App.tsx` 하단의 `window.location.pathname` 수동 매칭
  얼리리턴이다(`IS_RP_INDEX` / `IS_RP_LIBRARY`). `vercel.json` rewrite를 **catch-all보다 앞에**
  둬야 한다(누락 시 화면·API가 조용히 404).

## 화면 2개 (`frontend/components/reverse-prompt/`)

| 파일 | 역할 |
|---|---|
| `ReversePromptMain.tsx` | S1 — 업로드·결과·복사·잔여 횟수 |
| `ReversePromptLibrary.tsx` | S2 — 보관함(목록·상세·삭제). **로그인 전용** |
| `api.ts` / `parts.tsx` | API 래퍼 / 공용 조각 |

★보관함은 비로그인이면 `/reverse-prompt`로 **리다이렉트**한다(모달을 띄우지 않는다).
보관함은 로그인 후에만 의미가 있고, 로그인 요구 시점은 3회차 업로드이기 때문.

## 백엔드 (`shared-api`)

- 라우터 `routes/aimp/reverse-prompt.ts` — `GET /quota`, `POST /analyze`,
  `GET /items`, `GET /items/:id`, `DELETE /items/:id`
- 로직 `lib/reverse-prompt/` — `constants.ts`(모델·단가·한도) / `image.ts`(전처리)
  / `vlm.ts`(Vertex 호출) / `prompts.ts` / `store.ts`(캐시·한도·로그·보관)
- 기존 파일 변경은 **`routes/aimp/index.ts`에 라우터 등록 1줄**뿐

## DB — 신규 테이블 4개 (기존 테이블 변경 없음)

| 테이블 | 용도 |
|---|---|
| `RpItem` | 보관 항목(로그인 전용). `userId` FK CASCADE |
| `RpAnalysisCache` | **해시 기반 분석 캐시** — PK가 SHA-256 자체. 비용 통제의 핵심 |
| `RpGuestUsage` | 비로그인 일일 사용량. `(visitorKey, usedDate)` UNIQUE |
| `RpAiUsageLog` | AI 호출 **전건** 기록(실패·캐시히트 포함) |

인덱스 7개. JSON은 jsonb가 아니라 **TEXT에 stringify**(기존 71개 모델 중 Json 타입 0곳),
`costUsd`는 Decimal이 아니라 **DOUBLE PRECISION**(`LcAiUsageLog` 선례)를 따랐다.

### ★`RpAiUsageLog.environment` — 개발/운영 원가 분리

개발용 서비스 계정을 따로 발급하지 않고 운영 키를 그대로 쓰기로 해서, 청구는 한 프로젝트에
모이지만 집계는 이 컬럼으로 갈라낸다. 원가 조회 시 **`environment = 'production'` 조건을
빠뜨리면 개발 검증 호출이 운영 원가에 섞인다.**

★판정에 `NODE_ENV`를 단독으로 쓰지 않는다 — `.env`에 `NODE_ENV=production`이 하드코딩돼
있어 **서버2(개발)에서도 production으로 읽힌다.** 전용 변수 `RP_ENVIRONMENT`를 먼저 보고
없을 때만 폴백한다(`resolveEnvironment()`).

## AI 모델 — `gemini-3.5-flash-lite` (Vertex)

★**`location: 'global'` 필수.** us-central1·us-east5·europe-west4·asia-northeast3/1
**전 리전에서 404**다(2026-08-14 실측). 기존 `getGeminiClient()`는 `us-central1`
하드코딩이라 쓸 수 없어 이 기능만 별도 Vertex 클라이언트를 쓴다.

**실측 원가(운영, 2026-08-18)**: 입력 1,644 / 출력 308 토큰 = **$0.0012632 / 건**
※입력 토큰은 이미지 크기와 **무관**하다(256px~3000px 전부 ~1,090토큰). 리사이즈의 근거는
원가가 아니라 페이로드 축소(413 회피)·전송 지연·EXIF 제거다.

## 비용 통제

- **캐시 우선**: 같은 이미지 재요청은 AI를 부르지 않고 **한도도 차감하지 않는다**
  (실측 3.58초 → **0.056초**, 64배)
- **MJ·SD를 한 번의 응답에서 동시에** 받는다(두 번 호출 금지)
- 1024px 리사이즈 후 전송
- 한도: 비로그인 **2회/일**, 로그인 **20회/일** (`RP_GUEST_DAILY_LIMIT` / `RP_USER_DAILY_LIMIT`)
- **포인트 차감 없음** — 그래서 `frontend/lib/featureLabels.ts`에는 등록하지 않는다
  (그 파일은 포인트 차감 기능 전용)

## 개인정보

- 원본 이미지를 **디스크·DB 어디에도 저장하지 않는다**(실측 확인: 디스크 이미지 0건,
  `analysisJson`은 1,139바이트 JSON뿐)
- **EXIF 제거**: `sharp`에서 `.rotate()`로 Orientation을 픽셀에 반영한 뒤
  `.withMetadata()`를 **부르지 않는 것 자체가 제거**다(GPS 포함).
  실측 — 원본 234바이트 EXIF → 처리 후 완전 소멸
- `visitorKey`는 IP 해시 + 브라우저 지문 조합. **원본 IP를 저장하지 않는다**

## 업로드 방식 — multer 아님

multer가 설치돼 있지 않다. 이미지는 `multipart/form-data`가 아니라 **JSON body의 base64**로
받는다(`{ imageBase64, mimeType }`, `routes/aimp/outfit.ts` 선례).
용량 상한은 `express.json({limit:'10mb'})`가 `app.ts`에 전역으로 걸려 있고 그 파일은 수정
금지 대상이라, **핸들러 진입 직후 base64 문자열 길이로 검사**한다(디코딩 전).
★Vercel 프록시가 10MB에서 순수 413을 던지므로 실질 상한은 그보다 낮게 잡는다(**5MB**).

## 진입점 등록 — 5곳

| 위치 | 내용 |
|---|---|
| `MainPageNew.tsx` `FEATURES_GRID` | **메인 카드**(id 29 / XXIX / create / 이아린) |
| `MainPageNew.tsx` `FEATURE_SYNONYMS` | 검색 동의어 17개(미드저니·역추출·화풍 등) |
| `personaFeatures.ts` | `FeatureKey` + `FEATURE_REGISTRY` + `NAME_FALLBACK` |
| `App.tsx` `featureBoardOpeners` | 클릭 → `/reverse-prompt` 이동 |
| `services/referral.ts` | 공유 라벨 |
| DB `Persona.features` (이아린) | ★아래 참조 |

★**코드만 고치면 카드가 안 뜬다.** `getPersonaFeatureKeys()`는 DB `Persona.features`가
채워져 있으면 그것만 신뢰하고 `NAME_FALLBACK`을 아예 타지 않는다. 이아린은 features가
있으므로 운영 DB UPDATE가 함께 필요했다.
※반대로 **DB를 먼저 바꿔도 안전하다** — `k in FEATURE_BY_KEY` 필터가 미등록 키를 걸러내
프론트 배포 전까지 안 뜰 뿐이다. 그래서 **DB → 코드** 순서가 사고가 없다.

## ★개발 중 드러난 함정

1. **모델 은퇴일은 원문 표를 직접 열 것.** "2.5 계열 2026-10-16 종료"가 집계 사이트에 널리
   퍼져 있었으나 공식 표에는 셋 다 "No shutdown date announced"였다. 진짜 근거(3.1의
   2027-05-07 종료 + 대체 모델 3.5-flash-lite 명시)도 원문 표 안에 있었다.
2. **종료일이 없어도 모델은 끊긴다.** 2026-07-09 `gemini-2.5-flash`가 공표 없이 404를
   반환해 프로덕션이 중단됐다 → **모델명은 상수 1곳**에만 둔다.
3. **KST 날짜 함수 혼용 금지.** `kstToday()`(DATE 컬럼용)와 `kstDayStartUtc()`(TIMESTAMP
   비교용)를 섞으면 9시간 어긋나 **KST 00~09시가 집계에서 누락**된다. 실제로 로그인
   사용자가 한도를 초과해 쓸 수 있는 버그가 있었다.
4. **`.env`를 `source` 하지 말 것.** 서비스 계정 JSON의 따옴표가 bash에서 벗겨져 깨지고,
   한 번 깨진 값이 셸에 남으면 dotenv가 덮어쓰지 않아 재기동해도 계속 깨진 값을 문다.
5. **메인 카드는 `FEATURES_GRID`다.** 진입점 4곳을 채우고도 카드가 안 떴다 —
   `personaFeatures.ts`의 `FEATURE_REGISTRY`는 **페르소나 채팅 안**의 버튼이고, 메인 화면
   카드는 `MainPageNew.tsx`의 `FEATURES_GRID`에서 렌더된다. `npm run check`·tsc·빌드가
   **전부 통과**하고 조용히 안 뜬다 → **운영 실렌더 확인이 완료 조건**이다.

## 배포 (2026-08-18)

| 단계 | 내용 |
|---|---|
| E-2a·b | 운영 DDL 적용 — 단일 트랜잭션, NOTICE 0건, 테이블 97→101 |
| E-2c | shared-api `main` 머지 `69fc854` — 실제 중단 **42초**, pm2 `↺` +1 |
| E-2d | ai_mp `master` 머지 — 프론트 코드는 이미 master에 있었음 |
| E-2e | 운영 왕복 전건 통과 → 진입점 오픈(`1026769`) |

★서버1 호스트에 **psql이 없다.** PostgreSQL은 Docker 컨테이너 `n8n-docker-db-1`이므로
`docker exec -i ... psql`로 접속한다(자세한 명령은 `app/reverse-prompt/DEPLOY_PLAN.md` 0-2절).

관련 문서: `app/reverse-prompt/PRD.md` · `PROGRESS.md` · `DEPLOY_PLAN.md`
