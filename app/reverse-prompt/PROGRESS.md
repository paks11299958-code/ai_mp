# 진행 상황 — 리버스 프롬프트 (app/reverse-prompt)

**현재 묶음**: A~E-1 완료 / **E-2a·E-2b 완료(운영 DDL 적용됨)** / E-2c 이후 대기
**브랜치**: `feature/reverse-prompt` (ai_mp, shared-api 양쪽)
**최종 갱신**: 2026-08-18

---

## ★E-2a·E-2b 완료 — 운영 DB에 `Rp*` 4개 테이블 생성됨 (2026-08-18)

**E-2a 사전 조회**: `Rp%` **0건** 확인. 운영 DB 확인 근거 = users 73 / `Lc*` 11 / 전체 97,
`n8n-docker-db-1` 컨테이너 포트가 `.env`의 `DATABASE_URL` 호스트(`10.178.0.2:5432`)와 일치.

**E-2b DDL 실행**: 종료코드 0, `NOTICE ... skipping` **0건**, 11개 실행문 전부 성공.
테이블 97→101, `diff` 결과 **추가 4줄 외 변화 없음**. `User` 73행·20컬럼 유지.
`environment` DEFAULT `'production'` 확인. 4개 테이블 전부 0행.

### ★이 단계에서 드러난 계획서 오류 2건 (정정 완료)

| # | 계획서 초판 | 실제 | 조치 |
|---|---|---|---|
| 1 | `psql -U aichat_user -d aichat -f ...` | **서버1 호스트에 psql 없음.** PostgreSQL은 Docker 컨테이너 `n8n-docker-db-1`(pgvector/pg17) | `DEPLOY_PLAN.md` **0-2절 신설** — `docker exec -i` + stdin 방식 |
| 2 | "인덱스 6개"(PRD 8장은 5개) | **7개.** `environment` 추가 시 `RpAiUsageLog_environment_createdAt_idx`가 함께 늘었다 | 계획서 1장에 명시. PK 자동 4개 포함 시 조회에는 11개 |

★**DDL 파일은 `feature/reverse-prompt`에만 있고 서버1의 `main`에는 없다.** 머지는 백엔드
배포와 묶인 별도 결정이라, DB 단계에서는 머지하지 않고 **서버2 파일을 stdin으로 흘려넣었다.**
서버1 파일시스템에 아무것도 남기지 않았다.

★**단일 트랜잭션으로 실행했다**(`--single-transaction` + `ON_ERROR_STOP=1`).
PostgreSQL은 DDL이 트랜잭션 가능하므로 마지막 인덱스에서 실패해도 전부 롤백된다 — 부분 적용 없음.

**되돌리려면**: `DROP TABLE "RpItem","RpAnalysisCache","RpGuestUsage","RpAiUsageLog" CASCADE;`
(신규 테이블뿐이라 기존 데이터 손실 경로 없음, 재시작 불필요)

**다음**: E-2c(shared-api 재시작 — ★aichat 전체 20~30초 중단) **별도 승인 대기**

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

### 완료 (백엔드 핵심 — 실측 검증 끝)

- [x] **`lib/reverse-prompt/store.ts`** — 캐시·사용량로그·일일한도·환불
- [x] **`routes/aimp/reverse-prompt.ts`** — `POST /analyze`, `GET /quota` + IP rate limit
- [x] **라우터 등록 1줄** — `routes/aimp/index.ts`(기존 파일 수정은 이 1줄만)
- [x] **경계값 테스트 15개** — `__tests__/quota-boundary.test.ts`

**★실제 왕복 실측 (개발 컨테이너, `RP_ENVIRONMENT=development`)**

| 검증 항목 | 결과 |
|---|---|
| 1회차 왕복 | **HTTP 200 / 3,985ms** — MJ·SD 프롬프트 정상 생성 |
| **실측 토큰** | 입력 **1,664** / 출력 **306** |
| **★실측 원가** | **$0.001264/건** (추정 $0.0022 대비 **43% 저렴**) |
| 2회차(같은 이미지) | **200 / 97ms**, `cached=true`, 결과 동일 |
| **★AI 실호출 건수** | **1건** (2회 요청) — 로그 테이블로 증명 |
| 캐시 `hitCount` | 1 |
| 3회차 | **429 + `requiresLogin:true`** |
| **VLM 실패 시 환불** | remaining **2→2 유지**, 로그는 1건 남음(`inputTokens=0`) |
| 5MB 초과 | **413** |
| gif | **400** |
| `environment` | 전건 `development` — 운영 원가와 분리 |
| 회귀 | 유닛 **66개 통과**, `tsc` 0 오류 |

