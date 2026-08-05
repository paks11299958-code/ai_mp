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
- **컷 전환(xfade) 신설**(2026-08-04): 세그먼트 사이가 하드컷뿐이던 걸 6종 트랜지션
  순환으로 교체. 상세는 문서 맨 아래 "🎬 쇼츠 컷 전환 효과(xfade) 신설" 참고.

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

## 2026-07-25 다국어 폰트 커버리지 전수 테스트(중국어/영어/베트남어)

일본어 한자 깨짐(위 항목) 수정 후 "다른 지원 언어도 검사해봐" 지시로 진행.

- ★**중국어도 Pretendard 한자 미지원**: 일본어와 동일한 tofu(흰 사각형) 깨짐을 실측
  확인. **Noto Sans SC**(Google, OFL 라이선스, `shorts-factory/assets/
  NotoSansSC-Regular.ttf`, 간체 — 프론트 언어 선택지가 '중국어' 단일 옵션이라 번체
  대신 더 널리 쓰이는 간체로 통일) 설치, `_font_for`에 `{"ja": FONT_JP, "zh": FONT_ZH}`
  딕셔너리 조회 방식으로 확장.
- **영어·베트남어는 문제없음**: 영어는 기본 라틴 알파벳이라 당연히 정상. 베트남어는
  성조 기호(ệ, ữ, ằ 등 라틴 확장 문자)가 있어 우려했으나 Pretendard가 이미 지원해
  정상 렌더링 확인 — 별도 폰트 불필요.
- ★**중국어·일본어 자막 줄바꿈이 아예 작동 안 하는 버그 추가 발견**: `_wrap` 함수가
  `text.split()`(공백 기준)으로 줄바꿈하는데, 중국어·일본어는 띄어쓰기가 없어 문장
  전체가 한 "단어"로 인식돼 줄바꿈이 전혀 안 되고 내레이션 자막이 화면 밖으로 넘침
  (짧은 caption은 우연히 화면에 담겼지만 긴 text는 실측으로 넘침 확인). `_wrap`에
  `language` 파라미터 추가 — zh/ja는 글자 단위 줄바꿈, 나머지는 기존 공백 기준 유지.
  5곳의 호출부(`render_frame`/`render_overlay`의 cta/caption/subtitle) 전부 `language`
  전달하도록 수정.
- 중국어/영어/베트남어 각각 실제 신청 조건(id=18 "AI 은비" 복제)으로 완성 쇼츠를
  워커 파이프라인으로 만들어 텔레그램 전송 검증 완료. 어드민 패널에 언어 뱃지
  (`LANGUAGE_LABEL`)도 함께 추가해 나라별 완성본을 구분해 볼 수 있게 함.

## 2026-07-25 카테고리 5종 도입(사장 발안)

"쇼츠 만들기"를 처음부터 5개 카테고리로 나누고 싶다는 사장 요청. 기존 "일반/상품"
2분류(`isProduct` 이진 분기)를 유지한 채, 사진 없이 주제만 입력하는 3개 카테고리를
새로 얹는 방식으로 설계(최소 변경 원칙).

```
category    한글 라벨              사진        isProduct 파생
community   커뮤니티·동호회         1~3장 필수   false (기존 "일반" 모드)
product     제품·상품              3~8장 필수   true  (기존 상품 모드 그대로)
insight     지식·인사이트 큐레이션   없음        false (신규)
wellness    저속노화&웰니스         없음        false (신규)
meme        공감형 밈&POV          없음        false (신규)
```

- **프론트(`ShortsMakerBoard.tsx`)**: 기존 체크박스 하나를 5개 카드 선택 UI로 교체
  (사장 지시: "사용자들이 사용하기 쉽게, 설명도 잘 달아놓고") — 각 카드에 이모지+
  한줄설명+입력방식(사진 필요/불필요)+실제 소재 예시까지 표시. 카테고리 선택 시
  안내문·이미지 섹션·입력 필드(biz/strengths/target 3칸 ↔ topic 1칸)가 실시간 전환.
  `isProduct: boolean` 자체 state를 `category` 파생 상수로 전환해 기존 이미지 검증
  로직(`onPickImages`/`productSlotsFilled`/`submit`)은 변경 없이 재사용.
- **백엔드(`shorts-maker.ts`)**: `validateForm`에 카테고리별 필수 필드 분기(사진기반은
  biz/strengths/target 필수, 사진없음은 topic만 필수) + `POST /requests` 이미지 검증을
  category 3그룹으로 재구성(사진없음 카테고리는 실수로 첨부돼도 `images.length = 0`
  으로 무시). `category` 미지정 시 `'community'` 기본값이라 구버전 요청도 하위호환.
- **워커(`shorts_maker_worker.py`)**: `build_script_draft`에 `CATEGORY_TONE` 딕셔너리
  신설 — insight(뉴스 브리핑체+사실관계 신중 표현), wellness(실천 팁체+효능 과장 금지),
  meme(1인칭 POV 구어체+특정 대상 비방 금지) 톤을 "사진 없음" 프롬프트 분기 앞에 삽입.
  기존 어드민 전용 `run_admin_topic`+`ADMIN_TOPICS`(17개 소재, `raw_list=[]`로 이미
  운영 중이던 경로)와 프롬프트 구조를 공유 — `category` 기본값 `'community'`로 기존
  17개 소재는 회귀 없음.
