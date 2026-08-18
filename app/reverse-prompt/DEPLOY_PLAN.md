# 배포 계획서 — 리버스 프롬프트

**작성** 2026-08-15 (묶음 E-1)
**상태** ★**계획만 작성. 아무것도 실행하지 않았다.** 실행은 승인 후 별도 세션.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 신규 테이블 | `RpItem`, `RpAnalysisCache`, `RpGuestUsage`, `RpAiUsageLog` (4개) |
| 기존 테이블 변경 | **없음** (`ALTER`/`DROP` 0건 — DDL 실측 확인) |
| 백엔드 | `shared-api` — 신규 파일 6개 + 라우터 등록 1줄 |
| 프론트 | `ai_mp` — 신규 파일 4개 + `App.tsx` 라우팅 + `vercel.json` 3줄 |
| 진입점 노출 | ★**이번 배포에 포함하지 않는다.** 별도 판단 |
| 되돌릴 수 없는 지점 | **없음** (아래 5장 참조) |

---

## 0-1. ★브랜치 주의 — 잘못 머지하면 배포가 안 되거나 의도치 않게 나간다

**`ai_mp`에는 `master`와 `main`이 둘 다 존재한다.** 이름만 보고 고르면 사고가 난다.

| 저장소 | ★머지 대상 | 그 외 브랜치 | 비고 |
|---|---|---|---|
| **ai_mp** | **`master`** | `main` ← ★**쓰지 않는다** | **Vercel Production Branch = `master`** |
| **shared-api** | **`main`** | — | 서버1 pm2가 이 브랜치를 pull |

### 왜 위험한가 (2026-08-16 실측)

```
ai_mp  master  7124669  2026-08-13  ← 실제 운영 브랜치
ai_mp  main    445bf8b  2026-05-28  ← 3개월 전에 멈춤
  main에만 있는 커밋   : 21
  master에만 있는 커밋 : 989   ← 사실상 버려진 브랜치
```

- **`ai_mp`의 `main`에 머지하면** → Vercel이 `master`를 보므로 **배포가 아예 안 된다.**
  머지는 성공하고 아무 에러도 없어서, "왜 반영이 안 되지"로 한참 헤맨다
- **`shared-api`에서 실수로 `master`를 찾으면** → 그런 브랜치가 없다(`main`뿐)
- 두 저장소의 기본 브랜치 이름이 **서로 반대**라는 점이 혼동의 근원이다

### 확인 방법

머지 전에 반드시 원격 상태를 눈으로 본다.

```sh
cd ~/ai_mp        && git ls-remote --heads origin   # master가 최신인지
cd ~/shared-api   && git ls-remote --heads origin   # main만 있는지
```

### 참고 — feature 브랜치 푸시는 운영에 영향이 없다

`feature/reverse-prompt`를 원격에 올리면 Vercel이 **Preview 빌드**를 만들지만
**운영에는 붙지 않는다**(2026-08-16 확인: 푸시로 빌드가 돌았으나 운영 중인 배포는
8/14자 그대로였다). 백업 목적의 푸시는 안전하다.
운영 반영은 **`master` 머지 + 사람이 Promote**를 눌러야 일어난다.

## 0-2. ★서버1에 `psql`이 없다 — `docker exec` 방식으로 실행한다 (2026-08-18 실측 정정)

초판은 서버1에서 `psql -U aichat_user -d aichat -f ...`를 직접 실행하는 것으로 적었으나
**서버1 호스트에 `psql` 바이너리가 없다**(`bash: psql: command not found`).

PostgreSQL은 **Docker 컨테이너 `n8n-docker-db-1`**(pgvector/pgvector:pg17)로 돌고 있다.

```sh
# 이 컨테이너가 DATABASE_URL의 호스트와 같은지 확인 (근거)
ssh 10.178.0.2 'docker port n8n-docker-db-1'
#   5432/tcp -> 10.178.0.2:5432   ← .env의 DATABASE_URL 호스트와 일치
#   5432/tcp -> 127.0.0.1:5432
```

★**DDL 파일은 `feature/reverse-prompt`에만 있고 서버1의 `main`에는 없다.**
머지는 백엔드 배포와 묶인 별도 결정이므로, DB 작업 단계에서는 머지하지 않고
**서버2의 파일을 stdin으로 흘려넣는다.** 서버1 파일시스템에 아무것도 남지 않는다.

### 조회 (E-2a 등 읽기 전용)

```sh
ssh 10.178.0.2 'PW=$(grep -m1 "^DATABASE_URL" ~/shared-api/.env | sed -E "s#.*://[^:]+:([^@]+)@.*#\1#"); \
  docker exec -e PGPASSWORD="$PW" n8n-docker-db-1 \
    psql -U aichat_user -d aichat -c "조회할 SQL"'
```

★비밀번호는 `.env`에서 읽어 **`PGPASSWORD` 환경변수로** 넘긴다.
명령줄에 평문으로 적지 않는다(셸 히스토리·프로세스 목록에 남는다).

### DDL 실행 (E-2b)

```sh
cat ~/shared-api/prisma/reverse-prompt-ddl.sql \
| ssh 10.178.0.2 'PW=$(grep -m1 "^DATABASE_URL" ~/shared-api/.env | sed -E "s#.*://[^:]+:([^@]+)@.*#\1#"); \
    docker exec -i -e PGPASSWORD="$PW" n8n-docker-db-1 \
      psql -U aichat_user -d aichat \
           -v ON_ERROR_STOP=1 --single-transaction -e -f -'
```

