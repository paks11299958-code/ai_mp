# Sites 디자인 가이드

Hermes가 sites/ 하위 사이트를 제작할 때 반드시 참고하는 디자인 시스템입니다.

---

## 공통 원칙

1. **순수 HTML/CSS/JS** — React/Vue/프레임워크 없이 작성
2. **모바일 우선** — 375px 기준으로 먼저 설계, 데스크탑으로 확장
3. **빠른 로딩** — 외부 폰트는 Google Fonts CDN만 사용, 이미지 최소화
4. **접근성** — 명확한 contrast ratio, 터치 타겟 최소 44px

---

## 사이트 유형별 디자인 시스템

### 🛒 쇼핑몰 / 판매 페이지

**색상 팔레트:**
```css
/* 자연/식품 계열 */
--primary:   #E8834A;   /* 따뜻한 오렌지 */
--secondary: #5A9E6E;   /* 신선한 그린 */
--bg:        #FFFDF8;   /* 아이보리 배경 */
--surface:   #FFF4EC;   /* 카드 배경 */
--text:      #2D1F0E;   /* 진한 브라운 */
--muted:     #8B7355;   /* 서브 텍스트 */
--border:    #F0E0CC;   /* 구분선 */

/* 과일 테마 오버라이드 */
/* 복숭아: --primary: #FF8C69; --secondary: #F4A460; */
/* 딸기:  --primary: #E8445A; --secondary: #FF6B8A; */
/* 사과:  --primary: #E84040; --secondary: #FF6B6B; */
```

**레이아웃 패턴:**
```html
<!-- 히어로 섹션 -->
<section class="hero">
  <div class="hero-badge">🍑 제철 특가</div>
  <h1 class="hero-title">제목</h1>
  <p class="hero-desc">설명</p>
  <a href="#order" class="btn-primary">지금 주문하기</a>
</section>

<!-- 상품 카드 -->
<div class="product-card">
  <div class="product-badge">BEST</div>
  <img class="product-img" src="..." alt="...">
  <div class="product-info">
    <h3 class="product-name">상품명</h3>
    <p class="product-origin">원산지</p>
    <div class="product-price">
      <span class="price-original">₩30,000</span>
      <span class="price-sale">₩25,000</span>
    </div>
    <button class="btn-order">담기</button>
  </div>
</div>
```

**CSS 기본 스타일:**
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Noto Sans KR', sans-serif; background: var(--bg); color: var(--text); }

.btn-primary {
  display: inline-block;
  padding: 14px 32px;
  background: var(--primary);
  color: #fff;
  border-radius: 50px;
  font-weight: 700;
  font-size: 16px;
  text-decoration: none;
  box-shadow: 0 4px 20px rgba(232,131,74,0.35);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(232,131,74,0.45); }

