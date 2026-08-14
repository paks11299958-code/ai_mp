# 진행 상황 — 리버스 프롬프트 (app/reverse-prompt)

**현재 묶음**: A 완료 / B 미착수
**브랜치**: `feature/reverse-prompt` (ai_mp, shared-api 양쪽)
**최종 갱신**: 2026-08-14

---

## 완료

- [x] 1. 0장 조사 10개 항목 — 결과는 아래 "조사 결과" 표. **PRD 전제와 다른 항목 6건 발견**(별도 절)
- [x] 2. 데이터 모델 확정 — 실제 명명 규칙(PascalCase + camelCase, `@@map` 없음)과
      사용자 PK 타입(`User.id` = **Int autoincrement**)에 맞춰 `Rp*` 4개 확정
      파일: `shared-api/prisma/schema.prisma` (1152→1216줄), `User` 모델에 역관계 2줄 추가
- [x] 3. 마이그레이션 파일 작성(**실행 안 함**) — 파일: `shared-api/prisma/reverse-prompt-ddl.sql`
      검증: `npx prisma validate` 통과 / 실행문 10개(TABLE 4 + INDEX 6) /
      괄호 균형 OK / **ALTER·DROP·TRUNCATE 0건**(CLAUDE.md 기존테이블 보호 규칙 준수) /
      `prisma migrate diff` 생성본과 인덱스 이름·구성 일치 확인
- [x] 4. VLM 후보 3종 단가·토큰 산식 정리 — 아래 "VLM 후보" 절. **사용자 확정 대기**

---

## 조사 결과 (PRD 0장 10개 항목)

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 버전 | Express 4.19.2 / Prisma 7.8.0 / Node 24.14.1 / TS 6.0.3 | `shared-api/package.json` |
| 2 | 인증 | **JWT**. `requireAuth(req,res)` → `number \| null` 반환. 쿠키 `token` 또는 `Bearer`. 일반 7d/어드민 24h | `shared-api/lib/auth.ts:52-60` |
| 3 | 사용자 테이블 | `User`, PK `id` **Int @default(autoincrement())** — uuid/cuid 아님 | `shared-api/prisma/schema.prisma:12` |
| 4 | 스키마 정본 | **`shared-api/prisma/schema.prisma`** (아래 "정본 판단" 절) | 4벌 존재 |
| 5 | 명명 규칙 | PascalCase 모델 + camelCase 컬럼, `@@map` **미사용**(71개 중 3개만 예외) | `grep -c "@@map"` = 3 |
| 6 | 디자인 | 사이트 베이지 톤(`#F5EFE6`/`#2D2438`). 라우팅은 React Router 아님 — `App.tsx` 하단 `window.location.pathname` 수동 매칭 얼리리턴 | `frontend/index.css`, `App.tsx` |
| 7 | 파일 업로드 | **multer 없음.** JSON body에 base64(`imageBase64`+`mimeType`), `express.json({limit:'10mb'})` | `shared-api/app.ts:30`, `routes/aimp/outfit.ts:57` |
| 8 | 기존 AI 호출 | HTTP API. `getGeminiClient()` / `gemini-2.5-flash` 주류(23곳). 모델명은 상수 1곳 통일 관례 | `lib/learning/curriculum.ts:20,28` |
| 9 | 배포 | 프론트=Vercel 자동배포(master 푸시). 백엔드=서버1 pm2 `shared-api`(ts-node 직접 실행) | `ecosystem.config.cjs` |
| 10 | Rate limit | **있음.** `express-rate-limit` 8.5.2, `authLimiter`(15분 20회)를 auth 3개 경로에 적용. `trust proxy = 1` | `shared-api/app.ts:34-44` |

### 정본 판단 — `shared-api/prisma/schema.prisma`

스키마가 **4벌**이다(저장소 2개 × 원본/generated). 정본 근거:

| 후보 | 줄수 | Lc* 11개 | 최종 수정 | 판정 |
|---|---|---|---|---|
| `shared-api/prisma/schema.prisma` | 1152 | **11개 있음** | 2026-08-11 | ★**정본** |
| `ai_mp/prisma/schema.prisma` | 514 | 0개 | 2026-06-17 | 사본(정지) |
| `*/generated/prisma/schema.prisma` | — | — | — | 빌드 산출물 |

