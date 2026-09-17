# 강지훈 진입화면 — 별빛 책방 (2026-09-17)

강지훈 페르소나의 전자책 제작 정체성을 처음 진입할 때 보여주는 전용 랜딩이다.

- 컴포넌트: `frontend/components/persona/JihoonBookEntry.tsx`
- 분기: `frontend/components/PersonaEntrySheet.tsx`의 `startsWith('강지훈')`
- 자산: `public/jihoon/starlit-book-studio-v1.png`
- 계약 테스트: `frontend/components/persona/JihoonBookEntry.test.tsx`
- 공통 복귀 테스트: `frontend/components/persona/entryReturn.test.ts`

## 동작 계약

- `내 책 구상하기`, `이 목차로 시작하기` → `onFeature('ebook')`로 기존 `EbookBoard`를 연다.
- `강지훈과 대화하기` → `onStart()`로 기존 채팅에 들어간다.
- 닫기 버튼과 `Escape` → `onClose()`로 원래 화면에 돌아간다.
- 새 API·DB·과금 로직은 만들지 않는다. 전자책 제작과 과금은 기존 `ebook` 경로가 담당한다.

## 화면과 접근성

- 승인 시안의 `별빛 책방 · 편집 · 인쇄 작업실` 구성을 제품 코드로 옮겼다.
- 예시 주제 세 개는 실제 생성 없이 목차 미리보기만 바꾼다. 선택 전에는 저장하거나 외부로 전송하지 않는다.
- 데스크톱에서는 펜던트와 책장 조명이 6.4초 주기로 밝아졌다 어두워진다.
- 모바일에서는 조명 반복을 끄고, `prefers-reduced-motion: reduce`에서도 정지 상태를 유지한다.
- 키보드 포커스 표시, 버튼 이름, `aria-pressed`, dialog/heading 관계를 제공한다.

## 검증

- 계약 테스트 5개 + 공통 진입/복귀 테스트 32개 통과.
- 전체 프런트 Vitest 통과.
- React 안전 검사 161개 파일, TypeScript `--noEmit`, Vite 제품 빌드 통과.
- Chromium 데스크톱 1280x844·모바일 390x844·모션 감소 환경에서 제목, 이미지,
  가로 넘침, 콘솔 오류, 조명 정책, 예시 변경, `ebook` 연결을 확인했다(15/15).

## 배포 경계

이 문서는 서버2 제품 코드 반영 상태를 설명한다. 커밋·푸시·운영 배포는 별도 승인 전까지 하지 않는다.
