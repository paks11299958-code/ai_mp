# AI상담 봇 만들기 (2026-07-07~08)

사용자가 폼(회사명·인사말·알림 연락처)을 채우면 `/consult/{slug}` 링크가 발급되고,
자기 홈페이지 메뉴에 붙이면 방문자 문의(Typebot 리드수집)가 봇 주인에게 이메일로 전달된다.
dbzone.kr의 AI상담(리드봇+3D 아바타) 패턴을 상품화한 것. 기능카드명 **"AI상담 봇 만들기"**.

## ★★핵심 아키텍처 — 마스터 Typebot 1개 멀티테넌트

- 유저마다 봇 복제 ✗ → **마스터 리드수집 봇 1개**(`consult-master`, bot.dbzone.kr).
  Typebot.id=64gk9aq7iy55xzfrypv90pti(서버1 typebot-db). 수정 시 빌더에서 **Publish 필수**.
- 테넌트 구분 = URL 쿼리 prefill: `?tenantSlug=&companyName=&greeting=` (변수명 대소문자 일치).
- 리드 라우팅 = 플로우 마지막 Webhook 블록이 `POST /api/aimp/consult-leads`
  (`X-Consult-Secret` 헤더 = 서버1 ~/shared-api/.env `CONSULT_WEBHOOK_SECRET`).
- 테넌트별 커스텀 플로우는 Phase 2(Typebot API 복제, ConsultBot.customTypebotId 예약).
- 마스터 봇 정본 문서: `~/ai-consult-skeleton/builder/typebot-master-flow.md` (롤백 SQL 포함).

## 구성 요소

| 구간 | 위치 | 내용 |
|------|------|------|
| DB | 서버1 aichat, raw SQL | ConsultBot·ConsultLead (doc/db_schema.md) |
| API | shared-api `routes/aimp/consult.ts` | POST /consult-bots(인증, 유저당 3개)·GET /consult-bots/mine·GET /consult-bots/:slug(공개, 연락처 미포함)·POST /consult-leads(시크릿→저장→Brevo 메일→notifiedAt, 실패해도 200) |
| 페이지 | `frontend/components/ConsultPage.tsx` | `/consult/{slug}` — App 얼리리턴(EmbedChat 패턴), 아바타+마스터봇 iframe, 모바일 상하분할 |
| 아바타 | `public/consult-avatar.html` | model-viewer 3D — glb는 www.dbzone.kr/via3.glb CORS 직접로드(레포 비대화 회피) |
| 라우팅 | vercel.json | `/api/consult-bots*` 프록시 + `/consult/:slug`→index.html |
| 빌더 폼 | `~/ai-consult-skeleton/builder/BuilderForm.tsx` | 기능카드 화면으로 이식 대기 |

## 상태 (2026-07-08)

- ✅ 백엔드+페이지+마스터봇 전구간 가동, E2E 실증(데모봇 `cbd92c47ffd`=디비존, gmail 알림 수신).
- ⏳ 남음: **기능카드 등록**(7항목 체크리스트, 과금 단가=사장 결정 대기) / SMS 알림(발송 비용=사장) /
  공지 초안(기능카드 출시 시점에).

## 함정

- 공개 조회 API에 notifyEmail/Phone 절대 미포함(개인정보).
- 리드 웹훅은 알림 실패해도 **리드 저장+200** (Typebot 재시도 폭주 방지).
- greeting이 빈 값이면 봇에 빈 말풍선 — ConsultPage가 기본 인사말을 항상 채워 보냄.
