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
| (추가 예정) | | |
