# 렌탈핏 — 맞춤 찾기·상담 도구 (rental.dbzone.kr)

> 2026-10-15 기준. ★이 저장소는 공개 저장소다 — 수수료 값·정책 엑셀·DB 접속 정보는 여기에 두지 않는다.

## 무엇
- `rental.dbzone.kr` = 렌탈핏 홍보 사이트(`sites/rentalfit-v2/`). 손님은 「AI 문의하기」 등 버튼 3곳에서 **맞춤 찾기 모달**(`sites/rentalfit-v2/finder/`)을 연다.
- 흐름: 상품군 그림 메뉴(23종) → 그 상품군에 실제 있는 선택지만 묻는 질문(예산·관리·기간) → 추천 카드 3장 → 상담 신청(이름·연락처 → 담당자 문자) / 전화 / 이메일.
- 관리자 상담 도구: `rental.dbzone.kr/pro` (aichat 관리자 로그인, 수수료 보기 토글).

## 지키는 것 (사장 지시)
- **수수료는 일반 사용자에게 절대 비공개.** 손님용 조회는 DB 역할 `rental_public`(로그인 불가)으로 내려가 수수료 표를 DB 가 거부한다. 손님용 뷰에도 수수료 칸이 없다.
- **가격은 "월 N만 원대부터" / "월 1만 원 미만부터"로만** 보인다(2026-10-15 사장 확정). 정확한 월 금액은 공개하지 않는다.
- 화면(`finder.js`)은 서버가 주는 가격대 문구를 정확 일치로만 받는다 — 서버 `bandLabel` 형식을 바꾸면 `feeLabel` 도 같이 바꿀 것(10-14 '월 1만 원 미만부터' 를 거부해 추천 전체가 오류 화면이었다).

## 구성
| 층 | 위치 | 비고 |
|---|---|---|
| 화면 | `sites/rentalfit-v2/finder/finder.js`·`finder.css`, `find/index.html` | Pretendard, 사진 칸 흰 바탕, 사진 없으면 상품군 아이콘 |
| 제품 사진 | `sites/rentalfit-v2/assets/products/*.webp` | 긴 변 480px. 새 사진은 **새 파일명**(덮어쓰기 금지 — 캐시) |
| 손님 API | shared-api `routes/aimp/rental-public.ts` → `/api/rental/options·questions·recommend`, `POST /api/rental/inquiry` | 추천 = 조건 맞는 후보 중 **인기순**, 같으면 낮은 가격대, 브랜드 분산 |
| 관리자 API | shared-api `routes/aimp/rental.ts` → `/api/admin/rental/*` | ADMIN 미들웨어 뒤 |
| 데이터 | 서버1 PostgreSQL `rentaldb` | 적재·규칙 코드는 rag 저장소 `rental/` |

## 데이터 (rentaldb) — 요약
- `rental_policy`(매달 조건 줄) · `rental_policy_internal`(수수료, 손님 접근 불가) · `rental_product`(제품 원장: 이름·사진·인기) · `rental_product_image`(상품별 사진 짝)
- 업로드 기준도 DB: `rental_sheet_rule`(시트별 양식·칸·모델 키·제목 규칙) · `rental_category_rule`(상품군 판정·손님 메뉴 보이기) · `rental_brand`(사이트·사진 수집 방식)
- 손님 뷰 `rental_public_policy` 18칸(마지막 `popularity`). 사진 = 상품 직접 짝 우선 → 원장, 이름 = 그 달 엑셀(원장 이름은 잠근 경우만)

## 매달 할 일
rag 저장소 `rental/` 의 절차를 따른다(`load_db.py --dry-run` → 적재 → 새 제품만 사진 수집 → 사이트에 사진 올리고 **운영 확인 뒤** DB 사진 연결). 상세는 rag `rental/README_rules_popularity.md`·`RECEIPT_*.md`.

## 남은 일
- LG 가전 카드 제목의 지역코드(`.AKOR` 등) 정리 (`~/TODO.md`)
- 사진 없는 제품 약 194개(아이콘 표시)
- 카톡 상담 버튼: 오픈채팅 주소를 받으면 `finder.js` `CONTACT.kakaoUrl` 설정
