import React, { useState } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';
import { Icon } from './Icons';

interface AuthModalProps {
    onSuccess: (user: User, token: string) => void;
    onClose?: () => void;
    defaultMode?: 'login' | 'register';
}

type Mode = 'login' | 'register' | 'forgot';

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose, defaultMode = 'login' }) => {
    const [mode, setMode] = useState<Mode>(defaultMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [forgotDone, setForgotDone] = useState(false);

    const switchMode = (m: Mode) => {
        setMode(m);
        setError('');
        setEmail('');
        setPassword('');
        setUsername('');
        setForgotDone(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (mode === 'forgot') {
                await authApi.forgotPassword(email);
                setForgotDone(true);
            } else {
                const result = mode === 'login'
                    ? await authApi.login(email, password)
                    : await authApi.register(email, password, username || undefined);
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
            className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
        >
            <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">

                {onClose && (
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

                {/* 탭 (forgot 모드일 때는 숨김) */}
                {mode !== 'forgot' && (
                    <div className="flex border-b border-gray-800 mx-6">
                        <button
                            onClick={() => switchMode('login')}
                            className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                                mode === 'login'
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            로그인
                        </button>
                        <button
                            onClick={() => switchMode('register')}
                            className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                                mode === 'register'
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
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
                        <p className="text-sm text-gray-400 mt-1">가입한 이메일로 재설정 링크를 보내드립니다.</p>
                    </div>
                )}

                {/* 전송 완료 상태 */}
                {mode === 'forgot' && forgotDone ? (
                    <div className="p-6">
                        <div className="flex flex-col items-center text-center py-4">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                <Icon name="Mail" size={24} className="text-green-400" />
                            </div>
                            <p className="text-gray-200 font-semibold mb-2">이메일을 확인해주세요</p>
                            <p className="text-sm text-gray-400">
                                <span className="text-blue-400">{email}</span>로<br />
                                재설정 링크를 전송했습니다.<br />
                                링크는 30분간 유효합니다.
                            </p>
                        </div>
                        <button
                            onClick={() => switchMode('login')}
                            className="w-full mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            로그인으로 돌아가기
                        </button>
                    </div>
                ) : (
                    /* 폼 */
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">

                        {/* 회원가입 전용: 닉네임 */}
                        {mode === 'register' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">닉네임 (선택)</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="사용할 닉네임"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                />
                            </div>
                        )}

                        {/* 이메일 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">이메일</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="example@email.com"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            />
                        </div>

                        {/* 비밀번호 (forgot 모드 제외) */}
                        {mode !== 'forgot' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">비밀번호</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={mode === 'login' ? '비밀번호' : '8자 이상 권장'}
                                    required
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                />
                                {/* 비밀번호 찾기 링크 (로그인 모드에서만) */}
                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        onClick={() => switchMode('forgot')}
                                        className="mt-1.5 text-xs text-gray-500 hover:text-blue-400 transition-colors float-right"
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
                                        ? '회원가입'
                                        : '재설정 링크 전송'
                            }
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
