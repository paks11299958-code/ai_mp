# 토스증권 자동매매 봇

토스증권 Open API로 주식을 자동매매하는 봇 `~/toss_trader/`(서버1 pm2) + 어드민 '토스 자동매매' 모니터 탭. **현재 DEBUG(드라이런) = 실주문 0.** (최종 2026-07-04)

## 안전 설계 (최우선)

- **MODE=LIVE 를 정확히 명시했을 때만 실거래.** 그 외 전부 DRY_RUN(기본이 안전). 실제 주문 POST는 `broker._live_post_order` 한 곳뿐.
- 써킷브레이커(`risk.py`): 1회 금액/수량 상한 · 시간창 과도주문 자가 HALT · 일손실 한도(절대금액+%) · 연속손절 차단 · 변동성 필터. SIGINT/SIGTERM 시 미체결 전량취소 후 종료.
- **토스 API는 샌드박스 없음 = 실자산 전제.** IP 화이트리스트=서버1(34.50.27.95)만 등록 → **봇 실행은 서버1**(서버2는 403).

## 모듈 구조 (`~/toss_trader/`)

| 파일 | 책임 |
|---|---|
| `config.py` | 설정 로더(단일 게이트). ★MODE=LIVE 아니면 DRY_RUN. dotenv 없는 서버1용 폴백 파서. 종목명 매핑(SYMBOL_NAMES). |
| `broker.py` | 토스 API 클라이언트(OAuth2·시세·캔들·계좌·주문). ★DRY_RUN 게이트. `get_avg_price`·`refresh_token`. |
| `strategy.py` | 매매 전략(교체 가능 Protocol). **ScoreTrendStrategy**(점수형 추세추종) + SmaCross(예시, 보존). |
| `risk.py` | 리스크 매니저/써킷브레이커. 사전검사 + 손익/연속손절/변동성. |
| `executor.py` | 신호→리스크 관문→주문. 변동성 필터(매수만), 실패 시 미체결 동기화. |
| `main.py` | 조립+루프. 시장캔들·평단 조회해 전략에 전달. 로그/status 기록. |
| `status_writer.py` | 상태를 `logs/status.json`에 원자적 기록(어드민 조회용). |

## 전략: 점수형 추세추종 (2026-07-04, 로드맵②)

**일봉 스윙** 전략. 단타(체결강도·호가·수급·VI)는 토스 API 한계로 배제(REST만, WebSocket 없음).

### 매수 — 조건별 점수 합산 ≥ 임계(기본 80)이면 BUY

| 조건 | 배점 |
|---|---|
| MA20 > MA60 (정배열) | +25 |
| 종가 > MA120 | +20 |
| 거래량 > 20일 평균 × 2 | +20 |
| RSI 40~60 | +15 |
| 20일 최고가 돌파 | +10 |
| 시장 상승 (KODEX200 MA20>MA60) | +10 |

- **시장 필터 = KODEX200 ETF(069500) 프록시.** 토스는 코스피 지수를 조회 못 하므로(KOSPI/KS11 등 전부 실패) 대표 ETF를 프록시로 사용. 시장 캔들 없으면 그 10점은 제외(90점 만점).
- MA120 계산 위해 캔들 `count=150`.

### 매도 (보유 중일 때만, 평단 필요)

- 손절 −3% · 익절 +8% · 종가 < MA20(추세 이탈)
- 보유 여부/평단은 봇(`main`)이 `broker.get_avg_price`로 조회해 전략에 전달 → 전략은 순수 판단만.
- ★평단 item 필드명 미실측(현재 보유 0) → 여러 후보키 방어 탐색, 미보유/실패 시 None(매수 경로).

## 리스크 차단 (4단계, `risk.py`)

- **연속손절** N회(기본 3, 익절 시 리셋) → 그날 매매 종료(HALT)
- **%기준 일손실** 자산 대비 3%(절대금액 한도와 병행, `set_equity`로 자산 반영)
- **변동성 필터** 일일 (고−저)/저 ≥ 15% 종목 진입 거부(매수에만 적용)

## 설정 (★설정처 주의)

- **실제 종목/모드 설정처는 `config.env`가 아니라 `ecosystem.config.js`의 `env`.** config.py 폴백 파서가 "이미 있는 환경변수는 안 덮어씀"이라 pm2 env가 우선.
- 종목/모드 바꾸려면 **ecosystem.config.js 수정 → `pm2 restart ecosystem.config.js --update-env`** (단순 `restart toss-trader`는 env 갱신 안 됨).
- 주요 env: `MODE`(DEBUG/LIVE) · `SYMBOLS`(현재 251270 넷마블) · `MARKET_SYMBOL`(069500) · `BUY_THRESHOLD`(80) · `MAX_CONSECUTIVE_LOSSES`(3) · `DAILY_LOSS_LIMIT_PCT`(3) · `MAX_DAILY_MOVE_PCT`(15).

## 어드민 모니터 탭 (읽기 전용, 4탭)

- 봇 → `logs/status.json` → shared-api `admin.ts` 라우트 3개(`/admin/toss-trader/{status,logs,orders}`) → 프론트 `TossTraderPanel.tsx`.
- **4탭 구조**(2026-07-04):
  - **모니터링**: 상태·모드·현재가(종목명)·신호·매수 점수(진행바)·전략·보유·써킷·실현손익·연속손절 + 판단 근거.
  - **평가**: 매수 점수를 **조건별 표**로(추세정배열·MA120·거래량·RSI·신고가·시장상승 / 기준·현재값·획득/배점·✓✗). 봇 `status.scoreDetail`(각 조건 `{ok,pts,max,val,label,crit}`) 사용. 보유 중(청산 모드)이면 detail 없음 → 안내. ★배점 조절(쓰기)은 추후 봇 원격제어.
  - **로그**: 실행/주문 로그(최신순), ⛶ 크게 보기 전체화면 모달, 15초 자동 새로고침.
  - **설정**: 봇 설정값 읽기 전용(종목·전략·임계·모드 / 상한·손실한도·연속손절·변동성 / 루프·캔들수). 3-B에서 편집 가능으로 진화 예정.
- 주문 제어 없음(3-B에서 별도). ★로그는 최신순(`readLogLines`가 reverse) → 라우트 `slice(0, limit)`.

## 배포

- **봇 = git 아님, scp 직접배포**: 서버2 원본 → 백업(.bak-날짜) → scp → md5 대조 → py_compile/테스트 → `pm2 restart` + `save`. SSH 전 서버1 claude 락(pgrep) 확인.
- **프론트(어드민) = ai_mp master push → Vercel**.
- 테스트: `python3 -m unittest test_strategy test_risk`(순수함수 22개).

## 로드맵

- 🟢 1단계(봇 드라이런)·3-A(어드민 모니터)·2번(점수형 전략) 완료.
- 🔵 다음: 드라이런 관찰·튜닝(가중치/임계) → 극소액 LIVE / 3-B 웹 봇제어(긴급정지·설정변경).
