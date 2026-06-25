# omd 디자인 파이프라인 (oh-my-design)

> 도입: 2026-06-25
> 텔레그램 `/design` 또는 Claude에게 요청 → 652개 서비스 레퍼런스 기반 디자인 생성 → 공개 URL.

## 무엇인가
**oh-my-design(omd)** = npm 도구 `oh-my-design-cli`. 디자인 **스킬 묶음**(스킬18·서브에이전트16·훅4·**652개 서비스 디자인 레퍼런스**). MCP 아님(MCP=외부연결 / 스킬=Claude에 주는 지식·절차 파일).
- 레퍼런스: `design-lab/.claude/data/references/<id>/DESIGN.md` — toss·airbnb·baemin·kakao 등 **실제 색·타이포·radius·컴포넌트 토큰**(예: toss primary=#3182f6, radius16, Toss Product Sans).
- 설치 위치: `/home/paks11299958/design-lab/` (ai_mp와 분리된 디자인 전용 폴더). `npx oh-my-design-cli install-skills`로 설치.

## ★핵심 원리 — cwd
omd 스킬/훅/서브에이전트는 **claude 세션 시작 시점의 작업폴더(cwd)** 기준으로만 로드된다. 그래서:
- VS Code에서 design-lab 폴더를 열고 새 세션 → omd 풀 로드(`/omd-harness` 등).
- **헤드리스**: `claude -p "..." --permission-mode bypassPermissions`를 **cwd=design-lab**으로 띄우면 omd가 로드된 채 디자인 생성. 결과 HTML은 절대경로로 `ai_mp/sites/designs/`에 직접 Write 가능(검증됨).

## 텔레그램 `/design` (rag, 커밋 1147e90 등)
`telegram_listener.py` `cmd_design(text)`:
1. `/design <스타일+화면>` 파싱 → slug=영문+숫자+타임스탬프(한글 제외, URL 깔끔)
2. design-lab cwd로 claude CLI 실행(timeout 600s, **구독인증=ANTHROPIC_API_KEY env 제거**)
3. omd가 `ai_mp/sites/designs/<slug>/index.html` Write
4. `node sites/gen-designs-manifest.cjs`로 manifest 재생성
5. ai_mp에서 `git add <slug> public/designs-manifest.json` → commit → push (config.git_env)
6. Vercel 자동배포 → `https://aichat.dbzone.kr/sites/designs/<slug>/` 회신
- COMMAND_TABLE·봇메뉴(`/` 자동완성)·`/help`에 등록. listener는 supervisor `hermes-listener`(autorestart) → kill -TERM 재시작.

## 어드민 'omd 디자인' 탭 (`components/admin/OmdDesignsPanel.tsx`)
- `/designs-manifest.json` fetch → 카드 그리드 + **iframe 썸네일**(0.5배 축소·pointer-events:none) + 클릭 새탭.
- manifest 생성: `sites/gen-designs-manifest.cjs`가 `sites/designs/` 폴더 스캔 → **`public/designs-manifest.json`** 출력(slug·title·createdAt·url, 최신순).

## ⚠️ 교훈 (배포·라우팅 함정)
1. **manifest는 `public/`에 둘 것**: `sites/designs/manifest.json`은 vercel `/sites/:sitename/:path*` rewrite와 얽혀 `.json`이 SPA index.html로 fallback됨(디자인 폴더 index.html은 정상인데 .json만 안 됨). `public/designs-manifest.json`은 Vite가 dist 루트로 복사→`/designs-manifest.json` 정적 서빙(512.png와 동일 방식)이라 fallback 안 탐.
2. **vercel.json buildCommand에 gen 스크립트 넣지 말 것**: `node sites/gen-designs-manifest.cjs 2>/dev/null || true &&` 체이닝을 넣으니 **Vercel 배포가 통째로 멈춤**(번들 안 바뀜). 빌드에서 빼고 manifest는 git 직접 커밋 + `/design`이 갱신 시 재커밋.
3. **omd에 "모바일 390px"만 주면 모바일 앱이 됨**: max-width 430px 고정폭 + 하단탭바·FAB → PC에서 양옆 휑함. 웹사이트는 **"반응형 PC+모바일, @media 분기, max-width 430 금지, PC는 1200 그리드"** 명시 필수.
4. **이미지는 실제 URL을 프롬프트에 직접 줘야 함**: omd는 우리 GCS URL을 모르니 이모지로 떼움. 페르소나 사진 등 실제 이미지를 쓰려면 **GCS URL 목록을 프롬프트에 명시**(예: `storage.googleapis.com/ai-mp-media/personas/<id>/profile.png`, img onerror 폴백). 윤채린·향기는 imageUrl이 data:(base64)라 URL 없음 주의.

## frontend-design vs omd
- **frontend-design**(Claude 기본 스킬): 기억 기반 즉석 디자인. 빠름, 특정 브랜드 정확도 낮음("토스는 파란색이었지").
- **omd**: 652개 실측 토큰 + 서브에이전트 분업검수(critic·a11y·QA·microcopy). "토스처럼"=정확히 #3182f6·radius16. 큰 작업·정확도에 유리.

배포 흐름은 [sites_system.md] 참고. 메인 시안 예시: sites/designs/aichat-main-v3 (반응형+실 페르소나 사진).
