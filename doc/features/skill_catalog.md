# 스킬 카탈로그 (Claude Code 스킬·MCP·플러그인 탐색기)

> 어드민 [시스템 > 스킬 카탈로그] 탭에서 동기화 버튼 하나로 최신 목록을 반영한다.
> 공개 URL: `https://aichat.dbzone.kr/sites/skills/`
> 신설 2026-07-21 · 자동등재·결과표시 추가 2026-08-18

## 1. 무엇인가

설치된 Claude Code **스킬·MCP 서버·플러그인**을 탭/카테고리로 정리해 보여주는 정적 탐색기다.
사람이 "무슨 스킬이 있더라"를 찾는 용도이고, **Claude Code의 동작과는 무관하다.**

★**카탈로그 등재 여부와 스킬 동작은 별개다.** Claude Code는 `~/.claude/skills/` 폴더를
직접 읽으므로, 카탈로그에 없어도 스킬은 정상 작동한다(2026-08-18 실제로 오해가 있었다).

## 2. 구성 요소

| 위치 | 역할 |
|---|---|
| `~/.claude/skills/_catalog/skills_data.json` | **스킬 원본 데이터**(카테고리·설명) |
| `~/.claude/skills/_catalog/mcp_plugins_data.json` | MCP·플러그인 원본 |
| `~/.claude/skills/_catalog/build_catalog.py` | 빌더 → `SKILLS.md` + `skills.html` 생성 |
| `ai_mp/sites/skills/index.html` | 배포본(빌더 산출물 복사) |
| `frontend/components/admin/SkillsPanel.tsx` | 어드민 화면(동기화 버튼·상태 표시) |
| `rag/skill_ops.py` | `sync_catalog()` — 빌드→복사→커밋→push |
| `rag/dev_request_worker.py` | 큐 처리(`source='skill-sync'`) |

★**`~/.claude/skills/` 는 어느 저장소에도 속하지 않는다**(git 밖). 백업은
`rag/config_backup.sh` 가 `claude-skills.tar` 로 뜬다 — 2026-08-18 이전엔 **백업 자체가 없었다.**

## 3. 동기화 흐름

```
어드민 [동기화] 버튼
  → POST /api/aimp/admin/skills/sync   (DevRequest INSERT, source='skill-sync')
  → 서버2 워커(크론 */2)가 큐 폴링
  → skill_ops.sync_catalog()
       ① build_catalog.py 실행 (자동등재 포함)
       ② sites/skills/index.html 갱신
       ③ git commit + push (master)
  → Vercel 재배포 (약 1분)
  → DevRequest.status='done', result=결과 메시지
  → 프론트가 5초 폴링으로 결과 표시
```

★**요청 경로에 Claude 없음** — 버튼을 누르면 DB에 행이 하나 생기고 워커가 알아서 한다.
대화창을 닫아도 동작한다(AI 스튜디오와 같은 구조).

## 4. ★자동등재 (2026-08-18 신설)

**문제**: 스킬을 설치해도 카탈로그가 옛 개수로 남았다. 실제로 `ai-product-factory`(08-14)와
`image-edit-sync`(07-26)가 누락돼 **5일 넘게 45개로 멈춰 있었다.**

**원인은 빌더였다.** `check_drift()` 가 디스크와 데이터를 **대조까지 해놓고**
`print` 로 경고만 찍고 그대로 옛 개수로 다시 빌드했다.

```
⚠️  데이터에 빠진 스킬(디스크엔 존재): ['ai-product-factory', 'image-edit-sync']
```

★**버튼을 몇 번 눌러도 결과가 같았을 구조다.** 버튼·워커·크론·배포는 전부 정상이었다.

**해결**: `check_drift(sk, autoadd=True)` 로 개편.
- `SKILL.md` frontmatter 의 `description` 을 읽어 카드 설명 생성(★PyYAML 없이 수동 파싱 —
  워커가 rag-env 밖에서도 돌아야 한다. 접힌 여러 줄도 이어 붙인다)
- 이름·설명 키워드로 **카테고리 자동 분류**(못 정하면 '스킬 / 환경 관리')
- 카테고리 안은 이름순 정렬 후 `skills_data.json` 저장
- 결과: 45 → **47**, 멱등(재실행해도 중복 없음)

★**삭제(extra)는 자동으로 하지 않는다** — 폴더를 잠깐 옮겼을 뿐인 경우까지 데이터에서
지우면 **손으로 쓴 설명·분류가 날아간다.** 경고만 남긴다.
**"추가는 자동, 삭제는 경고"** 가 안전한 기본값이다.

★자동 분류는 키워드 기반이라 완벽하지 않다. 엉뚱한 카테고리에 들어가면 `skills_data.json`
에서 옮기면 되고, **이미 등재된 항목은 건드리지 않으므로** 그 뒤로 유지된다.

## 5. ★동기화 결과 표시 (2026-08-18 신설)

전에는 "요청했어요"까지만 뜨고 **성공·실패를 알 수 없었다.**
확인해 보니 **워커가 `DevRequest.status`·`result` 에 이미 기록**하고 있었고 화면이 안 읽었을 뿐이었다.

- 백엔드: `GET /api/aimp/admin/skills/sync/:id` (shared-api `routes/aimp/admin.ts`)
- 프론트: 5초 폴링(최대 3.5분), 워커 메시지를 그대로 표시

| 상태 | 화면 |
|---|---|
| 진행 중 | 🔄 동기화 중… N초 (아이콘 회전) |
| 완료 | 🟢 ✅ 동기화 완료 — 스킬 47 · MCP 4 · 플러그인 36. Vercel 재배포 중. |
| 변경 없음 | 🟢 ℹ️ 변경 사항이 없어요(이미 최신) — … |
| 실패 | 🔴 ❌ 동기화 실패 — {사유} |
| 지연 | ⌛ 3.5분 초과 안내 |

★**재진입 방지 3중**: `useRef` 타이머 가드 + 중복 클릭 차단 + 언마운트 정리.
전자책 표지 중복생성(setInterval 재진입으로 1건당 8~10장 생성)과 같은 종류의 사고를 막는다.

## 6. 손댈 곳

| 하고 싶은 것 | 손댈 곳 |
|---|---|
| 스킬 추가 | `~/.claude/skills/<name>/SKILL.md` 만들고 **동기화 버튼만** 누르면 끝 |
| 카테고리 바꾸기 | `skills_data.json` 에서 항목 이동(이후 유지됨) |
| 카테고리 신설 | `skills_data.json` 의 `categories` 에 추가 + `_guess_category()` 규칙 보완 |
| MCP·플러그인 | `mcp_plugins_data.json` **수동 편집**(자동등재 대상 아님) |

★MCP·플러그인은 자동등재가 없다 — 디스크에서 목록을 읽을 방법이 스킬처럼 단순하지 않다.

## 7. 교훈

- ★**"차이를 검출한다" ≠ "차이를 고친다".** 드리프트 검사가 있다고 안심하지 말고
  **검출 후 무엇을 하는지**(고치는가·막는가·알리기만 하는가)를 볼 것.
- ★**"기능이 안 된다"의 범인이 버튼·API·배포가 아니라 맨 끝 산출 단계일 수 있다.**
  파이프라인을 끝까지 따라가 **실제 산출물을 눈으로** 확인해야 한다.
- ★**결과가 이미 DB에 있는데 화면이 안 읽는 경우가 있다.** 새 조회 API를 만들기 전에
  **워커가 무엇을 남기는지** 먼저 볼 것(이번엔 그대로 읽기만 하면 됐다).
