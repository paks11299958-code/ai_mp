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
- [x] 5-보완3. 커리큘럼 생성 2단계 분할 구현(사용자 확정 안 B, 2026-08-11 6차) — 아래
  "묶음 C 구현" 섹션 참조. `LcWeekOutline` 신설, `POST /goals`→개요만/`POST /confirm`→202
  즉시응답+백그라운드 워커/`GET generation-status`→폴링/`POST retry-generation`
- [x] 6. 대시보드(`/learning/dashboard`) — 아래 "묶음 C 구현" 섹션 참조
- [x] 7. 학습 본문 + 퀴즈 + 서버 채점 — 아래 "묶음 C 구현" 섹션 참조
- [x] 8. 간격 반복 + 오답 노트 — 아래 "묶음 C 구현" 섹션 참조

## 진행 중

(없음 — 묶음 C 완료, 사용자 지시대로 9단계 이후는 착수하지 않고 여기서 정지)

## 다음 할 일 (묶음 D — 사용자 지시 시 착수)

- 9. Cron + 알림(웹 푸시 + 이메일 폴백)
- 10. 주간 리포트(6.5, 조정안 수락 시 커리큘럼 반영)

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

- **[확정, 2026-08-11 4차] 6.2~6.5도 전부 Anthropic API 사용, CLI 방식 금지.** 6.1(커리큘럼
  생성)에 이어 6.2(학습 콘텐츠)·6.3(문항 생성)·6.4(질문하기)·6.5(주간 리포트) 전부
  `@anthropic-ai/sdk` 직접 호출로 구현한다. `_genWithClaude`(CLI 구독 spawn)는 학습코칭
  어디에도 쓰지 않는다. 사용자 명시적 확정 사항 — 묶음 C 이후 6.2~6.5 구현 시 그대로 적용.
- **[재확정, 2026-08-11 6차] 모델 배분: 6.1·6.2·6.3·6.5 = Sonnet 5, 6.4(질문하기)만
  Haiku 4.5.** 5차에서 "6.4·6.5 둘 다 Haiku"로 정했었으나, 사용자가 6.5(주간 리포트)는
  Sonnet 5로 유지하기로 재확정. 6.4만 Haiku 전환 전에 **A/B 실측 비교**를 거침 — 아래
  "6.4 Haiku vs Sonnet A/B 비교" 섹션 참조. `lib/learning/usage.ts`의 `PRICE_PER_1M`에
  두 모델 단가를 모두 등록해 `logLearningAiUsage`가 모델명 기준으로 정확한 원가를 구분
  기록하도록 함(완료, 코드 변경 불필요 — 모델 선택은 호출부 책임이라 5차 코드 그대로 유효).
  6.1~6.5 실제 호출 코드는 전부 묶음 C 이후 구현 시 이 배분을 적용해야 함(코드 미작성).
- **[정정, 2026-08-11 5차] Sonnet 5 가격 — 도입가($2/$10)가 영구 확정됨.** 2026-08-10자
  Anthropic 공식 발표(anthropic.com/news/claude-sonnet-5, "Edit August 10, 2026")로 원래
  9/1 예정이던 표준가($3/$15) 인상이 취소되고 도입가가 영구화됨. 이전 버전의 `usage.ts`/
  이 문서에 있던 "2026-08-31까지 도입가, 이후 정가로 자동 전환" 로직·서술은 틀렸음 —
  `calcCostUsd`에서 날짜 분기 제거, 가격표를 모델별 고정 단가로 단순화.
  ※platform.claude.com/docs/pricing은 확인 시점에 구가격표(도입가 만료일 명시)를 여전히
  표시하고 있었음 — 공식 뉴스 발표가 더 최신 출처라 이를 채택함.
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
   (2026-08-11 3차). 6.2~6.5도 API 방식으로 확정(4차, 위 "결정 사항" 참조).
10. **`shared-api/.env`의 구 `ANTHROPIC_API_KEY`가 revoke된 죽은 키였음을 확인, 두 서버
    모두에서 삭제 완료.** 이번 작업 중 발견한 부수 사실 — 서버1·서버2의 `.env`가 서로
    다른 버전이었다는 게 재확인됨(`.gitignore` 대상이라 git 동기화 밖). 다른 환경변수도
    두 서버 간 차이가 있을 수 있어, 추후 다른 작업 시 "서버2에서 확인했다"가 "서버1도
    같다"를 보장하지 않는다는 점 유의.
11. **[신규] 생성 시간 63초(84모듈) vs PRD 목표 30초 — 미해결.** 4차 검토에서 3안(스트리밍/
    1주차 우선+백그라운드/프롬프트 축약) 비교, 백그라운드 생성(B안)을 권장했으나 **구현은
    하지 않았습니다.** 채택 여부와 착수 시점 결정이 필요합니다.
12. **[신규] 6.2 원가 추정에 불확실성이 큽니다.** 문항 생성이 6.2와 "동일 호출로 통합"되는
    구조(PRD 6.3)라 실측 없이 출력 토큰을 추정치로 보정했습니다. 6.2/6.3 실제 구현 후
    반드시 재실측이 필요합니다.

## 원가 실측 및 대응안 검토 (2026-08-11 4차, 사용자 지시 보고)

**1. LcAiUsageLog 실측** — DB에 실제로 기록해 조회한 값(추정 아님):

| 조합 | 모듈 수 | 입력 토큰 | 출력 토큰 | 원가(USD) | 원가(KRW, ₩1,400/$) |
|---|---|---|---|---|---|
| 12주×5일 | 60개 | 694 | 3,865 | $0.040038 | 약 56원 |
| 12주×7일(PRD 최대) | 84개 | 693 | 6,852 | $0.069906 | 약 98원 |

모델: `claude-sonnet-5`(도입가 입력 $2/출력 $10 per 1M, 2026-08-31까지)

