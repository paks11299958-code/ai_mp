# AI 모임방 — 사회자 페르소나 단체 채팅 (설계 뼈대)

> 작성: 2026-07-04 (Fable 설계, 구현=Opus 위임용)
> 상태: **설계 확정, 미구현**

## 컨셉 (사장 확정)

사용자가 **사회자 페르소나**와 채팅을 열면 그 방이 "AI 모임방"이 된다.
사회자AI가 진행(발언권 배분·소개·요약)을 맡고, 사용자는 방에 **직원 AI(지우·지훈·아린)를 초대**해
함께 대화한다. `/지훈 …` 처럼 명령하면 해당 AI가 단독으로 답한다(지훈=그라운딩 서치).

핵심 원칙: **새 채팅 시스템을 만들지 않는다.** 기존 1:1 채팅(ChatSession/Message/chat-stream/
메시지당 차감/XP)을 그대로 쓰고, 사회자 페르소나일 때만 오케스트레이션 분기를 태운다.
사람(전화번호) 초대는 이번 범위 아님(v3).

## 역할 매핑 (정본 — 틀리기 쉬움)

| AI | persona id (DB) | 전문 | 특수동작 |
|----|----------------|------|---------|
| 지우 | `coder` | 개발 | - |
| 강지훈 | `writer` | 서치/리서치 | `/지훈` 시 **Gemini grounding(googleSearch) ON** |
| 이아린 | `cmon1gg3z000104k2p802tp44` | 마케팅 | - |

서버 상수 `AI_EMPLOYEES = [{id:'coder',name:'지우',emoji:'👩‍💻'},{id:'writer',name:'강지훈',emoji:'🔍'},{id:'cmon1gg3z000104k2p802tp44',name:'이아린',emoji:'💄'}]`
— 초대 목록·이름→id 매핑·발언자 표시 전부 이 화이트리스트만 사용(임의 페르소나 초대 금지).

## 구현 단계 (단계별 커밋, 각각 독립 검증)

### 1단계 — 사회자 페르소나 + 초대

1. **사회자 페르소나 생성**(서버1 DB, 어드민 '✨AI로 채우기' 사용 or raw SQL INSERT):
   이름 예 "하나(모임장)" — 사장이 이름 확정. systemInstruction 요지:
   "너는 AI 모임방의 사회자. 참석자를 소개하고, 질문 주제에 맞는 직원에게 발언권을 넘기고,
   대화를 요약·정리한다. 직원이 없으면 초대를 권한다."
2. **세션 확장** — ★raw SQL만 (`prisma db push` 절대 금지):
   ```sql
   ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "invitedAisJson" TEXT;
   ```
   schema.prisma의 ChatSession 모델에도 `invitedAisJson String?` 추가 + 서버1 `prisma generate`.
3. **초대 API** (shared-api `routes/aimp/sessions.ts`에 추가 — 신규 파일 만들지 말 것,
   기존 세션 라우트에 2개만):
   - `GET /sessions/:id/ai-members` → { invited: [...], available: AI_EMPLOYEES }
   - `POST /sessions/:id/ai-members` { personaId } → 화이트리스트 검증 → invitedAisJson 갱신
     → **시스템 메시지 insert**(role='model', text=`[사회자] 강지훈님이 입장했어요 🔍`) → 갱신 목록 반환
   - `DELETE /sessions/:id/ai-members/:personaId` → 퇴장(+퇴장 메시지)
   - 인증: 세션 소유자(userId)만. 기존 sessions.ts 패턴 그대로.
   - ★기존 `/api/sessions/:path*` vercel 프록시가 이미 커버하는지 확인 — 안 하면 vercel.json 추가.
4. **프론트 초대 UI**: 사회자 페르소나 채팅일 때만 헤더에 `🤖 AI 초대` 버튼 →
   모달(직원 카드: 이모지+이름+전문, 초대됨 체크표시) → 토글. 모바일 390 우선.
   사회자 여부 판정 = persona.id === MODERATOR_PERSONA_ID(프론트 상수).

### 2단계 — 1콜 롤플레이 오케스트레이션 (핵심)

