# 토스 자동매매 봇 — 어드민 연동 (모니터·발굴·선택매매·긴급정지)

> 봇 본체는 ai_mp 밖(`서버1 ~/toss_trader/`, git 아님·scp 배포). 이 문서는 **ai_mp 어드민 쪽 연동**만 다룬다.
> 봇 상세·LIVE 절차 정본 = `~/TODO.md` 토스 섹션 + 메모리 `project_auto_trading_toss`.

## 구조 (파일 기반 — DB 안 씀)

```
봇(서버1 pm2 toss-trader)
 ├─ 쓰기: logs/status.json(매주기)·scan_results.json(일1회)·orders/trader.log
 └─ 읽기: logs/selection.json(웹 선택+halt, 매주기 검증 후 수용)
shared-api(서버1, admin 가드)
 ├─ GET /admin/toss-trader/{status,logs,orders,scan,selection}
 └─ POST /admin/toss-trader/selection  ← 웹→봇 유일한 쓰기(원자쓰기 temp+rename)
ai_mp 프론트: TossTraderPanel.tsx (시스템 그룹 '토스 자동매매' 탭)
```

## 탭 구성 (TossTraderPanel, 2026-07-08 기준 5탭)

| 탭 | 내용 |
|----|------|
| 모니터링 | 상태(🌙장외 배지)·모드·대표 종목 카드 + **감시 종목 목록**(선택∪보유, 현재가·점수·신호·평단) |
| 발굴 | ⭐추천 카드 1~2개(이유·유의) + 점수순 전체 표(60점↑ 강조, 행 클릭=조건 상세) + **체크박스 선택(최대5)→선택 저장** |
| 평가 | 대표 종목 매수점수 조건별 표(scoreDetail) |
| 로그 | trader/orders 로그(최신순, KST 변환, ⛶ 전체화면) |
| 설정 | 읽기 전용(임계·상한·자금배분·장시간 가드 등 status.json 값) |

- 패널 헤더에 **🔴긴급정지/해제 버튼** + 정지 상태 배너. halt는 봇에서 래치 — 해제=웹 플래그 해제 후 서버1 `pm2 restart toss-trader`(수동 재시작 원칙).
- ★탭바는 `overflow-x-auto`+`whitespace-nowrap`(모바일 세로 꺾임 방지 — 2026-07-08 사장 지적 수정).

## 선택 매매 규칙 (Phase 2/3)

- 체크→저장한 종목만 매매 감시. **선택 0개=매수 0**(안전 기본). 보유 종목은 선택 해제해도 청산 감시 유지.
- 2단계 점수제: 60점=발굴(리스트업) / **80점=매수 진입**. 자금배분=동시보유 2종목·종목당 10만원(봇 env).
- 봇이 selection.json을 **검증 후 수용**(6자리 코드·유니버스 내·상한). 파일 깨짐/삭제=직전 선택 유지.

## 종목 직접 추가 (2026-07-08)

- 발굴 탭 ➕섹션: 코드 6자리+종목명 입력→추가(최대 20). 칩=체크(매매 선택, 최대 5 공유)·
  점수 or '스캔 전' 표시·✕삭제. API=`/admin/toss-trader/custom-symbols`(GET/POST add·remove).
- 파일 `logs/custom_symbols.json` → 봇 `universe.full_universe()`가 mtime 재로드(재시작 불필요).
  다음 16시 스캔부터 점수 산출. 잘못된 코드=봇 시세조회 실패로 걸러짐(로그).

## 어드민 6탭 재구성 + 대규모 개선 (2026-07-09~10)