★**실측 도중 별개 결함 발견 — DB 권한 누락.** `Lc*` 테이블 10개 전부 소유자가
`n8n_user`(DDL 실행 시 접속 계정)로 생성됐는데, `shared-api`의 실제 운영 접속 계정은
`aichat_user`. 즉 **`묶음 B`에서 만든 API 3개(`POST /goals` 등)는 이제껏 한 번도 정상
작동할 수 없는 상태**였음(`permission denied for table LcAiUsageLog` 등). `generateCurriculum()`
단독 호출 테스트만 해서 이전엔 발견 못 함(그 함수는 DB에 안 닿음). 서버1에서
`GRANT ALL PRIVILEGES ON <Lc* 10개> TO aichat_user;` 실행해 즉시 해결, 재검증 완료
(위 표의 값이 그 검증 실측치). ★향후 새 테이블 생성 시 **DDL 실행 계정과 앱 접속
계정이 다르면 매번 이 문제가 재발함** — DDL에 GRANT 구문을 기본 포함하는 관례 검토 필요.

**2. 월 원가 추정 (8주=40모듈, 주5일 학습, 6.2~6.5는 가정치)**

| 항목 | 월 빈도 | 산정 근거 | 월 원가 |
|---|---|---|---|
| 6.1 커리큘럼(+수정 1회) | 2회 | 40모듈 실측 비례 근사(입력500·출력2,500/회) | $0.052 |
| 6.2+6.3(문항 통합) | 20회(모듈당) | PRD 분량 기준 입력300·출력1,400(문항 보정 포함)/회 | $0.292 |
| 6.4 질문하기 | 100회(상한 200의 절반 가정) | 입력400(컨텍스트 포함)·출력200/회 | $0.280 |
| 6.5 주간 리포트 | 4회 | 입력300·출력400/회 | $0.018 |
| **합계** | | | **약 $0.64(약 900원)** |

- **PRD 11장 기준(월 2,000원 이하) 충족** — 약 45% 수준
- 비중: 6.2+6.3 약 46%, 6.4 약 44%가 대부분 — 6.4를 상한(하루10회)까지 꽉 채우고
  12주(60모듈) 이상 장기 사용하면 약 1,820원까지 근접(여유 있으나 넉넉하지 않음).
  **6.2/6.3 실제 구현 후 재실측 필수** — 지금은 가정치.

**3. 생성 시간 대응안 검토(구현 안 함)**

- **A. 스트리밍 순차 노출**: `curriculum.ts`가 이미 스트리밍을 쓰지만 `output_config.format`
  (JSON 스키마)이라 부분 파싱이 어려움. API 계약·프론트 상태관리 재설계 필요. 효과 최대,
  비용 최대.
- **B. 1주차 우선 확정 + 백그라운드 나머지 생성**: `EbookProject`/`MathProblemSet` 등
  기존 "pending→워커→폴링" 패턴과 부합, 구현 비용 중간. 단 PRD 6.1의 "1주차부터 순서대로
  난이도 상승" 전제가 깨져 프롬프트 재설계 필요(연속성 리스크).
- **C. 프롬프트 축약**: 이미 충분히 축약된 상태(모듈당 title+objective만)라 추가 절감
  여지 작음. 속도 병목이 토큰량보다 모델 생성 속도로 추정되어 30초 목표 달성 불확실.
  UX 정보 손실도 있어 비추천.
- **의견**: **B안 권장** — 기존 패턴과 정합성이 가장 높고 온보딩 이탈 문제를 구조적으로
  제거. A안은 효과는 크지만 비용이 큼. C안은 비추천.

## 5차 처리 (2026-08-11, 사용자 지시 4건)

**1. 가격 전제 수정 — 완료.** 위 "결정 사항" 참조. `lib/learning/usage.ts`의 `calcCostUsd`에서
날짜 분기(`INTRO_PRICE_END`) 제거, `PRICE_PER_1M`을 모델별 고정 단가 맵으로 단순화.

**2. DB 소유권 근본 수정 — 완료.**
- `ALTER TABLE "Lc*" OWNER TO aichat_user;` 10개 전부 실행 완료(서버1, `n8n_user`로 접속해
  실행 — 소유권 이전은 현재 소유자 또는 슈퍼유저만 가능). `pg_tables` 재조회로 10개 전부
  `aichat_user` 소유 확인.
- `ALTER DEFAULT PRIVILEGES FOR ROLE aichat_user IN SCHEMA public GRANT ALL ON TABLES/SEQUENCES
  TO aichat_user;` 실행 완료. ★단 이 설정은 **"aichat_user가 만든 향후 객체"에만 적용**되고,
  "다른 계정이 실수로 만든 테이블"까지 자동으로 커버하지 못하는 PostgreSQL의 근본 한계가
  있음 — `ALTER DEFAULT PRIVILEGES`는 객체를 만드는 주체(role) 기준이지 대상 기준이 아님.
  진짜 재발 방지는 **DDL 실행 계정을 매번 올바르게 쓰는 것**뿐.
- **원인 확인**: `learning-coach-ddl.sql` 파일 자체 4번째 줄에 이미
  `psql -U aichat_user -d aichat -f learning-coach-ddl.sql`로 실행하라고 명시돼 있었음.
  그런데 묶음 A 실행 시 실제로는 `docker exec n8n-docker-db-1 psql -U n8n_user -d aichat -f ...`
  (다른 계정)로 실행됨 — **DDL 파일 자체의 지시를 따르지 않은 실행 실수**였음이 확인됨.
- **★재발 방지 절차(명문화)**: 이후 이 프로젝트에서 DDL을 서버1 운영 DB에 실행할 때는
  1) 실행 전 DDL 파일 상단 주석의 `psql -U <계정>` 지정을 반드시 확인
  2) 지정된 계정이 없으면 **`aichat_user`를 기본값으로** 사용(이 DB의 애플리케이션 계정)
  3) 실행 직후 `SELECT tablename, tableowner FROM pg_tables WHERE tablename IN (...)`로
     소유자가 `aichat_user`인지 즉시 검증 — "테이블이 생성됐다"만으로 완료 판정하지 않는다
  4) `docker exec ... psql -U n8n_user`처럼 편의상 다른 계정으로 접속해 실행하는 습관을
     경계할 것(이번 사고의 직접 원인)