**설계 결정: 기본 대화는 Gemini 1콜.** 직원 수만큼 호출하면 메시지당 원가 N배 —
1콜 롤플레이는 원가가 기존 1:1과 동일하고 체감은 단체방.

`routes/aimp/chat-stream.ts`에 분기 (사회자 페르소나 && invitedAisJson 있음):

1. 시스템 프롬프트 조립(순수함수로 분리 — 테스트):
   - 사회자 systemInstruction
   - 초대된 각 직원의 DB systemInstruction **앞 800자 요약**(전문·말투 유지, 토큰 절약)
   - 출력 형식 규칙: "발언은 반드시 `[이름] 내용` 줄로. 이번 턴에 말할 인물만
     (사회자 포함 최대 3발언). 매 턴 전원 발언 금지. 사용자가 특정인을 불렀으면 그 사람 위주."
2. 기존 대화 이력 그대로(기존 chat-stream 로직 재사용).
3. 응답 파싱: `[이름]` 프리픽스로 발언 분리 → **Message는 발언 1개당 1행**으로 저장
   (role='model', text=`[지우] …` 그대로 저장 = 스키마 변경 0).
   파싱 실패(프리픽스 없음) → 전체를 `[사회자]` 발언으로 폴백.
4. 차감: 기존 메시지당 차감(deductPointsForMessage) 그대로 = 변경 없음.
   ★chat-stream 실패 시 refundLastChatDeduction 이미 있음(2026-07-04) — 그대로 동작.

**프론트 표시**: assistant 메시지 text가 `[이름] `으로 시작하면 라벨 제거 후
발언자 이름+아바타(AI_EMPLOYEES 매칭, 사회자는 페르소나 아바타)로 말풍선 구분.
매칭 안 되는 이름은 사회자로 폴백. 스트리밍은 v1에선 통짜 수신 후 분리해도 충분
(사회자 방만 non-stream이어도 UX 무리 없음 — 구현 간단한 쪽 선택).

### 3단계 — `/이름` 단독 호출 + 지훈 그라운딩

1. 사용자 메시지가 `/지우 |/지훈 |/아린 `(또는 `@이름`)으로 시작 → 롤플레이 대신
   **해당 페르소나 단독 Gemini 호출**: 그 직원의 전체 systemInstruction + 대화 이력.
   - 지훈: `tools: [{googleSearch: {}}]` (기존 chat-stream useGrounding 경로 재사용).
   - 응답 저장도 `[강지훈] …` 형식 통일.
2. 초대 안 된 직원을 부르면: 사회자가 "아직 초대 안 됐어요, 초대할까요?" 안내(롤플레이로 처리).
3. (선택) 명령 호출 과금을 일반 메시지와 달리할지 — v1은 동일 차감으로 단순하게,
   사장이 원하면 MenuLimit 별도 키.

## ⚠️ 함정 체크리스트 (과거 실수 재발 방지)

- **DB**: 신규 컬럼/테이블은 raw SQL만. `prisma db push --accept-data-loss` 절대 금지.
- **배포**: shared-api는 push≠배포 — 서버1 git pull + prisma generate + pm2 reload 수동.
  ai_mp는 master push=Vercel 자동(웹훅 누락 시 빈 커밋 재푸시).
- **신규 기능 3계통 등록은 불필요** — 이건 '페르소나'라서 DB에 만들면 메인 페르소나
  목록에 자동 노출(기능 카드 아님). 대신 카테고리 지정할 것.
- **폰트/모달**: 모달은 화면 블록마다 렌더, `activePersona?.id` 렌더조건 금지.
- 검증: tsc + 프론트 빌드 + Playwright 390폭 캡처 + 실채팅 e2e
  (초대→롤플레이 2인 발언 분리 표시→/지훈 그라운딩 답변까지).

## v3 아이디어 (이번 범위 아님, 기록만)

- 사람 초대(전화번호/아이디, User.phone unique 존재·lib/sms.ts SOLAPI 있음) → 진짜 멀티유저 방
  (그때 ChatRoom/Member/Message 테이블+폴링. 미가입 번호는 추천인 링크 SMS = 레퍼럴 시너지).
- 직원 자율 발언(사회자가 알아서 직원 소환 빈도 조절), 방별 주제 고정, 대화 하이라이트 저장.
