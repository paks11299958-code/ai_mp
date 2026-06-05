# 페르소나 퀵메뉴 백업 스냅샷

채팅 화면의 페르소나별 **퀵메뉴**(예: 도결 선생의 시운의 흐름 / 성취와 재물 / 인연의 결 / 나의 전생 / 꿈해몽 / 관상학)는
DB의 `Persona.quickMenuJson` 컬럼에 저장됩니다. 이 폴더는 그 값의 **복원용 백업 스냅샷**입니다.

## ⚠️ 중요 — 정본은 DB입니다

- **평소 메뉴 수정은 어드민 화면에서 하세요.** (어드민 → 페르소나 편집 → "퀵메뉴 JSON")
  여기 JSON 파일을 고친다고 화면이 바뀌지 않습니다. 이 파일은 자동 실행되지 않습니다.
- 이 스냅샷은 **DB가 통째로 유실/초기화되는 사고가 났을 때만** 꺼내 쓰는 복원선입니다.
- 어드민에서 메뉴를 크게 바꾸셨다면, 가끔 아래 "스냅샷 다시 뜨기"로 이 파일을 갱신해두면 좋습니다.

## 파일

- `dogyeol.json` — 도결(道潔) 선생 퀵메뉴 스냅샷 (`snapshotAt` 날짜 기준)

## 복원 방법 (사고 시에만)

서버1 shared-api 디렉터리에서 실행합니다. 해당 페르소나의 `quickMenuJson`을 스냅샷 값으로 덮어씁니다.

```bash
cd ~/shared-api
node ~/ai_mp/backups/persona-quickmenu/restore.cjs ~/ai_mp/backups/persona-quickmenu/dogyeol.json
```

복원 후 별도 배포 불필요 — 프론트는 DB 값을 읽어 바로 반영됩니다(새로고침).

## 스냅샷 다시 뜨기 (현재 DB → 파일 갱신)

어드민에서 메뉴를 바꾼 뒤 백업을 최신화하고 싶을 때:

```bash
cd ~/shared-api
node ~/ai_mp/backups/persona-quickmenu/snapshot.cjs cmopfkd4o000004la2q5p3nle ~/ai_mp/backups/persona-quickmenu/dogyeol.json
# 그 후 git add/commit/push 로 백업 보관
```

(첫 인자는 페르소나 id. 도결 선생 = `cmopfkd4o000004la2q5p3nle`)