**API 경로 정정**: PRD 초안의 `/api/reverse-prompt/*`는 실제로 **`/api/aimp/reverse-prompt/*`**다
(`routes/index.ts`가 `/aimp` 하위에 마운트한다). PRD 9장 표를 실제 경로로 수정했다.

**★핸들러 순서 관련 설계 판단**
- **캐시 조회가 한도 검사보다 앞**(사용자 고정). AI를 안 부른 요청이 횟수를 먹으면 손해다.
  부작용: 같은 이미지 반복 요청은 한도를 무한 통과한다. AI 원가는 0이라 11장 원가통제엔
  저촉되지 않지만 11장 8항과는 긴장이 있어, **IP rate limit(10분 30회)**로 받친다(9장 요구).
- **VLM 실패 시 한도 환불.** 차감을 성공 이후로 미루지 않은 이유는 동시 요청 둘이
  검사만 통과해 한도가 새기 때문이다. DB 트랜잭션으로 묶지 않은 이유는 VLM이 수 초
  네트워크 I/O라 그동안 커넥션이 점유돼 풀이 마르기 때문이다.
- 로그인 사용자는 `RpAiUsageLog`가 카운터라, 실패분(`inputTokens=0`)을 집계에서 제외한다.

**★이번에 잡은 함정 3건** (전부 실제 서버를 띄워서야 드러났다 — 타입체크·단위테스트로는 불가)
1. **Vertex 리전** — `gemini-3.5-flash-lite`가 `us-central1`에 없어 404.
   전 리전 실측 결과 **`global`에서만 동작** → `RP_VERTEX_LOCATION='global'`
2. **KST/UTC 혼동** — `createdAt >= kstToday()`로 짜서 KST 00~09시 로그가 집계에서 빠졌다.
   로그인 사용자가 한도를 초과해 쓸 수 있는 버그 → `kstDayStartUtc()` 분리
3. **`.env` source 금지** — 서비스 계정 JSON의 따옴표가 bash에서 제거돼 파싱 실패.
   한 번 깨진 값이 셸에 남으면 dotenv가 덮어쓰지 않아 재기동해도 계속 깨진다 → `env -i`

### 남은 것 (묶음 B)

**★묶음 B 완료.** 위 항목에 더해 아래도 검증했다.

| 검증 항목 | 결과 |
|---|---|
| 로그인 `quota` | `limit:20` ✅ |
| 로그 20건 시드 후 | `used:20, remaining:0` ✅ |
| **로그인 21회차** | **429**, 메시지가 로그인용으로 다름, **`requiresLogin:false`** ✅ |
| **실패분 제외** | 실패 로그(`inputTokens=0`) 5건 추가해도 `used` **20 유지** ✅ |
| 스키마 검증 | 단위 테스트 16개 — 빈 문자열·공백·필드 누락·빈 배열·타입 불일치 전부 거부 ✅ |
| 원가 계산 | 실측값 재현($0.001264), 옛 모델 단가 보존, 미등록 모델 0 ✅ |
| 재시도 정책 | `RP_MAX_RETRY=2` (최초 1회 + 재시도 2회) ✅ |
| **최종 회귀** | **유닛 82개 통과**, `tsc` 0 오류 ✅ |

---

## 묶음 C — 완료 (백엔드 보관함)

**파일**: `lib/reverse-prompt/store.ts`(추가), `routes/aimp/reverse-prompt.ts`(추가)
커밋 `fcad9c1`(shared-api)

### 명세 → 구현 1:1 대조

