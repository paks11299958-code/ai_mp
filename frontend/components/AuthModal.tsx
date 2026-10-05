import React, { useRef, useState } from 'react';
import { authApi } from '../services/apiService';
import { isChannelRef, getStoredRef } from '../services/referral';
import type { User } from '../types';
import { AuthError, AuthFrame, KakaoButton, PasswordField } from './AuthUI';
import { RegistrationForm } from './RegistrationForm';
interface AuthModalProps {
    onSuccess: (user: User, token: string, isNewUser?: boolean) => void;
    onClose?: () => void; onBack?: () => void; defaultMode?: 'login' | 'register'; fullScreen?: boolean; referralBanner?: boolean; personas?: any[];
}
type Mode = 'login' | 'register' | 'forgot';
const isPhone = (value: string) => /^\d{10,11}$/.test(value.replace(/-/g, ''));
export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose, onBack, defaultMode = 'login', fullScreen = false, referralBanner = false }) => {
    const [mode, setMode] = useState<Mode>(defaultMode), [identifier, setIdentifier] = useState(''), [password, setPassword] = useState('');
    const [code, setCode] = useState(''), [newPassword, setNewPassword] = useState('');
    const [forgotStep, setForgotStep] = useState<'input' | 'verify' | 'done'>('input'), [forgotPhone, setForgotPhone] = useState(false);
    const [loading, setLoading] = useState(false), [error, setError] = useState(''); const busy = useRef(false);
    const switchMode = (next: Mode) => { if (busy.current) return; setMode(next); setIdentifier(''); setPassword(''); setCode(''); setNewPassword(''); setError(''); setForgotStep('input'); };
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); if (busy.current) return; busy.current = true; setLoading(true); setError('');
        try {
            if (mode === 'login') {
                const result = await authApi.login(isPhone(identifier) ? identifier.replace(/-/g, '') : identifier, password);
                localStorage.setItem('token', result.token); onSuccess(result.user, result.token);
            } else if (forgotStep === 'input') {
                const phone = isPhone(identifier); setForgotPhone(phone);
                if (phone) { await authApi.sendCode(identifier.replace(/-/g, '')); setForgotStep('verify'); }
                else { await authApi.forgotPassword(identifier); setForgotStep('done'); }
            } else {
                if (newPassword.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
                await authApi.resetPassword(code, newPassword); setForgotStep('done');
            }
        } catch (err: any) { setError(err.message || '다시 시도해주세요.'); }
        finally { busy.current = false; setLoading(false); }
    };
    return <AuthFrame fullScreen={fullScreen} onClose={onClose} onBack={onBack}>
        {referralBanner && <div className="auth-bonus">{isChannelRef(getStoredRef()) ? 'AI 놀이터에 오신 것을 환영해요' : '친구가 초대했어요'} · 회원가입 완료 시 무료 1,000P</div>}
        {mode === 'register' ? <RegistrationForm onSuccess={onSuccess} onLogin={() => switchMode('login')} /> : <>
            {mode === 'forgot' && <button type="button" className="auth-link" disabled={loading} onClick={() => switchMode('login')}>← 로그인으로 돌아가기</button>}
            <h1>{mode === 'login' ? '로그인' : forgotStep === 'verify' ? '새 비밀번호로 바꾸세요' : '비밀번호 찾기'}</h1><p className="auth-subtitle">{mode === 'login' ? '내 대화와 포인트를 이어서 사용하세요.' : forgotStep === 'verify' ? '문자로 받은 인증번호와 새 비밀번호를 입력하세요.' : '가입할 때 사용한 연락처를 입력해 주세요.'}</p>
            {forgotStep === 'done' ? <><div className="auth-notice">{forgotPhone ? '비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.' : <>{identifier}로 재설정 링크를 보냈어요.<br />메일함과 스팸함을 확인해주세요. 링크는 30분간 유효합니다.</>}</div><button className="auth-primary" type="button" onClick={() => switchMode('login')}>로그인으로 돌아가기</button></> : <form onSubmit={submit}>
                {forgotStep === 'verify' ? <><label className="auth-field"><span>인증번호 (6자리)</span><input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="123456" required /></label><PasswordField label="새 비밀번호" value={newPassword} onChange={setNewPassword} /></> : <label className="auth-field"><span>이메일 또는 휴대전화번호</span><input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="이메일 / 휴대전화" autoComplete="username" required /></label>}
                {mode === 'login' && <><PasswordField value={password} onChange={setPassword} login /><div style={{ textAlign: 'right' }}><button className="auth-link" type="button" disabled={loading} onClick={() => switchMode('forgot')}>비밀번호 찾기</button></div></>}
                <AuthError message={error} /><button className="auth-primary" type="submit" disabled={loading || (forgotStep === 'verify' && code.length !== 6)}>{loading ? '처리 중…' : mode === 'login' ? '로그인하기' : forgotStep === 'verify' ? '비밀번호 변경하기' : isPhone(identifier) ? '인증번호 받기' : '재설정 링크 받기'}</button>
            </form>}
            {mode === 'login' && <><KakaoButton /><p className="auth-switch">처음 오셨나요? <button className="auth-link" type="button" disabled={loading} onClick={() => switchMode('register')}>회원가입하기</button></p></>}
            {mode === 'forgot' && forgotStep === 'input' && <p className="auth-hint" style={{ marginTop: '1rem' }}>카카오로 가입하셨나요? 별도 비밀번호 없이 로그인 화면의 카카오 로그인을 이용해주세요.</p>}
        </>}
    </AuthFrame>;
};