| 옵션 | 이유 |
|---|---|
| `docker exec -i` | 서버1에 psql이 없어 컨테이너 안에서 실행. `-i`로 stdin 연결 |
| `-f -` | stdin을 스크립트로 읽는다 |
| ★`--single-transaction` | **전체를 한 트랜잭션으로 감싼다.** 중간 실패 시 전부 롤백 → 부분 적용이 남지 않는다 |
| ★`-v ON_ERROR_STOP=1` | 첫 에러에서 즉시 중단. 없으면 에러를 무시하고 계속 진행한다 |
| `-e` | 실행되는 SQL을 출력에 함께 표시(로그 전문 확보) |

PostgreSQL은 **DDL이 트랜잭션 가능**하므로 마지막 인덱스에서 실패해도 테이블 4개까지 통째로 롤백된다.

★`\dt`·`\d` 같은 psql 메타명령은 `-c`로 넘겨도 동작하지만, 스크립트에서는
`pg_tables`/`pg_indexes`/`information_schema.columns` 조회가 더 확실하다(아래 3-1 검증 참조).

---

## 1. 운영 DDL 전문

파일: `shared-api/prisma/reverse-prompt-ddl.sql`
실행: **0-2절의 `docker exec` 방식**(서버1에 psql 없음)

★**실행문은 테이블 4 + 인덱스 7 = 11개**다. 계획서 초판과 PRD 8장은 인덱스를 6개(PRD는 5개)로
적었으나 **실측 7개**다 — `environment` 컬럼을 추가하며 `RpAiUsageLog_environment_createdAt_idx`가
함께 늘었다. PK 자동 인덱스 4개를 더하면 `pg_indexes` 조회에는 **11개**로 보인다.

```sql
-- 1. 보관 항목 (로그인 사용자 전용)
CREATE TABLE IF NOT EXISTS "RpItem" (
    id             TEXT PRIMARY KEY,
    "userId"       INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "imageHash"    VARCHAR(64) NOT NULL,
    thumbnail      TEXT,
    "analysisJson" TEXT NOT NULL,
    "mjPrompt"     TEXT NOT NULL,
    "sdPositive"   TEXT NOT NULL,
    "sdNegative"   TEXT NOT NULL,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "RpItem_userId_createdAt_idx" ON "RpItem"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RpItem_imageHash_idx"         ON "RpItem"("imageHash");

-- 2. 해시 기반 분석 캐시
CREATE TABLE IF NOT EXISTS "RpAnalysisCache" (
    "imageHash"    VARCHAR(64) PRIMARY KEY,
    "analysisJson" TEXT NOT NULL,
    "hitCount"     INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastUsedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "RpAnalysisCache_lastUsedAt_idx" ON "RpAnalysisCache"("lastUsedAt");

-- 3. 비로그인 일일 사용량
CREATE TABLE IF NOT EXISTS "RpGuestUsage" (
    id           TEXT PRIMARY KEY,
    "visitorKey" VARCHAR(64) NOT NULL,
    "usedDate"   DATE NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "RpGuestUsage_visitorKey_usedDate_key"
    ON "RpGuestUsage"("visitorKey", "usedDate");

-- 4. AI 호출 로그 (실패·캐시적중 포함 전건)
CREATE TABLE IF NOT EXISTS "RpAiUsageLog" (
    id             TEXT PRIMARY KEY,
    "userId"       INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
    "visitorKey"   VARCHAR(64),
    purpose        VARCHAR(50) NOT NULL,
    model          VARCHAR(100) NOT NULL,
    "inputTokens"  INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheHit"     BOOLEAN NOT NULL DEFAULT FALSE,
    "environment"  VARCHAR(20) NOT NULL DEFAULT 'production',
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "RpAiUsageLog_userId_createdAt_idx"      ON "RpAiUsageLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RpAiUsageLog_createdAt_idx"             ON "RpAiUsageLog"("createdAt");
CREATE INDEX IF NOT EXISTS "RpAiUsageLog_environment_createdAt_idx" ON "RpAiUsageLog"("environment", "createdAt");
```

### 영향 테이블

| 테이블 | 영향 |
|---|---|
| `RpItem` 외 3개 | **신규 생성** |
| `User` | **참조만** (FK 대상). 스키마 변경 없음, 데이터 변경 없음 |
| 그 외 71개 기존 테이블 | **무관** |

★`ALTER`/`DROP`/`TRUNCATE` **0건** — 스크립트 파싱으로 확인했다.
★`IF NOT EXISTS` 멱등성 — 재실행 시 전부 `NOTICE ... skipping`, **에러 0건**(2026-08-15 재확인).

---

## 2. 백업

**필수는 아니지만 권장한다.**

- 이 DDL은 **기존 데이터를 건드리지 않는다.** 신규 테이블 생성뿐이라 데이터 손실 경로가 없다.
- 다만 운영 DB에 DDL을 거는 작업 자체가 드물므로, 직전 스냅샷이 있으면 심리적·실무적 안전판이 된다.

```sh
# 서버1에서 (스키마만, 빠름)
pg_dump -U aichat_user -d aichat --schema-only -f ~/aichat_schema_$(date +%F).sql

# 전체가 필요하면 (용량·시간 확인 후)
pg_dump -U aichat_user -d aichat -Fc -f ~/aichat_full_$(date +%F).dump
```

