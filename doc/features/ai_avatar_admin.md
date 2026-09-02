# AI 아바타 어드민 — Claude 개발 인수인계

## 1. 목적과 현재 범위

관리자 설정의 `시스템 → AI 아바타`에서 사진 기반 2.5D 아바타 프로젝트를 만들고,
기준 이미지 준비 → idle 생성 → TTS 립싱크 → 검수 → 사이트 게시·롤백까지 관리한다.

2026-09-02 Codex가 만든 것은 **프론트 뼈대와 계약 초안**이다.

- 메뉴와 패널: `frontend/components/admin/AiAvatarPanel.tsx`
- 향후 공용 타입/API 경로: `frontend/components/admin/aiAvatarContract.ts`
- 패널 회귀 테스트: `frontend/components/admin/AiAvatarPanel.test.tsx`
- 서버 API, DB, 작업 큐, GPU 실행, 실제 게시 버튼은 아직 없다.
- 버튼이 비활성인 것은 결함이 아니라 승인·복구 경계가 생기기 전의 안전장치다.

## 2. 선행 작업에서 확정된 판단

### 채택

- 얼굴 정본: 보정하지 않은 서아 정면 상반신 원본
- idle: LivePortrait pose-only, motion multiplier `0.25`
- speaking: MuseTalk v1.5
- 표현 방식: 사진 기반 2.5D
- 런타임 상태: `IDLE`, `THINKING`, `SPEAKING`, `FALLBACK`

### 검수·참고 전용

- 좌우 측면 사진과 3DDFA 합의 얼굴: 깊이·회전 QA
- Tripo 결과: 몸 비율·카메라 참고
- LivePortrait eyes-only m0.35: 보조 idle 후보

### 다시 채택하지 말 것

- MPFB 자동 얼굴 피팅
- 정면 사진 텍스처를 범용 3D 얼굴에 단순 투영
- 3DDFA 열린 얼굴 마스크를 완성 아바타로 직접 사용
- DECA/MICA를 FLAME 라이선스 확인 없이 서비스에 사용

상세 실험 기록은 `~/ai-3d-avatar/docs/SEOA_2D_AVATAR_PLAN.md`와
`~/ai-3d-avatar/docs/seoa_2d_asset_manifest.json`이 정본이다.

## 3. 현재 검증 자산과 운영 적용점

| 자산 | 위치 | 용도 |
|---|---|---|
| 기준팩 | `~/seoa_2d_avatar/reference_pack/` | 정면·얼굴 확대·좌우 측면·4면 검수 |
| idle 결과 | `~/seoa_2d_avatar/seoa_idle_pose_m025.mp4` | 채택 idle 원본 |
| speaking PoC | `~/seoa_2d_avatar/seoa_musetalk_korean_poc.mp4` | 한국어 립싱크 품질 기준 |
| 공용 상담 자산 | `frontend/public`이 아니라 저장소 `public/seoa/avatar/` | `/consult/{slug}` |
| AI월드 자산 | `sites/ainara-cube/assets/ai-consult/` | `aiworld.dbzone.kr` 독립 프로젝트 |

운영 적용 커밋:

- `b960515`: 공용 상담 페이지 2.5D 상태 머신
- `1a2b70b`: AI월드 사업 상담 모달 2.5D 교체·Gemini 상태 연결

## 4. 구현 목표 구조

```text
Admin browser
  -> POST /api/admin/ai-avatar/projects
  -> POST /api/admin/ai-avatar/projects/:id/assets
  -> POST /api/admin/ai-avatar/jobs
  -> GET  /api/admin/ai-avatar/jobs/:id
  -> POST /api/admin/ai-avatar/projects/:id/publish
  -> POST /api/admin/ai-avatar/projects/:id/rollback

shared-api (인증·검증·작업 원장·게시 승인)
  -> PostgreSQL: project / asset / job / publication / audit
  -> 서버2 dispatcher: 대기 작업 확인
  -> 서버3 gcp3-new: 격리된 ~/seoa-2d-avatar 실행 환경
  -> 객체 저장소: 입력·중간 결과·승인본
```

브라우저가 서버3에 직접 SSH하거나 모델 명령을 만들면 안 된다. 서버1은 작업 원장과 권한만
담당하고, 긴 GPU 작업은 요청 스레드에서 동기 실행하지 않는다.

