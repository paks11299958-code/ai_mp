# 전자책 자동 출판 파이프라인 (강지훈 페르소나)

> 상태: **대개편 완료 — 구글독스(.docx) 중심 3탭** (2026-06-11). 그림/글수정/완성본탭을 걷어내고, 북크크 양식 .docx를 만들어 사용자가 구글독스에서 마무리하는 흐름으로 단순화. 자료수집→본문생성을 새벽 cron으로 자동화.
> 강지훈 페르소나: `id = writer` (작가 컨셉)
> 이전 8탭 계획(2026-06-07~10)은 git 이력 참조. 이 문서가 현재 기준선.

## 목표
강지훈의 "📖 전자책 만들기"에서 **탭을 순서대로 진행**하며 한 권을 완성:
제목·목차 → 자료수집(체크+새벽 예약, 자료+본문 자동) → 초안(표지 챗GPT 생성) → **북크크 양식 .docx 다운로드** → 사용자가 구글독스에서 글·표·그림 마무리 후 PDF 출력·북크크 등록.

---

## 전체 흐름 — 3탭 (UI)

```
[탭1] 제목·목차
       └ 주제 입력 → AI 목차생성. 제목+저자명 입력(DB 저장=가지고 다님).
       └ 목차 보기/수정(제목·요약 인라인, 추가/삭제/순서변경)

[탭2] 자료 수집
       └ 새벽 예약(1~5시 중 택1) + 챕터별 체크박스(전체토글/개별)
       └ "체크 = 수집해라": 체크된 챕터는 자료가 있어도 새로 수집(덮어쓰기)
       └ 예약 시각 cron 또는 '지금 바로 수집' → ① Gemini grounding 자료수집
          → ② 바로 클로드 본문생성 → ③ 체크 자동해제
       └ 재수집은 다시 체크. (자료수집과 본문생성이 한 번에 끝남)

[탭3] 초안 만들기  ★문서 산출
       └ 1단계: 전체 본문 만들기(클로드, 본문있으면 건너뜀) + 챕터별 본문보기/다시쓰기
       └ 2단계: 표지 만들기(선택) — 챗GPT(gpt-image-1)가 제목·주제 기반 세로 표지 생성, 미리보기
       └ 3단계: 문서 만들기
            • [구글 문서(.docx) 만들기] = 북크크 양식 Word(장별5색·소제목 음영박스·표·목차·표지 첫페이지)
            • [PDF로도 받기] = 보조
       └ 결과: .docx를 구글 드라이브 올려 'Google 문서로 열기' → 글·표·그림 자유편집·PDF출력·북크크 등록(수동)
```

---

## 확정 결정사항 (2026-06-11 대개편)

- **그림 제거**: 본문 속 AI그림(Imagen)·이미지업로드·표지PDF병합 전부 삭제. 본문엔 `[그림:설명]` **자리만** 남기고(프롬프트 유지), 그림은 사용자가 구글독스에서 직접 넣거나 지움.
- **글수정 UI 제거**: 앱 내 마크다운 편집기 삭제. 어차피 .docx로 받아 구글독스에서 수정하니 불필요. 챕터별 '클로드로 다시쓰기'(AI 재생성)만 유지.
- **완성본 탭(탭6) 제거**: 표지+PDF병합 흐름 폐기. 양식을 .docx에 처음부터 넣으니 후처리 불필요.
- **.docx = 북크크 양식**: 사용자 아이디어 채택 — "구글독스용 .docx를 처음부터 북크크 양식으로 만들면 구글독스서 그대로 편집·PDF출력". `docx` npm(순수 JS, chromium 불필요)로 생성.
- **표지 = 챗GPT**: gpt-image-1(이 OpenAI 계정에 dall-e-3 없음, gpt-image 계열만 존재). 1024x1536 세로, no-text. coverUrl 있으면 .docx 첫 페이지에 꽉 차게 삽입.
- **자료+본문 자동**: 체크된 챕터는 자료수집 직후 클로드 본문생성까지 한 번에. 예약(새벽 cron)·즉시 둘 다. 이유=어차피 .docx 받아 수정하니 본문 미리볼 필요 약함, 클로드=서버1 CLI 구독이라 추가비용 0.
- **체크 = 수집해라**: 자료 있어도 덮어쓰기, 완료시 체크 자동해제, 재수집은 다시 체크.
- **저자명 가지고 다님**: EbookProject.author 컬럼(raw SQL). 제목 옆 입력→ .docx/PDF에 재사용.
- **PDF는 보조 유지**: '그냥 PDF'(lib/ebookPdf.ts playwright)도 받을 수 있게. 북크크 양식의 정본은 .docx.

---

## 구현 상태 (2026-06-11 완료)

### 백엔드 (shared-api/routes/aimp/ebook.ts)
- `POST /ebook/:id/docx` — 전체 본문 → 북크크 양식 .docx(lib/ebookDocx.ts), coverUrl 있으면 첫페이지 표지 삽입 → GCS
- `POST /ebook/:id/cover` — gpt-image-1 표지생성(lib/gemini.ts generateEbookCover) → GCS → EbookProject.coverUrl
- `POST /ebook/:id/collect-all` — 체크 챕터 자료수집+본문생성(collectAndWriteChapter), 완료시 체크해제
- `POST /ebook/internal/run-scheduled` — 새벽 cron 진입점(localhost 게이트). scheduledHour==현재KST시각 매칭 전자책 처리
- `POST /ebook/:id/draft` — 전체 본문 일괄생성(클로드, 본문있으면 건너뜀)
- `POST /ebook/:id/chapters/:no/rewrite` — 챕터별 클로드 다시쓰기 → contentMd
- `POST /ebook/:id/pdf` — 보조 PDF(playwright, lib/ebookPdf.ts)
- 제거됨: image 라우트, generateEbookImage(Imagen), final 라우트(탭6), content 3AI 라우트는 잔존하나 UI 미사용

