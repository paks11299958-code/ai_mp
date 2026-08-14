# 진행 상황 — 리버스 프롬프트 (app/reverse-prompt)

**현재 묶음**: A 완료 / B 미착수
**브랜치**: `feature/reverse-prompt` (ai_mp, shared-api 양쪽)
**최종 갱신**: 2026-08-14

---

## 완료

- [x] 1. 0장 조사 10개 항목 — 결과는 아래 "조사 결과" 표. **PRD 전제와 다른 항목 6건 발견**(별도 절)
- [x] 2. 데이터 모델 확정 — 실제 명명 규칙(PascalCase + camelCase, `@@map` 없음)과
      사용자 PK 타입(`User.id` = **Int autoincrement**)에 맞춰 `Rp*` 4개 확정
      파일: `shared-api/prisma/schema.prisma` (1152→1216줄), `User` 모델에 역관계 2줄 추가
- [x] 3. 마이그레이션 파일 작성(**실행 안 함**) — 파일: `shared-api/prisma/reverse-prompt-ddl.sql`
      검증: `npx prisma validate` 통과 / 실행문 10개(TABLE 4 + INDEX 6) /
      괄호 균형 OK / **ALTER·DROP·TRUNCATE 0건**(CLAUDE.md 기존테이블 보호 규칙 준수) /
      `prisma migrate diff` 생성본과 인덱스 이름·구성 일치 확인
- [x] 4. VLM 후보 3종 단가·토큰 산식 정리 — 아래 "VLM 후보" 절. **사용자 확정 대기**

---

## 조사 결과 (PRD 0장 10개 항목)

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 버전 | Express 4.19.2 / Prisma 7.8.0 / Node 24.14.1 / TS 6.0.3 | `shared-api/package.json` |
| 2 | 인증 | **JWT**. `requireAuth(req,res)` → `number \| null` 반환. 쿠키 `token` 또는 `Bearer`. 일반 7d/어드민 24h | `shared-api/lib/auth.ts:52-60` |
| 3 | 사용자 테이블 | `User`, PK `id` **Int @default(autoincrement())** — uuid/cuid 아님 | `shared-api/prisma/schema.prisma:12` |
| 4 | 스키마 정본 | **`shared-api/prisma/schema.prisma`** (아래 "정본 판단" 절) | 4벌 존재 |
| 5 | 명명 규칙 | PascalCase 모델 + camelCase 컬럼, `@@map` **미사용**(71개 중 3개만 예외) | `grep -c "@@map"` = 3 |
| 6 | 디자인 | 사이트 베이지 톤(`#F5EFE6`/`#2D2438`). 라우팅은 React Router 아님 — `App.tsx` 하단 `window.location.pathname` 수동 매칭 얼리리턴 | `frontend/index.css`, `App.tsx` |
| 7 | 파일 업로드 | **multer 없음.** JSON body에 base64(`imageBase64`+`mimeType`), `express.json({limit:'10mb'})` | `shared-api/app.ts:30`, `routes/aimp/outfit.ts:57` |
| 8 | 기존 AI 호출 | HTTP API. `getGeminiClient()` / `gemini-2.5-flash` 주류(23곳). 모델명은 상수 1곳 통일 관례 | `lib/learning/curriculum.ts:20,28` |
| 9 | 배포 | 프론트=Vercel 자동배포(master 푸시). 백엔드=서버1 pm2 `shared-api`(ts-node 직접 실행) | `ecosystem.config.cjs` |
| 10 | Rate limit | **있음.** `express-rate-limit` 8.5.2, `authLimiter`(15분 20회)를 auth 3개 경로에 적용. `trust proxy = 1` | `shared-api/app.ts:34-44` |

### 정본 판단 — `shared-api/prisma/schema.prisma`

스키마가 **4벌**이다(저장소 2개 × 원본/generated). 정본 근거:

| 후보 | 줄수 | Lc* 11개 | 최종 수정 | 판정 |
|---|---|---|---|---|
| `shared-api/prisma/schema.prisma` | 1152 | **11개 있음** | 2026-08-11 | ★**정본** |
| `ai_mp/prisma/schema.prisma` | 514 | 0개 | 2026-06-17 | 사본(정지) |
| `*/generated/prisma/schema.prisma` | — | — | — | 빌드 산출물 |