## 5. 프론트 계약

`aiAvatarContract.ts`의 타입을 확장하되 기존 필드 의미를 바꾸지 않는다.

- `AiAvatarStage`: 프로젝트가 도달한 제작 단계
- `AiAvatarJobStatus`: 개별 비동기 작업 상태
- `progress`: `0..100` 정수
- `error`: 사용자용 정제 메시지. 원본 스택·명령·내부 경로는 API로 반환하지 않는다.
- 프로젝트 목록은 썸네일, 현재 단계, 최근 작업, 게시 위치, 업데이트 시각을 보여준다.
- 실행 전 예상 GPU 시간·예상 비용·생성 횟수를 보여주고 명시 확인을 받는다.
- 폴링은 중복 타이머를 막고 언마운트 시 정리한다.
- 모바일 390px에서 가로 넘침이 없어야 하며 모든 실행 버튼은 44px 이상이다.

## 6. API 초안

### 프로젝트

- `GET /api/admin/ai-avatar/projects`
- `POST /api/admin/ai-avatar/projects`
- `GET /api/admin/ai-avatar/projects/:id`
- `PATCH /api/admin/ai-avatar/projects/:id`

### 자산

- `POST /api/admin/ai-avatar/projects/:id/assets` — multipart, 종류·크기·매직바이트 검증
- `GET /api/admin/ai-avatar/projects/:id/assets/:assetId`
- 원격 URL 입력은 받지 않는다. SSRF 방지를 위해 서버가 소유한 자산 ID만 작업에 전달한다.

### 작업

- `POST /api/admin/ai-avatar/jobs`
  - kind: `PREPARE_REFERENCE`, `GENERATE_IDLE`, `GENERATE_LIPSYNC`, `BUILD_REVIEW`
  - 같은 프로젝트·kind의 `QUEUED/RUNNING`이 있으면 새 작업을 만들지 않는 멱등키 필요
- `GET /api/admin/ai-avatar/jobs/:id`
- `POST /api/admin/ai-avatar/jobs/:id/cancel`

### 게시

- `POST /api/admin/ai-avatar/projects/:id/publish`
- `POST /api/admin/ai-avatar/projects/:id/rollback`
- 대상은 `consult`, `aiworld`처럼 허용 목록 enum으로 제한한다.
- 게시 전 승인 자산·체크섬·이전 버전을 저장하고 모든 동작을 감사 로그에 남긴다.

## 7. DB 초안

정확한 스키마는 구현 시 운영 DB를 먼저 조회해 이름 충돌을 확인한다. `prisma db push`는 금지하며
신규 테이블은 추가형 raw SQL로만 만든다.

- `AiAvatarProject`: id, name, personaName, stage, createdBy, timestamps
- `AiAvatarAsset`: id, projectId, kind, storageKey, mime, bytes, sha256, metadataJson
- `AiAvatarJob`: id, projectId, kind, status, progress, inputJson, outputJson, errorCode, timestamps
- `AiAvatarPublication`: id, projectId, target, assetId, previousAssetId, publishedBy, timestamps
- `AiAvatarAudit`: actorId, action, targetType, targetId, detailJson, createdAt

입력 사진과 생성 영상은 DB bytea에 넣지 말고 객체 저장소 키만 저장한다.

## 8. 서버3 실행 절대 규칙

- 서버3은 `gcp3-new`(`10.178.0.9`)이며 꺼져 있는 것이 정상이다.
- 기존 ComfyUI, CUDA, 드라이버, 모델, custom nodes, workflow, Python을 수정하지 않는다.
- 전용 루트는 `~/seoa-2d-avatar/`, LivePortrait와 MuseTalk는 서로 분리된 micromamba 환경이다.
- 자동 종료기는 `/tmp/ai_studio_last_activity`에서 **epoch 값**을 읽는다. 빈 파일 `touch` 금지.
- 실행 중에는 2분마다 `date +%s > /tmp/ai_studio_last_activity`로 활동을 기록한다.
- 성공 산출물을 서버2/객체 저장소로 복구한 뒤 VM을 종료하고 `TERMINATED`를 확인한다.
- 중복 작업 방지, 최대 실행시간, 취소, 실패 복구, 비용 기록 없이는 어드민 실행 버튼을 활성화하지 않는다.

