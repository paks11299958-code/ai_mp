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

### 커스텀 도메인을 사이트에 붙이기 (2026-08-26 신설)

사이트를 `xxx.dbzone.kr` 루트에서 바로 열리게 하는 방법. 실사례=`ainara2.dbzone.kr`.

1. **Vercel 프로젝트에 도메인 연결**
   ```
   POST https://api.vercel.com/v10/projects/ai-mp/domains?teamId=<TEAM>
   {"name":"ainara2.dbzone.kr"}
   ```
   ★`dbzone.kr` 은 **Vercel DNS 에 위임**돼 있어 외부 등록업체를 갈 필요가 없다.
   단, **레코드가 이미 있어야** 한다 — 신규 하위도메인 생성은 별도 권한이 필요하다
   (현재 토큰은 `forbidden`, 재개 조건은 `~/TODO.md` 🌐 항목).

2. **`vercel.json` 의 `redirects` 에 host 조건부 규칙 1개** 추가
   ```json
   { "source": "/",
     "has": [{ "type": "host", "value": "ainara2.dbzone.kr" }],
     "destination": "/sites/ainara-partner/", "permanent": false }
   ```

★★**`has` 조건을 반드시 붙일 것.** 조건 없는 `"source": "/"` 규칙은 **메인 도메인까지
리다이렉트해 사이트 전체 장애**가 된다(2026-07-17 동일 자리에서 실제 사고).
`rewrites`(126개)는 건드리지 않는다 — `redirects` 는 별개 배열이라 안전하다.

⚠️이 방식은 리다이렉트라 **주소창이 `/sites/<name>/` 으로 바뀐다.** 주소를 그대로
유지하려면 **별도 Vercel 프로젝트**가 필요하고, 프로젝트 생성 권한이 있어야 한다.

**배포 확인 시 주의**: 배포 직후 자산이 이상한 크기(SPA HTML 크기 ≈ 2.7KB)로 나오면
**CDN 캐시**일 수 있다. `?v=$(date +%s)` 로 우회해 재확인할 것 — 미배포로 오진하기 쉽다
(`x-vercel-cache: HIT` 가 단서).

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
- ★**이미지를 자체 생성해도 된다**(2026-08-26 `ainara-partner` 실사례) — 서버3 GCP3
  Z-Image 로 만들어 `sites/<name>/assets/img/` 에 두면 외부 의존이 사라진다.
  ⚠️단 **인물이 여러 장면에 반복되는 구성은 피할 것** — Z-Image 는 img2img 미지원이라
  **얼굴 정체성·연령이 통제되지 않는다**(장면마다 다른 사람이 된다, 2026-08-26 실측).
  인물 없는 추상 비주얼·배경·단발 장면은 문제없다.
- ★**반응형은 여러 폭으로 실측할 것.** `img` 에 `height:auto` 가 없으면 HTML 의
  `height` 속성이 남아 `aspect-ratio` 가 무력화되고, `object-fit:cover` 가 이미지를
  잘라낸다. 모바일 미디어쿼리 분기점도 **620px 는 좁다**(780px 기기가 데스크톱 레이아웃을
  받았다) — 820px 권장. 360~1440px 를 훑으며 **잘림률을 수치로** 잴 것.
