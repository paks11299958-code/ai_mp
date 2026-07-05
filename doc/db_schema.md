# DB 스키마 (EbookProject/EbookChapter 포함)

> Prisma 마이그레이션 대신 raw SQL 직접 실행 (히스토리 없음) 
> 스키마 변경 후 반드시 `npx prisma generate` + `src/generated/prisma/` 커밋

---

## User
```
id, email(nullable), phone(nullable, unique), username, password, role(USER/ADMIN/MANAGE)
paidPoints(default:0), bonusPoints(default:0)
birthInfoJson(String?)          ← 명부 JSON 문자열
resetToken, resetTokenExpiry    ← 비밀번호 재설정 토큰 (SMS 코드도 재사용)
referralCode(String?, unique)   ← 내 추천코드(가입 시 발급, 8자) — 추천인 시스템
referredBy(Int?)                ← 나를 추천한 유저 id(가입 시 1회 기록)
referralRewarded(Bool, def:false) ← 이 유저로 인한 추천보상 지급 완료(기능 1회 사용 시 true)
```
- email, phone 둘 다 nullable — 둘 중 하나만 있어도 가입 가능
- 전화번호 저장 형식: `01012345678` (숫자만)
- role 종류: `USER`(일반), `MANAGE`(무제한, 어드민패널 없음), `ADMIN`(모든 권한+어드민패널)

## Persona
```
id(CUID), name, jobTitle, description
systemInstruction, identityPrompt
iconName, colorClass, order
imageUrl, introVideoUrl, starVideoUrl
chatBgUrl           ← JSON 배열 문자열 (배경 이미지 최대 5개)
faceReadingBgUrl    ← 관상 결과카드 배경 (String?)
isDefault, isVisible, categoryId
quickMenuJson       ← 퀵메뉴 설정 JSON 문자열
features            ← 활성 기능 키 JSON 배열, 예: ["stock","hotkeyword"] (String?, null이면 프론트 이름 폴백)
```
- `starVideoUrl`: 별스타 100개 이상 수신 시 재생할 감사 영상 URL (GCS)
- `features`: 채팅 화면에 노출할 기능 버튼 키 목록. 키→라벨/아이콘/색은 `frontend/personaFeatures.ts` FEATURE_REGISTRY가 단일 출처(news/stock/hotkeyword/used/luxury/mathtutor/club/golf-swing/golf-record). null/빈배열이면 이름 기반 폴백(레거시 보존). 어드민 PersonaInfoTab "활성 기능" 체크박스로 관리.

## ChatSession / Message
```
ChatSession: id, userId, personaId, title, createdAt
Message: id, sessionId, role, text, createdAt
```

## UserPersonaXp
```
userId + personaId (복합키), xp(default:0)
```
XP 레벨 기준 → [points_payment.md](points_payment.md) 참조

## PointTransaction
```
id, userId, amount, type(String), description
orderId(String? @unique, 2026-06-17 — 충전 중복결제 DB 차단)
personaId, balanceAfter, createdAt
type 값: CHAT | SIGNUP | LEVELUP | ADMIN | BALLOON | STAR | MISSION | CHARGE | MENU | REFERRAL(예정)
```
- 차감 단가는 MenuLimit(feature×role) — 어드민 메뉴권한 탭 관리. 상세 points_payment.md

## UserMemory
```
id, userId, content, embedding(vector 768차원)
category, createdAt
```
- 코사인 유사도 0.72 이상 검색
- 유저당 일반 기억 최대 100개 (초과 시 가장 오래된 것부터 삭제)
- 골프/사주 분석 기억은 100개 제한 제외

## PartnerPost / PartnerReply
```
PartnerPost: id, userId, title, content, contact(nullable), createdAt, updatedAt
PartnerReply: id, postId, userId, content, isAdminReply(boolean), createdAt
```
- `isAdminReply`: 관리자 답글 → 프론트에서 `관리자` 뱃지 표시

## CorpCode
```
corpCode (PK), corpName, stockCode(nullable), modifyDt
@@index([corpName])
```
- DART OpenAPI `corpCode.xml` 에서 전체 118,033개 기업 일괄 import
- `stockCode`: 상장사만 값 있음 (비상장사 null)
- 어드민 패널 → DART 기업코드 갱신 버튼으로 수동 갱신