| 명세 | 구현 | 검증 |
|---|---|---|
| `assertOwnership` 헬퍼 | `store.ts: assertOwnership()` | 타인 접근 404 왕복 확인 |
| 세션 ID는 `requireAuth`에서만 | `routes: requireAuth(req,res)` — body/query의 userId 미사용 | 비로그인 401 |
| 위반 시 **404**(403 아님) | 세 핸들러 모두 404 | 상세·삭제 각각 404 확인 |
| `GET /items` 목록 | `store.ts: listItems()` | 3건 정상, 정렬 최신순 |
| 페이지네이션 기본 20 / 상한 | `RP_ITEMS_PAGE_SIZE=20`, `RP_ITEMS_MAX_SIZE=50` | `size=999999` → **50으로 조임** |
| `(userId, createdAt DESC)` 인덱스 | `orderBy: { createdAt: 'desc' }` | **EXPLAIN 확인**(아래) |
| 목록에 전문 미포함 | `select`로 5개 필드만 + 120자 미리보기 | 응답 필드에 `analysisJson`·`midjourney`·`sdNegative` **없음** |
| `GET /items/:id` 상세, 재생성 금지 | `store.ts: getItemDetail()` — DB 로드만 | **15회 조회에 로그 증가 0** |
| `DELETE /items/:id` 소유자만 | `store.ts: deleteItem()` — `deleteMany` + 소유자 조건 | 타인 삭제 404, 대상 살아있음 |
| 캐시는 지우지 않음 | 삭제 로직에 `RpAnalysisCache` 손대지 않음 | 삭제 후 캐시 **1건 유지** |
| analyze 성공 시 `RpItem` 저장 | `routes: saveItem()` — `userId !== null`일 때만 | 캐시적중·신규 양쪽 경로 모두 적용 |
| 썸네일 128px 함께 저장 | `saveItem(..., thumbnailBase64, ...)` | — |

### 실제 서버 왕복 검증 결과

| 검증 | 결과 |
|---|---|
| 비로그인 목록 | **401** |
| A가 B의 항목 상세 | **404** (`{"error":"항목을 찾을 수 없어요."}`) |
| A가 B의 항목 삭제 | **404**, B 항목 `count=1`로 **살아있음** |
| **재생성 안 함 증명** | 상세 10회 + 목록 5회 = **15회 조회에 `RpAiUsageLog` 증가 0건**, 응답 해시 동일 |
| 삭제 | `RpItem` 0 / **`RpAnalysisCache` 1 유지** / 재삭제 404 |
| 페이지네이션 | `size=2` → 1p 2건(hasNext=true), 2p 1건(hasNext=false) |
| 회귀 | 유닛 **82개 통과**, `tsc` 0 오류 |

### 목록 쿼리 EXPLAIN (803행 기준)

```
Limit  (cost=0.28..2.02 rows=20) (actual time=0.032..0.041 rows=20)
  ->  Index Scan Backward using "RpItem_userId_createdAt_idx" on "RpItem"
        Index Cond: ("userId" = 9001)
        Buffers: shared hit=3
Execution Time: 0.102 ms
```

**인덱스를 탄다.** 803행 중 20건만 읽고 **Sort 노드가 없다**(인덱스 역순 그대로).
★Prisma가 실제로 보내는 쿼리를 PostgreSQL 로그로 캡처해 **위 EXPLAIN과 동일함을 확인**했다
(컬럼·WHERE·ORDER BY·LIMIT 일치). 손으로 쓴 SQL만 보고 판단하지 않았다.

### ★위험 요소 — COUNT 쿼리는 Seq Scan이다

Prisma의 `count()`가 별도 쿼리로 나가는데 그쪽은 **Seq Scan**이다.

```
Aggregate  ->  Seq Scan on "RpItem"  (rows=502)  Rows Removed by Filter: 301
Execution Time: 0.183 ms
```

`enable_seqscan=off`로 강제해도 **Bitmap Heap Scan**이 된다 — Prisma가 `SELECT "id"`를 하는데
`id`가 인덱스에 없어 Index Only Scan이 성립하지 않는다.

현재 규모(8페이지)에선 Seq Scan이 더 빨라 **옵티마이저 판단이 옳고, 지금은 문제가 아니다.**
다만 한 사용자의 항목이 수만 건이 되면 목록 조회마다 전체 스캔이 된다.
→ 그때 대응: `total`을 응답에서 빼고 `hasNext`만 주거나(무한 스크롤이면 충분),
   `@@index([userId, createdAt, id])`로 커버링 인덱스를 만든다. **지금은 하지 않는다**(YAGNI).

---

## 묶음 D — 완료 (프론트엔드)

**파일**: `frontend/components/reverse-prompt/{api.ts, parts.tsx, ReversePromptMain.tsx, ReversePromptLibrary.tsx}`
**기존 파일 수정**: `App.tsx`(import 2줄 + 경로상수 + 분기 2줄), `vercel.json`(3줄) — 라우팅 등록만
커밋 `63ff4fc`(ai_mp)

### 재사용한 기존 패턴 (새 라이브러리·색상 체계 미도입)

