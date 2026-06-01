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

- [ ] **T0. 준비** — `hooks/` 디렉터리 생성. 베이스라인 기록: `tsc 0 / vitest 19 / build OK` 재확인. App.tsx 현재 줄수 스냅샷.
- [ ] **T1. usePayment() 추출** (가장 자족적, 워밍업) — pendingPayment/paymentSuccess + 결제 redirect effect 이동. 본체는 `const { paymentSuccess } = usePayment()`만. 커밋.
- [ ] **T2. useBoardToggles() 추출** — ~15개 show* boolean을 하나의 훅으로(개별 setter 유지 or `open(type)/close(type)` API). 가장 기계적. 커밋.
- [ ] **T3. useAnnouncements() 추출** — announcements/readAnnouncementIds + fetch effect + handleReadAnnouncements + localStorage 직렬화. 커밋.
- [ ] **T4. useAuth() 추출** — user/isAuthChecking/showAuthModal/kakaoNicknameModal + auth check effect + handleAuthSuccess/handleLogout/handleAdminLogin + **kakao_code·resetToken 부트스트랩**. ⚠️ lazy init 순서 보존. 커밋 + **사용자 로그인 동선 확인 요청**.
- [ ] **T5. useQuickMenu() 추출** — birthInfo/quickMenu*/face/subMenu/inputPlaceholder + triggerQuickMenu/handleSubItem/parseBirthInfo. 커밋.
- [ ] **T6. usePersonaSession() 추출** (최대·최위험, 마지막) — personas/sessions/messages/activePersonaId 등 + handleSelectPersona/handleSendMessage/triggerSummaryUpdate/handleLoadMoreMessages. **먼저 하위 분해 재계획** 후 착수(이 태스크만 별도 미니플랜 권장). 커밋 + 사용자 채팅 동선 확인.
- [ ] **T7. 정리** — 본체 AppContent가 훅 조립 위주인지 확인. 추출 과정서 나온 순수함수(parseBirthInfo 등) `utils/*.test.ts` 보강. work_index/메모리/핸드오프 갱신.

## 별도 정리 후보 (이 계획 밖, 잊지 말 것)
- **dist git 추적 제거**: `.gitignore`에 `frontend/dist` + `git rm -r --cached frontend/dist`. (핸드오프 4번)
- #4 prop drilling 컨텍스트화 / #5 모달 컨텍스트 → T6 이후 자연스럽게 이어짐.

## 다음 단계
계획 확정 후 `/superpowers-executing-plans`로 T0부터 순차 실행. T6 착수 직전 미니플랜 1회 더.