- **콘텐츠 책임 고지**(사장 제안): 신청서 폼에 카테고리별 경고 문구 추가(밈="특정
  인물·회사·단체가 특정되지 않게", 지식="사실관계 확인 책임은 신청자에게"). 이용약관
  (`TermsModal.tsx`)에 **제7조(이용자가 입력한 콘텐츠에 대한 책임)** 신설 — 명예훼손·
  허위사실·저작권침해·과장광고 금지 및 이용자 본인 책임 명시(기존 면책·분쟁해결
  조항은 8·9조로 순연).
- **어드민(`ShortsAdminPanel.tsx`)**: `CATEGORY_LABEL` 뱃지 추가(language 뱃지와 동일
  패턴, `purple` 계열로 구분).

### 실사용 검증 중 발견한 버그 3건

- ★**리서치·시나리오가 신규 `topic` 필드를 무시하던 버그**: `run_research`/
  `generate_scenarios`가 `form.get('biz'/'target')`만 참조하도록 설계돼 있어, 사진없는
  카테고리(topic만 입력)로 실제 신청했더니 완전히 엉뚱한 소재(입력="기준금리 인하가
  월급에 미치는 영향" → 결과="시간 관리 팁")로 리서치·시나리오가 생성되는 버그를
  실사용 중 발견. 두 함수에 `category in (insight/wellness/meme)` 분기를 추가해
  `topic` 기반 쿼리·프롬프트로 전환해 해결(재현 테스트로 topic과 일치하는 시나리오
  생성 확인).
- ★**API 무한대기(hang) 실사고**: 지식/웰니스/밈 3개 카테고리를 동시에 처리하며
  로그에서 `429 RESOURCE_EXHAUSTED`(Vertex AI 쿼터 초과)를 확인 — 사진없는 카테고리는
  세그먼트마다 이미지를 전량 새로 생성해야 해서 나노바나나 API 호출이 급증, 쿼터
  소진으로 API 응답이 극도로 느려지거나 멈춤. **근본 원인**: `shorts_maker_worker.py`의
  Gemini API 호출 6곳(`generate_content`/`generate_videos`) 전부 타임아웃 설정이
  없어서, API가 응답을 안 주면 프로세스가 20분 넘게 무한정 멈춤 — 유일한 안전장치
  `_reset_stale`(30분)은 DB 상태만 되돌릴 뿐 실제 멈춘 프로세스는 서버에 계속 남음.
  `config.py`(`get_gemini`)와 `homepage_worker.py`(`_image_client`, 나노바나나용)의
  클라이언트 생성 시 `http_options=types.HttpOptions(timeout=180_000)`(3분) 추가 —
  정상 API 호출(수 초~수십 초)엔 전혀 영향 없음을 실측 확인. shorts_maker뿐 아니라
  서버2에서 Gemini를 쓰는 모든 워커에 적용되는 근본 안전장치.
- ★**과금 안내 문구가 실제 DB 등록값과 다름**: 화면(intro 배지·신청 버튼·시나리오
  선택 화면)에 "300P/1,500P"로 표시돼 있었으나, `MenuLimit` DB 실제 등록값은
  "100P/3,000P"(사장이 화면 보고 직접 발견). 코드의 fallback 상수(`RESEARCH_
  FALLBACK_COST`/`PRODUCE_FALLBACK_COST`)도 300/1500으로 DB값과 다르게 하드코딩돼
  있어 함께 정정. 화면 문구 3곳+fallback 상수 모두 실제 등록값(100P/3,000P)으로 수정.
- 3개 카테고리(지식·웰니스·밈) 완성본을 실제 워커 파이프라인으로 만들어 텔레그램
  전송+어드민 보관 검증 완료. 소재와 생성된 시나리오가 정확히 일치함을 확인
  (기준금리 인하/식사순서·혈당/재택근무 착각).

배포(5차, 2026-07-25): rag(`ca12775`, 서버2 직접 push, 크론 자동반영)·shorts-factory
(서버2 직접, git 저장소 아님, `make_short.py`+`NotoSansSC-Regular.ttf` 신규, 즉시반영)·
shared-api(`9124222`+`12474f9`, 서버1 git pull+`npx pm2 restart shared-api`)·ai_mp
(`f97697f`+`3be5771`+`7a63f67`+`5dc61e5`, master push, Vercel — Promote to Production
필요).

## 쇼츠 QR 딥링크 — 바이럴 수리 후 재검증 (2026-07-28)
바이럴 딥링크(`?f=`) 파손을 수리하면서(=referral_system.md) **쇼츠 End Card QR도 같은 경로를
쓰므로 함께 검증**했다. QR은 `ADMIN_TOPIC_CTA_URL`이 `https://aichat.dbzone.kr/?f={key}&ref=youtube`
로 만들고, 이 `?f=` 처리는 공유 링크와 **완전히 동일한 코드 경로**를 탄다.
- `ADMIN_TOPICS` 17개 키 전수 검증 → **전부 정상 도착**(진입경로 누락 0).
- 단 `golf-swing`·`learn`은 `FEATURES_GRID`(메인 카드)에 **없는** 키다. 그래도 동작하는 이유는
  딥링크 known 판정이 `FEATURES_GRID.some(...) || !!FEATURE_BY_KEY[key]`라서 `personaFeatures.ts`의
  `FEATURE_BY_KEY`로 통과하고, `featureBoardOpeners`에도 등록돼 있기 때문. **이 둘 중 하나라도
  빠지면 조용히 무시된다**(`known` false면 `setPendingDeepLink(null)`로 끝) — 새 소재 추가 시 주의.
- ★같은 날 `swing` 키 버그를 고쳤지만 쇼츠는 `golf-swing`을 쓰므로 무관했다. 두 키가 공존하는
  이유: `swing`=메인 카드 키, `golf-swing`/`golf-record`=설아 채팅 내 기능버튼 키. **지우면 안 됨.**

## 실화면 캡처 파이프라인 신설 (2026-07-29, 사장 지시)

**문제**: `ADMIN_TOPICS`는 소재를 `biz`/`strengths`/`target` **글자 3줄**로만 정의해, AI가
매번 장면을 상상해 그렸다. 그런데 사이트에는 타로 카드 **셔플 애니메이션**(translate ±46px /
rotate ±14도)·**뒤집기**(`tarotFlip`, rotateY 90→0deg)·페르소나 **유나** 이미지·리딩 보고서가
**살아 움직이는 채로 이미 있었다**. 상상시키니 결과가 흔들리고(`seg1·seg3 재생성 검수 실패`
반복) 영상 속 인물이 실제 서비스와 따로 놀았다.
※ 역전 현상: 구식 경로(`arin_script.TOPICS` hair/outfit)는 `images` 배열로 실제 견본을 쓰는데,
개선판인 `ADMIN_TOPICS` 17개가 오히려 자산을 덜 쓰고 있었다.

**신설**: `shorts-factory/capture_feature.cjs` (Playwright, ai_mp `node_modules` 경로 명시)
- 9:16(1080x1920)으로 운영 사이트 로그인(`localStorage.token` 주입) → `?f=tarot` 딥링크 →
  카드 섞기 → 3장 뽑기(플립) → 스틸 6컷. 시나리오는 `SCENARIOS` 딕셔너리에 소재별로 둔다.
- **모달만 크롭**: 전체 화면(1080x1920)을 그대로 넣으면 정작 카드 모달이 손톱만해져
  "뭘 보여주는지 모르는 영상"이 된다(1차 결과 실측). `.fixed.inset-0` 박스+여백 40px만 잘라
  528x505로 저장 → 카드 이름까지 읽힌다.
- ★★**배경 블러(개인정보)**: 캡처 계정의 지난 대화가 모달 뒤에 그대로 읽히는 상태로 찍혔다.
  `<style>` 규칙은 Tailwind와의 특이도 싸움에서 밀려 **`!important`를 붙여도** computed
  filter가 `none`이었다 — **인라인 `style.setProperty(..., 'important')`** + 300ms 재적용으로 해결.
  첫 페인트부터 걸어야 한다(`addInitScript`).
- **종합 리딩 단계는 캡처 제외**: 버튼을 누르면 모달이 닫혀 크롭 기준이 사라지고 채팅 전체가
  드러난다. 리딩 결과는 자막·나레이션으로 설명한다.
- **녹화 영상 기본 OFF**(`CAPTURE_VIDEO=1`로 켬): 스틸은 모달만 크롭해 안전하지만 녹화본은
  모달 밖·로딩 구간까지 통째로 담긴다. 파이프라인이 쓰는 건 스틸뿐이라 위험만 남기지 않는다.

**연결**: `rag/shorts_maker_worker.py`
- `ADMIN_TOPICS["tarot"]`에 `capture`·`persona_id`(유나 `cmr7a072h0000jwbezom9bi9v`) 추가.
- `_capture_feature_shots()`가 스틸을 `raw_list`로 실어 **`isProduct=True`**로 태운다 →
  기존 상품 안전망(원본 강제 배정·`scene_prompt` 무시)이 그대로 작동해 **AI가 새로 상상하지
  않는다**. 신규 분기 없이 검증된 코드를 재사용.
- ★캡처 실패는 예외를 올리지 않는다 — 품질 향상이지 필수가 아니다. 실패 시 `raw_list`가
  비어 기존 AI 생성 경로로 자동 폴백(제작이 멈추지 않음).

**어드민 UI 보정** (`ShortsAdminPanel.tsx`, ai_mp `50642d3`)
- 소재 선택+"지금 생성"은 **이미 있었고**(`shared-api → agent-api → manual_run.py →
  run_admin_topic`), 이번 작업이 자동으로 그 버튼에 연결됐다. 만들 게 아니라 어긋난 걸 고쳤다:
- **🎬 배지**(`CAPTURE_TOPICS`)로 실화면 캡처 소재 구분 — 그 외는 AI 생성이라 성격이 다른데
  화면상 구분이 없었다. ★소재 추가 시 `ADMIN_TOPICS.capture`와 함께 갱신할 것.
- 안내 "약 1~2분" → **"10~20분"**(실측). 폴링 20틱(~3분) → **125틱(~25분)** — 결과가 나올
  무렵 갱신이 멈춰 수동 새로고침해야 했다.

**결과**: `SHORTS-20260729-190936`(35.5초, 7세그먼트) — 텔레그램 승인요청 + 어드민 승인대기
등록(`pending.json` 공통 소스). **재생성 검수 실패 0건**(이전 동일 소재는 seg1·seg3 반복 실패).

**남은 일**: 캡처 시나리오가 붙은 소재는 타로뿐. 나머지 18개는 조작 경로가 달라 하나씩
작성해야 한다(헤어=사진 업로드→스타일 선택, 웹툰=회차 열기). 화면이 볼거리인 것부터 권장.

## 실화면 캡처 2차 개선 — 유나 소개 컷·효과음·QR 목적지 (2026-07-29, 사장 지적 3건)

**① 유나가 영상에 없었다** — 1차 결과에서 화면이 손톱만해 "모달만 크롭"으로 고쳤는데,
**모달 바깥(화면 좌측)에 있던 페르소나 이미지가 함께 잘려나갔다.** 크기 문제를 고치면서
정작 "누가 봐주는지"를 잃은 것. ★고칠 때 **잃은 것**도 확인해야 한다(커진 것만 보고 넘어갔다).
→ `?p=<페르소나ID>` 딥링크로 **소개 모달**(원형 프레임 속 얼굴+이름+한 줄 소개+기능칩+CTA)을
   `00_persona` 컷으로 캡처해 맨 앞에 배치. 친구초대 링크가 쓰는 것과 같은 화면이다.

**② 효과음** — 사이트에 넣은 카드 소리(`public/sounds/`)를 영상에도 얹었다.
- ★**Playwright 화면 녹화는 오디오를 담지 못한다**(실측: 스트림이 `vp8,video` 뿐).
  "녹화를 켜면 조작음이 들어간다"는 예상이 틀렸다 → **조립 단계에서 직접 믹스**로 전환.
- `make_short.py`에 `mix_sfx()`·`build_sfx_cues()` 신설. 세그먼트 시작 시각(`seg_starts`)에
  맞춰 배치하고 `adelay`+`amix`(★`normalize=0` 필수 — 없으면 나레이션이 통째로 작아진다).
- ★**셔플·차임만 넣는다**(사장 결정): 나레이션+BGM 위 세 번째 소리라, 카드 뽑기 3회까지
  넣으면 26초 영상에 5번이 끼어들어 나레이션이 묻힌다. "장면이 바뀌는 순간" 두 곳만.
- 검증: 삽입 지점에서만 음량 상승(5.0s −7.3→−6.9dB), 나머지 구간은 원본과 동일.
- `SHORTS_SFX=off`로 끌 수 있고, 파일이 없거나 믹스가 실패해도 영상은 그대로 남는다.

**③ QR 목적지·유입코드** (사장 지적: "친구초대 페르소나 링크가 소개 이미지 예쁘게 나온다")
- 전: `?f=tarot&ref=youtube` → 카드 모달 직행(**누가 봐주는지 모른 채** 시작)
- 후: `?p=<유나ID>&ref=SHORTS_TAROT` → **유나 소개 카드**. 영상 첫 컷과 같은 화면이라
  QR을 찍으면 "영상에서 본 그 사람"으로 이어진다. `_cta_url()`이 `persona_id` 유무로 분기.
- ★**유입 코드 세분화**: 전엔 모든 쇼츠가 `youtube` 하나라 **어떤 영상이 데려왔는지 알 수
  없었다** — 소재 19개인데 다음에 뭘 만들지 정할 근거가 없다. `SHORTS_<소재>`로 분리하고,
  shared-api는 화이트리스트 나열 대신 **접두사 규칙**(`CHANNEL_PREFIXES=['SHORTS_']`)으로
  받는다(소재 추가 때마다 동기화하는 걸 반드시 잊기 때문). 프론트 `isChannelRef`도 동일 규칙.
- 덤: 어드민 채널 집계 쿼리에 **`KIN`이 빠져 있어 지식iN 유입 50건이 화면에 안 보이던 것**도
  함께 수정(shared-api `ffd3cc9`).

**결과**: `SHORTS-20260730-000527`(26.5초, 7세그먼트) — 유나 등장·효과음 2개
(`shuffle@3.6s`, `reveal@22.4s`)·새 QR 전부 프레임/파형/URL로 검증 후 텔레그램+어드민 등록.

## 실화면 캡처 전 소재 확장 + 콜라주 해제 (2026-07-29 3차, 사장 지시)

**① 콜라주 해제** — 사장 지적 "2장 나란히라 각각이 작다".
원인: 캡처 스틸을 `isProduct` 안전망에 태웠는데 **그 모드 규칙이 "오프닝은 사진 2장 이상이면
콜라주로 구성하라"**였다. 실물 상품은 여러 각도를 한 화면에 모으는 게 이득이지만,
**서비스 화면은 각 컷이 읽어야 하는 UI**라 나란히 놓으면 글자가 안 보인다 — 성격이 다른 걸
같은 규칙에 태운 것.
→ `isCapture` 플래그 신설. **두 겹**으로 막는다:
  ⓐ프롬프트 "image_index를 배열로 담지 마세요" ⓑ`render_scene_images` 안전망에서 배열이
  들어와도 첫 원소만 남겨 강제 해제(상품 모드에서 LLM이 프롬프트를 어긴 전례가 있다).
  CTA 컷과 상품 모드 콜라주는 건드리지 않는다(회귀 없음, 단위 검증 완료).

**② 전 소재 확장** — 사장 지적 "어차피 앞에서 소재를 고르니 전부 이 방식으로".
- `TOPIC_PERSONA` 신설 — 17개 소재 ↔ 담당 페르소나 ID 매핑(프론트 `FEATURES_GRID`의
  personaName과 DB `Persona.id`를 대조해 작성).
- `capture_feature.cjs`에 **`generic` 시나리오** 추가 — 전용 시나리오가 없는 소재도
  `?p=` 딥링크로 **소개 화면만은 실제 캡처**한다. 소재별 조작 경로를 전부 짜는 데는
  시간이 걸리는데, 그때까지 나머지가 "AI가 상상한 낯선 인물"로 나가는 게 더 나쁘다.
- 결과: 17개 전부 `capture=generic`(타로만 `capture=tarot`로 카드 조작까지), QR도 전부
  `?p=`(소개 화면)로 통일. 페르소나 미연결 0건.
- ★**채팅 화면은 캡처 대상에서 제외**(실측 판단): 개인정보 블러를 걸면 화면 전체가 흐려져
  **소재로 쓸 수 없고**, 블러를 풀면 회원 대화가 노출된다. "보여줘도 되는 화면"만 찍는다.

**③ 어드민** — 🎬 배지를 17개로 확장(hair·outfit은 구식 파이프라인이라 제외).
안내 문구도 실제에 맞춤: "담당 페르소나 소개 화면이 기본이고, 타로는 카드 조작까지".

**남은 일**: 기능 내부까지 보여주려면 소재별 전용 시나리오가 필요하다(타로가 참고 사례).
화면이 볼거리인 것부터 권장 — 헤어(사진 업로드→스타일 선택)·프로필사진·웹툰(회차 열기).

## 🎁 개인용 영상 옵션 — SHORTS_BRAND (2026-07-31)

가족 축하 카드 같은 **개인용 영상**을 이 파이프라인으로 뽑을 때, 마케팅용 기본값이 그대로
붙어 나오는 문제가 있어 환경변수를 추가했다. (딸 생일 축하 쇼츠 제작 중 실측으로 발견)

- **`SHORTS_BRAND`** — 상단 브랜드 배지 문구. 기본값 `"AI 놀이터 · aichat.dbzone.kr"` 유지라
  **기존 마케팅 쇼츠 동작에는 영향 없다**. 빈 문자열이면 배지를 통째로 생략한다(`make_short.py` 2곳).
- 개인용으로 뽑을 때 함께 꺼야 하는 것들:
  | 항목 | 기본 동작(마케팅용) | 개인용 설정 |
  |---|---|---|
  | 카드 문구 | `card_text` 미지정 시 **"지금 시작해보세요"** 폴백 | 대본에 `card_text` 명시 |
  | 상단 배지 | "AI 놀이터 · aichat.dbzone.kr" | `SHORTS_BRAND=""` |
  | 효과음 | 타로 카드 소리 삽입 | `SHORTS_SFX=off` |
  | BGM | `assets/bgm/`에서 **무작위**(코믹곡 포함) | `SHORTS_BGM=off` 후 `mix_bgm()`으로 직접 지정 |

- ★**BGM은 랜덤이라 톤이 안 맞을 수 있다.** 현재 3곡 모두 Kevin MacLeod 경쾌한 곡이며,
  그중 `Carefree.mp3`가 가장 잔잔하다. `Monkeys_Spinning_Monkeys`·`Fluffing_a_Duck`은 코믹 톤이라
  축하·감성 영상에 부적절.
- ★**이모지는 자막에 넣지 말 것** — Pretendard에 이모지 글리프가 없어 `🎂`가 **▤(tofu)로 깨진다**.
  (일본어·중국어 한자 깨짐과 같은 원인 계열, 07-25 이력 참고)
- ★**로그의 "✅ 완성"은 내용을 보증하지 않는다.** 반드시 프레임을 추출해 **눈으로 보고** 내보낼 것:
  ```bash
  bin/ffmpeg -ss <초> -i out/x.mp4 -frames:v 1 -vf scale=360:-1 -y /tmp/f.png
  ```
  (첫 산출물에서 워터마크·마케팅 문구·코믹 BGM 3건이 이 방식으로 걸러졌다)

---

## 🧩 카테고리 프롬프트 레지스트리화 + 학습 계층 + 음성 선택 + 생일축하 (2026-08-02, 사장 지시)

사장 지시 **"카테고리별로 프롬프트가 세분화돼 관리되는지 확인, 각 쇼츠 생성별로 별도 관리되면 좋겠다"**
→ 확인해보니 **세분화는 돼 있었지만 한 곳에 모여 있지 않았다.** 이어서 학습·음성·생일축하까지 순차 진행.

### ① 카테고리 레지스트리 `CATEGORY_SPECS` (rag `098bada`)

**문제** — 같은 카테고리 설명이 세 곳(`run_research`·`generate_scenarios`·`build_script_draft`)에
중복돼 톤을 바꾸려면 셋을 다 고쳐야 했다. 더 위험한 건 `if category in ('insight','wellness','meme')`가
두 곳에 하드코딩돼 있어 **새 카테고리를 추가하면 그 if문들도 전부 손봐야 했다는 점** —
하나라도 빠뜨리면 에러가 아니라 **조용히 `community`로 폴백**해 엉뚱한 대본이 나온다.

```python
CATEGORY_SPECS: dict[str, dict] = {          # shorts_maker_worker.py 상단
    'community': {'needs_topic': False, 'research_kind': '', 'scenario_kind': '', 'tone': '...'},
    ...
}
def category_spec(form) -> dict:              # 모르는 값이면 community 폴백
```

| 필드 | 용도 |
|---|---|
| `research_kind` | 리서치 쿼리에 넣을 콘텐츠 유형 (needs_topic=True에서만 사용) |
| `scenario_kind` | 시나리오 프롬프트에 넣을 유형 (″) |
| `tone` | 내레이션 문체·가드레일 — **전 카테고리 공통으로 대본 단계에서 사용** |
| `needs_topic` | True면 biz/strengths/target 대신 topic만 받음 |

**새 카테고리 추가 절차(3곳 — 워커가 나머지를 대신할 수 없다)**
1. `rag/shorts_maker_worker.py` → `CATEGORY_SPECS`에 블록 1개
2. `frontend/components/ShortsMakerBoard.tsx` → `Category` 타입 · `CATEGORIES` · `NO_IMAGE_CATEGORIES` · `TOPIC_LABEL`
3. `shared-api/routes/aimp/shorts-maker.ts` → `Category` 타입 · `CATEGORIES` · `NO_IMAGE_CATEGORIES`

### ② 학습 계층 — 프롬프트 4겹 (rag `7b174cf`)

사장 지시 "트렌드가 바뀌는데 확장이 될 수 있으면 좋겠다".

```
①공통 규칙(인라인)  ②카테고리(CATEGORY_SPECS)  ③트렌드(ShortsTrend)  ④사용자지정(ShortsUserPref)
```

- `build_learning_block(form, user_id)` — ③④를 조립해 `category_tone`에 이어붙임
- `process_produce`가 `form['_userId']`를 실어 보냄(시그니처 변경 최소화, 조회 키로만 사용)

**★설계 원칙: ③④는 "있으면 얹고 없으면 지나간다"**
트렌드가 리서치를 *대체*하도록 짜면 **테이블이 비어 있는 동안 오히려 품질이 떨어진다.**
그래서 **보강만** 한다. 조회 실패도 삼킨다 — 학습 계층 때문에 제작이 실패하면 본말전도.
검증도 "빈 상태에서 학습블록 0자 = 기존과 완전 동일"부터 확인했다.

**★리서치 결과가 버려지고 있었다** — `UserShorts.researchJson` 컬럼은 있는데 **쓰는 코드가 없어
실측 0건.** 매 요청 검색비를 들이고 결과를 폐기 = 100번 만들어도 101번째가 나아지지 않는 구조.
학습 원재료라 `process_research`에서 저장하도록 수정.

| 테이블 | 용도 |
|---|---|
| `ShortsTrend` | 카테고리별 축적 트렌드(최신 활성 1건 사용) |
| `ShortsUserPref` | 회원별 톤·금지어. **카테고리 전용 > 공통(category IS NULL)** 우선 |

### ③ 어드민 음성 선택 (shared-api `6f413d4`, ai_mp `cb72aae`)

사장 요청 "성별·나이별 음성 선택" → 실측: **ko-KR Chirp3-HD 남 13·여 14개**(기존 `Leda` 1개 고정).

**★나이는 Google TTS에 파라미터가 없다.** "20대/40대" 라벨을 붙이면 실제 결과와 어긋나는
**거짓 표기**가 된다. 그래서 넣지 않고 화면에 이유를 명시했다. 대신 사장 요청대로
**직접 들어보고 고르는 화면**을 만들었다(개발자가 소리를 들을 수 없는 종류의 판단).

- `ShortsVoicePanel.tsx` — 성별별 후보 + ▶미리듣기 + 저장
- `GET /admin/shorts/voices?lang=ko` · `POST /admin/shorts/voice-preview`(mp3 반환, 저장 안 함)
- 저장은 **기존 `AppConfig`** (`shorts_voice_{lang}`) 재사용 — 새 테이블 없음
- `api/math-tutor-tts.ts`가 저장값을 읽어 씀 → **쇼츠 전 소재(회원용·자동생성)에 함께 적용**.
  없거나 조회 실패 시 기존 기본값 폴백(설정 때문에 TTS가 멈추면 안 됨), 언어 접두사 일치 값만 채택
- ★`voiceName`은 **후보 화이트리스트에 있는 값만** 허용 — 임의 문자열이 외부 TTS API로 나가지 않게

### ④ 생일축하 카테고리 (rag `654174b`, shared-api `ff6c92e`·`f6b4bcf`, ai_mp `bba28c0`)

①의 효과로 **워커는 dict 블록 하나 추가만으로 세 지점이 따라왔다.**

**★다른 카테고리와 성격이 근본적으로 다르다** — 나머지는 불특정 다수 대상 홍보·정보물인데
이건 **특정 개인에게 보내는 축하**. 그래서 둘을 다르게 잡았다:

- **사진을 받지 않는다**(`NO_IMAGE_CATEGORIES`) — 특정 개인의 얼굴 사진은 초상권·개인정보
  취급이 달라진다. 이름+메시지로 충분히 성립하고, **나중에 넓히는 건 쉽지만 반대는 어렵다.**
- **나이·외모·결혼/취업 언급 금지** — "벌써 마흔이네"가 자동 생성되면 **축하가 놀림이 된다.**
  홍보 문구 삽입, 입력 안 받은 개인정보(직업·가족관계) 창작도 금지.
- 화면 문구도 분기 — 축하 영상에 "타인의 권리 침해" 경고는 어긋나므로
  "공개된 곳에 올릴 때는 본인 동의를 받는 게 좋아요"로. 서버 에러도 "누구의 생일인지 적어주세요"로 일치.

### ⑤ community/product 톤 채움 + **버그 수정** (rag `7b7ddea`)

**★버그: `category_tone`이 "사진 없음 + use_veo=False" 분기 안에만 삽입돼 있었다.**
즉 **사진을 올리는 경로에서는 카테고리 톤이 프롬프트에 아예 들어가지 않았다.**
기존 3종은 사진을 안 받는 카테고리라 증상이 드러나지 않았지만, 사진 기반 2종 톤을 채우면
**정작 그 카테고리에서 도달하지 못할 뻔했다.** → 모든 경로가 지나는 `[요구사항]` 블록으로 이동(삽입 1회).

| 카테고리 | 톤 | 핵심 가드레일 |
|---|---|---|
| community | 168자 | 회비·일정·자격조건·회원수 창작 금지(틀리면 바로 문의로 이어져 신뢰 상실) |
| product | 214자 | 효능·수치·성분·수상경력 창작 금지, "최고/1위/유일"은 신청자가 직접 적은 경우만 |
| insight | 185자 | 오정보 방지 |
| wellness | 125자 | 의료광고 리스크 |
| meme | 136자 | 비방 금지 |
| birthday | 243자 | 나이·외모 언급 금지 |

**★톤은 "말투"만 다룬다** — 화면 구성은 `image_rule`이, 분위기는 사용자가 고른 `mood`가 이미
담당한다. 여기서 구도·분위기를 또 지시하면 셋이 서로 밀어낸다. 그래서 겹치지 않는 것,
**"무엇을 말하지 말 것인가"** 에 집중했다.

> ⚠️ community·product는 **톤이 처음 들어가므로 다음 제작분부터 대본 말투가 달라진다**(담백해지는 방향).
> 마음에 안 들면 `CATEGORY_SPECS` 한 곳만 고치면 된다.

### 이번 작업의 교훈

- ★**"세분화돼 있다" ≠ "한 곳에서 관리된다"** — 분기 조건이 코드에 흩어져 있으면 새 항목 추가 시
  **에러 없이 조용히 폴백**한다. 레지스트리(dict)로 모으고 플래그로 판정할 것.
- ★**프롬프트 조각이 "정의됐다" ≠ "도달한다"** — 값이 있는지만 보지 말고 **최종 프롬프트 문자열에
  실제로 포함되는지** 전 분기 조합으로 확인할 것(위 ⑤ 버그가 그 사례).
- ★**리팩터링은 "결과가 같음"을 실측으로 증명하라** — 수정 전 파일을 git에서 꺼내 조각별
  **바이트 단위 대조**(9개 전부 일치). "옮기기만 했으니 같겠지"는 근거가 아니다.
- ★**모델·API가 지원하지 않는 축을 UI 라벨로 만들지 마라** — 나이 파라미터가 없는데 "20대"를
  붙이면 거짓 표기. 지원되는 축만 노출하고 나머지는 **사람이 직접 확인하는 화면**을 줄 것.

## 🎂 생일축하 사진 옵션 2차 — 가족/케이크 사진 선택 첨부 + 재해석 (2026-08-02 2차)

전체 아키텍처 검증(사장 요청 "확장 가능하게 만들어졌는지 확인") 결과 레지스트리·학습계층·
프롬프트 도달은 실측으로 문제없음을 재확인. 이어서 생일축하를 "사진 아예 안 받음" →
"가족사진·케이크사진 선택 첨부"로 확장(사장 지시: 케이크는 처음/마지막 옵션으로,
인물은 가족사진으로 넓히고 재해석은 '프로필사진' 기능의 화풍을 참조해서 선택).

### 설계 — 상품모드 안전망을 재사용, 새 로직은 최소화

birthday를 `NO_IMAGE_CATEGORIES`에서 빼고 **`OPTIONAL_IMAGE_CATEGORIES`**로 신설(둘 다
"필요"가 아니라 "선택"이라 하나로 합치면 UI 배지·검증 문구가 어긋난다).

- **가족사진**(선택, 최대 3장) — 기본은 원본 그대로(재해석 OFF), 사장 결정에 따라
  **"AI 스타일로 재해석" 옵션**(기본 OFF)을 추가. 켜면 새 프롬프트 세트를 만들지 않고
  **'프로필사진'(outfit) 기능의 `OutfitStyle.promptEn`을 그대로 참조**(`load_outfit_style_prompt`,
  `rag`) — 실사·지브리풍·픽사풍 등 이미 실전 검증된 화풍을 재사용. 합성 API
  (`generateProfilePhoto`)는 호출하지 않고 프롬프트 문자열만 빌려 쓴다.
- **케이크사진**(선택, 1장) — ★항상 재해석 금지. 그날의 진짜 케이크가 다른 케이크로
  바뀌면 안 되므로, 상품모드(`isProduct`)와 동일한 "실물 절대 재해석 안 함" 원칙을 그대로
  적용. `cakePosition`('start'|'end')이 가리키는 세그먼트(오프닝 또는 CTA 직전)에 코드
  레벨로 강제 배정.
- **케이크·가족사진은 shared-api의 `imagePath`(JSON 배열) 한 컬럼에 그대로 실어 보낸다**
  — 케이크는 배열 맨 뒤에 붙이고 `hasCakePhoto` 플래그로 "마지막 원소=케이크"를 표시.
  새 컬럼을 안 만들고 기존 스키마로 흡수.

### 3중 안전망 (LLM이 지시를 어겨도 케이크가 재해석되지 않도록)

과거 상품모드 실사고(2026-07-23 "디올 지갑" 지퍼 사고, 2026-07-25 "은비" 모래글자 사고)와
같은 계열의 위험이라 **같은 강도로 방어**했다:

1. `build_script_draft` 말미 — 케이크 인덱스가 배정된 세그먼트 외 다른 곳에 이미 쓰였으면
   회수하고, 지정 위치(`cake_position`)에 `image_index` 고정 + `scene_prompt=None` 강제.
2. `render_scene_images` — birthday도 `is_product_seg` 예외에 포함시켜, 이미 확정된
   `image_index`가 "이미 쓰인 인덱스" 중복 체크로 재생성(②) 경로로 새지 않게 함.
3. `process_produce` 재시도 루프 — 완성본 검증 NG 시 재시도하는 경로에도 birthday를
   `is_product`와 동일하게 포함시켜, `backup["scene_prompt"]`가 남아있어도 케이크가
   재생성되지 않게 함(2026-07-25 "검증NG 재시도 경로 우회" 재발 방지 패턴 재사용).

부가로 `_verify_final_video`의 "AI/기술 시각요소 필수"(②) 기준을 birthday에서 제외 —
이 기준은 마케팅 쇼츠의 무인물 인서트 규칙이라, 축하 영상(케이크·꽃·풍선)에 그대로 적용하면
매번 불필요하게 NG 판정돼 원가만 낭비하는 재시도가 발생했을 것.

### 검증 방법

- **워커**: Gemini API를 Fake 클라이언트로 대체해 `build_script_draft`를 8개 시나리오
  (사진 없음/가족만/케이크만/가족+케이크 시작·끝/재해석 켬·끔/LLM이 케이크 인덱스를
  엉뚱한 곳에 배정하고 scene_prompt까지 채우는 "규칙 위반" 시뮬레이션)로 직접 호출해
  최종 `image_index`/`scene_prompt` 배정을 실측 — 전 케이스 정상, 규칙 위반 시뮬레이션도
  안전망이 정확히 회수함을 확인.
- **프론트**: `index.tsx`에 임시 라우트(`/dev-shorts-test`)를 만들어 `ShortsMakerBoard`를
  로그인 없이 격리 마운트(이 개발 환경은 프로덕션 DB 네트워크가 막혀 있어 실제 로그인·
  회원가입 플로우 재현이 불가능했음 — DB 접근이 필요한 모든 API 호출이 타임아웃됨을
  먼저 확인 후 우회). Playwright로 가족사진·케이크사진 업로드, 재해석 체크박스 클릭 시
  `/api/outfit/styles` 호출까지 스크린샷과 함께 확인. 검증 완료 후 임시 라우트는 완전히
  원복(git diff 없음).
- ★**실사용 중 발견**: 카테고리 카드의 "✍️ 사진 불필요" 배지·설명 문구가 `NO_IMAGE_CATEGORIES`
  이진 판정 그대로 남아 있어, 실제로는 "선택"인데 화면엔 "불필요"로 표시되는 걸 스크린샷
  검증 중 발견 — 배지 로직을 3단계(불필요/선택/필요)로 확장하고 문구도 정정.

### 남은 일

- `ShortsTrend` 테이블에 콘텐츠를 채우는 파이프라인이 아직 없음 — 리서치 결과
  (`researchJson`)는 이제 저장되지만, 이걸 사람이 골라 트렌드로 승격시키는 절차가 없어
  "학습" 배관은 뚫려 있어도 아직 내용물이 안 채워지는 상태.

커밋 전 상태(2026-08-02, 이 세션 종료 시점): `rag/shorts_maker_worker.py`(+139/-13)·
`shared-api/routes/aimp/shorts-maker.ts`(+47/-6)·`ai_mp frontend/components/
ShortsMakerBoard.tsx`(+146/-17 두 파일 합산)·`apiService.ts` 수정 완료, 아직 커밋 전.

## 💎 요금제 개편 + 5초 미리보기 + Veo 폐지 (2026-08-02 3차, 사장 지시)

사장 지시 "5초 분량 먼저 만들어 보여주고 결제하면 나머지 만들기 + 시나리오 100P는
유지하되 요금제를 스탠다드(3000원)/프리미엄(5000원) 2단계로 단순화, 배경음악 유무로
차등"을 시작으로 여러 차례 논의를 거쳐 최종 설계가 크게 바뀌었다. 아래는 확정된 최종본.

### 논의 경위 — 세 번 뒤집힌 결정들

1. **차등 기준**: "BGM 유무" → 논의 중 "BGM 원가가 거의 0이라 가격 차이를 설명 못 한다"는
   지적으로 **BGM은 둘 다 포함**, 대신 **완성본 검증 재시도 횟수(1회 vs 2회)** + **결과물
   개수(1개 vs 2개 중 선택)**로 교체.
2. **프리미엄 2개의 성격**: "같은 화풍, 구도만 다르게" → 사장 반문("고급이면 화풍이 다른 걸
   좋아할 것 같은데?") → **화풍이 다른 2개**로 변경 → 다시 "사용자가 스타일을 이미 골랐으면
   어떻게 하나" 문제 발견 → 최종: **프리미엄은 스타일을 사용자가 직접 2개 선택**(AI가
   임의로 정하지 않음, 스탠다드는 0~1개 선택).
3. **Veo 옵션**: 애초 계획엔 없었으나, 프리미엄 차별화 논의 중 사장이 "Veo가 품질도 안
   나오고 비싸기만 한 것 같다"고 지적 → 실측 이력(2026-07-24, 손가락 왜곡 반복) 재확인 후
   **완전 폐지**로 결론(선택지 자체를 없앰, 추가과금 옵션도 제거).

### 확정 최종 설계

**요금제**: 스탠다드 3,000P / 프리미엄 5,000P (기존 "제작 2,000P+Veo 1,000P" 체계 대체)

| 항목 | 스탠다드 | 프리미엄 |
|---|---|---|
| 나레이션 TTS + BGM | 포함 | 포함 |
| 스타일 선택 | 0~1개(안 고르면 AI가 알아서) | **정확히 2개 선택 필수** |
| 완성본 검증 재시도 | 1회 | 2회 |
| 결과물 | 1개 | **화풍 다른 2개 중 최종 선택** |
| Veo(실사영상) | **완전 폐지** — 전 회원 대상, 옵션 자체 없음 |

**흐름 재설계**: `pending→scenarios_ready→`(신규)`previewing→preview_ready→`(신규,
과금 시점)`producing→done`. 시나리오 5개 생성(100P)은 그대로 유지 — 그 아래에 **무료
5초 미리보기 단계**를 끼워 넣어 "결제 전 실물 확인"을 가능하게 했다.

### 원가 검토 (구현 승인 전 실측 없이 견적만)

이미지 재생성(나노바나나 $0.067/장)·TTS·Vision 검증 API 단가로 역산: 스탠다드 원가
약 700~800원(마진 75%+), 프리미엄은 이미지를 2벌 생성해 원가 약 1,400~1,550원(마진
70%대) — 두 가격 모두 충분한 마진 확보를 확인 후 그대로 진행.

### 구현 — 워커 (`rag/shorts_maker_worker.py`, +336/-234)

- **Veo 관련 코드 전량 삭제**: `_generate_veo_clip`·`_extract_last_frame` 함수 제거,
  `build_script_draft`의 `use_veo` 매개변수 제거(항상 정지이미지 경로), 프롬프트의
  Veo 관련 삼항 분기 전부 정리.
- **`load_outfit_style_prompt()` 확장 적용** — 기존엔 생일축하 전용이었던 이 헬퍼를
  `render_scene_images(restyle_key=...)` 매개변수로 받아 **커뮤니티·제품 카테고리의
  "재해석 샷 A/B" 세그먼트에도 화풍을 입힐 수 있게** 확장. `_regenerate_scene`에도
  `restyle_prompt` 인자 추가.
- **`_produce_one_video()` 신설** — 대본(`script_base`) 하나를 받아 이미지생성+TTS+조립+
  검증까지 수행하는 헬퍼로 `process_produce`에서 분리. 프리미엄은 이 함수를
  `restyle_keys[0]`, `restyle_keys[1]`로 **각각 호출**해 화풍 다른 완성본 2개를 만든다
  (대본은 `deepcopy`로 공유, 이미지 생성 단계에서만 갈라짐 — 대본 재확정 비용은 절감).
- **`build_preview_video()` + `process_preview()` 신설** — 시나리오의 hook 문장만으로
  "1세그먼트짜리 초경량 대본"을 별도로 만들어 오프닝 이미지 1장(사진 있으면 원본 재사용,
  없으면 나노바나나 1장 생성)+TTS로 5초 mp4를 조립. **완성본 검증은 생략**(원가·시간
  절약, 미리보기는 품질 보증 대상이 아님). 실패해도 예외를 삼키고 `preview_ready`로
  넘어가 핵심 흐름(결제→전체 제작)을 막지 않는다.
- **`main()` 3-way 상태 머신 확장** — `producing > previewing > pending` 우선순위로
  폴링, `_reset_stale`에도 `processing_preview`(과금 없어 환불 대신 `scenarios_ready`로
  복구) 추가.
- ★**실측 검증 중 버그 발견·수정**: `build_preview_video`가 존재하지 않는 상수
  `NO_IMAGE_CATEGORIES`를 참조해 `NameError`로 죽는 코드가 있었다(프론트/shared-api
  TS 코드에만 있는 상수를 파이썬에 그대로 옮겨 쓴 실수). 사진 있는 카테고리의 미리보기가
  **항상 조용히 실패**했을 뻔한 걸 Fake 클라이언트 모킹 테스트로 잡아 즉시 수정.

### 구현 — shared-api (`routes/aimp/shorts-maker.ts`, +206/-62)

- `PRODUCE_VEO_FEATURE` 등 Veo 관련 상수·로직 제거, `PRODUCE_STANDARD_FEATURE`/
  `PRODUCE_PREMIUM_FEATURE` 2개로 교체(MenuLimit DB에도 별도 등록 필요).
- **`POST /requests/:id/select` → `/preview`+`/confirm` 2개로 분리**: `/preview`(시나리오+
  요금제+스타일 확정, 무과금)가 `previewing` 상태로 전이시키면 워커가 미리보기를 만들어
  `preview_ready`로 바꾸고, `/confirm`(무료 미리보기 확인 후 결제)이 실제 과금+`producing`
  전이를 수행.
- `validateSelectOptions()` 신설 — 프리미엄이면 스타일 정확히 2개, 스탠다드는 0~1개
  강제하는 검증을 `/preview`에서 공통으로 수행.
- **`POST /requests/:id/select-final`** 신설 — 프리미엄 2버전 중 최종 선택(`selectedVideoSlot`
  저장).
- `GET /video`에 **`slot`·`download` 쿼리 파라미터** 추가 — `slot`으로 프리미엄 두 버전 중
  선택 스트리밍, `download=1`일 때만 `Content-Disposition: attachment` 헤더(재생용 요청과
  분리 — 재생 경로에 다운로드 헤더를 그대로 붙이면 `<video>` 재생 자체가 깨진다).
- **`GET /requests/mine` 페이징화**(사장 지시 "회원이 만든 자료는 언제나 볼 수 있어야") —
  기존 `LIMIT 30` 고정을 `offset`/`limit`+`total` 응답으로 교체. 완성본은 **영구 보관**으로
  확정(자동삭제 없음 — DB 용량은 계속 늘지만 결제한 콘텐츠가 사라지는 리스크를 피함).

### 구현 — 프론트 (`ShortsMakerBoard.tsx` +269/-, `apiService.ts` +45/-)

- `step` 상태 머신에 `plan`(요금제+스타일 확정) → `previewing`(대기) → `preview`(확인)
  3단계 신설. 시나리오 선택(`selectScenario`)은 더 이상 즉시 과금하지 않고 `plan` 화면으로만
  이동, `confirmPlanAndPreview()`(미리보기 요청)와 `confirmProduce()`(결제 확정)로 분리.
- **생일축하 전용이던 "AI 스타일 재해석" UI를 신청서 단계에서 제거**하고, `plan` 단계에
  전 카테고리 공통 스타일 선택 UI로 새로 구성(`StyleLoader` 헬퍼 컴포넌트, `outfitApi.styles()`
  1회 지연 로드). 프리미엄은 최대 2개까지만 선택되도록 자동 트리밍.
- **완성 화면에 프리미엄 2버전 비교 UI** 추가 — `hasVideo2`가 true면 두 영상을 나란히
  보여주고 `selectFinal` API로 최종 선택.
- **"더 보기" 페이징** — `mineList`/`mineTotal` 상태로 `offset` 누적 로드.
- **다운로드 링크 전부 `download: true` 쿼리 반영** — `videoUrl()` 헬퍼 시그니처를
  `(id, slot?)` → `(id, {slot?, download?})` 객체 인자로 변경(호출부 5곳 전부 갱신).

### 검증

워커는 Fake Gemini 클라이언트로 `build_script_draft`(스타일 지정 문구 유무), `render_scene_images`
(restyle_key 실제 전달), `process_produce`(스탠다드 1회/프리미엄 2회 `_produce_one_video`
호출), `process_preview`(정상/오류/내부실패 3케이스) 각각 실측 확인. 프론트는 타입체크·
React 안전검사·프로덕션 빌드 통과, 신규 UI는 정적 코드 검토로 인터페이스 필드 일치 확인
(브라우저 렌더 실측은 로그인 세션 없이는 `row`가 null이라 이번엔 생략 — 배포 후 확인 필요).

### 보류

**카카오톡 공유 기능**은 이번 세션에서 보류. 카카오톡 "공유하기" SDK는 로그인용 REST API
키와 별개로 **JavaScript 키 발급 + 디벨로퍼스 콘솔에서 카카오톡 공유 기능 활성화**가
필요한데, 이건 Claude가 대신할 수 없는 콘솔 작업이라 사장이 키를 발급한 뒤 다시 요청하기로
합의. 대신 **다운로드 기능을 확실히 하는 쪽으로 대체**(Content-Disposition 헤더 추가).

### 남은 일

- Veo 폐지·요금제 개편이 아직 **커밋 전 상태**로 세션 종료 — 다음 세션에서 커밋+배포
  (Vercel Promote to Production 포함) 필요.
- MenuLimit DB에 `shorts_maker_produce_standard`/`shorts_maker_produce_premium` 두
  feature를 실제로 등록해야 함(현재는 코드의 fallback 상수로만 동작).
- 프리미엄 2버전 UI는 브라우저 실측 검증을 못 했으므로 배포 후 실제 화면에서 재확인 권장.
- `ShortsTrend` 학습 파이프라인 공백은 여전히 미해결(2026-08-02 2차부터 이어지는 항목).

## 🎬 실사용 버그 연쇄 수정 + 목소리 선택 신설 (2026-08-03)

사장이 생일축하 쇼츠를 실제로 만들어보며 지적한 문제 4건 + 후속 기능 요청 2건.

### ① 화풍(스타일) 완전 미적용

`render_scene_images`의 상품모드 안전망(`is_product_seg = isProduct or category==
'birthday'`)이 생일축하 가족사진에도 무조건 걸려 원본 그대로만 썼다 — "실물 재해석
금지" 원칙(상품 사진용으로 설계)이 생일축하 가족사진에도 그대로 적용돼 스타일 선택이
무의미했다.

**원칙 변경**(생일축하만 해당, 사장 확인 후 진행): 스타일을 골랐으면 가족사진도
재해석 허용. **케이크는 여전히 절대 재해석 금지**(`cake_idx`로 구분해 예외 유지 — 그날의
진짜 케이크가 바뀌면 안 됨). community/product는 무영향(기존 "실사진 재해석 금지"
원칙 그대로 — 재검증 완료).

구현: `render_scene_images`에 `birthday_family_restyle`(is_birthday and restyle_key and
raw_list) 플래그 신설, 실사진 우선 배정 분기에서 이 경우만 재해석(②) 경로로 보냄 —
`scene_prompt`가 없어도 `raw_list[image_index]`를 참조 이미지로 삼아 화풍 프롬프트만
적용.

### ② 케이크 자동생성 + 꽃다발 선택

케이크 사진 첨부 시에만 케이크 지시문이 만들어지고, 미첨부 시 관련 지시 자체가 없어
케이크가 아예 안 나왔다. AI가 케이크 장면을 `scene_prompt`로 그리도록 else 분기 추가.
이어서 "케익하고 꽃다발 선택 하게 해주면 어때?" 요청으로 **`autoSceneKind`**
(`cake`/`flowers`/`auto`) 선택 UI 신설 — 케이크 사진 미첨부 시 신청서 화면에 3버튼 노출,
shared-api가 화이트리스트 검증 후 formJson에 저장, 워커가 값별로 다른 장면 묘사 프롬프트
생성.

부수 발견: `cakePosition`(맨 처음/맨 마지막)이 `has_cake`일 때만 읽혀 사진 미첨부
자동생성 경로에서는 사용자가 고른 위치가 조용히 무시되고 항상 기본값(`end`)으로
나가던 버그도 함께 수정(`is_birthday` 기준으로 변경).

### ③ 5초 미리보기 BGM 없음

`build_preview_video`가 `build_segment_clip`만 쓰고 `mix_bgm`을 호출하지 않아 무음
배경이었다(완성본은 12% 볼륨으로 BGM이 이미 있음). `make_short()`가 전체 제작에 쓰는
`pick_bgm()`/`mix_bgm()`을 그대로 재사용 — 이미지 생성·TTS 호출은 그대로라 원가·속도
영향 없이 ffmpeg 믹스 단계 하나만 추가. BGM 없거나 믹스 실패 시 무음 버전으로 폴백.

실측 검증: ffprobe로 오디오 스트림(aac) 존재, astats로 RMS 레벨 -68~-89dB(무음이면
-inf), `SHORTS_BGM=off` 대비 파일 크기 차이(56KB, 믹스된 BGM 데이터량과 일치) 확인.

### ④ ★심각한 기존 버그 — plan/restyleKeys가 워커에 아예 전달 안 되고 있었음

목소리 기능(⑥)을 만들다 우연히 발견. `_fetch_next()`(리서치/미리보기/제작 공용 행
조회 함수)의 SELECT에 `UserShorts."plan"`·`"restyleKeys"` 컬럼이 **원래부터 빠져
있었다**. `process_preview`/`process_produce`는 `form.get('plan', 'standard')`,
`form.get('restyleKeys')`로 이 값을 읽으려 했지만, `plan`·`restyleKeys`는 `formJson`이
아니라 **UserShorts 테이블의 별도 컬럼**에만 저장된다(shared-api `POST /preview`가
`"plan"=$3, "restyleKeys"=$4`로 컬럼에 UPDATE) — 즉 **워커는 프리미엄으로 결제해도
항상 `plan='standard'`로 폴백, `restyleKeys`도 항상 빈 배열로 처리하고 있었다.**

①의 "화풍이 하나도 적용 안 된다"는 지적의 더 근본적인 원인일 가능성이 크다 —
안전망(①) 때문이 아니라 애초에 스타일 선택값 자체가 워커에 도달하지 못했을 수 있다.

수정: SELECT에 두 컬럼 추가, `process_preview`·`process_produce`의 튜플 언패킹을
10필드로 맞추고 `form`에 병합(`form['plan'] = plan`, `form['restyleKeys'] =
restyle_keys_col`) — `build_script_draft`·`render_scene_images` 등 기존 `form.get(...)`
호출부는 그대로 재사용(변경 최소화). `_fetch_next`는 리서치 단계도 공유하는 함수라
컬럼 추가는 다른 단계에 영향 없음(`process_research`는 `*_`로 나머지 무시).

검증: 실제 `process_preview()`를 Fake 이미지/TTS 클라이언트로 전체 호출 — formJson에는
없는 `plan='premium'`·`restyleKeys=["ghibli_female"]`을 컬럼으로 흉내내 넘긴 뒤,
언패킹 성공 + 실제 ffmpeg로 mp4 생성까지 확인.

### ⑤ 요금제별 이미지 장수 고정 (사장 지시 "프리미엄은 이미지5장, 일반은 이미지3장")

④가 고쳐져 `form['plan']`을 정상 수신하므로 활용 가능해짐. `build_script_draft`의
세그먼트 수 지시를 요금제별로 분기:
- 스탠다드: 이미지 3개 + CTA 1개 = 4세그먼트, 내레이션 23~29초
- 프리미엄: 이미지 5개 + CTA 1개 = 6세그먼트, 내레이션 35~45초(기존 6~7개·35~45초와
  거의 동일해 하위호환 자연스러움)

사진 없는 카테고리(insight/wellness/meme)의 "4가지 샷 타입" 강제 다양화 원칙도 고정
숫자("세그먼트가 6개면", "7개면") 대신 세그먼트 수에 맞춰 순환 배정하도록 일반화.

실측: Fake Gemini로 프롬프트 텍스트 직접 캡처 — 스탠다드 "세그먼트 정확히 4개(이미지
있는 장면 3개 + 마지막 CTA 1개)... 23~29초", 프리미엄 "...6개(...5개...)... 35~45초"
정확히 확인.

### ⑥ 목소리 직접 선택 (사장 지시 "회원이 신청할 때 직접 고르는 UI")

기존(직전 세션)엔 어드민이 카테고리별로 지정한 목소리가 전역 적용만 됐음. 이번엔
**회원이 신청 흐름(`[plan]` 단계, 요금제·스타일 확정하는 자리)에서 직접 고르고
미리듣기까지** 가능하도록 확장 — 시나리오도 아직 안 정해진 신청서 단계보다, "이
쇼츠에 어울리는 걸 고르는" 자리로 이미 확립된 `[plan]` 단계가 자연스럽다는 판단.

**설계 원칙 유지**: 어드민 화면과 동일한 검증된 후보 목록(`VOICE_CANDIDATES`)을
재사용 — 회원에게 임의 문자열이 아니라 어드민이 미리 들어보고 확정한 목록 안에서만
고르게 한다(나이 라벨 거짓 표기 방지 원칙과 동일한 이유).

- shared-api: `GET /requests/voices`(카테고리 기본값+후보), `POST
  /requests/voice-preview`(회원용 미리듣기 — 어드민 로직을 `synthesizeVoicePreview()`로
  분리해 재사용), `POST /requests/:id/preview`에 `voiceName` 검증 후 `formJson` 병합
  저장(이 요청 1건에만 적용).
- `math-tutor-tts.ts`: 우선순위 회원 선택 > 카테고리 지정 > 언어 전역 > 하드코딩
  기본값. 언어 접두사 검증은 회원 선택도 예외 없이 적용.
- `make_short.tts()`에 `voice_name` 파라미터 추가, `shorts_maker_worker.py`가
  `script['voiceName']`으로 전달(전체 제작 경로), `build_preview_video`도 동일.
- 프론트: `VoiceLoader`(StyleLoader와 동일 지연 로딩 패턴) + `[plan]` 단계에 성별별
  버튼 목록, 카테고리 기본값은 "(기본)" 라벨로 미리 선택.

Playwright로 신청→시나리오→`[plan]` 단계까지 실제 흐름 재현, 목소리 섹션·후보 표시·
기본값 라벨까지 렌더 확인(콘솔 에러 0건).

### 배포

rag(`f62c679`·`2dbba74`·`d05bbef` — 서버2 직접 실행이라 커밋 즉시 반영) · shared-api
(`cd0c6c6`·`512ec46`) · ai_mp(`82d768d`·`14ecaef`). shared-api·ai_mp는 Vercel Promote /
서버1 자동배포 확인 필요.

## 2026-08-03 — 생일축하 실사용 피드백 3건 (사장이 직접 만들어보고 지적)

"25살 공주님이라고 했는데 왜 공주님 이미지가 없냐, 최소한 그거 하나는 나와야",
"이미지 전환 효과가 다 똑같다", "생일 축하해/사랑하는 아빠가 큰 글씨로 나와야지",
"자막이 너무 작아서 존재감이 없다", "남자 목소리면 아빠라고 짐작은 했어야지, 삼촌일
수도 있으니 관계 빈칸을 만들자", "제목도 내용에 맞춰 잘 지어라" — 6가지 지적을
한 번에 반영.

### ① 인물 이미지 강제 — "인물 금지" 문구가 근본 원인이었다

`action_rule`(사진 없는 세그먼트 채우는 지시)에 "인물을 새로 등장시키지 말고
사물·배경 위주로 묘사하세요"가 명시돼 있었다. 상품모드의 "재해석 금지"(실물이 있으면
AI가 다시 그리면 안 됨)와 헷갈려 과도 적용된 것 — 사진이 아예 없으면 참조할 실존
얼굴이 없어 재해석 위험 자체가 없다. 가족사진도 케이크도 없는 "가장 기본" 케이스에서만
`birthday_no_photo_rule`을 추가해 사진-세그먼트 중 마지막 하나를 받는 사람을 상징하는
인물 일러스트로 강제 지정(예: "공주님"→축하 분위기 속 캐릭터 한 명).

