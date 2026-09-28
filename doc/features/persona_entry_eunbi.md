# 신은비 진입화면 — "웹툰 은비" (2026-09-28)

도결·서아·윤채린·이아린·설아·윤채원·유나·강지훈에 이은 **아홉 번째 페르소나 진입화면**.

- 컴포넌트: `frontend/components/persona/EunbiEntry.tsx` (+ `EunbiEntry.test.tsx`)
- 분기: `frontend/components/PersonaEntrySheet.tsx` 한 블록
  `if (guide.title?.startsWith('신은비') && !guide.autoRunFeatureKey) return <EunbiEntry .../>`
- 자산: `public/eunbi/` — `hero_eunbi_loop.mp4`(6초 반복, 720x1280, 2.06MB) · `hero_eunbi_916.jpg`(포스터) ·
  `hero_bg.jpg` · `webtoon_teaser.jpg` · `chibi_{hair,outfit,tone,emoji}.jpg`
- 커밋: `b783935`(진입화면) · `fc3e2b5`(비로그인 진입화면) · `7ac32c3`(헤어 문구)
- 작업 폴더(git 밖): `~/eunbi-entry/` — `DEV_SPEC.md`, `DEV_SPEC_GUEST.md`, 이미지·영상 생성 스크립트, 시안 `draft/eunbi-entry.html`

---

## 1. 정체성

**웹툰 그림체의 다정한 친구 / AI놀이터 안내자**(밝은 갈색 머리·핑크 니트).
사장이 첨부한 첫 참고(실사 캐미솔)는 노출이 과해 폐기하고, 두 번째 참고 만화 기준으로 다시 만들었다
(사장 "좀 더 웹툰 느낌"). 얼굴은 참고 이미지를 넣어 Gemini `gemini-3.1-flash-image`로 편집 생성.

## 2. 화면 구성

| 영역 | 내용 |
|---|---|
| 히어로 | Veo 3.1 Fast 6초 영상 반복 + 하트·말풍선 모션 + 스크롤 패럴랙스 |
| 기능 카드 | AI 채팅 · 헤어 체인지 · 프로필 화보 · 스토리/선물/말투/이모티콘(곧 만나요) |
| 웹툰《은비》 | 티저만 — 은비 웹툰은 0편이라 "곧 연재" 토스트 |
| 하단 고정 CTA | "은비와 이야기 시작하기 ♥" |

## 3. 버튼 계약

| 버튼 | 동작 |
|---|---|
| AI 채팅 · 이야기 시작하기 | `onStart()` (인자 없음) |
| 헤어 체인지 | `onFeature('hair')` |
| 프로필 화보 | `onFeature('outfit')` |
| 스토리·선물·말투·이모티콘·웹툰 | 콜백 호출 없음, 화면 안 토스트 |
| ✕ · Escape | `onClose()` |

★웹툰을 `onFeature('webtoon')`으로 보내면 activePersona(=은비)의 웹툰 0편 → 빈 화면. App.tsx 수정 없이는 향기 웹툰으로 못 보내서 토스트로 막았다.
★`autoRunFeatureKey`가 있으면(`?f=luxury` — 은비가 명품 감정의 유일 담당) **기존 기본 시트**를 쓴다. 새 화면엔 명품 감정 버튼이 없다.

## 4. 구현 함정

1. **스크롤은 루트 컨테이너 기준.** 진입화면 루트가 `position:fixed; overflow-y:auto`라 `window.scrollY`는 항상 0이다. 시안(window 기준)을 그대로 옮기면 패럴랙스가 안 움직인다 → ref로 루트 `scrollTop`.
2. **끊김 없는 루프 영상** = Veo에 첫 장면과 마지막 장면을 **같은 그림**으로 준다(`last_frame`은 `image` 필수).
3. **Blender VSE 인코딩**(서버2엔 ffmpeg 없음): 해상도를 `strips.new_movie` **전에** 설정해야 한다. 스트립 생성 시점의 기본 1920x1080 기준으로 fit 배율이 고정돼 검은 테두리·확대가 생긴다.
4. **영상 가장자리 선**: 타원 마스크를 영상이 아니라 **감싼 요소**에 건다 — `radial-gradient(ellipse 50% 50% at 50% 50%, #000 64%, transparent 100%)`.
5. `prefers-reduced-motion`이면 영상·말풍선 순환·패럴랙스를 끈다. 리스너·interval·rAF는 언마운트 때 해제.

## 5. 비로그인 진입화면 (`fc3e2b5`, 전 페르소나 공통)

사장 지시: "진입화면을 무조건 띄워주고, 유료 메뉴 클릭하면 유료 서비스 안내 문구와 회원가입 메뉴."

- 비로그인 페르소나 카드·`?p=<id>` → 로그인 회원과 **같은** 진입화면(`showPersonaGuide`).
- 진입화면 안의 행동 → 진입화면 위(z-95)에 `GuestTrialModal notice`:
  `paid`(💎 유료 서비스) / `free` / `chat`(대화는 무료) / `invite` + **무료 회원가입 버튼 상시**, 1,000P 체험·로그인 유지.
- 무료 판정: `frontend/lib/guestFeatureGate.ts` `GUEST_FREE_FEATURE_KEYS = ['webtoon','lookalike','golf-course']`
  (운영 MenuLimit 실측 0 + 설아 골프 무료 배포). 나머지는 유료. 가격 숫자는 비로그인에 안 보인다(가격 API 401).
- 화면 안에서 직접 서버를 부르는 곳도 게이트: 도결 궁합(`SajuEntry`/`useSajuRunner`), 서아 뉴스데스크.
- 체험 성공 후: 알려진 기능 키면 feature 딥링크, 아니면 그 페르소나로 이어짐.
- 🔴★★**예전 비로그인 `?p=`는 아무것도 안 떴다** — `introVideoModal` JSX가 로그인 return에만 있었다(App.tsx return 3개 함정).
- 🟡Escape는 안내 모달과 진입화면을 **함께** 닫는다. 배경 클릭은 안내만 닫는다.

## 6. 검증

vitest(은비·게스트 게이트·무료 키) · `tsc --noEmit` · `npm run check` · build 통과 후
**운영 Playwright 실클릭**: 비로그인(카드→진입화면→유료 버튼→안내·회원가입 보임→닫기→복귀), 로그인(은비 버튼 전부), 390·1440 가로 스크롤 0, 콘솔 오류 0.

## 7. 남은 것

- 은비 웹툰 연재 시작 시 웹툰 카드 연결(App.tsx `FEATURE_ACTIONS.webtoon`은 activePersona 기준).
- 선물하기 등 "곧 만나요" 기능 — 가격은 사장 결정.
- 명품 감정을 은비에 계속 둘지 사장 결정.
- 닮은꼴·시간여행 설명의 "윤채린" 문구(범위 밖).
