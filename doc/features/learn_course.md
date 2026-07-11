# 📚 학습자료 코스 — AI로 홈페이지 만들기 (2026-07-10)

사장 강의용 학습 콘텐츠이자 회원가입 퍼널. 회원이 AI로 홈페이지 디자인을 만들고 → 다운로드 → 자기 PC 로컬호스트에서 띄우는 것까지 5단계로 따라온다. **무료·회원 전용**(비가입자는 가입 유도창). 정본 메모리=[[project_learn_course]].

## 구조

- **본체**: `/learn/homepage` (및 `/learn`) — `frontend/components/LearnPage.tsx`. App.tsx 얼리리턴 라우트(`IS_LEARN_PAGE`, EmbedChat/ConsultPage 패턴=AppContent 훅 비의존). vercel.json SPA 폴백 2줄.
- **시안 3종**: `public/learn/designs/ochang-{a,b,c}.html` — 오창AI 연구회 예제(사장 박제 확정). 단일 HTML(CSS 인라인·외부 자원 0). `download="index.html"`로 저장됨. 정적파일이라 SPA 폴백보다 파일시스템 우선.
- **진입점 3개**: ①홈 기능카드 `learn`(FEATURES_GRID id22) ②지우 채팅 기능버튼(FEATURE_REGISTRY + DB `Persona.features`=["mathtutor","club","learn"] 정본) ③주소 직접 접속(강의장 QR). 딥링크 `?f=learn`은 featureBoardOpeners.learn이 페이지로 이동.

## 회원 전용 게이트 (가입 퍼널)

- 토큰 없음/무효(`/auth/me` 401) → 가입 유도창(혜택 5+보너스 500P). **네트워크 순단은 열어줌**(강의 중 서버 순단으로 전원 차단 방지).
- CTA → `sessionStorage.afterAuthRedirect='/learn/homepage'` + `/?login=1` → useAuth screen 초기화가 authPage 직행 → 로그인 성공 시 App의 user-감지 useEffect가 자동 복귀(이메일·카카오·모달 전 경로 공통). `?login=1`은 다른 페이지 가입 유도에도 재사용 가능.
- ⚠️ 시안 정적파일 자체는 직접 URL로 열림(게이트 밖) — 실질 우회 위험 낮다고 보고 방치(사장 인지).

## UI 장치 (초보자 배려)

- 데스크톱(lg+)=좌측 sticky 목차+우측 본문 / 모바일=상단 얇은 칩 바. **스크롤 스파이**(IntersectionObserver)로 현재 단계 활성색, 모바일 칩 자동 추적(block:nearest).
- 단계마다: 💡 팁 / **✅ "이게 보이면 성공"**(진행 확인 기준) / **📱 "모바일에서는"**(폰 가능 범위: 1~2단계 폰 OK, 클로드 앱=아티팩트 미리보기로 생성·수정 가능, localhost 단계만 PC).
- 🆘 FAQ 7문(더블클릭=file:// 구분, Live Server 안 보임, 하얀 화면, VS Code 대안, 폰 클로드 앱 등).
- **📖 용어 드래그 툴팁**: GLOSSARY 17어. `selectionchange` 250ms 디바운스 → 셀렉션이 사전과 일치하면 아래 말풍선(뷰포트 클램프·pointer-events:none). 미등록 단어는 무반응.
- 프롬프트는 전부 복사 버튼(CopyBlock, clipboard+execCommand 폴백).

## 📝 학습평가 (합격 기록)

- 10문제×10점=100점. **랜덤 출제**(문제·보기 셔플), 즉시 채점, **오답=해설+같은 문제 재출제**(맞힐 때까지=완전학습), 완주=100점 합격.
- 기록: `POST /api/learn/quiz-record {course:'homepage', score:100}` → 서버1 `LearnQuizRecord`(raw SQL, 최고점 유지+최초 합격일 보존). 저장 실패 시 localStorage 폴백+안내.
- 제목 배지: 미합격 「📖 학습」 / 합격 「✅ 완료」. 목차 학습평가 항목에도 ✅. **다음 코스 잠금해제 근거**(2호 코스 생기면 이 기록으로 게이트).
- 백엔드: shared-api `routes/aimp/learn.ts` (COURSE_KEYS 화이트리스트, JWT 인증). vercel.json `/api/learn/:path*` 프록시.

## 배포·운영 메모

- ai_mp `d2d82cb`(코스)→`94d72ac`(게이트·레이아웃)→`dab5c09`(모바일 안내)→`233188c`(스파이·클로드앱)→`8b5dff3`(툴팁)→`2580ee7`(학습평가). shared-api `ee90dad`.
- ★서버1 shared-api 배포: git pull이 로컬수정(scp 잔재)으로 Abort 가능 → **파일단위 `git checkout origin/main -- <files>`**. pm2는 `~/shared-api/node_modules/.bin/pm2`(PATH에 없음).
- 공지 초안 id20(isVisible=false) — 사장이 어드민 공지 탭에서 노출 토글로 게시.
- **하이브리드 2차(맞춤 시안 생성)=07-10 착수 후 사장 지시로 전면 롤백**(LearnCustomDesign DROP·코드 원복). 재지시 전 착수 금지.

## 확장 방향 (미착수)

- 2호 코스 추가 시: `/learn` 목차 페이지화 + COURSE_KEYS 등록 + 합격 게이트(1호 완료자만 입장).
- 시안 갤러리 확장, 강의장 QR 카드 등.

## 07-11 완성 라운드 (영상·이미지법·설치·왕초보)

- **🎬 강의 영상 5편**(step1~5, 총 4:48, 비용≈0): 대본→TTS(math-tutor-tts)→Playwright 녹화(절대시간 동기)→ffmpeg. **재제작=agent-wiki/common/scripts/learn-video/**(대본 JSON·recorder.cjs·README). 원본 mp4=서버1 `~/learn-videos/`.
- **회원 전용 스트리밍**(공개 GCS 삭제): `GET /api/learn/video-token`(JWT→30분 시청토큰)→`GET /api/learn/video/:step?t=`(Range 206). 프론트=VideoModal 이어보기 플레이리스트(다음 자동재생+칩 점프), 진입=목차 '🎬 전체 영상 보기'만(본문 칩은 사장 지시로 제거). 시청토큰 만료 시 20분 경과 조건부 재발급.
- **2단계 방법② 이미지→홈페이지**: 시안 이미지 생성 프롬프트+손그림 폰카+참고화면(저작권 주의)→첨부+변환 프롬프트(IMAGE_GEN_PROMPT/IMAGE_PROMPT).
- **원클릭 설치**: VS Code=`update.code.visualstudio.com/latest/{win32-x64-user|darwin-universal}/stable`(공식 '항상 최신', ★sha/download 맥 경로는 404). OS 자동감지+노트북/데스크탑 무구분 안내. Claude Code=버튼 클릭→설치 명령 자동복사(Win irm/Mac curl)+PowerShell 3단계 안내(ClaudeCodeInstall).
- **왕초보 보강 4종**: 확장자 보이게 하기·PowerShell 경고 안심·백틱 위치·다운로드 폴더 찾기(+FAQ 1문). 보류=0단계 AI계정·진행 체크박스·용어 밑줄·실화면 스크린샷(사장 캡처 협업).
