import './vertex-ai-proxy-interceptor.js';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AttendPage } from './components/AttendPage';
import { NewsPage } from './components/NewsPage';
import { InstallBanner } from './components/InstallBanner';
import { registerVersionedServiceWorker } from './services/serviceWorkerUpdate';

// 커밋별 URL로 SW 업데이트를 검사한다. 새 worker가 기존 탭을 넘겨받으면 한 번 새로고침해
// 배포 전 JavaScript를 계속 실행하는 열린 탭도 최신 UI로 전환한다.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        registerVersionedServiceWorker(
            navigator.serviceWorker,
            __GIT_COMMIT__,
            () => window.location.reload(),
        ).catch(() => { /* PWA 설치 실패가 본 화면 렌더를 막으면 안 된다. */ });
    }, { once: true });
}

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
// ?embed=<personaId> → 외부사이트 iframe 위젯(EmbedChat, App.tsx 내부 분기). 위젯 안에는
// '홈 화면에 추가' 버튼이 뜨면 안 됨(위젯 자체가 이미 최소 UI 목적) — 여기서 함께 제외.
const isEmbed = !!new URLSearchParams(window.location.search).get('embed');

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        {attendMatch ? <AttendPage sheetUuid={attendMatch[1]} />
            : isNews ? <NewsPage />
            : (
                <>
                    <App />
                    {!isEmbed && <InstallBanner />}
                </>
            )}
    </React.StrictMode>
);