★GCP 콘솔에서 인스턴스 스냅샷을 뜨는 편이 더 간단할 수 있다(메모리의 AI 스튜디오 운영 방침 참조).

---

## 3. 배포 순서

각 단계는 **앞 단계가 검증된 뒤에만** 진행한다.

### 3-0. ★사전 조회 — DDL 실행 **전에** 반드시 한다 (조회만, 변경 아님)

★실행은 **0-2절의 `docker exec` 방식**으로 한다(서버1에 psql 없음).

```sh
ssh 10.178.0.2 'PW=$(grep -m1 "^DATABASE_URL" ~/shared-api/.env | sed -E "s#.*://[^:]+:([^@]+)@.*#\1#"); \
  docker exec -e PGPASSWORD="$PW" n8n-docker-db-1 psql -U aichat_user -d aichat \
    -c "SELECT tablename FROM pg_tables WHERE schemaname='"'"'public'"'"' AND tablename LIKE '"'"'Rp%'"'"';"'
```

★**접속한 DB가 운영인지 함께 확인한다.** 조회가 성공했다는 것만으로는 개발 컨테이너에
붙었을 수도 있다. 아래가 전부 맞아야 운영이다.

```sql
SELECT (SELECT count(*) FROM "User") AS users,
       (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Lc%') AS lc_tables,
       (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS total_tables;
```

2026-08-18 실측: **users 73 / Lc\* 11 / 전체 97** — 학습코칭 테이블과 실회원이 있으므로 운영이다.

**0건이어야 한다. 하나라도 나오면 즉시 멈추고 보고한다.**

왜 필요한가 — **DDL이 `IF NOT EXISTS`라 같은 이름 테이블이 이미 있으면 조용히 건너뛴다.**
그러면 **스키마가 다른 채로 코드가 붙고, 에러는 첫 요청 때 난다.** 배포 중이 아니라
사용자가 쓸 때 터지므로 원인 추적도 늦어진다.

★이건 가정이 아니다. 묶음 A에서 `Lc*` 11개 중 **1개(`LcQuestion.difficulty`)가 스키마와
어긋나 있었다.** 운영 DB가 문서·스키마와 완전히 같다고 전제하면 안 된다.

같은 이름이 이미 있을 경우 대응:
1. `\d "테이블명"`으로 **실제 컬럼을 확인**한다
2. 우리 DDL과 다르면 → **DDL을 실행하지 않는다.** 이름 충돌인지 이전 시도의 잔재인지 판단 후 결정
3. 완전히 같으면 → 이미 적용된 것이므로 3-1을 건너뛰고 3-2로

### 3-1. DDL 실행 (서버1) — ★2026-08-18 실행 완료

명령은 **0-2절** 참조(머지 불필요, stdin 전달, 단일 트랜잭션).

**검증** — 실행 전 테이블 목록을 파일로 떠두고 실행 후 `diff`로 비교한다.
"4개가 늘었다"가 아니라 **"그 4개 외에는 아무것도 변하지 않았다"**를 보여야 한다.

```sh
# 실행 전
ssh ... psql ... -At -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;" > tables_before.txt
# 실행 후 동일 조회 → tables_after.txt
diff tables_before.txt tables_after.txt
```

```sql
-- 테이블 4개
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Rp%' ORDER BY 1;
-- 인덱스 11개 (신규 7 + PK 자동 4)
SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'Rp%' ORDER BY tablename, indexname;
-- environment 기본값
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name='RpAiUsageLog' ORDER BY ordinal_position;
```

**★실행 결과 (2026-08-18)**

| 항목 | 결과 |
|---|---|
| 종료 코드 | **0** |
| `NOTICE ... skipping` | **0건** (3-0에서 0건 확인한 대로) |
| 실행문 | `CREATE TABLE` 4 + `CREATE INDEX` 7 = **11개 전부 성공** |
| 테이블 수 | 97 → **101** |
| `diff` 결과 | **`RpAiUsageLog`·`RpAnalysisCache`·`RpGuestUsage`·`RpItem` 4줄 추가뿐.** 삭제·변경 0줄 |
| 인덱스 | **11개**(신규 7 + PK 4) 전부 확인 |
| `environment` | `character varying` NOT NULL **DEFAULT `'production'::character varying`** ✅ |
| 행 수 | `RpItem`/`RpAnalysisCache`/`RpGuestUsage`/`RpAiUsageLog` **전부 0** |
| `User` 테이블 | **73행 / 20컬럼 유지** — 변경 없음 |
| FK | `RpItem_userId_fkey`·`RpAiUsageLog_userId_fkey` → `User` 정상 생성 |

★**출력에 `NOTICE ... already exists, skipping`이 하나라도 있으면 멈춘다.**
3-0에서 0건을 확인했으므로 나올 수 없는 메시지다. 나왔다면 조회 시점과 실행 시점 사이에
무언가 바뀐 것이므로 원인을 먼저 밝힌다.

### 3-2. shared-api 배포 = ★**머지 시각이 곧 재시작 시각이다** (2026-08-18 전면 재작성)

★**이 단계가 유일하게 기존 aichat에 영향을 준다.** 아래 4장 참조.

#### 왜 다시 썼나 — 초판의 "사람이 pm2:reload를 친다"는 실행될 기회가 없다

서버1 crontab에 **자동배포가 1분마다 돌고 있다.**

```
* * * * * /bin/bash $HOME/shared-api-autodeploy.sh
```

