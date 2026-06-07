# 손금(手相) 분석 — 도결 선생 퀵메뉴

도결(道潔) 선생 채팅의 손금 분석 기능. 관상(face) 패턴을 복제해 추가(2026-06-07).

## 흐름
1. 도결 채팅 상단 기능칩 **🖐 손금** 클릭 → `PalmReadingModal` 오픈
2. **왼손/오른손 선택** (기본 오른손) — 왼손=선천운(타고난 운명), 오른손=후천운(만들어가는 운). 화면 안내 + 분석 프롬프트 양쪽 반영
3. 사진 업로드(갤러리/카메라 `capture=environment`) → "🖐 손금 분석 시작"
4. 결과 카드(`PalmReadingResultCard`): 생명선·두뇌선·감정선·운명선·재물결혼·총평 + 조언. 이미지 저장 가능

## 포인트 (관상과 동일)
- `menuAccess` feature key `palm` — menuLimit 정책 없으면 **기본 50P 자동 차감**
- `deductMenuPoints(... '손금 분석')`

## 사진 선명도 검사 (관상에 없는 차별점)
- gemini 프롬프트가 손금선 판독 불가 시 `{unclear:true}`만 반환하도록 지시
- `palm-reading.ts`: `unclear || !lifeLine`이면 → **저장 안 함 + `refundMenuPoints`로 50P 환불 + HTTP 422**(message로 재촬영 안내)
- 프론트 `palmReadingApi.analyze`는 422를 에러가 아닌 `{ok:false, message}` 정상분기로 반환 → 모달 유지하고 안내 표시(이동/저장 안 함). 일반 post 헬퍼는 422를 throw하므로 직접 fetch 사용

## 파일
- 백엔드: `shared-api/lib/gemini.ts`(analyzePalmReading, PalmReadingResult), `shared-api/routes/aimp/palm-reading.ts`, `routes/aimp/index.ts`(라우트 등록), `vercel.json`(rewrite)
- 프론트: `frontend/components/PalmReadingModal.tsx`, `PalmReadingResultCard.tsx`, `services/apiService.ts`(palmReadingApi), `hooks/useQuickMenu.ts`(palm 상태), `App.tsx`(palmModal 트리거+렌더)
- DB: `Persona.quickMenuJson`에 `{label:"🖐 손금", featured:true, palmModal:true}` (정본=서버1 DB, 복원 스냅샷 `backups/persona-quickmenu/dogyeol.json`)

## 이미지 기반 퀵메뉴 추가 레시피
관상/손금처럼 사진 업로드형 퀵메뉴 추가 시: ①quickMenuJson에 `xxxModal:true` 플래그 ②프론트 Modal+ResultCard ③App에 플래그 트리거+상태(useQuickMenu) ④백엔드 analyzeXxx+라우트+vercel rewrite ⑤menuAccess key(기본 50P) ⑥필요시 선명도검사+환불.
