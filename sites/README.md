# Sites — 독립 서비스 폴더

Hermes AI가 생성하는 독립 웹 서비스들을 관리하는 폴더입니다.

## 구조

```
sites/
├── 프로젝트명/
│   ├── index.html    ← 메인 페이지
│   ├── style.css     ← 스타일
│   ├── script.js     ← 인터랙션 (선택)
│   └── assets/       ← 이미지 등 (선택)
└── ...
```

## 접근 URL

```
https://aichat.dbzone.kr/sites/프로젝트명/
```

## 새 사이트 추가

텔레그램에서:
```
/hermes [프로젝트명] [설명] 홈페이지 만들어줘
```

Hermes가 자동으로:
1. 자료 조사 (Search Agent)
2. sites/프로젝트명/ 폴더에 HTML/CSS/JS 생성
3. vercel.json 라우트 자동 추가
4. 자동 배포 + URL 알림

## 등록된 사이트 목록

| 프로젝트명 | URL | 설명 |
|---------|-----|------|
| email-fix | /sites/email-fix/ | AI 영어 이메일/메시지 교정 랜딩(시안 v1, 2026-06-15). 교정 기능 연동은 추후 |
| review-solver | /sites/review-solver/ | AI 쇼핑 리뷰 요약 '리뷰 해결사' 랜딩(시안 v1, 2026-06-15). 베타 신청 폼만 동작, 실제 분석은 추후 |
| dragon-image | /sites/dragon-image/ | gpt-image-2로 생성한 여의주 든 청룡 이미지 다운로드 페이지(2026-07-26) |
| dragon-image-red-pearl | /sites/dragon-image-red-pearl/ | dragon-image의 images.edit(원본 보존) 버전 — 여의주를 빨간색으로 교체. 기존 URL 캐시와 헷갈리지 않게 별도 경로로 분리(2026-07-26) |
| dragon-image-mouth-pearl | /sites/dragon-image-mouth-pearl/ | dragon-image의 images.edit 버전 — 입에 빨간 여의주를 문 모습(2026-07-26) |