결정적 근거: 오늘(08-14) `scripts/check-learning-schema-sync.ts`를 돌린 결과
**운영 DB와 shared-api 스키마가 11개 모델 중 10개 완전 일치**(1건은 무해한 Int/smallint).
ai_mp 쪽은 Lc*가 하나도 없어 운영 DB를 반영하지 못한다. `generated/`는 `output = "../generated/prisma"`
설정으로 생성되는 산출물이라 손대지 않는다.

---

## ★PRD 전제와 다른 부분 (조용히 맞추지 않고 지적)

| # | PRD 전제 | 실제 | 대응 |
|---|---|---|---|
| 1 | 8장 `analysis **Json**` | 이 스키마는 **Json 타입 사용처가 0곳**. 전부 `String`에 stringify(`choicesJson`, `analysisJson` 선례) | `analysisJson String`으로 **정정** |
| 2 | 8장 `costUsd **Decimal**` | `LcAiUsageLog.costUsd`가 **Float**. Decimal 사용처 0곳 | `Float`로 **정정** |
| 3 | 7장 "10MB 초과 거부" | ★**도달 불가.** Vercel 프록시가 10MB에서 순수 413(플랫폼 제약, 실측). base64는 +33% 팽창하므로 원본 상한은 **약 7MB**가 실질 한계 | 묶음 B에서 상한 재설정 필요 — **사용자 확인 필요** |
| 4 | 10장 "이미지 처리: sharp" | sharp는 **ai_mp에만** 있고 shared-api에는 없음 | 묶음 B에서 shared-api에 추가 필요 |
| 5 | CLAUDE.md "저장소 루트 PROGRESS.md" | 루트에 이미 **학습코칭 전용 1243줄** PROGRESS.md 존재. 덮으면 기존 이력 소실 | `app/reverse-prompt/`에 배치(학습코칭 `app/learning/` 선례와 동일) |
| 6 | CLAUDE.md "`src/reverse-prompt/`" | 이 저장소에 `src/` 자체가 없음. 백엔드=`shared-api/routes/aimp/`, 프론트=`frontend/components/` | 기존 구조를 따름 — **사용자 확인 필요** |

추가로, CLAUDE.md는 단일 저장소를 전제하지만 실제로는 **ai_mp(프론트) + shared-api(백엔드)** 두 저장소다.
브랜치도 양쪽에 각각 만들었다.

---

## VLM 후보 (사용자 확정 대기)

1024px 이미지 1장 + 프롬프트를 넣고 6.1 JSON을 받는 1회 호출 기준.

**입력 토큰 산식** — Gemini는 384px 이하면 258토큰 고정, 초과하면 768px 타일당 258토큰.
1024×1024는 `floor(1024/1.5)=682` → 각 변 2타일 → **4타일 × 258 = 1,032토큰**.
여기에 시스템+지시 프롬프트를 약 400토큰으로 잡아 **입력 ≈ 1,450토큰**.
출력은 6.1 스키마(9필드 + MJ/SD 프롬프트 2벌)라 **약 700토큰**으로 잡는다.

| 후보 | 입력 $/1M | 출력 $/1M | 1024px 입력 토큰 | 1건 원가(산식) |
|---|---|---|---|---|
| ★**gemini-2.5-flash** (현 사이트 주류) | $0.30 | $2.50 | 1,032(이미지) + ~400 | (1450×0.30 + 700×2.50)/1e6 = **$0.00219** |
| **gemini-2.5-flash-lite** (최저가) | $0.10 | $0.40 | 동일 | (1450×0.10 + 700×0.40)/1e6 = **$0.00043** |
| **claude-haiku-4-5** (비교군) | $1.00 | $5.00 | 산식 다름(별도 실측 필요) | 대략 (1450×1.00 + 700×5.00)/1e6 = **$0.00495** |

**추천: `gemini-2.5-flash`.**
- 사이트 전역이 이미 Gemini 주류(23곳)라 정책·키 관리가 일치한다
- 학습코칭에서 Claude→Gemini 전환 시 **A/B 실측으로 규칙 준수 동등, 원가 1/5** 확인된 전례가 있다
- flash-lite가 5배 싸지만, MJ/SD 프롬프트는 **형식 일관성이 제품의 본체**(PRD 1.2)라
  스키마 준수가 흔들리면 재시도 비용이 절감분을 먹는다. 묶음 B에서 두 모델 A/B 후 확정 권장