### 라이브러리
- `lib/ebookDocx.ts` (신규): 마크다운 → 북크크 양식 Word. 장별 5색 순환(파/빨/초/주/퍼), 소제목 컬러 음영박스, 표(헤더 음영), 인용 음영+좌측바, `[그림:]` 점선 안내박스, 목차, 표지(coverImage ImageRun 첫페이지 꽉차게)
- `lib/gemini.ts`: generateEbookCover(gpt-image-1), generateChapterSources(grounding), generateChapterContent(claude)
- `lib/ebookPdf.ts`: 보조 PDF (북크크 양식, playwright chromium)

### 프론트 (frontend/components/EbookBoard.tsx)
- 탭 3개. 초안탭 3단계(본문/표지/문서). 챕터펼침=미리보기+다시쓰기만(글수정·그림 UI 제거)
- apiService: generateDocx, generateCover, generateDraft, rewriteChapter, collectAll, setCollectFlags, setSchedule, generatePdf
- EbookProject.coverUrl/author 타입

### 서버1 crontab
- `0 16-20 * * *`(UTC) = KST 새벽 1~5시 매시 → `curl POST localhost:3020/api/aimp/ebook/internal/run-scheduled`, 로그 `~/ebook-cron.log`

---

## ⚠️ 주의 (기존 교훈 유지)
- **데이터 구조**: 챕터는 `EbookChapter` row가 아니라 `EbookProject.tocJson`(JSON 배열). 자료/본문/상태 전부 거기 저장 → **JSON 덮어쓰는 모든 경로에서 기존 필드 보존**(과거 제목수정 시 자료 날아간 버그 있었음).
- **서버1 DB**: `prisma db push 금지`(실DB가 schema보다 앞섬) → 컬럼 추가는 raw SQL `ALTER`. snake_case는 `@map`.
- **새 보드/모달은 ErrorBoundary로 감쌈**(자식 렌더 예외가 앱 전체 크래시 방지). EbookBoard는 이미 ErrorBoundary 적용됨.
- **모바일 우선**: 탭 UI는 390폭에서 정상 동작 확인(Playwright).
- **비용**: 무료 테스트는 강지훈 본인만. 정식 오픈 전 포인트 차감 필수(자료수집·본문생성·PDF 누적).
- **클로드 본문생성**: 서버1 로컬 claude CLI 구독 인증 spawn(API키 불필요·추가비용0). shared-api가 서버1에 있어 로컬 실행이 정답.

## ⚠️ 주의 (교훈 유지)
- **데이터 구조**: 챕터는 `EbookChapter` row가 아니라 `EbookProject.tocJson`(JSON 배열). 자료/본문/표지URL은 tocJson 또는 EbookProject 컬럼 → **JSON 덮어쓰는 모든 경로에서 기존 필드 보존**.
- **서버1 DB**: `prisma db push 금지` → 컬럼 추가는 raw SQL `ALTER`(author, coverUrl, scheduledHour 등). prisma generate 필수.
- **클로드 본문생성**: 서버1 로컬 claude CLI 구독 인증(API키 불필요·추가비용0). 책1권 본문 ₩0(자료 grounding+표지 gpt-image만 과금).
- **cron KST 변환**: crontab은 UTC → KST 새벽 1~5시 = UTC 16~20시. run-scheduled가 KST hour로 매칭.
- **모바일 우선**: 탭 UI 390폭 Playwright 검증.

## 기술 자산 재사용
- Vertex grounding: `shared-api/lib/gemini.ts generateChapterSources`
- 클로드 spawn: 동 파일 `generateChapterContent` claude 경로
- 표지: `generateEbookCover` (OpenAI gpt-image-1)
- .docx: `lib/ebookDocx.ts` (docx npm), PDF 보조: `lib/ebookPdf.ts` (playwright)
- cron: 서버1 crontab(localhost:3020) → `/ebook/internal/run-scheduled`

## 진행 로그
- 2026-06-07: 최초 계획 수립.
- 2026-06-08~09: 목차/수정/챕터별 자료수집/3AI 비교 본문/글수정/그림자리 이미지 구현.
- 2026-06-10: 프로세스 8탭 재정의 + 본문일괄/PDF/AI그림(Imagen)/표/풀폭UI 구현.
- 2026-06-11: **대개편 — 구글독스(.docx) 중심 3탭**. 그림(Imagen)/글수정/완성본탭 제거, 북크크 양식 .docx(docx npm) + 챗GPT(gpt-image-1) 표지 첫페이지, 자료수집→본문생성 자동화(collectAndWriteChapter) + 새벽 cron 연결(KST 1~5시). 저자명/표지 DB 컬럼. shared-api `a7d46fb`·`1ee8ae1`·`53994b8`, ai_mp `1539f99`·`00f3f58`·`fae9583`.
