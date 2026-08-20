# 🛠 개발AI 콘솔

> 신설 2026-08-20 (1~5단계 완성·배포) · 어드민 → 운영 → `개발AI 콘솔`
> 관련: `doc/db_schema.md`(DevProject* 5모델), work_index §14 2026-08-20

## 왜 만들었나

발단은 사장의 한마디였다 — *"텔레그램으로 하려니 자꾸 추가 요구를 하게 된다."*

텔레그램은 **한 줄씩 주고받는 통로**라 명세·첨부·참조 이미지 같은 **구조화된 입력**에
구조적으로 맞지 않는다. 실제로 첨부파일 수신 기능을 붙이던 중 요구가 계속 늘어났다.

역할을 나눴다.

| | 어드민 (신설) | 텔레그램 (축소) |
|---|---|---|
| 하는 일 | 명세 작성 · 개발 시작 · 승인 · 진행 확인 · 결과 수령 | 알림 + 짧은 지시 |
| 강점 | 구조화된 입력, 이력 관리 | 먼저 말을 걸어옴, 재개가 빠름 |

★**텔레그램을 없애지 않았다.** 어드민은 사용자가 열어봐야 알고, 개발은 3분에 끝나기도
1시간 넘게 걸리기도 한다. 끝났을 때 폰이 울리는 값어치는 어드민이 대체하지 못한다.
짧은 지시나 `/hermes 이어서 <ID>` 재개도 텔레그램이 여전히 빠르다.

## 전체 흐름

```
명세 작성(v1,v2,v3… 비포/애프터)
   → [▶ 개발 시작]        ← rag/devai_start.py → hermes.run()
   → 계획 수립 → [승인]     ← 텔레그램과 같은 결재 큐
   → 묶음 실행(실시간 진행)  ← rag/devai_events.py 가 DB에 직접 기록
   → 디자인 시안 선택        ← design_preview.approve_design() 재사용
   → 결과(배포URL·커밋·요약) + 명세서 .md 다운로드
```

## 구성

| 위치 | 파일 |
|---|---|
| API | `api/devai/[action].ts` (+ 정적 진입점 `api/devai/index.ts`) |
| 화면 | `frontend/components/admin/DevAiPanel.tsx` |
| 등록 | `frontend/components/AdminPanel.tsx` (import·GROUPS·mainView 3곳) |
| 파이프라인 기록 | `rag/devai_events.py` |
| 개발 착수 | `rag/devai_start.py` |
| DB | `DevProject` / `DevProjectVersion` / `DevProjectFile` / `DevProjectEvent` / `DevProjectResult` |

### API 액션

```
list / get / create / update / delete        1단계
link / sync / export                         2단계
approve                                      3단계
designs / choose-design                      4단계
start                                        5단계
```

★**정적 경로 + 쿼리스트링**으로 부른다(`/api/devai?action=list`). `vercel.json` 끝의
catch-all rewrite(`/api/:d/:s1`)가 `/api/devai/list` 같은 동적 세그먼트를 `router.ts`(404)로
보내기 때문. 인버스 탭과 같은 이유·같은 방식이다.

## ★설계 원칙 (손댈 때 깨지 말 것)

### 1. 파이프라인을 하나도 안 고쳤다

| 어드민이 하는 일 | 실제 동작 |
|---|---|
| 승인 | `rag/state/approvals/<taskId>.json` 에 결정을 쓴다 — **텔레그램 버튼과 같은 큐**(`approval_queue.py`) |
| 개발 시작 | `hermes.run(goal)` — **텔레그램 `/hermes` 와 같은 함수** |
| 진행 조회(sync) | `rag/state/projects/<ID>.json` 을 **읽기만** 한다 |
| 디자인 확정 | `design_preview.approve_design()` 재사용(보관·DESIGN_GUIDE 이력·커밋까지 그쪽이 맡음) |

→ **어느 쪽에서 눌러도 동작이 같고, 허드가 죽어도 어드민은 산다.**
(허드가 `dev_agent` 를 대체하지 않은 것과 같은 원칙)

### 2. 명세 수정은 UPDATE 가 아니라 INSERT

`DevProjectVersion` 에 새 행이 쌓인다. 덮어쓰면 **무엇을 왜 바꿨는지가 사라진다.**
방향이 바뀌는 게 정상이라 이력이 남아야 한다. 내용이 같으면 버전을 안 늘린다.

화면에서 버전 배지를 누르면 **비포/애프터를 좌우로 비교**한다.

### 3. 기록 실패가 개발을 막지 않는다

`rag/devai_events.py` 의 모든 함수가 예외를 밖으로 던지지 않는다. DB가 죽어도, 어드민에
연결된 프로젝트가 없어도(텔레그램으로만 돌린 작업) 파이프라인은 그대로 돈다.

★**로깅 코드는 성공 경로가 조용하다** — 넣은 뒤 반드시 대상 테이블을 직접 조회해 행이
쌓이는지 확인할 것. 과거 TTS 사용량 로깅이 3주간 0건이던 사고가 있다.

### 4. 동시 실행 1건 (사장 결정)

pane 안 claude 하나가 400MB~3.2GB인데 서버2는 3.9GB다. `list` 응답에
`concurrency{running,max,canStart}` 를 함께 내려 화면이 바로 판단한다.

### 5. 이미지는 sites 방식 (사장 결정)

`sites/devai/<projectId>/img/` 에 두고 URL 서빙. 외부 스토리지를 쓰지 않아 배포와 함께
따라간다. (업로드 UI는 아직 없다 — 아래 참조)

## 파이프라인 쪽 연결 지점

| 파일 | 심은 곳 |
|---|---|
| `herdr_runner.py` | 묶음 시작 / 완료(커밋 포함) / 실패 3곳 + 상태 전환 |
| `herdr_review.py` | 회차 판정(FIX/PASS) / 지적사항 반영 / 리뷰 실행 실패 3곳 |
| `devai_start.py` | 명세 → 목표 문장 조립 → `hermes.run()` |

★`herdr_review.py` 는 프로젝트 ID를 `task["id"]`(`<projectId>-<묶음명>`)에서 뽑는다.
★`devai_start.py` 는 **목표 문장 최상단에 작업 저장소를 못박는다** — 2026-08-19 `workdir`
오판으로 어드민 탭 요청이 `shared-api` 에 생성된 사고의 재발 방지.

## 단계별 검증 결과

| 단계 | 검증 |
|---|---|
| 1 | DB 왕복 8/8 — 수정해도 v1 보존, Cascade 확인 |
| 2 | 실제 프로젝트(p180458) 9/9 — 커밋 4개 추출, ★재동기화 중복 0건 |
| 3 | 이벤트 9/9 + 승인 왕복 3/3 — ★DB에 행이 쌓이고 파이프라인이 결정을 읽어감 |
| 4 | 시안 7/7 — ★시안 URL 실제 접근 HTTP 200 |
| 5 | 목표 조립·DB 읽기 10/10 |

## ★아직 안 한 것

- **실전 미검증** — 단계별 검증은 전부 통과했지만 **어드민에서 [개발 시작]을 눌러 끝까지
  완주시킨 적이 없다.** 허드 4단계도 실전에서만 결함이 나온 전례가 있다.
- **첨부·이미지 업로드 UI** — DB(`DevProjectFile`)와 저장 규칙만 있고 화면은 없다.
- **작업 탭 분리** — 지금은 편집 화면 하단에 진행/결과가 함께 있다. 프로젝트가 늘면
  독립 탭으로 나누는 편이 낫다.
