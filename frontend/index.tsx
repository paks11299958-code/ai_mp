import './vertex-ai-proxy-interceptor.js';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AttendPage } from './components/AttendPage';
import { NewsPage } from './components/NewsPage';

// PWA 설치 이벤트는 페이지 로드 직후 1회만 발생한다.
// 컴포넌트가 뒤늦게(서아 채팅 등) 리스너를 달면 놓치므로, 앱 진입 시점에 전역으로 잡아 보관한다.
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).__deferredInstallPrompt = e;
    window.dispatchEvent(new Event('pwa-install-available'));
});
window.addEventListener('appinstalled', () => {
    (window as any).__deferredInstallPrompt = null;
});

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

// 경로 기반 독립 진입 분기
const path = window.location.pathname;
// /attend/:sheetUuid → AttendPage
const attendMatch = path.match(/^\/attend\/([^/]+)$/);
// /news → 오늘뉴스 전용 페이지 (홈화면 바로가기 아이콘 대상)
const isNews = /^\/news\/?$/.test(path);

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        {attendMatch ? <AttendPage sheetUuid={attendMatch[1]} />
            : isNews ? <NewsPage />
            : <App />}
    </React.StrictMode>
);
