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

## 참고 사이트 URL + 시안 목록 화면 (07-20)
- 신청서에 "참고하고 싶은 사이트 URL(선택)" 추가 — http(s) 형식 검증, 리서치 프롬프트(Gemini
  구글서치 그라운딩)에 "톤·색감만 참고, 로고·사진·문구는 베끼지 말 것" 지시로 전달.
- 리스트 화면(내가 만든 홈페이지) — `homepageApi.mine()` 최근 20건을 상태뱃지(대기/제작중/완성/실패)와
  함께 표시, 완료 건은 바로가기·소스받기·수정 버튼.

## 채팅 편집기 (HomepageEditPanel, 07-20)
완성된 시안을 채팅으로 텍스트 수정하거나 사진을 AI 재생성·업로드로 교체하는 기능. 리스트 화면
'✏️ 수정' 클릭 → 왼쪽 iframe 미리보기 + 오른쪽 대화/사진편집 탭.

```
kind='text'  (100P): claude CLI를 시안 폴더(cwd)에서 --allowedTools Edit --permission-mode
  acceptEdits 에이전트 모드로 띄워 index.html을 직접 부분수정(전체 HTML 재출력 방식은
  응답량이 커 3~4분 걸림 실측 → 파일 직접편집으로 수십 초로 단축). audit_html 통과 시 즉시
  배포. history/{editId}.html 스냅샷(되돌리기용) → revert API로 복원.

kind='image' (200P) / 'upload' (100P): 나노바나나 image-to-image 재생성 또는 회원 업로드
  (Gemini 1차 안전검수: 선정성·폭력성·미성년자·개인정보) → HomepageEdit.previewData(BYTEA)에
  이미지 바이트 저장(파일·git 미사용) → Before/After 확인 → "적용" 시에만 파일화+배포.
```

- **DB**: `HomepageEdit` 신규 raw SQL 테이블(요청id·kind·instruction·targetFile·status·
  previewData BYTEA·pointsCharged·errorMessage). MenuLimit 폴백: text=100P, image=200P,
  upload=100P(사장 확정) — 어드민 메뉴권한 탭에 4종 노출(기존 homepage 자체도 누락돼 있던 것 함께 해소).
- **워커**: `rag/homepage_edit_worker.py`(신규). 크론 1분(text/image/upload 신규 생성) +
  `homepage_edit_fast.sh`(applying/reverting 전용 초경량 루프, 10초 간격 6회/분). 두 크론
  동시 실행 대비 `FOR UPDATE SKIP LOCKED`로 경쟁 방지.
- **미리보기는 DB 직결 서빙**(★핵심 아키텍처 결정): 처음엔 미리보기를 정적 파일로 저장했는데
  git→Vercel 배포 반영까지 실측 최대 40초+ 걸려 그 사이 SPA index.html이 대신 응답돼(text/html)
  `<img>`가 깨져 보이는 실사고 발생. 재시도 로직으로 버티는 대신 근본 해결 — 미확정 미리보기는
  `GET /requests/:id/edits/:editId/preview?sig=HMAC서명`으로 DB에서 API가 직접 서빙(배포 자체를
  안 탐). `<img src>`가 Authorization 헤더를 못 붙이므로 requireAuth 대신 HMAC 서명 검증.
- **적용(git 배포)은 여전히 지연 있음**: "적용" 확정 시에만 파일화+배포하므로 이 순간은 Vercel
  CDN 반영 지연을 피할 수 없음. ①index.html의 해당 `<img src="img/x.jpg">`에 `?v={editId}`
  캐시버스터 자동 삽입(재적용 시 값 교체, 브라우저 캐시 우회) ②"적용" 완료 시 여러 번 나눠
  재새로고침하는 대신 편집화면 자체를 key로 통째 재마운트(부모 HomepageBoard가 `onApplied`
  콜백으로 리마운트 트리거) — 사장이 "화면 다시 띄우니 반영됨"으로 직접 확인한 방식.
- **사진편집 썸네일**: `HomepageRequest.imageSlots`(신규 컬럼, JSON) — 생성 시 워커가 만든 이미지
  파일 목록을 명시 저장. 과거에는 매번 index.html을 정규식 파싱했는데 캐시버스터 붙은 경로를
  놓쳐 "방금 바꾼 사진이 목록에서 사라짐" 버그가 남 → imageSlots 우선 사용, 없는(과거 생성분)
  경우만 정규식 파싱 폴백.
- **부수 버그 수정**: zip append("a") 모드가 같은 파일명 중복 엔트리를 만들던 것을 `_rebuild_zip()`
  전체 재빌드로 교체 / 나노바나나가 PNG로 응답하는데 확장자 무조건 .jpg 고정 저장하던 버그를
  매직바이트 판별(`_image_ext`)+적용 시 Pillow 재인코딩으로 해결.
- **UX**: 대기(queued)/처리중(working) 단계 구분 배지+흐르는 진행바, 처리 중 창닫기 차단
  (beforeunload 확인창)+재진입 시 진행중 요청 자동 폴링 복원, 텍스트 되돌리기 버튼, 완료 시
  claude 응답을 채팅에 표시, 편집화면에도 실제 주소·소스 zip 링크 노출, 내사진 파일선택을
  브라우저 기본 UI 대신 커스텀 버튼으로.
- ★교훈: 배포/캐시 지연 문제는 재시도 시간을 늘리는 방식보다, 애초에 그 배포 경로 자체를
  안 타는 구조(DB 직결)로 바꾸는 게 근본 해결.
