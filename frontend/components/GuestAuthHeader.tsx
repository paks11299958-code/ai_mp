import React from 'react';
import './auth-v2.css';
export function GuestAuthHeader({ onLogin, onRegister, onMenu, onHome }: { onLogin?: () => void; onRegister?: () => void; onMenu: () => void; onHome?: () => void }) {
    return <header className="auth-v2 guest-home-header" aria-label="비로그인 머리말"><button type="button" className="auth-brand" onClick={onHome} aria-label="AI 놀이터 홈으로">AI 놀이터</button><nav aria-label="계정 메뉴"><button type="button" className="auth-secondary" onClick={onLogin}>로그인</button><button type="button" className="auth-primary" onClick={onRegister}>회원가입</button><button type="button" className="auth-link" aria-label="메뉴 열기" onClick={onMenu}>☰</button></nav></header>;
}