- **6탭 워크플로우**: 발굴 → 선택 → 모니터링 → 평가 → 로그 → 설정. TossTraderPanel.tsx 최상위에 `h-full overflow-y-auto`(PC 스크롤 버그 수정).
- **종목별 점수 설정**(선택 탭): 종목마다 매수 임계·손절%·익절%를 개별 지정 → selection.json `params:{코드:{buyThreshold,stopLossPct,takeProfitPct}}`. 봇이 종목별 ScoreTrendStrategy로 그 기준대로 매매. 각 값 실전 설명 박스(임계=score>=값 매수, 손절=평단×(1-%), 익절=평단×(1+%), 예시 금액).
- **발굴 탭 = 채원 발굴 일기**: 봇 62종목 스캔 리스트 **제거** → `StockDiscovery` DB(윤채원이 매일 07:00 발굴, 하루 1행 누적)를 날짜별 조회. 코스피·코스닥 각 1종목 카드(점수·6조건·'왜 이 종목인가' 통합분석 요약). 카드에서 '감시 담기' 체크→바로 선택. API `/admin/toss-trader/discovery[/:date]`.
- **모니터링 탭**: 🛡 일손실 한도 여유 게이지+🧭 봇 현황 설명(장외/긴급정지/감시중)+장외에도 감시 예정 종목 표시+접이식 지표 설명.
- **📊 종목 통합 분석**(발굴 카드·선택 탭 버튼): 봇 6조건 점수 + 채원 펀더멘털(DART·네이버 수급·뉴스·3중 AI). **비동기**=요청만 하고 결과는 텔레그램(admin_analysis_notify 크론). API `/admin/toss-trader/analyze[/:id]`. 결과는 StockAnalysis DB 저장.
- **🔬 손절·익절·임계 백테스트**(선택 탭 버튼): 과거 200봉으로 손절×익절 그리드+임계별 성과(봇 동일 로직·AI 없음·수초)→추천·적용. API `/admin/toss-trader/backtest/:symbol`(backtest_grid.py execFile).
- **종목명 항상 표시**: 봇 status에 `symbolNames` 맵 + 프론트 `symName()` 통합 조회. 봇 유니버스 222종목 확대.
- **봇 로그 KST**: logger.py가 KST로 기록. 어드민 toKstLine이 KST표기 감지해 이중변환 방지.


## 발굴 아카이브 + 발굴 이력 뷰 (2026-07-15, 폐루프 P1)

- **발굴 탭 서브탭**: '오늘의 발굴'(채원 일기) ↔ '📅 발굴 이력'(아카이브 대시보드).
- 매 영업일 16:10 수집(서버2 크론 `rag/discovery_collect_cron.py` → shared-api
  `POST /internal-cron/discovery-collect`, 서버1 실행): 봇 스캔 60점↑(상위 20)+채원 발굴 →
  `DiscoveryRecord`(tradeDate×symbol: 점수·6조건·OHLCV(토스 캔들 당일봉 candles_json.py)·
  거래량배율·수급 5일(네이버 trend)·뉴스 5건·⭐추천·🔁눌림목) + `DiscoveryMarket`(지수+Gemini 증시요약).
- 이력 뷰: 날짜 셀렉트 → 증시요약 카드 → 종목 카드 펼침(수급 막대·뉴스 링크·조건표) +
  **D+1/D+7/현재 등락률**(저장 안 함 — 조회 시점에 네이버 일봉으로 계산).
- API: GET `/admin/toss-trader/discovery-records[/:date]`. ★두 테이블=운영 DB raw SQL
  (scripts/add-discovery-tables.cjs), $queryRawUnsafe 전용.

## 가상매매(페이퍼 봇) 비교 카드 (2026-07-15, 폐루프 P2)

- 수익률 탭 하단 '📝 가상매매' 카드: 실계좌 vs 가상 수익률%·가상 보유·오늘/누적 실현·자동선택 종목.
- 봇 `toss-trader-paper`(MODE=PAPER): 실주문 0, 파일 전부 `*_paper` 격리(paths.py),
  발굴 추천 상위 2개 자동선택(auto_select.py), 시뮬 포지션 영속화. 초기자본=실계좌와 동일
  (★입출금 시 ecosystem paper env도 갱신).
- API: GET `/admin/toss-trader/paper/status`·`paper/logs`.

## 수익률 탭 개선 — NXT(넥스트장) 반영 (2026-07-16)

