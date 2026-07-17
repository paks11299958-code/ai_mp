# 🏠 홈페이지 만들기 (신청서 → AI 시안 링크 + 소스 zip)

> 2026-07-17 정식 오픈(Fable). 담당 페르소나=**박하진**(웹 전문가, id=cmros4tj300000lbemhq8jzw4).
> 단가=**3,000pt**(MenuLimit 'homepage', 사장 확정 — 변경은 사장만). 상세 이력=memory/project_homepage_builder.md.

## 개념
소상공인 회원이 신청서(업종·상호·소개·메뉴·카카오 링크 등)를 채우면 AI가 홈페이지 시안을 만들어
**①실제 공개 링크(주인공)** + **②소스 zip(보조, 개발자 전달용)** 둘 다 제공. 결제 전 샘플 갤러리로 신뢰 형성.

## 아키텍처 (비동기 큐)
```
프론트 HomepageBoard(샘플→신청서→대기 5s 폴링→결과)
  → POST /api/aimp/homepage/requests  (shared-api routes/aimp/homepage.ts)
      선차감 3,000pt(MenuLimit) · 동시 pending 1건 409 · 카카오 링크 화이트리스트+/chat 정규화
  → HomepageRequest(pending)  ★raw SQL 테이블(prisma schema 밖 — $queryRawUnsafe만)
  → 서버2 워커 rag/homepage_worker.py  (크론 */2 0-10 UTC = KST09~19, claude_gate.gate_heavy)
      v2 4단계: ①Gemini 구글서치 리서치 → ②기획서(claude sonnet, prompts/homepage_plan.md
      =사장 11-STEP 프롬프트 각색, IMAGE_SLOTS JSON 계약) → ③나노바나나 이미지 최대 4장
      (gemini-2.5-flash-image, Vertex location=global, 간격 25s·429=60s 쿨다운·실패 슬롯 생략)
      → ④조립(prompts/homepage_build.md — 웹폰트 Google Fonts만 허용·이모지 그래픽 금지·
      후기=[예시] 라벨·미확인 정보=[가게 확인 필요]·CTA=카카오>tel:>없으면 버튼 생략)
  → sites/homepage/{slug}/ (index.html + img/ + plan.md + source.zip) git add 그 경로만→커밋·푸시(Vercel)
  → done(slug·zipPath) / failed(errorMessage+자동 환불·stale 60분도 환불) + 텔레그램 통보
```
- slug=`h`+hex 10자(PII 미노출). zip=같은 공개 폴더의 정적 파일(자립형 — img 포함, 별도 라우트 없음).
- 산출 시간: 건당 5~25분(조립 claude 타임아웃 1200s — 600s 초과 실측).
- **순번·예상시간 안내**(07-17): 워커가 크론(KST 09~19)이라 밤 신청 시 차감만 되고 방치되던 문제 해소.
  POST/폴링(`requests/:id`) 응답에 `queuePosition`(내 앞 pending/processing 수+1)·`etaMinutes`
  (운영시작 대기 minutesUntilOpsStart + 순번×8분)·`withinOpsHours`·`opsWaitMinutes`.
  대기 화면=🎫순번/🛠️제작중 + ⏱️예상시간(fmtEta) + 운영시간 밖이면 🌙"내일 오전 9시부터".
  ★운영시간 상수 OPS_START_KST=9·OPS_END_KST=19 (워커 크론과 일치시킬 것). KST=Date+9h 후 getUTCHours.
- **어드민 '홈페이지 신청' 탭**(HomepageRequestsPanel, 콘텐츠 그룹): `admin/summary`(상태별 집계+운영시간)
  +`admin/requests`(전체·u.username/email JOIN·펼치면 신청서 전체+결과 링크+과금)+60분 밀림 🔴경고.
  requireAdmin. ★User 이름 컬럼=username(name 아님), 관리자=userId 2(알투).

## 기능카드 등록(7항목) 위치
| 항목 | 위치 |
|---|---|
| 메인 카드 | MainPageNew FEATURES_GRID id24(key='homepage', 아이콘 'homepage', 인디고 팔레트) |
| 채팅 메뉴 | FEATURE_REGISTRY + DB 박하진 features=["homepage","learn"] (정본) |
| 핸들러 | App featureBoardOpeners.homepage → HomepageBoard |
| 동의어 | FEATURE_SYNONYMS.homepage (learn 동의어 통합) |
| 카드 순서 | AppConfig newFeaturesOrder 맨 앞 |
| 공지 초안 | Announcement id25 (isVisible:false — 노출 토글=사장) |
| 과금 | MenuLimit 'homepage' 3롤 3,000pt |

★학습자료(learn)는 메인 카드 제거됨(혼동 방지) — 진입은 박하진 채팅 '학습자료' 버튼(07-17부터 /learn 시리즈 목록으로).

## 원칙
- 사실 창작 금지: 신청서에 없는 전화·주소·가격 생성 금지(없으면 생략 또는 [가게 확인 필요]).
- 신청서 내용은 공개 웹페이지에 게시됨 — 개인정보처리방침 제2조 ⑥(TermsModal) + 폼 안내 문구.
- claude CLI=구독 인증(API키 주입 금지). 워커 git add는 sites/homepage/{slug}만.
- Phase 2(예정): "Next.js 프로젝트로 변환" — 사장 원안 프롬프트(파일 단위 출력) 사용.
