# 진행 상황 — AI 학습코칭 (app/learning)

## 완료

- [x] 1. 코드베이스 조사 → 확인 결과:
  - 프레임워크: **Next.js 아님**. `frontend/`는 Vite + React SPA, 라우팅은 React Router 대신
    `window.location.pathname` 수동 매칭 (`App.tsx` 최하단)
  - 인증: JWT 기반, `shared-api/lib/auth.ts`의 `requireAuth(req, res)` 재사용 (쿠키 `token` 또는
    `Authorization: Bearer`, 일반 회원 7일/어드민 24시간)
  - 사용자 테이블: `User`(PK `id`, `Int` autoincrement), 정본은 `shared-api/prisma/schema.prisma`
  - 페르소나 목록: DB `Persona` 모델 + `features`(JSON) 컬럼, 프론트 `frontend/personaFeatures.ts`의
    `FEATURE_REGISTRY`/`FeatureKey`에도 등록 필요
  - ORM: Prisma 7.7.0(→ generate 시 7.8.0으로 로드됨) + `@prisma/adapter-pg`. 이미 있으므로 Drizzle 미도입
  - 명명 규칙: PascalCase 모델명, camelCase 컬럼(기존 스키마 전체 관례)
  - 디자인: Tailwind 확인, `--color-gray-950: #030712` 등 다크 토큰 존재
  - 배포/스케줄러: Vercel 자동배포(Cron 미사용), 실제 정기작업은 **서버2 crontab**이
    `shared-api`의 시크릿 헤더 보호 엔드포인트를 호출하는 `internal-cron.ts` 패턴
  - **파일**: `app/learning/CLAUDE.md`, `app/learning/PRD.md` (사용자 제공 원문을 정리해 배치)

- [x] 2. 마이그레이션 작성 →
  - `shared-api/prisma/schema.prisma`에 `Lc*` 모델 **10개**(PRD 8장의 10개 테이블과 1:1 대응)
    추가 + `User`에 역참조 관계 필드 8개 추가(FK가 있는 8개 모델에 대응, `LcModule`·`LcQuestion`은
    User를 직접 참조하지 않아 역참조 없음)
  - `shared-api/prisma/learning-coach-ddl.sql` 신규 (기존 `club-ddl.sql`과 동일 패턴, **미실행**).
    `ALTER TABLE "User"` 없음 — 정상. 역참조는 FK가 반대편(`Lc*` 테이블)에 걸리는 구조라
    User 테이블 자체는 변경 불필요. DDL에 `REFERENCES "User"(id)` 8건으로 확인 완료
  - `shared-api`에서 `npx prisma generate` 실행 완료(클라이언트 코드 생성만, **DB 미접속·미변경**)
  - `shared-api` 저장소(별도 git)에도 `feature/learning-coach` 브랜치 생성 후 커밋 `bc88f4f`

- [x] 3. 페르소나 카드 + 랜딩 →
  - `shared-api/prisma/seed-learning-coach-persona.js`: `Persona` 시드 스크립트(id 고정
    `'learning-coach'`, `features: ['learning-coach']`). **파일만 작성, 미실행**(운영 DB
    INSERT라 마이그레이션과 동일하게 사용자 확인 필요)
  - `frontend/personaFeatures.ts`: `FeatureKey`에 `'learning-coach'` 추가, `FEATURE_REGISTRY`에
    라벨·아이콘·색상 등록, 기존 `'learn'`과 혼동 방지 주석 추가
  - `frontend/App.tsx`: `learning-coach` 키 클릭 시 `/learning`으로 이동(453행 근처, 기존
    `learn: () => window.location.href = '/learn'` 패턴 그대로 재사용)
  - `frontend/components/learning/LearningLanding.tsx` 신규: `/learning` 랜딩(서비스 설명 +
    "학습 서비스 신청" CTA → `/learning/onboarding`). `App.tsx`에 넣지 않고 별도 파일로 분리
  - `App.tsx` 최하단에 `LEARNING_PATH`/`IS_LEARNING_INDEX` 등 라우팅 상수 추가, 기존
    `window.location.pathname` 수동 매칭 패턴 그대로 사용(React Router 미도입)

