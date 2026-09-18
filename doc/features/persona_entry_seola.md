# 설아 진입화면 — 새벽 티하우스 (2026-09-18)

설아 페르소나의 스윙 분석과 골프장 탐색을 처음 진입할 때 한 흐름으로 보여주는 전용 랜딩이다.

- 컴포넌트: `frontend/components/persona/SeolaGolfEntry.tsx`
- 분기: `frontend/components/PersonaEntrySheet.tsx`의 `startsWith('설아')`
- 자산: `public/seola/summer-putt-hero-v2.png`
- 계약 테스트: `frontend/components/persona/SeolaGolfEntry.test.tsx`

## 동작 계약

- `내 스윙 점검하기`, `스윙 분석 시작` → `onFeature('swing')`로 기존 업로드·분석 화면을 연다.
- `오늘의 코스 찾기`, `코스 찾아보기` → `onFeature('golf-course')`로 기존 골프장 탐색 화면을 연다.
- `설아와 대화하기` → `onStart()`로 기존 채팅에 들어간다.
- 닫기와 `Escape` → `onClose()`로 원래 화면에 돌아간다.
- 새 API·DB·과금 경로를 만들지 않는다.

## 화면과 접근성

- 성인 여성 골퍼의 여름 퍼팅 장면 위에서 공이 홀컵으로 굴러 들어가는 7초 반복 모션을 제공한다.
- `prefers-reduced-motion: reduce`에서는 조명·공·홀컵 애니메이션을 정지한다.
- 스윙 리포트 수치와 코칭 문구는 모두 `[예시]`이며 실제 분석 결과가 아니다.
- 공개 데이터에 없는 평점 숫자·확정 가격은 표시하지 않고 예약 대행을 주장하지 않는다.
- 데스크톱은 양단 구성, 모바일은 단일 열로 바뀌며 키보드 포커스와 `aria-pressed`를 제공한다.

## 배포 경계

제품 코드 통합 상태를 설명한다. 커밋·푸시·운영 배포는 별도 승인 전까지 하지 않는다.
