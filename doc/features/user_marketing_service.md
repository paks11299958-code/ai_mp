# 사용자용 마케팅 콘텐츠 서비스 (기획서)

> 작성: 2026-06-28 · 상태: **기획(미구현, 정책 확정됨)** · 작성자: Claude
> 한 줄 요약: 아린이(마케팅 에이전트)를 **개인 SNS 운영자**에게 열어, 주제를 입력하면 SNS 콘텐츠 초안을 포인트 차감으로 받아보는 기능.

## 0. 확정 정책 (2026-06-28 사장 결재)
- **포인트 단가: 200pt/건** (원가=크롤링+Gemini 2회, 미래의나 100pt보다 무거워 2배). ※최종 단가는 어드민 메뉴권한 탭에서 사장이 조정.
- **채널: 인스타그램만** (MVP. 개인 SNS 운영자 타겟에 시장이 가장 큼. channel 인자 분기 구조라 스레드·블로그는 값만 추가해 추후 확장).
- **1일 호출 제한: 유료는 없음** (포인트가 자연 제한). 무료 체험에만 1회 제한.
- **무료 체험: 1회 제공** (바이럴 유입 미끼). pointTransaction 1회성 플래그로 중복 차단([[project_onboarding_missions]] 방식).

---

## 1. 무엇을 / 누구에게

- **타겟**: 개인 SNS 운영자 (인스타·스레드를 키우려는 개인)
- **사용자 가치**: "주제만 주면 후킹·해시태그·캡션이 갖춰진 SNS 글 초안이 나온다"
- **범위 제한(아린이와 동일)**: 콘텐츠는 **초안까지**. 실제 발행은 사용자가 직접
  (계정 정지·약관 위반·되돌리기 불가 위험 회피 — 기존 아린 정책 그대로 계승).

## 2. 왜 아린이를 그대로 못 여는가 (제약)

| 제약 | 내용 | 해법 |
|------|------|------|
| 아린은 사장님 전용 | 텔레그램 `/marketing`, 인증된 사람만 호출 | 사용자 진입로(웹+shared-api)를 새로 만든다 |
| 지시문이 "우리 서비스 홍보용" | `marketing_arin.md`는 *우리 AI 페르소나 플랫폼* 근거로 씀 | **사용자용 별도 지시문** 필요(가게/개인 SNS 대상) |
| 풀 실행이 느림(~2분) | crawler.js 웹크롤링 + Gemini 2회 | **비동기 큐**(보험분석·명품감정과 동일 패턴) |
| 서버 분리 | 아린=서버2(에이전트), 사용자요청=서버1(shared-api) | **DB 큐로 연결**([[project_ai_feature_scout]]에서 검증된 패턴) |

## 3. 아키텍처 (검증된 패턴 재사용)

```
[사용자/웹]                [서버1 shared-api]            [서버1 DB]              [서버2 rag]
  주제 입력 (인스타 고정)
  → 포인트 차감(사전)  ──→  POST /aimp/marketing/request ──→ MarketingRequest(pending) 적재
                                                                     │
                          (cron 매분 폴링하는 워커)  ←───────────────┘
                            marketing_request_worker.py
                              → 사용자용 아린 지시문으로 run()
                              → 결과를 MarketingRequest(done, result) 갱신
  결과 화면(폴링/새로고침) ←─ GET /aimp/marketing/request/:id ←── 결과 조회
```

- **서버2→서버1 DB 직접 INSERT/UPDATE**: 아린이 어드민 자산 적재에서 이미 쓰는 방식
  (`_AICHAT_DSN` 직접 psycopg2, [[project_marketing_assets_admin]]).
- **워커**: `dev_request_worker.py`(2분 cron) 구조를 복제 — pending 폴링 → 처리 → 상태 갱신.

## 4. DB 설계 (신규 테이블)

> ⚠️ 운영 DB ↔ git schema.prisma 불일치 → `prisma db push` 금지.
> **신규 테이블은 raw SQL `CREATE TABLE`로만**, prisma는 `generate`만([[feedback_prisma_deploy]] · 알려진 이슈).

`MarketingRequest`:
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | text PK | `mkreq_` 접두 |
| userId | text | 요청한 사용자 |
| topic | text | 사용자 입력 주제 |
| channel | text | thread/instagram/blog |
| status | text | pending / running / done / failed |
| result | text? | 완성 초안(JSON 또는 마크다운) |
| pointsCharged | int | 차감 포인트(취소 시 환불 근거) |
| createdAt / updatedAt | timestamptz | |

## 5. 포인트 정책 (★사장님이 직접 결정)

- 차감 단가·환불 규칙은 **사장님이 어드민 메뉴권한 탭에서 직접 관리**
  (Claude가 임의 단가 설정 금지 — [[feedback_menulimit_pricing]]).
- 권장 흐름: **사전 차감 → 실패 시 자동 환불**(헤어·미래의나에서 쓰는 패턴).
- 부족 시 402 → `insufficient-points` 이벤트 → 충전 모달([[project_payment_toss]]).

## 6. 사용자용 지시문 (아린이 지시문과 분리)

- 새 파일 `rag/prompts/marketing_arin_user.md` (또는 run에 mode 인자).
- 차이: "우리 서비스 홍보" → "**사용자가 준 대상(개인 SNS/가게)** 홍보".
- 유지: 후킹 우선·가치 판매·1콘텐츠1CTA·측정 프레임·**발행은 사람**·과장 금지
  (방금 강화한 [[project_arin_prompt_marketing]] 방법론 그대로 계승).
- 안전: 외부 입력이므로 **불법·욕설·도배 요청 차단** 가드 추가 필요.

## 7. 프론트 (모바일 우선 — [[feedback_mobile_first]])

- 새 기능 카드(메인): "✍️ AI 마케팅 글쓰기" → 보드 진입.
- 입력: 주제만 (채널은 인스타 고정 — 선택 UI 없음). + 포인트 안내(사전 단가 표시).
- 비동기: 요청 후 "작성 중…" → 폴링 → 결과 카드(복사 버튼). 보험분석 비동기 UX 참고.
- vercel.json 프록시: 새 `/api/aimp/marketing/*` 라우트 = rewrite 2줄 추가 필수
  ([[project_marketing_assets_admin]] 교훈).

## 8. 단계별 구현 순서 (방향 확정 후)

1. **사용자용 지시문** + run(mode) 분기 + 차단 가드 (서버2, 위험 낮음·먼저 검증)
2. **DB 테이블** raw SQL CREATE (서버1)
3. **shared-api 라우트** 3종(요청/조회/목록) + 포인트 차감·환불 (서버1)
4. **서버2 워커** marketing_request_worker.py + cron 등록
5. **프론트 화면** + vercel.json + 메인 카드 (Vercel)

각 단계는 독립 배포 가능(아린 자산 어드민이 4단계로 나눠 배포한 방식).

## 9. 미결정 → 전부 확정됨 (2026-06-28)

- [x] 포인트 단가 → **200pt/건**
- [x] 채널 범위 → **인스타그램만** (MVP, channel 분기로 추후 확장)
- [x] 1일 호출 제한 → **유료 없음** (포인트가 자연 제한), 무료 체험만 1회
- [x] 무료 체험 → **1회 제공** (pointTransaction 1회성 플래그)

다음 액션: 1단계(사용자용 지시문 + 차단 가드)부터 구현 시작 가능.