- [x] 4. 온보딩 →
  - `frontend/components/learning/LearningOnboarding.tsx` 신규: `/learning/onboarding`.
    목표 자유 입력 + 구조화 질문 4개(기간/주당일수/1회시간/수준). 매 입력마다 `sessionStorage`
    (`learningOnboardingDraft`)에 즉시 저장 → 로그인 이탈 후 재진입해도 값 유지
  - 로그인 요구는 "완료" 버튼 클릭 시에만 — 입력 자체는 비로그인으로 끝까지 가능
  - 로그인 복귀는 기존 범용 메커니즘(`App.tsx`의 `afterAuthRedirect`, `/learn` 전용 아님)을
    그대로 재사용. `goLoginTo('/learning/onboarding/plan')`으로 복귀 지점 지정

- [x] 5. 커리큘럼 생성 및 확정 →
  - `shared-api/lib/learning/curriculum.ts` 신규: `generateCurriculum()`. **기존 AI 호출
    패턴(`_genWithClaude`, CLI 구독 spawn) 그대로 사용** — 아래 "중요 발견" 참조. 정규식
    JSON 추출 + 수동 필드 캐스팅, 모듈 수 불일치 시 최대 2회 재시도
  - `shared-api/lib/learning/usage.ts` 신규: `logLearningAiUsage()` — `LcAiUsageLog`에 기록
  - `shared-api/routes/aimp/learning.ts` 신규: `POST /goals`, `PATCH /goals/:id/plan`,
    `POST /goals/:id/confirm` 3개 엔드포인트. `requireAuth` 재사용, 세션 유저ID만 신뢰
  - `shared-api/routes/aimp/index.ts`: `/api/aimp/learning` 라우트 등록
  - `frontend/components/learning/LearningPlanConfirm.tsx` 신규: `/learning/onboarding/plan`.
    로그인 복귀 시 draft로 `POST /goals` 자동 호출 → 주차별 모듈 표시 → 수정요청(1회)/확정
  - `npx tsc --noEmit`(shared-api, frontend 둘 다) 통과 + `npx vite build` 성공 + 번들에
    `learning-coach` 문자열 grep으로 실제 반영 확인

- [x] 5-보완. 묶음 B 사후 수정(사용자 지적, 2026-08-11 2차) — 아래 "묶음 B 사후 수정" 섹션 참조
- [x] 5-보완2. AI 호출 API 전환(사용자 재결정, 2026-08-11 3차) — 아래 "AI 호출 API 전환" 섹션 참조

## 진행 중

(없음 — 묶음 B + 사후 수정 완료, 사용자 지시대로 여기서 정지)

## 다음 할 일 (묶음 C — 사용자 지시 시 착수)

- 6. 대시보드 (`/learning/dashboard`)
- 7. 학습 본문 + 퀴즈 + 서버 채점
- 8. 간격 반복 + 오답 노트

## 묶음 B 사후 수정 (2026-08-11 2차, 사용자 지적 반영)

사용자가 AI 호출 방식(CLI 구독 spawn)의 사업적 위험(약관 위반 소지·한도 공유 장애·
프로세스 부하·원가 불투명)을 지적하며 Anthropic API 전환을 지시했으나, 논의 끝에
**"지금은 MVP 단계이니 API 키는 정식 서비스 전환 시점에 받고, 지금은 기존 방식 유지"**로
사용자가 최종 결정. 아래는 그 결정에 따라 실제로 반영한 변경사항.

**1. AI 호출 방식 — 철회, CLI 구독 유지(사용자 명시적 재확인)**
- `lib/learning/curriculum.ts`는 **변경하지 않음**. `_genWithClaude` 그대로 사용.
- ★단, 사용자가 지적한 4가지 위험(약관 위반 소지·구독 한도 공유로 인한 장애·프로세스
  spawn 부하·원가 불투명)은 **해소되지 않고 그대로 남아있음**. MVP 단계에서만 감수하기로
  한 것이며, **정식 서비스 전환 시 반드시 Anthropic API로 교체해야 한다.**
- ★추가로 실측 중 새로 발견한 문제 — 아래 "실측 결과" 참조.

**2. `LcGoal.planRevised` 전용 컬럼 추가 — 완료**
- `schema.prisma`에 `planRevised Boolean @default(false)` 추가, `prisma generate` 완료
- `learning-coach-ddl.sql`에 `ALTER TABLE "LcGoal" ADD COLUMN ... planRevised` 추가(★미실행 —
  이미 운영 DB에 `LcGoal`이 존재하므로 `CREATE TABLE`이 아니라 `ALTER`로 반영해야 함)
