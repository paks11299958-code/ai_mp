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
- 제공된 인물 사진과 음성의 사용 동의·보관기간·삭제 경로를 프로젝트 단위로 기록한다.

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