## 9. 라이선스와 상용화 부채

- LivePortrait 코드는 MIT지만 기본 InsightFace 검출 모델은 비상업 연구 제한이 있다.
  현재 PoC를 그대로 상용 배포 파이프라인에 넣지 말고 허용 가능한 검출·랜드마크 구현으로 교체한다.
- MuseTalk 코드·학습 모델은 상업 사용 가능하다고 명시돼 있으나 Whisper, VAE, DWPose, S3FD 등
  개별 의존성의 라이선스·고지를 릴리스 체크리스트에 포함한다.

### 2026-09-02 조사·준비 완료 (서버3 미기동, GPU 비용 0)

**막히는 것은 코드가 아니라 모델 가중치다.** InsightFace 코드는 MIT이고, 비상업 제한은
사전학습 모델(`buffalo_l`)에만 붙는다. 교체 대상은 그 가중치 하나다.

교체가 안전한 이유(소스 실측): `cropper.py`는 검출 결과에서 `landmark_2d_106`만 소비하고,
그 값은 얼굴 영역을 어림잡는 데만 쓰인다. 최종 203점은 LivePortrait 자체 `landmark.onnx`(MIT)가
다시 만든다. 즉 InsightFace는 "얼굴이 대략 어디인가"만 담당한다.

**MediaPipe 어댑터를 만들고 CPU에서 실측 검증까지 마쳤다** —
`~/liveportrait-license-work/` (어댑터 + 회귀 테스트 11개 + README).
교체는 import 한 줄이며, MediaPipe는 코드·모델 모두 Apache-2.0이다.

★★**함정**: 106점은 "아무 점 106개"가 아니다. `crop.py:parse_pt2_from_pt106()`이
`[33,35,40,39]`=왼눈, `[87,89,94,93]`=오른눈, `[52]`/`[61]`=입술로 **의미를 고정**해 두었고
그 두 점으로 얼굴 기울기를 계산한다. 슬롯을 임의로 채우면 회전각이 -119°로 나와
**크롭에서 얼굴이 옆으로 눕는다**(실측). 정확 매핑 시 -0.89°, 눈중심 오차 1.4px.

⚠️**S3FD는 별건이다.** 원본 저장소(`sfzhang15/SFD`)에 LICENSE 파일이 **아예 없다**.
미표기는 법적으로 "허가 없음"이 기본값이라 InsightFace보다 처리가 곤란하다.
MuseTalk 경로에서 실제로 쓰는지 Phase 3에서 확인하고, 쓴다면 함께 교체한다.

Phase 3 순서: ①어댑터 투입 ②같은 입력으로 InsightFace판/MediaPipe판 idle을 각각 생성해
**육안 비교**(크롭이 달라지면 얼굴 인상이 바뀐다) ③S3FD 확인 ④통과 시 `buffalo_l` 삭제.
- 제공된 인물 사진과 음성의 사용 동의·보관기간·삭제 경로를 프로젝트 단위로 기록한다.

### 2026-09-02 Phase 3-a 완료 (디스패처 판정부, 서버3 미기동·GPU 비용 0)

Phase 3을 **3-a(과금 0)** 와 **3-b(과금 시작)** 로 쪼갰다. 3-a 는 서버3을 켜지 않고
"켜야 하는가"를 판정하는 층까지만 만든 것이다.

- `rag/ai_avatar_dispatch.py` — 판정 순수 함수(부작용 없음), 커밋 `698e69e`
- `rag/ai_studio_dispatcher.py` — 기존 디스패처에 아바타 큐 인식 연결
- `rag/test_ai_avatar_dispatch.py` — 회귀 26개

★**`AVATAR_DISPATCH_ENABLED` 기본값 `0`.** 이 스위치가 꺼져 있는 한 아바타 큐가
아무리 쌓여도 `avatar_pending_count()` 가 0을 돌려주므로 서버3은 켜지지 않는다.
**3-b 는 이 값을 `1` 로 두는 순간 시작되고, 거기서부터 과금이다.**

★**크론을 새로 만들지 않았다.** 진입점이 둘이면 `instances start` 를 각자 부르고
하루 기동 상한도 따로 세어 요금이 두 배로 샌다. 기존 `ai_studio_dispatcher` 에 얹었다.

