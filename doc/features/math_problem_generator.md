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
- `components/MathTutorBoard.tsx`: `mode: 'solve'|'generate'` 토글 + generate UI(학년 버튼/과목/단원/슬라이더/문제카드/docx). 핑크 테마(#FF6B9D/#C44FD8) 재활용. 컴포넌트 내부 `apiFetch` 직접 사용(apiService 안 거침).
- vercel.json: `/api/math-tutor/:path*` 와일드카드로 새 라우트 커버(프록시 추가 불필요).

## 확장(향후)
- 다른 학년·과목은 프롬프트 파라미터로 이미 대응. 생성 이력(GET /sets) 후순위.
- 난이도/유형 세분화, 문제지 docx 레이아웃 다듬기(현재 전자책 양식 재활용).
