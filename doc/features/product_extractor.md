# 제품추출 파이프라인 (왕주식 전용)

> 작성일: 2026-05-18 / 최종수정: 2026-05-18  
> 담당 페르소나: 왕주식  
> 스크립트: `ai_mp/product-extractor/extractor.js`  
> API 엔드포인트: `POST /api/product-extract/run`

---

## 개요

카테고리를 선택하면 해당 카테고리의 핫키워드로 도매매를 검색하여 상위 상품 정보를 쿠팡윙 업로드용 엑셀로 만들어 이메일로 발송합니다.

```
DB(NaverShoppingCategory) → 핫키워드 조회 (상위 5개 키워드)
  → 도매매(domemedb.domeggook.com) 키워드별 검색 → 1위 상품 선택
  → 도매꾹(domeggook.com/{item_no}) 가격 + 대표이미지 + 상세이미지 수집
  → Claude haiku — 소비자 친화 제목 생성
  → 카테고리별 쿠팡윙 시트 선택 (패션잡화/식품/가전/기본)
  → 쿠팡윙 xlsx 엑셀 생성 (이미지 URL 포함)
  → Brevo 이메일 — 썸네일+링크 포함 HTML 테이블 + xlsx 첨부 발송
```

---

## 실행 방법

```bash
# 직접 실행
node /home/paks11299958/ai_mp/product-extractor/extractor.js <categoryCode> <email>

# API (프론트에서 호출)
POST /api/product-extract/run
{ "categoryCode": "50000167", "email": "user@example.com" }
```

---

## 핵심 기술 사항

### 도매매 검색
- URL: `https://domemedb.domeggook.com/index/`
- 검색 form: `#search_list` (method=GET, input[name="sw"])
- **세션 공유**: `domeggook.com` 로그인 세션이 `domemedb.domeggook.com`에 자동 공유됨 (same parent domain 쿠키)
- 결과 컨테이너: `.sub_cont_bane1` — `innerText`에서 `상품번호 {N}` 파싱 → 다음 줄 = 상품명
- 이미지: 컨테이너 내 `img[src*="_img_330"], img[src*="_stt_330"]`
- **가격 숨김**: 개인정회원 계정은 도매매에서 가격 "사업자전용"으로 표시됨 → 도매꾹 상품 페이지에서 직접 조회

### 도매꾹 가격 + 이미지 조회 (`getPriceAndImages`)
- URL: `https://domeggook.com/{item_no}`
- 가격 selector: `.lItemPrice` / 예비: `#lBaseAmtVal`
- 대표이미지: `#divMainImage img, .goods_img img, .mainImg img`
- 상세이미지: `#divDetailImage img, .detail_img img, .itemDetailImage img, .goods_description img` (최대 9개)
- 대표이미지 없으면 도매매 목록 썸네일(`_img_330`, `_stt_330`) 사용

### 계정 정보
- ID: `c2clo` (개인정회원)
- `shared-api/.env` → `DOMEGGOOK_ID`, `DOMEGGOOK_PASSWORD`

### 엑셀 템플릿
- 파일: `doc/coupang_sellertool_upload_example_V4.6.xlsm`
- 시트 구성:
  | 시트명 | 용도 |
  |--------|------|
  | 기본 | 공통 (A~DM, 117컬럼) |
  | 1. 패션잡화 | 패션 전용 (A~DU, 125컬럼 — 계절/증정품 등 추가) |
  | 2. 식품 | 식품 전용 (A~DM) |
  | 3. 가전 | 가전 전용 (A~DM) |
  | hidden | 드롭다운 선택지 데이터 (사이즈/색상/패턴/소재 등) |
- **카테고리별 자동 시트 선택**: 카테고리명 키워드 매칭으로 결정 (`getSheetName()`)
- 데이터 시작 행: 5행 (1~4행은 헤더/설명)
- 주요 컬럼:
  | 컬럼 | 내용 |
  |------|------|
  | A | 카테고리명 |
  | B | 등록상품명 (AI 생성 제목) |
  | E | 상품상태 (`새 상품`) |
  | I | 검색어 (키워드) |
  | BJ | 판매가격 (도매가 × 2.5, 10원 단위 올림) |
  | BL | 할인율기준가 (판매가 × 1.2) |
  | BM | 재고수량 (99999) |
  | BN | 출고리드타임 (2일) |
  | **CZ** | **대표(옵션)이미지 URL** ← 올바른 컬럼 |
  | DA | 대표이미지(직사각형) URL (동일 이미지) |
  | DB | 추가이미지 URL (상세이미지 1번째) |

### 마크업
```js
const MARKUP = 2.5;
const sellPrice = Math.ceil(wholesalePrice * MARKUP / 10) * 10; // 10원 단위 올림
```

### AI 제목 생성
- 모델: `claude-haiku-4-5-20251001`
- 40~60자 소비자 친화 한국어 제목
- 브랜드명·상품코드 제거, 생활 표현 사용

---

## 이메일 결과 미리보기

발송되는 이메일 HTML 테이블에 포함되는 정보:
- **썸네일 이미지** (80×80) — 클릭 시 도매꾹 상품 페이지로 이동
- **키워드** + **AI 생성 제목** + **원본 상품명**
- **도매가** / **판매가(×2.5)**

→ 이메일에서 이미지 보면서 바로 제품 확인 가능, 의심스러운 제품은 링크 클릭해서 원본 확인

## 프론트엔드

- **버튼 위치**: 왕주식 페르소나 메뉴 바 (초록색 버튼)
- **컴포넌트**: `frontend/components/ProductExtractDialog.tsx`
- **플로우**: 카테고리 1개 선택 → 이메일 확인/수정 → 추출 시작 → 백그라운드 실행 안내

---

## 남은 과제

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| 사업자 계정 전환 | 중 | 도매매에서 가격 직접 확인 가능해짐 (현재 개인정회원) |
| 키워드별 1개 → 여러 개 선택 옵션 | 하 | 현재 상위 1개만 수집 |
| 실시간 진행상황 알림 | 하 | SSE 또는 polling으로 완료 알림 |
| 쿠팡 파트너스 API 연동 | 하 | 가입 후 카탈로그 검색 가능 (현재 미가입) |