★**죽은 RUNNING 회수가 필요한 이유**: 부분 유니크 인덱스(`AiAvatarJob_active_key`)가
`(projectId, kind) WHERE status IN (QUEUED,RUNNING)` 이라, 크래시로 RUNNING 이 남으면
그 프로젝트의 그 작업을 **영영 다시 만들 수 없다**. 종류별 타임아웃으로 회수한다
(idle 45분 · 립싱크 60분 · 준비 15분 · 검수 20분). QUEUED 는 아무리 오래돼도 회수하지
않는다 — 서버가 꺼져 있어 대기가 긴 것은 정상이다.

🔴★★**실측으로 잡은 결함 — DB 시각은 UTC 다.** `CURRENT_TIMESTAMP` 가 UTC naive 로
저장되는데 디스패처가 KST 를 붙였더니 **갓 만든 RUNNING 이 540분(9시간) 경과**로 나와
모든 실행 중 작업이 즉시 '죽은 것'으로 판정됐다. 그대로 3-b 를 켰다면 **렌더 중인
서버3을 유휴로 보고 껐을 것이다**. 단위 테스트는 tz-aware 값을 직접 만들어 써서 못 잡았고,
**운영 DB 에 실제 행을 넣어 보고서야** 드러났다. UTC 부착으로 고치고 회귀를 남겼다.

🔴★★**`idle_shutdown.sh` 도 함께 고쳐야 한다(서버3 미설치).** 이 스크립트의
`db_active_jobs()` 는 `GpuJob` 만 센다 — 아바타 큐를 모른다. 그대로 3-b 를 켜면
ComfyUI 큐도 `GpuJob` 도 비어 있어 **렌더 도중 "유휴 30분"으로 서버가 스스로 꺼진다**.
고친 파일은 `ai-3d-avatar/deploy/server3/idle_shutdown.sh` 에 두었고 커밋 `2917793`,
설치 절차는 같은 폴더 `README.md` 에 있다.
★`config-backup/server3/` 는 서버3에서 **끌어오는 사본**이라 서버3을 켜면 백업 크론이
옛 파일로 되돌린다. 배포 원본으로 쓰지 말 것.

**3-b 착수 전 체크리스트**: ①`idle_shutdown.sh` 설치·`CHECK_ONLY=1` 확인
②`AVATAR_DISPATCH_ENABLED=1` ③MediaPipe 어댑터 투입 ④InsightFace판/MediaPipe판 육안 비교
⑤S3FD 사용 여부 확인 ⑥산출물 회수 후 VM `TERMINATED` 확인.

### 2026-09-02 Phase 3-b 실행 — 라이선스 교체 완료 (GPU 18분, 약 ₩380)

사장 승인 후 서버3을 켜고 체크리스트 ①③④⑤⑥을 수행했다. **₩0 → ₩380**.
정본 사본과 설치 절차: `ai-3d-avatar/deploy/liveportrait/`(커밋 `076d17c`).

**①`idle_shutdown.sh` 설치 — 실제 결함을 재현해 확인했다.**
설치 전 옛 버전은 아바타 작업이 `RUNNING` 인데도 `DRY_RUN_SAFE_TO_STOP` 을 냈다
(= 렌더 도중 서버를 껐을 것). 설치 후 같은 조건에서 `BUSY_DB:1` 로 막혔다.
`IDLE_MIN=0` 이라는 즉시 종료 조건에서도 막히는 것까지 확인했다.

**③④검출기 교체 — `buffalo_l` 삭제 완료.**
`cropper.py` 의 import 한 줄만 바꿔 MediaPipe(Apache-2.0)로 교체했다.
같은 입력·같은 `d5.pkl`·`pose m0.25` 로 A/B 각각 생성 → 148프레임 **평균 픽셀차 0.12%**,
육안 비교에서 인상·프레이밍 차이 없음.
🔴**결정적 검증**: `buffalo_l` 을 **물리 삭제한 뒤에도 정상 생성**되고 결과가 B판과
픽셀 동일(최대차 0.21/255)이다 — 조용한 폴백이 아니다. 이후 21MB 삭제했다.
**서버3에 비상업 가중치는 더 이상 없다.**

