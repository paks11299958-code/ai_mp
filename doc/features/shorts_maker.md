# 쇼츠 만들기 (이아린)

> 구현: 2026-07-22 신설, 2026-07-23 파이프라인 대개선(비주얼 다양성·완성본 검증·진행상황 표시)
> 이미지(최대 3장) + 신청서 → 서로 다른 후킹 앵글의 시나리오 5개 → 회원이 고른 1개만 실제
> TTS+영상으로 제작. 2단계 과금(리서치+시나리오 5개 / 선택 후 영상 제작).

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
  - `build_script_draft`: **강제 다양화 규칙** — 오프닝 콜라주(사진 3장일 때만) → 원본
    신뢰샷 → 재해석 샷 A/B(카메라 앵글 자체를 바꿈) → **무인물 AI 시각요소 인서트 필수
    1컷**(코드 화면·그래프·다이어그램, 손 왜곡 리스크 없음). Veo 사용 시(`use_veo=True`)엔
    "행동 시작 지점에만 영상, 최대 2개" 규칙으로 분기.
  - `render_scene_images`: 세그먼트별 이미지 생성(나노바나나)+검수(`_verify_scene_image`,
    "장면 목적 일치"까지 함께 판정)+콜라주(`image_index` 배열) 지원. `on_progress` 콜백으로
    세그먼트 완료마다 진행률 기록.
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
- **DB**: `UserShorts`(raw SQL, Prisma 미관리) — `progressStep`/`progressDone`/`progressTotal`
  (2026-07-23 추가), `useVeo`(2026-07-23 추가, 초기 배포 시 마이그레이션 누락으로 선택 API
  500 에러 실측 — 반드시 함께 마이그레이션할 것).

## 프론트 (`ShortsMakerBoard.tsx`)
- `waiting`/`producing` 두 단계 모두 **체크리스트 UI**(지난 단계 ✓, 현재 단계 스피너+진행률,
  이후 단계 회색 텍스트) — `row.progressStep`을 5초 폴링으로 반영.
- 완성 숏츠 미리보기(유튜브 샘플)는 `aspect-[9/16]` wrapper로 종횡비 고정 — PC에서 iframe이
  `w-full h-full`로 뷰포트를 채우며 세로형 영상이 레터박스/잘림 나던 문제 수정(2026-07-23).

## 조립 엔진 (`shorts-factory/make_short.py`)
- 세그먼트별 TTS+PIL 프레임(1080x1920, Pretendard)+ffmpeg(zoompan 슬로우줌+팬, Ken Burns)
  → mp4. 화면 상단 브랜드 배지 `BRAND` 상수(2026-07-23: "AI 놀이터 · aichat.dbzone.kr",
  기존 "AI 페르소나"에서 변경).
- zoompan 지터(미세한 화면 흔들림) 완화 시도(2026-07-23): 업스케일 배율 1.5배→4배+lanczos
  리샘플링. ⚠️정적 테스트로는 개선 효과를 확실히 재현하지 못함(사장 확인 후 "그냥 둬"로
  보류) — 추가 개선은 하지 않기로 확정.

## 교훈
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

배포: rag(서버2 직접, `f10a000`+`5d0d2c6` 등 push만으로 크론 반영), shared-api(서버1 git
pull+pm2 reload, `cb89e5e`), ai_mp(master push, Vercel — Promote to Production 필요).
