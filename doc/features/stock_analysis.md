# 주식 분석 기능

> 최종 업데이트: 2026-05-19  
> 관련 파일: `api/cron-stock-worker.ts`, `api/_lib/dartService.ts`, `frontend/components/StockAnalysisBoard.tsx`, `shared-api/routes/aimp/stock-report.ts`, `frontend/App.tsx`

---

## 개요

사용자가 종목명을 입력하면 DART 공시 + Yahoo Finance 실시간 데이터를 수집해 **Gemini 2.5 Flash + Claude Sonnet + GPT-4o 3중 AI**로 전문 투자 분석 보고서를 생성하는 비동기 분석 기능.

- **비용**: 50P / 1회
- **일일 제한**: 1회 (어드민 `paks1012@naver.com` 예외)

---

## 아키텍처

```
사용자 요청 → StockAnalysis DB (status: pending)
    ↓ (Vercel Cron * * * * *)
cron-stock-worker.ts (maxDuration 300s)
    ├─ dartService.findCorpCode()        ← CorpCode DB 조회 (118,033개)
    ├─ dartService.getRecentFilings()    ← DART 최근 공시 6건
    ├─ dartService.getFinancials()       ← 직전 연도 재무제표
    ├─ dartService.getCorpInfo()         ← 기업 기본정보
    └─ dartService.getYahooFinanceData() ← 실시간 주가/PER/PBR/ROE 등
    ↓ (병렬 실행)
    ├─ Gemini 2.5 Flash (Google Search 그라운딩) → 전체 보고서 (7섹션)
    ├─ Claude Sonnet  (DART+Yahoo 데이터만)      → 투자의견 요약 섹션
    └─ GPT-4o         (DART+Yahoo 데이터만)      → 투자의견 요약 섹션
    ↓
StockAnalysis DB (status: completed, analysisReport = 3개 합산, claudeReport, gptReport)
```

---

## DB 모델

### CorpCode
- DART `corpCode.xml` ZIP에서 118,033개 기업 일괄 import
- 어드민 패널 → DART 기업코드 갱신 버튼 (`POST /api/dart-import`)
- `deleteMany + createMany(5000 배치)` — upsert 대비 10배 이상 빠름

### StockAnalysis
```
id, userId, stockName
corpCode        ← DART 기업 코드
yahooSymbol     ← Yahoo Finance 심볼 (e.g. 005930.KS) — KRX 심볼 변환용
chartImageUrl   ← GCS에 저장된 네이버 금융 차트 이미지 URL (분석 시 자동 저장)
status          ← pending | processing | completed | failed
analysisReport  ← Gemini 전체 보고서 + Claude/GPT 의견 합산 마크다운
claudeReport    ← Claude Sonnet 투자 의견 (별도 저장)
gptReport       ← GPT-4o 투자 의견 (별도 저장)
sourceLinks     ← Gemini Google Search 그라운딩 URL JSON 배열
errorMessage    ← 실패 시 오류 메시지
```

---

## 데이터 수집

### DART API (`opendart.fss.or.kr`)
- `findCorpCode(stockName)`: DB에서 정확 일치 → 부분 일치 순서로 검색
- `getRecentFilings(corpCode, 6)`: 2023-01-01 이후 공시 6건
- `getFinancials(corpCode)`: 직전 연도 연간 재무제표 (매출/영업이익/순이익/부채/자본)
- `getCorpInfo(corpCode)`: 업종코드, 설립일, 상장일

### Yahoo Finance (비공식 API)
- `query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}`
- `.KS` (KOSPI) → `.KQ` (KOSDAQ) 순서로 자동 탐색
- 수집 항목: 현재주가, 등락률, 시가총액, 52주 최고/최저, PER, PBR, ROE, EPS, 매출성장률

---

## 보고서 구조

Gemini 2.5 Flash (Google Search 그라운딩) + Claude Sonnet + GPT-4o 3중 AI 합산:

**Gemini 메인 보고서** (7섹션):
1. `## 📊 투자 요약` — 투자의견(매수/중립/매도), 목표주가, 상승여력, 핵심 리스크 테이블
2. `## 1. 기업 개요` — 사업 모델, 주요 제품, 경쟁 우위
3. `## 2. 실적 & 재무 분석` — DART 수치 기반 + 업계 평균 비교
4. `## 3. 최근 주요 공시 & 이슈`
5. `## 4. 기술적 분석` — 52주 위치, 지지/저항 구간
6. `## 5. 최신 뉴스 & 시장 동향` — 최근 1개월 뉴스 3~5건
7. `## 6. 리스크 분석` — 시장/실적/업종/기타 리스크 테이블
8. `## 7. 종합 의견`

**Claude Sonnet 추가 의견** (DART+Yahoo 데이터 기반, 검색 없음):
- 투자의견 / 목표주가 추정 / 핵심 강점 / 핵심 리스크 / 종합 코멘트

**GPT-4o 추가 의견** (동일 형식):
- 투자의견 / 목표주가 추정 / 핵심 강점 / 핵심 리스크 / 종합 코멘트

투자 유의사항 면책 문구 자동 첨부 (모든 AI 공통)

---

## UI (`StockAnalysisBoard.tsx`)

- **좌측 패널**: 종목 목록, 재시도/삭제/다운로드
  - **진행상황 시각화 (2026-06-03)**: 각 종목 행에 단계 스텝퍼(대기중→분석중→완료, 현재 단계까지 색칠+활성 글로우, 실패는 에러 배지) + 상태 배지(색+아이콘+라벨) + 상태별 안내문(분석중=자동갱신·1~2분 / 대기중=순서대기 / 완료=클릭하면 보고서 / 실패=에러). 빈 화면엔 진행 흐름+①②③ 단계 설명.
  - 종목명 입력 시 CorpCode DB 자동완성 (300ms 디바운스, 상장사 우선 정렬)
  - 미등록 종목명 제출 시 서버에서 400 에러 → alert 안내
- **우측 패널**:
  - 딥 네이비 그라디언트 헤더 + 기업명 + **`학습하기` 버튼** (emerald) + `.md 다운로드` 버튼 (blue)
  - 데이터 소스 카드: DART 공시 / AI 분석 뱃지 + KRX 심볼
  - 네이버 금융 차트 이미지 (`chartImageUrl`, GCS 저장본) — 클릭 시 네이버 금융 새 탭
  - 마크다운 렌더러: 실제 `<table>`, **굵게**, *이탤릭*, `코드`, DART 스타일 H2 섹션
  - `last updated HH:MM` 타임스탬프 + 에메랄드 펄스 표시
  - 참고 출처 링크 (Gemini 그라운딩 URL)
- 자동 폴링: pending/processing 상태가 있으면 10초마다 목록 갱신
- 모바일: 목록/상세 단일 패널 전환 (뒤로가기 버튼)

---

## API 엔드포인트

### 주식 분석
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/stock-analysis` | 분석 요청 (stockName, DB 미등록 시 400) |
| GET | `/api/stock-analysis` | 내 분석 목록 |
| GET | `/api/stock-analysis/suggest?q=` | 종목명 자동완성 (CorpCode DB, 상장사 우선) |
| GET | `/api/stock-analysis/:id` | 상세 (보고서 + yahooSymbol + chartImageUrl) |
| GET | `/api/stock-analysis/:id/download` | .md 파일 다운로드 |
| POST | `/api/stock-analysis/:id/retry` | 재분석 (완료/실패 모두 가능, yahooSymbol 초기화) |
| DELETE | `/api/stock-analysis/:id` | 삭제 |
| POST | `/api/dart-import` | DART 기업코드 갱신 (어드민 전용) |

### 보고서 학습하기 (RAG)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/stock-report/consult` | 보고서 벡터화 저장 (청킹 900자, 오버랩 없음) |
| GET | `/api/stock-report/search?q=` | 사용자별 벡터 검색 (유사도 0.55 이상, top-5) |
| GET | `/api/stock-report/list` | 저장된 종목 목록 |

---

## 차트 이미지 저장 흐름

