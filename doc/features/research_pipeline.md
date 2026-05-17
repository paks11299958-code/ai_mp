# AI Deep Research 파이프라인

> 완성일: 2026-05-17  
> 상태: ✅ 전체 파이프라인 정상 작동

---

## 개요

사용자가 주제를 입력하면 자동으로 웹 리서치 → 원고 작성 → 파일 저장 → NotebookLM 업로드 → 이메일 발송까지 처리하는 완전 자동화 파이프라인.

---

## 파이프라인 흐름

```
사용자 입력 (주제 + 노트북명)
    ↓
[Step 1] 웹 크롤링 (DuckDuckGo, 한국어+영문 각 10개)
    ↓
[Step 2] Claude API 원고 작성 (4000~5000자)
    ↓
[Step 3] 파일 저장 (/ai_mp/research/output/*.txt)
    ↓
[Step 4] NotebookLM 자동 업로드 (Playwright + Stealth)
    ↓
[Step 5] Brevo 이메일 발송 (원고 첨부)
```

---

## 파일 구조

```
/home/paks11299958/ai_mp/research/
├── research.js          # 메인 파이프라인 스크립트
├── lib/
│   ├── crawler.js       # DuckDuckGo 크롤러
│   ├── notebooklm.js    # NotebookLM 자동화
│   └── mailer.js        # Brevo 이메일 발송
├── output/              # 생성된 원고 .txt 파일
└── logs/
    ├── research_{id}.log       # 각 리서치 실행 로그
    ├── nlm_before_click.png    # 업로드 전 스크린샷
    └── nlm_upload_dialog.png   # 업로드 다이얼로그 스크린샷
```

---

## 핵심 기술 상세

### 1. 크롤러 (crawler.js)
- **검색엔진**: DuckDuckGo HTML (`html.duckduckgo.com/html/`) — Google은 GCP IP 차단
- **Stealth**: `playwright-extra` + `puppeteer-extra-plugin-stealth`
- **URL 디코딩**: DuckDuckGo 링크는 `?uddg=encodedURL` 형식 → `decodeURIComponent` 필요
- **한국어 + 영문** 검색 각각 수행, 중복 제거 후 최대 10개 소스 크롤링

### 2. NotebookLM 자동화 (notebooklm.js)
- **핵심 방법**: `dragenter` 이벤트로 소스 추가 모달 오픈 → "파일 업로드" 버튼 클릭 → `filechooser` 이벤트로 파일 설정
- **배경**: NotebookLM 2025 새 UI에서 파일 업로드 버튼이 기본 패널에서 사라짐. 드래그 이벤트를 발생시켜야 모달이 열림
- **sameSite 정규화**: 쿠키 `sameSite: null` → `Lax` (Playwright 필수)
- **로그인 확인**: URL에 `accounts.google.com` 포함 여부로 판별
- **DataTransfer 생성**: 브라우저 컨텍스트 내에서 `new File([blob], name)` → `DataTransfer.items.add(file)`

```javascript
// 핵심 코드 패턴
await page.evaluate(({ content, name }) => {
  const file = new File([blob], name, { type: 'text/plain' });
  const dt = new DataTransfer();
  dt.items.add(file);
  el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
}, { content: base64, name: fileName });

// 모달 열린 후
const [fc] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 20000 }),
  page.locator('button:has-text("파일 업로드")').click(),
]);
await fc.setFiles(filePath);
```

### 3. 이메일 (mailer.js)
- **서비스**: Brevo API (`api.brevo.com/v3/smtp/email`)
- **주의**: 제목/발신자에 한글·이모지 금지 (Naver 메일 깨짐) → 영문 ASCII만 사용
- **첨부파일명**: `research_{timestamp}.txt` (한글 파일명 금지)

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/aimp/research/run` | 리서치 실행 (백그라운드 spawn) |
| POST | `/api/aimp/research/cookies` | NotebookLM 쿠키 등록 |
| DELETE | `/api/aimp/research/cookies` | 쿠키 삭제 |
| GET | `/api/aimp/research/cookies/status` | 쿠키 연결 상태 |
| GET | `/api/aimp/research/history` | 리서치 이력 조회 |
| DELETE | `/api/aimp/research/history/:id` | 이력 삭제 |

---

## DB 테이블

- **ResearchHistory**: `id, userId, topic, notebookName, status, notebookUrl, errorMessage, createdAt`
- **UserCookie**: `id, userId, cookieEnc (AES-256-GCM 암호화), updatedAt`

---

## 쿠키 등록 방법 (사용자 가이드)

1. 별도 Google 계정 생성 (리서치 전용 권장)
2. Chrome에서 `notebooklm.google.com` 접속 + 로그인
3. [Cookie Editor](https://chrome.google.com/webstore/detail/cookie-editor/) 확장프로그램 설치
4. notebooklm.google.com 탭에서 Cookie Editor → Export All → JSON 복사
5. 리서치 메뉴 → 설정 탭 → 쿠키 붙여넣기 → 저장
6. 서버가 자동으로 google.com 쿠키만 필터링 후 암호화 저장

> **주기**: 쿠키는 수일~수주 후 만료. 만료 시 "쿠키 만료" 에러 → 재등록 필요

---

## 알려진 제한사항

- **Google 검색 불가**: GCP 서버 IP가 Google에 의해 차단됨 (DuckDuckGo 대체 사용)
- **동시 처리**: 현재 단순 spawn — 사용자 증가 시 Bull/BullMQ + Redis 큐 필요
- **NotebookLM 쿠키**: 수동 갱신 필요 (자동 갱신 불가)
