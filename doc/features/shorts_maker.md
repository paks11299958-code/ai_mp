# 쇼츠 만들기 (이아린)

> 구현: 2026-07-22 신설, 2026-07-23 파이프라인 대개선(비주얼 다양성·완성본 검증·진행상황 표시)
> + 2026-07-23 2차 상품(실물) 모드 신설(재해석 금지)
> 이미지(최대 3장, 상품모드는 최대 8장) + 신청서 → 서로 다른 후킹 앵글의 시나리오 5개 →
> 회원이 고른 1개만 실제 TTS+영상으로 제작. 2단계 과금(리서치+시나리오 5개 / 선택 후 영상 제작).

## 컨셉
- 페르소나 **이아린**(마케팅) 기능. homepage 만들기와 동일한 비동기 큐+포인트 선차감 패턴.
- 흐름: 신청(이미지+업종/장점/타겟/톤/언어) → 리서치+시나리오 5개 생성 → 회원이 1개 선택
  (Veo 사용 시 추가과금) → 세그먼트별 이미지 생성+TTS+ffmpeg 조립 → 완성본 자동검증 →
  완성 mp4(DB `videoData` BYTEA 저장, 정적배포 지연 회피).

## 백엔드
- **`rag/shorts_maker_worker.py`** (서버2 직접 실행, 크론): raw SQL 테이블 `UserShorts` 폴링.
  - `run_research`: 업종 후킹 전략 + **인기 숏폼의 구도·색감·자막 스타일** 리서치(구글서치
    그라운딩), 언어별 문화 뉘앙스 반영.
  - `generate_scenarios`: 리서치 결과를 `visual_style_ref`로 시나리오에 실어 DB 저장.
  - `build_script_draft`: **3중 분기**(2026-07-23 2차 개편) — `is_product = bool(form.get
    ('isProduct'))`가 최우선. ①**상품/제품 모드**: 재생성(재해석) 절대 금지 — 모든 세그먼트가
    업로드 원본 중 하나를 `image_index`로만 참조(`scene_prompt`/`veo_prompt`는 항상 null),
    사진 여러 장이면 순환 배정하고 오프닝은 콜라주(배열) 허용. `use_veo`도 상품모드면 코드
    레벨로 강제 OFF(재해석 위험 원천 차단). ②**사람 사진 재해석**(비상품, Veo 미사용): 오프닝
    콜라주(사진 3장일 때만) → 원본 신뢰샷 → 재해석 샷 A/B(카메라 앵글 자체를 바꿈) →
    **무인물 AI 시각요소 인서트 필수 1컷**(코드 화면·그래프·다이어그램, 손 왜곡 리스크 없음).
    ③**Veo 사용**(`use_veo=True`, 비상품): "행동 시작 지점에만 영상, 최대 2개" 규칙.
  - `render_scene_images`: 세그먼트별 이미지 생성(나노바나나)+검수(`_verify_scene_image`,
    "장면 목적 일치"까지 함께 판정)+콜라주(`image_index` 배열) 지원. `on_progress` 콜백으로
    세그먼트 완료마다 진행률 기록. **상품모드 코드 레벨 안전망**(2026-07-23 2차) — 함수
    시작부에서 `isProduct`이면 LLM이 실수로 채운 `scene_prompt`/`veo_prompt`를 전부 무시하고
    라운드로빈으로 원본 인덱스를 강제 재배정, `used_indices` 중복 체크도 상품모드는 예외
    처리(사진 수보다 세그먼트가 많아도 원본 반복재사용 허용 — 재생성으로 새는 것보다 안전).
  - `_verify_final_video`(신규): 완성 mp4를 세그먼트 경계마다 프레임 샘플링해 Gemini Vision
    으로 "①인접 장면이 사실상 같은 사진 재탕인지 ②전체에 AI 시각요소가 하나도 없는지
    ③인물 팔다리가 생략/왜곡됐는지" 판정. NG면 해당 세그먼트만 재생성 후 재조립(최대 2회
    재시도, `process_produce`에 루프로 연결).
  - `_set_progress(edit_id, step, done, total)`: producing 단계(script→images→tts→verify)와
    waiting 단계(research→scenarios) 세부 진행을 즉시 커밋(별도 커넥션) — 폴링 중에도
    중간 상태가 보이게 함.
