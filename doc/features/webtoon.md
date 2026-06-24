# 웹툰 연재 기능 (향기 페르소나)

향기(필명) 페르소나에 **웹툰 회차 연재 + 컷 뷰어**. 어드민이 회차별 컷 이미지를 올리면, 사용자가 향기 채팅의 "웹툰 보기"에서 회차를 골라 좌우로 넘겨본다.

- 1차 구현: 2026-06-12
- 향기 페르소나 id = **`translator`** (WebtoonAdminPanel PERSONA_ID 상수 고정)

## 데이터 모델 (shared-api Prisma)

```prisma
model Webtoon {
  id          Int      @id @default(autoincrement())
  personaId   String   // 'translator'(향기)
  episodeNo   Int      // 화수
  title       String
  cutsJson    String?  // 컷 URL 배열 JSON
  coverUrl    String?  // 목록 썸네일(미지정 시 첫 컷 자동)
  isVisible   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([personaId])
}
```
- 서버1 배포 시 raw SQL CREATE + prisma generate(db push 금지).

## 백엔드 (shared-api `routes/aimp/webtoon.ts`, `/webtoon`)

- GET `/` — 목록(로그인). select: id/episodeNo/title/coverUrl/updatedAt
- GET `/admin` — 전체(requireAdmin)
- GET `/:id` — 상세(컷 배열 포함)
- POST `/` — 회차 생성
- POST `/:id/cut-url` — 컷 업로드용 signed-url (GCS `webtoon/{personaId}/{id}/`)
- PUT `/:id` — title/episodeNo/cuts/coverUrl/isVisible 수정
  - **cuts 저장 시 coverUrl 미지정이면 첫 컷을 자동 thumbnail로** (`if (coverUrl === undefined && clean.length) data.coverUrl = clean[0]`)
- DELETE `/:id`
- vercel.json 프록시: `/api/webtoon` + `/api/webtoon/:path*` → 서버1 `/api/aimp/webtoon`

## 프론트

- **`WebtoonViewer.tsx`** — 풀스크린 컷 뷰어
  - **컷을 한 화면에 통째로(contain)**: `max-width:100% + max-height:100%`로 가로/세로 자동 판단, 스크롤 없이 화면 안에 딱. 모바일·데스크탑 동일.
  - 좌우 넘기기: ←→ 버튼 + 키보드 + 모바일 스와이프 + 진행바
  - **Ctrl+마우스휠 확대(줌)**: 커서 위치 기준 최대 4배. 확대 중 드래그로 이동(패닝), 더블클릭으로 원래대로, 컷 넘기면 줌 리셋. 확대 중엔 좌우 넘김/스와이프 비활성(패닝 충돌 방지)+퍼센트 안내. (휠은 passive:false로 직접 등록해 preventDefault)
- **`WebtoonEpisodeList.tsx`** — 향기 채팅 진입 → 회차 목록 모달 → 선택 시 뷰어. 썸네일 = coverUrl(없으면 BookOpen 아이콘)
- **`components/admin/WebtoonAdminPanel.tsx`** — 어드민 '웹툰 관리' 탭
  - 회차 생성/제목·화수 인라인 수정/삭제/공개토글
  - 컷 여러 장 업로드, **드래그앤드롭 순서 변경**, 5열 그리드 정렬+스크롤
  - **회차 표지 직접 등록**: 표지=목록 썸네일. 미등록 시 첫 컷 자동. 표지 제거 시 첫 컷으로 되돌림(항상 썸네일 보장)
- `personaFeatures.ts`: FeatureKey 'webtoon' 등록 + 향기 NAME_FALLBACK
- `App.tsx`: showWebtoon state + FEATURE_ACTIONS.webtoon + ErrorBoundary 모달
- `apiService.ts`: webtoonApi(list/get/adminList/create/update/remove/uploadCut)

## 교훈
- 새 백엔드 라우트 추가 시 **vercel.json 프록시도 함께** (안 하면 프로덕션 404 "Not found")
- 어드민 input은 `color/background` 명시 (안 하면 글씨 안 보임)
- 밝은 컷 위 버튼은 검정 배경+흰 글씨+흰 테두리 (가시성)
- 데스크탑(가로 화면)에서 흐림 배경 채움은 오히려 산만 → contain + 깔끔한 검정 여백이 정답

## 이미지 보호 — 시도 후 전부 되돌림 (2026-06-22)
1회차 연재 후 무단복제 방지 1·2단계를 만들었다가 **사장 결정으로 전부 되돌림**(바이럴·확산 우선, "그냥 풀어놓자"). 현재 보호 기능 없음, 컷=GCS public URL 직접 노출.
- **1단계(우클릭차단·반투명 워터마크 `user#id`·저작권 경고문구)**: 두 뷰어에 추가 → revert(ai_mp `2dccc2d`). `services/watermark.ts` 삭제.
- **2단계(컷 백엔드 프록시 스트리밍)**: cuts를 GCS URL 대신 인증 프록시 경로로 바꿔 원본 직접접근 차단 시도. shared-api `171118b`→revert `16eab31`(서버1 배포).
- ★**되돌린 직접 원인 = Vercel rewrite 함정**: vercel.json은 `/api/webtoon/*`→서버1 `/api/aimp/webtoon/*`로 **`aimp` 접두사를 자동 부착**. 백엔드가 프록시 URL을 `/api/aimp/webtoon/:id/cut/:idx`(이미 aimp 붙음)로 만드니 프론트가 그대로 호출 → 매핑 없음 → **컷 전부 404**(워터마크만 뜨고 이미지는 alt텍스트 '컷 N'). → 백엔드가 프론트용 URL 만들 땐 **`/api/webtoon/...`(aimp 없는 프론트 관점 경로)** + vercel.json rewrite 추가가 정답. (위 '교훈'의 vercel.json 규칙과 같은 함정의 구체 사례.)
- 부가 사실: 버킷 `ai-mp-media`는 **uniform 접근**이라 웹툰만 비공개 불가(다른 기능 공유). GCS public URL은 무인증 200. 스크린샷은 어떤 방식도 불가.
- ⚠️ 활성 뷰어는 **`WebtoonScrollViewer.tsx`(세로 스크롤)** — WebtoonEpisodeList가 이걸 렌더(위 본문의 WebtoonViewer는 페이지형, 현재 목록 진입 경로 아님).

## 남은(선택)
- 페르소나 선택 UI(현재 향기 고정). 회차 조회수/좋아요 등 확장.
