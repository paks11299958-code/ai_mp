# 🎓 AI 학습코칭 (learning-coach)

목표를 말하면 주차별 커리큘럼으로 쪼개고, 매일 분량을 배정하고, 틀린 문제를 간격을 두고
다시 물어보는 지속형 학습 코치. 2026-08-11~12 개발(묶음 A~E), **2026-08-13 오픈 배포**.

★`learn`(학습자료 코스)과 **다른 기능·다른 경로**다. 이름이 비슷해 혼동 주의
(`/api/aimp/learn/*` ≠ `/api/aimp/learning/*`).

## 진입 경로
- **메인 기능카드 id 30 `learning-coach`**(2026-08-25 신설, 카테고리 `info`=📰 정보·학습)
  → `App.tsx`의 얼리리턴 라우트가 `/learning`으로 이동
  ★그전까지 `FEATURES_GRID` 미등록 + `Persona.isVisible=false` 라 **주소를 직접 쳐야만**
  들어갈 수 있었다(8/13 "오픈 배포" 기록과 달리 실제로는 닫혀 있었다).
- 알림 이메일 링크도 `/learning` 고유 주소로 들어온다 → **모달이 아니라 전체 화면**인 이유
  (화면 10개 + 매일 반복 사용 + 고유 주소 필요, 2026-08-13 사장과 확인)
- `/learning`(랜딩)은 **진행 중인 학습이 있으면** 제목·진행률 카드와
  `이어서 학습하기 / 전체 커리큘럼 / 새 학습 신청`을 보여준다(2026-08-25).
  ★그전에는 무조건 소개 화면이라 이미 커리큘럼이 있어도 "신청 →" 버튼만 나왔다.

## 과금 — 커리큘럼 확정 시 500P (2026-08-25 신설)
`MenuLimit` `feature='learning'` (USER/MANAGE/ADMIN 3행, 500P).
차감 시점은 **`POST /goals/:id/confirm`**(모듈 20개 생성이 시작되는 지점).
- **1~2단계(목표 입력·주차 개요)는 무료** — 계획을 보고 확정 전에 그만둘 수 있어야 한다
- 20일 학습·채점·주간리포트는 **추가 차감 없음**
- ★차감은 상태 전환 **뒤**에 한다(차감만 되고 생성이 안 되는 쪽이 더 나쁘다).
  실패 시 `outline_ready` 로 롤백해 재시도 가능하게 했다
- 실측 원가 ≈ **80원**(개요 6원 + 모듈 20개 본문·문제 73원, gemini-2.5-flash).
  ★`LcAiUsageLog` 를 **model 별로 집계**할 것 — 8/13 이전 claude-sonnet-5 로그가 섞여 있어
  통으로 보면 원가를 과대평가한다

## 화면 11개 (`frontend/components/learning/`)
`LearningLanding` → `LearningOnboarding`(목표·기간·수준 입력) → `LearningPlanConfirm`(주차 개요 확인)
→ `LearningGenerationProgress`(모듈 생성 진행) → `LearningDashboard` → `LearningTask`(본문+퀴즈)
→ `LearningReview`(오답 간격반복) → `LearningCurriculum`(전체 커리큘럼, S10)
→ `LearningWeeklyReport`(S9) → `LearningSettings`(S11, 알림 시각 등)
→ **`LearningGoals`**(내 커리큘럼 목록·전환·중단·삭제, 2026-08-25 신설)

## 상단 탭 (`LearningTabs.tsx`, 2026-08-25)
`📖 오늘 · 🗂 커리큘럼 · 🎒 내 학습 · 🔁 복습 · ⚙️ 설정` — **상시 오가는 5개만** 묶는다.
★**과제·퀴즈·신청 온보딩은 일부러 뺐다** — 몰입 화면이라 탭을 넣으면 문제 푸는 중에
다른 탭을 눌러 진행이 끊긴다. 탭은 SPA 상태 전환이 아니라 `location.href` 이동이며
각 화면은 독립 라우트를 유지한다.
PC 폭은 `max-w-4xl`(그전 `max-w-2xl`=672px 고정이라 1190px 화면에서 양옆이 크게 비었다).