`origin/main`에 새 커밋이 있으면 **자동으로** pull → (필요시) `npm install` →
(필요시) `prisma generate` → `npx tsc --noEmit` → `pm2 reload`까지 한다.

→ **`main`에 머지하는 순간 최대 1분 안에 재시작이 일어난다.**
  **머지 시각을 고르는 것이 곧 중단 시각을 고르는 것이다.** 사람이 reload를 칠 틈은 없다.

★따라서 **트래픽 적은 시간대에 "머지"를 한다.** 머지해 두고 나중에 재시작하는 선택지는 없다.

#### ★선행 조건 — 지금 자동배포가 고장나 있다 (반드시 먼저 해소)

```
마지막 성공 배포 : 2026-08-13 23:15  (8f77564)
그 직후부터 실패  : 2026-08-13 23:19 ~ 현재, pull 실패 6,481회
원인             : 미추적 파일 scripts/hide-chibi-concept.cjs 가 pull 대상과 충돌
                   error: untracked working tree files would be overwritten by merge
결과             : 서버1이 origin/main보다 1커밋 뒤짐 (d031c7f 미반영)
```

**이 상태로 머지하면 우리 커밋도 똑같이 pull 실패하고 배포가 아예 안 된다.**
(에러는 로그에만 남고 화면엔 아무 일도 안 일어나므로 "왜 반영이 안 되지"로 헤맨다.)

해소 방법 — 그 파일은 **`origin/main`의 커밋본과 바이트 단위로 동일**함을 확인했다
(`git show origin/main:... | diff -` → 동일). 즉 지울 때 잃는 내용이 없다.

```sh
ssh 10.178.0.2 'cd ~/shared-api && rm scripts/hide-chibi-concept.cjs'
# 다음 1분 안에 autodeploy가 d031c7f를 자동 배포 → 재시작 1회 발생(20~30초)
```

★**이 해소 작업 자체가 재시작을 유발한다.** 그러므로 이것도 **13:10~13:50 안에서** 한다.
밀린 커밋(`d031c7f`)은 1회성 스크립트 기록이라 런타임 코드가 아니지만, reload는 똑같이 일어난다.

권장 순서: **①미추적 파일 제거 → 자동배포 정상화 확인(중단 1회) → ②우리 브랜치 머지(중단 2회)**
두 번을 한 창구에서 끝낸다. ①을 건너뛰면 ②가 조용히 실패한다.

#### 실행 시각 — ★평일 KST 13:10~13:50, 정각 회피

28일 접속 통계 기준(크론 트래픽 제외한 순수 사람 활동):

| 구간 | 28일 합계 | 하루 평균 |
|---|---|---|
| KST 13시 | 10건 | 0.36 |
| KST 14시 | 13건 | 0.46 |

- **정각을 피한다** — 매시 정각에 `learning-notify`(UTC `0 * * * *`)가 돈다
- **13:00 / 14:00 정각 ±2분을 피해 13:10~13:50에 머지**한다
- 새벽 04~06시가 사람 활동 0건이라 더 안전하지만, **문제 발생 시 판단할 사람이 깨어 있는 것**이
  더 중요하다고 보아 낮 시간대를 택했다(사용자 결정)

#### ★이번 배포는 20~30초가 아니라 **35~60초**로 잡는다

`package.json`에 **`sharp`가 추가**되고 `prisma/schema.prisma`도 바뀌므로
autodeploy가 `npm install` + `prisma generate`를 **둘 다** 수행한다.
서버1에 sharp는 **아직 설치돼 있지 않다**(`node_modules/sharp` 없음).

실측 사례(2026-08-13, npm install + prisma generate 동반 배포):

```
12:21:02 새 커밋 감지
12:21:03 npm install 실행      (약 8초)
12:21:11 prisma generate 실행  (약 2초)
12:21:37 배포 완료             ← 감지부터 완료까지 35초
```

★sharp는 네이티브 바이너리를 받으므로 위 8초보다 오래 걸릴 수 있다.
**실제 요청이 끊기는 구간은 `pm2 reload` 이후 ts-node 부팅까지의 20~30초**이고,
`npm install`·`prisma generate`가 도는 동안에는 **기존 프로세스가 그대로 응답한다.**

#### 머지 명령 (★대상 브랜치 주의 — 0-1절)

```sh
cd ~/shared-api                      # ★shared-api는 main (ai_mp는 master)
git ls-remote --heads origin         # main만 있는지 눈으로 확인
git checkout main && git pull origin main
git merge --no-ff feature/reverse-prompt
git push origin main                 # ← ★이 순간부터 최대 1분 뒤 재시작
```

★`git push` 시각을 기록해 둔다. 아래 감시의 기준점이 된다.

---

### 3-2-1. ★머지 직후 감시 — 무엇을 몇 분간 볼 것인가

푸시 후 **최소 10분**은 자리를 지킨다. 아래 3가지를 동시에 본다.

#### 감시 A — autodeploy 로그 (푸시 후 0~2분)

```sh
ssh 10.178.0.2 'tail -f ~/shared-api-autodeploy.log'
```

**정상이면 이 순서로 찍힌다:**

```
새 커밋 감지: 8f77564 → <새 해시>
package.json 변경 감지 → npm install 실행
prisma/schema.prisma 변경 감지 → prisma generate 실행
✔ Generated Prisma Client (v7.8.0) ...
[PM2] Applying action reloadProcessId on app [shared-api](ids: [ 0 ])
[PM2] [shared-api](0) ✓
배포 완료: <새 해시> / "status":"online"
```

