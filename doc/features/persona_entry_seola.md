# 설아 진입화면 — 새벽 티하우스 (2026-09-18)

설아 페르소나의 스윙 분석과 골프장 탐색을 처음 진입할 때 한 흐름으로 보여주는 전용 랜딩이다.

- 컴포넌트: `frontend/components/persona/SeolaGolfEntry.tsx`
- 분기: `frontend/components/PersonaEntrySheet.tsx`의 `startsWith('설아')`
- 자산: `public/seola/putt-{desktop,mobile}-v3.png`, `public/seola/celebrate-{desktop,mobile}-v3.png`
- 계약 테스트: `frontend/components/persona/SeolaGolfEntry.test.tsx`

## 동작 계약

- `내 스윙 점검하기`, `스윙 분석 시작` → `onFeature('swing')`로 기존 업로드·분석 화면을 연다.
- `오늘의 코스 찾기`, `코스 찾아보기` → `onFeature('golf-course')`로 기존 골프장 탐색 화면을 연다.
- `설아와 대화하기` → `onStart()`로 기존 채팅에 들어간다.
- 닫기와 `Escape` → `onClose()`로 원래 화면에 돌아간다.
- 새 API·DB·과금 경로를 만들지 않는다.

## 화면과 접근성

- 메인에 한국인 성인 여성 골퍼의 퍼팅 준비 장면을 먼저 보여준 뒤, 0.9초 후 골프 게임 형태의 별도 퍼팅 모달을 띄운다.
- 게임 모달은 원본 이미지 비율을 고정하고 공과 홀컵 중심을 같은 좌표계로 계산한다. 공이 홀컵으로 한 번 굴러 들어가면 모달이 자동으로 닫힌다.
- 뒤의 메인 화면은 같은 인물이 성공을 기뻐하는 장면으로 바뀐 채 반복 없이 정지한다.
- 데스크톱과 모바일에 각각 별도 구도의 `<picture>` 자산을 제공해 단순 크롭으로 인물·홀컵이 잘리지 않게 한다.
- `prefers-reduced-motion: reduce`에서는 퍼팅 인트로를 즉시 건너뛰고 성공 정지 화면을 표시한다.
- 스윙 리포트 수치와 코칭 문구는 모두 `[예시]`이며 실제 분석 결과가 아니다.
- 공개 데이터에 없는 평점 숫자·확정 가격은 표시하지 않고 예약 대행을 주장하지 않는다.
- 데스크톱은 양단 구성, 모바일은 단일 열로 바뀌며 키보드 포커스와 `aria-pressed`를 제공한다.

## 배포 경계

제품 코드 통합 상태를 설명한다. 커밋·푸시·운영 배포는 별도 승인 전까지 하지 않는다.
