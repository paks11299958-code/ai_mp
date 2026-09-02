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
| 아바타 | `public/consult-avatar.html` | 서아 사진 기반 2.5D 영상 — idle과 speaking PoC, 메시지 기반 4상태 제어 |
| 라우팅 | vercel.json | `/api/consult-bots*` 프록시 + `/consult/:slug`→index.html |
| 빌더 폼 | `~/ai-consult-skeleton/builder/BuilderForm.tsx` | 기능카드 화면으로 이식 대기 |

## 상태 (2026-07-08)

- ✅ 백엔드+페이지+마스터봇 전구간 가동, E2E 실증(데모봇 `cbd92c47ffd`=디비존, gmail 알림 수신).
- ⏳ 남음: **기능카드 등록**(7항목 체크리스트, 과금 단가=사장 결정 대기) / SMS 알림(발송 비용=사장) /
  공지 초안(기능카드 출시 시점에).

## 서아 2.5D 아바타 PoC (2026-09-02)

- 외부 3D GLB와 `model-viewer` CDN을 제거하고, LivePortrait idle 영상과 MuseTalk v1.5 한국어
  립싱크 PoC 영상을 로컬 정적 자산으로 연결했다.
- 상태 계약은 `IDLE`, `THINKING`, `SPEAKING`, `FALLBACK` 네 가지다. 부모 페이지가
  `{ type: 'SEOA_AVATAR_STATE', state }`를 같은 출처의 아바타 iframe으로 보낸다.
- 미디어 재생 또는 파일 로딩 실패 시 idle 영상의 `FALLBACK` 상태로 자동 복구한다.
- Typebot 출처는 `https://bot.dbzone.kr`만 허용해 동일 상태 메시지를 아바타로 릴레이한다.
  현재 마스터 Typebot은 이 이벤트를 아직 보내지 않으므로 실제 문답 전환 연동은 후속이다.
- speaking PoC 영상의 음성은 특정 검수 문장이다. 실서비스에서는 응답별 TTS와 MuseTalk 결과를
  같은 응답 ID로 묶는 생성 API가 필요하며, 그 전까지 상담 음성 재생은 Typebot이 담당해야 한다.
- 브라우저 실측: 390x844 및 1280x800, 영상 로딩과 네 상태 전환, 가로 넘침 0, 콘솔 오류 0.

## 함정

- 공개 조회 API에 notifyEmail/Phone 절대 미포함(개인정보).
- 리드 웹훅은 알림 실패해도 **리드 저장+200** (Typebot 재시도 폭주 방지).
- greeting이 빈 값이면 봇에 빈 말풍선 — ConsultPage가 기본 인사말을 항상 채워 보냄.
