# UI 개선 이력

## 하위메뉴 모달 재디자인 + 날짜·시간 KST 고정 (2026-07-29)

### 도결선생 하위메뉴 모달 — 검정 → 페르소나 색 연동
- **문제**: `SubMenuModal` 배경이 `#0d0b08`(거의 검정)인데 사이트 전체는 `#FBF8F3`
  밝은 아이보리라 "갑자기 튀어나온 박스"처럼 보였다. 도결선생은 `chatBgUrl`도 없어
  채팅 화면도 밝다 → **원인은 테두리 두께가 아니라 명도 대비**였다.
  (사장이 "다크 브라운 컨셉"이라 본 전제가 실측과 달랐음 — 다크는 이 모달뿐이었다.)
- **해소**: 색을 새로 만들지 않고 **기능카드 `palette`를 그대로 받아써** 카드→채팅→모달을
  한 줄기로 연결. `SubMenuConfig`에 `personaName`·`accent`·`bg` 필드 추가.
- ★**한 페르소나가 기능을 여러 개 담당**한다(도결=운세·재물·인연…). 페르소나로만 색을 찾으면
  '재물'을 눌러도 늘 첫 기능인 운세 색이 나온다 → **누른 메뉴 라벨로 기능을 먼저 찾는다**
  (운세=연보라 `#6B4FA0` / 재물=금색 `#A07828`).
- 함께 적용: 버튼 56→**44px**, 아이콘+오른쪽 `›`, 상단 헤더(페르소나명), 대사 위 여백 확대,
  `backdrop-filter: blur(6px)`, 3중 테두리→`1px`. 닫기는 **우상단 ✕ + 하단 둘 다**
  (하단에 뜨는 모달이라 우상단만 두면 모바일 엄지가 왕복).
- ★**같은 흐름의 모달까지 함께**: `BirthInfoModal`(명부, 도결선생 진입 시 자동)·
  `PartnerInfoModal`도 같은 검정이라 하나만 고치면 더 어색해진다 → 셋을 함께 통일.
- 명도대비 검증: 본문 10.41 / 강조 5.76 (기준 4.5↑).

### 날짜·시간 표시 KST 고정 (32개 파일)
- **문제**: `toLocaleString()`에 `timeZone`을 안 주면 **보는 사람 기기의 시간대**를 따른다.
  서버가 UTC라 같은 값이 폰(KST)에선 `07-29 07:30`, PC가 UTC면 `07-28 22:30` — **9시간 차이**.
  어드민·사용자 화면 전반이 이 상태였다(사장 폰이 KST라 드러나지 않았을 뿐).
- **해소**: `frontend/utils/datetime.ts` 신설(`fmtDateTime`/`fmtDate`/`fmtShort`/`fmtRelative`/
  `nowKst`). 옵션 객체가 있으면 `timeZone: 'Asia/Seoul'` 주입, 없으면 유틸로 교체.
  어드민 10개 + 사용자 화면 22개 = **32개 파일**, 남은 미지정 날짜 호출 0건.
- ★**표시 함수만 변경** — DB 저장·API 송수신·AI 호출은 UTC ISO 그대로다(diff로 검증:
  `apiService` 변경 0건, `toISOString` 변경 0줄). 해외 이용자가 생기면 이 파일 한 곳만 바꾼다.

### 신규 어드민 탭 3종
- **📊 일별 마케팅**(회원·포인트): 유입→실사용→전환을 하루 한 줄로. 어제 대비 증감,
  채널별 유입, 행 클릭 시 시간대별 막대·기능별 상세.
- **⏰ 배치 작업**(서버 모니터 옆): 서버 크론 50개(서버1·2)를 KST로 표시하고 **실행 시각만
  수정 가능**(명령어는 서버에서 잠금 + 자동 백업). 사용자 신청 큐는 별도 탭으로 분리.
- **💸 환불 절차**(문서 QnA 옆): 5단계 절차 + 환불액 계산기(패키지 보너스 반영).

## 뒤로가기 버튼 헤더 통일 + 중고 판매 화면 라이트 테마 전환 (2026-07-25)
- **뒤로가기 버튼을 헤더 내 원형 아이콘 버튼으로 통일**: 콘텐츠 영역 안에 별도 줄로 떠
  있던 `← 뒤로` 텍스트 버튼(list/form 스텝에서 `setStep('intro')`)을 제거하고, sticky
  헤더의 타이틀 왼쪽에 `w-7 h-7 rounded-full` 원형 아이콘 버튼으로 이동. 각 화면 팔레트에
  맞춰 배경/글자색만 다르게(연한 배경 + 진한 글자색 조합):
  - `ShortsMakerBoard.tsx`(이아린): 배경 `#FCE7F0` / 글자 `PINK`(`#D85C95`)
  - `HomepageBoard.tsx`(박하진): 배경 `#E4E6F9` / 글자 `INDIGO`(`#5C6AC4`)
  - `UsedItemBoard.tsx`(이아린, 모바일 전용): 배경 `#FFE8D5` / 글자 `#C2410C`
  - 다른 구조(폼 액션 버튼 페어인 `GolfReserveDialog.tsx`, 이미 별도 pill 디자인이 있는
    `UsedItemBoard.tsx`의 "목록으로")는 통일 대상에서 제외 — 구조/용도가 달라 억지로
    맞추면 레이아웃이 어색해짐.
- **`UsedItemBoard.tsx`(중고 판매) 다크→라이트 테마 전환**: 진한 네이비/slate 배경 +
  회색 텍스트 조합이 다른 기능(쇼츠 만들기 핑크, 홈페이지 만들기 인디고)에 비해 칙칙하다는
  지적 → 흰 배경 + 연한 회색 라인 기조로 전면 교체(`slate-900/800/700` 계열 전부 제거).
  오렌지 포인트 컬러(`orange-500/600`)는 유지하되 밝은 배경에 맞게 채도만 조정. 상태
  배지 색(`STATUS_CONFIG`의 green/yellow/blue/red-400)은 밝은 배경에서도 무난해 그대로 둠.