결정적 근거: 오늘(08-14) `scripts/check-learning-schema-sync.ts`를 돌린 결과
**운영 DB와 shared-api 스키마가 11개 모델 중 10개 완전 일치**(1건은 무해한 Int/smallint).
ai_mp 쪽은 Lc*가 하나도 없어 운영 DB를 반영하지 못한다. `generated/`는 `output = "../generated/prisma"`
설정으로 생성되는 산출물이라 손대지 않는다.

---

## ★PRD 전제와 다른 부분 (조용히 맞추지 않고 지적)

| # | PRD 전제 | 실제 | 대응 |
|---|---|---|---|
| 1 | 8장 `analysis **Json**` | 이 스키마는 **Json 타입 사용처가 0곳**. 전부 `String`에 stringify(`choicesJson`, `analysisJson` 선례) | `analysisJson String`으로 **정정** |
| 2 | 8장 `costUsd **Decimal**` | `LcAiUsageLog.costUsd`가 **Float**. Decimal 사용처 0곳 | `Float`로 **정정** |
| 3 | 7장 "10MB 초과 거부" | ★**도달 불가.** Vercel 프록시가 10MB에서 순수 413(플랫폼 제약, 실측). base64는 +33% 팽창하므로 원본 상한은 **약 7MB**가 실질 한계 | 묶음 B에서 상한 재설정 필요 — **사용자 확인 필요** |
| 4 | 10장 "이미지 처리: sharp" | sharp는 **ai_mp에만** 있고 shared-api에는 없음 | 묶음 B에서 shared-api에 추가 필요 |
| 5 | CLAUDE.md "저장소 루트 PROGRESS.md" | 루트에 이미 **학습코칭 전용 1243줄** PROGRESS.md 존재. 덮으면 기존 이력 소실 | `app/reverse-prompt/`에 배치(학습코칭 `app/learning/` 선례와 동일) |
| 6 | CLAUDE.md "`src/reverse-prompt/`" | 이 저장소에 `src/` 자체가 없음. 백엔드=`shared-api/routes/aimp/`, 프론트=`frontend/components/` | 기존 구조를 따름 — **사용자 확인 필요** |

추가로, CLAUDE.md는 단일 저장소를 전제하지만 실제로는 **ai_mp(프론트) + shared-api(백엔드)** 두 저장소다.
브랜치도 양쪽에 각각 만들었다.

---

## ★VLM 확정 — `gemini-3.5-flash-lite` (2026-08-14)

아래 "VLM 후보" 절은 **묶음 A 시점의 초안이며 산식이 틀렸다.** 실측으로 정정한 내용:

- **입력 토큰은 이미지 크기와 무관하다.** `countTokens` 실측: 256px·384px·1024×576·
  1024×1024·2048px·3000×2000이 **전부 ~1,090토큰**. 초안의 "768px 타일당 258토큰,
  1024px=4타일=1,032" 산식은 2.5-flash 문서 기준이라 이 모델에 적용되지 않는다.
  → PRD 11장 4항 "1024px 리사이즈가 원가를 좌우한다"는 **이 모델에 성립하지 않는다.**
    리사이즈는 유지하되 근거는 페이로드 축소(413 회피)·전송 지연·EXIF 제거다.
- **실측 왕복 성공**(64px 테스트 이미지, `responseMimeType: application/json`):
  입력 1,102 / 출력 6 / 총 1,108 토큰, `{"color":"brown"}` 정상 수신.
- **원가**: 1건 약 **$0.0022** (입력 ~1,490 + 출력 ~700 가정). 출력은 묶음 B에서 실측.
- **선정 이유**: 공식 지원 중단 표에서 `gemini-3.1-flash-lite`(2027-05-07 종료)의
  **권장 대체 모델이 `gemini-3.5-flash-lite`로 명시**돼 있다. 3.5-flash-lite는
  2026-07-21 GA이고 종료일이 없다. 상세는 PRD 6.1 참조.

### ★출처 검증에서 나온 교훈 (2026-08-14, 양쪽 다 한 번씩 틀림)

