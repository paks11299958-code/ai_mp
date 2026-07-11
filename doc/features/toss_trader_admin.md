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

## 함정

- `Icon name` 미등록 lucide 아이콘은 조용히 Bot 폴백 — Icons.tsx import 목록 확인.
- status.json은 대표 종목 1개 스냅샷+`symbols[]` 병행(하위호환). 다종목 전면 개편 시 기존 카드 깨지지 않게.
- shared-api 배포는 push≠배포 — 서버1 git pull+pm2 reload 수동.
- ★신규 DB 테이블(StockDiscovery)·컬럼(StockAnalysis.tgNotifiedAt)=raw SQL만(prisma db push 금지).