| 대상 | 재사용한 것 |
|---|---|
| API 호출 | `services/apiService.ts`의 `get/post/del` — `authHeaders()`가 Bearer 자동 부착 |
| 로그인 모달 | `components/AuthModal.tsx` (`onSuccess`/`onClose`) |
| 라우팅 | `pathname` 정규식 매칭 + 삼항 얼리리턴 (learning 선례) |
| 색상 | `#F5EFE6`/`#2D2438`/`#5C5468`/`#F0E9DE` + indigo (learning과 동일) |
| 토큰 | `localStorage.token` |

### 명세 → 구현 1:1 대조

| # | 명세 | 구현 |
|---|---|---|
| 1 | 드래그앤드롭 + 클릭, 첫 화면 업로드만 | `ReversePromptMain.tsx: onDrop/fileInputRef` — 로그인 유도 요소 **0개 확인** |
| 2 | 클라이언트에서 크기·형식 차단 | `api.ts: checkFile()` — **/analyze 호출 0건 확인** |
| 3 | 분석 중 로딩 | `parts.tsx: RpLoading` |
| 4 | MJ/SD 동시 + 각각 복사 | `parts.tsx: PromptBlock/CopyButton` — 블록 3개, 버튼 3개 |
| 5 | 캐시 적중 표시 | `ReversePromptMain.tsx` 캐시 배너 |
| 6 | 잔여 횟수 + 저장 안내 | `parts.tsx: QuotaBadge` + 비로그인 안내 카드 |
| 7 | 최근 보관 3개 | `ReversePromptMain.tsx` — `items(1, 3)` |
| 8 | 429 → 모달 | `runAnalyze()` 429 + `requiresLogin` 분기 |
| 9 | 모달 전 sessionStorage 보관 | `api.ts: savePendingUpload()` — 실패 시 안내 |
| 10 | 복귀 후 자동 재개 + 정리 | `useEffect` + `onAuthSuccess` |
| 11 | 모달 닫으면 보관분 정리 | `onAuthClose` → `clearPendingUpload()` |
| 12 | 보관함 목록 | `ReversePromptLibrary.tsx` |
| 13 | 펼치면 상세 로드 | `toggle()` → `itemDetail()` |
| 14 | 삭제는 확인 후 | `remove()` → `window.confirm` |
| 15 | 페이지네이션 | 이전/다음 버튼 |
| 16 | 360px 가로 스크롤 없음 | `truncate`/`break-words`/`min-w-0` |
| 17 | 에러 화면 표시 | `parts.tsx: RpError` |
| 18 | 실패 시 파일 유지 + 재시도 | `lastUpload` ref + `RpError onRetry` |

### 브라우저 실측 검증 (Playwright, dist를 3099 백엔드에 연결)

| 검증 | 결과 |
|---|---|
| 360px / 390px | **가로 스크롤 없음** |
| 첫 화면 로그인 유도 | **0개** |
| 5MB 초과 / gif | 화면 메시지 + **`/analyze` 호출 0건**(서버 미도달) |
| 실제 이미지 | **3.0초**, MJ 1 + SD Positive 1 + SD Negative 1, 복사버튼 3 |
| 복사 | "복사됨" 피드백 + 클립보드 내용 확인 |
| 캐시 적중 | `cached:true`, 배너 표시, **잔여 미차감** |
| 3회차 | **429 `requiresLogin:true`** → sessionStorage 보관(310KB) → 모달 |
| 로그인 복귀 | **자동 재개 200**, sessionStorage 정리, 잔여 19/20 |
| 보관함 | 503건 → 10건 페이지네이션, 펼침 시 **상세 API 호출** |
| 삭제 | 확인창 → 503→502 |
| **회귀** | `/`, `/learning`, `/learn` **모두 정상 렌더** |

### ★브라우저를 띄워서야 잡은 버그

`apiService`의 `BASE`가 이미 `/api`인데 호출부에서 `/api/aimp/...`를 써
**`/api/api/...` 404**가 났다. **빌드·타입체크는 통과한다** — 실제 화면을 띄우지 않았으면
묶음 E까지 못 잡았을 버그다.

### 아직 하지 않은 것

- **메인 진입점 노출 스위치** — 지시대로 켜지 않았다. `/reverse-prompt`로 직접 들어가야 보인다.
  묶음 E에서 앞 단계가 전부 검증된 뒤에 켠다
- 운영 DB DDL 실행 — 묶음 E 직전 별도 승인

---

## 묶음 E-1 — 완료 (검증. 배포는 다음 세션)

