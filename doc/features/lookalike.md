# 닮은 연예인 찾기 (윤채린)

> 구현·배포 완료: 2026-06-24
> 내 사진을 올리면 AI가 닮은 연예인을 찾아주는 기능. 바이럴(자랑 공유)용.

## 컨셉
- 페르소나 **윤채린**(뷰티·이미지 컨설턴트, 헤어 진단과 동일 인물)의 기능.
- 결과는 **텍스트 분석만** — 연예인 실물 사진을 띄우지 않는다(★초상권 안전). 대신 결과 카드의 연예인별 **🔍 사진 보기** 버튼이 네이버 이미지 검색을 새 탭으로 연다(검색엔진이 사진을 표시 → 우리 서비스 부담 없음, AI가 URL을 지어낼 일도 없음).
- 결과 = 닮은 연예인 1~3명 + 각 **닮음 %** + 닮은 부위·이유 + 윤채린 톤 코멘트.

## 백엔드 (shared-api, main)
- **`lib/gemini.ts` `analyzeLookalike(imageBase64, mimeType, personaSystemInstruction)`**: 얼굴 사진 → JSON(`{ unclear, impression, matches:[{name,percent,reason}], comment }`). percent는 0~100 클램프, 흐린 사진이면 `unclear=true`+matches 빈 배열로 거부.
- **`routes/aimp/lookalike.ts` (`POST /api/lookalike`)**: face-reading 패턴 — ①사전 잔액검사(차감 전, 포인트 없으면 AI 호출 안 함) → ②AI 분석 → ③`unclear`/matches 없으면 **422 무과금 안내**(손금·관상의 선명도 환불 정책과 동일) → ④성공 시 `deductMenuPoints`로 차감. ⚠️`deductMenuPoints`가 내부에서 추천보상 `tryGrantReferral`까지 트리거하므로 라우트에서 별도 호출 안 함.
- **라우트 등록**: `routes/aimp/index.ts`에 `/lookalike` 추가. **`vercel.json` rewrite** `/api/lookalike`·`/api/lookalike/:path*` → `…/api/aimp/lookalike` 추가.
- **메뉴키 `lookalike`**: MenuLimit 미등록 시 기본 50pt(checkMenuAccess 폴백). **단가는 사장이 어드민 메뉴권한 탭에서 설정**(닮은꼴은 텍스트 1회 분석이라 실비 ~2원, 바이럴 미끼라 저가 의도).

## 프론트 (ai_mp, master)
- **`LookalikeModal.tsx`**: 사진 업로드(갤러리/카메라) → 분석. 윤채린 톤(퍼플). FaceReadingModal 패턴.
- **`LookalikeResultCard.tsx`**: 결과 카드 — impression + matches(1위 🏆·닮음 바·이유) + 코멘트. 각 연예인에 **🔍 사진 보기**(네이버 이미지 검색, `이름(분야)`은 괄호 앞 이름만으로 검색) + **📲 친구에게 자랑하기**(`buildFeatureShareLink`로 ?f=lookalike&ref 딥링크 공유=바이럴).
- **`apiService.lookalikeApi.analyze`**: 402→`insufficient-points` 이벤트(충전모달), 422→`{ok:false, message}` 정상 분기(palmReadingApi 패턴).
- **FEATURES_GRID** id18 `lookalike`(윤채린, life 카테고리, icon `face`) → '새로운 기능'에 자동 노출.
- **`personaFeatures.ts`**: 레지스트리에 `lookalike`(icon `Users`) + 윤채린 NAME_FALLBACK에 추가 → **채팅 화면 상단 기능칩**으로도 노출(onClick=FEATURE_ACTIONS).
- **App.tsx**: `showLookalikeModal`/`lookalikeResult` state, `FEATURE_ACTIONS.lookalike`, `onFeatureSelect`에서 윤채린 선활성화 후 보드. 모달·결과카드는 **메인 화면 블록 + 전역 블록 둘 다** 렌더.

## 교훈
- ⚠️★**모달 미표시 버그**: 모달은 **각 화면 return 블록마다** 렌더해야 함(메인 블록에 없으면 카드 클릭해도 안 뜸). `&& activePersona?.id`를 렌더 조건에 넣지 말 것(setState 비동기라 카드 클릭 즉시엔 falsy). personaId는 personas에서 윤채린 직접 찾는 폴백(`lookalikePersonaId`).
- ★**AI에게 사진 URL 직접 요청 금지**: 환각으로 깨진 URL·잘못된 인물 연결 + 초상권. 검색 링크로 우회가 정답.

배포: ai_mp `bafebba`(기능)+`b106a98`(모달·퀵메뉴 수정)+`750fc46`(사진보기), shared-api `b5e9923`(서버1 pm2 restart 배포).
