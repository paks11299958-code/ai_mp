# 보험 중복보장 분석 — 김지훈 페르소나

보험증권을 업로드하면 AI가 중복 보장 항목을 찾아 절감액과 종합 컨설팅 보고서를 만들어주는 기능. 별도 프로젝트 insure4(github.com/paks11299958-code/insure4, Next.js+Claude)의 2단계 분석 로직을 ai_mp 패턴으로 재구현(2026-06-13). **김지훈 페르소나**(id=`cmqcbkt4y0000rpbefrh2z8rb`)에 연결.

## 흐름 (비동기 큐 — 명품검증 패턴)
1. 김지훈 채팅 기능아이콘 **🛡 보험 분석** → `InsuranceBoard` 오픈. 본문은 **탭 2개**: `분석 내역(건수)` / `+ 새 분석하기`(기본=내역, 내역 비면 새분석 유도)
2. '새 분석하기' 탭: 기본정보 입력(제목·성별·생년월일 + 직업·건강·예산·목적). 생년월일은 **연/월/일 드롭다운 + 양력/음력 체크**
3. 보험증권 **PDF/이미지** 업로드(GCS signed-url, 최대 5개)
4. "AI 중복 분석 시작" → 포인트 차감 → `InsuranceAnalysis` `pending` 생성 → **자동으로 내역 탭 전환 + 맨 위 스크롤**(진행상황)
5. **서버1 cron(insurance-worker 매분)** 처리 → 완료 시 결과 카드(중복항목·절감액·위험도 + 상세 + AI권고)
6. 결과 화면에서 **종합 컨설팅 받기**(영구 보고서) / **채팅 상담**(추가 질문) / **인쇄·PDF**

## 2단계 분석 (Gemini 2.5-flash)
worker(`routes/aimp/workers/insurance.ts`, internal-cron이 mount):
- **1단계 추출**(insExtract): PDF/이미지를 `fileData:{fileUri, mimeType}`로 Gemini Vision에 직접 전달 → 증권별 보장항목 추출(원문 그대로, 창작 금지). mime은 공용 `lib/geminiJson.ts`의 `guessMime`(PDF 포함).
- **2단계 중복분석**(insAnalyze): 추출 데이터만으로 중복(완전/부분/유사) + 절감액 + severity + 권고 도출. 가입자 정보(만 나이 환산·음력 표기) 반영. Gemini 호출·JSON파싱은 공용 `callGemini/callGeminiJson`(usage 자동로깅).
- 결과를 InsuranceAnalysis 컬럼들에 저장, 업로드 문서는 GCS 삭제(개인정보 미저장)

## 종합 컨설팅 보고서 (분석에 영구 저장)
- `POST /insurance-analysis/:id/consulting`: 김지훈 systemInstruction + 분석데이터(buildInsuranceContext)로 Gemini가 보고서 생성 → **`InsuranceAnalysis.consultingReport` 컬럼에 영구 저장**(1회 생성 후 재사용, body.force로 재생성)
- 프롬프트(CONSULTING_INSTRUCTION) — **상세 보고서**(요약본 아님): 도입 멘트 + ##1 중복현황(**마크다운 표**: 보장항목·중복유형·기존보장·권고·절감액 + 표 아래 '중복 항목별 상세'에 왜 중복인지 근거 2~3문장) / ##2 보완보장(권장 가입금액·연령대 근거) / ##3 절감액 활용 / ##4 추가확인 질문 + 마무리. ⚠️"30자 이내·장황금지" 같은 과한 길이제한은 요약본을 만드니 금지.
- 프론트 렌더: **화면**=react-markdown(`.ins-report` 스타일=표/소제목/불릿, 모바일 가로스크롤, index.css) + **기본 닫힘** 접기/펼치기. **인쇄·PDF**=별도 HTML이라 경량 `mdToHtml`(소제목·표·굵게·불릿 변환) 사용 — ⚠️인쇄는 react-markdown 안 거치므로 마크다운→HTML 변환 필수(안 하면 ##·|표| 원문 노출).
- 채팅 휘발이 아니라 **분석 1건 = 영구 컨설팅 문서**(재방문 시 항상 표시, 기본 접힘)

## 채팅 상담 (추가 질문용, 보조)
- App.tsx `handleInsuranceConsult`: 분석결과를 김지훈 세션에 **model role 메시지로 saveMessage** → chat-stream이 history(최근30개 Message)에 포함해 AI가 참고. ⚠️채팅은 백엔드가 sessionId로 DB Message를 읽으므로 화면표시(addMessageToSession)만으론 AI가 못 봄 → DB 저장 필수. model role은 포인트 차감 없음(sessions.ts는 user만 차감)

## 포인트
- `menuAccess` feature key `insurance` — MenuLimit 정책 없으면 **기본 50P 자동 차감** + 실패 시 환불

## 파일
- 백엔드(shared-api): `routes/aimp/insurance-analysis.ts`(upload-urls/POST/GET/:id/retry/consulting/DELETE) + index.ts 등록 + `routes/aimp/workers/insurance.ts`(insurance-worker, internal-cron이 mount) + 공용 `lib/geminiJson.ts`·`workers/_shared.ts`(runWorker) + prisma `InsuranceAnalysis` 모델
- 프론트: `components/InsuranceBoard.tsx`(업로드+기본정보+결과+컨설팅) + `personaFeatures.ts` insurance 키 + `useBoardToggles.ts` showInsuranceBoard + App.tsx 3곳 렌더
- DB(서버1 raw SQL, db push 금지): InsuranceAnalysis 테이블 + consultingReport 컬럼. 김지훈 features=["insurance"]
- vercel.json `/api/insurance-analysis` 프록시, 서버1 crontab insurance-worker 매분

## 사용법 도움말
- 인라인 가이드 아님 — 헤더 도움말(?) 모달 **HelpButton** 사용(전 기능 통일). [features 도움말 통일 → ui_improvements 또는 메모리 project_guide_cards 참조]