## StockAnalysis
```
id, userId, stockName, corpCode(nullable), yahooSymbol(nullable)
chartImageUrl(nullable)     ← 분석 시 GCS에 저장한 네이버 금융 차트 이미지 URL
status(pending|processing|completed|failed)
analysisReport(Text)        ← Gemini 전체 보고서 + Claude/GPT 의견 합산
claudeReport(Text, nullable) ← Claude Sonnet 투자 의견
gptReport(Text, nullable)    ← GPT-4o 투자 의견
sourceLinks(JSON 배열), errorMessage(nullable)
createdAt, updatedAt
```
- Vercel Cron (`* * * * *`) → `cron-stock-worker.ts` → Gemini+Claude+GPT 3중 AI
- Gemini: Google Search 그라운딩 포함 전체 보고서 / Claude·GPT: DART+Yahoo 데이터 기반 의견
- 비용: 50P / 일일 1회 제한 (어드민 예외)

## StockReportChunk
```
id, userId, ticker(종목코드), stockName
reportDate(YYYY-MM-DD), quarter(e.g. 2026_2Q)
chunkIndex, content(Text)
embedding(vector 768차원, nullable)
createdAt
@@index([userId, ticker])
```
- 주식 분석 보고서를 900자 단위로 청킹 (오버랩 없음) 후 text-embedding-004 임베딩 저장
- 사용자별 격리: 동일 userId+ticker는 학습하기 클릭 시 기존 삭제 후 재저장
- ivfflat 인덱스 (vector_cosine_ops, lists=100)
- 윤채원 채팅 시 코사인 유사도 0.55 이상 top-5 청크를 RAG로 주입
- 비용: 무료

## LuxuryVerification
```
id, userId, imageUrls(JSON), brandHint(nullable)
status(pending|processing|completed|failed)
geminiBrand, geminiModel, geminiScore, geminiPoints(JSON), geminiVerdict, geminiSummary
claudeBrand, claudeModel, claudeScore, claudePoints(JSON), claudeVerdict, claudeSummary
gptBrand,    gptModel,    gptScore,    gptPoints(JSON),    gptVerdict,    gptSummary
finalScore, finalVerdict, agreements(JSON), disagreements(JSON)
errorMessage(nullable), createdAt, updatedAt
```
- Gemini 2.5 Flash + Claude Sonnet + GPT-4o 3중 병렬 분석
- 점수 기반 시장 등급: 90+(정품예상/초록), 80-89(미러급/보라), 70-79(S급/노랑), 60-69(A급/주황), ~59(B급/빨강)
- 분석 완료 후 GCS 이미지 자동 삭제
- 비용: 50P / 일일 1회 제한 (어드민 예외)
- 신은비 페르소나 전용

## InsuranceAnalysis (보험 중복보장 분석, 2026-06-13)
```
id, userId, fileUrls(JSON), fileNames(JSON), userInfo(JSON: title/gender/age/job/health/budget/purpose/lunar)
status(pending|processing|completed|failed)
extractedJson(1단계 추출)
totalPolicies, duplicateCount, monthlySavings, riskLevel, duplicatesJson(JSON), aiSummary, recommendation, disclaimer
consultingReport(종합 컨설팅 보고서, 1회 생성 후 영구 저장)
errorMessage(nullable), createdAt, updatedAt
```
- 비동기 큐(명품검증 패턴): pending → 서버1 cron insurance-worker → Gemini 2.5 2단계(추출→중복분석)
- PDF/이미지 모두 Gemini fileUri로 직접 분석, 완료 후 GCS 파일 삭제
- 비용: 기본 50P(MenuLimit feature 'insurance') + 실패 환불
- 김지훈 페르소나(cmqcbkt4y0000rpbefrh2z8rb) features=["insurance"]
- 서버1 raw SQL CREATE/ALTER (db push 금지). 상세 doc/features/insurance_analysis.md

## Credit4uAccount / CodefToken (내보험 가져오기 Codef, 2026-06-14)
```
Credit4uAccount: id, ssnHash(유니크, SHA-256(주민번호) — 원문 미저장), credit4uId, credit4uPw, registeredAt, updatedAt
CodefToken:      id, clientId(유니크), accessToken, tokenType, expiresIn, issuedAt, expiresAt, refreshToken?, updatedAt
```
- Codef credit4u(금감원 내보험다보여) 자동 조회용. SSN은 해시만, credit4u 포털 계정 자동생성·캐시
- CodefToken은 OAuth 토큰 7일 캐시(서버리스/재기동 대응)
- 서버1 raw SQL. 상세 doc/features/insurance_analysis.md

