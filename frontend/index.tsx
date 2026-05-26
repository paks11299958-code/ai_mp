import './vertex-ai-proxy-interceptor.js';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AttendPage } from './components/AttendPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

// /attend/:sheetUuid 경로 감지 → AttendPage 렌더링
const attendMatch = window.location.pathname.match(/^\/attend\/([^/]+)$/);

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        {attendMatch ? <AttendPage sheetUuid={attendMatch[1]} /> : <App />}
    </React.StrictMode>
);
