# 렌탈핏 — 맞춤 찾기·상담 도구 (rental.dbzone.kr)

> 2026-10-16 기준. ★이 저장소는 공개 저장소다 — 수수료 값·정책 엑셀·DB 접속 정보는 여기에 두지 않는다.

## 무엇
- `rental.dbzone.kr` = 렌탈핏 홍보 사이트(`sites/rentalfit-v2/`). 메인 입구는 **우리 집 맞춤 찾기**(맞춤 찾기 모달)와 **AI 문의하기**(통합 핏이 채팅) 2개다. 짧은 주소 `/find`는 맞춤 찾기로 연결한다.
- 맞춤 찾기: 상품군 장면 카드 23종 → 실제 있는 선택지만 묻는 질문(예산·관리·기간) → 추천 카드 3장. 상품군 카드는 D안: 이름·인기·가격대 배지를 **사진 아래 반투명 칸**에 배치한다.
- AI 문의하기: 고정 인사·자기소개 → 상품 메뉴 → 채팅 속 추천 3개 → 카드 선택 → AI 설명·질문. 추천 카드의 **AI 상담**도 같은 채팅으로 들어가며 제품 설명부터 시작한다.
- 제품 선택 전 질문은 **일반 모드**: 실제 상품군 이름·최저 가격대만 안내하고 특정 제품을 추천하지 않는다. 제품 설명은 서버가 재조회한 공개 제품 자료만 사용한다.
- **상담요청**은 이름·연락처를 받아 기존 문자 신청으로 연결한다. `tel:` 링크는 **전화 걸기**, 카톡은 복사 안내 후 오픈채팅(`https://open.kakao.com/o/sxgrCmSi`), 이메일도 제공한다.
- 채팅 ✕·Esc·뒤로는 설명 → 목록 → 메뉴 → 닫기 순서로 한 단계씩 돌아간다. DOM을 다시 그린 뒤에는 초점을 채팅 안으로 옮긴다.
- 관리자: 상단 **로그인** → `/sites/rentalfit-v2/admin/`(렌탈핏 전용 계정). 기존 `/pro`는 aichat 관리자 로그인으로 사용하는 별도 상담 도구다.

## 지키는 것 (사장 지시)
- **수수료는 일반 사용자에게 절대 비공개.** 손님용 조회는 DB 역할 `rental_public`(로그인 불가)으로 내려가 수수료 표를 DB 가 거부한다. 손님용 뷰에도 수수료 칸이 없다.
- **가격은 "월 N만 원대부터" / "월 1만 원 미만부터"로만** 보인다(2026-10-15 사장 확정). 정확한 월 금액은 공개하지 않는다.
- 화면(`finder.js`)은 서버가 주는 가격대 문구를 정확 일치로만 받는다 — 서버 `bandLabel` 형식을 바꾸면 `feeLabel` 도 같이 바꿀 것(10-14 '월 1만 원 미만부터' 를 거부해 추천 전체가 오류 화면이었다).

## 개인정보·사용 제한
- 처리방침 `/sites/rentalfit-v2/privacy/`, 메인 푸터 사업자 정보, 상담 동의 옆 처리방침 링크를 제공한다. 사업자는 행복컴퍼니, 보호책임자는 유진혁이다. 등록증 이미지·생년월일은 공개 저장소에 두지 않는다.
- 상담 개인정보 보관은 1년. 서버2 `rag/rental/purge_inquiries.py --apply`를 매일 KST 04:20(`20 19 * * *`) 실행하여 이름을 '(파기)', 연락처를 빈 값으로 바꾸고 제품 항목은 인기 집계용으로 유지한다. 기본 실행은 dry-run이다.
- 상담 문자 신청은 접속지(`req.ip`)당 **10분 2회**. 제한은 프로세스 메모리 방식이라 재시작 시 초기화된다.
- 핏이 AI 상담은 기기·접속지당 **하루 20회**, 전체 **하루 1,500회**, 연속 요청 간격 2초(KST 일자, 메모리 방식). **대화 내용은 저장하지 않는다.** 자료에 없는 특징·수수료·정확 금액·자리표시 예시는 답변에 넣지 않는다.
- 처리방침 위탁사 정확한 명칭·국외 이전 고지, 담당자 폰·문자 서비스 등 DB 밖 사본의 파기 절차는 사장 확인 대기다.

## 관리자 로그인·프로모션
- 회사별 전체 제품을 **엑셀형 표**로 관리한다(썸네일·제품명·종류·모델·판매·문구·기간·적용 여부). 제목 칸의 값 체크·글자 필터, 결과 개수, 모두 해제를 제공한다. 관리자 화면에서 추천·순위 표현은 사용하지 않는다.
- 프로모션은 제품별 문구·기간·적용 여부를 설정하며 **기본 미적용**이다. 활성 상태이면서 기간 안인 프로모션만 손님 카드에 배지로 표시한다.
- 손님 추천은 **조건 안 후보 중 프로모션을 우선**하고 인기·가격대·브랜드 분산을 적용한다. 추천 응답 캐시 때문에 반영 지연은 **최대 5분**이다.
- 전용 로그인은 bcrypt·HttpOnly/Secure/SameSite=Strict 쿠키(8시간), 계정·접속지별 실패 5회 시 15분 잠금. 새 비밀번호는 최소 8자이며 변경하면 모든 세션이 만료된다. 비밀번호 값은 문서·저장소에 기록하지 않는다.
- 관리 쓰기 요청은 `X-Rental-Manage: 1`과 JSON 본문이 필요하다(DELETE도 `{}` 포함).