1. **내 오류**: "3.5-flash-lite가 2027-05-07 은퇴"라고 보고 → 그건 **3.1의 종료일**이었다.
   WebFetch 요약이 두 행을 섞은 것을 걸러내지 못했다.
2. **2차 출처 오류**: "2.5 계열 2026-10-16 은퇴"가 집계 사이트·블로그에 널리 퍼져 있고
   공식 문서라고 제시됐으나, **원문 표에는 셋 다 "No shutdown date announced"**였다.
   → PRD에서 해당 문구를 제거했다.
3. 결론은 바뀌지 않았지만 **근거가 추정에서 공식 표 한 줄로 교체**됐다.
   → CLAUDE.md 기술규칙에 "원문 표를 직접 열어 확인, 2차 출처 불신" 함정으로 남겼다.

---

## VLM 후보 (묶음 A 초안 — ★산식 오류, 위 절로 대체됨)

1024px 이미지 1장 + 프롬프트를 넣고 6.1 JSON을 받는 1회 호출 기준.

**입력 토큰 산식** — Gemini는 384px 이하면 258토큰 고정, 초과하면 768px 타일당 258토큰.
1024×1024는 `floor(1024/1.5)=682` → 각 변 2타일 → **4타일 × 258 = 1,032토큰**.
여기에 시스템+지시 프롬프트를 약 400토큰으로 잡아 **입력 ≈ 1,450토큰**.
출력은 6.1 스키마(9필드 + MJ/SD 프롬프트 2벌)라 **약 700토큰**으로 잡는다.

| 후보 | 입력 $/1M | 출력 $/1M | 1024px 입력 토큰 | 1건 원가(산식) |
|---|---|---|---|---|
| ★**gemini-2.5-flash** (현 사이트 주류) | $0.30 | $2.50 | 1,032(이미지) + ~400 | (1450×0.30 + 700×2.50)/1e6 = **$0.00219** |
| **gemini-2.5-flash-lite** (최저가) | $0.10 | $0.40 | 동일 | (1450×0.10 + 700×0.40)/1e6 = **$0.00043** |
| **claude-haiku-4-5** (비교군) | $1.00 | $5.00 | 산식 다름(별도 실측 필요) | 대략 (1450×1.00 + 700×5.00)/1e6 = **$0.00495** |

**추천: `gemini-2.5-flash`.**
- 사이트 전역이 이미 Gemini 주류(23곳)라 정책·키 관리가 일치한다
- 학습코칭에서 Claude→Gemini 전환 시 **A/B 실측으로 규칙 준수 동등, 원가 1/5** 확인된 전례가 있다
- flash-lite가 5배 싸지만, MJ/SD 프롬프트는 **형식 일관성이 제품의 본체**(PRD 1.2)라
  스키마 준수가 흔들리면 재시도 비용이 절감분을 먹는다. 묶음 B에서 두 모델 A/B 후 확정 권장

**월 원가 상한(PRD 11장)** — 위는 산식값이며 **실측이 아니다.** 캐시 적중률과 실제 토큰을
묶음 E에서 측정해 확정한다. 참고로 gemini-2.5-flash 기준 월 1만 건이면 약 $21.9.

★**`maxOutputTokens`를 넘기지 말 것** — Gemini 2.5 Flash는 사고 토큰을 이 한도에 함께
계산해 JSON이 잘린다(학습코칭 2026-08-13 실측). 스키마가 응답 크기를 제한하므로 한도 없이 쓴다.

---

## 묶음 B — 진행 중

### 완료 (AI 호출 불필요한 부분)

- [x] **sharp 추가** — `shared-api` 0.35.3 (libvips 8.18.3). ai_mp에만 있던 것을 백엔드에도
- [x] **`lib/reverse-prompt/constants.ts`** — 모델명·단가표·상한·한도 한 곳 집중
- [x] **`lib/reverse-prompt/prompts.ts`** — 시스템/사용자 프롬프트 + PRD 6.1 responseSchema
- [x] **`lib/reverse-prompt/image.ts`** — 전처리 전 구간
- [x] **`lib/reverse-prompt/vlm.ts`** — 1장당 1회 호출 + 스키마 검증 + 재시도 2회 (★미검증)
- [x] **단위 테스트 16개 통과** — `lib/reverse-prompt/__tests__/image.test.ts`

