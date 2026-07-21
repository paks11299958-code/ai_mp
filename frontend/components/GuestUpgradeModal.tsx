import React, { useState, useRef, useEffect } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';
import { Icon } from './Icons';

// 임시(레퍼럴 체험) 계정 → 정식 전환 모달. 포인트 소진 시 '충전' 대신 이 모달을 띄운다.
// 이메일/전화 인증(send-verify 재사용) 후 비밀번호를 설정하면 계정이 그대로 유지된 채
// provider가 local로 바뀌고, 이 시점에 서버가 레퍼럴 보상을 지급한다(있었다면).

interface GuestUpgradeModalProps {
    onSuccess: (user: User, token: string) => void;
    onClose: () => void;
}

type Tab = 'email' | 'phone';
type Step = 'form' | 'verify';

const isPhoneInput = (val: string) => /^\d{10,11}$/.test(val.replace(/-/g, ''));
const rawDigits = (val: string) => val.replace(/-/g, '');
const formatPhoneNumber = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

export const GuestUpgradeModal: React.FC<GuestUpgradeModalProps> = ({ onSuccess, onClose }) => {
    const [tab, setTab] = useState<Tab>('email');
    const [step, setStep] = useState<Step>('form');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);
    const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

    const inputClass = 'w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none';
    const inputStyle: React.CSSProperties = { background: '#FFFDF9', border: '1px solid #D9CEBF', color: '#2D2017' };
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

    const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const type = tab === 'phone' ? 'PHONE' : 'EMAIL';
            const id = tab === 'phone' ? rawDigits(phone) : email;
            if (step === 'form') {
                if (!id) throw new Error(tab === 'phone' ? '전화번호를 입력해주세요.' : '이메일을 입력해주세요.');
                if (!password || password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
                await authApi.sendVerify(type, id);
                setStep('verify');
                startResendTimer();
            } else {
                const result = await authApi.upgradeGuest(type, id, code, password);
                localStorage.setItem('token', result.token);
                onSuccess(result.user, result.token);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(45,32,23,0.5)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative"
                style={{ background: '#FBF8F3', border: '1px solid #E8DDD0' }}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 transition-colors z-10"
                    style={{ color: '#B0A090' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B4E3D'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#B0A090'}
                >
                    <Icon name="X" size={20} />
                </button>

                <div className="pt-8 pb-2 px-6 text-center">
                    <div className="text-2xl mb-1">✨</div>
                    <h3 className="text-lg font-bold" style={{ color: '#2D2017' }}>계속 이용하려면 가입해주세요</h3>
                    <p className="text-sm mt-1" style={{ color: '#7A6555' }}>
                        체험 포인트를 모두 사용했어요.<br />지금까지 대화는 그대로 유지돼요.
                    </p>
                </div>

                {step === 'verify' ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
                            style={{ background: '#F5EFE6', color: '#7A6555', border: '1px solid #E8DDD0' }}>
                            <Icon name="MessageSquare" size={15} className="shrink-0" style={{ color: '#8E6FB7' } as React.CSSProperties} />
                            <span>{tab === 'phone' ? phone : email}로<br />인증번호 6자리를 발송했습니다.</span>
                        </div>
                        <div>
                            <label className={labelClass} style={labelStyle}>인증번호 (6자리)</label>
                            <input
                                autoFocus
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
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
                            disabled={loading || code.length < 6}
                            className="w-full font-semibold py-3 rounded-xl transition-all text-sm text-white disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}
                        >
                            {loading ? '처리 중...' : '가입 완료'}
                        </button>
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => { setStep('form'); setCode(''); setError(''); }}
                                className="text-xs transition-colors"
                                style={{ color: '#A89080' }}
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
                                        const type = tab === 'phone' ? 'PHONE' : 'EMAIL';
                                        const id = tab === 'phone' ? rawDigits(phone) : email;
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
                            >
                                {resendCountdown > 0 ? `재발송 (${resendCountdown}초)` : '인증번호 재발송'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="flex rounded-xl p-1" style={{ background: '#EFE8DE' }}>
                            <button
                                type="button"
                                onClick={() => setTab('email')}
                                className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                                style={tab === 'email'
                                    ? { background: '#FBF8F3', color: '#2D2017', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                                    : { color: '#A89080' }}
                            >
                                이메일
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('phone')}
                                className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                                style={tab === 'phone'
                                    ? { background: '#FBF8F3', color: '#2D2017', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                                    : { color: '#A89080' }}
                            >
                                휴대전화
                            </button>
                        </div>

                        {tab === 'email' ? (
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
                        ) : (
                            <div>
                                <label className={labelClass} style={labelStyle}>휴대전화번호</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                                    placeholder="010-1234-5678"
                                    required
                                    className={inputClass}
                                    style={inputStyle}
                                    onFocus={inputFocusStyle}
                                    onBlur={inputBlurStyle}
                                />
                            </div>
                        )}

                        <div>
                            <label className={labelClass} style={labelStyle}>비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="6자 이상"
                                required
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
                            {loading ? '처리 중...' : '인증코드 발송'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
