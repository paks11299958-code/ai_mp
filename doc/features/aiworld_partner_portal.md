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
- API: `register`, `login`, `me`, `logout`
- 쿠키: `partner_token`, HttpOnly, Secure, SameSite=Lax, 7일
- 토큰은 `aud=aiworld-partner`, `iss=shared-api`로 일반회원 토큰과 구분한다.
- 가입·로그인은 IP별 10분 10회로 제한한다.

## 화면 흐름

1. `파트너 신청` 버튼에서 AI World 디자인의 신청 모달을 연다.
2. 회원아이디·암호·성명·연락처·이메일·선택 추천인과 개인정보 동의를 받는다.
3. 계정과 신청서를 한 트랜잭션으로 만들고 `접수 완료`를 표시한다.
4. `로그인` 버튼에서 파트너 전용 계정으로 로그인하고 신청 상태를 확인한다.

## 관리자 운영

`관리자 설정 → 회원·포인트 → B2B 파트너`에서 신청을 확인한다.

- 상태: `PENDING`(접수), `CONTACTED`(연락 완료), `APPROVED`(승인), `REJECTED`(반려)
- 성명, 연락처, 이메일, 추천인, 최근 로그인과 처리 시각을 표시한다.
- 담당자 메모는 2,000자까지 저장한다.
- 모든 목록·변경 API는 기존 ADMIN 인증을 통과해야 한다.

## 배포·검증 순서

1. shared-api 변경을 커밋·푸시한다.
2. 서버1 자동배포가 해당 커밋을 반영했는지 로그와 PM2 상태로 확인한다.
3. 승인된 `partner-portal-ddl.sql`을 운영 DB에 적용하고 테이블·인덱스를 확인한다.
4. ai_mp를 푸시해 Vercel `aiworld` 배포가 Ready인지 확인한다.
5. 운영 화면에서 신청→로그인→관리자 목록→상태 변경을 검증한다.

운영 검증 계정 삭제는 별도 승인을 받는다.