★**`배포 완료`가 안 뜨고 `ERROR:`가 뜨면 reload는 일어나지 않았다**(서버는 구버전 그대로 정상 동작).
스크립트가 각 단계 실패 시 `exit 1`로 빠지므로 **깨진 코드가 반영되는 경로가 없다.**

| 로그 | 의미 | 조치 |
|---|---|---|
| `ERROR: pull 실패` | 미추적 파일 충돌 등 | 선행 조건 미해소. 파일 정리 후 재시도 |
| `ERROR: npm install 실패` | sharp 빌드 실패 등 | **reload 안 됨.** 원인 확인, 서비스는 무사 |
| `ERROR: 타입 체크 실패` | tsc 오류 | **reload 안 됨.** 코드 고쳐 재푸시 |
| `WARN: 로컬이 원격보다 앞섬` | 서버1에서 직접 커밋한 것이 있음 | 배포 중단됨. 수동 확인 |
| `배포 완료 ... "status":"online"` | ✅ 정상 | 감시 B로 |

#### 감시 B — pm2 상태와 에러 로그 (푸시 후 1~5분)

★**`restart_time`(↺)을 푸시 전에 적어둔다.** 현재 **4976**이다.

```sh
ssh 10.178.0.2 'cd ~/shared-api && ./node_modules/.bin/pm2 list'
```

| 관찰 | 판정 |
|---|---|
| `↺`가 **1만 증가**하고 `status=online`, `uptime`이 새로 시작 | ✅ 정상 |
| ★`↺`가 **계속 증가**(2, 3, 4...) | ❌ **크래시 루프.** 즉시 롤백 |
| `status=errored` / `stopped` | ❌ 즉시 롤백 |

```sh
# 실시간 에러 로그 — 부팅 실패는 여기 찍힌다
ssh 10.178.0.2 'cd ~/shared-api && tail -f logs/error-$(date +%F).log'
```

#### 감시 C — ★기존 API가 살아 있는지 (푸시 후 0~10분)

**신규 기능이 되는지보다 기존 aichat이 무사한지가 먼저다.**

```sh
# 30초 간격으로 10분간 (운영 도메인 = Vercel 프록시 경유까지 확인)
for i in $(seq 1 20); do
  printf "%s health=%s " "$(date +%H:%M:%S)" \
    "$(curl -s -m 10 -o /dev/null -w '%{http_code}' https://aichat.dbzone.kr/api/health)"
  printf "personas=%s\n" \
    "$(curl -s -m 10 -o /dev/null -w '%{http_code}' https://aichat.dbzone.kr/api/aimp/personas)"
  sleep 30
done
```

- 재시작 순간의 **1~2회 502/504는 예상된 것**이다(20~30초 중단)
- ★**3분이 지나도 200으로 안 돌아오면 롤백**한다
- 화면으로도 확인: `https://aichat.dbzone.kr` 메인, `/learning`(학습코칭) 실제 렌더

---

### 3-2-2. ★tsc는 통과하는데 런타임에서 죽는 경우 — 어떻게 감지하나

autodeploy의 `npx tsc --noEmit` 게이트는 **문법·타입 오류만** 막는다.
아래는 **전부 tsc를 통과하고 부팅 시점에 터진다.** 이번 변경에 해당 위험이 실재한다.

| 위험 | 이번 변경에서의 근거 | 터지는 시점 |
|---|---|---|
| **`sharp` 네이티브 모듈 로드 실패** | 서버1에 sharp 미설치, 이번에 처음 설치됨. libvips 네이티브 바이너리 의존 | `import` 시점 = **부팅 즉시** |
| **`routes/aimp/index.ts` import 체인** | 신규 라우터가 `index.ts`에 등록됨 → 하위 import 하나만 터져도 **라우터 전체가 안 올라옴** | 부팅 즉시 |
| Prisma Client에 `Rp*` 모델 없음 | `prisma generate` 실패 시 `prisma.rpItem` 이 undefined | 첫 요청 시 |
| 환경변수 누락(`RP_VERTEX_LOCATION` 등) | 상수 파일이 기본값을 갖는지 여부에 달림 | 첫 요청 시 |

★**가장 무서운 것은 두 번째다.** 신규 라우터 하나가 죽으면 `routes/aimp/index.ts`가
통째로 실패해 **기존 aichat API 전체가 죽는다.** 리버스 프롬프트만 안 되는 게 아니다.

#### 감지 방법 — 3층으로 본다

**1층. 프로세스가 살아 있나** (부팅 실패는 여기서 즉시 드러난다)

```sh
ssh 10.178.0.2 'cd ~/shared-api && ./node_modules/.bin/pm2 list'
```
`autorestart: true`라 죽으면 pm2가 계속 되살린다 → **`↺`가 빠르게 증가하는 것이 크래시 신호**다.
`status=online`인데 ↺만 오르면 "부팅 → 크래시 → 재부팅"을 반복 중이다.

**2층. 부팅 로그에 예외가 있나**

```sh
ssh 10.178.0.2 'cd ~/shared-api && tail -50 logs/error-$(date +%F).log'
ssh 10.178.0.2 'cd ~/shared-api && ./node_modules/.bin/pm2 logs shared-api --lines 50 --nostream'
```
찾을 문자열: `Cannot find module`, `sharp`, `libvips`, `ERR_DLOPEN_FAILED`,
`PrismaClientInitializationError`, `Cannot read properties of undefined`

**3층. ★기존 라우트가 실제로 응답하나** (이게 결정적이다)