- **`shared-api/routes/aimp/shorts-maker.ts`**: `POST /requests`(1단계 과금)·
  `GET /requests/:id`(진행상황 포함)·`GET /requests/mine`·`POST /requests/:id/select`
  (2단계 과금, Veo 옵션 시 추가과금)·`GET /requests/:id/video`·`DELETE /requests/:id`.
  상품모드 검증(2026-07-23 2차): `isProduct==='true'`면 이미지 최소 3장(미달 시 400
  "제품 사진은 앞·옆·위(아래) 3장이 필요해요")/최대 8장, 용량 상한도 20MB로 상향
  (`MAX_IMAGE_B64_LEN_PRODUCT`). `isProduct`는 `validateForm`에서 파싱해 `formJson`에
  그대로 저장 — 워커가 `form.get('isProduct')`로 참조.
- **DB**: `UserShorts`(raw SQL, Prisma 미관리) — `progressStep`/`progressDone`/`progressTotal`
  (2026-07-23 추가), `useVeo`(2026-07-23 추가, 초기 배포 시 마이그레이션 누락으로 선택 API
  500 에러 실측 — 반드시 함께 마이그레이션할 것). `isProduct`는 별도 컬럼이 아니라
  `formJson`(JSON 텍스트) 안에 문자열 `"true"`로 포함됨.

## 프론트 (`ShortsMakerBoard.tsx`)
- `waiting`/`producing` 두 단계 모두 **체크리스트 UI**(지난 단계 ✓, 현재 단계 스피너+진행률,
  이후 단계 회색 텍스트) — `row.progressStep`을 5초 폴링으로 반영.
- 완성 숏츠 미리보기(유튜브 샘플)는 `aspect-[9/16]` wrapper로 종횡비 고정 — PC에서 iframe이
  `w-full h-full`로 뷰포트를 채우며 세로형 영상이 레터박스/잘림 나던 문제 수정(2026-07-23).
- **상품/제품 모드 UI**(2026-07-23 2차): 체크박스 "제품·상품 사진이에요"(안내: "AI가 지퍼·
  로고 같은 디테일을 바꾸지 않고, 빛·각도만 다르게 보여줘요") — 체크 시 자유 업로드 박스
  대신 **앞면/옆면/위 또는 아래 3개 고정 슬롯**(각 슬롯 채워질 때까지 제출 차단)+추가 5장
  선택 업로드(최대 8장). 체크 해제 시 기존처럼 자유 업로드 최대 3장.

## 조립 엔진 (`shorts-factory/make_short.py`)
- 세그먼트별 TTS+PIL 프레임(1080x1920, Pretendard)+ffmpeg(zoompan 슬로우줌+팬, Ken Burns)
  → mp4. 화면 상단 브랜드 배지 `BRAND` 상수(2026-07-23: "AI 놀이터 · aichat.dbzone.kr",
  기존 "AI 페르소나"에서 변경).
- zoompan 지터(미세한 화면 흔들림) 완화 시도(2026-07-23): 업스케일 배율 1.5배→4배+lanczos
  리샘플링. ⚠️정적 테스트로는 개선 효과를 확실히 재현하지 못함(사장 확인 후 "그냥 둬"로
  보류) — 추가 개선은 하지 않기로 확정.

## 어드민 (`ShortsAdminPanel.tsx`, 서버2 agent-api 브릿지)
- 수동 생성 드롭다운: `TOPIC_LABELS` 맵으로 hair/outfit(구식 arin_script.TOPICS)+17개 신규
  (shorts_maker_worker.ADMIN_TOPICS) 총 19종 전부 한글 기능명 표시(2026-07-23 2차,
  "hair(한글기능명칭) 붙여줘" 지적).
- 반려됨/승인됨 항목 삭제(2026-07-23 2차 신설): `rag/shorts_queue.py`의 `delete(task_id,
  section)`(영상 파일+메타 JSON 제거, pending은 대상 아님)→`agent-api POST /shorts/delete`→
  `shared-api POST /admin/shorts/delete` 프록시→어드민 🗑삭제 버튼(확인창). 그 전까진 반려된
  쇼츠가 쌓여도 지울 방법이 없었음.
- 회원 신청 대기열은 waiting(대기/진행 중)/completed(완료·실패) 두 그룹으로 분리 표시
  (`_DONE_STATUSES`, 2026-07-23 1차 — 예전엔 status별 건수를 한 줄에 나열해 "done 2"가
  '대기열' 라벨 아래 보이며 완료건을 대기로 오해하게 함).

## 교훈
- ★**상품(실물) 사진에 사람 사진용 "재해석" 로직을 그대로 적용하면 허위광고가 됨**
  (2026-07-23 2차, 가장 중요): "명품 디올 카드지갑" 완성 영상에서 원본에 없는 지퍼가
  나노바나나 재생성 이미지에 나타난 걸 사장이 직접 발견. `_regenerate_scene`은 "얼굴
  정체성만 보존, 배경·구도는 자유 재해석"이 전제인데, 이 전제가 실물 상품(지퍼·로고·재봉선
  같은 디테일이 실제와 달라지면 안 됨)엔 정반대로 작동함. 재발 방지는 **프롬프트 지시
  하나만으론 부족** — LLM이 규칙을 어길 가능성까지 감안해 코드 레벨 안전망(강제
  image_index 재배정)을 반드시 이중으로 걸어야 함. 검증은 "지시했다"가 아니라 실제 생성
  결과의 SHA-256 해시를 원본과 비교하는 수준까지 실측할 것.