## 어드민 화면 정리 3건 (2026-07-21)
- **레퍼럴 방문 일별 차트 날짜 버그**: `ReferralStatsPanel.tsx`의 x축 라벨이 `String(d.day).slice(5)`로 잘못 슬라이싱돼 `07-16T00:00:00.000Z`처럼 ISO 문자열이 그대로 노출되던 버그(서버가 Date를 ISO로 직렬화 → 프론트가 앞 5글자만 자르려던 게 실패). `String(d.day).slice(0, 10)`로 `YYYY-MM-DD` 정리 + 막대 위에 방문 카운트 숫자 추가 + 14일치 라벨을 대각선 배치(`rotate(45deg)`)로 겹침 방지.
- **회원목록 가입일 시간 추가**: `UsersPanel.tsx`에서 `toLocaleDateString('ko-KR')`(예: `2026. 7. 21.`) → `toLocaleString('sv-SE').slice(0, 16)` 트릭으로 `2026-07-21 14:30`(날짜+시간) 표시. `sv-SE` 로케일이 `YYYY-MM-DD HH:mm:ss` 포맷을 반환하는 걸 이용.
- **회원가입 닉네임 필수화**: 기존 "닉네임(선택)"이라 미입력 시 메인페이지 인사말이 이메일 앞부분으로 대체되던 문제 — 정식가입(`AuthModal.tsx`)·게스트 정식전환(`GuestUpgradeModal.tsx`) 폼 양쪽에서 `required`+프론트 검증 추가, 백엔드(`verify-register`·`upgrade-guest`)도 `!username?.trim()`이면 400 차단. 가입 환영 알럿(`RewardAlertModal.tsx`)에 "{닉네임}님, 가입을 축하합니다!" 반영. 메인페이지 인사말(`user.username || user.email.split('@')[0]`)은 기존 코드 그대로 — 닉네임이 항상 있으니 폴백이 사실상 안 타게 됨.

## 스킬 카탈로그를 어드민 전용 메뉴로 승격 (2026-07-21)
- `sites/skills/`(Claude 스킬·MCP·플러그인 탐색기)가 다른 Hermes 생성 독립사이트들과 섞여 "독립사이트 관리"(SitesPanel)에 있던 걸, 어드민 "시스템" 그룹에 **"스킬" 전용 탭**으로 분리(`SkillsPanel.tsx` 신규)하고 **동기화 버튼**을 붙였다.
- 기존 "독립사이트 삭제"(site-delete) 큐잉 패턴 재사용: 버튼 클릭 → `POST /admin/skills/sync`가 `DevRequest`(source='skill-sync')에 INSERT만 하고 즉시 응답 → 서버2 `dev_request_worker.py`(2분 폴링)가 신규 `rag/skill_ops.py`의 `sync_catalog()` 호출 → `~/.claude/skills/_catalog/build_catalog.py` 재실행 → 산출물을 `sites/skills/index.html`로 복사 → git commit/push → Vercel 자동 재배포. `sites/README.md`에서 skills 행을 제거해 독립사이트 목록에는 더 이상 안 뜸.
- 카탈로그 데이터도 최신화: 누락돼 있던 `logo-maker`·`shorts-maker` 스킬을 `skills_data.json`에 추가("콘텐츠 제작" 카테고리 신설), 43→45개(drift 경고 해소).

## 타로 리딩 카드 뽑기 흐름 단순화 (2026-07-21)
상세는 [tarot.md](tarot.md) 참고. 카드 3장을 대기 없이 연속으로 뽑게 하고 AI 종합 해석은 1회만 요청하도록 변경(기존 4회) — `TarotCardModal.tsx`, `App.tsx`의 `makeTarotReport`.

## 사이트 로고 교체 — Ploppy 브랜드 (2026-07-14)
- **'✦ AI PERSONAS' 텍스트 → Ploppy 로고**(헤더·푸터, MainPageNew.tsx): 산호+민트 두 말풍선 캐릭터 이미지 + "Ploppy" 워드마크. 홈 이동 버튼 동작은 유지.
- **로고 파일**: `public/ploppy-logo.png`(투명 배경 캐릭터). ★**Vite publicDir=레포 루트 `public/`**(frontend/public 아님) → `<img src="/ploppy-logo.png">`. 원본·후보는 `public/brand/`에 git 보관.
- **워드마크 폰트**: Quicksand(index.html 구글폰트 추가). ★지정 폰트가 로드 안 되면 fallback으로 떠서 미리보기와 달라짐 — 폰트 로드 확인 필수. Quicksand 최대 굵기 700(800 지정 시 fallback).
- **로고 제작 노하우**: 사장 목업(종이 음각 홍보이미지=웹 부적합)을 gemini-2.5-flash-image로 재현→sharp 흰배경 투명화. 상세=logo-maker 스킬. ★손 SVG=조잡 실패, AI 이미지 생성이 정답.

## 기능 명칭 변경 + 채팅 칩 레이아웃 (2026-07-12)
- **명칭 변경**(사장): 헤어스타일 진단→**헤어Style**, 미래의 나→**시간여행**, 닮은 연예인 찾기→**연예인 매칭**. 메인 카드(MainPageNew)·채팅 기능 칩(personaFeatures)·어드민 표시명(AdminPanel) 3곳 일괄. 동의어 검색 키워드는 유지(옛 이름으로도 검색 가능).
- **채팅 칩**: 기능이 늘어 긴 라벨이 페르소나 이미지를 밀어내는 이슈 → 칩 라벨 축약(전통의상 체험→전통의상)으로 완화. 레이아웃은 이미지행 인라인(원래 방식) 유지.

## 헤어 진단 결과 저장·크게 보기 (2026-07-12, 상세 features/hair_styling.md)
- **밑줄 링크 "크게 보기 / 저장" → 큰 버튼 2개**: 🔍 크게 보기(라이트박스) · 📥 갤러리에 저장(퍼플 그라디언트, 자랑하기와 톤 통일).
- **갤러리 저장 = 사진 파일만**: iOS=이미지만 담은 공유시트(→'이미지 저장'이 사진앱행, iPad는 UA=Mac이라 maxTouchPoints로 보정) / 그 외=다운로드. 링크·캡션 미포함(자랑하기와 분리).
- **크게 보기 라이트박스**(z-85, 헤어창 z-70 위)+하단 [닫기·저장]+우상단 ✕. ★버블링 버그 수정: 라이트박스가 최상위 div(onClick=onClose)의 자식이라 닫기/배경 클릭이 부모로 버블링돼 헤어창까지 닫히던 것 → stopPropagation.
- **★GCS CORS 우회**: 버킷 CORS 설정 권한 없어(SA 미보유) 저장·공유 blob fetch가 막힘 → shared-api 같은 출처 중계 라우트 `/api/hair/image`로 우회(경로 화이트리스트).
- **견본 썸네일 lazy-load**(loading=lazy): 스타일 개수 늘어도 초기 로딩 일정.

