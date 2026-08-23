# 🛠 개발AI 콘솔

> 신설 2026-08-20 (1~5단계 완성·배포, 같은 날 **실전 투입**) · 어드민 → 운영 → `개발AI 콘솔`
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
| API | **서버1** `shared-api/routes/aimp/admin-devai.ts` (`admin.ts` 에서 `/devai` 로 마운트) |
| 서버2 브리지 | **서버2** `rag/devai_ctl.sh` (파일·파이프라인 전용 고정 스크립트) |
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
designs / choose-design / delete-design      4단계 · 시안
start                                        5단계
upload-image / delete-image                  참조 이미지
approvals                                    승인 대기 목록(화면 맨 위 카드)
```

프런트는 `/api/admin/devai/<action>` 으로 부른다. `vercel.json` 의
`/api/admin/:path*` rewrite 가 서버1(`:3020/api/aimp/admin/*`)로 보내고,
`admin.ts` 의 **전역 ADMIN 인증**을 그대로 상속한다.

### ★왜 Vercel 서버리스에서 서버1로 옮겼나 (2026-08-20)

처음엔 `api/devai/[action].ts` 로 Vercel 서버리스에서 돌렸다. 그런데 어드민 화면에
이 에러가 떴다:

```
권한 확인에 실패했습니다: Invalid `prisma.user.findUnique()` invocation:
Operation has timed out
```

**권한 문제가 아니라 네트워크 문제였다.** 실측:

| 경로 | 결과 |
|---|---|
| 외부IP `34.50.27.95:5432` | 차단/타임아웃 |
| 내부IP `10.178.0.2:5432` | 열림 |

다른 API 는 전부 `vercel.json` rewrite 로 서버1(VPC 안)을 타는데 `devai` 와
`inverse-trader` 만 rewrite 가 없어 **Vercel 서버리스로 직접 실행**됐다. Vercel 은
VPC 밖이라 Postgres 에 못 붙는다. `requireAuth`(JWT, DB 불필요)는 통과한 뒤 바로
다음 줄 `user.findUnique()` 에서 멈추기 때문에, **비로그인은 401 이 0.5초에 오는데
로그인 상태에서만 타임아웃**이 나서 권한 문제처럼 보였다.

→ DB 작업은 서버1로 옮기고, `api/devai/*` 는 **삭제**했다(살려두면 같은 함정에 다시 빠진다).

### ★DB 는 서버1, 파일·파이프라인은 서버2

`~/rag`(허드 상태·결재 큐·시안·`devai_start.py`)와 `~/ai_mp/sites` 는 **서버2에만** 있다
(서버1엔 `~/rag` 자체가 없다 — 실측). 그래서 파일이 얽힌 동작은 서버1이 SSH 로
**고정 스크립트** `~/rag/devai_ctl.sh` 만 부른다.

★임의 명령을 실행할 수 있게 하면 어드민 API 하나가 뚫렸을 때 서버2 전체가 넘어간다.
허용 동작을 `herdr-state / design-pending / approve / choose-design / start /
img-put / img-del / site-url` 로 못 박고, 프로젝트 ID·파일명은 정규식으로 검증한다
(`ai_studio_ctl.sh` 와 같은 원칙).

### 홈페이지 요구사항(brief) — 2026-08-20

원래 폼은 `기능 / 참조사이트 / 명세본문` 3칸뿐이었다. 그건 **프로그램 개발용** 틀이라
홈페이지를 만들 때 개발AI가 상호명·연락처·주소를 **지어냈다**.

| 섹션 | 항목 | 비우면 |
|---|---|---|
| 기본 정보 | 상호명, 한 줄 소개, 목적, 주요 고객 | AI가 초안 생성 |
| 서비스·강점 | 제공 서비스, 강점·차별점, 가격 안내 | AI가 초안 생성 |
| 브랜드·분위기 | 톤앤매너, 메인 컬러, 피하고 싶은 것 | AI가 초안 생성 |
| **연락처·푸터** | 주소, 전화, 이메일, 영업시간, 사업자번호, SNS | ★**비워둔다** |
| 구성 | 필수 섹션, CTA 문구, 그 밖에 | AI가 초안 생성 |

★**연락처류만 자동 생성에서 뺀다**(사장 지시). 홍보 홈페이지에 가짜 전화번호가 박히면
실제 고객이 잘못된 곳으로 연락한다. 그래서 비어 있으면 **비었다고 프롬프트에 명시**한다 —
아무 말도 안 하면 AI가 그냥 그럴듯한 값을 지어낸다.

- 필드 정의는 `frontend/components/admin/devaiBrief.ts` **한 곳**에만 둔다.
  폼·저장·프롬프트가 각자 목록을 가지면 항목 추가 때 나머지가 조용히 빠진다.
- 저장은 `DevProjectVersion.brief` **JSON 한 칸**. 칼럼 15개로 쪼개지 않은 이유는
  항목이 계속 늘어날 자리이고, 버전마다 통째로 스냅샷돼야 비포/애프터가 성립하기 때문.
  요구사항만 바꿔도 새 버전이 쌓인다(검증 완료).
- 칼럼 추가: `scripts/add-devai-brief-column.cjs` (`ADD COLUMN IF NOT EXISTS`, 기본값 `{}`)
- ★하나도 안 적으면 절 자체를 만들지 않는다 — 프로그램 개발 프로젝트에 '연락처 미입력'
  경고가 붙으면 개발AI가 엉뚱한 걸 신경 쓴다.

### 참조 이미지

`sites/devai/<projectId>/img/` 에 **저장소 동봉**한다(외부 스토리지 안 씀 — 배포와 함께
따라간다). DB(`DevProjectFile`)에는 경로만 남긴다.

★업로드로 끝내면 안 된다 — `devai_start.build_goal()` 이 이미지 경로를 지시문에 실어야
개발AI 가 `Read` 로 열어 본다. **DB 에만 있으면 에이전트는 존재조차 모른다.**

### 승인 대기 카드 — 텔레그램 못 봐도 승인 (2026-08-20)

**실사고**: 어드민에서 개발을 시작했는데 승인 요청은 **텔레그램으로만** 갔고, 5분 안에
못 누르면 자동 거부됐다. 화면엔 아무것도 안 떴다. 기존 승인 UI 는 항목 ID(`PLAN-APPROVAL`)를
**직접 타이핑**해야 해서 사실상 쓸 수 없었다.

- `approval_bot` 이 승인 대기를 `rag/logs/approval_pending.json` 에 기록
  (전에는 텔레그램 메시지로만 나가 어드민이 **읽을 게 없었다**)
- **`POLL_TIMEOUT` 5분 → 30분**. 텔레그램만 있던 시절의 전제였다
- 화면 맨 위 주황 카드에 **계획 전문 + 남은 시간 + 승인/반려**, 10초 폴링
- ★`approve` 의 프로젝트 id 는 **선택**이다 — 승인 요청은 프로젝트를 고르기 전에도 온다
- 텔레그램 전송이 실패해도 어드민 승인 경로는 살아 있다

★계획 승인(`PLAN-APPROVAL`) 외에 **개발 작업마다 별도 승인**(`DEV-001` 등)이 또 온다.
둘 다 승인해야 실제로 만들어진다 — 첫 실전에서 DEV-001 을 거부해 개발이 통째로 취소됐다.

### 시안 재사용 — 재시작해도 새로 만들지 않는다 (2026-08-20)

`devai_start` 로 재시작하면 hermes 가 계획을 처음부터 세우면서 **이미 고른 시안이 있는데도
3장을 새로 만들었다.** Opus 3회 + 8분이 매번 버려지고, 새 시안은 사장이 고른 것과 다른
디자인이라 "왜 내가 고른 게 아니지?" 가 된다.

→ `hermes._find_confirmed_design()` 이 확정본을 찾으면 바로 개발로 넘어간다.
★**파일 존재까지 확인**한다 — 목록에만 있고 파일이 없으면 Dev 가 읽을 게 없어 빈손으로 만든다.
의도적으로 새로 만들려면 `task.force_new_design = True`.

### 시안 목록 — 목차 + 보존 + 삭제 (2026-08-20)

| 문제(사장 지적) | 원인 | 조치 |
|---|---|---|
| 미리보기가 **메인페이지**로 뜸 | URL 을 `projectName` 으로 만들었는데 실제 파일명은 `slug`(타임스탬프 포함) → 404 → Vercel SPA 폴백 | slug 기반으로 수정 + 파일 없으면 링크 자체를 막음(`exists:false`) |
| 옛 시안 6개가 전부 노출 | 확정본도 목록에 남고 전부 펼쳐짐 | **목차 UI** — 제목만 나열, 클릭해야 3장 펼침 |
| 확정 시 시안 2장이 삭제됨 | `_cleanup_previews` 가 고르지 않은 것을 `git rm` | **보존이 기본**. 되돌리려면 `DESIGN_CLEANUP_PREVIEWS=1` |
| 시안 선택이 실제로 안 바뀜 | `devai_ctl.sh` 가 `selectedVersion`(camelCase)로 씀. 정본은 `selected_version` | snake_case 로 통일 |

삭제는 **사람이 명시적으로 누를 때만** 한다(제목 삭제=시안 전부 / 1장씩). 확인창 필수.

### 메이커-체커 선택 (2026-08-20)

허드 메이커-체커(Developer 제작 + Reviewer 검증)는 전역 환경변수(`HERMES_USE_REVIEW`)뿐이라
건별 선택이 안 됐다. **단일 홈페이지엔 낭비**(비용 2배·pane 2개, 서버2는 3.9GB)이고
로직 있는 개발엔 필요하다 — 건별이 맞다.

`DevProject.useReview` → `devai_start` → `hermes.run(use_review=)` → 각 dev task 에
`use_herdr`·`use_review` 플래그를 찍는다. ★Reviewer 는 허드 경로 위에서만 의미가 있어
**둘을 같이 켠다.**

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
따라간다. 업로드 UI 완성(2026-08-20) — 썸네일 그리드 + 삭제, 프로젝트 저장 후 사용 가능.

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

## 실전 착수 결과와 남은 작업

### `new_ainara` 착수 중단 (2026-08-23)

- 어드민 DB에 `new_ainara` 프로젝트·명세 v1을 등록하고 실제 `devai_start.py` 착수를 시도했다.
- 백그라운드 시작은 셸 세션 종료 후 프로세스가 사라졌고, 유지 세션에서는 계획용 Claude Opus
  CLI가 정상 종료 코드와 함께 빈 `result`를 반환해 계획·승인 단계로 진행되지 않았다.
- 사용자 요청으로 DevAI/Hermes/Claude 프로세스와 승인 대기를 모두 정지했다.
  프로젝트 상태는 `planned → canceled`로 기록했으며 생성 파일은 없었다.
- 진단 중 만든 임시 Opus 폴백과 프롬프트 변경은 원복했다. 따라서 이 장애의 영구 수정은
  **미완료**이며, 재착수 전 백그라운드 생존 방식과 빈 계획 응답 처리를 별도 검증해야 한다.
- 사이트 자체는 이후 개발AI 콘솔·Hermes·Opus 없이 Codex가 직접 제작했다.

### 남은 개선

- **끝까지 완주하는 실전 검증** — 개발AI 콘솔에서 계획→승인→개발→결과까지 성공한 사례가 아직 없다.
- **작업 탭 분리** — 지금은 편집 화면 하단에 진행/결과가 함께 있다. 프로젝트가 늘면
  독립 탭으로 나누는 편이 낫다.
