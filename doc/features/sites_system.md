# sites/ 독립 웹사이트 시스템

> 추가일: 2026-05-30
> 진입점: 텔레그램 `/hermes [프로젝트명] [설명] 홈페이지 만들어줘`

---

## 개요

Hermes AI가 **순수 HTML/CSS/JS 독립 웹사이트**를 자동 생성·배포하는 인프라.
ai_mp의 React 앱과 완전히 분리되어 `sites/프로젝트명/` 폴더 단위로 독립 동작한다.
Vercel 빌드 시 정적 파일로 함께 배포된다.

접근 URL: `https://aichat.dbzone.kr/sites/프로젝트명/`

---

## 폴더 구조

```
ai_mp/sites/
├── README.md          폴더 규칙 + 등록 사이트 목록
├── DESIGN_GUIDE.md    → agent-wiki/dev/doc/design_guide.md 심볼릭 링크 (RAG 임베딩 대상)
└── 프로젝트명/
    ├── index.html
    ├── style.css
    ├── script.js      (선택)
    └── assets/        (선택)
```

> **DESIGN_GUIDE.md는 심볼릭 링크**다. 실제 파일은 `agent-wiki/dev/doc/design_guide.md`이며
> RAG에 임베딩되어 Hermes가 검색으로 참조한다. 수정은 실제 파일 경로에서 한다.

---

## Vercel 빌드/라우팅 (vercel.json)

```
buildCommand: ... && cp -r sites frontend/dist/sites && mkdir -p frontend/dist/sites/_preview
rewrites:
  /sites/:sitename        → /sites/:sitename/index.html
  /sites/:sitename/       → /sites/:sitename/index.html
  /sites/:sitename/:path* → /sites/:sitename/:path*
```

`_preview/`는 디자인 시안 미리보기용 (design_preview.py가 생성).

---

## 생성 파이프라인 (Hermes)

```
1. /hermes [프로젝트명] 홈페이지 만들어줘
2. Search Agent: 자료 조사
3. design_preview.py: Opus가 HTML 시안 3개 생성 → sites/_preview/ 저장
4. 텔레그램으로 시안 3개 미리보기 → 사용자 승인/선택
5. 선택 시 DESIGN_GUIDE.md 선택 이력 테이블 자동 업데이트 (취향 학습)
6. Dev Agent: sites/프로젝트명/ 에 HTML/CSS/JS 생성 + vercel.json 라우트 추가
7. 자동 배포 → URL 텔레그램 알림
```

관련 rag 파일: `rag/design_preview.py`, `rag/hermes.py` (PLAN_PROMPT에 sites 규칙).

---

## DESIGN_GUIDE.md 핵심

사이트 유형별 색상 팔레트 5종 제공:
- 🛒 쇼핑몰 (오렌지/그린 + 과일 테마 오버라이드)
- 💼 SaaS (인디고-퍼플 다크)
- 🎮 게임 (네온)
- 📺 방송 (라이브 레드)
- 🏢 회사소개 (네이비-골드, Whispr 브랜드)

공통 컴포넌트(네비/푸터/그리드/햄버거), 필수 포함(사업자 정보 푸터/반응형/meta),
**선택 이력 테이블**(시안 확정 시마다 누적 → 사용자 취향 학습용).

---

## 절대 규칙

- Hermes는 `sites/` **밖의 파일**(App.tsx, frontend/, vercel.json 등) 수정 금지
  (단, sites 라우트 추가 시 vercel.json은 Hermes 파이프라인 예외)
- 각 사이트는 `sites/프로젝트명/` 내에서 완전히 독립 동작
- 외부 라이브러리는 CDN, 이미지는 Unsplash CDN 또는 직접 링크