```
분석 완료 후 cron-stock-worker.ts
  └─ fetch(ssl.pstatic.net/imgfinance/chart/mobile/candle/day/{stockCode}_end.png)
       Referer: https://finance.naver.com/
  └─ uploadToGCS(buf, stock-charts/{taskId}_{stockCode}.png)
  └─ StockAnalysis.chartImageUrl = GCS public URL
```

- 이미지 저장 실패해도 분석 자체는 정상 완료 (warn 로그만 기록)
- 기존 완료 분석은 `chartImageUrl = null` → 재분석 시 저장됨
- 클릭 시 `https://finance.naver.com/item/main.naver?code={stockCode}` 새 탭

---

## 주의사항

- Yahoo Finance는 비공식 API — Vercel US 서버에서 차단됨. `yahooSymbol`은 `stockCode.KS` fallback으로 저장
- TradingView KRX 심볼은 라이선스 오류 → 제거, 네이버 금융 이미지로 대체
- DART API는 한국 서버 → Vercel US 리전 간 레이턴시 있음 (기업코드 XML import 약 2~3분)
- Vercel Cron 최소 주기 1분 (`* * * * *`) — 요청 후 최대 1분 대기 가능
- 서아 페르소나 전용 기능 (pill 바에서만 접근 가능)
- Claude/GPT 중 하나가 실패해도 나머지 AI 결과로 분석 완료 (safeAnalyze 래퍼)

## 공유 링크 (2026-08-03)

타로 리딩 공유(`?tr=shareId`)와 동일한 옵트인 패턴. 완료된 보고서만 공유 가능,
기본 비공개 — "링크 공유" 버튼(다운로드 옆)을 눌러야 `shareId`가 발급된다.

```
POST /api/stock-analysis/:id/share      → { shareId }  (본인 소유·완료 상태만, 멱등)
GET  /api/stock-analysis/shared/:shareId → 공개 조회(비로그인, 사용자 정보 제외, 5분 캐시)
```

- `StockAnalysis.shareId String? @unique` — nullable(기본 비공개), unique 인덱스.
- 프론트 공유 URL: `/s/stock/:shareId` (`?stock=shareId` 아님 — 아래 OG 카드용 경로).
- **비로그인 렌더 버그**: 최초 구현 시 `AppContent` 내부의 여러 return 분기(로그인/게스트/
  화면별) 중 하나에만 공개 뷰 컴포넌트를 넣어, 비로그인 사용자가 링크를 열면 그 앞의
  다른 분기(로그인 유도 화면 등)로 먼저 빠져나가 렌더 자체가 안 됐다. `App` 최상위
  (`EMBED_KEY`·`/consult/:slug`와 동일 레벨)로 옮겨 로그인 상태와 완전히 분리해 해소.
  타로(`?tr=`)는 여러 return 분기에 반복 삽입하는 방식으로 우회했었는데, 이쪽은 최상위
  분리로 실수 여지 자체를 없앴다.

### 카톡·문자 미리보기 카드(OG)

SPA라 `?stock=` 진입 시 서버가 내려주는 `index.html`은 항상 사이트 공통 고정 OG만
갖고 있어(카톡 크롤러는 JS를 실행 안 함) 종목별 카드를 못 만들었다. `/s/stock/:shareId`
Vercel 함수(`api/stock-share.ts`) 신설:

- 카카오톡·페이스북 등 크롤러 UA(`kakaotalk|katalk|facebookexternalhit|...`)로 오면
  shared-api 공개 조회 API를 호출해 종목명+투자의견(`analysisReport`에서 정규식 파싱)이
  담긴 OG HTML을 서버에서 직접 조립해 즉시 응답.
- 일반 브라우저는 `/?stock=shareId`로 302 리다이렉트해 기존 SPA가 처리.
- `vercel.json`에 `{ "source": "/s/stock/:id", "destination": "/api/stock-share?id=:id" }`
  rewrite + 함수 등록.

실제 shareId(완료된 보고서)로 발급→API 응답→OG 파싱까지 curl로 실측 검증
(제목 "📊 주성엔지니어링 정밀분석 — AI 놀이터", 설명에 투자의견 정확히 반영 확인).