## AiFeatureIdea / DevRequest (AI 아이디어 자율 파이프라인, 2026-06-15)
```
AiFeatureIdea: id, ideaDate(DATE 유니크=하루1행), content(후보 전문), createdAt
DevRequest:    id, request(개발 요청문), source, status(pending|processing|done|failed), result, createdAt, updatedAt
```
- AiFeatureIdea: 스카우트(rag/ai_feature_scout.py)가 매일 저장 → 어드민 'AI 아이디어' 탭 조회
- DevRequest: 어드민 '개발 요청' 버튼 → 큐 적재 → 서버2 dev_request_worker가 폴링→hermes.run 위임
- 둘 다 aichat DB, 서버1 raw SQL. 상세 메모리 project_ai_feature_scout

## HairStyle (윤채린 헤어스타일 진단, 2026-06-16)
```
id, styleKey(유니크: f_bob/m_twoblock 등), name(단발 보브), gender('male'|'female'),
imageUrl(Imagen 견본 GCS URL), promptEn(영문 헤어설명=어울림분석·합성 참고), description, order, isVisible, createdAt
@@index([gender, order])
```
- 견본은 imagen-3.0-generate-002로 생성(남8/여8)→GCS `hairstyles/`. 합성결과는 GCS `hair-tryon/`(DB 저장 안 함).
- 백엔드 GET /hair/styles(목록) + POST /hair/analyze(진단+합성). 상세 메모리 project_hair_styling

## UsedItemListing
```
id, userId, imageUrls(JSON), itemName(nullable)
status(pending|processing|completed|failed)
category, brand, modelName, condition, conditionDetail
visibleDamage(JSON), includedItems(JSON), confidence(Float)
suggestedPrice(avg), claudePrice, gptPrice   ← 3 AI 가격 평균 → suggestedPrice
minPrice, maxPrice, priceReason
aiTitle, aiDescription, aiHashtags(JSON)
finalTitle, finalPrice, finalDescription
errorMessage(nullable), createdAt, updatedAt
```
- Gemini(이미지 분석+판매글 생성) + Claude+GPT(가격 추정) 3중 AI
- 최종 가격 = 3개 AI 추천가 평균 (100원 단위 반올림)
- 분석 완료 후 GCS 이미지 자동 삭제
- 비용: 50P / 일일 1회 제한 (어드민 예외)

## 기타 모델
```
GolfCourse          ← 골프장 정보 (hasAuto, bookingUrl, advanceDays, openHour, openMinute)
GolfBookingSchedule ← 예약 스케줄 (scheduledAt, openAt, preferredTime ← 희망 티타임 HH:MM)
```

## GolfBookingSchedule
```
id, userId, courseId
golfDate(YYYY-MM-DD), timePeriod(morning/afternoon/evening)
preferredTime(HH:MM, nullable)  ← 희망 티타임 (선택사항)
scheduledAt                     ← 봇 실행 시각 (openAt - 3분, UTC)
openAt                          ← 예약 오픈 시각 (사용자 직접 입력 KST → UTC 변환)
status(pending|running|success|failed), resultMsg
```
- 예약 오픈 날짜+시간: 사용자가 직접 입력 (자동계산 제거)
- `kstToUtc(date, time)` — `golf.ts`에서 KST "YYYY-MM-DD HH:MM" → UTC Date 변환

## 기타 모델
```
Category            ← 페르소나 카테고리
PersonaKnowledge    ← 페르소나별 지식 (RAG)
PersonaImage        ← 페르소나 갤러리 이미지
PersonaTriggerVideo ← 키워드 트리거 영상
Announcement        ← 공지사항
ConversationSummary ← 대화 요약 (10개 단위)
StarBalloon         ← 별스타 선물 기록
BoardPost           ← Q&A 게시판 글
BoardReply          ← Q&A 게시판 답글
SwingAnalysis       ← 골프 스윙 분석 결과
AppConfig           ← 앱 전역 설정
```

---