**3. 모델 배분 확정(6차 재확정) + A/B 실측 + 원가 재계산 — 완료.**

5차에서 "6.4·6.5 둘 다 Haiku"로 정했으나, 사용자가 6.5(주간 리포트)는 Sonnet 5 유지로
재확정. 6.4(질문하기)만 Haiku 전환 — 단, 전환 전에 실측 A/B 비교를 거침(구현 아님, 검증):

**6.4 Haiku vs Sonnet A/B 비교 실측(1차)** — 정보처리기사 "데이터베이스 정규화" 단원
(PRD 6.2 분량 기준 학습 본문, 약 1,200자)을 시스템 프롬프트로 주입하고, 동일 질문 4개를
두 모델에 동시 전송해 비교(`max_tokens=500` 동일 조건):

| 질문 | Haiku 4.5 | Sonnet 5 |
|---|---|---|
| 2NF/3NF 차이 요약 | 정확, 완결(59토큰, 1.3초) | 정확, 완결(104토큰, 3.4초) |
| 부분 함수 종속 예시 | 정확, 표 포함, 500토큰서 절단(4.0초) | 정확, 500토큰서 절단(7.9초) |
| BCNF가 3NF보다 엄격한 이유 | 정확, 반례까지 포함, 완결(7.0초) | 정확하나 500토큰서 절단(7.9초) |
| 과도한 정규화 단점 | 정확, OLTP/OLAP 구분 포함, 완결(4.9초) | 정확, 500토큰서 절단(8.5초) |

**[정정] 1차 결론의 채택 근거 오류** — 최초엔 "Haiku가 더 잘 마무리한다(완결성 우위)"를
Haiku 채택의 근거 중 하나로 잘못 기록했음. 사용자 지적으로 재검토한 결과, 이는 **품질
차이가 아니라 `max_tokens=500`이라는 공통 제약 아래서 Haiku가 우연히 더 짧게 답해
생긴 부수 효과**였음(8개 응답 중 4개가 문장 중간 절단 — 두 모델 모두 발생, 값의 우열
문제가 아니라 한도 부족 문제). 완결성 관찰은 채택 근거에서 **제외**.

**`max_tokens` 상향 — 500→800.** 절단이 재발하지 않도록 6.4 질문하기의 `max_tokens`를
800으로 올림. 이 파라미터 상한 자체는 과금과 무관(실제 소비 토큰만 과금)하므로, 원가에
영향을 주는 건 "한도"가 아니라 "예상 실사용 출력량"의 증가 — 5차 추정(200토큰) 대비
6차 추정(320토큰, 2차 재검증 실측 93~514토큰 범위를 반영해 상향)으로 **120토큰 증분**을
반영. 아래 "원가 차액 근거"에서 정확한 금액 산출.

**재검증(2차, `max_tokens=800`)** — 동일 학습 본문·동일 질문 4개를 Haiku 4.5로만 재실행:

| 질문 | 출력 토큰 | `stop_reason` | 소요 시간 |
|---|---|---|---|
| 2NF/3NF 차이 요약 | 93 | `end_turn` | 2.3초 |
| 부분 함수 종속 예시 | 514 | `end_turn` | 4.7초 |
| BCNF가 3NF보다 엄격한 이유 | 428 | `end_turn` | 5.8초 |
| 과도한 정규화 단점 | 495 | `end_turn` | 6.1초 |

**4개 전부 절단 없이 완결(`end_turn`).** 최대 출력이 514토큰이라 800 한도에 충분한
여유 확인.

**최종 채택 근거(수정)**: 6.4를 Haiku 4.5로 배분하는 근거는 **속도**(1차 실측 기준
Haiku 평균 4.3초 vs Sonnet 평균 6.9초)와 **원가**(출력 단가 $5 vs $10, 정확히 절반)
**두 가지로 한정**한다. 정확성은 1차 실측에서 4문항 전부 두 모델 동등(오답 없음)했으나
이는 "품질이 대등하다"는 확인일 뿐 Haiku 채택의 적극적 근거는 아님. 표본이 1개 학습
단원·설명형 질문 4개로 작아 일반화엔 한계가 있음을 유지.

**재계산 월 원가** (8주=40모듈, 주5일, 6.2~6.5 가정치는 기존과 동일 — 6.4만 모델+토큰량 변경.
출력 200→320토큰으로 갱신, 2차 실측 평균(93~514, 중앙값 부근)을 반영한 보수적 근사):

| 항목 | 모델 | 월 원가(Sonnet 5 전체 기준) | 월 원가(최종 배분) |
|---|---|---|---|
| 6.1 커리큘럼 | Sonnet 5 | $0.052 | $0.052 (변동 없음) |
| 6.2+6.3 콘텐츠+문항 | Sonnet 5 | $0.292 | $0.292 (변동 없음) |
| 6.4 질문하기(입력400·출력320, 100회) | **Haiku 4.5** | $0.280 | **$0.200** |
| 6.5 주간 리포트 | Sonnet 5(유지) | $0.018 | $0.0184 (변동 없음) |
| **합계** | | **약 $0.64(약 900원)** | **약 $0.5624(약 787원)** |

- **약 13% 절감(113원)** vs Sonnet 5 전체 사용 시. PRD 2,000원 기준 대비 여유가
  45%→약 61%로 개선.
- 6.4 상한(하루10회) 완전 소진+12주 장기사용 최악 케이스는 약 1,700원 수준. 6.2/6.3
  실측 전까지는 여전히 가정치 기반.

**[정정] 원가 차액 근거 — 703원(5차) → 787원(6차), 차액 84원의 항목별 출처**

사용자가 "500→800 상향은 약 40원 증가"로 예상했는데 실측 재계산 결과 84원으로
나와, 정확한 산출 근거를 명시합니다.