## 여러 커리큘럼 관리 (2026-08-25 신설)
★**기존 구멍**: `today`·`curriculum` 이 `findFirst(status:'active', createdAt desc)` 로
**가장 최근 1개만** 봐서, 새 커리큘럼을 만들면 이전 것이 화면에서 사라지고 되돌아갈 방법이
없었다 — **500P 낸 데이터가 묻혔다.**

- `resolveCurrentGoalId()` — `LcProfile.activeGoalId`(선택 기억)를 보고, 없거나 무효면
  최근 `active` 로 폴백. `today`·`curriculum` 이 함께 쓴다
- API: `GET /goals`(목록·진행률) · `POST /goals/:id/select`(전환) ·
  `archive`(중단=보관) · `resume`(재개) · `DELETE /goals/:id`(완전삭제)
- 상태값: `active`(진행 중) / `archived`(보관). ★**중단을 기본 동선에, 삭제는 2단계 확인**으로
  분리했다 — 500P 들인 데이터라 실수 삭제 시 재생성에 또 500P 든다
- 삭제 시 자식은 FK CASCADE 로 함께 지워진다(Module·WeekOutline·DailyTask·Question·
  ReviewItem·Attempt 전부 `confdeltype='c'` 실측 확인)
- ★`LcProfile.activeGoalId` 는 **raw SQL 로 추가**했다(운영DB ≠ schema.prisma 규칙).
  ★raw SQL 로 컬럼을 추가하면 **schema.prisma 반영 + 서버1 `prisma generate` 까지** 해야 한다 —
  DB만 고치면 Prisma 가 필드를 몰라 `Unknown field` 로 조회가 전부 실패한다(2026-08-25 실제 사고)

## 커리큘럼 생성 — ★2단계 분할
84모듈 일괄 생성이 63초 걸려 온보딩 이탈을 유발하던 문제를 분리(2026-08-11 확정):
1. **주차 개요만** 먼저(`LcWeekOutline`, 목표 10초 이내) → 사용자가 확인·수정
2. 확정 후 **모듈 상세는 백그라운드 워커**가 주차 단위로 생성(`learning-module-worker`)

★워커 동시 실행 방지 락이 있다 — 통합검증 중 같은 주차가 261ms 간격으로 중복 생성되는
결함을 실측 발견해 **유니크 제약 + 원자적 락**으로 수정(2026-08-11).

## AI 호출 — gemini-2.5-flash (2026-08-13 전환)
전부 `lib/learning/curriculum.ts`의 `generateJson()` 하나를 통과한다(재시도 `MAX_RETRY=2`).

| 호출 | 함수 | 스키마 |
|---|---|---|
| 주차 개요 | `generateWeekOutlines` | `OUTLINE_SCHEMA` |
| 모듈 상세 | `generateModuleDetail` | `MODULE_DETAIL_SCHEMA` |
| 본문+퀴즈(6.2+6.3 통합) | `generateModuleContent` | `MODULE_CONTENT_SCHEMA` |
| 주간 리포트 | `generateWeeklyReport` | `WEEKLY_REPORT_SCHEMA` |

- **왜 Gemini인가**: A/B 실측(양쪽 동일 JSON 스키마 강제) 결과 규칙 준수 동등, 원가는
  **약 1/5**. 사이트 전역이 이미 Gemini 주류(23곳)라 정책도 일치. 그전까지 `claude-sonnet-5`를
  쓴 이유는 "원래 CLI가 Claude였으니까"였고 **모델 비교는 한 적이 없었다**.