## EbookProject / EbookChapter (전자책, 2026-06-07~10)
```
EbookProject:
  id(Int), userId, topic, title(String?)
  author(String?)         ← 2026-06-10, 저자명(제목과 함께 저장·가지고 다님, .docx/PDF 재사용)
  coverUrl(String?)       ← 2026-06-11, 표지 이미지 GCS URL(챗GPT gpt-image-1 생성, .docx 첫페이지 삽입)
  tocJson(String?)        ← 목차+챕터 전체 JSON [{no,title,summary,sourceStatus,sources,collect,contentMd,contentVariants,finalProvider}]
  status(default:"toc")   ← toc | draft | done
  scheduledHour(Int?)     ← 2026-06-10, 자료 일괄수집 새벽 예약시각(KST 1~5), null=미예약. 새벽 cron(서버1 crontab UTC16~20=KST1~5)이 매칭 전자책의 체크 챕터 자료수집+본문생성 자동
  errorMessage(String?), createdAt, updatedAt
EbookChapter:
  id, projectId(FK Cascade) ... ← 선생성됐으나 실제 챕터는 EbookProject.tocJson(JSON)에 저장(이 테이블 미사용)
```
- ⚠️ **챕터는 EbookChapter row가 아니라 `EbookProject.tocJson`(JSON 배열) 안에 저장.** 자료/본문/체크(collect)/상태 전부 tocJson 챕터 항목에. → tocJson을 덮어쓰는 모든 경로(PUT /toc 등)에서 기존 필드(sources/contentMd/finalProvider/collect 등) 보존 필수.
- 강지훈 페르소나(id=writer) 전용. **3탭 파이프라인**(제목·목차/자료수집/초안). 2026-06-11 대개편=북크크 양식 **.docx**(docx npm) 중심 + 챗GPT(gpt-image-1) 표지 + 자료수집→본문 자동화(cron). 상세 메모리 [[project_ebook_pipeline]].

## Raw SQL 예시

```sql
-- 컬럼 추가
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "faceReadingBgUrl" TEXT;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "features" TEXT;  -- 2026-06-02, 활성 기능 키 JSON 배열
ALTER TABLE "EbookProject" ADD COLUMN IF NOT EXISTS "scheduledHour" INTEGER;  -- 2026-06-10, 전자책 자료수집 새벽 예약
ALTER TABLE "EbookProject" ADD COLUMN IF NOT EXISTS "author" TEXT;            -- 2026-06-10, 저자명
ALTER TABLE "EbookProject" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;          -- 2026-06-11, 표지 이미지 URL(gpt-image)
ALTER TABLE "EbookProject" ADD COLUMN IF NOT EXISTS "charged" BOOLEAN NOT NULL DEFAULT false;  -- 2026-06-18, 본문 차감 1회 플래그(.docx 받을 때 차감)

-- 2026-06-18: 무료였던 웹툰·모임·전자책 차감 기능화
-- 웹툰 회차 첫 열람 기록(있으면 재열람 무료)
CREATE TABLE IF NOT EXISTS "WebtoonView" (
  id SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "webtoonId" INTEGER NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebtoonView_user_webtoon_unique" UNIQUE ("userId","webtoonId")
);
-- MenuLimit 단가: webtoon/club 100pt, ebook 500pt (× USER·MANAGE·ADMIN). 어드민 메뉴권한 탭에서 조정.

-- 2026-06-21: 윤채린 나이 변환 (10·30·50·70대 생성, 저장 시에만 row)
CREATE TABLE IF NOT EXISTS "AgeTransform" (
  id SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL,
  "originalUrl" TEXT, "imagesJson" TEXT NOT NULL,   -- imagesJson={"10s":url,"30s":url,"50s":url,"70s":url}
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AgeTransform_userId_idx" ON "AgeTransform"("userId");
-- MenuLimit agetransform 100pt (개당, × 3역할). imagesJson={"42":url,"60":url,...} 목표나이 키.

-- User phone 컬럼
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"(phone);
ALTER TABLE "User" ALTER COLUMN email DROP NOT NULL;

-- 추천인(레퍼럴) 시스템 (2026-06-22, 서버1 raw SQL 선반영 완료)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralRewarded" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
-- PointTransaction.type 에 'REFERRAL' 추가(추천 보상, 무상지급 그룹). 별도 ALTER 불필요(type=String).

-- 마케팅 자산 (2026-06-27, 이아린 /marketing 산출물 = 리서치+초안). 어드민 조회·복사용(재발행 X).
-- ★서버1 운영DB는 raw SQL로만 생성(db push 금지 — git schema 불일치로 기존 테이블 삭제 위험).
CREATE TABLE IF NOT EXISTS "MarketingAsset" (
  "id" TEXT PRIMARY KEY,                 -- rag가 'mkt_'+hex 로 생성(cuid 호환)
  "topic" TEXT NOT NULL, "channel" TEXT NOT NULL,   -- channel: thread|instagram|blog
  "report" TEXT NOT NULL, "draft" TEXT NOT NULL,    -- 리서치 / 콘텐츠 초안
  "sourcesCount" INTEGER NOT NULL DEFAULT 0,
  "filePath" TEXT,                       -- reports/marketing/ 파일 경로
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketingAsset_createdAt_idx" ON "MarketingAsset"("createdAt");
-- 적재=rag(서버2)가 서버1 DSN 직접 INSERT. 조회=shared-api GET /api/aimp/marketing/assets(requireAdmin).

-- 사용자용 마케팅 서비스 요청 큐 (2026-06-28, 개인 SNS 운영자 '✍️ AI 마케팅 글쓰기').
-- ★raw SQL CREATE만(db push 금지) + schema.prisma에 MarketingRequest 모델 동기화(db push 지뢰 제거).
-- 쓰기=shared-api(요청 생성)+서버2 워커(결과/환불 직접 psycopg2). 단가=MenuLimit 'marketing'(폴백 200pt).
CREATE TABLE IF NOT EXISTS "MarketingRequest" (
  "id" TEXT PRIMARY KEY,                 -- shared-api가 'mkreq_' 로 생성
  "userId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'instagram',
  "status" TEXT NOT NULL DEFAULT 'pending',   -- pending|running|done|failed
  "result" TEXT, "report" TEXT,          -- 완성 초안 / 리서치(참고)
  "sourcesCount" INTEGER NOT NULL DEFAULT 0,
  "pointsCharged" INTEGER NOT NULL DEFAULT 0, -- 사전 차감(환불 근거)
  "isFreeTrial" BOOLEAN NOT NULL DEFAULT false, -- 무료체험 1회 여부
  "failReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketingRequest_status_idx" ON "MarketingRequest"("status");
CREATE INDEX IF NOT EXISTS "MarketingRequest_userId_idx" ON "MarketingRequest"("userId","createdAt");
-- 흐름: 웹 POST /marketing/request(차감)→pending→서버2 marketing_request_worker.py(*/2 cron)→done/failed(+환불).
```