**월 원가 상한(PRD 11장)** — 위는 산식값이며 **실측이 아니다.** 캐시 적중률과 실제 토큰을
묶음 E에서 측정해 확정한다. 참고로 gemini-2.5-flash 기준 월 1만 건이면 약 $21.9.

★**`maxOutputTokens`를 넘기지 말 것** — Gemini 2.5 Flash는 사고 토큰을 이 한도에 함께
계산해 JSON이 잘린다(학습코칭 2026-08-13 실측). 스키마가 응답 크기를 제한하므로 한도 없이 쓴다.

---

## 다음 할 일 (묶음 B)

- shared-api에 `sharp` 추가 (전처리: 리사이즈·EXIF 제거·해시·썸네일)
- `lib/reverse-prompt/` — VLM 호출 모듈 + 프롬프트 상수 분리 + JSON 스키마 검증·재시도(최대 2회)
- 분석 캐시(`RpAnalysisCache`) / 사용량 로그(`RpAiUsageLog`) / 일일 한도 검사
- `POST /analyze`, `GET /quota`
- Rp* 4개용 스키마 대조 스크립트 (`check-learning-schema-sync.ts` 방식)

---

## 결정 사항

- **스키마 정본은 shared-api 쪽**으로 판단(위 근거표). ai_mp 스키마는 손대지 않았다
- **PRD의 Json→String, Decimal→Float 정정**은 기존 71개 모델 관례를 따른 것. 관례를 깨면
  대조 스크립트·조회 코드가 전부 예외 처리를 안게 된다
- **DDL은 `prisma/<기능>-ddl.sql` 파일 방식**을 따랐다. 이 저장소는 `prisma/migrations/`
  디렉터리 자체가 없고 `club-ddl.sql`·`learning-coach-ddl.sql` 선례가 있다
- **TIMESTAMPTZ 유지** — Prisma 생성본은 `TIMESTAMP(3)`을 쓰지만, 기존 Lc DDL이 전부
  TIMESTAMPTZ이고 대조 스크립트가 `timestamp with time zone`을 `DateTime`으로 허용한다
  (오늘 오전 대조에서 Lc* 11개가 이 타입으로 불일치 판정되지 않은 것이 증거)
- **문서 위치는 `app/reverse-prompt/`** — 루트 PROGRESS.md는 학습코칭 것이라 덮을 수 없다

---

## 위험 요소

- ★**업로드 상한 10MB는 실질 도달 불가**(Vercel 프록시 413). base64 팽창까지 감안하면
  원본 7MB 근처가 한계다. PRD 7장 수치를 그대로 구현하면 사용자가 원인 모를 413을 본다
- **비로그인 한도의 `visitorKey`가 우회 가능** — IP 해시+지문 조합은 시크릿창·IP 변경으로
  뚫린다. PRD 11장 8항("우회 경로를 만들지 않는다")을 완전히 만족시키긴 어렵다는 점을 인지할 것
- **썸네일 base64를 DB에 넣으면 `RpItem` 행이 커진다.** 128px JPEG이라도 행당 수 KB.
  보관함 목록 쿼리에서 `thumbnail`을 SELECT하지 않도록 주의(묶음 C)

---

## 막힌 것 / 사용자 확인 필요

1. **썸네일 정책** (PRD 7장) — base64 128px를 DB에 보관할지, 아니면 프롬프트+생성일만 둘지.
   스키마에는 `thumbnail String?`로 **nullable** 넣어두었으니 어느 쪽이든 수용 가능
2. **VLM 모델 확정** — 위 표에서 `gemini-2.5-flash` 추천. flash-lite로 갈지 A/B 후 정할지
3. **신규 코드 위치** — CLAUDE.md의 `src/reverse-prompt/`는 이 저장소에 없는 경로다.
   `shared-api/lib/reverse-prompt/` + `frontend/components/reverse-prompt/`로 가도 되는지
4. **업로드 상한** — 10MB 대신 실질 한계(원본 ~7MB)로 낮출지
5. **운영 DB 마이그레이션 실행** — DDL 파일만 만들었다. 실행은 승인 후