- `routes/aimp/learning.ts`의 `rawInput.startsWith('[revised]')` 판별 로직을
  `goal.planRevised` 컬럼 조회로 교체. `rawInput`에서 마커 접두사 제거

**3. JSON 필드 타입 — 문자열+Json 접미사 관례로 통일, 완료**
- `LcQuestion.choices`(Json) → `choicesJson`(String)
- `LcWeeklyReport.metrics`(Json) → `metricsJson`(String), `suggestion`(Json) → `suggestionJson`(String)
- DDL에도 `ALTER TABLE ... RENAME COLUMN` + 타입 변경 구문 추가(★미실행, 두 테이블 다 이미
  `CREATE TABLE`이 운영 DB에 실행된 상태라 컬럼명 변경은 RENAME이 필요)
- 이 필드들을 참조하는 코드는 묶음 B까지 작성되지 않아 영향받는 기존 코드 없음(확인 완료)

**4. 실측 결과 — 커리큘럼 생성 1회당 토큰·원가, 그리고 새로 발견한 타임아웃 문제**

★먼저 명확히: **정확한 토큰 수·원가는 측정 불가능합니다.** `_genWithClaude`는 CLI
구독 프로세스의 stdout 문자열만 반환하고 API 응답이 아니므로 `usage.input_tokens` 같은
필드 자체가 없습니다. 아래는 실제로 `generateCurriculum()`을 3회 호출해 얻은 실측치입니다.

| 조합 | 모듈 수 | 소요 시간 | 프롬프트 글자수 | 응답 글자수 | 결과 |
|---|---|---|---|---|---|
| 4주×3일 | 12개 | 19초 | 499자 | 1,327자 | ✅ 성공 |
| 8주×5일 | 40개 | 88초 | 496자 | 3,975자 | ✅ 성공(120초 한도에 근접) |
| 12주×5일 | 60개 | (타임아웃) | 499자 | — | ❌ **120초 초과로 실패** |

- 글자수/4 근사 토큰수: 프롬프트 약 125토큰, 응답은 모듈당 약 3.3자/토큰이라 40개
  기준 약 994토큰. `costUsd`는 로그에 항상 0으로 기록(구독제라 API 종량과금 자체가 없음).
- ★**새로 발견한 문제 — CLI 방식은 대규모 커리큘럼에서 구조적으로 실패한다.** PRD가 허용하는
  조합 중 8주×5일(40개)까지는 성공했지만 **12주×5일(60개)부터 120초 내부 타임아웃에 걸려
  실패**합니다. PRD 5장(목표 기간 4/8/12주 × 주당 일수 3/5/7일)의 최대 조합인 12주×7일(84개)은
  더 크므로 사실상 항상 실패할 것으로 추정됩니다. **이건 API 전환 여부와 무관하게 지금 코드의
  실제 결함**이며, 사용자가 결정한 "MVP는 CLI 유지"와는 별개로 묶음 C 전에 조치가 필요합니다
  (예: 타임아웃 연장, 주차 단위 분할 생성, 또는 온보딩에서 큰 조합을 안내 문구로 제한).

**5. 감당 가능 인원 계산 — API 전환 시로 유예**
- PRD 11장의 "사용자당 월 2,000원 이하" 기준은 **API 종량 과금을 전제로 한 지표**라, 구독제
  CLI 방식에는 그대로 적용할 수 없습니다(원가가 인당 금액이 아니라 "구독 계정 1개가 버틸 수
  있는 동시/누적 요청량"이라는 다른 성격의 제약이기 때문).
- 사용자 결정대로 API 미전환 상태이므로 이 계산은 **API 전환 시점으로 유예**합니다. 지금은
  대신 "구독 계정 1개가 초당 처리 가능한 요청 수 = 사실상 순차 1건씩(spawn 프로세스, 동시성
  제어 없음)"이라는 정성적 사실만 기록해둡니다 — 가입자가 늘면 대기열 지연부터 나타나고,
  이후 CLI 구독 자체의 사용량 한도(정확한 수치 비공개)에 닿으면 생성 실패가 시작될 것으로
  예상되나 정량화는 못 했습니다.

