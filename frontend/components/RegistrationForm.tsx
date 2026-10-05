import React, { useEffect, useRef, useState } from 'react';
import { authApi } from '../services/apiService';
import { clearStoredRef } from '../services/referral';
import type { User } from '../types';
import { ConsentFields, emptyConsent, hasRequiredConsent } from './ConsentFields';
import { AuthError, KakaoButton, PasswordField } from './AuthUI';
export const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const phoneFormat = (value: string) => { const d = value.replace(/\D/g, '').slice(0, 11); return d.length <= 3 ? d : d.length <= 7 ? `${d.slice(0,3)}-${d.slice(3)}` : `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`; };
export function RegistrationForm({ upgrade = false, onSuccess, onLogin, headline }: { upgrade?: boolean; onSuccess: (user: User, token: string, isNewUser?: boolean) => void; onLogin?: () => void; headline?: { title: string; body: string } | null }) {
    const [method, setMethod] = useState<'phone' | 'email'>(upgrade ? 'email' : 'phone');
    const [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [username, setUsername] = useState(''), [password, setPassword] = useState('');
    const [consent, setConsent] = useState(emptyConsent), [step, setStep] = useState<'form' | 'verify'>('form');
    const [code, setCode] = useState(''), [countdown, setCountdown] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState('');
    const codeRef = useRef<HTMLInputElement>(null), busy = useRef(false);
    const type = method === 'phone' ? 'PHONE' : 'EMAIL';
    const identifier = method === 'phone' ? phone.replace(/-/g, '') : email;
    useEffect(() => { if (countdown <= 0) return; const id = setTimeout(() => setCountdown(v => Math.max(0, v - 1)), 1000); return () => clearTimeout(id); }, [countdown]);
    useEffect(() => { if (step !== 'verify') return; const id = requestAnimationFrame(() => { codeRef.current?.focus({ preventScroll: true }); codeRef.current?.scrollIntoView?.({ block: 'center' }); }); return () => cancelAnimationFrame(id); }, [step]);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); if (busy.current) return;
        setError(''); if (!hasRequiredConsent(consent)) { setError('필수 동의 항목을 확인해주세요.'); return; }
        busy.current = true; setLoading(true);
        try {
            if (step === 'form') {
                if (!identifier || !username.trim()) throw new Error('연락처와 닉네임을 입력해주세요.');
                if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
                await authApi.sendVerify(type, identifier); setStep('verify'); setCountdown(60);
            } else {
                const result = upgrade ? await authApi.upgradeGuest(type, identifier, code, password, username.trim(), consent) : await authApi.verifyRegister(type, identifier, code, password, username.trim(), consent);
                localStorage.setItem('token', result.token); if (!upgrade) clearStoredRef();
                onSuccess(result.user, result.token, !upgrade);
            }
        } catch (err: any) { setError(err.message || '처리하지 못했습니다. 다시 시도해주세요.'); }
        finally { busy.current = false; setLoading(false); }
    };
    const resend = async () => {
        if (busy.current || countdown > 0) return; busy.current = true; setLoading(true); setError('');
        try { await authApi.sendVerify(type, identifier); setCountdown(60); } catch (err: any) { setError(err.message); } finally { busy.current = false; setLoading(false); }
    };
    return <><p className="auth-step">{step === 'form' ? '1/2 가입 정보' : '2/2 인증 확인'}</p><h1>{step === 'verify' ? '인증번호를 입력하세요' : upgrade ? (headline?.title || '대화를 그대로, 정식가입') : '회원가입'}</h1>
        <p className="auth-subtitle">{step === 'verify' ? '받은 6자리 인증번호를 입력해 주세요.' : upgrade ? '체험 중인 계정을 정식 계정으로 바꿔요.' : '나만의 AI 친구를 만나보세요.'}</p>
        {step === 'form' && <div className="auth-bonus">{upgrade ? '지금까지의 대화와 남은 포인트를 유지해요.' : '회원가입 완료 시 무료 1,000P 지급'}{upgrade && headline?.body && <p className="auth-hint" style={{ whiteSpace: 'pre-line' }}>{headline.body}</p>}</div>}
        <form onSubmit={submit}>
            {step === 'form' ? <><div className="auth-method"><span>가입 방법: <strong>{method === 'phone' ? '휴대전화' : '이메일'}</strong></span><button type="button" className="auth-link" onClick={() => { setMethod(m => m === 'phone' ? 'email' : 'phone'); setError(''); }}>{method === 'phone' ? '이메일로 가입하기' : '휴대전화로 가입하기'}</button></div>
                <label className="auth-field"><span>닉네임</span><input value={username} onChange={e => setUsername(e.target.value)} required placeholder="사용할 닉네임" autoComplete="nickname" /></label>
                <label className="auth-field"><span>{method === 'phone' ? '휴대전화번호' : '이메일'}</span><input type={method === 'phone' ? 'tel' : 'email'} value={method === 'phone' ? phone : email} onChange={e => method === 'phone' ? setPhone(phoneFormat(e.target.value)) : setEmail(e.target.value)} required placeholder={method === 'phone' ? '010-1234-5678' : 'name@mail.com'} autoComplete={method === 'phone' ? 'tel' : 'email'} /></label>
                <PasswordField value={password} onChange={setPassword} />
                <ConsentFields value={consent} onChange={setConsent} contactLabel={method === 'phone' ? '휴대전화번호' : '이메일'} />
            </> : <><div className="auth-notice">{method === 'phone' ? phone : email}로 인증번호를 보냈어요.</div><label className="auth-field"><span>인증번호 (6자리)</span><input ref={codeRef} className="auth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" required /></label><div className="auth-code-actions"><span>{countdown > 0 ? `다시 받기까지 ${formatCountdown(countdown)}` : '인증번호가 오지 않았나요?'}</span><button type="button" className="auth-link" disabled={loading || countdown > 0} onClick={resend}>인증번호 다시 받기</button></div></>}
            <AuthError message={error} /><button className="auth-primary" type="submit" disabled={loading || !hasRequiredConsent(consent) || (step === 'verify' && code.length !== 6)}>{loading ? '처리 중…' : step === 'form' ? '인증번호 받기' : upgrade ? '정식가입 완료하기' : '회원가입 완료하기'}</button>
            {step === 'verify' && <button type="button" className="auth-link" disabled={loading} onClick={() => { setStep('form'); setCode(''); setError(''); }}>← 가입 정보 수정</button>}
        </form>
        {!upgrade && step === 'form' && <KakaoButton signup />}
        {!upgrade && onLogin && <p className="auth-switch">이미 회원이신가요? <button className="auth-link" type="button" disabled={loading} onClick={onLogin}>로그인하기</button></p>}
    </>;
}
