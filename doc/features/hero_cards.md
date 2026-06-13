# 메인 캐러셀 카드 어드민 관리 (HeroCard)

메인 첫 화면([LandingPageNew.tsx](../../frontend/components/LandingPageNew.tsx)) 좌우 캐러셀에 보일 카드를 **어드민이 이미지 업로드로 직접 관리**. 카드 클릭 시 지정한 페르소나(채팅)/기능(모달)으로 이동. 홍보·이벤트·큐레이션 배너 용도. 코드 수정·배포 없이 메인 진열 통제.

- 구현: 2026-06-13

## DB (shared-api)
```prisma
model HeroCard {
  id Int @id @default(autoincrement())
  imageUrl String @default("")   // GCS publicUrl
  linkType String                // 'persona' | 'feature'
  linkTarget String              // personaId 또는 featureKey
  title String?
  sortOrder Int @default(0)
  isVisible Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([isVisible, sortOrder])
}
```
서버1 raw SQL CREATE + prisma generate(db push 금지).

## 백엔드 `routes/aimp/hero-cards.ts`
- `GET /` (공개): **isVisible=true AND imageUrl<>'' 만**, sortOrder ASC. → {id,imageUrl,linkType,linkTarget,title}[]
- `GET /admin` (requireAdmin): 전체(숨김·이미지없음 포함)
- `POST /`: {linkType,linkTarget,title?} → imageUrl '' placeholder 생성, sortOrder=MAX+1
- `POST /:id/image-url`: {mimeType} → generateSignedUrl(`hero-cards/{id}/...`) → {signedUrl,publicUrl}
- `PUT /:id`: imageUrl/linkType/linkTarget/title/sortOrder/isVisible 부분수정
- `POST /reorder`: {ids:number[]} → 순서 일괄 저장
- `DELETE /:id`
- index.ts 등록 + vercel.json 프록시 2줄(`/api/hero-cards`, `:path*`)

## 프론트
- `services/apiService.ts` heroCardApi(list/adminList/create/update/remove/reorder/uploadImage). uploadImage=signed-url→PUT→imageUrl 저장(webtoon uploadCut 패턴).
- `components/admin/HeroCardAdminPanel.tsx`: 새 카드(페르소나↔기능 토글→드롭다운→title) / 카드별 이미지 업로드 / 순서 드래그(native DnD→reorder) / 공개토글 / 삭제. **기능 드롭다운 출처=`personaFeatures.ts` FEATURE_REGISTRY**(App.tsx FEATURE_ACTIONS 키와 일치해야 클릭 작동). AdminPanel '콘텐츠' 그룹 '메인 카드' 탭.
- `components/LandingPageNew.tsx`: TarotCarousel props에 heroCards. `items`=heroCards 있으면 `{type:'hero'}`만, **없으면 기존 persona+FEATURES 혼합(폴백)**. hero 카드=고정박스(CARD_W×310)+`<img objectFit:cover>`, 클릭 시 linkType 따라 onPersonaClick/onFeatureClick. 기존 PersonaTarotCard/FeatureTarotCard 렌더 보존(폴백용).
- `App.tsx`: heroCards state + `heroCardApi.list()` 로드 → **LandingPageNew 3곳 모두** heroCards 전달(로그인 전/후/메인 일관). onPersonaClick/onFeatureClick 기존 핸들러 재사용.

## 동작
- 어드민 카드 0개 또는 전부 숨김/이미지없음 → **기존 페르소나+기능 캐러셀로 자동 폴백**(메인 안 비게).
- 카드 클릭 → 페르소나면 채팅 진입, 기능이면 해당 모달.
- 즐겨찾기 칩("내 바로가기")과 **독립**(다른 영역, 영향 없음).

## 주의
- 빈 imageUrl 카드는 공개 GET에서 제외(노출 안 됨). 어드민에서 이미지 없으면 공개 토글 막음.
- featureKey는 FEATURE_REGISTRY만(운세계열 등 FEATURE_ACTIONS에 핸들러 없는 키는 무반응 — 드롭다운에 REGISTRY 키만 노출).
- 권장 이미지: 세로형 600×930(1:1.55).
- GCS 고아 이미지(카드 삭제/교체): webtoon과 동일, gcs-cleanup 대상에 hero-cards/ 포함 검토.
