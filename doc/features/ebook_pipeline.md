# 전자책 자동 출판 파이프라인 (강지훈 페르소나)

> 상태: **대량생산 체제 전환 완료 — "오늘 등록→내일 결과"(재방문 유도)** (2026-06-11 후속). 즉시 본문생성 전부 제거, 자료수집·본문 모두 새벽 cron만, Sonnet 야간배치+정원제, 표지 사용자업로드, docx 신국판+판권지, PDF 제거.
> 강지훈 페르소나: `id = writer` (작가 컨셉)
> 이전 8탭/대개편(2026-06-07~10) 계획은 git 이력 참조. 이 문서가 현재 기준선.

## 목표
강지훈의 "📖 전자책 만들기"에서 **탭을 순서대로 진행**하며 한 권을 완성:
제목·목차(판형 선택) → 자료수집 챕터 체크 + **새벽 시간 예약** → (밤사이 자료수집+본문 자동생성) → **다음날** 초안 탭에서 표지 업로드 + 북크크 양식 .docx 다운로드 → 구글독스에서 마무리·PDF출력·북크크 등록(수동).

---

## 전체 흐름 — 3탭 (UI)

```
[탭1] 제목·목차
       └ 주제 입력 → AI 목차생성. 제목+저자명 입력(DB 저장=가지고 다님).
       └ 책 판형 선택: 신국판(152×225, 기본) / A5 / 국배판
       └ 목차 보기/수정(제목·요약 인라인, 추가/삭제/순서변경)

[탭2] 자료 수집  ★예약만 (즉시생성 없음)
       └ 새벽 시간 예약(1~5시 중 택1, 시간대별 정원 5권=차면 품절 표시)
       └ "새벽에 만들 챕터 선택" 체크(전체토글/개별) — 체크=자동 등록(별도 버튼 없음)
       └ 밤사이 cron이 체크된 챕터를 자료수집(Gemini) + 본문생성(Claude Sonnet)까지 자동
       └ 챕터 상태라벨: 자료수집완료/재수집예정/수집예정/미선택. 본문완료 시 체크 자동해제

[탭3] 초안 만들기  ★다음날 결과 확인 + 문서 산출
       └ 1단계: 본문 — 야간 생성 결과 보기 전용(읽기). 본문완료/생성대기 표시
       └ 2단계: 표지 올리기(선택) — 사용자가 만든 표지 이미지 업로드(미리보기/바꾸기/제거)
       └ 3단계: 문서 만들기
            • 만든 문서 있으면 [문서 다운로드] 먼저 노출(재방문 유지), [문서 다시 만들기]
            • [구글 문서(.docx) 만들기] = 북크크 양식 Word(판형 적용+판권지+쪽번호)
            • 문서 받으면 [북크크에서 출판하기] 버튼(→ https://bookk.co.kr) 노출 (2026-06-12)
       └ 결과: .docx를 구글 드라이브 올려 'Google 문서로 열기' → 글·표·그림 자유편집 → **북크크(bookk.co.kr)에서 바로 출판**(안내 문구 전부 북크크 강조로 통일, 2026-06-12)
```

---

## 확정 결정사항 (2026-06-11 대량생산 전환)

