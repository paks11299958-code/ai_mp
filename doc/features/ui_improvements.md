# UI 개선 이력

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