### ② 생일축하 전용 축하 카드 신설 — CTA를 감동 카드로 대체

원래 CTA(마지막 세그먼트)는 "지금 시작해보세요" 류 서비스 홍보 문구였다. 생일축하는
광고가 아니므로 이 자리를 **축하 카드**로 완전히 대체: `card_text`(중앙, 큰 글씨,
명조체 108pt, 예: "지은아 생일 축하해") + `card_subtext`(하단, 작은 명조체 52pt,
서명 "사랑하는 아빠가"). 카드 아래 캡션 자막은 생략(문구 중복 방지). 명조 폰트
(`NanumMyeongjo-Bold/Regular.ttf`, SIL OFL 상업 무료)를 Google Fonts에서 받아
`shorts-factory/assets/`에 신규 배치 — 이전엔 산세리프(Pretendard) 뿐이었다.

### ③ 받는 사람 이름/관계 명시 필드 신설

"남자 목소리면 아빠라고 짐작은 했어야지, 근데 삼촌일 수도 있으니 관계 빈칸을 만들자"
— topic 자유텍스트 추론에 맡기면 서명이 틀릴 수 있어 `recipientName`(이름/애칭)·
`relation`(관계) 두 필드를 폼에 신설(둘 다 선택 입력, 비우면 topic에서 LLM이 추론).
relation이 있으면 `card_subtext`를 코드 레벨로 강제 보정("사랑하는 {relation}가")해
LLM이 놓쳐도 반영되게 함. shared-api `FIELD_CAPS`에 화이트리스트 등록 필요(누락 시
body에서 조용히 필터링됨 — 카테고리 신규 필드 추가 시 항상 여기부터 확인할 것).