## AI 호출 API 전환 (2026-08-11 3차, 사용자 재결정)

사용자가 재검토 후 "다시 API 전환하자"고 최종 결정. "묶음 B 사후 수정"에서 남겨뒀던
위험(약관 위반 소지·구독 한도 공유 장애·프로세스 spawn 부하·원가 불투명)을 실제로 해소.

**1. Anthropic API 키 발급 및 배치**
- 사용자가 console.anthropic.com에서 신규 키 발급(이름 `ai-mp`, 만료 없음), 채팅으로 전달받아
  제가 직접 `.env`에 저장(대화 기록에는 노출하지 않음)
- `shared-api/.env`(서버1·서버2 양쪽)에 `LEARNING_ANTHROPIC_API_KEY`로 저장 — 기존
  `ANTHROPIC_API_KEY`와 별개 변수명(학습코칭 전용, 다른 기능과 충돌 방지)
- ★**부수 발견 및 정리**: 서버1의 실제 운영 `.env`(69줄)와 서버2의 로컬 사본(30줄)이
  크게 달랐다 — `.env`는 `.gitignore` 대상이라 git으로 동기화되지 않는 구조상 자연스러운
  결과. 서버1에는 구 `ANTHROPIC_API_KEY`가 **주석 없이 활성 상태**로 남아있었음(서버2
  사본에는 폐기 주석 처리됨). 실제 API 호출로 검증한 결과 **HTTP 401 "API key is invalid"**
  — 콘솔에서 이미 revoke된 죽은 키로 확인. 결제와 무관하게 사용 불가 상태임을 실측 확인
  후, 사용자 지시로 두 서버 `.env`에서 모두 삭제(죽은 키를 남겨둘 이유 없음)
- 사용자가 "예전에 계속 결제됐던 것 같다"고 우려 — 확인 결과 그 결제 이력은 **[[project_ebook_cover_duplicate_incident]]**
  (2026-07-25~26, OpenAI gpt-image-2 전자책 표지 중복생성 사고, `setInterval` 재진입 미방지,
  $5.58 결제)이며 **Anthropic과는 무관한 별도 회사·별도 계정 건**임을 확인해 안내. 이미
  07-27에 원인 수정·07-28 재검증까지 완료된 건이라 이번 Anthropic 키와는 무관
- 사용자가 $5 크레딧 충전 완료 확인 후 진행

**2. `lib/learning/curriculum.ts` — CLI spawn → Anthropic API 직접 호출로 전환**
- `_genWithClaude` 제거, `@anthropic-ai/sdk`의 `client.messages.stream()` 직접 사용
  (`claude-sonnet-5`, `output_config.format`에 JSON 스키마 지정 — structured outputs로
  정규식 추출 없이 파싱 보장)
- `max_tokens`을 모듈 수에 비례해 동적 계산(`500 + totalModules * 120`, 상한 16000) —
  대규모 커리큘럼의 응답 길이에 맞춤
- 스트리밍 사용 — CLI 방식의 120초 내부 타임아웃 문제가 실측으로 확인됐던 지점이라,
  API 자체엔 그런 제한이 없지만 SDK 기본 요청 타임아웃(10분)에 여유 있게 걸치도록 설계
- 반환값이 `promptChars`/`responseChars`(글자수 근사) → `inputTokens`/`outputTokens`
  (API `usage` 필드, 정확한 값)로 변경

**3. `lib/learning/usage.ts` — 실제 토큰수·정확한 원가 기록**
- `LcAiUsageLog.costUsd`가 더는 항상 0이 아님 — Claude Sonnet 5 가격표(도입가 $2/$10 per
  1M 토큰, 2026-08-31 이후 정가 $3/$15로 자동 전환)를 반영해 `inputTokens`/`outputTokens`
  실측치로 정확히 계산
- 다른 모델 추가 시 `calcCostUsd`의 가격표만 확장하면 되는 구조로 남김

**4. `routes/aimp/learning.ts` — 에러 처리 교체**
- `ClaudeAuthError`/`ClaudeRateLimitError`(CLI 구독 전용, `lib/gemini.ts`) →
  `Anthropic.AuthenticationError`/`Anthropic.RateLimitError`(SDK 타입 예외)로 교체