- **즉시생성 전부 제거**: `/content`(즉시본문)·`/rewrite`(다시쓰기)·`/draft`(즉시일괄) → 409 예약안내. 자료수집도 즉시 안 함(`collect-all`은 자료만, 사실상 미사용). **모든 생성은 새벽 cron만.** 목적="오늘 등록→내일 결과 확인"=재방문 유도(리텐션).
- **본문 모델 = Claude Sonnet**(야간 대량): 같은 CLI 구독에서 opus→sonnet이면 한도 적게 차감+빠름 → 하룻밤에 더 많은 책. 비용은 구독이라 ₩0. (소량·고품질이면 opus가 낫지만 즉시생성 경로를 다 막아 현재 opus 호출 없음.) 추론은 끔(산문엔 불필요, CLI -p 모드라 자동). 상세 [[feedback_ebook_model_choice]].
- **rate limit 안전장치**: `ClaudeRateLimitError`(CLI 한도초과 감지) → cron이 그날 밤 배치 깔끔히 중단(만든 건 저장, 다음밤 이어서).
- **시간대 정원제(품절)**: 슬롯 1~5시 × `EBOOK_SLOT_CAPACITY=5` = 총 25권/일(상수만 올리면 증설). `PUT /schedule` 슬롯 차면 409 품절, `GET /ebook/slots`로 프론트 품절표시.
- **표지 = 사용자 업로드**: AI(gpt-image-1) 자동생성 폐기(한글 못쓰고 ChatGPT 앱만 못함). 사용자가 ChatGPT 등에서 만들어 직접 업로드. `POST /cover-url`(signed-url)+`PUT /cover`(저장).
- **.docx = 북크크 양식 + 판형 + 판권지**: `docx` npm. 판형(EbookProject.pageSize: sinkuk/a5/gukbae)별 페이지 크기. 표지 다음 **판권지(저작권) 페이지**(제목·발행·저자 동적 / 부크크정보·ISBN 고정). 전 페이지 하단 쪽번호 footer.
- **문서 다운로드 상태유지**: `EbookProject.docxUrl` 저장 → 재방문 시 다운로드 버튼 바로 노출. 본문·표지·판형 변경 시 무효화(null)→'다시 만들기'.
- **PDF 제거**: 라우트 자체가 없었고(import만 잔존) 프론트 버튼만 있어 작동 안 했음 → 전부 제거. docx만 사용(구글독스에서 PDF 출력).
- **그림/글수정 UI 제거**(이전 대개편 유지): 본문 `[그림:설명]` 자리만, 사용자가 구글독스서 처리.
- **저자명 가지고 다님**: EbookProject.author 컬럼.

---

## 구현 상태 (2026-06-11 완료)

### 백엔드 (shared-api/routes/aimp/ebook.ts)
- `POST /ebook/:id/docx` — 본문 → 북크크 양식 .docx(lib/ebookDocx.ts, 판형+판권지+쪽번호, coverUrl 첫페이지) → GCS, **docxUrl 저장**
- `POST /ebook/:id/cover-url` — 표지 업로드 signed-url(어드민 아님, 사용자), `PUT /ebook/:id/cover` — coverUrl 저장(+docxUrl 무효화)
- `PUT /ebook/:id/page-size` — 판형 저장(sinkuk/a5/gukbae, +docxUrl 무효화)
- `GET /ebook/slots` — 시간대별 예약 현황(품절), `PUT /ebook/:id/schedule` — 예약(정원 차면 409)
- `POST /ebook/:id/collect-all` — 자료수집만(본문 제거, 사실상 미사용)
- `POST /ebook/:id/image-prompts` — **이미지 프롬프트 뽑기**(2026-06-14): 본문 `[그림:설명]` 자리를 `lib/gemini.ts generateImagePrompts`가 추출→`_genWithClaude(sonnet)`으로 자리별 ChatGPT(DALL·E)용 영문 프롬프트 JSON 생성(₩0). 클로드는 이미지 생성 불가→프롬프트만, 실제 그림은 ChatGPT서. 프론트 초안탭 '🖼 이미지 프롬프트 뽑기' 버튼→그림별 카드(복사).
- `POST /ebook/internal/run-scheduled` — **새벽 cron 본체**: scheduledHour 매칭 전자책의 체크 챕터를 `collectAndWriteChapter(...,'sonnet')`로 자료+본문 생성. 한도초과 시 break(rateLimited). 완료 시 docxUrl 무효화.
- 409 처리(즉시생성 제거): `/content`·`/rewrite`·`/draft`
- 제거됨: generateEbookCover(gpt-image), renderEbookPdf import, /pdf 라우트(원래 없음)

### 라이브러리
- `lib/ebookDocx.ts`: 마크다운 → 북크크 양식 Word. 판형(PAGE_SIZES mm→twip, 섹션 page.size+margin18mm), 장별5색, 소제목 음영박스, 표(절대폭+FIXED 레이아웃=세로쪼개짐 방지), 인용, `[그림:]` 점선박스, 목차, **판권지(buildColophon)**, 쪽번호 footer(SimpleField('PAGE')), 표지(coverImage ImageRun)
- `lib/gemini.ts`: generateChapterSources(Gemini grounding), generateChapterContent(claude, claudeModel 인자), `_genWithClaude(prompt, model)`, `ClaudeRateLimitError`. generateEbookCover 제거.
- `lib/ebookPdf.ts`: 미사용(파일만 잔존, import 안 함)