### ④ Ken Burns 줌 강도 다양화

팬 방향은 이미 4종 순환 중이었지만 줌은 전 세그먼트가 "천천히 확대"로 동일해 체감
차이가 작았다. 세그먼트 인덱스 짝수=줌인(`min(1+0.0018*on,1.10)`)/홀수=줌아웃
(`max(1.10-0.0018*on,1.0)`)으로 교대.

### ⑤ 내레이션 자막 크기 상향 44pt→56pt

"감동적인 글을 써놓고 아래 너무 조그맣게 자막으로 나오니 존재감이 없다" — 무음
시청자용 하단 자막이 화면 대비 지나치게 작았다. `render_frame`·`render_overlay`
(Veo 오버레이) 양쪽 다 동일 상향(크기 불일치로 세그먼트 전환 시 더 어색해지는 것
방지).

### ⑥ 제목 생성 품질 개선

기존엔 "유튜브 제목(#Shorts 포함, 40자 이내)"만 지시해 시나리오 title/hook을 그대로
복붙하는 경우가 있었다. `title_rule` 신설 — 일반 카테고리는 완성된 내레이션 내용을
반영해 다시 쓰도록, 생일축하는 "생일축하"·"해피벌스데이" 같은 밋밋한 표현 대신
호칭·감정 키워드가 들어간 구체적 제목(예: "엄마 몰래 준비한 생일 축하 영상")을
쓰도록 지시.

