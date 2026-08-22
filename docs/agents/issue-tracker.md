# 이슈 트래커 운영 규칙 (Codex·Claude 공용)

작업·버그 목록의 **정본은 GitHub Issues**다. Codex와 Claude가 같은 목록을 보고 움직인다.

- 저장소: `paks11299958-code/ai_mp`
- 라벨 체계: [triage-labels.md](triage-labels.md)
- 도메인 용어: [domain.md](domain.md) → 루트 `CONTEXT.md`

---

## ★먼저: 인증

`gh`는 `~/.git-credentials`의 PAT를 환경변수로 받아 쓴다. 셸을 새로 열 때마다 필요하다.

```sh
export GH_TOKEN=$(python3 -c "
import re
for line in open('/home/paks11299958/.git-credentials'):
    m=re.match(r'https://[^:]*:([^@]*)@github.com/paks11299958-code/ai_mp', line.strip())
    if m: print(m.group(1)); break
")
```

★**`gh auth status`는 무시한다.** `read:org` 스코프가 없다며 `X` 표시를 내지만,
**이슈·라벨 명령은 정상 동작한다**(2026-08-22 실측). 조직 조회에만 쓰이는 스코프다.
"인증이 안 됐다"고 오판하지 말 것. 실제 확인은 아래로 한다.

```sh
gh issue list --repo paks11299958-code/ai_mp   # 이게 되면 인증은 정상이다
```

토큰 스코프는 `repo`(2026-08-22 확인). 이슈 읽기·쓰기·라벨·종료 전부 가능하다.

★`gh` 버전은 **2.23.0**(Debian apt). 최신이 아니라 신형 플래그 일부가 없을 수 있다.
아래 명령은 **이 버전에서 실제로 왕복 검증했다**(생성→조회→라벨→코멘트→검색→종료).
새 플래그를 쓰기 전에 `gh <명령> --help`로 존재를 먼저 확인한다.

---

## ★저장소가 Public이다 — 적기 전에 확인할 것

`paks11299958-code/ai_mp`는 **공개 저장소**다. 이슈 본문은 전부 외부에 노출된다.

**절대 쓰지 않는다:**
- API 키·토큰·비밀번호·DB 접속정보 (`.env` 값 일체)
- 내부 IP(`10.178.0.x`), 외부 IP, 비공개 포트 구성
- 회원 개인정보, 실제 이메일, 결제 정보
- DB 스키마 전문, 덤프

**대신 이렇게 쓴다:**
- `10.178.0.2` → "서버1"
- `postgresql://user:pw@...` → "운영 DB"
- 키 값 → "`.env`의 해당 키" (경로만, 값 없이)

★재현 절차에 민감정보가 꼭 필요하면 **이슈에는 "로컬 문서 참조"라고만 쓰고**
실제 값은 `~/work_index.md`에 둔다.

---

## 이슈 생성

```sh
gh issue create --repo paks11299958-code/ai_mp \
  --title "쇼츠 대본 가져오기 — 인물 일관성 원가 재산정" \
  --label "feature,needs-check" \
  --body "$(cat <<'EOF'
## 배경
스토리형만 인물 일관성 API를 켜서 원가가 5원 → 90원이 된다.

## 할 일
- [ ] 실제 호출 횟수 실측
- [ ] 요금제 반영안 검토

## 완료 조건
실측값 기준으로 요금제 초안이 나온다.
EOF
)"
```

**제목 규칙** — `영역 — 무엇을`. 영역은 `CONTEXT.md`의 용어를 그대로 쓴다.
동의어로 흘리지 말 것(예: "숏츠"/"쇼츠" 혼용 금지 → **쇼츠**).

**본문 3단** — `## 배경` / `## 할 일`(체크박스) / `## 완료 조건`.
★**완료 조건은 반드시 쓴다.** 없으면 Codex와 Claude가 서로 다른 지점에서 "끝났다"고 판단한다.

---

## 이슈 조회

```sh
R=paks11299958-code/ai_mp

gh issue list --repo $R                          # 열린 것 전부
gh issue list --repo $R --label bug              # 라벨로
gh issue list --repo $R --search "쇼츠"           # 검색
gh issue view 12 --repo $R                       # 상세
gh issue view 12 --repo $R --comments            # 코멘트까지
```

★**착수 전에 반드시 `issue list`를 먼저 돌린다.** 중복 이슈를 만들지 않기 위해서다.
비슷한 게 있으면 새로 만들지 말고 **기존 이슈에 코멘트**를 단다.

---

## 라벨 변경

```sh
gh issue edit 12 --repo $R --add-label "blocked"
gh issue edit 12 --repo $R --remove-label "needs-check"
```

라벨 5종의 뜻과 언제 붙이는지는 [triage-labels.md](triage-labels.md)에 있다.

---

## 진행 상황 기록

★**작업 중이면 코멘트를 남긴다.** 둘이 같은 목록을 보므로,
누가 무엇을 하는 중인지 이슈에 없으면 **같은 일을 두 번 한다.**

```sh
gh issue comment 12 --repo $R --body "Claude 착수. 원가 실측 중."
gh issue comment 12 --repo $R --body "실측 결과 90원 확인. 요금제 초안은 별도 이슈로 분리."
```

---

## 이슈 종료

```sh
gh issue close 12 --repo $R --comment "실측 완료. 커밋 3c3cda5."
```

★**종료 조건은 "코드를 넣었다"가 아니라 "완료 조건을 만족했다"이다.**
- 빌드 통과 ≠ 검증. 배포 전 `npm run check`, 배포 후 `npm run smoke`까지 통과해야 한다.
- "코드를 넣었다" ≠ "효과가 있다". 실제 적용값으로 실측한다.
- 번들 해시로 배포 여부를 판단하지 말 것. 내용 grep + 운영 실동작으로 확인한다.

닫을 때 **근거를 같이 적는다**(커밋 해시, 실측값, 확인한 화면). 근거 없이 닫지 않는다.

하기로 했다가 **안 하기로 한 것**은 닫되, 이유를 코멘트로 남긴다.
되돌리기 어려운 결정이면 [ADR](domain.md)로 올린다.

---

## ★하지 않는 것

- **이슈 없이 큰 작업을 시작하지 않는다.** 나중에 왜 했는지 추적이 안 된다.
- **남의 이슈를 말없이 닫지 않는다.** 코멘트로 먼저 근거를 남긴다.
- **`--force`나 대량 스크립트로 이슈를 일괄 조작하지 않는다.** 되돌리기 어렵다.
- **라벨을 새로 만들지 않는다.** 5종으로 부족하면 사장에게 먼저 묻는다.
