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

## 진행 중

(없음 — 묶음 B 완료, 사용자 지시대로 여기서 정지)

## 다음 할 일 (묶음 C — 사용자 지시 시 착수)

- 6. 대시보드 (`/learning/dashboard`)
- 7. 학습 본문 + 퀴즈 + 서버 채점
- 8. 간격 반복 + 오답 노트

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
- **JSON 필드 타입**: `choices`/`metrics`/`suggestion`을 Postgres 네이티브 `Json`(Prisma)/`JSONB`(DDL)로
  채택. 기존 코드 다수는 JSON을 문자열 컬럼(`favoritesJson`처럼 `String` + Json 접미사)으로 저장하는
  관례라 이 부분은 제가 임의로 정공법(네이티브 타입)을 택한 것 — **사용자 확인 필요**(아래 참조).
- **[중요 발견] AI 호출은 Anthropic API가 아니라 claude CLI 구독 spawn** — CLAUDE.md/PRD가
  전제한 "Anthropic API"와 실제가 다름을 5단계 착수 전 실측으로 확인. `lib/gemini.ts`의
  `_genWithClaude(prompt, model)`가 `spawn('claude', ['-p', prompt, '--model', model])`로
  CLI 구독을 호출하며, `math-tutor`·전자책 등 기존 AI 기능 전부 이 방식. 문자열만 반환하고
  토큰수를 안 줌. **사용자 확인 후 기존 패턴 그대로 채택** — Anthropic API+zod 신규 도입안은
  기각(종량제 비용 실발생 + 기존과 이중 구조가 되는 문제).
- **zod 미사용** — 위와 같은 이유로 패키지 자체가 설치돼 있지 않고, 기존 AI 호출부(`lib/mathProblems.ts`
  등) 전체가 정규식 JSON 추출(`extractJsonArray`/유사 패턴) + 수동 타입 캐스팅 방식. 동일하게 통일.
- **`LcAiUsageLog.costUsd`는 항상 0** — `_genWithClaude`가 구독제 CLI 호출이라 API 종량 과금 자체가
  없음. `inputTokens`/`outputTokens`는 프롬프트·응답 글자수/4의 근사치(기존 `rag/ai_cost_guard.py`와
  동일한 근사 방식)로 기록 — 정확한 토큰 카운트가 아님을 명시.
- **`LcGoal.rawInput`에 `[revised]` 접두사로 수정 1회 제한을 판별** — 스키마에 별도 `revisionUsed`
  boolean 컬럼이 없어 최소 구현으로 문자열 마커를 씀. 재요청이 실사용되면 전용 컬럼으로 바꾸는 게
  깨끗함 — **사용자 확인 필요**(아래 참조).

## 마이그레이션 실행 완료 (2026-08-11)

- **백업**: 서버1 `~/db_backups/aichat_pre_learning_coach_20260811_132712.dump`
  (265MB, `pg_dump -Fc`, DDL 실행 직전 즉시 덤프. 매일 새벽 2시 자동 백업과 별개)
- **실행**: `docker exec n8n-docker-db-1 psql -U n8n_user -d aichat -f learning-coach-ddl.sql`
  — `CREATE TABLE` 10건 + `CREATE INDEX` 9건 전부 성공, 에러 없음
- **검증**: `pg_tables` 조회로 10개 테이블 생성 확인 — `LcAiUsageLog`, `LcAttempt`,
  `LcDailyTask`, `LcGoal`, `LcModule`, `LcProfile`, `LcQuestion`, `LcReviewItem`,
  `LcSubscription`, `LcWeeklyReport` (PRD 8장과 1:1 일치)

## 막힌 것 / 사용자 확인 필요

1. **JSON 필드 타입(Json vs 문자열 컬럼)** — 기존 관례(문자열+Json 접미사)와 다르게 네이티브 Json
   타입을 썼습니다. 기존 관례를 따르길 원하시면 `choices String`(JSON.stringify 저장)으로 되돌려야
   합니다.
2. **`shared-api`가 별도 git 저장소임** — `ai_mp`의 `feature/learning-coach` 브랜치와는 별개로,
   `shared-api` 저장소에도 동일 이름의 브랜치를 만들어 커밋했습니다. 두 저장소 브랜치를
   같이 관리해야 합니다. 배포 시에도 두 저장소를 각각 푸시해야 함을 유의해 주세요.
3. ~~**마이그레이션 SQL 미실행**~~ → ✅ 위 "마이그레이션 실행 완료" 참조.
4. **`Persona` 시드 미실행** — `seed-learning-coach-persona.js`는 파일만 작성했고 운영 DB에
   INSERT하지 않았습니다. 실행 전까지는 페르소나 카드가 실제로 뜨지 않습니다.
5. **`shared-api` pm2 재시작 필요, 아직 안 함** — 커리큘럼 API 3개(`routes/aimp/learning.ts`)는
   코드로만 존재하고, pm2를 재시작해야 반영됩니다. CLAUDE.md 규칙(재시작은 기존 API 전체를
   일시 중단시키므로 임의 실행 금지)에 따라 실행하지 않았습니다.
6. **수정요청 1회 제한을 문자열 마커로 구현** — 위 결정 사항 참조. 스키마에 전용 컬럼을 추가할지
   확인이 필요합니다.
7. **프론트 배포 안 함** — Vercel에 push하지 않았습니다. 배포 순서(DB→shared-api→Vercel)상
   지금 배포하면 존재하지 않는 API를 프론트가 호출하게 되므로, pm2 재시작 이후에 진행해야 합니다.

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
