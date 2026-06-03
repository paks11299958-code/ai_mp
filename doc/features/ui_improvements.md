# UI 개선 이력

## 로그인/계정 UX 대정비 (2026-06-02)
- **화면 단일상태**: `useAuth`의 showAuthPage/showMain/showHero 3 boolean → `screen`('guest'|'authPage'|'hero'|'main'|'chat') 단일상태 + `goTo()`. 화면 전환 시 플래그 누락으로 인한 빈/이중 화면 구조적 차단.
- **reload 제거**: 로그인/로그아웃/카카오 콜백의 `window.location.reload()` 6곳 제거 → 상태 전환. 로그아웃은 명시적 전체 리셋(세션/포인트/어드민/이미지/기억)으로 이전 유저 누수 차단.
- **채팅 ⋮ 메뉴**: 첫화면/페르소나목록/내정보/로그아웃 추가(나가는 길), 다크(gray-900)→크림.
- **재방문 "이어서 대화" 배너**: Hero에 최근 대화 페르소나(`recentPersonaIds`) 바로진입 배너(제안형).
- **개인화 인사 + 최근 대화 줄**: MainPageNew 선택화면에 "○○님 다시 만나 반가워요"+포인트 + 최근 페르소나 칩.
- **카카오 신규가입 즉시 로그인**: 닉네임 설정 모달 제거(카카오 닉네임 그대로, 변경은 내 정보에서).
- **내 정보 모달**: 보유 포인트 요약 카드 추가 + 전체 크림화(다크→크림, blue→퍼플 #8E6FB7) + 회원 탈퇴 버튼화. Hero 햄버거/네비에서도 내 정보 진입 추가.
- **어드민 게이트 통일**: 어드민 버튼 노출 기준 `ADMIN`으로 단일화(MANAGE 헛버튼 제거).
- ⚠️ **모바일 우선**: 모든 화면 변경은 모바일(390폭) 기준으로 확인. 메뉴는 모바일 드로어에도 반영.

## 회원 탈퇴 (2026-06-02)
- 어드민 강제 탈퇴(회원 관리 행 버튼, 식별자 타이핑 2단계 확인 + 결제P 경고) / 본인 탈퇴(내 정보 하단 버튼, 영구삭제 안내).
- 하드 삭제: User 관계 대부분 Cascade, BoardReply/PartnerReply만 트랜잭션 선삭제.

## 페르소나 기능 데이터화 (2026-06-02)
- 채팅 기능 버튼을 페르소나 이름 하드코딩 → `Persona.features`(키 배열) 기반. `frontend/personaFeatures.ts` FEATURE_REGISTRY 단일 출처. 어드민에서 체크박스로 on/off. features 없으면 이름 폴백(레거시 보존).

## 퀵메뉴 버튼 (2026-05-09)
- 글래스모피즘: `backdrop-filter: blur(8px)` + `rgba(255,255,255,0.07)`
- 앞쪽 이모지 자동 제거 (`stripEmoji` — `/^\p{Emoji}\s*/u`)
- featured 버튼 왼쪽 바이올렛 세로선 강조
- 클릭 피드백 (2026-05-11): `active:scale-95`, 골드 테두리 글로우 플래시

## 채팅 말풍선 (2026-05-09)
- AI 메시지: `leading-loose` (줄간격 확대)
- AI 아바타: `personaImageUrl` 있으면 페르소나 썸네일로 표시

## 페르소나 선택 로딩 (2026-05-09)
- Bot 스피너 → 스켈레톤 UI (카드 형태 pulse 애니메이션)

## AuthModal 탭 (2026-05-11)
- 로그인/회원가입: pill 스타일 — 활성 탭 골드 그라데이션 배경
- 회원가입 서브탭: 이메일 / 전화번호 분리

## BirthInfoModal 날짜 선택 (2026-05-11)
- 휠 피커(WheelPicker) → native `<select>` 드롭다운 교체
- 모바일에서 OS 기본 피커 활성화

## 영상 모달 전체화면 (2026-05-13)
- 인트로 / 별스타 / 키워드 트리거 영상 모두 `fixed inset-0` 전체화면
- 닫기 버튼: 하단 반투명 바 고정, `min-h-[44px]` 터치 영역

## 키워드 트리거 영상 버튼화 (2026-05-13)
- 체크박스 및 자동 키워드 감지 완전 제거
- 채팅 상단 pill 버튼 → 클릭 시 영상 전체화면

## 테마 스위처 완전 제거 (2026-05-14)
- LandingPage 테마 선택 버튼 완전 삭제 (`LandingPage.tsx` 내 버튼 + 드롭다운 + `themeOpen` state 제거)

## 공지 옆 제휴 버튼 (2026-05-14)
- 로그인 후 상단 네비게이션에 제휴 버튼 추가
- 로그인 전 미표시

## 내정보 & 페르소나 통계 모달 (2026-05-14)
- 헤더/사이드바 `내정보` 버튼 클릭 시 `UserProfileModal` 오픈
- **내정보 탭**: 이름/이메일/전화번호 표시 + 비밀번호 변경 아코디언 (현재PW → 새PW × 2)
- **페르소나 통계 탭**: 페르소나별 사용 포인트 랭킹 (채팅/퀵메뉴/별스타 분류), XP 레벨 배지, 신은비 전용 만남 일수 표시, 받은 포인트 내역 (충전/가입보너스/레벨업/관리자지급)
- 관련 파일: `frontend/components/UserProfileModal.tsx`, `frontend/services/apiService.ts` (`pointsApi.getStats`)

## html lang="ko" 설정 (2026-05-14)
- `frontend/index.html` `<html lang="en">` → `<html lang="ko">` 수정
- 효과: 브라우저 자동번역 팝업 제거, Google Translate 한→영 변환 오작동 방지

## 주식 분석 보고서 UI 리디자인 (2026-05-15)
- `frontend/components/StockAnalysisBoard.tsx` 전면 개편 (다트 사이트 스타일)
- **보고서 헤더**: 딥 네이비 그라디언트 (`#0d1b2e → #0a1628`) + 기업명 + 분석일
- **데이터 소스 카드**: DART 공시 / AI 분석 뱃지 + KRX 심볼 한 줄 표시
- **차트**: TradingView 제거 (KRX 라이선스 오류) → 네이버 금융 차트 이미지 + 링크로 대체
- **다운로드 버튼**: ghost → solid blue 강조
- **`last updated HH:MM`**: 에메랄드 펄스 점 + 타임스탬프
- **마크다운 렌더러**:
  - `|` 로 시작하는 연속 라인 → 실제 `<table>` 태그
  - `**bold**`, `*italic*`, `` `code` `` 인라인 파싱
  - `##` 섹션: 좌측 파란 테두리 4px + 배경 블록 (DART 스타일)
  - `- ` 리스트: 파란 ▸ 아이콘
- **모바일**: 목록/상세 단일 패널 전환 + 뒤로가기 버튼
- **자동완성**: 종목명 입력 시 CorpCode DB 검색 드롭다운 (300ms 디바운스)

## 퀵 pill 바 확장 (2026-05-15)
- **설아(골프) 페르소나**: pill 바 우측에 `스윙 분석` / `스윙 기록` 버튼 추가 (오렌지)
  - 스윙 분석: `swingVideoRef.current?.click()` — 파일 업로드 직접 트리거
  - 스윙 기록: `setShowSwingBoard(true)` — SwingAnalysisBoard 오픈
  - 분석 중 / 타이핑 중 비활성화 처리
- **서아 페르소나**: 주식 분석 버튼 우측 정렬 유지 (green)
- pill 바 노출 조건: 트리거 영상 있거나 `서아` 이거나 `isGolfPersona`일 때

## 스윙 분석 보드 UI 리디자인 (2026-05-15)
- `frontend/components/SwingAnalysisBoard.tsx` 신규 생성 (주식 분석 보드 동일 스타일)
- **레이아웃**: 좌/우 2패널 (`max-w-5xl`, 다크 네이비 `#060b14 → #080d18`)
- **좌측 패널**: 분석 기록 목록 — 날짜 + 점수 배지(색상 코딩) + 호버 시 삭제 버튼
- **우측 패널**:
  - `ScoreRing` — SVG 원형 링 점수 표시 (green/yellow/red 색상 분기)
  - `PentagonChart` — 오각형 레이더 차트 (App.tsx에서 이동)
  - 구간별 분석 카드 (어드레스/백스윙/다운스윙/임팩트/팔로우스루): 점수 바 + 잘된 점(✓) + 개선점(△)
  - 핵심 우선순위 (amber 배경) + 추천 드릴 (blue 배경)
  - 프라이버시 안내 배지: "영상은 분석 후 즉시 삭제됩니다 🔒"
- **빈 상태**: 프라이버시 안내 + 업로드 가이드
- **모바일**: 목록/상세 단일 패널 전환 + 뒤로가기 버튼
- **App.tsx 정리**: `showSwingHistory`/`showSwingModal`/`swingHistory`/`PentagonChart` 제거 → `showSwingBoard` 단일 상태

## 골프 예약 UI 전면 개편 (2026-05-19)
- `GolfReserveDialog.tsx` 완전 재작성:
  - **시도/시군구 드롭다운 제거** → 마운트 시 전체 골프장 한 번에 로드
  - **예약 가능 골프장만 표시**: `hasAuto=true` 또는 `bookingUrl` 있는 것
  - **검색 필터**: 이름/지역 실시간 검색 (`useMemo` 필터링)
  - 자동예약 골프장 → "예약" 버튼 → 날짜/시간 선택 단계
  - 비자동 골프장 → "예약 사이트" ExternalLink 버튼 직접 연결
  - **희망 티타임 슬롯**: 시간대 선택 후 30분 단위 버튼 (`genTimeSlots()`) 표시, 클릭해제 토글
  - **오픈 시각 직접 입력**: "오픈 시각 예약" 모드에서 오픈 날짜(`<input type="date">`) + 오픈 시각(`<input type="time">`) 사용자 직접 입력. 봇 접속(= 오픈 -3분) 자동 계산 표시
  - "이미 지났습니다" 경고 완전 제거
- `golf.ts` schedule POST: `openDate`/`openTime` 수신, `kstToUtc()` 변환
- `GolfBookingSchedule.preferredTime TEXT` 컬럼 추가

## 골프 예약 완료 알림 리디자인 (2026-05-19)
- `golf/booker.js` `buildSuccessEmail()`:
  - 딥그린(`#0f2d1a`) + 골드(`#c9a84c`) 테마 HTML 이메일
  - 상단: ⛳ 아이콘 + "RESERVATION CONFIRMED" + 예약번호(`GF-XXXXXXXX` 자동 생성)
  - 본문: DATE / TIME / COURSE / FEE 티켓 카드 스타일 (border 없음, 충분한 여백)
  - 하단: 확정 시각 + 발송 안내 푸터
- `buildFailEmail()`: 다크 레드(`#2d0f0f`) 테마 실패 이메일
- SMS: 이모지 마크다운 (`✅ 골프 예약 완료\n\n📅...\n⏰...\n⛳...\n💰...`)

## 제품추출 어드민 탭 (2026-05-20)
- `AdminPanel.tsx`: `'product-extract'` 탭 신규 추가 (`ProductExtractPanel` 인라인 컴포넌트)
- **기능 설명 탭**: 파이프라인 6단계 흐름도(아이콘+라인 연결), 가격 정책 카드 3개, 현재 설정 테이블, 주의사항 (노란 경고 박스)
- **스케줄 관리 탭**: cron 시간 조회/수정(시·분 select), 활성화 toggle, "지금 바로 실행" 버튼 + 이메일 입력

## NavBar + Hero 로고 필기체 리디자인 (2026-05-27)
- `LandingPageNew.tsx` Google Fonts: `Dancing Script:wght@700` 추가
- **NavBar 로고**: `AI PERSONA` (Cinzel, 11px, 골드, 자간 0.25em) 위 + `Chat` (Dancing Script, 18px, 700, ink색) 아래 — 수직 2줄 center-align
- **Hero ✦ 타이틀**: 반으로 축소 (33px→16px급) + flex row 분리
  - `✦ AI Persona`: Cinzel 16px / `Chat`: Dancing Script 22px 700 / `✦`: Cinzel 16px
  - `justifyContent: 'center'` 필수 (없으면 좌측 쏠림)
- 폰트 임포트 규칙: 크림/타로 디자인 — Cormorant+Cinzel+Dancing Script 3종 세트

## 채팅 좌측 패널 배경 제거 (2026-05-27)
- `App.tsx` 채팅 페이지 `w-1/3` 패널: `bg-white/30` → `bg-transparent`
- 크림 페이지 배경(`#FBF8F3`)이 그대로 비침

## 햄버거 메뉴 로그아웃 버튼 추가 (2026-05-27)
- `LandingPageNew.tsx` Props에 `onLogout?: () => void` 추가
- 모바일 드로어 맨 아래 로그아웃 버튼 (로그인 상태 시만 노출)
  - `border-top: 1px solid ${T.lineSoft}`, 텍스트 색상 `#C0505A`
  - 클릭 시 드로어 닫기 + `onLogout()` 호출
- `App.tsx` 로그인 후 LandingPageNew에 `onLogout={handleLogout}` prop 전달

## 채팅 헤더 기능 썸네일 뱃지 (2026-05-27)
- Hero 기능카드 클릭 → 채팅 진입 시 상단에 해당 기능 썸네일 표시
- `App.tsx`: `mainFocusFeatureKey` state + `FEATURES_GRID` (MainPageNew에서 export)
- 채팅 헤더 Lv 배지 왼쪽에 pill 뱃지: 기능 아이콘 SVG + 기능명
  - `palette.bg` 그라디언트 + `palette.accent` 테두리 + 그림자
  - `mainFocusFeatureKey`가 null이면 숨김 (직접 페르소나 클릭 시 미표시)

## 채팅 배경 크림 오버레이 (2026-05-27)
- `App.tsx` `chatBgSelected` + `USE_NEW_UI` 시: 어두운 오버레이 → 크림 오버레이(`rgba(251,248,243,0.55)`)
- 배경 이미지가 밝게 비쳐 크림 테마와 자연스럽게 어울림

## 기능 카드 PersonaImageViewer 통합 (2026-05-27)
- `PersonaImageViewer.tsx`: `featureCards` prop 추가 → 이미지 썸네일 오른쪽에 아이콘+이름 카드 표시
- `App.tsx`: 페르소나별 기능카드 구성 (서아:오늘뉴스 / 윤채원:주식분석+핫키워드 / 이아린:중고판매+핫키워드 / 신은비:명품검증 / 지우:AI쌤+모임)
- `newUi` 모드에서 이미지 영역 배경 `bg-transparent` (크림 노출)
- 트리거 키워드 바: 트리거 영상 or 골프 페르소나일 때만 표시로 단순화

## 기능 둘러보기 검색창 + 카테고리 탭 위치 개선 (2026-05-27)
- `MainPageNew.tsx`: `featureSearchQuery` state → 기능 탭에도 검색창 추가 (이름/설명/태그 필터)
- 검색 결과 없을 때 "검색 결과가 없습니다" 메시지 표시
- 카테고리 탭: 검색창과 같은 줄 → **검색창 아래 별도 행**으로 분리 (모바일 가시성 개선)
- 탭 전환 시 placeholder 자동 변경

## 스윙 분석 입력 모달 + 크림 테마 보드 (2026-05-28)
- `SwingInputModal.tsx` 신규: 분석 제목(선택), 성별 토글(남성/여성), 실력 레벨(초급/중급/고급/프로), 드래그앤드롭 파일 업로드 (mp4/mov/jpg/png/gif/webp)
- `SwingAnalysisBoard.tsx` 전면 크림 테마 리디자인: `#FBF8F3` 배경, `#8E6FB7` 퍼플 포인트
  - PentagonChart: 퍼플 fill/stroke, ScoreRing: 녹색(≥80)/앰버(≥60)/빨강(<60)
  - 목록: `record.title || 'Untitled'` + 날짜 subtext 항상 표시
  - 상세: 레이더차트 + 점수뱃지 + AI총평 + 구간별 분석(데스크탑 4열/모바일 아코디언)
- `apiService.ts` analyze(): title/gender/skillLevel 파라미터 추가
- Cloud Function 경로: CF 결과 반환 후 PATCH로 title/gender/skillLevel 저장
- `api/router.ts`: PATCH `/api/swing-analysis/:id` 추가 (title/gender/skillLevel 업데이트)
- `prisma/schema.prisma`: UserSwingAnalysis에 title/gender/skillLevel(@map "skill_level") 컬럼 추가
- 트리거 바: 골프 페르소나 텍스트 버튼 제거 (featureCards로 대체)
- `featureCards`: 설아 페르소나 → Activity(스윙 분석)/Clock(스윙 기록) 카드

## 페르소나 이미지 GCS 마이그레이션 (2026-05-28)
- `scripts/migrate-images-to-gcs.js` 신규: 10개 페르소나 base64 imageUrl → GCS URL
- `https://storage.googleapis.com/ai-mp-media/personas/{id}/profile.{ext}` 형식
- API 응답 크기 ~28MB(base64 10개) → URL만 반환 → 초기 로딩 속도 대폭 개선
- GCS uniform bucket-level access: `public: true` 옵션 제거, ACL 없이 저장

## LandingPageNew 햄버거 메뉴 항목 추가 (2026-05-28)
- 어드민(ADMIN role만), 페르소나 목록, 기능 둘러보기 메뉴 추가
- Props: `onAdminClick?`, `onPersonaListClick?`, `onFeatureListClick?`
- 히어로 섹션 paddingTop: 120 → 70px (페르소나 카드 가시성 확보)

## TarotCarousel 실시간 드래그 구현 (2026-05-28)
- `dragDx` state: 드래그 중 픽셀 오프셋 실시간 반영 → 카드가 손가락 따라 즉시 이동
- `dragging` state: 드래그 중 transition 비활성화 (ref→state, 재렌더 트리거)
- `onTouchMove` 핸들러 추가 (모바일 스와이프)
- `hasDragged` ref: 드래그 후 클릭 이벤트 차단
- `willChange: transform` GPU 가속

## MainPageNew 모바일 햄버거 메뉴 (2026-05-28)
- `.mpn-hamburger` 버튼: 700px 이하에서만 표시, 우측 상단 고정
- `.mpn-rail` 사이드바: 700px 이하 `display:none`
- 우측 슬라이드 드로어: 어드민/페르소나 목록/기능 둘러보기/공지/로그아웃 메뉴

## MainPageNew 사이드바 개선 (2026-05-28)
- 친구 텍스트 → H 버튼 (Cinzel 28px 골드, onClick=onGoHome)
- ✦ AI PERSONAS: fontSize 10→15, fontWeight 700, 클릭 시 personas 탭으로 이동

## 탭 비활성 색상 추가 (2026-05-28) — LandingPageNew + MainPageNew 양쪽
- 캐릭터 둘러보기 비활성: 연보라 그라디언트(`rgba(142,111,183,0.18)~rgba(228,139,176,0.18)`) + 보라 텍스트
- 기능 둘러보기 비활성: 연두 그라디언트(`rgba(76,175,130,0.18)~rgba(124,197,106,0.18)`) + `#3a9e6e` 텍스트
- 기능 둘러보기 활성: 연두 그라디언트(`#4CAF82~#7CC56A`) + 흰색 텍스트

## 모바일 카테고리 탭 줄바꿈 (2026-05-29)
- `MainPageNew.tsx` 카테고리 탭: `overflowX: auto` 가로 스크롤 → `flexWrap: wrap` 줄바꿈
- 카테고리가 많아도 스크롤바 없이 아래로 펼쳐져 전부 보임

## 페르소나 이미지 드래그 방지 (2026-05-29)
- `LandingPageNew.tsx`, `MainPageNew.tsx` 모든 `<img>` 태그: `draggable={false}`, `WebkitUserDrag: 'none'`
- 모바일/PC에서 이미지를 클릭해도 브라우저 기본 드래그 동작 차단

## 로그인/로그아웃 새로고침 (2026-05-29)
- `App.tsx` `handleLogout`: 상태 개별 초기화 → `window.location.reload()` 통일
- 로그인 시(`handleAuthSuccess`)도 이미 `reload()` 적용 — 일관성 확보

## 유저 아바타 그라데이션 개선 (2026-05-29)
- `MessageBubble.tsx` 사용자 아바타: 단색 퍼플 → 골드→핑크→퍼플 3색 그라데이션 + 텍스트 그림자
- `background: 'linear-gradient(135deg, #C49A6C, #E48BB0, #8E6FB7)'`

## AI쌤 카메라 우선 + 자동 분석 (2026-05-20)
- `MathTutorBoard.tsx`: 단일 파일 클릭 → "카메라로 찍기" + "갤러리" 두 버튼으로 분리
  - 카메라: `<input capture="environment">` — 모바일에서 카메라 직접 오픈
  - 갤러리: 일반 `<input type="file">`
- 선택 즉시 자동 분석 (기존 확인 버튼 제거) — `handleFileSelect`가 압축+분석 일괄 처리
- 분석 중: 촬영된 사진 미리보기 + 핑크 스피너
- 에러 시: "다시 찍기" 버튼만 표시