### 검증

fake Gemini 클라이언트로 `build_script_draft()` 직접 호출 — 인물 강제 지시 포함·
금지 문구 제거·recipientName/relation 반영·relation 코드 레벨 보정까지 확인.
`render_frame()`을 실제 PIL로 렌더해 명조 카드·서명·자막 크기·캡션 생략을 이미지로
직접 확인(스크린샷 검토). shared-api `tsc --noEmit` 통과, 프론트 `npm run build`
통과, Playwright로 컴포넌트 직접 마운트(로그인 우회) 후 카테고리 선택→이름/관계
입력칸 렌더·입력 반영까지 실제 화면으로 확인.

### 배포

rag(서버2 직접 실행 — `shorts_maker_worker.py`, `make_short.py`는 git 밖, 백업
스크립트로 관리) · shared-api(`FIELD_CAPS` 추가) · ai_mp(`ShortsMakerBoard.tsx`
폼 필드 추가). 명조 폰트 파일은 git 밖 `shorts-factory/assets/`에 직접 배치.

## 2026-08-03(밤)~08-04 — 목록 화면 UX 개선 (사장 실사용 지적 3건)

"쇼츠 보관함 리스트들 보여줬는데 없어졌네", "내가 만든 쇼츠도 영역을 구분되게 잘
나누어 주는 게 좋을 거 같은데", "새 쇼츠 만들기는 샘플 위에 있는 게 좋을 거 같은데"
→ "펼치기 위에 있는 게 좋을 거 같기도" → "스크롤해도 안 움직는 탑메뉴에 스톤버튼
으로 잇는 게 어때" 순으로 논의가 이어지며 최종 설계가 확정됨.

