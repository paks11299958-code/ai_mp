# AI World B2B 파트너 포털

## 목적과 경계

- `aichat.dbzone.kr`는 일반 사용자용 B2C 서비스다.
- `aiworld.dbzone.kr`는 같은 AI Companion 사업을 파트너에게 제공하는 B2B 채널이다.
- 기능 기반은 공유하지만 파트너 계정·로그인·신청 데이터는 일반 `User`와 섞지 않는다.

## 데이터

운영 DB에는 `shared-api/prisma/partner-portal-ddl.sql`을 raw SQL로 적용한다.
`prisma db push`는 사용하지 않는다.

- `PartnerAccount`: 회원아이디, 비밀번호 해시, 성명, 연락처, 이메일, 계정 상태
- `PartnerApplication`: 추천인, 신청 상태, 개인정보 동의, 담당자 메모와 처리 시각

비밀번호는 bcrypt cost 12 해시만 저장한다. 일반 회원 테이블에는 파트너 연결 컬럼을 만들지 않는다.

## API와 인증

- 공개 프록시: `aiworld.dbzone.kr/api/partner-auth/*`
- 백엔드: `/api/aimp/partner-auth/*`
- API: `register`, `login`, `me`, `logout`, `dashboard`, `referrals/:id/approve`, `partners/:id/approval-role`
- 쿠키: `partner_token`, HttpOnly, Secure, SameSite=Lax, 7일
- 토큰은 `aud=aiworld-partner`, `iss=shared-api`로 일반회원 토큰과 구분한다.
- 가입·로그인은 IP별 10분 10회로 제한한다.

## 화면 흐름

1. `파트너 신청` 버튼에서 AI World 디자인의 신청 모달을 연다.
2. 회원아이디·암호·성명·연락처·이메일·선택 추천인과 개인정보 동의를 받는다.
3. 계정과 신청서를 한 트랜잭션으로 만들고 `접수 완료`를 표시한다.
4. `로그인` 버튼에서 파트너 전용 계정으로 로그인하고 신청 상태를 확인한다.
5. `?ref=파트너아이디`로 들어오면 추천인 아이디를 자동 저장·읽기 전용 입력하고 가입 시 FK로 연결한다.
6. 승인 파트너는 대시보드에서 소개 링크와 추천 회원을 본다. `APPROVER`와 `ADMIN`은 전체 승인 대기도 보고 승인한다.
7. 파트너 `ADMIN`은 승인된 파트너를 `APPROVER`로 지정하거나 해제한다. `APPROVER`는 다른 회원의 역할을 바꿀 수 없다.

CTA 버튼 아래에는 사업 파트너 담당자 `lumia7450@gmail.com`을 `mailto:` 링크로 표시한다.

## 관리자 운영

`관리자 설정 → 회원·포인트 → B2B 파트너`에서 신청을 확인한다.

- 상태: `PENDING`(접수), `CONTACTED`(연락 완료), `APPROVED`(승인), `REJECTED`(반려)
- 성명, 연락처, 이메일, 추천인, 최근 로그인과 처리 시각을 표시한다.
- 담당자 메모는 2,000자까지 저장한다.
- 모든 목록·변경 API는 기존 ADMIN 인증을 통과해야 한다.
- 역할 계층은 `PARTNER < APPROVER < ADMIN`이다. 파트너 `ADMIN`은 승인 파트너를 `APPROVER`로 지정·해제하고, 일반 파트너는 자기 추천 목록만 본다.
- 모든 상태 변경은 `PartnerApprovalHistory`에 행위자 유형·ID와 전후 상태를 기록한다.

## 정산 뼈대

대시보드와 API는 `NOT_CONFIGURED`/`준비 중`만 표시한다. 금액·수수료·정산 계산과 지급 기능은
운영 정책 확정 전까지 구현하지 않는다.

## 운영 반영과 검증 (2026-08-28)

- shared-api `f090879`: 서버1 자동배포, PM2 online, `/api/aimp/ping` 200
- 운영 DB: `partner-portal-ddl.sql` 실행 성공
- ai_mp `cac7c6c`: Vercel `aiworld`, `ai-mp` Production Ready
- 운영 API: 존재하지 않는 파트너 로그인 401, 무인증 관리자 목록 401
- 운영 화면: 390px에서 신청 모달 실제 클릭, 입력 8개, 가로 넘침·pageerror 없음
- 담당자 이메일 후속 `78bc69b`: Vercel 두 프로젝트 Production Ready. 운영
  `aiworld.dbzone.kr` 390px·1280px 실제 렌더에서 표시·`mailto:`·무가로넘침·pageerror 0 확인

실제 개인정보 행을 만들지 않기 위해 성공 가입과 인증 관리자 상태 변경은 아직 운영 실측하지 않았다.
운영 검증 계정을 만들거나 삭제하려면 별도 승인을 받는다.

## 추천·위임 승인 운영 반영 (2026-08-31)

- shared-api `6e25282`, 전체 승인 대기 후속 `3616f2a`; 서버1 PM2 online
- ai_mp `4e7db77`, 전체 승인 대기 후속 `8cd8bab`; Vercel `aiworld`·`ai-mp` Ready
- 운영 DB에 추천 FK·승인 역할·승인자·승인 이력 추가형 SQL 적용
- `paks1012`: 신청 `APPROVED`, 계정 역할 `ADMIN`
- 최근 승인 파트너 `lumia`, `happyintel`: 계정 역할 `APPROVER`
- 운영 `?ref=paks1012`: 자동 입력값·readonly·안내 표시·390px 무가로넘침 확인
- 현재 운영 신청은 승인 3건, 승인 대기 0건이라 실제 대기 회원 승인 클릭은 아직 미검증
- 비밀번호 변경 요청은 사용자가 취소했고 완료 여부를 확인하지 않았으므로 변경 완료로 간주하지 않는다.
