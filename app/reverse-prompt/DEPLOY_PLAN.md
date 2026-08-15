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

| 단계 | 롤백 방법 | 되돌릴 수 있나 |
|---|---|---|
| **3-1 DDL** | `DROP TABLE "RpItem","RpAnalysisCache","RpGuestUsage","RpAiUsageLog" CASCADE;` | ✅ 가능. 기존 테이블을 건드리지 않아 부작용 없음 |
| **3-2 재시작** | 이전 커밋으로 `git checkout` 후 재기동 | ✅ 가능. 라우터 등록 1줄만 빼도 신규 API가 사라진다 |
| **3-3 Vercel** | 콘솔에서 이전 배포를 Promote | ✅ 가능. Vercel이 배포 이력을 보관한다 |
| **3-4 진입점** | 링크 제거 후 재배포 | ✅ 가능 |

### ★되돌릴 수 없는 지점 — 없다

이 배포에는 **비가역 작업이 없다.**

- 기존 테이블을 변경하지 않으므로 데이터 손실 경로가 없다
- 신규 테이블은 통째로 DROP하면 배포 전 상태로 정확히 돌아간다
- 단, **사용자가 실제로 쓰기 시작한 뒤**에는 `RpItem`에 사용자 데이터가 쌓인다.
  그때 DROP하면 **그 데이터는 사라진다.** 진입점을 노출한 뒤 롤백하려면
  `RpItem`을 먼저 백업하거나, DROP 대신 라우터만 내려 접근을 막는 편이 낫다.

---

## 6. 배포 전 체크리스트

- [ ] `feature/reverse-prompt` → `main`(shared-api) / `master`(ai_mp) 머지 승인
- [ ] 백업 또는 스냅샷 (권장)
- [ ] shared-api 재시작 **시점** 확인 (트래픽 적은 시간)
- [ ] DDL 실행 → `\dt "Rp"*` 4개 확인
- [ ] 재시작 → `/api/health` + `/quota` 응답 확인
- [ ] Vercel Promote (**사람이 직접**)
- [ ] `bash ~/vercel_status.sh` + `npm run smoke`
- [ ] 운영 실계정으로 1~2회 왕복 (한도·캐시 테스트는 하지 않는다 — 개발 컨테이너에서 이미 함)
- [ ] `RpAiUsageLog`에 `environment='production'`으로 기록되는지 확인
- [ ] 기존 aichat 화면 회귀 (메인·학습코칭·채팅)
- [ ] 개발 컨테이너 정리: `docker compose -f dev-db/docker-compose.yml down -v`
