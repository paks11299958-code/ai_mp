# 🔌 페르소나 임베드 위젯

> 2026-07-06 1단계. 외부 사이트에서 페르소나 채팅(게스트 체험→가입 유입). 전 페르소나 공용.

## 사용법 (제휴 사이트에 한 줄)
```html
<script src="https://aichat.dbzone.kr/widget.js" data-persona="유나" data-color="#8E6FB7" async></script>
```
→ 우하단 💬 플로팅 버튼 → iframe 모달(`/?embed=<이름|id>`). 데모: `/sites/widget-demo/`.

## 구조
- **widget.js**: ★`ai_mp/public/`(Vite publicDir=레포 루트 — frontend/public 아님).
- **?embed 모드**: App 래퍼에서 얼리리턴(AppContent 훅 진입 전) → `EmbedChat` 슬림 화면.
- **게스트**: `/api/aimp/embed/chat` — 무료 3회/일(DAILY_FREE), guestId(localStorage)+IP 이중 제한
  (`EmbedGuestLog`), **지식창고 pgvector 주입**(체험도 전문가답게), gemini-2.5-flash thinking off,
  4문장 제한, 세션 미저장(클라이언트가 직전 6개 전송). 소진→"무료로 시작하기" CTA(?p 딥링크).
- **회원**: iframe 안 로그인(서드파티 저장소 파티션=본사이트와 별개 세션이 정상) → 정식
  chat-stream + 유나는 타로 모달 인위젯.
- 비용: 게스트 1건 ≈ ₩5 (홍보 예산 성격 — 회사 장부 KPI 연계는 오퍼스 TODO).

## 2단계(TODO 오퍼스): 텔레그램 게이트웨이 봇·위젯 유입 전환 측정·카카오 오픈빌더(행정 선행)·게스트 타로 1장 체험.