.product-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}
.product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
```

---

### 💼 SaaS / 서비스 소개 페이지

**색상 팔레트:**
```css
--primary:   #4F46E5;   /* 인디고 */
--secondary: #7C3AED;   /* 퍼플 */
--bg:        #0F0F1A;   /* 다크 배경 */
--surface:   #1A1A2E;   /* 카드 배경 */
--text:      #F0F0FF;   /* 밝은 텍스트 */
--muted:     #8888AA;   /* 서브 텍스트 */
--border:    rgba(255,255,255,0.08); /* 구분선 */
--gradient:  linear-gradient(135deg, #4F46E5, #7C3AED);
```

**레이아웃 패턴:**
```html
<!-- 히어로 -->
<section class="hero">
  <div class="hero-tag">✨ NEW</div>
  <h1>핵심 가치 한 줄</h1>
  <p>부제목 설명</p>
  <div class="hero-cta">
    <a href="#" class="btn-gradient">무료 시작하기</a>
    <a href="#demo" class="btn-ghost">데모 보기</a>
  </div>
</section>

<!-- 기능 카드 -->
<div class="feature-card">
  <div class="feature-icon">🚀</div>
  <h3>기능명</h3>
  <p>기능 설명</p>
</div>

<!-- 가격 카드 -->
<div class="pricing-card featured">
  <div class="pricing-badge">인기</div>
  <h3>플랜명</h3>
  <div class="price"><span>₩</span>29,000<span>/월</span></div>
  <ul class="features-list">
    <li>✓ 기능1</li>
  </ul>
  <button class="btn-gradient">시작하기</button>
</div>
```

---

### 🎮 게임 / 인터랙티브 서비스

**색상 팔레트:**
```css
--primary:   #00D4FF;   /* 네온 시안 */
--secondary: #FF006E;   /* 네온 핑크 */
--accent:    #FFD600;   /* 네온 옐로우 */
--bg:        #050510;   /* 딥 다크 */
--surface:   #0D0D1F;   /* 카드 */
--text:      #FFFFFF;
--glow:      0 0 20px rgba(0,212,255,0.5);
```

**특징:**
- 네온 글로우 효과: `text-shadow: var(--glow)`
- 픽셀/게이밍 폰트: `'Press Start 2P'` 또는 `'Orbitron'`
- 애니메이션 필수: 파티클, 펄스, 슬라이드

---

### 📺 방송 / 미디어 페이지

**색상 팔레트:**
```css
--primary:   #FF4444;   /* 라이브 레드 */
--secondary: #FF8800;   /* 오렌지 */
--bg:        #0A0A0A;   /* 블랙 */
--surface:   #141414;   /* 카드 */
--text:      #FFFFFF;
--live-badge: #FF0000;
```

**특징:**
- 라이브 배지: 빨간 점 + 펄스 애니메이션
- 썸네일 16:9 비율 유지
- 시청자 수, 좋아요 등 숫자 강조

---

### 🏢 회사 소개 / 랜딩 페이지

**색상 팔레트:**
```css
--primary:   #1A1A2E;   /* 딥 네이비 */
--secondary: #C5A864;   /* 골드 (Whispr 브랜드) */
--bg:        #FFFFFF;
--surface:   #F8F8F8;
--text:      #1A1A2E;
--muted:     #666680;
--border:    #E8E8F0;
```

---

## 공통 컴포넌트

### 네비게이션
```html
<nav class="navbar">
  <div class="nav-brand">브랜드명</div>
  <div class="nav-links">
    <a href="#features">기능</a>
    <a href="#pricing">요금</a>
    <a href="#contact">문의</a>
  </div>
  <a href="#cta" class="btn-primary btn-sm">시작하기</a>
</nav>
```

### 푸터
```html
<footer class="footer">
  <div class="footer-brand">
    <strong>브랜드명</strong>
    <p>짧은 설명</p>
  </div>
  <div class="footer-info">
    <p>상호: Whispr (입소문) | 대표: 신지윤</p>
    <p>사업자등록번호: 656-08-03261</p>
    <p>통신판매업: 제 2026-충북청주-0690호</p>
    <p>문의: 0502-468-0502</p>
  </div>
  <p class="footer-copy">© 2026 Whispr. All rights reserved.</p>
</footer>
```

### 반응형 그리드
```css
.grid-2 { display: grid; grid-template-columns: 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: 1fr; gap: 20px; }

@media (min-width: 640px) {
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
}
```

### 모바일 햄버거 메뉴
```js
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('active');
});
```

---

## 필수 포함 요소

모든 sites/ 사이트에 반드시 포함:

1. **사업자 정보** — 푸터에 상호명/대표/사업자번호/통신판매업신고번호
2. **반응형** — 모바일(375px) / 태블릿(768px) / 데스크탑(1280px)
3. **로딩 속도** — 인라인 CSS 우선, 외부 리소스 최소화
4. **Google Fonts** — `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap`
5. **meta 태그** — charset, viewport, og:title, og:description

---

## 주의사항

- `sites/` 밖의 파일(App.tsx, vercel.json, frontend/ 등) **절대 수정 금지**
- 각 사이트는 `sites/프로젝트명/` 폴더 내에서 완전히 독립적으로 동작
- 외부 JS 라이브러리는 CDN으로 (예: `https://cdn.jsdelivr.net/`)
- 이미지는 Unsplash CDN 또는 직접 링크 사용
