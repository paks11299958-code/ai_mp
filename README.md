# AI 페르소나 채팅

다중 페르소나 AI 채팅 서비스. Gemini 2.5 Flash 기반.

## 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Vercel Serverless Functions (TypeScript)
- **DB**: PostgreSQL + Prisma ORM (`prisma-client-js` + `PrismaPg` 어댑터)
- **AI**: Google Gemini 2.5 Flash (Vertex AI)
- **Auth**: JWT + bcryptjs + HttpOnly 쿠키
- **Email**: Brevo (비밀번호 재설정)

## 로컬 개발

```bash
npm install        # 패키지 설치 + prisma generate 자동 실행
npm run local      # API 서버(3002) + 프론트엔드(5173) 동시 실행
```

## 환경변수 (`.env.local`)

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=...
PROXY_HEADER=...
GOOGLE_APPLICATION_CREDENTIALS_JSON={...서비스계정JSON...}
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=noreply@...
APP_BASE_URL=http://localhost:5173
```

## 배포 (Vercel)

GitHub push → Vercel 자동 배포

Vercel 대시보드 환경변수에 위 항목 모두 추가 필요.  
`APP_BASE_URL`은 실제 배포 URL로 변경 (예: `https://ai-mp.vercel.app`).

## 프로젝트 구조

```
api/                        # Vercel Serverless Functions
  auth/
    login.ts                # 로그인
    register.ts             # 회원가입
    logout.ts               # 로그아웃
    me.ts                   # 내 정보
    forgot-password.ts      # 비밀번호 재설정 링크 발송
    reset-password.ts       # 비밀번호 변경
  personas/
    index.ts                # 페르소나 목록 조회 / 생성
    [id].ts                 # 페르소나 수정 / 삭제
  sessions/
    index.ts                # 세션 목록 / 생성
    [id]/messages.ts        # 메시지 조회 / 저장
  api-proxy.js              # Gemini Vertex AI 프록시
  lib/
    prisma.ts               # Prisma 클라이언트
    auth.ts                 # JWT 유틸
    email.ts                # Brevo 이메일 전송

frontend/                   # React SPA
  App.tsx                   # 메인 앱 (뷰 상태 관리)
  components/
    LandingPage.tsx         # 랜딩 페이지 (비로그인)
    MainPage.tsx            # 메인 페이지 (페르소나 선택)
    AuthModal.tsx           # 로그인 / 회원가입 / 비밀번호 찾기
    ResetPasswordModal.tsx  # 비밀번호 재설정 (URL 토큰)
    AdminPanel.tsx          # 관리자 페르소나 관리
    Sidebar.tsx             # 세션 목록 사이드바
    MessageBubble.tsx       # 채팅 말풍선
    Icons.tsx               # 아이콘 유틸
  services/
    apiService.ts           # API 호출 (auth / persona / session)
    geminiService.ts        # Gemini SDK 초기화
  vertex-ai-proxy-interceptor.js  # fetch 인터셉터 (Vertex AI → /api-proxy)

prisma/schema.prisma        # DB 스키마 (User, Persona, ChatSession, Message)
src/generated/prisma/       # Prisma 생성 클라이언트 (git 커밋 필수)
local-api.cjs               # 로컬 개발용 Express 서버
vercel.json                 # Vercel 빌드 / 라우팅 설정
```

## 화면 흐름

```
비로그인  →  LandingPage  →  AuthModal (로그인/회원가입)
                                  ↓
                            비밀번호 찾기 → 이메일 발송
                                  ↓ (이메일 링크 클릭)
                            ResetPasswordModal
로그인 후  →  MainPage (페르소나 선택)  →  채팅창
```

## 계정

- 관리자: `paks1012@naver.com` (role = ADMIN) — 페르소나 추가/수정/삭제 가능
- 일반 사용자: 회원가입으로 생성 (role = USER)
