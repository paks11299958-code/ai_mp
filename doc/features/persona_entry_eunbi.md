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

## 7. 선물하기 (2026-09-28, `a17162a`·`a364162`)

- 기존 스타 선물 재사용(서버 무수정). 커피·케이크·꽃다발·곰인형·특별한 선물(10~1,000P).
- 선물 → 히어로 자리에서 반응 영상(Veo 3.1 Fast 6초, **첫·끝 장면 = 히어로 정지화면**): 윙크·볼 감싸기·손하트(머리 위 큰 하트)·빙그르르 춤.
  손가락 하트·팔 흔드는 춤은 손이 뭉개져 탈락. 영상 `public/eunbi/eunbi_gift_*.mp4`, 원본·스크립트 `~/eunbi-entry/gift/`.
- 호감도 게이지 + 보상: Lv2 이름 인사, Lv3 손하트 배경화면, Lv4 비밀 대사+볼하트 배경화면, Lv5 반응 영상 다시 보기, Lv6 웹툰 비밀 에피소드(잠김).
- App.tsx `gift` 컨텍스트(`EntryGiftContext`): 잔액·personaXp 갱신, 부족 시 진입화면 닫고 PointModal(z-70이라 진입화면 뒤에 숨음).
- 🔴히어로 영상이 Blender AgX 색 변환으로 바래 있었다 → `view_transform='Standard'` 재인코딩 `hero_eunbi_loop_v2.mp4`(옛 파일 유지).
- 운영 실측: 연타해도 결제 1회, -10P, 호감도 +2, 영상 재생→복귀.

## 8. 축하 카드 (2026-09-28, shared-api `a7860e0`·`9c9c6a3` / ai_mp `640e72c`·`31758e6`)

- 상황 5종 미리 만든 은비 그림(`public/eunbi/card_*.jpg`, Gemini 편집 생성, 원본 `~/eunbi-entry/card/`) + Gemini 문구.
- 보내는 화면(은비 진입화면 💌 섹션): 이름 10자·사연 60자 글자 수 표시, 금지어 즉시 경고, 오늘 무료/100P, 카톡 공유(navigator.share)·링크 복사·미리 보기.
- 받는 화면 `/c/:id` = Vercel `api/card-share.ts` 가 **서버 HTML**(OG 미리보기 + 봉투→카드→빛→상황별 캔버스 효과→손글씨 타이핑). SPA·App.tsx 무관. XSS: esc + scriptJson + textContent.
- 서버 `routes/aimp/eunbi-card.ts`(POST·/quota·/public/:id), 금지어 `lib/eunbiCardFilter.ts`, DB `EunbiCard`(db_schema.md), 가격 points_payment.md.
- 비로그인: 카드 버튼 → 무료 안내+회원가입 게이트.

## 9. 채팅 감정 사진 + 진입화면 채팅 모달 (2026-09-29)

- **감정 사진 10종**(`public/eunbi/emo/{greeting,happy,shy,love,sad,surprised,pout,cheer,thinking,sleepy}.jpg`, 600x800): greeting=진입화면 원본, 9장 gemini-3.1-flash-image 원본 참조 편집(`~/eunbi-entry/emo/gen_emotions.py`, ~$0.6). 프로필·채팅 메인도 웹툰 이미지로 교체, '라면' 트리거 영상 삭제(백업 `~/eunbi-entry/removed_20260929/`).
- **판정**: 답장 완료 → `POST /api/persona-emotion`(shared-api, gemini-2.5-flash-lite thinking0 + enum 스키마, 실패=null, 시간당 60회) → 사진 교체. 인사말(role `assistant`)은 AI 없이 greeting. 프론트 `lib/personaEmotion.ts`·`hooks/usePersonaEmotion.ts`(`emotionSeq`=연출 재생 순번). ★`vercel.json` rewrite 필수(처음 누락 → 404).
- 표시: PC 왼쪽 패널·모바일 헤더·홈 아래 갤러리 메인 칸(`PersonaImageViewer` `mainOverrideUrl`)·확대 모달.
- **진입화면 채팅 모달**(`components/persona/EntryChatModal.tsx`, 테마 `lib/entryChatThemes.ts`): "이야기 시작하기" → 진입화면 위 모달(모바일 바텀시트·PC 480px). 초상 무대(감정 크로스페이드·숨쉬기·보케) + 감정별 연출 10종, 말풍선 스프링·지문 기울임·하트 입력 중·보내기 버스트. 채팅은 App `handleSendMessage(overrideText?)` 재사용(차감·가드 그대로). 다른 페르소나 = 테마 추가.
  - 🔴 메인 보내기 버튼에 `onClick={handleSendMessage}` 직결 금지(이벤트가 글로 들어감, `appSendButton.test.ts`).
  - 🔴 좁은 폭(Z Fold4 커버 344px)·글자 확대에서 오른쪽 잘림 → 격자 `minmax(0,1fr)`+textarea `min-width:0`(`e3cb278`). 검수는 320·344·360 × 글자 1.3~1.6배.

## 10. 남은 것

- 은비 웹툰 연재 시작 시 웹툰 카드 연결(App.tsx `FEATURE_ACTIONS.webtoon`은 activePersona 기준).
- ✅명품 감정은 2026-09-28 이아린으로 이관(`2f1d141`, DB features도 변경). 은비 담당 기능 없음.
- 닮은꼴·시간여행 설명의 "윤채린" 문구(범위 밖).
