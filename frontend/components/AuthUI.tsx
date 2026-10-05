import React, { useState } from 'react';
import './auth-v2.css';
import { getStoredRef } from '../services/referral';

export function AuthFrame({ children, fullScreen = false, onClose, onBack }: { children: React.ReactNode; fullScreen?: boolean; onClose?: () => void; onBack?: () => void }) {
    return <div className={`auth-v2 auth-overlay ${fullScreen ? 'auth-page' : ''}`} onClick={e => { if (!fullScreen && e.target === e.currentTarget) onClose?.(); }}>
        {fullScreen && <header className="auth-header"><button type="button" className="auth-link" onClick={onBack} aria-label="메인으로 돌아가기">← 둘러보기</button><span className="auth-brand">AI 놀이터</span></header>}
        <div className="auth-content"><section className="auth-card" role={fullScreen ? 'region' : 'dialog'} aria-modal={fullScreen ? undefined : true} aria-label="AI 놀이터 계정">
            {!fullScreen && onClose && <button type="button" className="auth-close auth-link" aria-label="닫기" onClick={onClose}>✕</button>}
            {!fullScreen && <p className="auth-brand">AI 놀이터</p>}{children}
        </section></div>
    </div>;
}

export function PasswordField({ label = '비밀번호', value, onChange, login = false }: { label?: string; value: string; onChange: (value: string) => void; login?: boolean }) {
    const [visible, setVisible] = useState(false);
    return <label className="auth-field"><span>{label}</span><div className="auth-password"><input aria-label={label} type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={login ? '비밀번호 입력' : '6자 이상'} minLength={login ? undefined : 6} required autoComplete={login ? 'current-password' : 'new-password'} /><button type="button" className="auth-link" onClick={() => setVisible(v => !v)} aria-label={`${label} ${visible ? '숨기기' : '보기'}`}>{visible ? '숨김' : '보기'}</button></div></label>;
}

export function AuthError({ message }: { message: string }) { return message ? <p className="auth-error" role="alert">{message}</p> : null; }

export function KakaoButton({ signup = false }: { signup?: boolean }) {
    return <><div className="auth-divider">또는</div><button className="auth-kakao" type="button" onClick={() => { const ref = getStoredRef(); window.location.href = '/api/auth/kakao' + (ref ? '?ref=' + encodeURIComponent(ref) : ''); }}><img src="/kakao-login-button.svg" alt="카카오 로그인" width="224" height="46" /></button>{signup && <p className="auth-hint">처음 이용하시면 카카오 계정으로 가입이 진행돼요</p>}</>;
}