- ★**"실사진 최우선 재사용"이 다양성의 적**: 원본 사진이 1~3장뿐인 소재(모임·행사 등)는
  "사진이 있으면 우선 재사용" 원칙이 결과를 다 비슷하게 만듦. "AI로 인생 프로필 완성"이
  성공했던 건 6가지 확실히 다른 화풍으로 "재해석"하는 축이 있었기 때문 — 사진합성 소재는
  재해석 축(화풍/장면 카테고리)을 명시적으로 설계해야 함.
- ★**Vision 검수 모델의 판단 오류는 프롬프트로 못 고침**: 나노바나나가 팔을 생략해도
  gemini-2.5-flash/pro Vision 둘 다 "원근감 때문"이라고 오판, 프롬프트를 3차례 강화해도
  못 잡음. 검증 강화보다 **생성 프롬프트에서 예방**하는 게 근본 해결.
- ★**raw SQL 테이블은 컬럼 추가 시 코드와 DB가 따로 논다**: Prisma 미관리 테이블에 새
  컬럼(`useVeo`)을 참조하는 코드만 배포하고 실제 `ALTER TABLE`을 깜빡하면, 로컬/서버
  어디서도 타입 에러 없이 그냥 런타임에 500이 남 — raw SQL 컬럼 추가 시 배포 체크리스트에
  마이그레이션을 명시적으로 포함할 것.
- ★**진행 중 파일 수정과 크론이 충돌 가능**: 서버2 직접 실행 워커(`rag/*.py`)를 라이브로
  수정하는 동안 1분 간격 크론이 일시적 SyntaxError 상태를 읽어 실제 회원 요청이 22분간
  멈춘 사고 실측 — 워커 코드 수정은 짧게 끊어 커밋하거나, 수정 중임을 인지하고 완료 직후
  즉시 로그로 재개 확인할 것.

배포(1차): rag(서버2 직접, `f10a000`+`5d0d2c6` 등 push만으로 크론 반영), shared-api(서버1
git pull+pm2 reload, `cb89e5e`), ai_mp(master push, Vercel — Promote to Production 필요).
배포(2차, 2026-07-23 상품모드+어드민 정리): rag(서버2 직접, 크론 자동반영)·agent-api(서버2
uvicorn kill+재시작, git 저장소 아님)·shared-api(`570ccc9`+`cce1947`, 서버1 git pull+
`npx pm2 restart shared-api --update-env`)·ai_mp(`02fab3a`+`a01f50b`, master push, Vercel
— Promote to Production 필요).

