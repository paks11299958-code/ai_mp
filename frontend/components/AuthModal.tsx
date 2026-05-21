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
    const [identifier, setIdentifier] = useState('');   // login / forgot 공용
    const [email, setEmail] = useState('');              // register 이메일 탭
    const [phone, setPhone] = useState('');              // register 전화번호 탭 (포매팅됨)
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

    const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';
    const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5';

    const formCard = (
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
            {onClose && !fullScreen && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors z-10"
                >
                    <Icon name="X" size={20} />
                </button>
            )}

            {/* 로고 */}
            <div className="flex items-center justify-center gap-2 pt-8 pb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Icon name="Bot" size={24} />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    AI 페르소나
                </span>
            </div>

            {/* 탭 (forgot 모드일 때 숨김) */}
            {mode !== 'forgot' && (
                <div className="flex bg-gray-800 rounded-xl p-1 mx-6">
                    <button
                        onClick={() => switchMode('login')}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            mode === 'login'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        로그인
                    </button>
                    <button
                        onClick={() => switchMode('register')}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            mode === 'register'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
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
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm transition-colors mb-4"
                    >
                        <Icon name="ChevronLeft" size={16} />
                        로그인으로 돌아가기
                    </button>
                    <h3 className="text-lg font-bold text-gray-100">비밀번호 찾기</h3>
                    <p className="text-sm text-gray-400 mt-1">
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
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                            <Icon name={forgotType === 'phone' ? 'Check' : 'Mail'} size={24} className="text-green-400" />
                        </div>
                        {forgotType === 'phone' ? (
                            <>
                                <p className="text-gray-200 font-semibold mb-2">비밀번호가 변경되었습니다</p>
                                <p className="text-sm text-gray-400">새 비밀번호로 로그인하세요.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-200 font-semibold mb-2">이메일을 확인해주세요</p>
                                <p className="text-sm text-gray-400">
                                    <span className="text-blue-400">{identifier}</span>로<br />
                                    재설정 링크를 전송했습니다.<br />
                                    링크는 30분간 유효합니다.
                                </p>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => switchMode('login')}
                        className="w-full mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        로그인으로 돌아가기
                    </button>
                </div>

            ) : mode === 'forgot' && forgotStep === 'verify' ? (
                /* 전화번호 인증코드 + 새 비밀번호 폼 */
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className={labelClass}>인증번호 (6자리)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verifyCode}
                            onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            required
                            autoComplete="off"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>새 비밀번호</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="6자 이상"
                            required
                            className={inputClass}
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
                            <Icon name="AlertCircle" size={15} className="shrink-0" />
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                    >
                        {loading ? '처리 중...' : '비밀번호 변경'}
                    </button>
                </form>

            ) : mode === 'register' && registerStep === 'verify' ? (
                /* 회원가입 인증코드 입력 */
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800/60 rounded-xl px-4 py-3">
                        <Icon name="Mail" size={15} className="shrink-0 text-purple-400" />
                        <span>
                            {registerTab === 'phone' ? phone : email}로<br />
                            인증번호 6자리를 발송했습니다.
                        </span>
                    </div>
                    <div>
                        <label className={labelClass}>인증번호 (6자리)</label>
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
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
                            <Icon name="AlertCircle" size={15} className="shrink-0" />
                            {error}
                        </div>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || regVerifyCode.length < 6}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                    >
                        {loading ? '처리 중...' : '가입 완료'}
                    </button>
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => { setRegisterStep('form'); setRegVerifyCode(''); setError(''); }}
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            {resendCountdown > 0 ? `재발송 (${resendCountdown}초)` : '인증번호 재발송'}
                        </button>
                    </div>
                </div>

            ) : (
                /* 메인 폼 */
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* 회원가입 전용: 이메일/전화번호 탭 */}
                    {mode === 'register' && (
                        <div className="flex bg-gray-800 rounded-xl p-1">
                            <button
                                type="button"
                                onClick={() => setRegisterTab('email')}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                    registerTab === 'email'
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                이메일
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegisterTab('phone')}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                    registerTab === 'phone'
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                휴대전화
                            </button>
                        </div>
                    )}

                    {/* 회원가입 전용: 닉네임 */}
                    {mode === 'register' && (
                        <div>
                            <label className={labelClass}>닉네임 (선택)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="사용할 닉네임"
                                className={inputClass}
                            />
                        </div>
                    )}

                    {/* 이메일 입력 — 로그인/forgot: identifier, 회원가입 이메일탭: email */}
                    {(mode === 'login' || mode === 'forgot') && (
                        <div>
                            <label className={labelClass}>이메일 또는 전화번호</label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                placeholder="example@email.com 또는 010-1234-5678"
                                required
                                className={inputClass}
                            />
                        </div>
                    )}
                    {mode === 'register' && registerTab === 'email' && (
                        <div>
                            <label className={labelClass}>이메일</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="example@email.com"
                                required
                                className={inputClass}
                            />
                        </div>
                    )}
                    {mode === 'register' && registerTab === 'phone' && (
                        <div>
                            <label className={labelClass}>휴대전화번호</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="010-1234-5678"
                                required
                                className={inputClass}
                            />
                        </div>
                    )}

                    {/* 비밀번호 (forgot 모드 제외) */}
                    {mode !== 'forgot' && (
                        <div>
                            <label className={labelClass}>비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={mode === 'login' ? '비밀번호' : '8자 이상 권장'}
                                required
                                className={inputClass}
                            />
                            {mode === 'login' && (
                                <button
                                    type="button"
                                    onClick={() => switchMode('forgot')}
                                    className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2 block w-full text-right"
                                >
                                    비밀번호를 잊으셨나요?
                                </button>
                            )}
                        </div>
                    )}

                    {/* 에러 */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 clear-both">
                            <Icon name="AlertCircle" size={15} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* 제출 버튼 */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm clear-both"
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
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #1e1035 100%)' }}>
                <div className="flex items-center px-6 py-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
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
            className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
        >
            {formCard}
        </div>
    );
};