### 회원 탈퇴(하드 삭제) 주의
User의 대부분 관계는 `onDelete: Cascade`라 자동 삭제되나, **BoardReply / PartnerReply는 onDelete 미지정(Restrict)** → User 삭제 전 트랜잭션에서 선삭제 필요. 라우트(`DELETE /admin/users/:id` 어드민, `DELETE /api/aimp/user` 본인)가 이를 처리하므로 스키마/FK 변경 없이 무중단.


## 2026-07-05 추가 (raw SQL — prisma db push 금지 원칙)

- **`AgentGrowth`** (신규): 직원 AI(지우·지훈·아린) 자기개발 성장 기록. `id SERIAL PK, agent TEXT('dev'|'search'|'marketing'), kind TEXT(study|proposal_approved|proposal_rejected|idea_adopted|work_done), topic, summary, "wikiPath", xp INT, "createdAt"`. 인덱스 (agent,"createdAt"). XP 규칙·레벨 정본=rag/agent_growth.py. 어드민 '직원 성장' 탭(2단계 예정) 데이터 소스. ★schema.prisma 미반영(rag가 psycopg2 직접 사용) — shared-api에서 읽을 땐 $queryRaw.
- **`pointsCharged INT?`** 컬럼 4개 테이블 추가: StockAnalysis·LuxuryVerification·UsedItemListing·InsuranceAnalysis — 비동기 분석 요청 시 실제 차감 포인트 저장(실패 환불 정확화). schema.prisma 반영됨(+generate).

## 2026-07-06 추가

- **`TarotReading`** (raw SQL+schema 반영): 타로 리딩 보고서. `id('tr_'), userId, question?, cardsJson, interpretationsJson, shareId?(UNIQUE, 옵트인 공유), createdAt`. 공개조회는 shareId 있는 행만·사용자정보 미포함. 상세 doc/features/tarot.md.