- `logLearningAiUsage` 호출부 2곳(goals 생성, plan 수정) 필드명 갱신, `model: 'sonnet'` →
  `model: 'claude-sonnet-5'`(정확한 모델 ID)

**5. 실측 검증 — 타임아웃 결함 해소 확인**

| 조합 | 모듈 수 | CLI 방식(구) | API 방식(신) |
|---|---|---|---|
| 12주×5일 | 60개 | ❌ 120초 타임아웃 실패 | ✅ **33초 성공** |
| 12주×7일(PRD 최대) | 84개 | (미시도, 60개도 실패라 자명) | ✅ **63초 성공** |

- 실측 토큰: 60모듈 — 입력 694 / 출력 3,550. 84모듈 — 입력 693 / 출력 8,203
- **PRD가 허용하는 전 조합이 이제 정상 처리됨을 확인.** 별도 조치(타임아웃 연장/분할
  생성/조합 제한) 불필요해짐 — "막힌 것" 목록의 8번 항목 해소
- `npx tsc --noEmit` 통과(에러 없음)

**6. `package.json`에 `@anthropic-ai/sdk` 추가**, `npm install` 완료(shared-api)

**7. 원가 재계산 (실측 기준)**
- 60모듈(입력 694 + 출력 3,550 토큰): 도입가 기준 약 $0.0367(≈ 51원)
- 84모듈(입력 693 + 출력 8,203 토큰): 도입가 기준 약 $0.0834(≈ 116원)
- 이전에 CLI 근사치로 추정했던 "1회당 약 17원"보다 실제로는 더 높게 나옴(모듈 수가 많을수록
  응답 토큰이 비례해 늘어나기 때문) — PRD 11장 "사용자당 월 2,000원" 기준 대비, 사용자 1인이
  월 1회 대형 커리큘럼(84모듈) + 수정요청 1회까지 감안해도 약 232원 수준으로 여유 있음.
  단, 6.2(학습 콘텐츠)·6.3(문항 생성)·6.4(질문하기)·6.5(주간 리포트) API 호출은 아직
  구현 전(묶음 C 이후)이라 전체 원가는 이후 재계산 필요

## 결정 사항

- **명명 규칙**: `Lc` 접두사 + PascalCase 모델명, camelCase 컬럼 (`LcProfile`, `LcGoal` 등).
  PRD 8장 원안(`lc_*` snake_case)에서 변경 — 기존 스키마 전체가 PascalCase라 통일성을 위해.
  사용자 확정 사항.
- **스키마 위치**: `shared-api/prisma/schema.prisma`에만 추가. `ai_mp/prisma/schema.prisma`는
  **절대 수정하지 않음** — 아래 위험 요소 참조. 사용자 확정 사항.
- **사용자 참조**: `User.id`(Int)를 FK로 참조. 신규 사용자 테이블 없음.
- **DB**: 기존 `aichat` DB에 테이블만 추가. 신규 DB 없음.
- **ORM**: 기존 Prisma 7.7.0 유지, Drizzle 미도입.
- **페르소나 기능 키**: `'learning-coach'` (기존 `'learn'`과 혼동 방지 — 아래 위험 요소 참조).
- **프레임워크**: Vite + React SPA 유지. React Router 미도입, 기존 수동 라우팅 패턴(`window.location.pathname`
  파싱)을 따름.
- **API 위치**: `shared-api`에 Express 라우트로 구현(`routes/aimp/` 하위 예상). `requireAuth` 재사용.
  `ai_mp/api/`(Vercel 서버리스 함수)는 건드리지 않음.
- **Cron**: 서버2 crontab → `shared-api`의 시크릿 헤더 보호 엔드포인트(`internal-cron.ts` 패턴) 호출.
- **[정정] `LcModule`, `LcQuestion`은 PRD 8장에 이미 있었습니다.** 이전 버전의 이 문서에
  "PRD 8장 누락을 보완했다"고 적었는데, 이는 사실과 다른 기록이었습니다 — 실제로 PRD 8장을
  다시 grep해 대조한 결과 `lc_modules`, `lc_questions`가 원문에 정확히 존재합니다(216~250행).
  10개 테이블 전부 PRD 8장과 1:1 대응하며, 추가하거나 보완한 모델은 없습니다. 문서 대조를
  제대로 하지 않고 작성한 제 오류이며, 사용자 지적으로 발견해 정정합니다.
