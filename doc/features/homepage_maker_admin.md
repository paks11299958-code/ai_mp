# 어드민 홈페이지 생성 — 메이커·체커 전용 흐름

> 2026-08-26 UI 뼈대, 2026-08-27 허드 연결. 화면: `시스템 > 🐮 허드 AI > 홈페이지`

## 목적

`aiworld`에서 효과가 확인된 제작 방식을 반복 가능하게 만든다. 사용자는 긴 명세 대신
홈페이지 느낌, 히어로 설명, 핵심 오브젝트, 움직임과 콘텐츠 연결을 짧게 입력한다. 메이커가
하나의 시각 콘셉트로 제작하고 체커가 실제 렌더링을 검토한 뒤, 사용자 승인 후 배포한다.

기존 `홈페이지 신청 관리`는 회원 신청 운영 화면이고, `개발AI 콘솔`은 범용 개발 도구다.
이 메뉴는 관리자가 고품질 독립 홈페이지를 만드는 좁은 전용 흐름이다.

## 현재 구현 범위

- `HomepageMakerPanel.tsx`: 5단계 흐름, 핵심 콘셉트·콘텐츠·도메인 입력 UI
- `homepageMakerBrief.ts`: 필수 입력 판정과 오퍼스 전달용 명세 생성
- Developer 전달 명세 실시간 미리보기
- 리뷰 ON/OFF와 예상 시간 안내
- 명세 버전 저장 후 별도 확인을 거치는 허드 시작
- 동시 실행 1건 제한 표시와 시작 전 재검증
- 수정 금지 파일·경로 전달

## 연결된 계약

### 요청

```ts
interface HomepageMakerCreateRequest {
  projectName: string;
  brandMood: string;
  heroSummary: string;
  heroObject: string;
  motionStory: string;
  contentSource?: string;
  mustKeep?: string;
  desiredDomain?: string;
  useHerdr: true;
  useReview: true;
}
```

새 파이프라인을 만들지 말고 기존 개발AI 콘솔의 버전 저장·첨부·승인·진행 이벤트와
`hermes.run(use_review=true)` 경로를 재사용한다. 화면 전용 프리셋을 DevProject brief에
저장하거나, 기존 계약과 충돌하지 않는 단일 JSON 필드로 확장한다.

### 상태

```
draft → queued → planning → awaiting_approval → making → checking
      → preview_ready → approved → deploying → done
                                  ↘ revision_requested → making
```

화면 라벨과 실제 DevProject/Herdr 상태가 다르면 API에서 표시용 단계로 매핑한다. DB와
파이프라인에 새 상태를 무조건 추가하지 않는다.

## 안전 경계

- 사용자의 `시작` 클릭 전에는 AI·파이프라인 호출을 하지 않는다.
- 체커 통과는 사용자 배포 승인을 대신하지 않는다.
- 미리보기 승인 전 운영 배포·DNS 생성 금지.
- DNS는 존 백업 후 신규 하위도메인 추가만 허용하고 기존 레코드는 수정·삭제하지 않는다.
- 연락처·주소·가격·실적은 입력이나 기존 출처가 없으면 생성하지 않는다.
- 메이커와 체커는 같은 결과를 독립적으로 평가하고, 체커 지적 원문과 반영 결과를 이벤트에 남긴다.
- 서버2 동시 실행은 기존 제한 1건을 그대로 따른다.

## 체커 완료 조건

- 데스크톱 1440×900, 모바일 390×844
- 가로 넘침 0, 콘솔 오류·실패 요청 0
- `prefers-reduced-motion` 대체 화면
- 키보드 포커스, 대화상자·버튼 접근성
- 히어로 오브젝트가 장식에 그치지 않고 다음 콘텐츠와 연결됨
- 제공되지 않은 사실 정보가 없음
- 사용자가 승인한 콘텐츠와 핵심 콘셉트가 보존됨

## 결과 확인 (3~4단계)

- 허드 AI `[결과]` 탭에서 진행 상태, 미리보기, 이미지, `SPEC.md`, 체커 기록, ZIP을 확인한다.
- 사용자 승인 후 Vercel 프로젝트·도메인 배포는 자동화하지 않았다.

기존 shared-api `admin-devai` 생성·수정·시작 API와 서버2 `devai_start.py`를 재사용한다.
운영 배포 없이 계획→승인→제작→미리보기까지 완주하는 유료 통합 실측은 별도 승인 검증 항목이다.