## 윤채린 헤어스타일 진단 화면 (2026-06-16, 상세 features/hair_styling.md)
- **HairStyleBoard**: 4단계(사진업로드→성별→헤어갤러리 3열→진단) 풀스크린 모달, 모바일 우선, 퍼플 톤.
- **결과 Before/After**: 합성 이미지(원본 vs 헤어입힌 내모습)를 결과 상단에 나란히 + 크게보기 링크 + 윤채린 진단 텍스트(얼굴형·어울림·팁·대안·총평 항목별).
- **단계 로딩 오버레이**: 합성 10초+라 화면덮는 로딩+스피너 + '사진분석→헤어합성→윤채린진단' 단계 메시지 순차(타이머 2.5s/8s). 멈춘 느낌 제거. (주식분석식 큐는 단건엔 과해서 제외)
- **EXIF 회전 보정**: 폰사진이 옆으로 눕던 버그 → createImageBitmap from-image로 픽셀 보정.

## 기능 둘러보기 카테고리 칩 + 페르소나 카테고리 재분류 + 누락 기능카드(전자책·보험·웹툰) + 페르소나 반자동 생성 (2026-06-16)
- **기능 둘러보기 탭 카테고리 칩 필터** (MainPageNew.tsx): `FEATURES_GRID` 각 항목에 `category` 부여 + `FEATURE_CATEGORIES` 6개(💰투자·쇼핑/📰정보·학습/🎨창작·콘텐츠/🔮운세·사주/🏌️건강·취미/👥생활·커뮤니티). 페르소나 탭 카테고리 칩과 **동일 패턴 재사용**, 검색과 AND 결합. (기능 검색은 원래 있었음, 카테고리만 없었음). **기능 카테고리는 코드(FEATURE_CATEGORIES), 페르소나 카테고리는 DB(Category)** — 별개.
- **누락 기능카드 3개 추가**: 전자책 만들기(ebook/강지훈/창작·콘텐츠), 보험 컨설팅(insurance/정우진/투자·쇼핑), 웹툰 보기(webtoon/향기/창작·콘텐츠). 이들은 원래 **페르소나 퀵메뉴로만 진입**해서 카드가 없었음. umbrella·ebook·webtoon 아이콘 신설(MpnFeatureIcon SVG).
- **카드 클릭 동작 개선**: `onFeatureSelect`가 `FEATURE_ACTIONS`에 key 있으면 **보드 바로 열기**(전자책·보험·뉴스 등), 없으면 페르소나 채팅 이동(운세 계열). ⚠️웹툰은 `showWebtoon && activePersona` 조건이라 특별처리(향기 setActivePersonaId 후 setShowWebtoon). 페르소나 선택화면 블록에 EbookBoard·WebtoonEpisodeList 렌더 누락분 보강(안 그러면 카드 눌러도 안 뜸).
- **페르소나 카테고리 5개 재분류** (DB Category, 코드무관): 기존 10개(거의 1:1 라벨+기준 뒤죽박죽, order=7에 IT·역술가·스포츠 혼재)→**친구·일상/일·생산성/전문 분석/창작·콘텐츠/운세·사주**. 트랜잭션(Persona 재할당→Category 재명명→빈 카테고리 DELETE)+백업. 프론트는 카테고리명 하드코딩 없음=DB값 그대로 렌더, /api/categories 캐시 60초.
- **페르소나 반자동 생성 ('✨ AI로 채우기')** (PersonaInfoTab.tsx + shared-api admin.ts): 어드민 페르소나 만들기에서 이름·직업·카테고리 입력 후 버튼→AI가 description/systemInstruction/identityPrompt/iconName+colorClass 4필드 생성→**항목별 검토·수정 후 저장**. 같은 카테고리 기존 페르소나 few-shot+클로드 CLI 구독(`_genWithClaude`, ₩0). 아이콘·색상 화이트리스트 보정. 이미지·퀵메뉴는 사람이.

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
- **사용법 가이드 개편**(2026-06-13, 사용자 "인라인 설명이 화면 차지·산만" 지적): 인라인 GuideCard → **헤더 도움말(?) 모달 `HelpButton`**으로 7개보드 통일(주식·명품·스윙·수학·전자책·웹툰·보험). 닫기(✕) 옆 앰버 ❓버튼(데스크탑 텍스트/모바일 아이콘만, #D9920A), 클릭→단계 모달. 컬러 헤더(수학 핑크)는 `variant="white"`. 상단 가이드 제거로 분석내역·입력폼이 위로 올라와 정돈. 새 기능엔 `<HelpButton .../>` 한 줄. 상세 [[project_guide_cards]].

## 포인트 단가 버튼 표시 + 명품버튼 가독성 (2026-06-18)
- **명품감정 'AI 검증 요청' 버튼 글자 안 보이던 것**: 보라배경(`bg-purple-700`)에 어두운 보라글자(`text-[#2D2438]`)라 묻힘 → **`text-white` + `font-semibold`**(LuxuryBoard.tsx). 같은 패턴 다른 버튼엔 없었음.
- **실행 버튼에 차감 단가 표시**: 9개 기능 실행 버튼에 "· N pt"(예: "✨ AI 검증 요청 · 50pt"). 카드/둘러보기엔 미표시(돈냄새 최소화, 쇼핑 결제직전 패턴). 단가는 `usePoints().priceOf(feature)`로 DB값 받아 표시 → 어드민에서 단가 바꾸면 자동 반영. 잔액 부족 시 `requirePoints`가 즉시 충전모달. 상세 doc/points_payment.md "포인트 사전 안내".

## 공유 딥링크 + OG 미리보기 + 공유 버튼 (2026-06-22, 바이럴 1단계)
- **딥링크 `?p=personaId`/`?f=featureKey`**(App.tsx): 공유링크로 들어온 사람을 해당 페르소나 채팅/기능 보드로 바로 안내. URL은 즉시 정리(흔적/재진입 방지). **★비회원에게 가입 강요 제거** → 페르소나는 인트로(소개) 노출, 기능은 대기페이지 포커스. 가입은 "입장" 누를 때 자연 유도. 로그인 상태면 바로 진입. `featureBoardOpeners` 단일출처로 FEATURE_ACTIONS와 공유.
- **OG/Twitter 메타태그**(index.html): 카카오/인스타/페북 미리보기 카드(사이트 공통, `512.png`). SPA라 페이지별 OG는 없음.
- **공유 버튼**: 채팅 헤더 ⋮ 메뉴 "이 페르소나 공유하기"(`?p`) + 기능 카드 🔗(`?f`, MainPageNew). `navigator.share`(모바일) → 클립보드 복사 폴백 + 토스트.
- **순간 진입점**: 미래의나·헤어 결과 화면에 `📲 친구에게 자랑하기`(결과 이미지 파일+딥링크 동시 공유, `shareResultImage`). 결과가 막 떴을 때 공유 충동 최고조 → 결과물이 곧 광고.
- 추천코드 연계: 위 공유링크에 내 `?ref` 자동 부착 → 페르소나/기능/결과 공유가 곧 추천 링크. 상세 [referral_system.md](referral_system.md).

## 첫 화면(MainPageNew) 대개편 (2026-06-23)
첫 화면을 하루 종일 모바일·PC 양쪽으로 다듬은 묶음. 주로 `frontend/components/MainPageNew.tsx`(★래퍼 `MainPageNew`→`PersonaSelectPanel` **2단 구조**) + `App.tsx` + `hooks/useAuth.ts` + `index.css`.

- **LandingPageNew→MainPageNew 단일화**: 첫화면(LandingPageNew)+둘러보기(MainPageNew) 2화면 → MainPageNew 단일. useAuth 라우팅 전부 `main`으로 일원화, App의 잔존 `goTo('hero')`/`goTo('guest')` 5곳→`main`. **죽은 guest/hero 코드 ~200줄 제거**(Screen 타입 `'authPage'|'main'|'chat'`로 좁혀 tsc로 잔존참조 0 보증). LandingPageNew import는 비번재설정 배경(resetToken)에만 잔존.
- **제목 h2 '대화할 AI를 선택하세요' 제거**(검색·탭·카드가 이미 선택 화면). 로고+개인화 인사만.
- **상단 4단 섹션**: ✨오늘의 추천 → 🎁새로운 기능 → 💬이어서 대화(로그인+이력 시만) → 👥새로운 AI 친구. 앞 3개는 로그인 무관 항상 노출.
  - **오늘의 추천**: 사장 지정 큐레이션 `SPOTLIGHT_KEYS=['webtoon','hair','siwoon','stock']` + 수동 배지. 새 큐레이션은 배열에 key 추가.
  - **새로운 기능**: 지정 제외, `FEATURES_GRID` **id 최신순 상위 8개 자동**(새 기능 추가 시 자동 맨앞).
  - **새로운 AI 친구**: 페르소나 createdAt 최신순 16개, 원형 72px.
- **캐러셀 공통화(`Carousel` 헬퍼)**: 마우스 드래그(window mousemove/up, 6px↑ 끌면 클릭차단) + 터치 스와이프. ★화살표는 만들었다가 피드백으로 **전부 제거**. 카드폭 `flex:'0 0 44%' + maxWidth:200`=모바일 2개+다음 살짝(화면비례 자동, 고정px 잘림 해소).
- **즐겨찾기→햄버거 모달**(showFavorites). 첫화면을 모두 동일 콘텐츠로 일관화(PC 헐렁함 해소).
- **스크롤 구조**: 페르소나 그리드만 안쪽 스크롤(PC 답답) → 최상위 `overflowY:auto` + **로고/햄버거만 sticky**, 나머지 전체 스크롤.
- **로고 클릭=새로고침**(onGoHome→`window.location.href='/'`). PC 본문폭 760→960.
- **로그인/로그아웃 토글**(햄버거 하단, 비로그인→로그인/authPage) + **💎 충전하기**(→PointModal 토스충전) + 햄버거 정리(페르소나목록·기능둘러보기 제거=탭으로 있음).
- **섹션 제목 강조(`SectionTitle` 헬퍼)**: 12→15px·800·왼쪽 퍼플 강조바. **스크롤바 색**(index.css 전역): 다크 회색 `#4b5563`→퍼플 `#C4A9E0`(hover `#8E6FB7`)+Firefox.
- ⚠️★**2단 구조 prop 함정(교훈)**: 새 prop은 ①interface ②패널 props타입 ③패널 구조분해 ④래퍼 구조분해 ⑤래퍼→패널 전달 **5곳 모두** 손봐야 함. `onLoginClick`이 ④⑤ 누락으로 토글 무반응이었음(디버그 로그로 추적).
- ⚠️★**모달 렌더 위치 함정(교훈)**: 모달(PointModal 등)은 **각 화면 블록(return)마다** 렌더돼야 함. 첫화면 블록에 없으면 `setShow*(true)` 호출해도 안 뜸 — 로그인 모달·충전 모달 둘 다 이 이유로 안 떴음. authPage 화면 처리도 `if(!user)`안→최상위로 올려 상태 무관 동작.
- ⚠️**Vercel 배포 검증**: 같은 번들 해시명에 내용만 갱신되는 엣지 캐시 존재 → 배포 확인은 **번들에서 변경 시그니처 문자열 grep**, 캡처는 `?cb=`/`?nocache=` 캐시버스터. 동작은 Playwright measure(scrollLeft/화면전환)로 검증.

### AI 페르소나 랭킹 섹션 (2026-06-23, 첫 화면 후속)
'👥 새로운 AI 친구'(createdAt 신규순)를 **'🏆 AI 페르소나 랭킹'(실제 인기순)**으로 교체.
- **백엔드**(shared-api `routes/aimp/personas.ts`, 커밋 `3a4a28a`, 서버1 배포 완료): `GET /personas/ranking?limit=` — `prisma.chatSession.groupBy({by:['personaId'], _count})`로 페르소나별 **세션 수** 집계 → 세션수 내림차순(동수=order 오름차순), adminOnly 제외, limit 기본16·최대50, `sessionCount` 포함 반환. ⚠️라우트 순서: `/ranking`을 `/:id` 동적 라우트보다 위(POST / 앞)에 둠.
- **프론트**(`apiService.personaApi.getRanking` + MainPageNew): 마운트 시 `getRanking(16)` fetch → `rankedPersonas` state. **로딩 전/실패 시 createdAt 최신순 폴백**(빈 화면 방지). 카드는 **원형 유지**(사장 "사각만이면 답답" 피드백) + **1·2·3위 메달 배지(🥇🥈🥉), 그 외 숫자 배지**(원형 좌상단 absolute), 1~3위는 골드 테두리.
- ⚠️★**Vercel rewrite 경로 함정(또 밟은 교훈)**: `vercel.json`은 `/api/personas/:path*` → 서버1 `/api/aimp/personas/:path*`로 **자동 변환**. 따라서 ①프론트는 `/personas/ranking`(BASE=/api → `/api/personas/ranking`) 호출이 맞고 ②**외부 검증 curl도 `/api/personas/ranking`(aimp 빼고)** 로 해야 200. `/api/aimp/personas/ranking`을 직접 치면 rewrite source에 없어 "Not found"(헷갈려서 디버깅 길어짐). 서버1 **직접**(localhost:3020)은 반대로 `/api/aimp/personas/ranking`이 정답.
- ⚠️shared-api는 `ts-node --transpile-only`로 직접 실행(빌드 불필요)이나, 라우트 추가가 reload로 안 잡히면 `pm2 restart`(reload 아님). push≠배포=서버1 git pull+pm2 필수.

### 메인 정리 + 충전모달 누락 일괄 수정 (2026-06-24)
- **'이어서 대화' 섹션 제거**: 상단 4단→3단(오늘의추천·새로운기능·AI페르소나랭킹). 정보 과부하 해소 + 채팅 헤더 '최근 페르소나' 칩이 복귀 동선 대체(중복). `recentPersonas` prop은 향후 복원 대비 유지(렌더만 제거).
- ⚠️★**포인트 부족(402)→충전모달 누락 버그 일괄 수정**: 차감 기능 클릭 시 포인트 부족이면 충전모달이 떠야 하는데, **raw `fetch`를 직접 쓰는 보드들이 402를 일반 에러로만 throw**해 '포인트가 부족합니다' 텍스트만 뜨고 모달이 안 떴음. 수정한 보드: **명품(LuxuryBoard)·보험(InsuranceBoard)·수학(MathTutorBoard) 공통 apiFetch 래퍼 / 핫키워드(HotKeywordBoard) run 인라인 / 오늘뉴스(TodayNewsBoard)** — 각 `!res.ok`에 `if (res.status===402) window.dispatchEvent(new CustomEvent('insufficient-points'))` 추가. PointModal z-index 50→**70**(보드 위에 표시).
- ✅**안전(헬퍼가 402 자동처리)**: `apiService.request`(라인34)·`lib/boardFetch`(라인9)를 거치는 기능 — 주식·전자책·헤어·미래의나·관상·손금·중고·퀵메뉴(운세·전생). 이들은 402→`insufficient-points` 자동 dispatch.
- ★**원칙(교훈)**: 차감 기능은 **공통 헬퍼(`request`/`boardFetch`)를 쓰는 게 원칙**. 새 기능에서 raw `fetch`를 직접 쓰면 402 충전모달 처리를 **반드시 수동 추가**할 것(누락 시 조용히 텍스트 에러만 남). 전수 점검 방법: `grep -c "await fetch"` vs `grep -c "boardFetch|request|insufficient-points"`.

### 기능 카드 즐겨찾기 + 헤더 ⭐ + 로고 정렬 (2026-06-24)
- **기능 카드 ⭐ 즐겨찾기 토글**: 메인 '오늘의 추천'·'새로운 기능' 캐러셀 카드에 ⭐/☆ 토글 추가(기존엔 기능 탭 그리드에만 있었음). 위치는 카드 **우하단**(상단 배지와 분리, 페르소나명은 좌하단이라 안 겹침). `e.stopPropagation()`으로 캐러셀 드래그/카드 클릭과 분리. 회원=즉시 저장(`toggleFavorite`), 비회원=☆ 보이고 클릭 시 로그인 유도(`favoritableKeys={[]}`→`FAVORITABLE_KEYS`, `onToggleFavorite={requireLogin}`). ⚠️`FAVORITABLE_KEYS` 정의를 `if(!user)` 블록 위로 끌어올림(TDZ 방지).
- **헤더 ⭐ 즐겨찾기 버튼**: 로고 바 우측 햄버거(☰) **왼쪽**에 ⭐ 버튼(`right:38` absolute). 클릭 시 햄버거 안 거치고 바로 즐겨찾기 모달(`setShowFavorites`), 비회원은 로그인 유도. 햄버거 안 '⭐ 즐겨찾기' 항목도 중복 진입점으로 유지.
- **상단 로고 왼쪽 정렬**: `✦ AI PERSONAS` 헤더를 가운데→왼쪽(`textAlign:'left'`). 모바일 가독성. ⭐/햄버거는 우측 absolute라 영향 없음.

### 어드민 메인 카드 순서 지정 (2026-06-24)
메인 '오늘의 추천'·'새로운 기능' 카드 구성·순서를 어드민에서 지정. 어드민 **'카드 순서' 탭**(`components/admin/CardOrderPanel.tsx`).
- **UI**: 패널 안에 **하위 탭 2개**(✨오늘의 추천 / 🎁새로운 기능) + 각 탭은 **좌우 드래그 보드** — 왼쪽 '모든 기능'에서 카드를 마우스로 끌어 오른쪽 '표시할 카드'에 놓기, 오른쪽 안에서 끌면 순서 변경, 왼쪽으로 빼면 제외. **오늘의 추천 최대 8개**(maxRight). HTML5 draggable(PC 마우스 전용, 터치 미지원).
- **저장**: `AppConfig` 키 `spotlightOrder`/`newFeaturesOrder`(콤마구분 키). `settingsApi.update`(`PUT /settings`)의 **기존 admin 가드 재사용**(`if(!isAdmin) return` — memory_enabled 외 키는 어드민만)이라 **백엔드 변경 0**, DB 마이그레이션 불필요(AppConfig 기존 테이블).
- **메인 반영**: `App.tsx`가 `settingsApi.get`으로 순서 읽어 `MainPageNew`에 props(`spotlightOrder`/`newFeaturesOrder`) 전달. 정렬: spotlight=지정순서(기본 webtoon/hair/siwoon/stock), **newFeatures=newFeaturesOrder 지정 시 그것만(표시 정본)·미지정 시 spotlight 제외 전체 출시일순**(기존 8개 제한 제거=모든 기능 노출, 가로 캐러셀이라 개수 무관). 배지 없는 카드는 `f.badge &&`로 배지 미표시.
- ⚠️★**드래그 안 되던 버그(교훈)**: 드래그 카드/영역을 그리는 `Card`/`Zone`을 **컴포넌트 함수 안에서 정의**하면 부모 리렌더(onDragOver의 setState)마다 **재생성→DOM 언마운트→드래그 도중 drop 이벤트 유실**. 해결=`renderCard`/`renderZone` **인라인 함수**(컴포넌트 아님). + `onDragStart`에서 `dataTransfer.setData`(없으면 일부 브라우저 드래그 시작 안 함) + `onDragOver` 같은 위치면 setState 스킵 + drop `stopPropagation`. **DnD 핸들러를 그리는 자식은 부모 함수 안에서 정의하지 말 것.**
- ⚠️**2단 컴포넌트 prop 함정 재확인**: MainPageNew는 래퍼→PersonaSelectPanel 2단이라 새 prop을 **5곳**(래퍼 interface·패널 interface·패널 구조분해·래퍼 구조분해·래퍼→패널 전달) 모두 추가해야 함.

### 메인 화면 omd 시안 부분 채택 — 히어로·CTA·하단탭바·랭킹 (2026-06-26)
omd 시안(`aichat-main-mobile`)을 **통째 교체 대신 부분 채택**으로 `MainPageNew.tsx`에 이식. 시안은 정적 HTML 더미라 사실 오류(헤어="이별"·웹툰="메이커")·가짜 가격/통계·미구현 기능 광고가 섞여 있어, **시각 요소만 가져오고 실제 데이터·기존 기능·핸들러는 보존**. 단일 파일 변경(백엔드 0), 커밋 `e94b143`.
- **HeroBanner**(신규 내부 컴포넌트): 그라데이션 카드(#6A4B93→#8E6FB7→#B79BE0) + "오늘은 누구와 이야기해 볼까요?" + 검색 input + 통계 3칸. ★검색 input은 기존 `searchQuery`/`onSearchChange`(personas) **그대로 바인딩** + 입력 시 personas 탭 전환 → 탭 아래 기존 검색바와 **상태 공유**(논리적 중복 없음). ★통계는 **실제값만**: `personas.length`+ / `FEATURES_GRID.length`(=18) / 누적대화수(`totalSessions`=랭킹 sessionCount 합계). 시안의 가짜 '★4.9 만족도'·'12.4만'은 **제거**.
- **랭킹 개선**: 기존 가로 원형 캐러셀 → **세로 리스트 상위6**(시안 .rank-item 풍). 역할 배지(`p.category?.name||p.jobTitle`) + 대화수(`formatCount(sessionCount)` "12.4만"식) + 메달/순위. 데이터 전부 기존 `/personas/ranking` 응답에 있던 것(UI 렌더만 추가, 백엔드 0). 섹션 id=`mpn-ranking`. 시안의 별도 '대화' 버튼은 카드 전체가 이미 클릭=대화라 생략.
- **CTA 충전 배너**(신규): 연보라 그라데이션 카드. ⚠️시안의 '첫 충전 2000P 보너스'는 **미구현 기능이라 거짓** → 실제 PACKAGES 근거 문구 "💎 충전하고 최대 20% 보너스 / 5만원→60,000P·1만원→11,000P". 로그인=`onChargeClick`·비로그인=`onLoginClick`.
- **모바일 하단 탭바**(신규 `BottomTabBar`): 홈·기능·대화(FAB)·랭킹·내정보. `position:fixed`. ★인라인 스타일로는 `@media`·`env(safe-area-inset-*)` 불가 → 컴포넌트 내 `<style>` **1블록 주입**(`.mpn-tabbar` PC≥768 `display:none`, `.mpn-root` 모바일만 paddingBottom). 스크롤 컨테이너=루트 div(`rootScrollRef`)라 상단이동은 `ref.scrollTo`, 랭킹은 `getElementById('mpn-ranking').scrollIntoView`. 햄버거 메뉴와 동선 중복 허용(탭바=빠른이동/햄버거=전체).
- **헬퍼 `formatCount(n)`**: 10000↑ → 'N.N만', else `toLocaleString()`.
- ★**교훈 — omd 시안은 레퍼런스, 통째 적용 금지**: 더미 텍스트·가짜 수치·미구현 기능 광고 위험. 부분 채택 시 ①데이터는 실제 API ②가격/보너스는 DB·PACKAGES 근거 ③검색 등 상태는 기존 것 공유로 중복 회피. 검증=tsc·빌드·모바일390/PC1280 캡처(탭바 모바일 flex·PC none)·라이브 실데이터(통계 12+/18/160, 랭킹 역할배지·대화수).

### 메인 통합검색 + 폼 가독성 + 어드민 스크롤 묶음 (2026-06-28)
마케팅 서비스 출시 직후 사장 피드백 기반 UI 보강. 전부 ai_mp 프론트, master 배포·라이브 검증.

- **메인 통합검색** (`MainPageNew.tsx`, `974459c`): 히어로 검색바가 **현재 탭(페르소나)만** 검색하던 버그 → '뉴스'처럼 기능(FEATURES_GRID)에 있는 항목이 안 잡혀 "검색 안 됨"처럼 보임(사용자는 페르소나/기능 구분 모름). 해결=히어로·탭 검색어를 `activeQuery=(searchQuery.trim()||featureSearchQuery.trim())` 하나로 통합, `isSearching`이면 **탭 무관**하게 페르소나·기능 둘 다 필터 → **🧑 페르소나(N) / ⚡ 기능(M) 두 섹션**으로 함께 표시(둘 다 0건 시 "'검색어' 검색 결과가 없습니다"). 검색 중엔 카테고리 무시(발견 우선), 둘러보기(검색 아님)는 기존 탭별 카테고리 필터 유지. 거대한 카드 JSX(페르소나·기능 각 ~120줄)를 `renderPersonaCard`/`renderFeatureCard` 함수로 추출해 **탭 그리드·통합검색 결과가 동일 카드 공유**(중복0, 디자인 동일). 기존 큐레이션 섹션은 이미 `!isSearching` 가드라 그대로 숨겨짐.
- **마케팅 글쓰기 입력 가이드** (`MarketingBoard.tsx`, `5370fed`): 빈 입력창이 막막하다는 지적 → "💡 업종/상품+타깃+강조점" 작성 가이드 한 줄 + **예시 칩 4개**(`TOPIC_SAMPLES`, 클릭 시 입력창에 채워지고 자유 수정). placeholder도 가이드 형식과 통일.
- ★**다크모드 폼 글자 안 보임 전역 해결** (`frontend/index.css`, `cb761da`): OS/브라우저 다크모드가 input·textarea **글자색을 흰색으로 반전** → 흰 배경 위에서 입력 글자 안 보임(마케팅 글쓰기·마케팅 자산 등 **112곳** 위험, 사장 2회 겪음). 112곳 개별 수정 대신 **전역 CSS 1곳**: `html{color-scheme:light}`(폼 자동반전 차단) + `:where(input,textarea,select){color:#1f2937;background:#fff}` + placeholder gray-400. ★**`:where()` 특이도 0** → 컴포넌트의 Tailwind `text-white`/`bg-gray-*`·인라인 style이 **항상 이김** → 의도적 다크 패널(어드민 등)은 안 깨짐. 신규 input도 자동 커버. 검증=Playwright `colorScheme:'dark'`로 라이트폼 가독성+다크패널 유지 둘 다. (라이트 환경에선 재현 안 되니 다크모드 캡처 필수.)
- **'미래의 나'(나이변환) 메인 카드 추가** (`MainPageNew.tsx` FEATURES_GRID id20, `87ba0ec`): agetransform이 채팅 메뉴(FEATURE_REGISTRY)·핸들러(featureBoardOpeners)는 있었으나 FEATURES_GRID 누락 → 메인 카드·어드민 카드순서에 안 떴음. 어드민 카드순서 점검 중 발견. 클릭 핸들러는 기존 것 재사용.
- **AI 사용량 대시보드 스크롤 수정** (`AdminPanel.tsx` AiUsagePanel, `c49e2fc`): 어드민 우측 콘텐츠 컨테이너가 `overflow-hidden`이라 각 패널이 **자체 `flex-1 overflow-y-auto`** 를 가져야 하는데 AiUsagePanel만 빠져 일별 비용 차트 아래가 잘림 → root에 추가. 전체 어드민 패널 14개 재점검=나머지 정상.
- ★**어드민 패널 스크롤 패턴(교훈)**: 어드민 우측 컨테이너(`flex-1 flex flex-col overflow-hidden`)는 **각 패널이 root에 `flex-1 overflow-y-auto`를 직접 가져야** 스크롤됨. 새 어드민 패널 만들 때 이 클래스 빠뜨리면 내용 길어질 때 잘림.

### 하이브리드 기능 의미검색 + 모바일/어드민 UX 묶음 (2026-07-02)
메인 검색이 이름/설명 부분일치(LIKE)만이라 "파마"→헤어를 못 찾던 문제 해결 + 모바일/어드민 UX 3건. 전부 ai_mp master 배포, shared-api는 신규 라우트로 서버1 수동 배포. 상세·재사용 교훈은 별도 `doc/features/hybrid_feature_search.md` 참조.

- **하이브리드 기능 의미검색** (`MainPageNew.tsx` + shared-api `routes/aimp/feature-search.ts`): 동의어 태그 `FEATURE_SYNONYMS`(기능 20개 key별 연관 키워드)로 이름/태그/설명 부분일치 **OR 동의어** 1차(`featureMatches()`) → **결과 0개일 때만** 350ms debounce 후 `POST /api/aimp/feature-search`로 AI 폴백(`aiSearchKeys` state). 서버는 프론트가 넘긴 items:{key,text}로만 판단(기능 정의는 프론트 단일소스). vercel.json 프록시 2줄. placeholder에 자연어 예시 노출("예: 파마하고싶어…")로 사용법 유도.
  - ★모델: text-embedding-004(임베딩) 한국어 짧은검색 변별력0(오답)→claude CLI(정확하나 콜드스타트 4~13초)→**Gemini 2.5 Flash + `thinkingConfig.thinkingBudget:0`**(0.5~2초) 최종. 단순 분류엔 thinking 필히 끔. `getGeminiClient()` 직접 호출·배열은 정규식 파싱(parseAiJson은 객체전용)·`answerCache`.
- **모바일 pull-to-refresh 차단** (`index.css`): `html,body { overscroll-behavior-y: contain }` — 모바일 크롬에서 화면 당겨 새로고침되는 것만 차단, 일반 스크롤은 유지.
- **어드민 메뉴권한 탭 기능 검색창** (`AdminPanel.tsx` MenuLimitsPanel): 차감 기능 17개로 늘어 찾기 어려움 → 검색 state로 이름(한글)/키(marketing) 실시간 필터 + ✕지우기 + 결과없음 안내.

## 2026-07-06 — 토스 자동매매 로그 뷰어 (어드민)

- **KST 표시 변환** (`TossTraderPanel.tsx` `toKstLine()`): 봇 로그(trader.log/orders.log)는 서버1이 UTC로 기록 → 화면 표시만 행 맨 앞 타임스탬프를 KST(+9h)로 변환(원본 파일은 UTC 유지 — 토스 '미등록 IP' 문자 대조법 등 운영 방식 불변). 라벨에 "한국시간" 명시.
- **모바일 스크롤바 항상 표시** (`.toss-log-scroll`): 모바일 브라우저 오버레이 스크롤바가 기본 숨김이라 로그 위치 파악 불가 → `::-webkit-scrollbar` `-webkit-appearance:none`+두께 8px로 강제 표시(파이어폭스 `scrollbar-width:thin` 병행). 인라인 뷰어+전체화면 모달 둘 다 적용. 컴포넌트 내 `<style>` 1블록 패턴.

## 2026-07-15 — 가입 혜택 문구 정비 + 이미지 합성 혼잡 능동 안내

- **가입 혜택 표기 정정**: 실지급(백엔드 `SIGNUP_BONUS=1000`·`MISSION_REWARD=1000`)보다 과소 표기된 **500P 문구 5곳**을 1,000P로 정정(App.tsx 환영알럿·LearnPage·RewardAlertModal 미션 2곳·LandingPageNew ⭐담기 2곳). 회원가입 탭에 "🎁 지금 가입하면 무료 1,000P 즉시 지급" 안내 배지 신설(AuthModal).
- **가입 배너 분기** (`AuthModal.tsx`+`services/referral.ts CHANNEL_CODES`): `?ref` 유입이 마케팅 채널 코드(YOUTUBE 등)면 "🎉 환영해요! 무료 1,000P" 배너, 실제 친구 추천코드면 기존 "친구가 초대했어요"(양방향 1,000P) 배너. 유튜브 숏츠 QR 유입에 친구초대 문구가 뜨던 오용 해소.

## 2026-07-20 — 로고 리브랜딩(AI놀이터) + PWA 설치 플로팅 버튼

- **로고 교체**(`MainPageNew.tsx`+`index.html`+`manifest.json`, `2d5669c`): Ploppy→AI 놀이터.
  사장 목업(로봇+미끄럼틀 종이음각 이미지)을 logo-maker 스킬(gemini-2.5-flash-image)로 재현,
  Artifact 3변형 제시 후 세로 락업 선택. **락업 전체(텍스트 포함)를 헤더 좁은 자리에 그대로
  못 씀** → 헤더는 아이콘만 크롭+별도 텍스트("AI" 코랄#E8836B/"놀이터" 민트#6DBFA0), 파비콘·
  PWA·공유이미지는 락업 계열. ★파비콘 512px 미리보기만 보고 확정했다가 실제 32px에서 뭉개짐
  실측 → 로봇 마스코트만 단독 재생성(장식 요소 제외)해 해결. `public/brand/`에 원본 보존.
- **PWA 설치 플로팅 버튼**(`InstallBanner.tsx`+`index.tsx`, `9e33ee4`·`15aedd9`): 상시 노출
  버튼, 기기 자동감지(카카오·네이버 인앱→외부브라우저 유도/iOS Safari 3단계 텍스트/안드로이드
  네이티브 프롬프트/PC 주소창 안내). ★기존 컴포넌트가 07-06부터 어디서도 안 쓰이던 죽은
  코드였음(되살려 완성). PC 안내는 사장 피드백으로 텍스트→실제 주소창 흉내낸 CSS 일러스트
  (설치아이콘 보라색 링+펄스 강조)로 보강, 크롬/엣지/파이어폭스 UA 분기.
- 상세 노하우=memory/project_ainoliteo_logo_rebrand.md, memory/project_pwa_install_fab.md.
  logo-maker 스킬(SKILL.md)에 "파비콘 32px 실측 필수" 교훈 반영 완료.
- **이미지 합성 3종 혼잡 능동 안내** (HairStyleBoard·AgeTransformBoard·OutfitBoard): 사진을 첨부한 상태에서 서버 혼잡(imageGenBusy)이면 실행 버튼 위에 호박색 배너("약 N초 뒤 자동 해제·사진 유지·대기 중 무과금") + 버튼 비활성("⏳ 대기 중") 통일. 상태 파생 선언 렌더(`preview && busy && !running`)라 혼잡 해제 시 자동 소멸 — 기존 15초 폴링·신호등·503 무과금 로직 재사용(백엔드 무수정). ★대상은 나노바나나 공유 3종뿐 — 관상·손금·닮은꼴은 분석 모델이라 혼잡 신호 없음.
- **가입 화면 정리(2026-07-28, 사장 지적 연속)**: ⑴기본탭 이메일→**휴대전화**(문자 인증이 이메일보다 빠르고, 메일함을 열러 나갔다가 안 돌아오는 이탈이 없다). ⑵**카카오 로그인이 화면 밖으로 밀려 스크롤해야 보였다** — 소셜 로그인은 가려지면 안 되는 진입점이다. 해소 2단: 폼 패딩·간격 압축(`p-6`→`px-6 py-4`, `space-y-4`→`3`, input `py-3`→`2.5`, 혜택배너 축소) + **전체화면 '돌아가기'를 좌측 상단 원형 아이콘으로**(한 줄을 통째로 차지해 폼을 아래로 밀고 있었다, 하단 `pb-16`→`py-4`). 1110×690(PC)·414×667(작은 폰) 모두 카카오 버튼이 뷰포트 안에 들어옴을 실측.
  - ※'닫기(X)'가 아니라 화살표인 이유: 이 화면은 모달이 아니라 **전체 화면**이라 닫는 게 아니라 메인으로 '돌아가는' 것이고, 프로젝트 뒤로가기 패턴(헤더 내 원형 아이콘 버튼)과도 맞다. 동작(`onBack → goTo('main')`)은 그대로.
  - ★**작업 중 JSX 블록을 스크립트로 옮기다 파일을 두 번 깨뜨렸다**(중괄호 짝 불일치 / 삼항 연산자 `) : (` 자리에 JSX 주석). 구조를 읽지 않고 기계적으로 자르면 안 된다 — 되돌린 뒤 **구조는 그대로 두고 속성만 바꾸는** 방식으로 성공했다.

## 채팅 헤더 정리 — 홈 버튼 명확화 + 최근 페르소나 칩 제거 (2026-07-29, 사장 지적)

**① 홈 버튼** — "버튼처럼 보이지도 않고 너무 작다". 세 가지가 겹쳐 있었다:
- **아이콘만 있고 글자가 없음** → 처음 온 사람은 한 번 더 생각해야 한다.
  `title` 속성에 설명이 있었지만 **모바일에서는 안 보인다**. → "홈" 글자 추가.
- **명도 대비 부족** → 배경 `#F5E6F7`과 흰 헤더의 차이가 거의 없어 "눌리는 것"으로 안 읽혔다.
  → `#EBD9F5` 배경 / `#C9A8E0` 테두리(1.5px) / `#6B4A96` 글자로 대비 확보.
- **터치 영역 32px** → 모바일 권장 44px 미달. → `min-h-[44px]`(실측 66×44).

**② 최근 페르소나 빠른 전환 칩 제거** (`App.tsx` 채팅 헤더 아래)
원래 '사이드바 대체'로 넣었으나 제거 판단:
- 헤더 아래 **약 44px을 상시 차지**해 모바일 대화 영역을 잠식(채팅은 대화가 주인공).
- 칩에 여러 페르소나가 나열돼 **지금 대화 중인 사람과 시선이 분산**된다.
- 같은 날 홈 버튼을 크게 고쳐 **역할이 겹쳤다** — 홈에서 14명 전체를 보고 고르면 된다.
- ★`rememberLastPersona` **기록은 유지**: 나중에 '이어서 대화'류를 되살릴 때 그 시점부터
  이력이 비면 곤란하다. **화면에 보이느냐(표시)와 데이터를 쌓느냐(수집)는 별개 문제.**
- 참고: `recentPersonas`는 `MainPageNew`로 전달되지만 **그 컴포넌트에서 렌더에 쓰이지 않는다**
  (사용 0건, 2026-07-29 확인). 죽은 배선이라 주석으로 표시만 해둠.

**검증**: 운영 URL에서 홈 버튼 66×44px·텍스트 "홈" 확인, 최근 이력 4건을 심어두고도
칩 0개 확인(제거 완료). 빌드 통과와 별개로 **실제 렌더를 눈으로** 봤다.