**실측 검증된 것**

| 항목 | 결과 |
|---|---|
| EXIF 제거 | 원본 `exif` 존재 → 결과물 `exif` 없음 ✅ |
| 리사이즈 | 3000×2000 → **1024×683**(비율 유지), 35KB → 4.4KB |
| 확대 방지 | 400×300 입력 → 400×300 유지 ✅ |
| 해시 일관성 | 같은 입력 2회 → 동일 SHA-256, 다른 이미지 → 다른 해시 ✅ |
| 썸네일 | 128px 이내, 340 bytes |
| 형식 | png·webp 허용 / **gif 거부** / **mimeType 위조 거부**(실제 바이트 판별) |
| 5MB 상한 | 초과 차단 ✅, **디코딩 전 판정**(20MB 문자열 50ms 이내) |
| 회귀 | 전체 유닛 **51개 통과**(학습코칭 포함), `tsc --noEmit` 0 오류 |

**설계 판단**
- 상한은 **핸들러에서 base64 길이로** 검사. 미들웨어 불가(전역 `express.json`은 수정 금지 대상,
  라우트별 파서를 덧대도 이미 파싱된 뒤)
- 해시는 **리사이즈본 기준.** 원본 기준이면 같은 사진을 다른 품질·포맷으로 올릴 때 캐시가 빗나간다
- `rotate()`를 `resize` 앞에 둔다 — EXIF Orientation을 픽셀에 반영한 뒤 메타를 버려야
  세로 사진이 눕지 않는다
- 선언된 `mimeType`을 믿지 않고 sharp가 실제 바이트로 판별(확장자 위조 방어)
- ★`tsconfig`가 `strict: false`라 판별 유니온 좁힘이 동작하지 않는다(TS2339).
  tsconfig는 기존 파일이라 건드리지 않고, 테스트에서 `in` 연산자로 우회했다

### 남은 것 (묶음 B)

- [ ] 캐시 조회/기록 (`RpAnalysisCache`)
- [ ] 사용량 로그 (`RpAiUsageLog`) — 성공·실패·캐시적중 전건
- [ ] 일일 한도 (비로그인 2 / 로그인 20) + 429 `requiresLogin:true`
- [ ] `POST /api/reverse-prompt/analyze`, `GET /api/reverse-prompt/quota`
- [ ] 라우터 등록 1줄 (`routes/aimp/index.ts`)
- [ ] **VLM 왕복 실측** — ★개발용 Gemini 키 발급 후
- [ ] 캐시 2회차 `cacheHit=true` + AI 호출 0회 증명 (컨테이너에서)
- [ ] 413 실제 응답 확인

---

## 다음 할 일 (묶음 C 이후 — 착수 금지)

- shared-api에 `sharp` 추가 (전처리: 리사이즈·EXIF 제거·해시·썸네일)
- `lib/reverse-prompt/` — VLM 호출 모듈 + 프롬프트 상수 분리 + JSON 스키마 검증·재시도(최대 2회)
- 분석 캐시(`RpAnalysisCache`) / 사용량 로그(`RpAiUsageLog`) / 일일 한도 검사
- `POST /analyze`, `GET /quota`
- Rp* 4개용 스키마 대조 스크립트 (`check-learning-schema-sync.ts` 방식)

---

## 결정 사항

- **스키마 정본은 shared-api 쪽**으로 판단(위 근거표). ai_mp 스키마는 손대지 않았다
- **PRD의 Json→String, Decimal→Float 정정**은 기존 71개 모델 관례를 따른 것. 관례를 깨면
  대조 스크립트·조회 코드가 전부 예외 처리를 안게 된다
- **DDL은 `prisma/<기능>-ddl.sql` 파일 방식**을 따랐다. 이 저장소는 `prisma/migrations/`
  디렉터리 자체가 없고 `club-ddl.sql`·`learning-coach-ddl.sql` 선례가 있다
- **TIMESTAMPTZ 유지** — Prisma 생성본은 `TIMESTAMP(3)`을 쓰지만, 기존 Lc DDL이 전부
  TIMESTAMPTZ이고 대조 스크립트가 `timestamp with time zone`을 `DateTime`으로 허용한다
  (오늘 오전 대조에서 Lc* 11개가 이 타입으로 불일치 판정되지 않은 것이 증거)
