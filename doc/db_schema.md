# DB 스키마 (25개 모델)

> Prisma 마이그레이션 대신 raw SQL 직접 실행 (히스토리 없음)  
> 스키마 변경 후 반드시 `npx prisma generate` + `src/generated/prisma/` 커밋

---

## User
```
id, email(nullable), phone(nullable, unique), username, password, role(USER/ADMIN/MANAGE)
paidPoints(default:0), bonusPoints(default:0)
birthInfoJson(String?)          ← 명부 JSON 문자열
resetToken, resetTokenExpiry    ← 비밀번호 재설정 토큰 (SMS 코드도 재사용)
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
```
- `starVideoUrl`: 별스타 100개 이상 수신 시 재생할 감사 영상 URL (GCS)

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
personaId, balanceAfter, createdAt
type 값: CHAT | SIGNUP | LEVELUP | ADMIN | BALLOON | CHARGE | MENU | REFERRAL(예정)
```

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

## Raw SQL 예시

```sql
-- 컬럼 추가
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "faceReadingBgUrl" TEXT;

-- User phone 컬럼
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"(phone);
ALTER TABLE "User" ALTER COLUMN email DROP NOT NULL;
```
