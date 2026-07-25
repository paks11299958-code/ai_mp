# 문서 QnA (뼈대, 2026-07-24)

> 구현: 2026-07-24 신설. 어드민 전용 최소 골격 — 포인트 과금·기능카드·크론 자동화 없음.
> 다음 할일: 메모리 `project_todo.md` "문서 QnA — 뼈대에서 정식 기능화까지 남은 일" 참고.

## 배경

GCP 결제 계정에 "Trial credit for GenAI App Builder"(₩1,510,026, 100% 미사용) 크레딧이
있었는데, 6월 청구서 CSV 대조 + Google Cloud 공식 지원팀 포럼 실측으로 이 크레딧이
**일반 Gemini API 호출(우리가 이미 쓰는 것)에는 적용되지 않고, Vertex AI Search and
Conversation 전용**임을 확인했다. 이 크레딧을 실제로 써보기 위해 discoveryengine API를
신규 통합해 "문서 업로드 후 그 문서 근거로만 질문에 답하는" 기능 뼈대를 만들었다.

딥서치 결과 Vertex AI Search는 "스타트업의 문서 Q&A 앱 MVP"에 업계 표준으로 추천되는
매니지드 RAG 서비스(청킹·임베딩·검색·Gemini 근거답변을 전부 대신 해줌)임을 확인. 확정
용도: 개인/소상공인용 문서 QnA(계약서·설명서·매뉴얼 업로드 후 질문) 또는 회사 공통
FAQ/매뉴얼 QnA.

## 스코프를 어드민 전용 뼈대로 최소화한 이유

`KinAnswerPanel`(네이버 지식인 자동 답변, 2026-07-20 사장 발안)과 동일 원칙 — 자동 게시
없음, 포인트 과금 없음, 어드민 콘텐츠 탭 하나로만 존재. 이번 목적은 "기능 완성"이 아니라
"크레딧이 실제로 소진되는지 1회 실측"이라, 포인트 과금·기능카드·회원별 데이터 격리까지
다 만들면 검증과 무관한 작업이 대부분이라 판단해 최소 스코프로 좁혔다.

## 사전 필요 작업 (코드 아님 — GCP 콘솔에서 프로젝트 오너 계정으로 1회 처리)

서버(rag VM)의 서비스 계정은 Vertex AI 호출 최소 권한만 있고 프로젝트 관리 권한이 없어
(Cloud Resource Manager API 자체가 비활성) 아래는 Claude가 대행 실행할 수 없다:

1. `discoveryengine.googleapis.com` API 활성화(`gcloud services enable`)
2. 데이터스토어(Data Store) 생성 — `solutionTypes: SOLUTION_TYPE_SEARCH`
3. 엔진(Engine) 생성 — 데이터스토어 연결, `searchTier: SEARCH_TIER_ENTERPRISE` +
   `searchAddOns: [SEARCH_ADD_ON_LLM]`(answer API 필수)
4. 서비스 계정에 `roles/discoveryengine.editor` IAM 역할 부여

**실전 트러블슈팅(2026-07-24 실측)**:
- Cloud Shell에서 `gcloud auth print-access-token`으로 얻은 토큰은 quota project가
  없어 curl 요청이 403 `SERVICE_DISABLED`로 거부됨 → 해결: curl에 `-H "x-goog-user-project:
  {project_id}"` 헤더 명시(사용자 계정 재로그인/`application-default login` 불필요 —
  오히려 GCE VM에서는 그 명령 자체가 "필요 없다"는 경고를 띄움).
- IAM 정책 전파는 수십 초~1분 정도 지연될 수 있음(즉시 반영 안 됨, 재시도 필요).

## 백엔드

- **DB(raw SQL, prisma schema 밖)**: `DocQnaDoc`(id, userId, fileName, gcsPath,
  dsDocumentId, status: pending→ingesting→ready/failed, errorMessage), `DocQnaQuestion`
  (id, docId, question, answer, status: pending→answered/failed, errorMessage).
- **`shared-api/routes/aimp/doc-qna.ts`**: `requireAdmin`만 사용(포인트 로직 없음).
  `POST /docs`(PDF base64 업로드 → 기존 GCS 버킷 `ai-mp-media`의 `lib/storage.ts
  uploadToGCS` 재사용 → DB INSERT) · `GET /docs` · `POST /docs/:id/questions` ·
  `GET /docs/:id/questions`(폴링용).