**① 예시 갤러리("이런 쇼츠가 나와요")가 완전히 사라지던 버그**: 내 쇼츠가 하나라도
생기면 이 섹션 자체가 렌더 조건에서 빠져 통째로 사라지는 구조였다. `showSamples`
상태를 신설해 접기/펼치기만 가능하게 바꾸고, **기본값은 펼침**으로 확정("그래야
사람들이 샘플을 볼 수 있지" — 접어두면 정작 봐야 할 사람이 안 보게 된다는 지적).

**② "내가 만든 쇼츠" 영역 구분**: 예시 갤러리·새 쇼츠 버튼과 뒤섞여 있던 걸 회색
배경(`bg-gray-50`) 카드 섹션으로 감싸고 개수(`{mineTotal}개`)를 제목에 표시 —
기존 폼 UI 그룹핑 원칙([[feedback_form_ui_grouping]]: 필드/항목이 많은 화면은
소제목만으론 부족, 배경색 카드로 묶을 것)을 목록 화면에도 동일 적용.

**③ "새 쇼츠 만들기" 버튼 위치 — 콘텐츠 상단 → 헤더 고정으로 최종 확정**: 처음엔
예시 갤러리 위(콘텐츠 영역 최상단)로 옮겼으나, 목록이 20~30개로 길어지면 스크롤해야
다시 버튼이 보이는 문제가 남았다. 최종적으로 **sticky 헤더**(타이틀 오른쪽, × 버튼
왼쪽)에 작은 pill 버튼(`✨ 새 쇼츠`)으로 고정 — 스크롤 위치와 무관하게 항상 눌림.
콘텐츠 영역 큰 CTA(`✨ 내 쇼츠 만들기 시작`)는 목록이 비어있는 첫 방문자에게만 유지
(헤더의 작은 버튼만으론 존재감이 약함).

### 검증

Playwright로 3가지 상태(목록 있음/예시 갤러리 펼침/빈 목록 첫 방문) 및 스크롤
전후 헤더 버튼 고정 여부를 API 응답 mock(`page.route`)으로 직접 스크린샷 확인 —
이 환경은 프로덕션 DB 네트워크가 막혀 있어([[feedback_dev_env_db_network]])
`_test_shorts_board.tsx` 임시 진입점으로 컴포넌트만 격리 마운트 후 완전 원복.
빌드·프리커밋 React 안전검사·타입체크 모두 통과.

### 배포(추가)

ai_mp만 변경(`d230aa9`·`0cc45e1`, Vercel Promote to Production 필요) — 프론트
전용 UX 개선이라 shared-api·rag 변경 없음.

---

## 2026-08-04 — 진입 경로 신설 + 축하 소품 실종 추적 + 카테고리 안전망 구조 개편

사장 지적 2건에서 출발해 버그를 잡고, 그 원인이 된 구조를 4단계로 정리했다.

### ① "선택 대기"인데 들어갈 버튼이 없던 문제 (ai_mp `3b13d24`)

> 사장: "대기상태이면 들어갈 수 있어야지 아무런 버튼도 없고 이게모니?"

`scenarios_ready`(선택 대기)인데 목록 카드에 **삭제 버튼뿐**이었다. 원인은
`reqId`를 채우는 경로가 **신규 접수 성공 시 한 번뿐**(`setReqId`)이라, 접수한 탭을
닫거나 새로고침만 해도 그 건은 **영구히 진입 불가**였던 것.

단계 화면과 폴링은 이미 `reqId`+`row`만으로 완성돼 있었으므로(폴링 effect가
`scenarios_ready`/`preview_ready`/`done`을 전부 매핑) 그 둘을 채우는 `resume()`만
신설해 연결했다. 처리 중 상태는 **폴링이 도는 단계**(waiting/previewing/producing)로
보내야 이어서 갱신된다.

목록 버튼은 성격에 따라 나눴다 — 사용자 입력을 기다리는 상태(`ACTION_NEEDED` =
scenarios_ready·preview_ready)만 채움 버튼으로 강조하고, 서버가 일하는 중이거나
실패한 건은 약한 링크로 둔다(기다리면 넘어가는 상태까지 강조하면 재촉이 된다).

### ② 생일 쇼츠에 케이크·꽃다발이 통째로 빠진 문제 — ★두 번 오진

> 사장: "왜 꽃다발도 없고 케잌도 없는거야 이게 맞는거야?"

#35를 내려받아 **26프레임 전수 확인** → 소품 전무. 사진 4장 슬라이드쇼 + 텍스트 카드뿐.

**오진 1차**: "프롬프트 문구가 약해서" → 강화했으나 #36에도 없음.
**오진 2차**: "`render_scene_images`의 상품 안전망이 지운다" → 생일 폼엔 `isProduct`가
없어 **그 안전망은 애초에 안 돈다**(내 테스트가 인위적으로 발동시킨 것을 범인으로 오인).
**진짜 원인**: `_produce_one_video`의 **재시도 경로**. `isProduct or category=='birthday'`로
판정해 완성본 검증 NG 후 재시도 때 소품 `scene_prompt`를 지우고 사진 인덱스로 되돌렸다.

부수 발견 2건:
- `auto`("AI가 알아서")를 LLM에게 "케이크·꽃다발·풍선 중 자유롭게 선택"으로 넘기니
  **"무엇을 그릴지"의 자유를 "넣을지 말지"의 자유로 읽고** 소품을 통째로 생략했다.
  → 코드에서 `random.choice`로 먼저 굴려 **구체적 문구로 확정**해 넘긴다(랜덤은 유지하되
  범위를 '종류'로만 좁힘). 프롬프트가 지시한 소품과 코드가 채우는 소품이 **같아야** 하므로
  확정값을 반환값으로 돌려준다.
- 소품 검사가 "비어 있으면 채운다"라 **뭐라도 채워지면 통과**했다. #37 실측에서 LLM이
  "꽃다발 정물"이 아니라 **"파티 배경의 인물"**을 채웠는데 그대로 지나갔다.
  → "소품 단어(cake/bouquet/flower/balloon/confetti)가 실제로 있는지" 검사로 강화.

### ③ 카테고리별 안전망·로직 분리 (rag `7a9fef1`·`3add6bb`·`869044c`)

> 사장: "카테고리별로 안전망 별도로 만들어. 그리고 카테고리별로 로직도 구분해서"

실측: 카테고리 분기 **53개가 7개 함수에 흩어져** 있었고 `build_script_draft`에만 29개.

★**근본 원인 — `isProduct`가 세 가지 뜻으로 혼용**:
①"실물 사진을 크롭하지 마라"(렌더 계약, 생일·상품 공통) ②"AI 재생성 금지"(상품 전용)
③"콜라주 금지"(캡처 전용). 생일축하가 ①만 필요한데 사진이 1장이라도 있으면
`isProduct=True`가 되며 ②까지 딸려왔다. 조건문에 특례를 덧붙이는 방식
(`isProduct or category=='birthday'`, `if seg.get("_autoScene"): continue`)으로
**이미 두 번 땜질된 흔적**이 있었다.

- **`CATEGORY_SAFETY` 신설** — `no_regen`/`no_collage`/`auto_scene`/`allow_dup_idx`를
  카테고리별로 **한 곳에서 선언**. `category_safety(form)`이 폼 단위 예외(`isCapture`)와
  레거시 하위호환(category 없이 `isProduct`만 있던 07-25 이전 접수분)도 흡수한다.
  ★`script["isProduct"]`(렌더 계약)는 **그대로 유지** — `make_short.py`가 이 값으로
  크롭(cover)/축소(contain)를 고르므로 의미가 다르다.
- **이미지 로직 전환**(③단계) — `render_scene_images`·`build_script_draft`가 지점마다
  따로 읽던 것을 상단에서 `safety`를 한 번 꺼내 쓰게 통일. **프롬프트 규칙 선택과 코드
  안전망이 같은 근거를 보게 하는 것**이 핵심(어긋난 결과가 #36이었다).
- **`build_birthday_rules()` 신설**(④단계) — 생일 규칙 5종(받는사람 힌트·서명 힌트·
  가족사진 배치·케이크/축하소품·사진없음 인물)을 한 함수에 집결. **436줄 → 362줄**.
  ★`CATEGORY_SPECS`로 옮기지 **않은** 이유: 규칙 문장에 런타임 값이 박혀 있어
  (`0~{family_count-1}번`, 화풍 프롬프트 삽입) 상수화하려면 템플릿 엔진을 새로 만들어야
  한다. 파이썬 f-string이 이미 잘하는 일을 엉성하게 대체하는 꼴. ⑤DB 이전에서도
  **tone과 안전망 선언만 옮기고 이 문장들은 코드에 두는 것**을 권한다(중괄호 하나
  빠뜨리면 바로 운영 품질 사고).

### 검증

- **실물 확인 필수**(오늘 두 번 오진한 뒤 세운 원칙) — #38·#39에서 꽃다발이 실제 화면에
  나오는 것을 프레임 추출로 확인. #38은 LLM이 스스로 제대로 그려 코드 개입 없이 통과.
- **순수 리팩터링은 바이트 비교로 증명** — ④단계 전에 240개 조합(생일 케이크有無×재해석×
  사진0~4장×이름/관계 4조합×위치×소품종류 + 타 카테고리 5종 + 캡처/프리미엄/다국어)의
  프롬프트를 SHA256으로 저장하고 후에 재비교 → **ALL IDENTICAL, 1바이트도 불변**.
- `auto` 20회 반복: 프롬프트 지시 소품 == 코드가 채운 소품 100% 일치(3종 분산 확인).

★**관측 함정 3종을 겪음**(전부 "고쳤는데 FAIL"로 오판하게 만든다):
⑴안전망 코드를 테스트에 **복사**해 검사하면 함수 수정이 반영 안 됨 → 실제 함수를 호출할 것
⑵렌더 루프가 `seg.pop()`으로 값을 **소비**해 루프 후엔 항상 비어 보임 → pop을 가로챌 것
⑶mock 함수의 **인자 위치 오인**(`_regenerate_scene`의 scene_prompt는 2번째가 아니라 4번째)

### 검증용 쇼츠 노출 정책

> 사장: "너가 다시 만들고 확인하고 어드민에만 올려. 사용자에게는 올리지말고"

#36~#40은 전부 **사장 계정(userId=2) 소유**로 만들어 회원에게 노출되지 않게 했다
(회원 조회는 `userId` 일치를 요구). 원본 #35(userId=117)는 손대지 않았다.
★`SampleVault`에는 **올리지 않았다** — 그 목록 조회는 `requireAdmin`이 아니라
**회원 공개**라(2026-07-25 버그 수정으로 의도적으로 공개 전환) 넣는 순간 전 회원
예시 갤러리에 뜬다.

### 배포

ai_mp `3b13d24`(Vercel Promote to Production 필요) · rag `44effb9`→`4df64f9`→
`7a9fef1`→`3add6bb`→`869044c`(서버2 크론이 로컬 파일 직접 실행이라 별도 배포 없음).

## 🎬 쇼츠 컷 전환 효과(xfade) 신설 (2026-08-04)

사장이 어드민 보관함 완성 쇼츠를 보고 "영상 효과가 너무 똑같다, 여러 가지
추가할 수 없냐"고 지적. 조사 결과 있는 효과는 `zoompan`(정지이미지 확대/축소+
팬 4방향) 하나뿐이고, **컷과 컷 사이 전환 자체가 없었다**(`concat_clips`가
`-f concat -c copy`로 단순 이어붙이기만 함 = 매번 하드컷). 줌/팬 다양화보다
이게 "다 똑같아 보인다"는 인상의 진짜 원인으로 판단.

### 리서치
FFmpeg `xfade` 필터가 fade·wipe(4방향)·slide(4방향)·circleopen/close·dissolve·
pixelize 등 40개 이상의 트랜지션을 지원. 오디오용 `acrossfade`는 커뮤니티
실전 사례에서 "duration을 xfade의 2배로 안 맞추면 동기화가 깨진다"는 함정이
보고돼 있어, 여러 클립 체이닝 시 오차 누적 위험이 있다고 판단.

### 설계 결정 (사장 확인 거침)
- 트랜지션 길이 **0.4~0.5초**(짧게 — 쇼츠 템포 유지, 하드컷보다는 부드럽게)
- **비디오만 xfade로 겹치고, 오디오(내레이션)는 순차 재생 유지**(안 겹침) —
  목소리끼리 겹치면 알아듣기 어려워지고, acrossfade 체이닝 오차 위험도 회피
- 비디오가 트랜지션 구간만큼 짧아지는 건 `tpad`(마지막 프레임 정지)로 오디오
  길이에 맞춰 보정 → 기존 효과음(`seg_starts`)·BGM 페이드아웃(`total_dur`)
  타이밍이 하나도 안 어긋남

### 구현
`concat_clips_with_transitions()` 신설(`concat_clips`는 그대로 남기고 클립
1개일 때 폴백용으로 재사용). 6종 트랜지션(`fade`·`wipeleft`·`circleopen`·
`slideup`·`dissolve`·`smoothleft`)을 세그먼트 인덱스로 순환(`_XFADE_TRANSITIONS`).
`SHORTS_TRANSITIONS=off`로 언제든 끌 수 있음. `make_short()` 함수 시그니처는
안 건드려서 `rag/shorts_maker_worker.py`(1분 주기 크론이 직접 import)는 코드
수정 없이 자동으로 새 로직을 탄다.

### 검증
①더미 클립 3개(다른 색상+음, 길이 2.0/3.5/1.2초 제각각)로 함수 직접 호출 —
반환된 최종 길이(6.700s)가 오디오 합계와 정확히 일치, 전환 구간 프레임 캡처로
색상이 실제 블렌딩되는 것 실측(빨강→중간혼합→초록) ②서버1 JWT 발급받아 실제
TTS 대본 3세그먼트로 전체 파이프라인(TTS+자막+BGM+효과음) 엔드투엔드 실행,
에러 없이 완주(8.4s, 스트림 정확히 비디오1+오디오1) ③테스트 산출물 전부 정리.

### 배포
shorts-factory는 git 미연동 로컬 스크립트(서버2 직접 실행) — 파일 저장 즉시
다음 쇼츠 제작부터 반영, 별도 배포 절차 없음. 트랜지션 종류·길이를 또 조정하고
싶으면 `_XFADE_TRANSITIONS`/`_XFADE_DUR` 상수만 고치면 됨. 관련 교훈은 agent-wiki
`dev/doc/patterns.md`(2026-08-04 "ffmpeg xfade로 컷 전환 넣을 때" 항목) 참고.


## 🎂 생일 축하카드 배경 6종 (2026-08-05)

사장 지적: "마지막 화면 문구는 좋은데 **화면 분위기가 너무 단조롭다**. 칠판에 친구들이
낙서처럼 생축 문구 쓰는 거, 해변 모래에 쓰는 거, 풍선에 쓰는 거… 많잖아."

**종전**: `card_text` 가 있으면 `make_short.py` 가 이미지 없이
`Image.new("RGB", (card_w, 620), (28,23,40))` = **단색 어두운 보라**에 글씨만 얹었다.

**변경**: 배경 6종을 `CARD_BG_SPECS` 레지스트리로 선언하고, LLM 이 대본 분위기·받는
사람과의 관계에 맞춰 `card_bg` 로 하나를 고른다. 워커가 그 배경을 생성해
`card_bg_image` 로 넘기면 렌더러가 단색 대신 깐다.

| key | 연출 | scrim |
|---|---|---|
| `night_sky` | 밤하늘 + 스파클러 원형 궤적 | ✗ (중앙이 짙어 흰 글씨가 그대로 선명 — 실측상 가장 예쁨) |
| `chalkboard` | 칠판에 색분필 낙서(풍선·고깔·케이크) | ✓ |
| `beach_sand` | 해질녘 모래사장 + 조개 하트 테두리 | ✓ |
| `balloons` | 파스텔 풍선 아치 + 리본 | ✓ |
| `polaroid_wall` | 코르크보드 폴라로이드 + 가랜드 | ✓ |
| `flower_frame` | 생화 프레임(장미·수국·유칼립투스) | ✓ |

**★배경만 AI로, 문구는 계속 PIL 로**: 문구까지 AI가 그리면 한글이 깨지거나 이름이
틀린다. **축하 대상 이름이 틀리면 영상 전체가 못 쓰게 되므로** 여기서 모험하지 않는다.

**프롬프트 공통 규칙**(`CARD_BG_GUARD`): ⑴글자 절대 금지(어떤 언어도) ⑵중앙 55% 비우기
(문구 자리) ⑶얼굴 크게 금지(초상권 — 주인공은 앞 세그먼트의 실사진).

**★구현 중 잡은 함정 3개**
- **이미지 생성에 텍스트용 `client` 를 쓰면 리전이 달라 404 로 조용히 실패**한다
  (2026-07-22 실측 이력이 주석에 남아 있었다). `img_client`(`location="global"`) 지연
  초기화로 수정.
- **`seg["image"]` 에 배경을 넣으면 렌더러가 '일반 이미지 카드'로 그려 축하 문구를
  아예 안 얹는다**(텍스트 카드 분기를 타야 문구가 나온다). 별도 키 `card_bg_image` 로
  전달하고 `image` 는 None 유지.
- 변수명 `is_birthday` → `is_birthday_cat`(그 스코프의 실제 이름).

**가독성 보정(실측 기반)**: 밝은 배경(풍선·모래)에서 흰 글씨가 묻히고 특히 서명
("사랑하는 아빠가")이 거의 안 보였다 → 중앙 반투명 스크림 + 글자 4방향 그림자.
어두운 배경(`night_sky`)은 스크림 없음 — 불필요하게 어둡게 하면 배경이 안 보여
단조로움을 고치려는 목적에 반한다(케이크 촛불 배경이 실제로 그랬다).

**카드 높이 620 → 940**: 620은 단색용이라 사진을 넣으면 상하가 심하게 잘려 답답했다
(이미지 카드와 같은 높이로 통일).

**폴백**: 배경 생성 실패 시 종전 단색 카드로 조용히 폴백 — 장식 때문에 영상 제작이
멈추면 안 된다.

**검증**: 배경 6종 실제 생성 → 문구 합성해 눈으로 확인 → `make_short.render_frame`
직접 호출로 3케이스 실측(배경+스크림 / 배경+스크림없음 / 배경없음 폴백) 전부 정상.

커밋: rag `bfecd8d`. shorts-factory(`make_short.py`)는 git 미연동 — 02:45 백업 크론이 챙김.
