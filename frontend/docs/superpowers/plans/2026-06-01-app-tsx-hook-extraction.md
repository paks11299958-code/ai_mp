# App.tsx 훅 분해 (#1) 구현 계획

작성: 2026-06-01 / 기반: `~/architecture-review-frontend.md` #1 섹션 + 핸드오프 `/tmp/claude-1000/handoff-ai_mp-frontend-refactor.md`

## 목표

`App.tsx`(2140줄, **71 useState / 14 useEffect**)의 융합된 상태/효과/핸들러를 **커스텀 훅으로 점진 추출**해, 각 관심사를 독립 테스트·재사용 가능하게 만든다. **동작 변경 0** (순수 리팩토링). 본체 `AppContent`는 훅 조립 + 레이아웃 렌더만 남기는 것이 종착지.

### 핵심 위험 (커밋에 안 드러나는 맥락)
- App.tsx는 진입 분기 로직(`parseBirthInfo`, kakao_code 처리, `mainFocusPersonaId`/`resetToken` localStorage 부트스트랩)이 얽혀 있음 → **lazy init useState 순서·타이밍 보존 필수**.
- UI 결합부는 vitest 불가. **유일 안전망 = tsc 0 + vite build 통과 + 사용자 실제 화면 확인**.
- **각 훅 추출 = 1 커밋 = 즉시 빌드검증**. 절대 여러 훅을 한 커밋에 묶지 않는다(롤백 단위 보존).
- 새 훅은 `frontend/hooks/`에 배치(없으면 생성). 순수 헬퍼는 `utils/`로 빼서 vitest 작성.

## DB 변경사항
없음 (프론트 전용).