- **문서 위치는 `app/reverse-prompt/`** — 루트 PROGRESS.md는 학습코칭 것이라 덮을 수 없다

---

## 위험 요소

- ★**업로드 상한 10MB는 실질 도달 불가**(Vercel 프록시 413). base64 팽창까지 감안하면
  원본 7MB 근처가 한계다. PRD 7장 수치를 그대로 구현하면 사용자가 원인 모를 413을 본다
- **비로그인 한도의 `visitorKey`가 우회 가능** — IP 해시+지문 조합은 시크릿창·IP 변경으로
  뚫린다. PRD 11장 8항("우회 경로를 만들지 않는다")을 완전히 만족시키긴 어렵다는 점을 인지할 것
- **썸네일 base64를 DB에 넣으면 `RpItem` 행이 커진다.** 128px JPEG이라도 행당 수 KB.
  보관함 목록 쿼리에서 `thumbnail`을 SELECT하지 않도록 주의(묶음 C)

---

## 막힌 것 / 사용자 확인 필요

**2026-08-14 사용자 결정으로 1~4는 해소됨:**

1. ~~썸네일 정책~~ → **128px base64로 진행.** 없으면 보관함이 텍스트 목록이 되고,
   보관함이 곧 로그인 이유이므로(PRD 2.1) 시각 단서를 유지한다
2. ~~VLM 모델~~ → **`gemini-3.5-flash-lite` 단일.** A/B 하지 않는다
3. ~~코드 위치~~ → **`shared-api/lib/reverse-prompt/` + `frontend/components/reverse-prompt/`** 승인
4. ~~업로드 상한~~ → **5MB.** PRD 2.1 `sessionStorage` 상한과 일치시킨다
5. **운영 DB 마이그레이션 실행** — **묶음 E 직전 단 한 번**, 별도 승인 후 실행한다

### ★AI 자격증명 — 개발용 키 발급 대기 (2026-08-14)

`shared-api/.env`에 **`GOOGLE_APPLICATION_CREDENTIALS_JSON`이 이미 설정돼 있다**
(Vertex 서비스 계정 `aichat-vercel@`, `type: service_account`, 파싱 정상).

★내가 앞서 "서버2에 자격증명이 없어 Gemini를 못 부른다"고 보고한 것은 **오진**이었다.
실제 원인은 테스트 스크립트가 `dotenv`를 로드하지 않은 것뿐이다
(`index.ts`는 첫 줄에서 `import 'dotenv/config'` 한다).

다만 그 키는 **운영용**이라 개발 호출이 운영 청구·쿼터에 섞인다.
**원가 추적은 이 기능 존재 이유의 절반**이므로 섞으면 안 된다.
**★최종 결정(2026-08-14): 개발용 서비스 계정을 발급하지 않는다.**
서버2의 **기존 운영 키를 그대로 쓰고**, 대신 `RpAiUsageLog.environment` 컬럼으로
개발 호출과 운영 호출을 **집계 단계에서 분리**한다. 키를 나누는 대신 데이터를 나누는 방식이라
발급·관리 부담 없이 원가 추적 목적을 달성한다.

- 원가 조회는 **반드시 `WHERE "environment" = 'production'`** (PRD 8장 쿼리에 반영 완료)
- 판정은 `lib/reverse-prompt/constants.ts`의 `resolveEnvironment()`
- ★**`NODE_ENV`로만 판정하면 안 된다** — `.env`에 `NODE_ENV=production`이 하드코딩돼
  있어 서버2에서도 그 값을 읽는다. 전용 변수 **`RP_ENVIRONMENT`를 먼저** 보고 없을 때만 폴백.
  개발 검증 시 `.env.dev`의 `RP_ENVIRONMENT=development`가 적용된다
- 실측 확인: `NODE_ENV=production` 상태에서 `RP_ENVIRONMENT=development`를 주면
  판정이 `development`로 뒤집힌다(함정 통과 확인). 집계 쿼리는 운영 2건만 잡고
  개발 2건을 제외했다($0.0044 vs 필터 없으면 $0.0088)