프로세스가 online이어도 라우터가 안 붙었을 수 있다. **health만 보면 속는다** —
`/api/health`는 라우터 등록 실패와 무관하게 응답할 수 있다.

```sh
# ★기존 기능 라우트를 직접 때려본다
curl -s -m 10 -o /dev/null -w "personas=%{http_code}\n"  localhost:3020/api/aimp/personas
curl -s -m 10 -o /dev/null -w "learning=%{http_code}\n"  localhost:3020/api/aimp/learning/quota
curl -s -m 10 -o /dev/null -w "health=%{http_code}\n"    localhost:3020/api/health
```

★**`/api/health`는 200인데 `/api/aimp/personas`가 404/500이면 라우터 등록이 실패한 것이다.**
이 조합이 나오면 **즉시 롤백**한다.

**신규 라우트 확인은 그 다음이다:**
```sh
curl -s -m 10 localhost:3020/api/aimp/reverse-prompt/quota
# → {"limit":2,"used":0,"remaining":2,"isLoggedIn":false}
```
★이게 실패해도 **기존 API가 전부 정상이면 롤백하지 않아도 된다** — 진입점을 켜지 않았으므로
사용자에게 노출되지 않는다. 원인을 보고 다음 판단을 한다.

---

### 3-2-3. ★롤백 — autodeploy 기준으로 다시 씀

#### ★핵심: revert 커밋을 push하면 자동으로 되돌아간다 (스크립트 로직으로 확인)

autodeploy는 "새 기능 커밋"과 "revert 커밋"을 **구분하지 않는다.**
`origin/main`이 로컬보다 앞서기만 하면 pull + reload 한다.

```sh
git merge-base --is-ancestor "$REMOTE" "$LOCAL"   # 원격이 로컬의 조상인가?
#   참  → 로컬이 앞섬 → 배포 안 함(경고만)
#   거짓 → 원격이 앞섬 → pull + reload   ← revert 커밋도 여기에 해당
```

revert 커밋은 **원격을 앞서게 만드는 새 커밋**이므로 정상 배포 경로를 탄다.
따라서 **롤백도 push 한 번이면 자동으로 반영된다.**

```sh
cd ~/shared-api
git revert --no-edit -m 1 <머지커밋해시>   # -m 1 = main 쪽을 부모로
git push origin main                        # ← 최대 1분 뒤 자동 롤백 + 재시작
```

★**`-m 1`을 빼면 "merge commit이라 어느 부모인지 모른다"며 실패한다.** 머지 커밋 revert의 함정이다.

#### ★롤백도 중단을 한 번 더 일으킨다

| 시점 | 중단 |
|---|---|
| 머지 push | 20~30초 (npm install 포함 시 감지~완료 35~60초) |
| revert push | **20~30초 한 번 더** |

즉 문제가 나면 **총 2회 중단**이다. 13:10~13:50 창구를 잡을 때 이 여유를 감안한다.
`sharp`는 이미 설치돼 있으므로 롤백 시 `npm install`은 다시 돌지 않는다(더 빠르다).

#### 되돌릴 때 DB는 건드리지 않는다

`Rp*` 4개 테이블은 **그대로 둔다.** 코드가 없으면 아무도 읽지 않는 빈 테이블일 뿐이고,
다시 배포할 때 재사용된다. DROP은 이 기능을 완전히 접기로 결정했을 때만 한다.

#### 긴급도별 선택지

| 상황 | 조치 | 중단 |
|---|---|---|
| 리버스 프롬프트만 실패, 기존 API 정상 | **아무것도 안 한다.** 진입점 미노출이라 사용자 영향 0 | 없음 |
| 기존 API 일부 이상 | revert push | +20~30초 |
| ★크래시 루프(↺ 급증) | revert push. 급하면 `pm2 stop shared-api` 후 revert | +20~30초 |
| 프론트만 문제 | Vercel에서 이전 배포 Promote | **없음** |

★**가장 싼 응급 조치는 여전히 "진입점을 안 켜는 것"이다.** E-2e 전까지는 사용자 유입이 0이므로,
백엔드에 문제가 있어도 **급히 롤백할 이유가 없다.** 원인을 보고 판단할 시간이 있다.

#### ★하지 말 것

- **서버1에서 직접 코드를 고치지 않는다.** 로컬이 원격보다 앞서면 autodeploy가
  `WARN: 로컬이 원격보다 앞섬`으로 **배포를 멈춘다**(2026-08-11에 재시작 4,960회 사고를 낸 그 경로).
  고칠 것이 있으면 서버2에서 고쳐 push한다
- **`pm2 reload`를 손으로 치지 않는다.** autodeploy와 경합한다

### 3-3. 프론트 배포 (Vercel)

`master` 푸시 → 자동 빌드. **Promote to Production은 사람이 직접 누른다.**

**검증** (훅 규칙에 따름 — 번들 해시로 판단하지 않는다)
```sh
bash ~/vercel_status.sh                      # 운영 중인 배포 확인
curl -s https://aichat.dbzone.kr/reverse-prompt -o /dev/null -w "%{http_code}\n"   # 200
curl -s https://aichat.dbzone.kr/api/aimp/reverse-prompt/quota                     # JSON
npm run smoke                                # 운영 렌더 확인
```

### 3-4. 진입점 노출 — ★이번 범위 아님

메인 카드/퀵메뉴 등록은 **별도 판단**이다. 3-3까지 검증된 뒤 결정한다.
현재는 `/reverse-prompt`로 직접 들어가야만 보인다.