## API 변경사항
없음 (apiService 호출 시그니처 불변. #2는 별도 후보).

## 프론트엔드 변경사항 — 상태 클러스터 → 훅 매핑

App.tsx 실측 기준 71개 useState를 6개 클러스터로 분류:

| 클러스터 | 대표 상태 (App.tsx 라인) | 추출 대상 훅 | 위험도 |
|---|---|---|---|
| **인증/진입** | user, isAuthChecking, showAuthModal, kakaoNicknameModal, showAuthPage, showMain, showHero (L59–72) + auth useEffect(L78) | `useAuth()` | 중 (kakao/resetToken 타이밍) |
| **결제** | pendingPayment, paymentSuccess (L112–123) + 결제 redirect effect | `usePayment()` | 낮 (자족적) |
| **페르소나/세션** | personas, isPersonasLoading, activePersonaId, sessions, sessionTyping, messages, firstChatMap, personaImages, memoryEnabled (L126–186) + handleSelectPersona/handleSendMessage/triggerSummaryUpdate/handleLoadMoreMessages | `usePersonaSession()` | **높음 (최대·최복잡)** |
| **퀵메뉴/입력** | birthInfo, showBirthModal, pendingQuickMenu, quickMenuResult/Loading, inputPlaceholder, activeQuickMenu, pendingPartnerMenu, faceReadingResult, subMenuConfig, inputText (L161, 199–210) + triggerQuickMenu/handleSubItem | `useQuickMenu()` | 중 |
| **보드/모달 토글** | showBoard, showStockAnalysis, showResearch, showUsedItem, showLuxuryBoard, showTodayNews, showGolfReserve, showSwingBoard, showMathTutor, showClubBoard 등 ~15개 boolean (L163–196) | `useBoardToggles()` | 낮 (단순 boolean 묶음) |
| **공지/UI잡상태** | announcements, showAnnouncementModal, readAnnouncementIds, showHeaderMenu, isSidebarOpen/Collapsed, chatBgSelected (L159–227) | `useAnnouncements()` + 잔여는 본체 유지 | 낮 |

> **공유 상태 주의**(#6 교훈 재적용): `personas`/`categories`/`activePersonaId`는 여러 클러스터·자식이 공유 → 소유권을 한 훅에 두고 나머지엔 값/세터 주입. 무리하게 다 떼지 말 것.

## 태스크 체크리스트 (난이도 오름차순 — 저위험부터)

각 태스크 = 독립 커밋. 완료 정의(DoD): `npx tsc --noEmit` 0 + `npm run build` 통과 + `npm test` 19 유지 + **소스만 add(dist 제외)**.

- [x] **T0. 준비** — `hooks/` 디렉터리 생성. 베이스라인 `tsc 0 / vitest 19 / build OK` 확인. ✅ (커밋 `01339df`에 포함)
- [x] **T1. usePayment() 추출** — pendingPayment/paymentSuccess + 결제 redirect effect 이동. 본체는 `const { paymentSuccess } = usePayment(...)`만. ✅ `01339df`
- [x] **T2. useBoardToggles() 추출** — 15개 기능 보드/다이얼로그 show* boolean 묶음. 본체 구조분해로 호출부 변경 0. ✅ `c47d558`
- [x] **T3. useAnnouncements() 추출** — announcements/readAnnouncementIds + fetch effect + handleReadAnnouncements + localStorage 직렬화. ✅ `30b9b07`
- [x] **T4. useAuth() 추출** — user/isAuthChecking/show 진입플래그/kakaoNicknameModal + 카카오 콜백 effect + 토큰 자동로그인 effect(공유 mount effect에서 분리, deps 동일) + handleAuthSuccess/handleLogout. handleAdminLogin은 isAdminMode 의존이라 본체 유지. ✅ `a3e43cb` ⚠️ **로그인 동선 사용자 확인 대기**.
- [x] **T5. useQuickMenu() 추출 (상태만)** — birthInfo/quickMenu*/face/subMenu/partner 12개 state + birthInfo 로드·자동모달 effect + birthModalSkippedRef. triggerQuickMenu/handleSubItem/모달 핸들러는 sessions·inputText 결합이라 본체 유지(T6에서 정리). ✅ `2597f25` ⚠️ **퀵메뉴 동선 사용자 확인 대기**.
- [ ] **T6. usePersonaSession() 추출** (최대·최위험, 마지막) — personas/sessions/messages/activePersonaId 등 + handleSelectPersona/handleSendMessage/triggerSummaryUpdate/handleLoadMoreMessages **+ T5에서 본체에 남긴 퀵메뉴 핸들러(sessions/inputText 의존)도 함께 정리**. **먼저 하위 분해 미니플랜 권장**. 커밋 + 사용자 채팅 동선 확인.
- [ ] **T7. 정리** — 본체 AppContent가 훅 조립 위주인지 확인. 추출 과정서 나온 순수함수 `utils/*.test.ts` 보강. work_index/메모리/핸드오프 갱신.

### 진행 현황 (2026-06-01 기준)
- **App.tsx 2140→2032줄 (-108), useState 71→31 (-40), useEffect 14→9 (-5).**
- 추출 완료 훅: `hooks/usePayment.ts` `useBoardToggles.ts` `useAnnouncements.ts` `useAuth.ts` `useQuickMenu.ts`.
- 전 단계 공통 검증: tsc 0 / vitest 19 / vite build 통과, dist 제외 소스만 커밋, master 푸시.

## 별도 정리 후보 (이 계획 밖, 잊지 말 것)
- **dist git 추적 제거**: `.gitignore`에 `frontend/dist` + `git rm -r --cached frontend/dist`. (핸드오프 4번)
- #4 prop drilling 컨텍스트화 / #5 모달 컨텍스트 → T6 이후 자연스럽게 이어짐.

## 다음 단계
계획 확정 후 `/superpowers-executing-plans`로 T0부터 순차 실행. T6 착수 직전 미니플랜 1회 더.

---

## T6 미니플랜 — usePersonaSession 단계 분해 (2026-06-01 작성)

### 조사 결과 (커밋 전 정밀 grep)
- `sessions`/`setSessions`·`activePersonaId` 참조 80+곳. 핸들러 4개 + 순수 세션 헬퍼 3개.
- **순수 세션 뮤테이터(외부 의존 0, `[]` 콜백)**: `addMessageToSession`/`updateMessageInSession`/`setSessionTyping` (App.tsx 729–756). → 가장 안전한 코어.
- **handleSelectPersona**(284–345, deps `[sessions]`): sessionApi.getAll/get + greet + triggerSummaryUpdate 호출. `setInputPlaceholder`/`setActiveQuickMenu`(quickMenu setter) 사용.
- **handleLoadMoreMessages**(375–397, deps `[sessions, activePersonaId]`): 순수 세션.
- **triggerSummaryUpdate**(400–414): 순수 세션(sessionApi.summarize).
- **handleSendMessage**(553–669, ~117줄): **최대 결합** — sessions + inputText/textareaRef + **포인트 setter+setLevelUpInfo(PointsContext)** + **setUser(auth)** + setActiveQuickMenu(quickMenu) + isMemoryOn/memoryEnabled + triggerSummaryUpdate + firstChatMap.
- **triggerQuickMenu**(417–437, T5 잔류): sessions 의존.
- **persona→session 동기화 effect**(247–259): sessions+activePersonaId.

### 단계 (저결합→고결합, 각 1커밋·tsc0/vitest19/build·dist제외)
- [ ] **T6a. 순수 세션 코어 추출** — `usePersonaSession` 신설: `sessions`/`setSessions` + `addMessageToSession`/`updateMessageInSession`/`setSessionTyping` + persona-sync effect(activePersonaId 인자 주입). `activePersonaId`는 **본체 유지**(persona 관심사, 여러 훅이 인자로 받음). 본체는 구조분해. handleSendMessage 등은 본체에 남겨 훅이 노출한 setter/헬퍼 호출.
- [ ] **T6b. 순수 세션 핸들러 이동** — handleLoadMoreMessages + triggerSummaryUpdate를 훅으로(둘 다 sessions만 의존). handleSelectPersona는 quickMenu setter(setInputPlaceholder/setActiveQuickMenu) 의존 → setter 2개 주입받아 훅으로.
- [ ] **T6c. handleSendMessage/triggerQuickMenu 정리** — 최대 결합. 옵션: (i) 훅에 의존성 대량 주입(포인트/setUser/quickMenu setter), (ii) **본체 유지하고 훅의 세션 헬퍼만 호출**(권장—주입 폭발 회피). T6c 착수 시 재판단. T5 잔류 퀵메뉴 모달 핸들러도 이때 함께 검토.
- ⚠️ **각 단계 후 채팅 동선 사용자 확인 권장**(메시지 전송/스트리밍/요약/페르소나 전환). 순수 이동이나 결합도 높음.
