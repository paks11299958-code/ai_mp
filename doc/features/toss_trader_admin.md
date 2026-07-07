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

## 함정

- `Icon name` 미등록 lucide 아이콘은 조용히 Bot 폴백 — Icons.tsx import 목록 확인.
- status.json은 대표 종목 1개 스냅샷+`symbols[]` 병행(하위호환). 다종목 전면 개편 시 기존 카드 깨지지 않게.
- shared-api 배포는 push≠배포 — 서버1 git pull+pm2 reload 수동.