- 보유 카드: 평단→현재가 큰 글씨(text-base, 현재가 손익색), **종목별 투자→평가 금액** 줄 추가.
- 장외 현재가·수익률=NXT(대체거래소, 평일 08~20시) 체결가 반영: 봇이 NXT 시간대 매 루프 스냅샷 갱신
  (`clock.is_nxt_hours`), status `priceBasis: nxt|close` → 배지 🌃 NXT 반영 / 🌙 NXT 마감가 기준.
  ★표시 전용 — 매매 판단은 정규장(09:00~15:30)만.

## 발굴 탭 강화 (2026-07-16)

- **💼 보유 종목 재점검**: 채원 아침 크론이 실봇 보유(status.json heldSymbols)를 매일 재분석
  (봇 점수+투자 요약) → `StockDiscovery.holdingsJson` → 오늘의 발굴 하단 섹션+텔레그램.
  백필=`chaewon_stock_cron.py --holdings-only`.
- **📋 채원 시황 브리핑**: 코멘트를 [시황][대외][대내][발굴][리스크] 5줄 고정 포맷으로
  (나스닥·S&P·다우·SOX·상해·달러원 실측 + 코스피/코스닥 장세판정 🟢🟡🔴 + 구글서치 그라운딩).
  프론트가 줄 라벨 배지로 렌더(구형 한 덩어리 코멘트는 pre-line 폴백). 백필=`--briefing-only`.
- **투자 요약 자동 백필**: 어떤 경로든 종목 분석 완료 시 발굴 일기의 빈 요약을 자동으로 채움
  (shared-api stock 워커 backfillDiscoverySummary — '지금 다시 분석'→카드 연결, 15초 새로고침).
- **🔁 눌림목 반등 배지**(발굴 이력 카드): 스캐너 `_pullback_rebound` 태그(20일선 1차 돌파→눌림
  지지→재반등, 사장 개별요건). ★관찰 전용 — 매매 진입 규칙 반영은 백테스트+결재 후.

## 아침 텔레그램 보고 중복 통합 (2026-07-24)

사장이 "매일 아침 같은 내용이 반복되는 것 같다" 지적 — 원인은 코스피/코스닥 종목마다
"발굴요약"(`build_report`, 간단)과 "왜 이 종목인가 통합분석"(`build_summary_msg`, 상세)을
**별도 메시지 2개**로 나눠 보내던 구조라, 같은 종목 얘기를 두 번 하는 것처럼 느껴진 것.

- `build_report()`가 발굴요약+통합분석을 **하나로 병합**해 코스피+코스닥 통합 메시지
  1개로(`_stock_block()` 헬퍼, 종목 수에 따라 요약 글자수 동적 배분 — 텔레그램 4000자
  제한 방어).
- 보유종목 재점검도 종목별 개별 메시지(`build_holding_msg`) → 몇 종목이든 통합 메시지
  1개로(`build_holdings_msg()`, 동일한 동적 배분 방식).
- **결과**: 아침엔 정확히 ①코스피+코스닥 추천 메시지 1개 ②보유종목 재점검 메시지 1개,
  총 2개만 옴(매매가 있었던 날만 "어제 봇 실전 복기" 메시지가 조건부로 추가).
- 파일: `rag/chaewon_stock_cron.py`. 배포는 서버2 직접 파일 수정(push 개념 없음, 크론
  자동 반영).

## 함정

- `Icon name` 미등록 lucide 아이콘은 조용히 Bot 폴백 — Icons.tsx import 목록 확인.
- status.json은 대표 종목 1개 스냅샷+`symbols[]` 병행(하위호환). 다종목 전면 개편 시 기존 카드 깨지지 않게.
- shared-api 배포는 push≠배포 — 서버1 git pull+pm2 reload 수동(07-15 서버1 git 리셋 정상화로 pull 복원, ★서버1 직접 수정·scp 금지).
- ★신규 DB 테이블(StockDiscovery)·컬럼(StockAnalysis.tgNotifiedAt)=raw SQL만(prisma db push 금지).