### 프론트 (frontend/components/EbookBoard.tsx)
- 탭 3개. 탭1 판형 버튼. 탭2 예약만(즉시생성 버튼 없음)+품절표시. 탭3 본문 읽기전용+표지 업로드+문서(다운로드 상태유지). 진행탭 sticky 고정.
- apiService: generateDocx, uploadCover/coverUploadUrl/saveCoverUrl, setPageSize, getSlots, setSchedule, setCollectFlags. 제거: generateCover/generatePdf/generateContent/rewriteChapter/generateDraft/collectAll.
- EbookProject: coverUrl/docxUrl/pageSize/author/scheduledHour

### 서버1 crontab
- `0 16-20 * * *`(UTC) = KST 새벽 1~5시 매시 → `curl POST localhost:3020/api/aimp/ebook/internal/run-scheduled`, 로그 `~/ebook-cron.log` (rateLimited/doneCount로 처리량 확인 → 정원 조정 판단)

---

## ⚠️ 주의 (기존 교훈 유지)
- **데이터 구조**: 챕터는 `EbookChapter` row가 아니라 `EbookProject.tocJson`(JSON 배열). 자료/본문/상태 전부 거기 저장 → **JSON 덮어쓰는 모든 경로에서 기존 필드 보존**(과거 제목수정 시 자료 날아간 버그 있었음).
- **서버1 DB**: `prisma db push 금지`(실DB가 schema보다 앞섬) → 컬럼 추가는 raw SQL `ALTER`. snake_case는 `@map`.
- **새 보드/모달은 ErrorBoundary로 감쌈**(자식 렌더 예외가 앱 전체 크래시 방지). EbookBoard는 이미 ErrorBoundary 적용됨.
- **모바일 우선**: 탭 UI는 390폭에서 정상 동작 확인(Playwright).
- **비용**: 무료 테스트는 강지훈 본인만. 정식 오픈 전 포인트 차감 필수(자료수집·본문생성·PDF 누적).
- **클로드 본문생성**: 서버1 로컬 claude CLI 구독 인증 spawn(API키 불필요·추가비용0). shared-api가 서버1에 있어 로컬 실행이 정답.

## 기술 자산 재사용
- Gemini grounding 자료수집: `shared-api/lib/gemini.ts generateChapterSources`
- 클로드 spawn(Sonnet): 동 파일 `_genWithClaude(prompt, model)` / `generateChapterContent`
- 표지 업로드: signed-url GCS PUT (전자책 cover-url, PersonaGalleryTab 패턴)
- .docx: `lib/ebookDocx.ts` (docx npm, 판형+판권지+쪽번호)
- cron: 서버1 crontab(localhost:3020) → `/ebook/internal/run-scheduled`

## 진행 로그
- 2026-06-07: 최초 계획 수립.
- 2026-06-08~09: 목차/수정/챕터별 자료수집/3AI 비교 본문/글수정/그림자리 이미지 구현.
- 2026-06-10: 8탭 재정의 + 본문일괄/PDF/AI그림(Imagen)/표/풀폭UI.
- 2026-06-11(대개편): 구글독스(.docx) 중심 3탭. 그림/글수정/완성본탭 제거, 북크크 양식 .docx + (당시) 챗GPT 표지, 자료수집→본문 자동화 + 새벽 cron.
- **2026-06-11(대량생산 전환·현재)**: 즉시생성 전부 제거(409)→새벽 cron만, Sonnet 야간배치+`ClaudeRateLimitError` 안전장치, 정원제(25권/일), 표지 사용자업로드(AI 폐기), docx 판형(신국판)+판권지+쪽번호, 문서 다운로드 docxUrl 상태유지, PDF 제거, 챕터 상태라벨, 진행탭 sticky. shared-api `cf6dc1f`~`e918a443`, ai_mp `cf6dc1f`~`aa9534f`. DB: pageSize/docxUrl 컬럼 추가.
- **2026-06-14**: 이미지 프롬프트 뽑기(`POST /ebook/:id/image-prompts`, generateImagePrompts). 본문 [그림:설명] 자리별 ChatGPT용 영문 프롬프트 생성→복사. shared-api `65969c7`, ai_mp `2c7c209`.
