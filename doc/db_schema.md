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
introText           ← 공유 딥링크 안내 모달 소개문(2026-07-28 신설, String?)
systemInstruction, identityPrompt
iconName, colorClass, order
imageUrl, introVideoUrl, starVideoUrl
chatBgUrl           ← JSON 배열 문자열 (배경 이미지 최대 5개)
faceReadingBgUrl    ← 관상 결과카드 배경 (String?)
isDefault, isVisible, categoryId
quickMenuJson       ← 퀵메뉴 설정 JSON 문자열
features            ← 활성 기능 키 JSON 배열, 예: ["stock","hotkeyword"] (String?, null이면 프론트 이름 폴백)
```
- **`User.lastLoginAt`**(2026-07-28 신설, DateTime?): 마지막 로그인 시각. 어드민 회원 목록 '최근 접속' 열 — 가입일만으론 "가입만 하고 안 오는 사람"과 "계속 쓰는 사람"이 구분되지 않는다. 토큰 발급 5개 경로(`/login`·`/register`·`/guest-register`·`/upgrade-guest`·카카오) 모두에서 `touchLastLogin()`이 fire-and-forget으로 기록(실패해도 로그인은 진행). 도입 이전 로그인은 기록이 없어 화면에 `—`로 뜬다.
- `introText`(2026-07-28): 공유·초대 링크(`?p=`/`?f=`)로 처음 온 사람에게 뜨는 안내 모달의 소개문. **비면 `description`으로 폴백**. 어드민 PersonaInfoTab '공유 링크 소개문'에서 편집. ★도입 배경: 원래 프론트가 모달을 열 때마다 `systemInstruction`을 파싱해 만들었는데, 결과가 늘 같은데도 매번 계산했고 그러려고 **프롬프트 전문이 `/api/personas` 응답에 실려 클라이언트까지 내려갔다**. 이제 프론트는 이 컬럼만 읽는다 — `systemInstruction`을 목록 응답에서 제외하는 후속 정리가 가능해졌다(현재는 여전히 반환 중).
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

- **`AgentGrowth`** (신규): 직원 AI(지우·지훈·아린·채원) 자기개발 성장 기록. `id SERIAL PK, agent TEXT('dev'|'search'|'marketing'|'stock'), kind TEXT(study|proposal_approved|proposal_rejected|idea_adopted|work_done), topic, summary, "wikiPath", xp INT, "createdAt"`. 인덱스 (agent,"createdAt"). XP 규칙·레벨 정본=rag/agent_growth.py. 어드민 '직원 성장' 탭(✅2단계 완료 07-17) 데이터 소스. ★schema.prisma 미반영(rag가 psycopg2 직접 사용) — shared-api에서 읽을 땐 $queryRaw.
- **`pointsCharged INT?`** 컬럼 4개 테이블 추가: StockAnalysis·LuxuryVerification·UsedItemListing·InsuranceAnalysis — 비동기 분석 요청 시 실제 차감 포인트 저장(실패 환불 정확화). schema.prisma 반영됨(+generate).

## 2026-07-06 추가

- **`TarotReading`** (raw SQL+schema 반영): 타로 리딩 보고서. `id('tr_'), userId, question?, cardsJson, interpretationsJson, shareId?(UNIQUE, 옵트인 공유), createdAt`. 공개조회는 shareId 있는 행만·사용자정보 미포함. 상세 doc/features/tarot.md.

## 2026-07-06~07 추가 (raw SQL)

- **`EmbedGuestLog`**: 임베드 위젯 게스트 사용 로그(guestId·ip·personaId·createdAt) — 무료 3회/일 이중 제한 카운트. doc/features/embed_widget.md.
- **`CompanyLedger` / `CompanyPlan`**: 주식회사 헤르메스 장부·주간계획(rag가 psycopg2 직접 사용, prisma 미반영이 정상 — shared-api에서 읽을 땐 $queryRaw). 잔액=SUM(amount) WHERE status IN ('recorded','paid'). 정관=company-wiki 운영헌장.

## ReferralVisit (2026-07-07, 바이럴 측정 — raw SQL 전용, prisma schema 미반영)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | SERIAL PK | |
| code | TEXT NOT NULL | 추천 코드(대문자 4~16) |
| ipHash | TEXT NOT NULL | sha256(salt+IP) 32자 — 원본 IP 미저장(PII 최소) |
| ua | TEXT | User-Agent 120자 절단 |
| createdAt | TIMESTAMP DEFAULT NOW() | |

- ★UNIQUE INDEX `(code, ipHash, (createdAt::date))` — 일1회 dedupe(INSERT ... ON CONFLICT DO NOTHING).
- 조회는 $queryRawUnsafe(스키마 미반영 테이블). 어드민 레퍼럴 탭 퍼널의 '방문' 데이터 소스.


## ConsultBot / ConsultLead (2026-07-08, AI상담 봇 만들기 — raw SQL 전용, prisma schema 미반영)

- **`ConsultBot`**: 사용자가 만든 상담봇 테넌트. `slug`(UNIQUE, 링크 /consult/{slug}, 랜덤 11자=PII 미노출)·
  `ownerId`(User.id 문자열)·`companyName`·`greeting`·`notifyEmail/Phone/TelegramChatId`·`showAvatar`·
  `themeColor`·`customTypebotId`(Phase2 예약)·`isActive`. 유저당 활성 3개 한도(라우트에서).
- **`ConsultLead`**: 방문자 문의. `botSlug`(FK→ConsultBot.slug)·`userName`·`userPhone`·`userEmail`·
  `inquiryType`·`message`·`notifiedAt`(알림 발송 성공 시각).
- 조회/삽입 전부 $queryRawUnsafe/$executeRawUnsafe (스키마 미반영). 공개 조회 응답에 알림 연락처 금지.
- 상세: doc/features/consult_bot.md, 라우트=shared-api routes/aimp/consult.ts.

## StockDiscovery (2026-07-09, 채원 발굴 일기 — raw SQL 전용, prisma schema 미반영)
- 윤채원이 매일 아침 발굴한 코스피·코스닥 각 1종목을 날짜별로 누적 저장. 어드민 발굴 탭이 조회.
- 컬럼: `id, "tradeDate"(TEXT, UNIQUE=하루 1행), "kospiJson"(JSONB), "kosdaqJson"(JSONB), comment(TEXT), "createdAt"`.
- kospiJson/kosdaqJson = `{symbol,name,score,threshold,signal,price,detail,summary}`. ON CONFLICT("tradeDate") DO UPDATE(같은날 재실행 덮어쓰기). 조회는 shared-api `$queryRawUnsafe`. 상세 doc/features/toss_trader_admin.md.

## 2026-07-09 추가 (raw SQL)
- **`StockAnalysis.tgNotifiedAt TIMESTAMP?`** 컬럼: 어드민 종목 분석(비동기) 완료분을 텔레그램으로 1회만 발송하기 위한 발송 시각 플래그. admin_analysis_notify 크론(서버2, 2분)이 NULL인 완료건을 찾아 발송 후 기록.

## LearnQuizRecord (2026-07-10, 학습자료 학습평가 합격 기록 — raw SQL 전용, prisma schema 미반영)
- 학습 코스(/learn/{course}) 학습평가(10문제×10점) 합격 기록. 100점 합격 시 제목 '✅ 완료' 배지+다음 코스 잠금해제 근거.
- 컬럼: `id, "userId"(INT), "courseKey"(TEXT), score(INT), "passedAt"(TIMESTAMP?, 최초 합격일 고정), "updatedAt"`. UNIQUE("userId","courseKey").
- upsert 정책: score=GREATEST(최고점 유지), passedAt=COALESCE(재응시해도 최초 합격일 보존).
- 라우트=shared-api `routes/aimp/learn.ts`(GET/POST /api/aimp/learn/quiz-record, 코스 화이트리스트). 상세 doc/features/learn_course.md.

## DailyBizReport / BizDirective (2026-07-11, 헤르메스 경영 루프 — raw SQL 전용, prisma schema 미반영)
- **`DailyBizReport`**: 일일 경영 지표(reportDate UNIQUE upsert). `revenueKrw·chargeCount·aiCostUsd·newUsers·guestUsers·dau·chatCount·pointSpent·topFeaturesJson·errorCount·tossPnlKrw·reportMd`. 생산=서버2 rag/biz_report.py(크론 KST09:03, ★KST 하루→UTC 경계 변환). 소비=어드민 경영 리포트 탭(GET /api/aimp/biz/daily-reports).
  - ★**`newUsers`=정회원만, `guestUsers`=체험계정(`provider='guest'`)** — 분리 필수(2026-08-07). 합산하던 시절 2026-07 가입이 43명으로 보였으나 **실제 정회원은 17명**(나머지 26명은 레퍼럴 체험계정)이었고, 8월은 **실회원 0명인데 17명으로 표시**돼 하락 전환을 3주간 못 잡았다. 컬럼 추가는 raw SQL(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), 과거분은 `biz_report.collect/save`를 날짜 루프로 돌려 재집계(2026-07-01~08-06 37일 완료).
- **`BizDirective`**: 헤르메스 경영 지시 추적. `createdDate·source('council')·title·detail·assignee(dev/search/marketing)·status(proposed→queued→done/failed→evaluated | boss_decision)·devRequestId·resultNote·effectNote`. 생산=biz_council.py(화·금 09:30), staff 지시는 DevRequest(pending) 기안과 연동.

## 인덱스 추가 이력
- 2026-07-08: `Message(sessionId, createdAt)` · `ChatSession(userId)` — 대화 무료화 일일 한도(countTodayChatMessages) 판정용, 서버1 raw SQL `CREATE INDEX IF NOT EXISTS`.
- 2026-07-09: `StockDiscovery("tradeDate")` UNIQUE · `StockDiscovery("createdAt" DESC)`.

## 운영 DB 전용 테이블 (raw SQL — prisma schema 밖, db push 금지)

토스 자동매매·발굴 관련(2026-07 신설, 접근=$queryRawUnsafe):

- **StockDiscovery** — 채원 아침 발굴 일기(하루 1행): tradeDate(UNIQUE)·kospiJson·kosdaqJson·
  comment(📋 시황 브리핑 5줄 포맷)·**holdingsJson**(💼 보유 재점검, 2026-07-16 추가)·createdAt
- **DiscoveryRecord** — 발굴 아카이브(발굴일×종목 UNIQUE, 2026-07-15): score·scoreDetail(JSONB)·
  recommended·**pullback**(🔁 눌림목, 07-16 추가)·close/high/low/volume·volRatio·
  investorFlow(JSONB)·newsJson(JSONB)·source(bot_scan/chaewon)
- **DiscoveryMarket** — 발굴일 1행: 코스피/코스닥 종가·등락률+Gemini 증시요약
- 생성 스크립트: `shared-api/scripts/add-discovery-tables.cjs` (컬럼 추가는 ALTER 단발)

## AgentIdea (2026-07-17, 직원 성장 엔진 3단계 — raw SQL 전용, prisma schema 미반영)
- 직원(지우·지훈·아린·채원)의 학습 지식 기반 아이디어 제안 큐. 생산=서버2 rag/agent_idea_cron.py(화·목 KST09:20, 직원당 1건·14일 중복회피). 소비=어드민 AI 아이디어 탭 '직원 제안' 섹션.
- 컬럼: `id SERIAL PK, agent TEXT(dev|search|marketing|stock), title, content, status TEXT(pending|converted|archived), "devRequestId" INT?, "createdAt"`. 인덱스 (status)·(agent).
- 전환: POST /admin/agent-ideas/:id/convert → DevRequest(source='agent-idea') 생성+status=converted+devRequestId 기록+**AgentGrowth idea_adopted(+100)**. 완수: dev_request_worker가 done 시 devRequestId 역조회→work_done(+150).
- ★AiFeatureIdea 재사용 불가 사유: ideaDate UNIQUE(스카우트 하루 1행 blob)라 직원 다건 제안과 충돌 — 분리 신설. 생성 스크립트=shared-api/scripts/add-agent-idea-table.cjs.

## HomepageRequest (2026-07-17, 홈페이지 만들기 — raw SQL 전용, prisma schema 미반영)
- 신청 큐(선차감+실패 자동환불): `id SERIAL PK, "userId" INT, "formJson" TEXT(신청서 JSON:
  biz/name/tagline/detail/menu/address/hours/phone/kakao/mood/referenceUrl), status TEXT(pending|processing|done|failed),
  slug TEXT UNIQUE(h+hex10, 공개 URL 경로), "zipPath" TEXT(공개 zip URL), "errorMessage",
  "pointsCharged" INT DEFAULT 3000, "imageSlots" TEXT(JSON [{file}], 07-20 신규 — 생성 시 워커가
  이미지 파일 목록 명시 저장, 편집화면 사진편집 탭 썸네일용), "createdAt"/"updatedAt"`.
  인덱스 (status)·(userId).
- 흐름: shared-api routes/aimp/homepage.ts(차감·409 동시 1건·순번/ETA) → 서버2 rag/homepage_worker.py
  (KST09~19 크론, v2 4단계 파이프라인) → sites/homepage/{slug}/ 배포. 상세=doc/features/homepage_builder.md.
- 단가 정본=MenuLimit 'homepage' 3롤 3,000pt(사장 확정 07-17). 어드민='홈페이지 신청' 탭.

## HomepageEdit (2026-07-20, 홈페이지 채팅 편집 — raw SQL 전용, prisma schema 미반영)
- 편집 요청 큐: `id SERIAL PK, "requestId" INT(→HomepageRequest.id), "userId" INT, kind TEXT
  ('text'|'image'|'upload'), instruction TEXT, "targetFile" TEXT(image/upload만, 'img/x.jpg'),
  "uploadPath" TEXT(upload만, base64 원본), status TEXT(pending|processing|applying|reverting|done|failed),
  "previewPath" TEXT(적용 시 파일 경로용, 평소엔 비어있음), "previewData" BYTEA(미확정 미리보기
  이미지 바이트 — API가 여기서 직접 서빙, git 배포 안 탐), "pointsCharged" INT, "errorMessage" TEXT
  (done 상태에도 claude 완료 응답 저장용으로 재사용), "createdAt"/"updatedAt"`.
  인덱스 (status)·(requestId).
- 흐름·아키텍처 결정 이유(배포 지연 근본 해결)=doc/features/homepage_builder.md '채팅 편집기' 섹션.
- 단가 폴백: text=100P, image=200P, upload=100P(MenuLimit 미등록 시 코드 폴백, 정식 등록은 어드민).

## UserShorts (2026-07-22 신설, 쇼츠 만들기 — raw SQL 전용, prisma schema 미반영)
- 2단계 과금 큐: `id SERIAL PK, "userId" INT, status TEXT(pending|processing_research|
  scenarios_ready|producing|processing_produce|done|failed), "formJson" TEXT(업종/장점/타겟/톤/
  언어/참고URL), "imagePath" TEXT(업로드 이미지, JSON 배열 최대 3장 — 2026-07-23 이전 접수분은
  단일 base64 문자열 하위호환), "researchJson", "scenariosJson"(시나리오 5개, 각 항목에
  `visual_style_ref` 포함), "selectedIndex" INT, "scriptJson", "videoPath", "videoData" BYTEA
  (완성 mp4, 정적배포 지연 회피용 DB 직결 서빙), "errorMessage", "pointsChargedResearch",
  "pointsChargedVideo", "useVeo" BOOLEAN DEFAULT false(2026-07-23 추가 — ★초기 배포 시 코드만
  반영되고 컬럼 마이그레이션을 빠뜨려 선택 API가 500 에러 낸 사고 실측, raw SQL 테이블은
  코드·DB 컬럼을 항상 같이 배포할 것), "progressStep" TEXT(script|images|tts|verify|research|
  scenarios|NULL, 2026-07-23 추가), "progressDone" INT, "progressTotal" INT, "createdAt"/"updatedAt"`.
- 흐름·워커 상세=doc/features/shorts_maker.md.

## DocQnaDoc / DocQnaQuestion (2026-07-24 신설, 문서 QnA 뼈대 — raw SQL 전용, prisma schema 미반영)
- `DocQnaDoc`: `id SERIAL PK, "userId" INT, "fileName" TEXT, "gcsPath" TEXT(ai-mp-media
  버킷 doc-qna/ 경로), "dsDocumentId" TEXT(discoveryengine 인제스트 후 채움), status TEXT
  (pending|ingesting|ready|failed), "errorMessage" TEXT, "createdAt"/"updatedAt"`.
- `DocQnaQuestion`: `id SERIAL PK, "docId" INT(→DocQnaDoc.id, ON DELETE CASCADE), question
  TEXT, answer TEXT, status TEXT(pending|answered|failed), "errorMessage" TEXT, "createdAt"`.
- 뼈대 단계(어드민 전용, 포인트 과금 없음) — GCP 크레딧 "Trial credit for GenAI App
  Builder"(Vertex AI Search 전용) 실사용 검증 목적. 상세=doc/features/doc_qna.md.

## GuestCohortStat (2026-07-28 신설, 게스트 코호트 통계 — prisma schema 반영)
- `cohortDate TEXT PK`(가입일 YYYY-MM-DD, **KST 기준** — UTC 그대로 쓰면 새벽 가입자가 전날로
  잡힘), `guestCount INT`(그날 생성된 게스트 수, 삭제된 누적), `usedAnyCount INT`(그중 기능을
  1회 이상 사용), `freeTrialCount INT`(그중 '체험 첫 1회 무료' 사용), `exhaustedCount INT`
  (그중 잔액<50P = 전환 지점 도달), `convertedCount INT`(정식전환, 삭제 시점엔 0이라 참고용),
  `totalSpent INT`(코호트 총 소진 포인트), `updatedAt`.
- **존재 이유**: 게스트(`provider='guest'`)는 가입 7일 후 cleanup 크론이 삭제하므로(어드민
  회원목록 적체 방지, 2026-07-21) 체험→전환 개선의 효과를 7일 뒤엔 검증할 수 없었다. 계정은
  지우되 "며칠에 몇 명 들어와 얼마나 써봤는가"만 남긴다. **개인정보 없음**(식별자·대화 미포함).
- 적재: `internal-cron.ts` cleanup(매일 21시 KST)이 삭제 **직전에** 집계해 코호트별 누적 upsert.
  ★함정 2개 — ⑴지표는 반드시 삭제 전에 읽어야 함(`PointTransaction`이 User에 Cascade로 묶여
  함께 소멸) ⑵삭제 실패분은 집계 제외(다음 회차 재시도되므로 중복 계상 방지).
- 조회: `GET /api/aimp/admin/guest-cohorts` — 살아있는 계정(User 실시간 집계)과 삭제분(이 표)을
  합쳐 하나의 추세로 반환. 상세=doc/features/referral_system.md.

---

## ShortsTrend / ShortsUserPref (2026-08-02 신설, 쇼츠 학습 계층 — raw SQL 전용, prisma schema 미반영)

사장 지시 "트렌드가 바뀌는데 확장이 될 수 있으면 좋겠다 — 쇼츠→카테고리→트렌드→사용자지정
자동학습까지". 쇼츠 대본 프롬프트를 **4겹**으로 쌓는 구조의 ③④번 계층.

```
①공통 규칙(워커 인라인) ②카테고리(CATEGORY_SPECS) ③트렌드(ShortsTrend) ④사용자지정(ShortsUserPref)
```

### ShortsTrend — 카테고리별 축적 트렌드
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | serial PK | |
| `category` | text | community/product/insight/wellness/meme/birthday |
| `trendMd` | text | 프롬프트에 그대로 얹히는 마크다운 본문 |
| `sourceNote` | text? | 출처 메모(어떤 근거로 갱신했는지) |
| `sampleCount` | int | 집계에 쓴 표본 수 |
| `isActive` | bool | false면 조회 제외(과거분 보관) |

- 조회: `load_trend(category)` — **최신 활성 1건**만 사용(`isActive AND ORDER BY updatedAt DESC LIMIT 1`)
- 인덱스: `(category, isActive, updatedAt DESC)`

### ShortsUserPref — 회원별 톤·금지어
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | serial PK | |
| `userId` | int | |
| `category` | text? | **NULL이면 모든 카테고리 공통** |
| `toneNote` | text? | 신청자가 지정한 톤(프롬프트에서 최우선) |
| `banWords` | text? | 금지어 |

- 조회: `load_user_pref(user_id, category)` — **카테고리 전용 > 공통(NULL)** 우선
  (`ORDER BY (category IS NULL), updatedAt DESC LIMIT 1`)
- 유니크: `(userId, COALESCE(category,'*'))` — NULL도 하나만 두려고 표현식 인덱스 사용

### ★설계 원칙 — "있으면 얹고 없으면 지나간다"
트렌드가 리서치를 *대체*하도록 짜면 **테이블이 비어 있는 동안 오히려 품질이 떨어진다.**
그래서 **보강만** 하고, 조회 실패도 삼킨다(학습 계층 때문에 제작이 실패하면 본말전도).
`build_learning_block()`이 빈 상태에서 `''`를 반환 → 기존 프롬프트와 **완전히 동일**(회귀 없음).

### 함께 수정한 기존 컬럼 2개
- **`UserShorts.researchJson`** — 컬럼은 있었는데 **쓰는 코드가 없어 실측 0건**이었다.
  매 요청 검색비를 들여 리서치를 돌리고 결과를 그대로 폐기 = 100번 만들어도 101번째가
  나아지지 않는 구조. 트렌드 학습의 **원재료**라 `process_research`에서 저장하도록 수정.
- **`SampleVault.sourceTaskId`**(신규, text) — 보관함 복사 중복 방지용. 승인큐 경로가
  taskId를 어디에도 남기지 않아 **"이미 복사했는지" 물어볼 근거조차 없었다.**
  판정은 제목이 아니라 **출처 id**로 한다(제목은 수정 가능하고 서로 다른 원본이 같은 제목일 수 있어 오탐).
  인덱스: `sourceTaskId`, `sourceUserShortsId`. ★2026-08-02 이전 복사분은 NULL이라 과거분 중복은 못 잡는다.

## Lc* 11개 (2026-08-11 신설, 🎓 AI 학습코칭 — **prisma schema 반영**, 운영 DB 실행 완료)

기능 설명은 `doc/features/learning_coach.md`. 소유자 `aichat_user`.
★기존 `Learn*`(학습자료 코스)과 **다른 기능**이다 — 접두사 `Lc`로 구분.

| 모델 | 키 | 용도 |
|---|---|---|
| `LcProfile` | `userId` @id | 수준·**notifyHour**(0~23, KST, null=미설정)·studyDays·streak·timezone |
| `LcGoal` | id | 목표(title/rawInput)·durationWeeks·daysPerWeek·minutesPerSession·status·**planRevised**(수정요청 1회 사용 여부) |
| `LcWeekOutline` | id | ★2단계 분할용 — 주차 개요(weekNo/title/theme)만 먼저 생성 |
| `LcModule` | id | 일별 모듈. `contentMd`(최초 열람 시 1회 생성 후 **캐시**)·status(pending/open/done)·generationFailedAt/Error/retryCount |
| `LcDailyTask` | id | 날짜별 배정. `completedAt`·`score`·**`notifiedAt`**(일일 알림 중복 발송 방지) |
| `LcQuestion` | id | 4지선다. `choicesJson`(문자열)·`answer`·`difficulty`(1~3)·`tag`(취약영역 분석용) |
| `LcAttempt` | id | 풀이 기록. `isReview`로 오늘학습/복습 구분 |
| `LcReviewItem` | id | 간격반복. `intervalDays`·`ease`·`dueDate`·state(active/mastered) |
| `LcWeeklyReport` | id | 주간 리포트. metricsJson·summaryMd·suggestionJson·`accepted` |
| `LcSubscription` | id | 구독 상태 |
| `LcAiUsageLog` | id | 모델·토큰·원가 기록(`logLearningAiUsage`) — 모델별 단가로 costUsd 계산 |

**주의사항**
- ★`LcQuestion.difficulty`는 **스키마 Int / DB smallint**로 다르다(2026-08-13 대조 확인).
  값이 1~3이고 저장 직전 `Math.min(3, Math.max(1, ...))`로 제한돼 **무해**(smallint 상한 32,767).
  나머지 10개 모델은 완전 일치. 대조는 `shared-api/scripts/check-learning-schema-sync.ts`(읽기 전용).
- ★`LcDailyTask.notifiedAt`은 **스키마에만 있고 DB에 없어 서버가 죽은 적이 있다**(2026-08-11,
  통합테스트 중 발견 → DDL 실행으로 해결). 컬럼 추가 시 운영 DB 반영 여부를 반드시 확인할 것.
- `LcAiUsageLog.model`에 남는 값은 2026-08-13부터 `gemini-2.5-flash`(그 전은 `claude-sonnet-5`).
  단가표에서 **옛 모델 단가를 지우면 과거 로그가 0원**이 되므로 남겨 둔다.
