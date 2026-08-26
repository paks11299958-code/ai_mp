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
| ai-companion | /sites/ai-companion/ | AI SaaS 플랫폼 사업운영 라이선스 파트너 모집 원페이지(시안 v1, 2026-08-20). 신청 폼 미연동, 연락처·실적 수치는 확정 후 채울 것 |
| widget-demo | /sites/widget-demo/ | AI 상담 위젯 삽입과 페이지 하단 표시를 검증하는 독립 데모 사이트(2026-08-19) |
| threeui-lab | /sites/threeui-lab/ | 홈페이지 자동화용 ThreeUI Community 업종별 후보 5종 연구실(운영 생성기 미연결, 2026-08-23) |
| new_ainara | /sites/new_ainara/ | AINARA AI Companion 독립 브랜드 사이트. Particle Network와 기존 AI 상담 흐름 적용(2026-08-23) |
| ainara-partner | https://ainara2.dbzone.kr/ | AI SaaS 플랫폼 사업운영 라이선스 파트너 모집 독립사이트. 자체 생성 이미지와 3D 상담 모달 적용(2026-08-26) |
| ainara-cube | https://aiworld.dbzone.kr/ | 큐브가 자동으로 펼쳐져 AI 임대형 서비스 메뉴가 되는 AINARA 파트너 독립사이트(2026-08-26) |