## 2026-07-24 추가 수정 3건

- ★**자동 소재순환 크론(`daily_short.py`) 비활성화**: 07-23에 "17개 신규 소재는 어드민이
  드롭다운에서 직접 골라 수동 생성"으로 합의했으나, 정작 매일 KST09:20 자동 실행되던
  기존 hair/outfit 순환 크론 자체를 끄는 걸 빠뜨림 — 다음날 아침 "시간여행 등은 수동으로
  만들기로 했는데 왜 hair가 자동으로 왔냐" 지적으로 발견. crontab에서 `daily_short.py`
  라인을 주석 처리해 비활성화(회원용 `shorts_maker_worker.py` 1분 폴링은 그대로 유지 —
  이건 회원이 실제 신청했을 때만 동작하는 별개 워커). ★교훈: "수동 방식으로 바꾼다"는
  합의는 신규 코드 추가만이 아니라 **기존 자동화를 끄는 작업까지 포함**해야 완결됨.
- ★**어드민 17개 소재(`ADMIN_TOPICS`) 완성 영상에 QR 딥링크 전부 누락**: hair/outfit
  (`arin_script.TOPICS`)은 애초에 소재별 `cta_url`(`?f=hair&ref=youtube`)이 있어 마지막
  컷에 QR이 자동으로 들어갔는데, 나중에 추가된 17개 신규 소재(`ADMIN_TOPICS`, 07-23
  신설)는 이 필드 자체가 설계에서 누락됨 — "시간여행" 완성 영상에 QR이 하나도 없다고
  사장이 직접 확인·지적. `shorts_maker_worker.py`에 `ADMIN_TOPIC_CTA_URL` 딕셔너리
  (`{key: f"https://aichat.dbzone.kr/?f={key}&ref=youtube" for key in ADMIN_TOPICS}`)
  신설, `run_admin_topic`이 `form.setdefault("qrUrl", ADMIN_TOPIC_CTA_URL[topic_key])`
  로 채우도록 수정. "시간여행"을 실제로 재생성해 완성 영상 끝부분을 ffmpeg 프레임
  추출로 육안 검증 완료(QR 코드+"AI 놀이터" 배지 정상 렌더링 확인).
- **QR 주소 입력란 UX 개선(2단계)**: ①"https:// 를 안 넣어도 되게 해달라" 요청 —
  서버측 `normalizeUrl`(shared-api/shorts-maker.ts)이 이미 `https://` 자동 보정 중이었음을
  확인, 프론트(`ShortsMakerBoard.tsx`) placeholder를 실제 도메인 예시(`smartstore.naver.com/
  내상점`)로 바꾸고 "https:// 는 안 넣어도 돼요" 안내문구 추가. ②"참고 쇼츠 URL과 QR
  주소가 안 헷갈리게 구분해달라" 요청 — 두 입력 블록에 각각 소제목("참고하고 싶은
  쇼츠(선택)", "QR로 연결할 주소(선택)") 추가.

배포(3차, 2026-07-24): rag(서버2 직접, crontab 수정+`shorts_maker_worker.py` 수정, 크론
자동반영)·ai_mp(`88e99a4`+`0f2a8e6`+`7857b68` 등, master push, Vercel — Promote to
Production 필요).

## 2026-07-25 실사고 2건 — 상품모드 안전망 재발 + 일본어 한자 깨짐

사장이 어드민에 새로 추가한 "회원 쇼츠 검수(임시)" 기능으로 완성본을 직접 보다가 발견.
신청서: 업종 "AI 은비", `isProduct: true`, `language: ja`, 사진 3장(그중 1장에 모래사장에
나뭇가지로 쓴 "은비" 한글 글자 포함).