**커밋** `(아래 참조)` / **배포 계획서**: `app/reverse-prompt/DEPLOY_PLAN.md`
★운영 DB·배포·진입점 노출 **아무것도 실행하지 않았다.**

### 1. 개발 DB 초기화 + DDL 멱등성 재확인

검증용 쓰레기(RpItem 803, 로그 3, 캐시 1, 테스트유저 2)를 전부 지우고 DROP 후 재실행.
- 1회차: 테이블 4 + 인덱스 7 생성
- 2회차: **전부 `skipping`, ERROR 0건** → 멱등성 재확인

### 2. 빈 상태 화면 — 1건 보완

| 화면 | 상태 | 조치 |
|---|---|---|
| S1 "최근 보관" 0건 | 섹션 자체가 **숨김** | 그대로 (빈 목록이 덩그러니 나오지 않음) |
| 보관함 0건 | 안내 + CTA는 있으나 **상단에 몰려 휑함** | ★**세로 중앙 정렬 + 설명 한 줄 추가**로 보완 |

★우하단 보라색 원형 버튼은 **기존 aichat 전역 요소**다(메인·학습코칭에도 동일). 건드리지 않았다.

### 3. 원가 재측정 — 8개 소재 (확정)

| 소재 | 입력 | 출력 | 원가 |
|---|---|---|---|
| 단순 도형 | 1,653 | 230 | $0.001071 |
| 기하 패턴 | 1,628 | 286 | $0.001203 |
| 풍경 | 1,644 | 287 | $0.001211 |
| 인물 | 1,637 | 299 | $0.001239 |
| 복잡한 도시 야경 | 1,630 | 350 | $0.001364 |
| 일러스트 | 1,653 | 310 | $0.001271 |
| UI 목업 | 1,628 | 323 | $0.001296 |
| 추상 | 1,653 | 307 | $0.001263 |

**최소 $0.001071 / 최대 $0.001364 / 평균 $0.001240** — 월 1만 건 **$12.40**.
입력은 사실상 고정(±1.5%), 변동은 출력에서만(52% 차이). PRD 11장에 확정 기입.
`environment`는 8건 전부 `development`로 기록 확인.

### 4. 삭제 후 재업로드 캐시 적중 (묶음 C에서 미룬 것)

- `RpItem` 삭제 → 항목 0, **캐시 1건 유지**
- 같은 이미지 재업로드 → **69ms**, `cached:true`, **AI 실호출 증가 0건**, 한도 미차감
- 보관함에는 새 `itemId`로 다시 저장 (사용자 관점에서 자연스러움)
- 브라우저에서도 캐시 배너 표시 확인

### 5. PRD 13장 완료 조건 — 14/14 통과

| # | 조건 | 결과 | 근거 |
|---|---|---|---|
| 1 | MJ + SD(pos/neg) 모두 표시 | ✅ | 브라우저 360px에서 `h3` 1/1/1 |
| 2 | 분석 1건당 AI 호출 정확히 1회 | ✅ | 로그 1건 / AI실호출 1 |
| 3 | 재업로드 시 `cacheHit=true`, AI 미호출 | ✅ | 응답 `cached:true`, 로그 `t/0` 행 |
| 4 | 보관함 재열람 시 재생성 안 함 | ✅ | 상세 API 200, 15회 조회에 로그 증가 0 |
| 5 | 비로그인 3회차 429 + 모달 | ✅ | 429 `requiresLogin:true`, 모달 표시 |
| 6 | 로그인 복귀 시 이미지 복원 | ✅ | sessionStorage `c.jpg` → 자동재개 200 → 정리됨 |
| 7 | 원본 이미지가 FS·DB에 없음 | ✅ | `RpItem` 컬럼에 원본 없음(thumbnail=128px), 업로드 디렉터리 없음 |
| 8 | EXIF 제거 후 VLM 전달 | ✅ | 단위 테스트 16개 통과(EXIF 존재→제거 확인) |
| 9 | 타 사용자 `RpItem` 404 | ✅ | B가 A 항목 상세/삭제 → 둘 다 404, 항목 생존 |
| 10 | 360px 가로 스크롤 없음 | ✅ | S1·S2 모두 `scrollWidth == clientWidth` |
| 11 | 기존 aichat 회귀 | ✅ | `/`·`/learning`·`/learn` 정상 렌더, 유닛 82개 통과 |
| 12 | 모든 AI 호출이 토큰·원가와 기록 | ✅ | `cacheHit=f` 4건(토큰·원가 있음) + `t` 1건(0) 모두 기록 |
| 13 | 11장 산식으로 실측 원가 기입 | ✅ | 8개 소재 실측 → PRD 11장 확정 표 기입 |
| 14 | 빌드·테스트 무오류 | ✅ | `npm run check` 통과, 프론트 빌드 성공, `tsc` 0, 유닛 82 |