- **ID 타입**: 학습 리소스(`LcGoal`/`LcModule`/`LcQuestion`/`LcDailyTask` 등)는 URL에 노출될 수
  있어(`/learning/task/[id]`) 기존 관례상 외부 노출 리소스에 쓰는 `cuid()` 채택.
  `LcProfile`만 `User.id`를 그대로 쓰는 1:1 PK.
- **[정정, 2026-08-11 2차] JSON 필드 타입**: 최초엔 네이티브 `Json`(Prisma)/`JSONB`(DDL)를 임의
  채택했었으나, 사용자 지시로 **기존 관례(문자열 + Json 접미사)로 통일**했습니다.
  `choicesJson`/`metricsJson`/`suggestionJson`(전부 `String`, `JSON.stringify` 저장).
- **[재정정, 2026-08-11 3차] AI 호출 방식 — 최종적으로 Anthropic API 전환 완료.**
  2차에서 "MVP는 CLI 유지"로 철회했었으나, 사용자가 재검토 후 다시 API 전환을 최종
  결정. `lib/learning/curriculum.ts`가 `@anthropic-ai/sdk`로 `claude-sonnet-5`를 직접
  호출하도록 완료. 약관 위반 소지·구독 한도 공유 장애·프로세스 spawn 부하·원가 불투명
  문제가 전부 해소됨. 상세는 아래 "AI 호출 API 전환" 섹션.
- **zod 미사용 — 유지.** API 전환 후에도 `output_config.format`(JSON 스키마 structured
  outputs)로 구조화 출력을 보장하므로 zod 검증이 별도로 필요 없음. 정규식 추출 방식(2차
  이전)에서도, structured outputs 방식(현재)에서도 zod는 불필요.
- **`LcAiUsageLog.costUsd`는 이제 실제 원가를 정확히 기록** — API 전환으로
  `usage.input_tokens`/`output_tokens`를 실제로 받아 Sonnet 5 가격표 기준 정확한 USD를
  계산. 더 이상 근사치가 아님.
- **[정정, 2026-08-11 2차] `LcGoal.planRevised` 전용 컬럼** — 최초엔 `rawInput`에 `[revised]`
  마커를 심는 방식이었으나, "나중에 그 필드를 파싱하는 곳에서 사고가 난다"는 사용자 지적으로
  전용 `Boolean` 컬럼으로 교체 완료.
- **[해소, 2026-08-11 3차] 대규모 커리큘럼 타임아웃 문제** — 2차에서 CLI 구독 spawn의
  120초 내부 타임아웃으로 12주×5일(60모듈) 이상이 실패했던 문제. API 전환 후 스트리밍+
  동적 `max_tokens`로 재설계, 실측으로 60모듈(33초)·84모듈(PRD 최대, 63초) 모두 성공
  확인. 별도 조치 불필요해짐.

## 마이그레이션 실행 완료 (2026-08-11)

- **백업**: 서버1 `~/db_backups/aichat_pre_learning_coach_20260811_132712.dump`
  (265MB, `pg_dump -Fc`, DDL 실행 직전 즉시 덤프. 매일 새벽 2시 자동 백업과 별개)
- **실행**: `docker exec n8n-docker-db-1 psql -U n8n_user -d aichat -f learning-coach-ddl.sql`
  — `CREATE TABLE` 10건 + `CREATE INDEX` 9건 전부 성공, 에러 없음
- **검증**: `pg_tables` 조회로 10개 테이블 생성 확인 — `LcAiUsageLog`, `LcAttempt`,
  `LcDailyTask`, `LcGoal`, `LcModule`, `LcProfile`, `LcQuestion`, `LcReviewItem`,
  `LcSubscription`, `LcWeeklyReport` (PRD 8장과 1:1 일치)

## 막힌 것 / 사용자 확인 필요

1. ~~JSON 필드 타입~~ → ✅ 문자열+Json 접미사 관례로 통일 완료(2026-08-11 2차).
2. **`shared-api`가 별도 git 저장소임** — `ai_mp`의 `feature/learning-coach` 브랜치와는 별개로,
   `shared-api` 저장소에도 동일 이름의 브랜치를 만들어 커밋했습니다. 두 저장소 브랜치를
   같이 관리해야 합니다. 배포 시에도 두 저장소를 각각 푸시해야 함을 유의해 주세요.