- ★**상품모드 재생성 금지 안전망이 "검증 NG 재시도" 경로에서 우회됨(재발)**: 07-23에
  만든 안전망(`render_scene_images` 최초 호출 시 `scene_prompt` 강제 제거)은 최초 생성
  경로만 막았을 뿐, `process_produce`/`run_admin_topic`의 **완성본 검증 NG → 재시도**
  로직(`draft_segs` 백업에서 `scene_prompt` 복원)에는 `isProduct` 체크가 아예 없어서,
  검증에서 우연히 NG가 나면 이 경로로 원본에 없는 디테일이 생기는 재생성이 실제로
  발생함(모래 글자가 재생성 이미지에서 사라짐). 두 재시도 루프(`process_produce`,
  `run_admin_topic`) 중 회원용(`process_produce`)에 `is_product` 체크 추가해 상품모드면
  재시도 시에도 `scene_prompt`를 절대 복원하지 않고 `image_index` 순환 배정만 하도록
  수정. 실제 사고 재현 조건(원본 3장+검증NG+재시도)으로 재검증해 원본과 해시 완전
  일치 확인. 교훈 상세는 agent-wiki `dev/doc/patterns.md` 07-25.
- ★**일본어 자막 한자 전부 깨짐**: 자막 폰트 Pretendard가 CJK 한자 글리프 미지원 —
  히라가나·가타카나는 정상, 한자만 흰 사각형(tofu)으로 렌더링됨. **Noto Sans JP**
  (Google, OFL 라이선스, `shorts-factory/assets/NotoSansJP-Regular.ttf`)를 도입, 언어별
  폰트 선택 헬퍼 `_font_for(language, size, bold)`를 `make_short.py`에 신설 — 일본어만
  이 폰트(가변폰트, `set_variation_by_name`으로 굵기 선택), 나머지 언어는 기존
  Pretendard 유지. `render_frame`/`render_overlay`가 `language` 파라미터를 받아 캡션·
  내레이션 자막·CTA·배지 전체에 적용.

배포(4차, 2026-07-25): rag(서버2 직접, `shorts_maker_worker.py` 재시도 로직 수정)·
shorts-factory(서버2 직접, git 저장소 아님, `make_short.py` 수정+`NotoSansJP-Regular.ttf`
신규 배치) — 둘 다 다음 실행부터 즉시 반영(별도 재시작 불필요, 크론이 매 실행마다
새 프로세스 기동).

## 2026-07-25 3차 수정 — 상품모드 카드 크롭도 원본 실물 정보를 잘라낼 수 있음

위 재생성 안전망 수정 후에도, 텔레그램으로 완성본을 사장이 직접 재확인하는 과정에서
"모래 글자는 재생성으로 안 사라졌는데, 카드 크롭 때문에 화면에서 실제로는 잘 안 보인다"
는 걸 발견. 원인: 카드 이미지 배치(`_cover`, 비율유지 크롭)가 **항상 중앙 기준**으로
잘라서, 원본이 세로로 긴 사진(1086×1448)을 카드 비율(920×940, 거의 정사각형)에 맞추면
상단 인물 위주로 남고 하단(모래 글자)이 크롭 경계에 걸쳐 잘림. "상단 기준 크롭"으로도
시도했으나 정반대로 하단이 통째로 사라져 실패 — **고정된 크롭 규칙 자체가 원본마다
다른 위치의 실물 정보를 안전하게 다루지 못함**을 두 방식 다 재현해 확인.

**최종 해결**: 상품모드(`isProduct`)일 때만 크롭 대신 **`_contain`**(비율 유지 축소,
잘림 없이 카드 배경색으로 여백 채움)으로 전환 — 재생성 금지와 같은 원칙(허위 왜곡
방지)을 카드 배치에도 일관 적용. 일반 인물 재해석 모드는 기존 `_cover`(중앙 크롭)
그대로 유지. `render_frame`에 `is_product` 파라미터 추가, `shorts_maker_worker.py`가
`build_script_draft`에서 만든 `script["isProduct"]`를 통해 `make_short.py`(별도 파일이라
`form`을 직접 못 봄)에 이 정보를 전달. 실제 재현 테스트로 콜라주·단일카드 양쪽에서
"은비" 글자가 여백과 함께 완전히 보존됨을 확인, 텔레그램으로 완성본 재확인 완료.
