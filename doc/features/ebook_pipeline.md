# 전자책 자동 출판 파이프라인 (강지훈 페르소나)

> 상태: **대량생산 체제 전환 완료 — "오늘 등록→내일 결과"(재방문 유도)** (2026-06-11 후속). 즉시 본문생성 전부 제거, 자료수집·본문 모두 새벽 cron만, Sonnet 야간배치+정원제, docx 신국판+판권지, PDF 제거.
> **2026-07-25 대개편**: 그림 이미지(그림 자리 AI생성+표지 AI생성)와 과금 정책 전면 신설. 상세는 아래 "2026-07-25 그림·표지 AI생성 + 과금 개편" 섹션 참고.
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
       └ 2단계: 표지 만들기(선택) — 사용자 업로드 또는 **AI로 표지 만들기**(2026-07-25 신규, 제목+목차 참고, 장당 200P)
       └ 3단계: 문서 만들기
            • 만든 문서 있으면 [문서 다운로드] 먼저 노출(재방문 유지), [문서 다시 만들기]
            • [구글 문서(.docx) 만들기] = 북크크 양식 Word(판형 적용+판권지+쪽번호). **최초 1회만 글자수 비례 과금**(2026-07-25, 1,000자당 200P), 재생성은 무료. 완성된 그림이 있으면 버튼 라벨이 "🖼️ 이미지 포함 문서 만들기"로 자동 전환
            • 문서 받으면 [북크크에서 출판하기] 버튼(→ https://bookk.co.kr) 노출 (2026-06-12)
       └ (docx 완성 후에만) 그림 이미지 프롬프트 뽑기(일괄 500P)·AI 이미지 일괄생성(장당 200P, 백그라운드 큐) — 상세는 아래 섹션
       └ 결과: .docx를 구글 드라이브 올려 'Google 문서로 열기' → 글·표·그림 자유편집 → **북크크(bookk.co.kr)에서 바로 출판**(안내 문구 전부 북크크 강조로 통일, 2026-06-12)
```

---

## 확정 결정사항 (2026-06-11 대량생산 전환)

- **즉시생성 전부 제거**: `/content`(즉시본문)·`/rewrite`(다시쓰기)·`/draft`(즉시일괄) → 409 예약안내. 자료수집도 즉시 안 함(`collect-all`은 자료만, 사실상 미사용). **모든 생성은 새벽 cron만.** 목적="오늘 등록→내일 결과 확인"=재방문 유도(리텐션).
- **본문 모델 = Claude Sonnet**(야간 대량): 같은 CLI 구독에서 opus→sonnet이면 한도 적게 차감+빠름 → 하룻밤에 더 많은 책. 비용은 구독이라 ₩0. (소량·고품질이면 opus가 낫지만 즉시생성 경로를 다 막아 현재 opus 호출 없음.) 추론은 끔(산문엔 불필요, CLI -p 모드라 자동). 상세 [[feedback_ebook_model_choice]].
- **rate limit 안전장치**: `ClaudeRateLimitError`(CLI 한도초과 감지) → cron이 그날 밤 배치 깔끔히 중단(만든 건 저장, 다음밤 이어서).
- **시간대 정원제(품절)**: 슬롯 1~5시 × `EBOOK_SLOT_CAPACITY=5` = 총 25권/일(상수만 올리면 증설). `PUT /schedule` 슬롯 차면 409 품절, `GET /ebook/slots`로 프론트 품절표시.
- **표지 = 사용자 업로드 + AI 생성(2026-07-25 부활)**: 2026-06-11에 gpt-image-1로 자동생성했다가 "한글 텍스트 렌더링 깨짐"으로 폐기했었음. 2026-07-25에 나노바나나(gemini-3.1-flash-image)로 재도입 — 이미지 안에 글자를 아예 안 넣는 원칙(프롬프트에 명시)으로 같은 실수를 피함. 사용자 업로드도 그대로 유지(`POST /cover-url`+`PUT /cover`), AI 생성은 `POST /generate-cover`(장당 200P).
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
- `POST /ebook/:id/image-prompts` — **이미지 프롬프트 뽑기**(2026-06-14, 2026-07-25 한글화+본문맥락+과금500P로 개편): 본문 `[그림:설명]` 자리를 `lib/gemini.ts generateImagePrompts`가 추출→해당 챕터 본문 발췌까지 참고→`_genWithClaude(sonnet)`으로 자리별 **한글** 이미지 프롬프트 JSON 생성. docx 완성(`charged`) 후에만 사용 가능(`requireDocxCharged`).
- `GET /ebook/:id/image-cost` — 그림 이미지 N개 생성 시 예상 차감액(장당 단가 × N) 견적(2026-07-25).
- `POST /ebook/:id/generate-images-queue` — **그림 이미지 백그라운드 큐 등록**(2026-07-25): 자리 전체를 `imageSlotsJson`에 `status:'queued'`로 일괄 등록 + 전체 선차감(장당 200P), 실제 생성은 `lib/ebookImageQueue.ts`(전역 setInterval 15초, 1개씩)가 처리.
- `GET /ebook/:id/image-queue-status` — 큐 진행 상태 폴링(상태별 개수 + 완료 imageUrl).
- `POST /ebook/:id/generate-cover`, `GET /ebook/:id/cover-cost` — **AI 표지 생성**(2026-07-25 부활): 제목+목차 참고 한글 프롬프트(`generateEbookCoverPrompt`)→나노바나나 생성(장당 200P).
- `GET /ebook/:id/docx-estimate` — docx 생성 전 예상 차감액(글자수 기준) 견적(2026-07-25).
- `POST /ebook/internal/run-scheduled` — **새벽 cron 본체**: scheduledHour 매칭 전자책의 체크 챕터를 `collectAndWriteChapter(...,'sonnet')`로 자료+본문 생성. 한도초과 시 break(rateLimited). 완료 시 docxUrl 무효화.
- 409 처리(즉시생성 제거): `/content`·`/rewrite`·`/draft`
- 2026-07-25 신규 라이브러리: `lib/ebookImageQueue.ts`(그림 이미지 백그라운드 큐 타이머, `index.ts`에서 기동 시 1회 등록)

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
- **2026-07-25(그림·표지 AI생성 + 과금 개편, 사장 실사용 지적 연속)**:
  1. **표지 갤러리 저장**: 업로드한 표지를 내 기기에 다운로드하는 버튼 신설(HairStyleBoard 패턴 재사용, GCS CORS 우회용 중계 라우트 `GET /ebook/cover-image` 신설).
  2. **그림 이미지 AI 일괄생성 최초 버전**: "이미지 프롬프트 뽑기"로 뽑은 영문 프롬프트를 자리마다 개별 API(`POST /:id/generate-image`)로 순차 호출해 나노바나나(`generateEbookImage`, text-to-image)로 실제 이미지를 생성, 완료분은 `EbookProject.imageSlotsJson`(신규 컬럼, raw SQL ALTER)에 caption 키로 저장, docx 생성 시 `[그림: 설명]` 자리에 자동 삽입.
  3. **과금 정책 전면 개편**(사장 요청): 기존 "docx 완성 시 고정 500P" 단일 과금 → **①docx: 본문 글자수 비례**(1,000자당 200P, 1,000자 단위 올림, 최초 1회만 차감·재생성 무료, 클릭 전 견적 API `GET /:id/docx-estimate`) **②그림 프롬프트 뽑기: 일괄 500P**(고정) **③그림 이미지 생성: 장당 200P**(사전 견적 `GET /:id/image-cost`). 그림 기능(프롬프트·이미지)은 **docx를 완성(charged=true)한 사용자만** 사용 가능하도록 게이트(`requireDocxCharged`). MenuLimit에 `ebook_docx_per1k`/`ebook_image_prompt`/`ebook_image`/`ebook_cover` 신규 등록, 어드민 FEATURE_LABELS/FEATURE_COST_KRW 갱신, 나노바나나 실제 원가를 Gemini 공식가격표로 재확인해 57원(근거없는 추정)→92원(1K 이미지 $0.067 실측)으로 정정.
  4. **★쿼터 대응 구조 전환(사장 지적: "쿼터 차면 계속 실패하는 거 아냐?")**: 자리 개수만큼 프론트가 동기 순차 호출(for-await)하던 방식은 429(쿼터초과) 걸리면 남은 자리 전부 시도조차 못 하고 멈추는 구조적 문제가 있었음 → **백그라운드 큐 처리로 전환**: 버튼 클릭 시 전체 자리를 큐 등록(`POST /:id/generate-images-queue`)하고 전체 포인트 선차감 후 즉시 응답, shared-api 프로세스 내부 전역 `setInterval(15초, 1개씩)`(신규 `lib/ebookImageQueue.ts`, `index.ts`에서 서버 기동 시 1회 등록)가 여유 있게 처리. 다른 이미지 기능(헤어/나이변환/프로필사진)과 `lib/imageGenBusy.ts` 혼잡 신호등을 공유해 쿼터가 찼으면 자동으로 쉬어감. 5회 재시도 후에도 실패하면 `refundMenuPoints`로 자동 환불. 프론트는 5초 간격 폴링(`GET /:id/image-queue-status`)으로 진행률(N/M)만 표시, 창을 닫아도 서버는 계속 처리하고 재방문 시 폴링 자동 재개.
  5. **한글 프롬프트 + 본문 맥락 반영**(사장 지적: "책 본문이 한글인데 프롬프트가 영문이면 안 되지 않냐 + 복사해도 이미지가 안 만들어짐"): `generateImagePrompts`가 그림 자리 캡션 한 줄만 보고 상상하던 것을 챕터 본문 발췌(최대 1,500자)까지 참고하도록 개선, 프롬프트 자체를 영문→한글로 전환. ChatGPT 복사 시(`copyPrompt`) "아래 내용으로 이미지를 만들어줘:" 실행 지시 문구를 자동으로 앞에 붙여 복사(순수 설명문만 붙여넣으면 ChatGPT가 텍스트로만 답하던 문제 해결).
  6. **목차 생성 엔진 선택(Gemini/GPT)**: 사장이 "목차를 챗GPT가 만들 수도 있냐" 질문 → 이미 이 프로젝트에 OpenAI 연동(`_genWithGpt`, GPT-4o)이 있었음을 확인, `generateEbookToc`에 `provider` 파라미터 추가, 어드민 "공통 설정" 탭에 Gemini/ChatGPT 토글 신설(`AppConfig.ebook_toc_provider`, 클릭 즉시 저장).
  7. **AI 표지 생성 부활**(사장 요청: "제목과 목차를 참고해서 표지를 만들어주면 좋겠어"): 2026-06-11에 gpt-image-1로 시도했다 "한글 텍스트 렌더링 깨짐"으로 폐기했던 기능을 나노바나나로 재도입 — `generateEbookCoverPrompt`(제목+목차→한글 프롬프트, 이미지 안에 글자 절대 안 넣는 원칙 명시)+`generateEbookImage`에 `styleSuffix` 파라미터 추가(그림 자리/표지 스타일 분리). "표지 올리기"→"표지 만들기"로 섹션명 변경, 업로드 버튼 옆에 "✨ AI로 표지 만들기" 버튼(장당 200P, 사전 견적).
  8. **UX 버그 3건**(전부 사장 실사용 중 직접 발견): (a)`docx-estimate` 라우트가 `EbookProject`에 없는 `role` 필드를 select에 잘못 넣어 문서 다시 만들기가 500 에러로 실패하던 버그 수정 (b)창을 닫았다 다시 열면(`openProject`) `imgPrompts`를 복원 안 해서 "N/M" 진행률이 있는 버튼 자체가 사라지던 버그 수정(`imageSlotsJson`에서 caption/chapterNo/prompt를 역변환해 복원) (c)그림이 전부 완성됐는데도 "나머지 이미지 이어서 생성" 버튼이 계속 활성 상태로 남아 눌러도 반응 없던 문제 → 회색 "모든 그림 생성 완료" 배지로 전환.
  9. **UI 다듬기**: 브라우저 기본 `confirm()` 확인창(docx·그림생성 견적 2곳)을 EbookBoard 톤에 맞춘 디자인 모달로 교체(`pointConfirm` state 공용). 이미 그림이 있는 상태에서 "이미지 프롬프트 뽑기" 재클릭으로 중복 과금하는 걸 막기 위해 버튼 비활성화. "문서 만들기" 버튼은 완성된 그림이 있으면 라벨이 "🖼️ 이미지 포함 문서 만들기"로 자동 전환. 안내문 3곳을 문단→목록(`<ul><li>`)으로 재구성.
  배포: shared-api(서버1 git pull+pm2 reload 다수 회, DB: `EbookProject.imageSlotsJson` 컬럼 추가+`MenuLimit` 4건 신규 등록, 전부 raw SQL)·ai_mp(master 다수 회 push, Vercel Promote to Production 필요).