3. ~~마이그레이션 SQL 미실행~~ → ✅ 최초 10개 테이블 실행 완료. 단 이번(2026-08-11 2차) 스키마
   변경분(`planRevised` 컬럼, `choicesJson`/`metricsJson`/`suggestionJson` 컬럼명 변경)은
   **아직 미실행** — `learning-coach-ddl.sql`에 `ALTER TABLE` 구문 추가만 해둠. 사용자 지시대로
   시드·재시작과 함께 **묶음 C 완료 후 한 번에** 실행 예정.
4. **`Persona` 시드 미실행** — `seed-learning-coach-persona.js`는 파일만 작성했고 운영 DB에
   INSERT하지 않았습니다. **사용자 지시로 묶음 C 완료 후 재시작과 함께 일괄 처리** 예정.
5. **`shared-api` pm2 재시작 필요, 아직 안 함** — **사용자 지시로 묶음 C 완료 후 일괄 처리** 예정
   (지금 재시작하면 반쪽 상태로 운영 API만 끊긴다는 지적 반영).
6. ~~수정요청 1회 제한을 문자열 마커로 구현~~ → ✅ 전용 컬럼(`planRevised`)으로 교체 완료.
7. **프론트 배포 안 함** — Vercel에 push하지 않았습니다. 배포 순서(DB→shared-api→Vercel)상
   지금 배포하면 존재하지 않는 API를 프론트가 호출하게 되므로, pm2 재시작 이후에 진행해야 합니다.
8. ~~12주×5일 이상 커리큘럼 생성이 타임아웃으로 실패~~ → ✅ API 전환 + 스트리밍 재설계로
   해소. 60모듈 33초, 84모듈(PRD 최대) 63초로 실측 확인 완료(2026-08-11 3차).
9. ~~API 전환 위험이 해소되지 않고 남아있음~~ → ✅ Anthropic API 전환 완료로 해소
   (2026-08-11 3차). 단, 6.2~6.5(학습 콘텐츠·문항 생성·질문하기·주간 리포트)는 아직
   CLI 구독 방식조차 구현되지 않은 상태(묶음 C 이후) — 그 기능들을 구현할 때도 동일하게
   API 방식으로 갈지 확인 필요(일관성 유지 권장, 사용자 확인 필요).
10. **`shared-api/.env`의 구 `ANTHROPIC_API_KEY`가 revoke된 죽은 키였음을 확인, 두 서버
    모두에서 삭제 완료.** 이번 작업 중 발견한 부수 사실 — 서버1·서버2의 `.env`가 서로
    다른 버전이었다는 게 재확인됨(`.gitignore` 대상이라 git 동기화 밖). 다른 환경변수도
    두 서버 간 차이가 있을 수 있어, 추후 다른 작업 시 "서버2에서 확인했다"가 "서버1도
    같다"를 보장하지 않는다는 점 유의.

## 위험 요소 (반드시 인지할 것)

- **`ai_mp/prisma/schema.prisma`는 오래된(stale) 사본입니다.** `shared-api/prisma/schema.prisma`
  대비 `kakaoId`, `lastLoginAt`, `favoritesJson`, `favoritePersonasJson`, `referralCode` 등
  최신 필드가 빠져 있습니다. 사용자 지시로 이번 작업은 `ai_mp` 쪽을 건드리지 않았지만, 두 파일이
  싱크가 깨진 채로 존재한다는 사실 자체는 향후 다른 작업에서도 혼란을 줄 수 있어 별도 정리가
  필요할 수 있습니다(이번 작업 범위 밖).
- **`FeatureKey`에 이미 `'learn'`이 등록되어 있습니다** (`frontend/personaFeatures.ts`).
  박하진 페르소나의 "학습자료"(사이트 사용법 강의 영상+퀴즈, `shared-api/routes/aimp/learn.ts`,
  `LearnQuizRecord` 테이블)를 가리키며, 이번 "AI 학습코칭"과는 이름만 비슷한 완전히 다른 기능입니다.
  묶음 B에서 카드를 등록할 때 반드시 `'learning-coach'` 키를 새로 만들어야 하며, 절대
  `'learn'` 기존 항목을 재사용하거나 덮어쓰면 안 됩니다.
