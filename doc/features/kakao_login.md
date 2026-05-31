# 카카오 로그인

> 추가일: 2026-05-30
> 진입점: 로그인 모달 하단 노란 **카카오 로그인** 버튼

---

## 개요

카카오 OAuth로 회원가입/로그인을 처리하는 소셜 로그인. 기존 이메일(local) 계정과 공존하며,
카카오 이메일이 기존 이메일 계정과 일치하면 자동 연결된다. URL에 JWT가 노출되지 않도록
임시코드(30초) 교환 방식을 사용한다.

---

## 구성 요소

### 프론트엔드
| 파일 | 역할 |
|------|------|
| `frontend/components/AuthModal.tsx` | 카카오 로그인 버튼 (모달 하단 노란 버튼) |
| `frontend/components/KakaoNicknameModal.tsx` | 신규 가입 시 닉네임 설정 모달 |
| `frontend/components/UserProfileModal.tsx` | 카카오 계정은 비밀번호 변경 → "카카오 앱에서 관리" 안내 |
| `frontend/types.ts` | `User.provider?: string` 추가 (계정 종류 판별) |

### 백엔드 (shared-api)
| 파일 | 역할 |
|------|------|
| `routes/aimp/auth.ts` | 카카오 인증/콜백/교환/닉네임 설정 엔드포인트 |
| `prisma/schema.prisma` | `User` 테이블 카카오 필드 |

---

## DB 스키마 (User 테이블)

```
kakaoId   TEXT UNIQUE           카카오 회원번호
provider  TEXT DEFAULT 'local'  계정 종류 ('local' | 'kakao')
password  nullable              카카오 계정은 비밀번호 없음
```

---

## API 목록 (auth.ts)

```
GET   /api/auth/kakao              카카오 인증 URL로 리다이렉트
GET   /api/auth/kakao/callback     토큰 교환 → 유저 조회/생성 → 임시코드 발급
POST  /api/auth/kakao/exchange     임시코드(30초) → 실제 JWT 교환
                                   응답에 isNewUser, kakaoNickname, provider 포함
POST  /api/auth/kakao/set-nickname 신규 가입 닉네임 확정 (중복 체크 409)
```

`/me` 응답에 `provider` 필드 포함 (프론트가 카카오/이메일 분기 판별).

---

## 인증 플로우

```
1. 사용자가 [카카오 로그인] 클릭 → GET /api/auth/kakao
2. 카카오 인증 → GET /api/auth/kakao/callback (code 수신)
3. 백엔드: 토큰 교환 → 유저 조회/생성 → 임시코드(30초) 발급 → 프론트로 리다이렉트
   (※ JWT를 URL에 직접 싣지 않음 — 임시코드만 노출)
4. 프론트: POST /api/auth/kakao/exchange (임시코드) → 실제 JWT 수신 → localStorage 저장
5. 신규 가입(isNewUser=true)이면 → KakaoNicknameModal 팝업
   (카카오 닉네임 기본값, "실명 대신 별명 권장" 안내, 수정 가능)
   → POST /api/auth/kakao/set-nickname (중복 체크)
```

**기존 이메일 계정 자동 연결**: 카카오 이메일이 기존 local 계정 이메일과 일치하면
새 계정 생성 없이 해당 계정에 kakaoId/provider만 연결.

---

## 카카오 계정 UX 분기 (provider='kakao')

- **비밀번호 찾기 화면**: "카카오 계정입니다" 노란 안내 박스 (비밀번호 없음)
- **프로필 모달**: 비밀번호 변경 섹션 대신 "카카오 앱에서 관리" 안내로 대체
- 게시판 답글 알림: 카카오 계정은 email이 null일 수 있어 `post.user.email` 존재 시에만 발송

---

## 환경변수 (서버1/서버2 .env)

```
KAKAO_REST_API_KEY    카카오 REST API 키
KAKAO_REDIRECT_URI    콜백 URL
KAKAO_CLIENT_SECRET   클라이언트 시크릿
```

---

## 주의사항

- 카카오 콜백 쿠키 `SameSite=Lax` (Strict면 리다이렉트 시 쿠키 누락)
- `grantSignupPoints(prisma, user.id)` — 신규 가입 포인트 지급 시 prisma 인자 필수