- ★**`maxOutputTokens`를 넘기지 않는다** — Gemini 2.5 Flash는 **사고(thinking) 토큰을 이 한도에
  함께 계산**해서, Claude 기준 한도를 그대로 주면 JSON이 잘린다(`Unterminated string`).
  스키마가 이미 응답 크기를 제한하므로 한도 없이 쓴다.
- 모델명은 `LEARNING_AI_MODEL` 상수 하나로 통일 — 호출부 5곳이 각자 하드코딩하면
  **원가가 옛 단가로 조용히 기록**된다. 단가표(`lib/learning/usage.ts`)에서 **옛 모델 단가는
  지우지 말 것**(지우면 과거 로그가 0원이 된다).
- 사용량은 `LcAiUsageLog`에 모델·토큰·원가로 기록(`logLearningAiUsage`).
- 6.4(질문하기)는 **미구현**.

## 퀴즈 규칙 (프롬프트로만 강제 가능 — 스키마로는 불가)
`answer`는 `choices` 4개 중 하나와 **완전히 동일한 문자열**이어야 한다.
`generateModuleContent`가 파싱 후 직접 검사해 어기면 재시도한다(선택지 4개, 문항 3~5개도 함께).

## cron (서버1, ★UTC 기준)
```
* * * * *  learning-module-worker      # 모듈 상세 생성
0 * * * *  learning-notify             # 매시 정각 — 워커가 KST notifyHour와 대조해 대상만 발송
0 11 * * 0 learning-weekly-report      # 일요일 UTC 11:00 = KST 일 20:00
```
- 알림은 **이메일만**(웹 푸시는 범위가 커서 보류). 하루 중복 발송은 `LcDailyTask.notifiedAt`으로 방지.
- 워커는 `requireCronSecret` — `CRON_SECRET` 미설정 시 **localhost 호출만** 허용.

## 라우팅 — ★vercel.json 규칙 필수
```json
{ "source": "/learning",                 "destination": "/index.html" },
{ "source": "/api/aimp/learning/:path*", "destination": "http://34.50.27.95:3020/api/aimp/learning/:path*" }
```
★**catch-all(`/api/:d/:s1...` → `/api/router`)보다 앞**에 있어야 한다. 2026-08-13 오픈 때 이 두 줄이
누락돼 카드는 노출됐는데 화면·API가 전부 404였다(시드 후 눈으로 확인해서 잡음).

## 디자인
사이트 베이지 톤(`#F5EFE6` 배경 / `#2D2438` 본문 / `#5C5468` 보조 / `#9089A1` 흐린 글씨),
포인트는 indigo. ★불투명 `bg-*-500` 버튼 위 글씨는 **흰색 유지** — 일괄 치환 시 휩쓸리기 쉽다
(2026-08-13 다크→베이지 전환 때 13줄이 안 보이게 됐던 것을 검사로 복구).

## 파일
- 백엔드: `shared-api/lib/learning/{curriculum,curriculumParsing,scoring,spacedRepetition,usage}.ts`,
  `routes/aimp/learning.ts`, `routes/aimp/workers/learning-{module,notify,weekly-report}.ts`
- 프론트: `frontend/components/learning/*.tsx`, `App.tsx`(learning-coach 라우트)
- DB: `Lc*` 모델 11개(아래 db_schema.md 참조), Persona `id='learning-coach'`(고정 ID —
  프론트 라우팅이 이 값을 참조하므로 cuid 자동생성 금지)
- 시드: `prisma/seed-learning-coach-persona.js`(카드 노출용, `ON CONFLICT DO UPDATE`라 재실행 안전)
  ※ `seed-learning-coach-scenario.js`는 **테스트 계정 생성용**이라 운영에서 실행하지 않는다.
- 점검: `scripts/check-learning-schema-sync.ts`(읽기 전용, schema.prisma ↔ 운영 DB 컬럼 대조)
- 상세 진행 기록: `ai_mp/PROGRESS.md`, `app/learning/{CLAUDE.md,PRD.md}`
