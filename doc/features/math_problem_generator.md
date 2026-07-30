# 찰칵! AI쌤 — 수학 문제 출제(생성) 기능

기존 math-tutor(문제 사진 풀이/채점)에 **문제 출제(생성)** 모드를 추가. 학년·과목·단원을 고르면 클로드가 초등 수학 문제를 1~10개 생성, 화면 표시 + .docx 다운로드. 선생·학부모가 연습문제지를 즉석에서 뽑는 용도.

- 구현: 2026-06-13
- 자료수집 없음(클로드가 교육과정을 안다 — 초1 검증: 실제 교과 단원/문제 정확).
- 생성은 **클로드 CLI 구독(`_genWithClaude`)으로 ₩0**(전자책 본문과 동일 인프라).

## 흐름
헤더 토글 **풀이 / 문제 만들기**(기본 풀이, 기존 사진풀이 보존).
문제 만들기: **학년(초1~6) → 과목(영역) → 단원(클로드 자동 생성) → 문제 수(1~10 슬라이더) → 생성** → 문제 카드(정답 접기/펼치기) + **문제지(.docx) 받기**.
과목 5종: 수와 연산 / 도형 / 측정 / 규칙성 / 자료와 가능성.

## 백엔드 (shared-api)
- `lib/mathProblems.ts` (신규):
  - `generateMathChapters(grade, subject)` — `_genWithClaude`(sonnet)로 교육과정 단원 목록 JSON.
  - `generateMathProblems(grade, subject, chapter, count)` — 문제+정답+풀이 JSON. `MathProblem={no, problemMd, answer, explanation}`. JSON 추출 안전장치(`/\[[\s\S]*\]/` 매치).
  - `buildProblemsDocx(meta, problems)` — `renderEbookDocx` 재활용(문제=챕터들 + 정답지 챕터, pageSize 'gukbae'=국배판).
- `lib/gemini.ts`: `_genWithClaude` **export**로 변경(원래 파일 내부 함수).
- `routes/aimp/math-tutor.ts` 라우트 추가:
  - `GET /chapters?grade=&subject=` (requireAuth, 무료) — 단원 자동 생성. ⚠️`/:id`보다 먼저 정의(안 그러면 chapters가 id로 잡힘).
  - `POST /generate` (requireAuth) — checkMenuAccess+deductMenuPoints(quick-menu=50P) → 생성 → MathProblemSet 저장. 실패 시 refundMenuPoints. ClaudeRateLimitError→503+환불.
  - **`ClaudeAuthError`→503+환불+사장 알림**(2026-07-30 신설): 구독 토큰 만료는 한도 초과와 달리 **기다려도 안 낫고 재로그인이 필요**해 문구를 분리("AI 기능이 일시 중단됐어요. 관리자 확인이 필요합니다") + `notifyClaudeAuthDown()`으로 문자·텔레그램. 상세 → `~/claude_env_status.md`.
  - ※**사진 풀이(`analyzeMathProblem`)는 Gemini**라 claude 토큰과 무관하다. claude가 죽어도 사진 풀이는 정상 — 문제 *생성*만 막힌다(혼동 주의).
  - `POST /:id/docx` (requireAuth) — 저장 문제셋 → buildProblemsDocx → uploadToGCS(`math-tutor/sets/{userId}/...`) → docxUrl 저장.

## DB
```prisma
model MathProblemSet {
  id Int @id @default(autoincrement())
  userId Int
  grade Int          // 1~6
  subject String
  chapter String
  count Int
  problemsJson String // [{no, problemMd, answer, explanation}]
  docxUrl String?
  createdAt DateTime @default(now())
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  @@index([userId, createdAt])
}
```
서버1: raw SQL CREATE TABLE + `prisma generate`(db push 금지). User에 `mathProblemSets MathProblemSet[]`.

## 프론트 (ai_mp)
- `components/MathTutorBoard.tsx`: `mode: 'solve'|'generate'` 토글 + generate UI(학년 버튼/과목/단원/슬라이더/문제카드/docx/PDF/이력). 핑크 테마(#FF6B9D/#C44FD8) 재활용. 컴포넌트 내부 `apiFetch` 직접 사용(apiService 안 거침).
- vercel.json: `/api/math-tutor/:path*` 와일드카드로 새 라우트 커버(프록시 추가 불필요).

## PDF 출력 (2026-06-13)
🖨️ 인쇄·PDF 버튼: 인쇄용 A4 HTML(문제 본문+답 쓰는 줄, page-break 후 정답지)을 `window.open`한 새 창에 써서 `window.print()` 호출 → 사용자가 '인쇄' 또는 'PDF로 저장'. 서버부하 0, 한글 안전(맑은 고딕). docx와 별개 버튼.

## 이력 (2026-06-13)
DB(MathProblemSet)는 생성마다 저장돼 있었음 — 화면만 추가. 📂 이력 버튼 → `GET /sets`(본인 30개) → 클릭 시 `GET /sets/:id`로 다시 보기. `DELETE /sets/:id`. ⚠️ `/sets`는 기존 `/:id`(사진풀이 상세)보다 **먼저** 정의.

## 중복 방지 (2026-06-13)
"같은 문제 반복" 방지 3중: ①프롬프트에 유형 다양화 지시(계산/세기/비교/문장제/빈칸 골고루)+소재·숫자 매번 다르게 ②매 호출 랜덤 시드 ③`POST /generate`가 같은 학년·과목·단원의 **최근 3세트 문제를 avoidList로** `generateMathProblems`에 전달("이것과 겹치지 말 것").

## 확장(향후)
- 다른 학년·과목은 프롬프트 파라미터로 이미 대응. 난이도 세분화, 문제지 docx 레이아웃 다듬기.