- **차액 84원은 전액 6.4 항목(질문하기)에서만 발생**합니다. 6.1(커리큘럼)·6.2+6.3(콘텐츠+
  문항)·6.5(주간 리포트)는 5차→6차 사이 변경이 전혀 없어 $0.052/$0.292/$0.0184로 동일.
- **원인은 "`max_tokens` 500→800 파라미터 변경" 자체가 아니라 "예상 실사용 출력량
  추정치를 200토큰→320토큰으로 올려 잡은 것"** — `max_tokens`는 상한일 뿐 과금은
  실제 소비 토큰 기준이라, 파라미터 숫자를 올린다고 그 자체로 비용이 느는 게 아닙니다.
  다만 절단(2차 실측 이전 문제)을 피하려면 여유 있는 응답을 전제해야 하므로, 원가 추정용
  "예상 출력 토큰"도 200→320으로 같이 올린 것입니다.
- **정확한 계산**: 출력 증분 (320−200)=120토큰 × 월 100회 × Haiku 출력단가 $5/1M
  = 12,000토큰 × $5/1,000,000 = **$0.06 = 약 84원**(₩1,400/$ 환산). 사용자가 예상하신
  "약 40원"은 어림치였고, 정밀 계산값은 84원이 맞습니다 — 이 문서를 84원 기준으로 정정.

**4. 커리큘럼 생성 2단계 분할 — 설계만, 구현 안 함**

B안(백그라운드 생성)을 사용자 제안대로 3단계로 재설계.

- **1단계 — 주차 개요 생성**: `POST /api/aimp/learning/goals`가 지금처럼 전체 모듈이 아니라
  **주차별 제목 + 주제 한 줄만** 생성(예: 12주 → 12개 항목, 84개 모듈 아님). 출력 토큰
  대폭 축소(60~84개 모듈 상세 대비 1/5~1/7 수준 예상) → 목표 응답시간 10초 이내.
  `LcGoal`을 생성하되 `LcModule`은 아직 만들지 않고, 대신 주차 개요를 담을 필드/테이블 필요.
- **2단계 — 개요 확인·수정·확정**: `LearningPlanConfirm.tsx` 화면이 지금처럼 모듈 60~84개가
  아니라 **주차 12개**만 보여줌(정보량 대폭 축소, 실제로 사용자가 판단하는 단위와 일치).
  `PATCH /goals/:id/plan`(수정요청 1회)도 이 개요 단계에서만 허용 — 63초 재대기 없이
  수정 가능해짐. `POST /goals/:id/confirm` 시점에 확정.
- **3단계 — 모듈 상세 백그라운드 생성**: 확정 직후 `LcModule` 상세(현재의 title+objective)를
  기존 `EbookProject`/`MathProblemSet` 패턴과 동일하게 pending→워커(크론 또는 즉시 트리거)→
  프론트 폴링으로 채움. `LcDailyTask` 배정은 모듈 상세가 다 채워진 뒤에 수행하거나, 개요
  단계의 주차 수만으로 날짜만 먼저 배정하고 모듈 연결은 나중에 채우는 방식 중 선택 필요
  (사용자 확인 필요 — 아래 참조).

**스키마 변경(DDL만 작성, 미실행)**

`LcGoal`에 주차 개요를 담을 곳이 필요. 두 가지 안 중 검토:
- **안 A**: `LcModule`에 `status`가 이미 `pending|open|done`으로 있으므로, 1단계에서
  `LcModule`을 주차당 1행씩(`orderNo`는 미정/0, `status: 'pending'`, `title`=주차 제목,
  `objective`=주제 한 줄)으로 만들고, 3단계 워커가 이 행들을 실제 일별 모듈로 **치환**.
  단 "주차 단위 개요"와 "일별 모듈 상세"가 스키마상 같은 테이블·다른 그레인이라 헷갈릴 수 있음.
- **안 B(권장)**: 별도 `LcWeekOutline` 테이블 신설(`goalId`, `weekNo`, `title`, `theme`) —
  1~2단계는 이 테이블만 다루고, 3단계 워커가 `LcModule`(기존 그대로, 일별 그레인)을 채움.
  개념적으로 명확하고 기존 `LcModule` 구조를 변경하지 않아도 됨.

```sql
-- (참고용 초안, ★미실행 — 사용자 확인 후 실제 DDL 작성)
CREATE TABLE IF NOT EXISTS "LcWeekOutline" (
    id          TEXT PRIMARY KEY,
    "goalId"    TEXT NOT NULL REFERENCES "LcGoal"(id) ON DELETE CASCADE,
    "weekNo"    INTEGER NOT NULL,
    title       VARCHAR(30) NOT NULL,
    theme       VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "LcWeekOutline_goalId_idx" ON "LcWeekOutline"("goalId");
```

**EbookProject 실제 패턴 확인 완료**: 등록 즉시 `202` 반환(예: `POST /:id/generate-images-queue`가
큐 행만 `'queued'` 상태로 만들고 즉시 응답) → 실제 처리는 **shared-api 내부 비동기가 아니라
서버2 crontab이 서버1의 `POST /internal-cron/ebook-image-slot-worker`(시크릿 헤더 보호
엔드포인트)를 주기 호출**해서 수행. 프론트는 `GET /:id/image-queue-status`로 폴링. 3단계도
동일 패턴이 기존 관례와 가장 정합적 — `internal-cron.ts`에 유사 엔드포인트를 추가하고
서버2 crontab에 등록하는 방식.

**사용자 확인 필요 (착수 전)**
1. 안 A/안 B 중 선택
2. `LcDailyTask`(일별 배정) 시점 — 3단계(모듈 상세) 완료를 기다렸다가 한 번에 배정할지,
   개요 단계에서 날짜만 먼저 예약해두고 모듈 연결은 나중에 채울지

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

## 묶음 C 구현 (2026-08-11 6~7차, 사용자 확정 반영)