---

## 4. shared-api 재시작 영향

| 항목 | 내용 |
|---|---|
| 영향 범위 | **aichat 전체 API** — 채팅·학습코칭·전자책 등 모든 기능 (토스봇은 별도 pm2 프로세스라 무관) |
| 중단 시간 | ts-node 부팅 포함 **20~30초**. ★이번엔 `npm install`(sharp)+`prisma generate`가 붙어 **감지~완료 35~60초** |
| 증상 | 그 사이 요청은 502 또는 연결 거부 |
| 트리거 | ★**`main` 푸시.** 사람이 reload를 치는 게 아니라 autodeploy가 1분 내 자동 수행(3-2절) |
| 크론 충돌 | ★매분 도는 워커가 **7종**이다(stock/used-item/luxury/insurance/ebook-image-slot/ebook-cover/learning-module). 재시작과 겹치면 각 1회 실패하고 `~/aimp-cron.log`에 FAIL이 남는다. **다음 분에 정상 복구**되므로 무해하나, 로그를 보고 놀라지 않도록 알아둔다 |
| 권장 시점 | ★**평일 KST 13:10~13:50, 정각 회피**(28일 통계 근거는 3-2절) |

★`pm2 reload`는 무중단을 지향하지만 `instances: 1`이라 실질적으로 재시작이다.

★**토스봇은 영향 없다** — `toss-trader`·`toss-trader-paper`가 별도 pm2 프로세스로 돌고
`shared-api` reload와 무관하다(2026-08-18 `pm2 list` 확인).

---

## 5. 롤백

| 단계 | 롤백 방법 | 가능? | ★추가 중단 |
|---|---|---|---|
| **3-1 DDL** | `DROP TABLE "RpItem","RpAnalysisCache","RpGuestUsage","RpAiUsageLog" CASCADE;` ★단 롤백 시 보통 **테이블은 그대로 둔다**(3-2-3 참조) | ✅ | 없음 (기존 테이블 무관) |
| **3-2 배포** | ★**revert 커밋 push** → autodeploy가 자동 롤백. `git revert -m 1 <머지해시>` (상세 3-2-3) | ✅ | **20~30초** ★ |
| **3-3 Vercel** | 콘솔에서 이전 배포를 Promote | ✅ | 없음 (프론트만) |
| **3-4 진입점** | 링크 제거 후 재배포 | ✅ | 없음 (프론트만) |

★**롤백에도 중단이 따른다.** 백엔드를 되돌리려면 — 라우터 1줄을 빼든 커밋을 되돌리든 —
**shared-api 재시작이 필요하고, 그때 다시 20~30초 aichat 전체가 멎는다.**
즉 문제가 생기면 중단이 **두 번**(배포 시 1회 + 롤백 시 1회) 발생한다.
시간대를 고를 때 이 점을 감안한다.

프론트(3-3·3-4)는 Vercel이 처리하므로 **백엔드 중단 없이** 되돌릴 수 있다.
따라서 **"일단 진입점만 내린다"가 가장 싼 응급 조치**다 — 사용자 유입을 막고
백엔드는 그대로 둔 채 원인을 본 뒤, 정말 필요할 때만 재시작을 동반한 롤백을 한다.

### ★되돌릴 수 없는 지점 — 없다

이 배포에는 **비가역 작업이 없다.**

- 기존 테이블을 변경하지 않으므로 데이터 손실 경로가 없다
- 신규 테이블은 통째로 DROP하면 배포 전 상태로 정확히 돌아간다
- 단, **사용자가 실제로 쓰기 시작한 뒤**에는 `RpItem`에 사용자 데이터가 쌓인다.
  그때 DROP하면 **그 데이터는 사라진다.** 진입점을 노출한 뒤 롤백하려면
  `RpItem`을 먼저 백업하거나, DROP 대신 라우터만 내려 접근을 막는 편이 낫다.

---

## 5-2. ★E-2 단계 구분 — 되돌리기 어려운 순서대로 승인 지점을 둔다

각 단계마다 **보고 → 승인 → 다음**. 승인 없이 다음 단계로 넘어가지 않는다.

| 단계 | 내용 | 되돌리기 | 승인 후 다음 |
|---|---|---|---|
| **E-2a** | 운영 DB **조회만** — `Rp*` 테이블 부재 확인(3-0) | 해당 없음(읽기) | → E-2b |
| **E-2b** | DDL 실행 | DROP으로 완전 복구, 중단 없음 | → E-2c |
| **E-2c** | shared-api 재시작 + 첫 호출이 `environment='production'`으로 기록되는지 확인 | 재시작 필요(**+20~30초**) | → E-2d |
| **E-2d** | Vercel Promote(**사람이 직접**) — **진입점 노출 전 상태로 대기** | 이전 배포 Promote, 중단 없음 | → E-2e |
| **E-2e** | 운영에서 실계정 1~2회 실제 왕복 → 이상 없으면 **진입점 노출** | 링크 제거, 중단 없음 | 완료 |

★**E-2e가 핵심이다.** 진입점을 켜기 전에 `/reverse-prompt`로 직접 들어가 실제로 써본다.
**개발 컨테이너에서 되는 것과 운영에서 되는 것은 다르다** — 이번 프로젝트에서 반복 확인됐다
(Vertex 리전 404, `/api/api/` 중복, `.env` source 파손 모두 실제 실행에서만 드러났다).