## 구성
| 층 | 위치 | 비고 |
|---|---|---|
| 맞춤 찾기 화면 | `sites/rentalfit-v2/finder/finder.js`·`finder.css`, `find/index.html` | Pretendard, 상품군 D안, 제품 사진 없으면 상품군 아이콘 |
| 통합 핏이 채팅 | `sites/rentalfit-v2/finder/chat.js`·`chat.css` | 메인 AI 문의·카드 AI 상담의 공통 화면, 일반 모드·제품 설명·상담요청 |
| 관리자 화면 | `sites/rentalfit-v2/admin/` | 전용 로그인·프로모션 표·필터, noindex |
| 개인정보·사업자 정보 | `sites/rentalfit-v2/privacy/index.html`, 메인 푸터·상담 동의 | 1년 보관, 위탁사 등 확인 대기 |
| 홈 화면 아이콘 | `sites/rentalfit-v2/manifest.webmanifest`, `assets/icons/` | 민트 로봇 6종, 메인·find·privacy 연결. 루트 `/manifest.json`은 AI 놀이터용 |
| 상품군 장면 | `sites/rentalfit-v2/assets/scenes/*.webp`(23장) | `rental_category_rule.scene_file` → options API `sceneUrl`; 얼음정수기는 `ice-water-v2.webp` |
| 보안 헤더·프록시 | 루트 `vercel.json` | 사이트 보안 헤더, API는 `https://origin.dbzone.kr`로 전달 |
| 제품 사진 | `sites/rentalfit-v2/assets/products/*.webp` | 긴 변 480px. 새 사진은 새 파일명(캐시 때문에 덮어쓰기 금지) |
| 손님 API | shared-api `routes/aimp/rental-public.ts` → `/api/rental/options·questions·recommend`, `POST /api/rental/inquiry` | 조건 안 프로모션 우선·인기순·가격대·브랜드 분산, 문자 10분 2회 |
| AI 상담 API | shared-api `routes/aimp/rental-chat.ts` → `POST /api/rental/chat` | Gemini 2.5 Flash, 공개 자료 재조회·일반 모드·출력 필터·일일 제한·대화 미저장 |
| 전용 관리 API | shared-api `routes/aimp/rental-manage.ts` → `/api/rental/manage/*` | 로그인·세션·로그아웃·비밀번호·회사·제품·프로모션 CRUD |
| 기존 관리자 API | shared-api `routes/aimp/rental.ts` → `/api/admin/rental/*` | aichat ADMIN 미들웨어 뒤, `/pro`용 |
| 개인정보 파기 | rag `rental/purge_inquiries.py`, 서버2 크론 | KST 04:20, 1년 경과 개인정보 익명화 |
| 데이터 | 서버1 PostgreSQL `rentaldb`, rag `rental/` | 적재·규칙·관리 테이블 SQL |

## 데이터 (rentaldb) — 요약
- `rental_policy`(매달 조건 줄) · `rental_policy_internal`(수수료, 손님 접근 불가) · `rental_product`(제품 원장: 이름·사진·인기) · `rental_product_image`(상품별 사진 짝)
- 관리: `rental_admin`·`rental_admin_attempt`·`rental_admin_session`·`rental_promotion`, 손님용 `rental_public_promotion`은 활성·기간 안 제품 ID와 문구만 공개한다.
- 업로드 기준도 DB: `rental_sheet_rule`(시트별 양식·칸·모델 키·제목 규칙) · `rental_category_rule`(상품군 판정·손님 메뉴 보이기) · `rental_brand`(사이트·사진 수집 방식)
- 손님 뷰 `rental_public_policy`는 기존 18칸(끝 `popularity`)에 프로모션 연결용 `product_id`를 추가. 사진 = 상품 직접 짝 우선 → 원장, 이름 = 그 달 엑셀(원장 이름은 잠근 경우만)

## 매달 할 일
rag 저장소 `rental/` 의 절차를 따른다(`load_db.py --dry-run` → 적재 → 새 제품만 사진 수집 → 사이트에 사진 올리고 **운영 확인 뒤** DB 사진 연결). 상세는 rag `rental/README_rules_popularity.md`·`RECEIPT_*.md`.

## 점검 (2026-10-15, `/site-audit`)
- 17항목 18건 → 즉시 수정 7(보안 헤더·`/find`·og 미리보기·포커스·44px·빈 결과 안내·문자 후 저장 실패 시 중복 문자 방지). 상담 화면 ✕ 가 한 단계 위로 가는 것은 사장 규칙대로(결함 아님).
- `finder.js` 는 한 줄 압축 코드 — 주석은 `/* */` 만, 수정 후 `node --check`.

## 남은 일
- 사장 확인 대기: 관리자 초기 비밀번호 변경(8자 이상), 처리방침 위탁사·국외 이전·DB 밖 사본 파기 절차, 실제 폰 홈 화면 아이콘 확인. 3020 포트 차단은 보류(`~/TODO.md`). 메인 84개월 칸은 유지 결정.
- 사진 없는 제품 약 194개(아이콘 표시)