**미통과 항목 없음.**

★**단, 7·8번은 다른 항목보다 근거가 약하다**(2026-08-15 지적 반영):

| # | 현재 근거 | 약한 이유 | E-2c에서 보완 |
|---|---|---|---|
| 7 원본 미저장 | "업로드 디렉터리 없음" | **sharp가 처리 중 임시 파일을 쓰는지는 확인 범위 밖**이었다 | 요청 처리 중 `/tmp` 스냅샷 비교 |
| 8 EXIF 제거 | 단위 테스트 | 함수가 결정적이라 큰 문제는 아니나 **실제 왕복으로 확인한 다른 항목과 성격이 다르다** | EXIF 심긴 이미지를 실제 API로 업로드해 확인 |

### 6. 알려진 제약 / 미구현

- **6.4 질문하기** — PRD에 없는 기능. 미구현이 정상
- **진입점 노출** — 의도적으로 켜지 않았다. `/reverse-prompt` 직접 접근만 가능
- **COUNT 쿼리 Seq Scan** — 한 사용자 항목이 수만 건이 되면 목록 조회가 느려진다.
  현재 규모에선 옵티마이저 판단이 옳아 조치하지 않았다(대응안은 묶음 C 절 참조)
- **`visitorKey` 우회 가능** — 시크릿창·IP 변경으로 비로그인 한도를 우회할 수 있다.
  IP rate limit(10분 30회)이 보조 방어선이다. 완전 차단은 구조상 불가
- **캐시 적중은 한도를 소모하지 않는다** — 같은 이미지 반복 요청이 한도 검사를 통과한다.
  AI 원가는 0이라 11장 원가통제엔 저촉되지 않으나 11장 8항과는 긴장이 있다(설계상 수용)
- **캐시 적중률 미측정** — 실사용 데이터가 없어 측정 불가. 출시 후 `cacheHit=true` 비율로 확인

---

## ★다음 세션 인수인계 (2026-08-14 기준 환경 상태)

**현재 떠 있는 것** — 다음 세션이 그대로 쓸 수 있다.

| 대상 | 상태 | 비고 |
|---|---|---|
| `rp-dev-postgres` 컨테이너 | **실행 중**(healthy, 10시간) | 개발 DB. 묶음 E 후 삭제 |
| 검증 서버 `:3099` | **실행 중** | `shared-api/_devserver.sh` |
| 개발 DB 데이터 | 로그 28건 / 캐시 2건 / `RpItem` 0건 / 테스트유저 `id=9001` | 전부 검증용 쓰레기 — 지워도 된다 |

**★`_devserver.sh`는 `.gitignore`라 커밋되지 않는다.** 사라졌으면 아래로 다시 만든다:

```bash
#!/bin/bash
# ★.env를 source 하지 않는다(함정 6). env -i로 상속을 끊는다.
exec env -i HOME="$HOME" PATH="$PATH" \
  PORT=3099 \
  DATABASE_URL="postgresql://rpdev:rpdevpass@127.0.0.1:5432/aichat_dev" \
  RP_ENVIRONMENT=development \
  npx ts-node --transpile-only index.ts
```

기동: `cd ~/shared-api && setsid ./_devserver.sh > _dev.log 2>&1 < /dev/null &`
확인: `curl -s localhost:3099/api/health`

**★API 경로는 `/api/aimp/reverse-prompt/*`다**(PRD 초안의 `/api/reverse-prompt/*` 아님).
`routes/index.ts`가 `/aimp` 하위에 마운트한다.

**로그인 상태로 테스트하려면** — 토큰을 직접 발급한다(`.env`의 `JWT_SECRET` 사용):
```bash
node -e "require('dotenv').config();const jwt=require('jsonwebtoken');
console.log(jwt.sign({userId:9001}, process.env.JWT_SECRET, {expiresIn:'1h'}))"
```

**한도 초기화**(재검증 시):
```sql
TRUNCATE "RpGuestUsage"; TRUNCATE "RpAiUsageLog"; TRUNCATE "RpAnalysisCache" CASCADE;
```

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
