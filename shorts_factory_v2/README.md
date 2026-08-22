# 쇼츠 공장 v2 — GCP3 없는 Codex 보조형 MVP

작업 JSON, 장면 이미지, 장면별 음성을 입력받아 1080×1920 쇼츠를 만드는 서버2 로컬 파이프라인입니다. GCP3, Gemini, n8n, 운영 DB를 사용하지 않습니다.

## 현재 가능한 것

- 1~10개 장면 작업 JSON 검증
- 공통 캐릭터 바이블과 장면별 이미지 프롬프트 관리
- 이미지가 없을 때 `_work/image-tasks.json` 생성 후 안전하게 대기
- 이미지 카드, 큰 제목, 전체 내레이션, 진행 점을 새로 렌더링
- 제목과 내레이션의 동적 배치 및 최소 24px 간격 보장
- 공간 부족 시 문구를 자르지 않고 작업 실패
- 기존 MP3와 장면별 호흡 여백을 이용한 영상 조립
- 장면·최종 영상 캐시와 중단 후 재실행
- 장면별 레이아웃 좌표를 `_work/layouts.json`에 기록

## 한 명령으로 실행

저장소 루트에서 실행합니다.

```bash
/home/paks11299958/rag-env/bin/python -m shorts_factory_v2 path/to/job.json
```

입력 준비만 확인:

```bash
/home/paks11299958/rag-env/bin/python -m shorts_factory_v2 path/to/job.json --prepare
```

PNG 프레임까지만 생성:

```bash
/home/paks11299958/rag-env/bin/python -m shorts_factory_v2 path/to/job.json --render-only
```

캐시를 무시하고 전부 다시 인코딩:

```bash
/home/paks11299958/rag-env/bin/python -m shorts_factory_v2 path/to/job.json --force
```

## 작업 JSON 핵심 필드

```json
{
  "id": "my-podcast-short",
  "title": "영상 제목",
  "brand": "AI 놀이터 · aichat.dbzone.kr",
  "characterBible": "모든 인물 장면에 반복할 외형·의상·화풍",
  "segments": [
    {
      "caption": "화면의 큰 제목",
      "text": "음성과 함께 보일 전체 내레이션",
      "image": "assets/scene0.png",
      "audio": "audio/scene0.mp3",
      "imagePrompt": "이 장면에 필요한 이미지 설명",
      "tailPadding": 0.85
    },
    {
      "caption": "마지막 메시지",
      "text": "마무리 내레이션",
      "cardText": "CTA 카드 문구",
      "audio": "audio/scene1.mp3"
    }
  ]
}
```

경로는 작업 JSON 위치를 기준으로 해석하며 절대경로도 지원합니다.

## Codex 이미지 작업 흐름

1. 작업 JSON에 저장할 이미지 경로와 `imagePrompt`를 작성합니다.
2. `--prepare`를 실행합니다.
3. 누락 이미지는 `_work/image-tasks.json`에 캐릭터 바이블과 함께 기록됩니다.
4. Codex가 해당 명세로 이미지를 생성해 지정 경로에 저장합니다.
5. 같은 명령을 다시 실행하면 프레임 렌더링과 영상 조립이 이어집니다.

## 이번에 해결한 중첩 결함

이전 프로토타입은 과거에 렌더된 자막 프레임을 복사하고 이미지 카드만 바꿨습니다. 따라서 원본 프레임의 제목·내레이션 중첩도 그대로 복사됐습니다.

v2는 완성 프레임을 재사용하지 않습니다. 작업 JSON에서 모든 문구를 다시 그리며, 정지 이미지와 향후 비디오 오버레이가 사용할 세로 좌표를 `layout.py` 한 곳에서 계산합니다.

## 현재 MVP의 경계

- Codex 대화 안에서의 이미지 생성은 가능하지만 이미지 단계까지 사람 없는 상시 실행은 아직 아닙니다.
- MP3는 입력으로 받습니다. 원본 팟캐스트 자동 분할·화자 분리·TTS 생성은 다음 단계입니다.
- 유튜브 업로드와 텔레그램 승인 큐는 아직 연결하지 않았습니다.
- Veo 같은 동영상 장면은 아직 지원하지 않습니다.

## 다음 구현 순서

1. 원본 팟캐스트/대본 가져오기와 장면 JSON 자동 생성
2. 음성 파일 자동 분할 또는 기존 TTS 연결
3. 이미지 품질 검사와 장면별 재생성 승인
4. 기존 텔레그램 승인 큐 연결
5. 승인 후 유튜브 업로드 연결

n8n은 여러 채널 예약·외부 폼·알림 서비스가 복잡해질 때 다시 판단합니다. 현재 단계에는 필요하지 않습니다.