- **`rag/doc_qna_worker.py`**(서버2, 신규): 크론 폴링이 아니라 **수동 CLI 실행** 전용
  (뼈대 단계 — 자동화는 정식화 이후). `python3 doc_qna_worker.py ingest <DocQnaDoc.id>`
  / `ask <DocQnaQuestion.id>`.
  - `ingest()`: GCS 경로를 `discoveryengine.DocumentServiceClient.import_documents`로
    인제스트(Long-Running Operation, `operation.result(timeout=600)`으로 완료 대기).
  - `ask()`: `discoveryengine.ConversationalSearchServiceClient.answer_query` 호출,
    serving_config은 반드시 `.../servingConfigs/default_search`(`default_serving_config`
    는 존재하지 않아 요청이 샘 — 실측 확인).
  - ★**인증 스코프 실측**: `config.get_gemini()`가 쓰는 기본 ADC로는 `import_documents`
    같은 쓰기 오퍼레이션에서 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` 발생. 반드시
    `service_account.Credentials.from_service_account_file(creds_path, scopes=
    ['https://www.googleapis.com/auth/cloud-platform'])`로 명시 스코프 지정해야 통과
    (`_discoveryengine_credentials()` 헬퍼로 구현, `config.get_gemini()`를 먼저 호출해
    `GOOGLE_APPLICATION_CREDENTIALS` 임시파일이 만들어진 뒤 사용).
  - `answer_generation_spec`에 `ignore_low_relevant_content=True` 필수(아래 실측 참고).

## 프론트 (`components/admin/DocQnaPanel.tsx`)

`KinAnswerPanel.tsx` 템플릿 재사용. PDF 업로드(여러 개 계속 추가 가능) + 문서 목록
(상태 배지) + 선택한 문서에 질문/답변 폴링 UI. 개인정보 안내 문구("민감정보는 피하고,
있다면 먼저 가려서 올려주세요" — 자동 마스킹 로직은 없음, 별도 아이디어로 분리) 포함.
`apiService.ts`에 `docQnaApi` 객체, `AdminPanel.tsx` 콘텐츠 그룹에 "문서 QnA(뼈대)" 탭.
**기능카드(`FEATURES_GRID` 등) 미등록** — 회원에게 노출되지 않음.

## 실사용 검증 (2026-07-24 완료)

이용약관 PDF(Playwright로 HTML→PDF 렌더링해 제작, `shorts-factory/assets` 폰트 재사용
시도했으나 OTF 미지원이라 Playwright 방식 채택)를 인제스트 후 질문:

> "포인트 환불 수수료에 대해 알려줘" →
> "포인트 환불 수수료는 결제 금액의 10%가 부과될 수 있습니다. ... 유료 충전 포인트의
> 경우, 결제 후 7일 이내에 미사용 상태라면 전액 환불이 가능하며..." (제5조 6개 항목
> 전부 정확히 인용, 문서에 없는 내용 없음)

**★질문 표현 방식에 따라 grounding 성공률이 갈리는 실측 발견**:
- ❌ "이 문서는", "이 약관에서" 같은 지시대명사가 든 질문
- ❌ "면책 조항에 대해 알려줘"처럼 법률 용어를 그대로 짧게 묻는 질문
- ✅ "천재지변으로 서비스가 중단되면 회사 책임은?"처럼 실제 상황을 구체적으로 풀어 쓴
  문장형 질문(같은 조항이어도 표현 차이로 성공/실패가 갈림)

실패 시 응답은 `state: SUCCEEDED`인데 `answerSkippedReasons: [OUT_OF_DOMAIN_QUERY_IGNORED]`
로 나옴 — 검색 자체(스니펫·추출답변)는 정상인데 answer_query의 관련성 판정만 낮게 나와
답변이 스킵되는 것. 이 특성을 어드민 UI 안내 문구에 실측 그대로 반영함(코드 수정 아님,
사용자 교육으로 대응).

크레딧 잔액은 검증 당일 100%에서 변화 없음으로 확인(GCP 결제 대시보드 반영 지연
가능성 — 재확인 필요, 할일 참고).

## 다음 단계 (전부 미착수, `project_todo.md` 참고)

1. **회원별 문서 격리(최우선, 이거 없이 절대 공개 금지)** — "꼬리표(메타데이터 필터링)"
   방식 확정(회원마다 별도 데이터스토어 생성 방식은 관리부담으로 기각).
2. 크론 자동화(수동 CLI → 1분 폴링 워커)
3. 포인트 과금 연결(원가 유의: Vertex AI Search 질의 1000회당 $4, 일반 Gemini보다 비쌈)
4. 기능카드 등록
5. 질문 자동 rephrase 전처리(후순위)
6. PII 자동 마스킹(별도 아이디어, 범용 업로드 안전장치로 설계할 것)
7. 페르소나별 전용 지식창고(같은 필터링 메커니즘 재사용, 채원의 기존 자기학습 루틴과
   같은 결로 확장 가능한 아이디어)