★함정: `pip install mediapipe` 만 하면 **numpy 2.2.6 으로 올라가 torch 2.3.0 이 깨진다.**
`--dry-run` 으로 먼저 잡아내고 `"numpy<2"` 를 함께 고정했다. `libEGL.so.1` 이 없으면
MediaPipe import 가 죽는다(`libglvnd0 libgles2 libegl1`).

**⑤S3FD — 실제로 쓰고 있다. 미해결로 남았다.** ⚠️
`FaceAlignment(...)` 가 `face_detector=` 없이 호출돼 기본값 `'sfd'` 로 돌고,
`~/.cache/torch/hub/checkpoints/s3fd-619a316812.pth`(89MB)가 09-02 PoC 때 실제로 받아졌다.
원본 저장소 `sfzhang15/SFD` 에 **LICENSE 가 없어** 법적으로 "허가 없음"이 기본값이다.
→ **립싱크(MuseTalk)를 상용에 쓰기 전 반드시 해결.** idle 경로는 이제 깨끗하다.
대안 `YOLOv8_face` 는 클래스만 있고 가중치가 없으며 **YOLOv8 은 AGPL-3.0** 이라 더 곤란하다.

🟡**`landmark.onnx` 가 CPU 로 돈다** — onnxruntime-gpu 1.18 이 CUDA 11 의
`libcublasLt.so.11` 을 찾는데 서버3엔 CUDA 12.9 뿐이다. **내 변경과 무관한 기존 상태**로
(onnxruntime 설치 05:17 / mediapipe 설치 14:31) A·B 양쪽에 동일하게 적용돼 비교는 유효하다.
렌더가 12초라 당장 문제는 아니지만 별건으로 남는다.

**남은 것**: Phase 4(립싱크·점수표·승인·게시·롤백). 그리고 위 S3FD.

## 10. Claude 구현 순서

1. 이 문서와 `AiAvatarPanel.tsx`, `aiAvatarContract.ts`를 먼저 읽는다.
2. 서버1 운영 DB를 읽기 전용으로 조회하고 테이블 충돌을 확인한다.
3. API·DB 없이 프론트 상태와 mock repository 테스트부터 만든다.
4. 서버2에 파일 기반 mock job runner를 연결해 UI 전체 흐름을 검증한다.
5. raw SQL migration과 ADMIN 전용 API를 구현한다. 서버1 반영은 별도 승인 후다.
6. 서버3 dispatcher는 dry-run·중복방지·timeout·activity epoch·종료 검증부터 구현한다.
7. LivePortrait idle 1회만 연결해 성공/실패/취소/재시작 복구를 검증한다.
8. 그 다음 MuseTalk, 검수 보드, 게시·롤백을 순서대로 붙인다.

## 11. 단계별 완료 조건

- Phase 1: Mock만으로 프로젝트 생성→작업 진행→검수→게시 시뮬레이션, 테스트 통과
- Phase 2: 서버2 API/DB 원장과 권한·업로드 검증, 실제 GPU 호출 없음
- Phase 3: 승인된 서버3 idle 1회, 산출물 회수와 VM `TERMINATED`
- Phase 4: 립싱크, 점수표, 승인·게시·롤백, 두 운영 화면 브라우저 검증

`npm run check`, 관련 Vitest, `npm run build`만으로 완료라 하지 않는다. 운영 배포 승인이 있을 때만
커밋·푸시하고, 배포 후 실제 메뉴 클릭·영상 readyState·pageerror·가로 넘침을 확인한다.

## 12. Claude에게 바로 전달할 작업 문구

> `doc/features/ai_avatar_admin.md`를 정본으로 읽고 관리자 설정의 AI 아바타 뼈대를 이어서 개발해라.
> 첫 작업은 Phase 1 Mock 프로젝트/작업 repository와 UI 상태 연결이다. 서버1, 운영 DB, 서버3,
> 외부 비용, 게시·배포는 건드리지 마라. 기존 ComfyUI와 `~/seoa-2d-avatar/` 환경도 수정하지 마라.
> 테스트를 먼저 추가하고 390px/1280px 렌더를 검증한 뒤, 변경 파일과 다음 승인 지점을 보고해라.
