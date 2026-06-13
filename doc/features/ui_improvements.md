# UI 개선 이력

## 명품/게시판/모임 크림화 + 명품 단계표시 / 퀵메뉴 정렬 / 대기페이지 Rail 제거 / 로고 홈링크 (2026-06-06)
- **모임(출첵, ClubBoard) 크림 전환**: 옛 다크 글래스(#1a1b23 배경 + text-white/N 반투명 + 핑크 accent)→크림 토큰(#FBF8F3/흰색, 구분선 #F0E9DE, 잉크 #2D2438, 보조 #9089A1). **accent 핑크→퍼플 #8E6FB7로 앱 통일**. QR 팝업(흰 카드+gray, QR 가독성)은 보존. 색만 변경, 로직 무변경.
- **명품 검증(LuxuryBoard) 크림 전환 + 단계 표시**: 다크(slate+blue)→크림 디자인 토큰(#FBF8F3/흰색, accent 퍼플 #8E6FB7, purple accent 유지). 좌측 목록 task에 주식분석과 동일한 진행 스텝퍼(대기중→분석중→완료, 현재단계 글로우) + 상태별 안내문(분석중=자동갱신/대기중=순서대기/완료=클릭안내). status·10초 폴링은 기존 그대로, 시각화만 강화.
- **건의/제휴 게시판 크림 전환**: BoardPanel/PartnerBoardPanel만 옛 다크(gray+blue+#0e1117)였음→크림 토큰으로 일괄(배경 #FBF8F3/흰색, accent 퍼플, 에러 연빨강). 색만 변경, 로직 무변경.
- **퀵메뉴 결과카드(QuickMenuResultCard) 위 정렬**: items-center+my-auto(세로 중앙)라 긴 봉인 감정서 카드가 화면 아래로 쏠려 안 보였음→items-start+pt-8/12(위 정렬, 게시판 모달과 동일), 길면 overflow-y-auto 스크롤.
- **대기페이지(MainPageNew) 좌측 세로 Rail(ChatRail) 제거**: 채팅 사이드바 제거와 동일 논리(데스크탑 전용+본문에 페르소나 그리드/카테고리/검색 중복). ChatRail 정의+렌더 삭제(-168줄). 메뉴 접근(어드민/공지/내정보/로그아웃)은 햄버거 메뉴가 이미 포함→햄버거를 display:none(모바일만)→flex(데/모 공통) 상시 노출.
- **대기페이지 '✦ AI PERSONAS' 로고 클릭→첫 화면**: 기존 페르소나 탭 전환(중복)→onGoHome(goTo hero). 웹 표준 로고=홈.

## 건의 게시판 개편 + 제휴 게시판 숨김 (2026-06-06)
- **게시판 → '건의 게시판'**: 이름 변경(채팅 ⋮메뉴 라벨 + BoardPanel 패널 제목). MessageSquare 아이콘.
- **전체화면 → 작은 중앙 모달**: BoardPanel 래퍼를 PartnerBoardPanel과 동일 구조로(`fixed inset-0 bg-black/60 flex items-start justify-center pt-16` + 내부 `max-w-2xl max-h-[80vh] rounded-2xl` 카드).
- **비밀글 일관화**: BoardPanel은 원래 비밀글 컨셉(자물쇠 🔒, `canRead = 본인 || 어드민`, "비밀글" 표시)이었는데 백엔드 board.ts 목록만 전체공개라 어긋나 있었음 → 백엔드 GET / 목록을 `!isAdmin → where.userId=me.id`로 수정(일반 회원 본인 글만, 어드민 전체). 단일 글 GET/:id는 이미 열람권한 체크 있었음. shared-api 변경이라 서버1 배포 필요.
- **제휴 게시판 숨김**: App.tsx의 `onPartnerBoardClick` prop 전달 3곳 제거 → 메뉴/랜딩/메인의 "제휴 문의" 버튼 자동 숨김(`{onPartnerBoardClick && ...}` + `.filter(item=>item.onClick)`). PartnerBoardPanel 컴포넌트·`showPartnerBoard` 상태는 보존(재노출 쉬움).

## 채팅 UX 개편: 사이드바 제거 + 최근 페르소나 칩 + 헤더 진입버튼 (2026-06-06)
- **좌측 페르소나 사이드바(Sidebar.tsx) 제거**: 사이드바는 `hidden md:flex`라 데스크탑만 표시되고, 모바일은 여는 트리거(`setIsOpen(true)`)가 없어 **죽은 기능**이었음 → 모바일에선 채팅 중 페르소나 전환 불가. 목록/검색은 대기페이지(MainPageNew, 카테고리까지)에, 어드민/공지/프로필은 채팅 ⋮메뉴에 중복이라 통째로 제거.
- **채팅 헤더 아래 '최근 페르소나' 빠른전환 칩**: `recentPersonaIds`(localStorage) 재활용, 현재 페르소나 제외·최대 8, 썸네일+이름. 클릭→`handlePersonaClick`(인트로 처리 포함). **데스크탑·모바일 공통** → 모바일에서도 채팅 중 1클릭 전환 가능.
- **헤더 왼쪽 진입버튼 2개**(데스크탑·모바일 공통): 🏠 홈(첫 화면) + 🧭 둘러보기(대기페이지, lucide Compass 퍼플). 사이드바 제거로 "점 세 개 메뉴 눌러야 보이던" 불편 해소. (처음엔 `hidden md:flex`로 데스크탑만→모바일서 안 보인다는 지적으로 공통화, 중복이던 모바일 뒤로가기 ChevronLeft는 제거=둘러보기가 동일 역할).
- 정리: isSidebarOpen/Collapsed 상태, handleReorderPersona(사이드바 전용 어드민 순서변경), 빈 AuthProvider 제거.

## 히어로 둘러보기 토글→대기페이지 이동 + 캐러셀 혼합 (2026-06-06)
- 히어로(LandingPageNew) '캐릭터/기능 둘러보기' 토글이 제자리 캐러셀 모드만 바꾸던 것 → 클릭 시 각 **대기페이지로 즉시 이동**(onPersonaListClick/onFeatureListClick).
- TarotCarousel `mode` 제거 → 페르소나+기능을 번갈아 섞은 한 캐러셀(MixedItem)로 표시.

## 모임(출첵) 보강: QR 표시 + 정보보기 탭 통합 + 수정/삭제 (2026-06-06)
- **QR 실제 표시**: qrcode.react가 그동안 미설치였음(설치 기록만 있고 실제 없었음) → 설치 + 출석부 카드에 QR 버튼→클릭 시 큰 QR 팝업(QRCodeCanvas 240px, 현장 스캔용).
- **정보 보기 상단 탭 통합**: detail view를 정보/회원/출석부/설정 가로 탭으로(OWNER만 4탭). 이전엔 회원명부·출석부가 별도 화면 전환이라 동선 길었음.
- **설정 탭 신설**: 모임 이름/지역/소개 수정(PATCH) + 모임 삭제(DELETE, 확인단계+연쇄삭제 경고). 백엔드 API는 기존에 있었고 프론트만 연결. Club 자식관계 전부 onDelete:Cascade.
- **모바일 바텀시트 높이**: 탭으로 콘텐츠 길어져 아래 몰리던 것 → 모바일 `h-[90vh]`로 키워 상단부터 보이게(모달 래퍼 4곳).

## 주식분석 진행상황 시각화 (2026-06-03)
- 종목 등록 후 진행 단계를 못 봐 답답하던 문제 → StockAnalysisBoard 각 종목 행에:
  - **단계 스텝퍼**(대기중→분석중→완료, 현재 단계까지 색칠+활성 글로우), 실패는 에러 배지
  - **상태 배지**(색+아이콘+라벨), 상태별 안내문(분석중=자동갱신·1~2분 / 완료=클릭하면 보고서 등)
  - 빈 화면 안내에 진행 흐름 + ①②③ 단계 설명
- status/폴링(useTaskList 10초)은 기존 그대로, UI 시각화만 강화. 모바일 우선 검증.

## 오늘뉴스 오전/오후 분리 (2026-06-03)
- 뉴스 하루 2회 수집(KST 00시=오전판, 13시=오후판)을 `news_YYYYMMDD_{am|pm}.json`으로 분리 보관(기존 1파일 덮어쓰기 → 오전이 가려지던 문제 해결).
- **웹**: TodayNewsBoard에 오전/오후 토글(둘 다 수집됐을 때만 노출, 모바일 우선). 슬롯별 캐시로 중복 과금 방지.
- **텔레그램**: `/news 국내뉴스 오전`(또는 오후) 형식 + 헤더에 🌅/🌇 표기.
- 하위호환: 슬롯 파일 없으면 기존 `news_YYYYMMDD.json` 폴백(토글 숨김). agent-api `_load_cache(date, slot)` + status `slots[]`.

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

## 첫화면(Hero) 개편 + 즐겨찾기 (2026-06-06)

로그인 후 첫화면(`LandingPageNew.tsx`)을 "자주 쓰는 기능·페르소나를 바로 누르는" 허브로 재구성.

**즐겨찾기 (기능 ⭐ + 페르소나 ☆)**
- 저장: `User.favoritesJson`(기능 키 배열) + `favoritePersonasJson`(페르소나 id 배열) — **2개 별도 컬럼**(키 충돌 방지). 서버1 ALTER + `prisma generate`.
- API: `GET/PUT /api/aimp/user/favorites`, `GET/PUT /api/aimp/user/favorite-personas` (`shared-api/routes/aimp/user.ts`, router.use 인증, PUT 문자열배열·최대20개 검증). vercel `/api/user/:path*` 와일드카드로 프록시 자동.
- 훅: `frontend/hooks/useFavorites.ts` 범용화(`useFavoriteList(load, save)`) → `useFavorites`(기능)·`useFavoritePersonas`(페르소나). 서버 로드 + 낙관적 토글 + 실패 롤백.
- 토글 UI: 메뉴/페르소나 카드(`MainPageNew.tsx`) 우상단 ⭐/☆ 버튼(stopPropagation). 기능은 `FAVORITABLE_KEYS`(news/stock/hotkeyword/used/luxury/mathtutor/club)만 — **골프는 페르소나 의존이라 제외**.
- ⚠️ **함정**: `App.tsx`는 화면별 분리된 return 3개(hero/main/채팅). 기능 보드 렌더(`{showTodayNews && <TodayNewsBoard/>}` 등)가 main·채팅에만 있어 **Hero 칩 클릭 시 안 떴음** → hero 분기에도 보드 렌더 추가. `FEATURE_ACTIONS`(키→setShow)는 본체로 승격해 Hero칩·채팅기능카드 공용.

**첫화면 레이아웃**
- 세로 중앙 정렬. 홍보문구(폰트 `clamp(30~50px)` 축소) 아래 '나의 AI 기능' + '나의 AI 페르소나' 카드.
- 동그라미 썸네일: 기능=컬러 아이콘(`FEATURE_EMOJI`, 46px), 페르소나=얼굴 사진(`imageUrl`, 48px) + 이름. 가운데 정렬. 최근 대화 페르소나는 맨앞 ✨강조(퍼플 링).
- 빈 상태: 안내문 + '기능/페르소나 둘러보기 →' 버튼(바로 담으러 이동).
- 탑메뉴 '채팅 시작'→'내 정보 보기'(onProfileClick), 가운데 '채팅 시작하기' 제거.
- 카드 제목 아이콘: 검정 이모지(👤⭐) 대신 lucide `Sparkles`/`Users` 퍼플(크림 톤 일관).
- ⚠️ 좌우 3등분 시도했다 "산만/제목 깨짐" 피드백으로 세로 복귀 — **큰 레이아웃 변경은 한 번에 확정 말고 피드백 받기**.
- PC/모바일(390폭) 캡처 검증, 오버플로우 0.

## 채팅 상단 기능칩 통일 + 첫화면 잔손질 + 공지 마크다운 (2026-06-07)
- **채팅 상단 기능 텍스트칩**(`PersonaImageViewer`): 도결처럼 quickMenuJson 쓰는 페르소나도 기능을 채팅 상단에 표시(다른 페르소나와 통일). 기능을 사진 썸네일 행에서 **분리해 그 아래 전체 폭 텍스트칩**(flex-wrap, 둥근 알약형). ⚠️처음 아이콘 세로카드로 했다 "사진 옆 반폭이라 답답" 피드백→텍스트칩+전체폭 재작업. `handleQuickMenuSelect`를 App 컴포넌트 레벨로 승격해 상단/하단 공용(서브메뉴/모달/포인트/생일 동작 유지). 하단 칩은 이미지 없는 페르소나 폴백.
- **첫화면(LandingPageNew)**: 카드 순서 '나의 AI 페르소나'를 '나의 AI 기능' 위로. 미션 안내 별 ☆(흰색으로 보임)→⭐(노란 채움). 빈 카드에 '담으면 +500P 🎁' 미션 유도.
- **즐겨찾기 별 누락 버그 수정**: FEATURES_GRID/캐러셀 key가 정본(personaFeatures FEATURE_BY_KEY)과 불일치(`keyword/math/attend`)해 핫키워드·수학·모임 카드에 ⭐가 안 떴음 → `hotkeyword/mathtutor/club`로 통일. 카드 클릭 실행은 personaName 기반이라 key 변경 영향 없음.
- **공지사항 마크다운**(`AnnouncementModal`): 평문→ReactMarkdown+remark-gfm(굵게/목록/제목/링크). `.announcement-md` 경량 스타일. 자동 팝업 제거(종🔔 버튼 클릭 시에만, 미읽음 배지 유지).
- **QR 출석 전화번호 자동입력**(`AttendPage`): 같은 폰 재방문 시 localStorage에서 이전 번호 자동채움 + '다른 번호로' 초기화. 자동제출 안 함(타인 단말 오용 방지).

## 분석화면 보증서 톤 통일 + 디테일 (2026-06-07 오후)
- **명품·주식·골프 분석 UI 보증서 톤**(LuxuryBoard/StockAnalysisBoard/SwingAnalysisBoard): 명조(Nanum Myeongjo) 타이틀 + 카드 구조 + 라벨 격상(한글주+영문보조 — 명품감정원 LUXE VERIFY / 주식 정밀분석 INVEST VERIFY / 정밀 스윙진단 SWING MASTER). ⚠️**골드 실험했으나 밝은 크림 배경 가독성 약함 → 앱 기본 퍼플(#8E6FB7)로 통일**. 명조·카드구조는 고급감 유지. **교훈: 밝은 배경엔 골드보다 앱 정체성색(퍼플)이 선명·일관.**
- **명품 노란색 가독성**: 밝은배경 위 노랑(yellow/amber-300·400) 안 보임 → 주황(orange-600)·진한 emerald/rose. 등급배지는 다크 점수카드용 cls와 밝은 목록용 lightCls 분리. 진단명 카드화, 면책 베이지 배경.
- **손금 결과카드**: 전생식 봉인→클릭 3D플립 + 맨 위 손금사진(dataURL 메모리만) + 번호매긴 설명. 성별+남좌여우 손 자동추천.
- **투자의견 색**: 한국 관습 매수=빨강/매도=파랑(opinionColor 의견텍스트 기반).
- **페르소나별 기능표시 분기**(PersonaImageViewer featureCards/featureChips): 도결(quickMenuJson 메뉴 많음)=텍스트칩 / 나머지=아이콘카드.

## 보드 모달 레이아웃 통일 + 전자책 아이콘화 (2026-06-08)
- **강지훈 전자책 → 기능 아이콘 카드**: 기능 1개라 텍스트칩 대신 아이콘카드. personaFeatures에 'ebook' 등록(NAME_FALLBACK 강지훈), quickMenuJson null로 칩 제거.
- **분석 보드 모달 닫기버튼 잘림 수정**: 명품·주식·골프가 `items-center`+`max-h-95vh`라 작은 데스크탑 창에서 헤더(닫기 X)가 화면 위로 잘림 → **골프 스윙 보드 기준으로 통일**: 모바일=전체화면(items-stretch), 데스크탑=중앙(md:items-center)+`md:p-6`+`max-w-5xl`+`md:max-h-90vh`. 헤더 shrink-0이라 항상 보임. **교훈: 모달은 items-center+큰 max-h면 작은창에서 헤더 잘림. 모바일 전체화면+데스크탑 90vh가 안전.**

## 분석보드 목록·헤더 정비 (2026-06-08 저녁)
- **목록 요약화**: 주식 완료종목=투자의견+점수('매수 78점'), 골프=총점+단계별 점수칩(어드레스/백스윙/…). 스텝퍼는 분석중·대기중만. 칩 가독성=흰배경+진한글씨(연한 골드 안 보임).
- **선택 전 목록 전체폭+2열 그리드**: 종목 선택 전 우측 빈 안내로 공간 낭비 금지. `repeat(auto-fill,minmax(260~280px,1fr))` max-w 1100 중앙. 선택 후엔 좁은 사이드바+우상세(어차피 모바일/상세는 전체화면).
- **모달 탑메뉴와 분리**: 모바일에서 고정 헤더에 붙던 것 → 상단 60~72px 여백(items-start+pt). 오늘뉴스 포함 통일.
- **모바일 닫기(X)**: 헤더 제목/태그가 넘쳐 X를 밀어냄 → 왼쪽 min-w-0+truncate, 태그 hidden sm:, X shrink-0.
- **'‹ 목록으로' 헤더 고정**: 본문 안이면 스크롤 시 안 보임 → 상세 시 헤더(shrink-0) 왼쪽 고정. 3보드 통일.
- ⚠️**교훈**: 한 보드(주식) 고치면 명품·골프도 같이. 따로 고치다 반복 지적받음.

## 폰트·목록정렬 + 사용법 가이드 (2026-06-13)
- **Pretendard 전역 기본**(SIL OFL, 상업 무료, jsdelivr CDN). `index.html` link + `index.css` `@theme --font-sans` + `html/body font-family`. UI·버튼·뉴스·일반텍스트=산세리프.
- **명조 유지(역할분담)**: 나눔명조/Noto Serif KR은 명품 감정서(LuxuryBoard)·관상/손금 결과카드·전자책(EbookBoard)·운세 결과에 **컴포넌트 인라인 fontFamily**로 박혀 그대로 격조 유지. 랜딩 카드 장식=Cinzel/Cormorant(타로 분위기). ⚠️전역 기본만 바꾸면 인라인 명조는 자동 예외 → 역할분담이 코드 수정 없이 됨.
- **목록화면(MainPageNew) 가운데 정렬**: 헤더·기능그리드·페르소나그리드 3곳 `padding: 20px max(28px, calc((100% - 760px)/2))` → 콘텐츠 760폭 가운데, 배경/보더는 전체폭, 모바일 28px 안전. (980→760으로 좁혀 강화)
- **제목 영역만 중앙**: 라틴·제목·인사·포인트를 `textAlign:center` 래퍼로. 검색·칩·최근목록·카드는 왼쪽(가독성). 전부 가운데는 산만해서 지양.
- **기능탭 '최근 사용' 줄**: recentFeatureKeys localStorage(기능 클릭 시 rememberLastFeature) + **비면 '즐겨찾는 기능'(⭐) 폴백**. onFeatureSelect(personaName, featureKey?) 확장.
- **사용법 가이드 확산**: GuideCard를 5기능(수학문제/웹툰/주식/명품/스윙)에 적용. 닫혀도 '사용법 보기' 한줄+첫방문 자동펼침. 상세 [[project_guide_cards]]. 도결 제외.
- **목록화면 상단 컴팩트화**(사용자 "윗부분 반반, 카드 밀림" 지적): 헤더 padding 20→13, 제목 26→21px, 라틴/제목/인사/최근줄 여백 축소, 그리드 위 padding 20→14. **헤더 borderBottom 제거**(상단/카드 영역 반반 느낌 해소, 배경 연하게) → 카드가 위로 올라와 3:7 근접. 페르소나·기능 탭 둘 다(헤더가 탭 분기 밖이라 공통).
- **첫 화면(LandingPageNew) 홍보 칩 제거**: '✦10가지 AI 기능·다양한 페르소나·무료로 시작' = 로그인 회원에겐 불필요한 마케팅 카피 + 캐러셀 공간만 차지 → 제거(캐러셀 위 여백만 유지).
- **페르소나 입장 모달 이미지 잘림 수정**: introVideoModal 영상·이미지가 `object-cover`라 인물 머리·좌우 잘림 → **`object-contain`**(배경 #0f0a19로 여백 자연스럽게, maxHeight 70vh). 회원/비회원 모달 둘 다.
- **채팅 헤더 버튼 정돈**(사용자 "촌스럽다" 지적): 따로 떠있던 홈/나침반 아이콘(색 불일치) → **연한 퍼플 알약 하나로 묶음**(#F5E6F7+구분선), 나침반→Users(둘러보기 의미 명확). **최근 페르소나 칩도 같은 퍼플 톤 통일** + **'최근' 글자 라벨 제거**(칩에 얼굴·이름 있어 불필요).