사용자 지시("안 B 채택 + 생성 중 상태 처리 + 원가 787원 통일 + 묶음 C를 2단계 분할 설계
반영해 구현, 9단계 이후 금지")에 따라 진행. `shared-api` 커밋 `6a63dad`, `ai_mp` 커밋 `ff03d51`.

**1. 커리큘럼 생성 2단계 분할 — 실제 구현(설계에서 실행으로 전환)**

- `shared-api/prisma/schema.prisma`: `LcWeekOutline` 모델 신설(`goalId`, `weekNo`, `title`,
  `theme`), `LcGoal.status`에 `outline_ready`/`confirmed_generating`/
  `confirmed_generation_failed` 3개 상태 추가, `LcGoal.planRevised`(수정요청 1회 제한 전용
  컬럼), `LcModule`에 `generationFailedAt`/`generationError`/`retryCount` 추가(재시도
  워커용). `learning-coach-ddl.sql`에 전부 반영 후 **운영 DB(서버1 aichat)에 실제 실행
  완료**(`aichat_user` 계정으로, 재발방지 절차 준수). 11개 테이블 전부 소유자 확인 완료.
  - DDL 작성 중 컬럼 추가보다 인덱스 생성 구문이 먼저 배치된 순서 버그 발견
    (`ERROR: column "generationFailedAt" does not exist`) → 실패 지점 진단 후 수동 재실행으로
    복구, DDL 파일 자체도 순서 수정 + 주석으로 이력 기록.
- `shared-api/lib/learning/curriculum.ts`: `generateWeekOutlines()`(1단계, 주차 개요만,
  `maxTokens = min(4000, 300+주×60)`)와 `generateModuleDetail()`(3단계, 주차 1개의 일별
  모듈 상세, `maxTokens = min(4000, 300+일수×150)`)로 완전 분리.
- `shared-api/routes/aimp/learning.ts`: `POST /goals`(1단계, `LcGoal`+`weekOutlines` 생성,
  status=`outline_ready`) / `PATCH /goals/:id/plan`(2단계 수정 1회, `planRevised` 컬럼으로
  판별) / `POST /goals/:id/confirm`(3단계 착수, status=`confirmed_generating` 전환 후 **즉시
  202 반환**, 실제 생성은 기다리지 않음) / `GET /goals/:id/generation-status`(신규, 폴링용
  — totalWeeks/generatedWeeks/progressPercent/hasFailure/failedWeeks) / `POST
  /goals/:id/retry-generation`(신규, 실패분 재시도).
- `shared-api/lib/learning/moduleWorker.ts`(신규): `triggerModuleGeneration()` — 상태만
  세팅하고 반환(no-op). 실제 처리는 서버2 crontab이 아래 워커 엔드포인트를 폴링 호출.
- `shared-api/routes/aimp/workers/learning-module.ts`(신규): `POST
  /internal-cron/learning-module-worker` — `confirmed_generating` 상태 목표를 조회해
  주차 1개씩(`WEEKS_PER_TICK=1`) `generateModuleDetail()` 호출, 성공 시 `LcModule.createMany`,
  실패 시 `orderNo=0` 실패 마커 생성/갱신(`retryCount` 3회 초과 시
  `confirmed_generation_failed`). **모든 주차 완료 시에만** `finalizeGoal()`이
  `LcDailyTask`를 `$transaction`으로 일괄 배정 + status=`active` 전환(부분 완료 상태에서는
  생성하지 않음 — "빈 task가 먼저 생기면 대시보드 첫인상이 깨진다"는 사용자 지적 반영).
  `POST /learning-module-worker/clear-failure`(재시도 전 실패 마커 삭제)도 함께 구현.
  `internal-cron.ts`에 `router.use(learningModuleWorker)` 등록 완료. **서버2 crontab 등록은
  미완료**(코드만 배포됨, 실제 주기 호출 설정은 다음 세션 확인 필요).

**2. 생성 중 상태 처리 (사용자 지시 3번 — 신규 화면)**

- `ai_mp/frontend/components/learning/LearningGenerationProgress.tsx`(신규): `confirm` 202
  응답 직후 렌더. `GET generation-status`를 4초 간격으로 폴링, 진행률 바(%) + "N/M주차 완료"
  안내 + "완료되면 자동으로 대시보드로 이동합니다" 문구로 확정 직후 빈 화면을 방지. 실패
  상태(`confirmed_generation_failed`)면 스피너 대신 재시도 버튼 노출, 클릭 시
  `POST retry-generation` 호출 후 폴링 재개.
- `LearningPlanConfirm.tsx`: 기존 구조(전체 모듈 배열 표시, confirm 동기 완료 응답 전제)를
  새 구조(`weekOutlines` 배열만 표시, confirm 202 수신 시 `LearningGenerationProgress`로
  전환)에 맞게 전면 재작성.

**3. 대시보드(6단계, S4)**

- `shared-api/routes/aimp/learning.ts`: `GET /today` 신규 — `LcProfile.streak`,
  오늘자 `LcDailyTask`(모듈 정보 포함), 복습 대기 수(`LcReviewItem` 중 `dueDate<=오늘`,
  최대 5개로 클램프), `status=active`인 목표의 진도율(완료 태스크수/전체 모듈수)을 한 번에 반환.
- `ai_mp/frontend/components/learning/LearningDashboard.tsx`(신규): 연속일/진도율 카드,
  진도 바, 복습 배지(있을 때만 노출, `/learning/review`로 연결), 오늘의 학습 카드
  (`/learning/task/:taskId?m=:moduleId`로 이동).

**4. 학습 본문 + 퀴즈 + 서버 채점(7단계, S5~S7, PRD 6.2+6.3)**

- `curriculum.ts`에 `generateModuleContent()` 추가 — PRD 6.3 "6.2와 동일 호출에 통합하여
  1회로 처리" 요구대로 학습 본문(마크다운)과 4지선다 3~5문항을 **한 번의 API 호출**로 함께
  생성. 분량은 `minutesPerSession`(15/30/60분)에 따라 600자/1200자/2000자 목표로 프롬프트에
  명시. 문항 검증: 선택지 정확히 4개, `answer`가 `choices` 안에 포함되는지 확인 후 실패 시
  재시도(`MAX_RETRY=2`, 기존 패턴 재사용).
- `GET /modules/:id`: `contentMd`가 이미 있으면 **재생성 없이 캐시 반환**(PRD 11장 비용
  통제 정책 1번 준수). 없으면 생성 후 `$transaction`으로 `LcModule.update` +
  `LcQuestion.createMany` 저장.
- `POST /quiz/:taskId/submit`: 채점은 **서버 문자열 비교만**, AI 호출 없음(PRD 6.3/11장
  정책 2번). 오답은 `LcReviewItem` 신규 생성(간격 반복 초기값), 이미 있던 복습 문항은
  정답/오답에 따라 간격 반복 공식 적용. 오늘 첫 완료 시에만 `streak` 갱신(어제 완료 여부로
  연속 판정).
- `ai_mp/frontend/components/learning/LearningTask.tsx`(신규): S5(본문)+S6(퀴즈)+S7(결과)를
  **하나의 컴포넌트 내부 단계 전환**으로 구현(별도 라우트 3개로 쪼개면 새로고침 시
  sessionStorage 없이는 퀴즈 진행 상태가 유지되지 않는 문제를 피하기 위함). 대시보드가
  `/learning/task/:taskId?m=:moduleId` 형태로 이동시킴 — `taskId`(퀴즈 제출용,
  `LcDailyTask.id`)와 `moduleId`(본문 조회용, `LcModule.id`)가 서로 다른 식별자라 둘 다
  전달 필요(경로 파라미터+쿼리스트링으로 분리).

**5. 간격 반복(SM-2 단순화) + 오답 노트(8단계, S8, PRD 7장)**

- `shared-api/lib/learning/spacedRepetition.ts`(신규): `initReviewItem()`(interval=1,
  ease=2.5), `applyReview()`(정답: interval=round(interval×ease), ease+=0.1 최대 3.0 /
  오답: interval=1, ease-=0.2 최소 1.3, interval>60일이면 state='mastered'),
  `nextDueDate()`. PRD 7장 공식 그대로, **외부 라이브러리 미사용**.
  `POST /quiz/:taskId/submit`의 채점 로직에서 이 모듈을 호출해 `LcReviewItem`을 갱신하는
  공용 헬퍼 `scoreAnswers()`로 추출(오늘의 학습 제출과 복습 제출이 동일 로직 공유).
- `GET /review`: `state='active'` && `dueDate<=오늘`인 항목을 `dueDate` 오름차순 최대 5개
  (하루 최대 5개 배정, PRD 7장) 반환.
- `POST /review/:reviewItemId/submit`(신규, 전용 엔드포인트): 처음에는 오답 노트 제출을
  `POST /quiz/:taskId/submit`에 얹으려 했으나, 복습 문항은 `LcDailyTask`가 없어 taskId가
  존재하지 않는 문제를 발견 → `scoreAnswers()`를 공용 함수로 뽑아 별도 엔드포인트로 분리.
  이 엔드포인트가 없으면 오답 노트에서 재응시해도 간격 반복이 갱신되지 않는 결함이 됐을 것.
- `ai_mp/frontend/components/learning/LearningReview.tsx`(신규): 복습 문항을 카드로 나열,
  선택지 클릭 시 즉시 정답 표시(비활성화) + `POST /review/:id/submit` 호출로 서버 간격
  반복 갱신.

**6. 라우트 등록 + 검증**

- `App.tsx`: `IS_LEARNING_DASHBOARD`(`/learning/dashboard`), `IS_LEARNING_TASK`
  (`/learning/task/:id`), `IS_LEARNING_REVIEW`(`/learning/review`) 3개 추가.
- `shared-api`: `npx tsc --noEmit` 통과(에러 0). `ai_mp/frontend`: `vite build` 통과(2134
  모듈), `npm run check`(훅 순서/옵셔널 접근/기능키 정합성, 123개 파일) 통과.

**미완료 / 다음 세션 확인 필요(당시 기준 — 아래 통합검증에서 전부 해소)**

- 서버2 crontab에 `learning-module-worker` 엔드포인트 주기 호출 등록 — 코드는 배포됐으나
  실제 크론 등록 여부 미확인.
- 실제 운영 환경에서 온보딩→확정→대시보드→학습→퀴즈→오답노트 E2E 왕복 미실시(로컬
  타입체크/빌드까지만 검증).
- 9단계(Cron+알림) 이후는 사용자 지시대로 착수하지 않음.

## 묶음 D 이전 통합검증 (2026-08-11 8차, 사용자 지시)

사용자 지시("묶음 D로 넘어가기 전에 통합 검증을 수행한다. 새 기능은 추가하지 마라")에
따라 배포·crontab 등록·E2E 왕복·원가 실측·회귀 확인을 수행. shared-api 배포 커밋
`c2d7054`(main 머지)→`15f8c9a`(결함 수정), ai_mp `c308442`(master 머지, Vercel 자동 반영).

**1. 배포**

- shared-api: `feature/learning-coach`(6개 커밋)를 `main`으로 fast-forward 머지 후 push.
  이 과정에서 origin/main이 별도 세션 작업(포인트 부족 안내 확대 등, 3개 커밋)으로 이미
  앞서 있어 실제로는 3-way merge가 됐음 — 학습코칭 파일에는 diff 없음(충돌 없이 병합)을
  확인 후 진행. **서버1 자동배포(1분 주기 pull+tsc+pm2 reload)가 이미 가동 중**이라는 사실을
  work_index.md에서 재확인하고 이 경로로 배포(수동 SSH 배포 대신). 배포 로그로 커밋 반영
  확인(`배포 완료: c2d7054`), 실제 라우트 401 응답(인증 게이트 정상)으로 실동작 검증.
  ★app/learning/CLAUDE.md의 "서버2 crontab이 호출한다"는 서술은 부정확 — 실제로는
  **서버1 자체 crontab**이 `localhost:3020`을 호출하는 구조(기존 stock-worker 등과 동일
  패턴)임을 work_index.md·실제 crontab -l로 확인. 이후 서술은 이 문서를 신뢰하지 않고
  실측을 우선함.
- ai_mp: `master`가 origin과 완전 동기화 상태라 `feature/learning-coach`를 깨끗한
  fast-forward로 병합 후 push. Vercel이 Production Branch=master라 자동 반영, `★운영중
  READY`로 확인. ★단, **이 세션(서버2) IP가 Vercel Security Checkpoint에 차단된 상태**라
  curl·Playwright 모두 403이 나옴(2026-08-11 앞선 커밋에서 이미 "실제 장애 아님, 배포검증
  반복접속 때문"으로 확인된 이슈). 화면이 실제로 정상 렌더링되는지는 **이번 세션에서
  브라우저로 직접 확인하지 못함** — 사용자에게 미검증임을 명시하고 API 레벨 검증으로 대체
  진행하기로 확인받음. 서버1에도 Playwright 미설치(운영 서버라 정상).
- Persona 시드는 지시대로 미실행 유지 — 카드가 노출되지 않으므로 일반 사용자가 이
  기능에 진입할 경로가 없는 상태(URL을 직접 아는 경우만 `/learning` 접근 가능).

**2. 서버1 crontab에 워커 등록**

기존 6개 워커(`stock-worker` 등)와 동일한 패턴으로 1분 주기 등록:

```
* * * * * curl -sf -m 55 -X POST -o /dev/null http://localhost:3020/api/aimp/internal-cron/learning-module-worker || echo "$(date '+%F %T') learning-module-worker FAIL" >> /home/paks11299958/aimp-cron.log
```

등록 전 `crontab -l`을 `/tmp/crontab_backup_*.txt`로 백업. 직접 curl로 워커 엔드포인트
정상 응답(`{"processedGoals":0,"processedWeeks":0}`, 당시 대상 없음) 확인.

**3. E2E 왕복 검증(API 레벨) — 테스트 계정 2개(id 275/276, 종료 후 삭제)**

| 단계 | 결과 |
|---|---|
| 목표 생성(1단계, 주차 개요) | ✅ 4주/8주 각각 성공. **8주 8.4초**(목표 10초 이내 충족) |
| 확정(3단계 착수) | ✅ 즉시 `202 {"status":"confirmed_generating"}` |
| generation-status 폴링 | ✅ 20초 간격 폴링으로 진행률 0→25→50→75→100% 정상 증가 관측 |
| 모듈 전체 완료 후 LcDailyTask 일괄 배정 | ✅ 4주=20건, 8주=40건, 각 5개/주 정확 배정, status→active |
| 대시보드(today) | ✅ 오늘의 학습 1건, streak, 목표 진도율 정상 반환 |
| 모듈 열람(본문+퀴즈 생성) | ✅ 본문 821자(30분 목표 1200자 근사), 문항 5개(3~5 범위) |
| 동일 모듈 재조회 | ✅ 0.89초(DB 캐시), `contentGeneratedAt` 불변 — **재생성 안 함 확인(비용 통제 핵심)** |
| 퀴즈 제출·서버 채점 | ✅ AI 호출 없이 문자열 비교로 채점, 정답 2/5·40점·문항별 해설 정상 |
| 오답 → LcReviewItem 적재 | ✅ 오답 3건 정확히 적재, 초기값 `interval=1, ease=2.5` |
| 오답노트 재응시 → 간격 반복 갱신 | ✅ **PRD 7장 공식과 정확히 일치**(아래 상세) |
| 타 사용자 리소스 접근 차단 | ✅ B가 A의 goal에 대해 generation-status/confirm/plan/retry 전부 `404`, 무토큰 `401` |

간격 반복 실측(SM-2 단순화, PRD 7장):
- 정답 케이스: `interval=1×2.5=round(2.5)=3`, `ease=2.5+0.1=2.6` — 공식과 정확히 일치
- 오답 재케이스: `interval=1`, `ease=2.5-0.2=2.3` — 공식과 정확히 일치

**4. 검증 중 실제 결함 발견 → 원인 수정 → 재검증**

`learning-module-worker`에 **동시 실행 방지 락이 없는** 구조적 결함을 발견. 검증을 위해
수동으로 워커를 호출한 시점이 정규 크론 1분 틱과 261ms 간격으로 겹치면서, 같은 목표의
3주차가 서로 다른 제목으로 두 번 생성됨(정상 5개 모듈 → 10개로 중복). 그 결과
`LcDailyTask`도 25건(정상 20건) 배정된 채 `status=active`까지 완료되는 것을 실측 확인 —
운영에서도 AI 응답 지연이나 여러 목표 동시 처리 시 재현 가능한 문제.

수정(커밋 `15f8c9a`):
- `LcModule`에 `(goalId, weekNo, orderNo)` 유니크 제약 추가
- 워커가 AI 호출(비용 발생) **전에** 락 행(`orderNo=-1`)을 원자적으로 먼저 INSERT. 유니크
  위반 시 다른 워커가 이미 처리 중이라는 뜻이므로 AI를 호출하지 않고 건너뜀 — 데이터
  중복뿐 아니라 **AI 비용 중복 호출도 함께 방지**
- 워커의 `generatedWeekNos` 집계·`generation-status`의 진행률 집계 모두 락 행을 완료로
  오인하지 않도록 `orderNo>=0`만 카운트하도록 수정
- DDL에 중복 정리(늦게 생성된 쪽 삭제, cascade로 LcDailyTask도 함께 정리)+유니크 제약
  추가 구문을 반영해 운영 DB(aichat) 실행, 결과 검증(계정 275: 4주 모두 5개씩=20모듈,
  LcDailyTask 20건으로 복구)
- 수정본 배포 후 8주 목표(계정 276)에서도 8주 전부 정확히 5개씩, 중복 없이 완료 확인 —
  재발 없음을 실측으로 재확인

**5. LcAiUsageLog 실측 원가(온보딩~1일차 완주 기준)**

계정 275(4주 커리큘럼)의 실제 호출 로그:

| 항목 | 입력/출력 토큰 | 원가(USD) | 원가(KRW, ₩1,400/$) |
|---|---|---|---|
| 커리큘럼 개요 1회(1단계) | 696/342 | $0.004812 | 6.74원 |
| 주차 상세 생성 1회 평균(3단계, 4회 실측) | 약 732/368 | $0.005207 | 7.29원 |
| 모듈 1개 열람(6.2+6.3 통합, 1일차) | 848/1911 | $0.020806 | 29.13원 |

- **온보딩~확정(4주 전체 백그라운드 생성 포함)**: 약 **35.89원**
- **온보딩~1일차 완주(퀴즈까지)**: 약 **65.02원**
- PRD 11장 목표(월 2,000원 이하) 대비 1일차 완주 원가가 이미 여유 안에 있음. 다만 이는
  1일차 1회 열람 기준이며, 월간 총원가는 앞선 5차 처리 시 산정한 787원(월 20일 학습+
  질문하기 100회 등 가정 반영치)이 여전히 유효한 추정.

**6. 기존 페르소나 기능 회귀 확인**

- `GET /api/aimp/personas`: 정상 응답(설아 등 기존 페르소나 목록 반환) — 회귀 없음
- `POST /api/aimp/face-reading/`(관상): 인증 게이트 정상(401, 라우트 살아있음) — 회귀 없음
- pm2 `shared-api` 프로세스: reload 후 `online` 상태 정상, 무한 재시작 없음(재시작
  카운터는 과거 사고 누적치, 이번 reload는 정상 1회분)

**남은 미검증 항목(다음 세션 인지 필요)**

- **프론트 화면 실제 렌더링은 이 세션에서 검증하지 못함**(서버2 IP가 Vercel 봇 체크포인트에
  차단된 상태, 서버1엔 Playwright 미설치). API 레벨(라우트 응답·DB 데이터 정합성)은 전부
  실측 검증했으나, 화면 레이아웃/JS 런타임 오류 여부는 별도 확인 필요(다른 IP에서 수동
  접속 확인 또는 서버1에 Playwright 설치 후 재검증 권장).
- 웹 푸시·이메일 알림은 9단계(묶음 D) 범위라 이번 검증 대상 아님.
- 테스트 계정 2개(id 275/276)와 연쇄 데이터는 검증 종료 후 전부 삭제 완료.

## 롤백 지점 (2026-08-11, 묶음 D 착수 직전)

사용자 지시로 두 저장소의 현재 운영 브랜치 시점에 태그 생성. 묶음 D(9~10단계) 진행 중
문제가 발생하면 이 태그로 되돌린다.

- `shared-api` main: 태그 `pre-learning-d` = 커밋 `15f8c9a`(모듈 생성 워커 동시실행
  방지 락 수정 포함, 묶음 C 통합검증 완료 시점)
- `ai_mp` master: 태그 `pre-learning-d` = 커밋 `7017606`(묶음 D 이전 통합검증 결과
  기록까지 포함)
- 이 시점 기준 `LcGoal` 실사용 데이터는 **0건**(검증용 테스트 계정 2개는 검증 종료 후
  삭제 완료). 즉 이 태그로 롤백해도 잃을 실사용자 데이터가 없는 상태.

### 롤백 절차

**1. 코드 롤백(양쪽 저장소 공통 패턴)**

```sh
# shared-api
cd ~/shared-api  # 서버1에서 직접, 또는 서버2에서 push 후 자동배포 유도
git fetch --tags
git checkout main
git reset --hard pre-learning-d
git push origin main --force   # ★force-push — 사용자 승인 필수(아래 참조)

# ai_mp
cd ~/ai_mp
git fetch --tags
git checkout master
git reset --hard pre-learning-d
git push origin master --force
```

- shared-api는 서버1 자동배포(1분 주기)가 push된 main을 감지해 자동으로 pull+tsc+pm2
  reload한다 — 별도 수동 배포 조치 불필요, push만으로 롤백 반영됨.
- ai_mp는 push 즉시 Vercel이 자동 빌드하지만, **Promote to Production은 여전히 사용자가
  직접 클릭**해야 한다(이 프로젝트의 기존 원칙, 자동배포와 별개).

**2. force-push 전 확인 사항**

- `git reset --hard` + `--force` push는 **되돌릴 수 없는 파괴적 작업**이다. 롤백 태그
  이후에 다른 정상 커밋(묶음 D와 무관한 별도 작업)이 섞여 들어갔다면 그 커밋까지 함께
  사라진다 — 실행 전 반드시 `git log pre-learning-d..HEAD`로 굴러갈 커밋 목록을 사용자에게
  보여주고 승인받는다.
- 대안(더 안전, 기본적으로 이 방식을 우선한다): force-push 대신 `git revert`로 묶음 D
  커밋들만 역순으로 되돌리는 새 커밋을 쌓는다. 히스토리를 보존하면서 배포는 동일하게
  되돌아간다. 묶음 D가 다른 작업과 얽히지 않은 독립 커밋들이면 이 방법이 기본값이어야
  한다.

**3. DB 롤백이 필요한 경우**

- 9단계(Cron+알림)·10단계(주간 리포트)에서 추가하는 신규 테이블/컬럼은 `Lc` 접두사
  범위 안에서만 발생하며 기존 테이블은 건드리지 않는다(CLAUDE.md 원칙). 문제가 DB
  스키마 자체에 있다면 새로 추가한 컬럼/테이블만 `DROP`하는 별도 다운 마이그레이션을
  작성해 실행한다(운영 DB 실행은 항상 사용자 확인 후).
- 이 시점(태그 생성 시각) 기준 `LcGoal` 실사용 데이터가 0건이므로, 묶음 D 작업 중
  실사용자가 아직 없다면 데이터 손실 걱정 없이 스키마만 되돌리면 된다. 실사용자가
  생긴 이후에 롤백이 필요해지면 그 시점에 별도로 백업 여부를 판단한다.
