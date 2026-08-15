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

## 1. 운영 DDL 전문

파일: `shared-api/prisma/reverse-prompt-ddl.sql`
실행: `psql -U aichat_user -d aichat -f reverse-prompt-ddl.sql` (서버1)

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

```sql
SELECT tablename FROM pg_tables
WHERE schemaname='public' AND tablename LIKE 'Rp%';
```

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

### 3-1. DDL 실행 (서버1)

```sh
cd ~/shared-api && git pull origin main   # feature 브랜치 머지 후
psql -U aichat_user -d aichat -f prisma/reverse-prompt-ddl.sql
```

**검증**
```sql
\dt "Rp"*                                    -- 4개 확인
\d "RpAiUsageLog"                            -- environment 컬럼 확인
SELECT count(*) FROM "RpItem";               -- 0
```

★**출력에 `NOTICE ... already exists, skipping`이 하나라도 있으면 멈춘다.**
3-0에서 0건을 확인했으므로 나올 수 없는 메시지다. 나왔다면 조회 시점과 실행 시점 사이에
무언가 바뀐 것이므로 원인을 먼저 밝힌다.

### 3-2. shared-api 재시작 (서버1)

★**이 단계가 유일하게 기존 aichat에 영향을 준다.** 아래 4장 참조.

```sh
cd ~/shared-api && npm run pm2:reload        # ecosystem.config.cjs 기준
pm2 logs shared-api --lines 30               # 기동 확인
curl -s localhost:3020/api/health            # {"ok":true,...}
```

**검증**
```sh
curl -s localhost:3020/api/aimp/reverse-prompt/quota
# → {"limit":2,"used":0,"remaining":0또는2,"isLoggedIn":false}
```

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
| 영향 범위 | **aichat 전체 API** — 채팅·학습코칭·전자책·토스봇 등 모든 기능 |
| 중단 시간 | `pm2 reload` 기준 **수 초** (ts-node 부팅 포함 20~30초 관측) |
| 증상 | 그 사이 요청은 502 또는 연결 거부 |
| 크론 충돌 | 서버1 크론이 매분 `learning-module-worker`를 호출한다. 재시작과 겹치면 그 1회가 실패하고 `~/aimp-cron.log`에 FAIL이 남는다. **다음 분에 정상 복구**되므로 무해하나, 로그를 보고 놀라지 않도록 알아둔다 |
| 권장 시점 | **트래픽이 적은 시간대.** 사용자 확인 필수 |

★`pm2 reload`는 무중단을 지향하지만 `instances: 1`이라 실질적으로 재시작이다.

---

## 5. 롤백

| 단계 | 롤백 방법 | 가능? | ★추가 중단 |
|---|---|---|---|
| **3-1 DDL** | `DROP TABLE "RpItem","RpAnalysisCache","RpGuestUsage","RpAiUsageLog" CASCADE;` | ✅ | 없음 (기존 테이블 무관) |
| **3-2 재시작** | 이전 커밋 `git checkout` 후 재기동 | ✅ | **20~30초** ★ |
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
- [ ] `feature/reverse-prompt` → `main`(shared-api) / `master`(ai_mp) 머지 승인
- [ ] 백업 또는 스냅샷 (권장 — 데이터 손실 경로는 없으나 안전판)
- [ ] shared-api 재시작 **시점** 확인 — ★실사용자가 적은 시간대.
      **롤백 시 한 번 더 중단**되므로 여유 있는 시간을 고른다

**E-2a** (조회만)
- [ ] `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Rp%';`
      → **0건 확인.** 하나라도 나오면 멈추고 보고
- [ ] 보고 → 승인

**E-2b** (DDL)
- [ ] DDL 실행 → `NOTICE ... skipping`이 **없는지** 확인
- [ ] `\dt "Rp"*` 4개 / `\d "RpAiUsageLog"` environment 컬럼 확인
- [ ] 보고 → 승인

**E-2c** (재시작)
- [ ] `npm run pm2:reload` → `/api/health` 확인
- [ ] `/api/aimp/reverse-prompt/quota` 응답 확인
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