### ★개발용 검증 컨테이너 — 일회성 도구이지 별도 인프라가 아니다

**운영 아키텍처는 aichat DB 하나다.** `Rp*` 4개 테이블은 `Lc*` 11개 옆에 같은 DB에 들어간다.
`RpItem.userId`가 `User` FK이므로 DB를 쪼갤 수 없고, 쪼갤 이유도 없다(회원 전환이 이 기능의
존재 이유다 — PRD 1.4). **컨테이너는 그 운영 구조와 무관한 개발 중 검증 도구일 뿐이다.**

왜 운영 DB에서 개발하지 않는가 — 묶음 B의 검증 항목이 곧 이유다:
- 비로그인 3회차 **429**를 보려면 `RpGuestUsage`에 **가짜 방문자 기록**을 쌓아야 한다
- 로그인 21회차를 보려면 실계정으로 **20번 호출**해야 하고, 그때마다 실제 Gemini가 나가고
  `RpAiUsageLog`에 **테스트 데이터**가 쌓인다 → 나중 원가 집계에 쓰레기가 섞인다.
  **원가 추적은 이 기능 존재 이유의 절반이다**(PRD 1.4/11장). 오염시키면 안 된다
- 지금은 코드가 **작성 중**이다. 미완성 코드를 운영 DB에 붙이는 것이 CLAUDE.md의
  서버1/서버2 분리가 막으려던 바로 그 상황이다

**운영 반영 계획**
- 컨테이너는 **묶음 E 완료 후 삭제**한다(`docker compose -f dev-db/docker-compose.yml down -v`)
- **운영 DB DDL 실행은 묶음 E 직전 단 한 번**, 그때 별도 승인을 받는다
- 배포 후 운영 검증은 **실계정 1~2회 왕복으로 끝낸다.** 한도·캐시 테스트는 컨테이너에서 한다

**기동 방법**
```sh
cd /home/paks11299958/shared-api
docker compose -f dev-db/docker-compose.yml up -d     # 기동
docker compose -f dev-db/docker-compose.yml down      # 중지(데이터 유지)
docker compose -f dev-db/docker-compose.yml down -v   # 삭제(볼륨까지) — 묶음 E 후
```
- 컨테이너 `rp-dev-postgres`, PostgreSQL 16, **`127.0.0.1:5432`에만 바인딩**(외부 노출 없음)
- 접속 정보는 **`shared-api/.env.dev`** — `.gitignore` 등록 완료, **커밋되지 않는다**
- 서버2 OOM 이력을 감안해 `mem_limit: 512m` 적용
- ★`pgvector` 확장이 없어 RAG용 3개 테이블은 생성 실패하지만 `User`·`Rp*`는 무관하다

**이 컨테이너에서 이미 잡은 것**(문법 검사로는 못 잡던 것)
- 손으로 쓴 `reverse-prompt-ddl.sql`이 **에러 없이 실제 실행**됨
- **재실행 안전**(멱등성) — 두 번째 실행이 전부 NOTICE(skipping), 에러 0건
- PRD 8장이 요구한 **원가 집계 쿼리가 실제로 동작**함

### ~~남은 블로커 — 개발 DB 없음~~ (해소됨, 아래는 최초 확인 기록)

```
서버2 PostgreSQL : inactive, 5432/5433 리스닝 없음
Docker           : 미설치 (명령 자체 없음)
DATABASE_URL     : 10.178.0.2:5432/aichat  ← 서버1 운영 DB
```

묶음 B의 검증 항목 중 **캐시 2회차 `cacheHit=true`·사용량 로그 확인·429 한도**는
전부 DB를 요구한다. 운영 DB에는 붙지 않는다(지시 + 이 컨테이너에서 타임아웃으로 차단됨).

선택지: **A** Docker 설치 후 로컬 Postgres(서버2 지속성 변경 → 승인 필요) /
**B** PostgreSQL 직접 설치(동일) / **C** DB 불필요한 전처리·VLM만 검증하고 나머지는 코드만.

→ **사용자 선택 대기 중.** A 추천(C로 가면 묶음 B 절반이 "코드는 썼지만 미검증"으로 남는다).
