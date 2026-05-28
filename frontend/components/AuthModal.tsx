import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';
import { Icon } from './Icons';

interface AuthModalProps {
    onSuccess: (user: User, token: string) => void;
    onClose?: () => void;
    onBack?: () => void;
    defaultMode?: 'login' | 'register';
    fullScreen?: boolean;
    personas?: any[];
}

type Mode = 'login' | 'register' | 'forgot';
type RegisterTab = 'email' | 'phone';
type RegisterStep = 'form' | 'verify';
type ForgotStep = 'input' | 'verify';

const isPhoneInput = (val: string) => /^\d{10,11}$/.test(val.replace(/-/g, ''));
const rawDigits = (val: string) => val.replace(/-/g, '');
const formatPhoneNumber = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose, onBack, defaultMode = 'login', fullScreen = false }) => {
    const [mode, setMode] = useState<Mode>(defaultMode);
    const [identifier, setIdentifier] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [registerTab, setRegisterTab] = useState<RegisterTab>('email');
    const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
    const [regVerifyCode, setRegVerifyCode] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);
    const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [forgotStep, setForgotStep] = useState<ForgotStep>('input');
    const [forgotType, setForgotType] = useState<'email' | 'phone' | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [forgotDone, setForgotDone] = useState(false);

    useEffect(() => {
        return () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); };
    }, []);

    const startResendTimer = () => {
        setResendCountdown(60);
        if (resendTimerRef.current) clearInterval(resendTimerRef.current);
        resendTimerRef.current = setInterval(() => {
            setResendCountdown(v => {
                if (v <= 1) { clearInterval(resendTimerRef.current!); return 0; }
                return v - 1;
            });
        }, 1000);
    };

    const switchMode = (m: Mode) => {
        setMode(m);
        setError('');
        setIdentifier('');
        setEmail('');
        setPhone('');
        setPassword('');
        setUsername('');
        setRegisterStep('form');
        setRegVerifyCode('');
        setForgotDone(false);
        setForgotStep('input');
        setForgotType(null);
        setVerifyCode('');
        setNewPassword('');
        if (resendTimerRef.current) clearInterval(resendTimerRef.current);
        setResendCountdown(0);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhoneNumber(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (mode === 'forgot') {
                if (forgotStep === 'input') {
                    if (isPhoneInput(identifier)) {
                        await authApi.sendCode(rawDigits(identifier));
                        setForgotType('phone');
                        setForgotStep('verify');
                    } else {
                        await authApi.forgotPassword(identifier);
                        setForgotType('email');
                        setForgotDone(true);
                    }
                } else {
                    if (newPassword.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
                    await authApi.resetPassword(verifyCode, newPassword);
                    setForgotDone(true);
                }
            } else if (mode === 'login') {
                const loginId = isPhoneInput(identifier) ? rawDigits(identifier) : identifier;
                const result = await authApi.login(loginId, password);
                localStorage.setItem('token', result.token);
                onSuccess(result.user, result.token);
            } else {
                if (registerStep === 'form') {
                    const type = registerTab === 'phone' ? 'PHONE' : 'EMAIL';
                    const id = registerTab === 'phone' ? rawDigits(phone) : email;
                    if (!id) throw new Error(registerTab === 'phone' ? '전화번호를 입력해주세요.' : '이메일을 입력해주세요.');
                    if (!password) throw new Error('비밀번호를 입력해주세요.');
                    await authApi.sendVerify(type, id);
                    setRegisterStep('verify');
                    startResendTimer();
                } else {
                    const type = registerTab === 'phone' ? 'PHONE' : 'EMAIL';
                    const id = registerTab === 'phone' ? rawDigits(phone) : email;
                    const result = await authApi.verifyRegister(type, id, regVerifyCode, password, username || undefined);
                    localStorage.setItem('token', result.token);
                    onSuccess(result.user, result.token);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 크림 스타일 공통 클래스
    const inputClass = 'w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none';
    const inputStyle: React.CSSProperties = {
        background: '#FFFDF9',
        border: '1px solid #D9CEBF',
        color: '#2D2017',
    };
    const inputFocusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.style.borderColor = '#8E6FB7';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(142,111,183,0.12)';
    };
    const inputBlurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.style.borderColor = '#D9CEBF';
        e.currentTarget.style.boxShadow = 'none';
    };
    const labelClass = 'block text-xs font-medium mb-1.5';
    const labelStyle: React.CSSProperties = { color: '#7A6555' };

    const formCard = (
        <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative"
            style={{ background: '#FBF8F3', border: '1px solid #E8DDD0' }}>
            {onClose && !fullScreen && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 transition-colors z-10"
                    style={{ color: '#B0A090' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B4E3D'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#B0A090'}
                >
                    <Icon name="X" size={20} />
                </button>
            )}

            {/* 로고 */}
            <div className="flex items-center justify-center gap-2 pt-8 pb-6">
                <div className="p-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}>
                    <Icon name="Bot" size={24} />
                </div>
                <span className="text-xl font-bold" style={{ color: '#2D2017' }}>
                    AI 페르소나
                </span>
            </div>

            {/* 탭 (forgot 모드일 때 숨김) */}
            {mode !== 'forgot' && (
                <div className="flex rounded-xl p-1 mx-6" style={{ background: '#EFE8DE' }}>
                    <button
                        onClick={() => switchMode('login')}
                        className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
                        style={mode === 'login'
                            ? { background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)', color: '#fff', boxShadow: '0 2px 8px rgba(142,111,183,0.3)' }
                            : { color: '#A89080' }}
                    >
                        로그인
                    </button>
                    <button
                        onClick={() => switchMode('register')}
                        className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
                        style={mode === 'register'
                            ? { background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)', color: '#fff', boxShadow: '0 2px 8px rgba(142,111,183,0.3)' }
                            : { color: '#A89080' }}
                    >
                        회원가입
                    </button>
                </div>
            )}

            {/* 비밀번호 찾기 헤더 */}
            {mode === 'forgot' && (
                <div className="px-6 pb-2">
                    <button
                        onClick={() => switchMode('login')}
                        className="flex items-center gap-1 text-sm transition-colors mb-4"
                        style={{ color: '#A89080' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B4E3D'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#A89080'}
                    >
                        <Icon name="ChevronLeft" size={16} />
                        로그인으로 돌아가기
                    </button>
                    <h3 className="text-lg font-bold" style={{ color: '#2D2017' }}>비밀번호 찾기</h3>
                    <p className="text-sm mt-1" style={{ color: '#7A6555' }}>
                        {forgotStep === 'verify'
                            ? '발송된 인증번호와 새 비밀번호를 입력하세요.'
                            : '가입 시 사용한 이메일 또는 전화번호를 입력하세요.'}
                    </p>
                </div>
            )}

            {/* 완료 화면 */}
            {mode === 'forgot' && forgotDone ? (
                <div className="p-6">
                    <div className="flex flex-col items-center text-center py-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                            style={{ background: 'rgba(142,111,183,0.15)' }}>
                            <Icon name={forgotType === 'phone' ? 'Check' : 'Mail'} size={24} style={{ color: '#8E6FB7' } as React.CSSProperties} />
                        </div>
                        {forgotType === 'phone' ? (
                            <>
                                <p className="font-semibold mb-2" style={{ color: '#2D2017' }}>비밀번호가 변경되었습니다</p>
                                <p className="text-sm" style={{ color: '#7A6555' }}>새 비밀번호로 로그인하세요.</p>
                            </>
                        ) : (
                            <>
                                <p className="font-semibold mb-2" style={{ color: '#2D2017' }}>이메일을 확인해주세요</p>
                                <p className="text-sm" style={{ color: '#7A6555' }}>
                                    <span style={{ color: '#8E6FB7' }}>{identifier}</span>로<br />
                                    재설정 링크를 전송했습니다.<br />
                                    링크는 30분간 유효합니다.
                                </p>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => switchMode('login')}
                        className="w-full mt-4 text-sm transition-colors"
                        style={{ color: '#A89080' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2D2017'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#A89080'}
                    >
                        로그인으로 돌아가기
                    </button>
                </div>

            ) : mode === 'forgot' && forgotStep === 'verify' ? (
                <form key="forgot-verify" onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
                    <input type="text" name="username" style={{ display: 'none' }} autoComplete="username" aria-hidden="true" readOnly />
                    <input type="password" name="current-password" style={{ display: 'none' }} autoComplete="current-password" aria-hidden="true" readOnly />
                    <div>
                        <label className={labelClass} style={labelStyle}>인증번호 (6자리)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verifyCode}
                            onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            required
                            autoComplete="one-time-code"
                            name="otp-code"
                            className={inputClass}
                            style={{ ...inputStyle, placeholder: '#C4B5A5' } as React.CSSProperties}
                            onFocus={inputFocusStyle}
                            onBlur={inputBlurStyle}
                        />
                    </div>
                    <div>
                        <label className={labelClass} style={labelStyle}>새 비밀번호</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="6자 이상"
                            required
                            autoComplete="new-password"
                            name="new-password"
                            className={inputClass}
                            style={inputStyle}
                            onFocus={inputFocusStyle}
                            onBlur={inputBlurStyle}
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
                            style={{ color: '#C0392B', background: '#FDF0ED', border: '1px solid #F5C6C0' }}>
                            <Icon name="AlertCircle" size={15} className="shrink-0" />
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full font-semibold py-3 rounded-xl transition-all text-sm text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}
                    >
                        {loading ? '처리 중...' : '비밀번호 변경'}
                    </button>
                </form>

            ) : mode === 'register' && registerStep === 'verify' ? (
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
                        style={{ background: '#F5EFE6', color: '#7A6555', border: '1px solid #E8DDD0' }}>
                        <Icon name="Mail" size={15} className="shrink-0" style={{ color: '#8E6FB7' } as React.CSSProperties} />
                        <span>
                            {registerTab === 'phone' ? phone : email}로<br />
                            인증번호 6자리를 발송했습니다.
                        </span>
                    </div>
                    <div>
                        <label className={labelClass} style={labelStyle}>인증번호 (6자리)</label>
                        <input
                            autoFocus
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={regVerifyCode}
                            onChange={e => setRegVerifyCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            required
                            autoComplete="off"
                            className={inputClass}
                            style={inputStyle}
                            onFocus={inputFocusStyle}
                            onBlur={inputBlurStyle}
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
                            style={{ color: '#C0392B', background: '#FDF0ED', border: '1px solid #F5C6C0' }}>
                            <Icon name="AlertCircle" size={15} className="shrink-0" />
                            {error}
                        </div>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || regVerifyCode.length < 6}
                        className="w-full font-semibold py-3 rounded-xl transition-all text-sm text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}
                    >
                        {loading ? '처리 중...' : '가입 완료'}
                    </button>
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => { setRegisterStep('form'); setRegVerifyCode(''); setError(''); }}
                            className="text-xs transition-colors"
                            style={{ color: '#A89080' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2D2017'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#A89080'}
                        >
                            ← 돌아가기
                        </button>
                        <button
                            type="button"
                            disabled={resendCountdown > 0 || loading}
                            onClick={async () => {
                                setError('');
                                setLoading(true);
                                try {
                                    const type = registerTab === 'phone' ? 'PHONE' : 'EMAIL';
                                    const id = registerTab === 'phone' ? rawDigits(phone) : email;
                                    await authApi.sendVerify(type, id);
                                    startResendTimer();
                                } catch (err: any) {
                                    setError(err.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="text-xs transition-colors disabled:cursor-not-allowed"
                            style={{ color: '#8E6FB7' }}
                            onMouseEnter={e => { if (!((e.currentTarget as HTMLButtonElement).disabled)) (e.currentTarget as HTMLElement).style.color = '#6B4E9A'; }}
                            onMouseLeave={e => { if (!((e.currentTarget as HTMLButtonElement).disabled)) (e.currentTarget as HTMLElement).style.color = '#8E6FB7'; }}
                        >
                            {resendCountdown > 0 ? `재발송 (${resendCountdown}초)` : '인증번호 재발송'}
                        </button>
                    </div>
                </div>

            ) : (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* 회원가입 전용: 이메일/전화번호 탭 */}
                    {mode === 'register' && (
                        <div className="flex rounded-xl p-1" style={{ background: '#EFE8DE' }}>
                            <button
                                type="button"
                                onClick={() => setRegisterTab('email')}
                                className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                                style={registerTab === 'email'
                                    ? { background: '#FBF8F3', color: '#2D2017', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                                    : { color: '#A89080' }}
                            >
                                이메일
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegisterTab('phone')}
                                className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                                style={registerTab === 'phone'
                                    ? { background: '#FBF8F3', color: '#2D2017', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                                    : { color: '#A89080' }}
                            >
                                휴대전화
                            </button>
                        </div>
                    )}

                    {/* 회원가입 전용: 닉네임 */}
                    {mode === 'register' && (
                        <div>
                            <label className={labelClass} style={labelStyle}>닉네임 (선택)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="사용할 닉네임"
                                className={inputClass}
                                style={inputStyle}
                                onFocus={inputFocusStyle}
                                onBlur={inputBlurStyle}
                            />
                        </div>
                    )}

                    {(mode === 'login' || mode === 'forgot') && (
                        <div>
                            <label className={labelClass} style={labelStyle}>이메일 또는 전화번호</label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                placeholder="example@email.com 또는 010-1234-5678"
                                required
                                className={inputClass}
                                style={inputStyle}
                                onFocus={inputFocusStyle}
                                onBlur={inputBlurStyle}
                            />
                        </div>
                    )}
                    {mode === 'register' && registerTab === 'email' && (
                        <div>
                            <label className={labelClass} style={labelStyle}>이메일</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="example@email.com"
                                required
                                className={inputClass}
                                style={inputStyle}
                                onFocus={inputFocusStyle}
                                onBlur={inputBlurStyle}
                            />
                        </div>
                    )}
                    {mode === 'register' && registerTab === 'phone' && (
                        <div>
                            <label className={labelClass} style={labelStyle}>휴대전화번호</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="010-1234-5678"
                                required
                                className={inputClass}
                                style={inputStyle}
                                onFocus={inputFocusStyle}
                                onBlur={inputBlurStyle}
                            />
                        </div>
                    )}

                    {mode !== 'forgot' && (
                        <div>
                            <label className={labelClass} style={labelStyle}>비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={mode === 'login' ? '비밀번호' : '8자 이상 권장'}
                                required
                                className={inputClass}
                                style={inputStyle}
                                onFocus={inputFocusStyle}
                                onBlur={inputBlurStyle}
                            />
                            {mode === 'login' && (
                                <button
                                    type="button"
                                    onClick={() => switchMode('forgot')}
                                    className="mt-2 text-sm transition-colors underline underline-offset-2 block w-full text-right"
                                    style={{ color: '#8E6FB7' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B4E9A'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8E6FB7'}
                                >
                                    비밀번호를 잊으셨나요?
                                </button>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 clear-both"
                            style={{ color: '#C0392B', background: '#FDF0ED', border: '1px solid #F5C6C0' }}>
                            <Icon name="AlertCircle" size={15} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full font-semibold py-3 rounded-xl transition-all text-sm text-white disabled:opacity-50 clear-both"
                        style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}
                    >
                        {loading
                            ? '처리 중...'
                            : mode === 'login'
                                ? '로그인'
                                : mode === 'register'
                                    ? '인증코드 발송'
                                    : isPhoneInput(identifier)
                                        ? '인증코드 발송'
                                        : '재설정 링크 전송'
                        }
                    </button>
                </form>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(135deg, #F5EFE6 0%, #FBF8F3 55%, #EDE4D8 100%)' }}>
                <div className="flex items-center px-6 py-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 transition-colors text-sm"
                        style={{ color: '#A89080' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2D2017'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#A89080'}
                    >
                        <Icon name="ChevronLeft" size={18} />
                        돌아가기
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center px-4 pb-16">
                    {formCard}
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(45,32,23,0.5)' }}
            onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
        >
            {formCard}
        </div>
    );
};