E-2e에서 확인할 것:
- 이미지 1장 업로드 → MJ/SD 결과 표시 → 복사
- `RpAiUsageLog`에 **`environment='production'`**으로 기록 (개발분과 분리되는지)
- `RpItem`에 보관되는지, 보관함에서 다시 열리는지
- ★한도·캐시 테스트는 **하지 않는다.** 운영 로그에 테스트 데이터를 남기지 않기 위함이며,
  이미 개발 컨테이너에서 검증했다

### E-2에서 함께 보완할 것 (E-1에서 근거가 약했던 2건)

E-1의 14개 항목 중 아래 둘은 다른 항목들과 근거의 성격이 다르다. E-2에서 실측으로 보강한다.

| # | E-1 근거 | 약한 이유 | E-2 보완 |
|---|---|---|---|
| **7** 원본 미저장 | "업로드 디렉터리 없음" | **sharp가 처리 중 임시 파일을 쓰는지는 확인 범위 밖**이었다 | 요청 **처리 중** `/tmp`를 스냅샷 비교해 파일이 생기지 않는지 확인 |
| **8** EXIF 제거 | 단위 테스트 | 함수가 결정적이라 큰 문제는 아니나, **실제 왕복으로 확인한 다른 항목과 성격이 다르다** | EXIF가 심긴 이미지를 **실제 API로 업로드**해 전처리 결과의 EXIF 부재를 확인 |

## 6. 배포 전 체크리스트

**사전**
- [ ] 머지 승인 — ★**대상 브랜치를 틀리지 않는다**(0-1절 참조)
      - `ai_mp` → **`master`** (`main` 아님! Vercel이 `master`를 본다)
      - `shared-api` → **`main`**
      - 머지 전 `git ls-remote --heads origin`으로 눈으로 확인
- [ ] 백업 또는 스냅샷 (권장 — 데이터 손실 경로는 없으나 안전판)
- [ ] shared-api 재시작 **시점** 확인 — ★실사용자가 적은 시간대.
      **롤백 시 한 번 더 중단**되므로 여유 있는 시간을 고른다

**E-2a** (조회만) — ★**2026-08-18 완료**
- [x] `Rp%` 조회 → **0건 확인**
- [x] 운영 DB 확인 — users 73 / `Lc*` 11 / 전체 97, 컨테이너 포트가 `10.178.0.2:5432`
- [x] 보고 → 승인

**E-2b** (DDL) — ★**2026-08-18 완료**
- [x] DDL 실행(단일 트랜잭션) → 종료코드 0, `NOTICE ... skipping` **0건**
- [x] 테이블 4개 / 인덱스 11개(신규 7 + PK 4) 확인
- [x] `environment` DEFAULT `'production'` 확인
- [x] 실행 전후 `diff` → **추가 4줄 외 변화 없음**, `User` 73행·20컬럼 유지
- [x] 보고 → 승인

**E-2c** (머지 = 재시작) — ★절차 전문은 3-2 / 3-2-1 / 3-2-2 / 3-2-3
- [ ] ★**선행**: 서버1 미추적 파일 `scripts/hide-chibi-concept.cjs` 제거 →
      autodeploy 정상화 확인(`배포 완료: d031c7f`). **이것도 재시작 1회를 유발**하므로 창구 안에서
- [ ] 푸시 전 `pm2 list`의 `↺` 값 기록 (현재 **4976**)
- [ ] ★**평일 KST 13:10~13:50, 정각 회피**에 `git push origin main`
- [ ] 감시 A: autodeploy 로그에 `배포 완료 ... "status":"online"` (0~2분)
- [ ] 감시 B: `↺`가 **1만** 증가, `status=online` (1~5분) — 계속 증가하면 크래시 루프
- [ ] 감시 C: 운영 도메인 `/api/health` + `/api/aimp/personas` 30초 간격 10분
- [ ] ★런타임 사망 감지: `/api/health` 200인데 `/api/aimp/personas` 404/500이면 **즉시 롤백**
- [ ] `/api/aimp/reverse-prompt/quota` 응답 확인 (실패해도 기존 API 정상이면 롤백 불필요)
- [ ] ★E-1 보완: 요청 처리 중 `/tmp` 스냅샷 비교(원본 미저장 실측)
- [ ] ★E-1 보완: EXIF 심긴 이미지 실제 업로드 → 결과물 EXIF 부재 확인
- [ ] 첫 호출이 `environment='production'`으로 기록되는지 확인
- [ ] 기존 aichat 회귀 (메인·학습코칭·채팅)
- [ ] 보고 → 승인

**E-2d** (프론트)
- [ ] Vercel Promote (**사람이 직접**)
- [ ] `bash ~/vercel_status.sh` — 운영 중인 배포 확인
- [ ] `npm run smoke`
- [ ] ★**진입점 노출 전 상태로 대기**
- [ ] 보고 → 승인

**E-2e** (운영 왕복 → 진입점)
- [ ] `/reverse-prompt` 직접 접속 → 실계정 1~2회 왕복
- [ ] `RpAiUsageLog`에 `environment='production'` 기록 확인
- [ ] 보관함 저장·재열람 확인
- [ ] 이상 없으면 **진입점 노출**
- [ ] 개발 컨테이너 정리: `docker compose -f dev-db/docker-compose.yml down -v`

★**롤백이 필요해지면**: 먼저 **진입점만 내린다**(중단 없음). 그것으로 부족할 때만
백엔드 롤백(재시작 +20~30초)을 한다.
