import React, { useState } from 'react';
import { authApi } from '../services/apiService';
import { Icon } from './Icons';

interface ResetPasswordModalProps {
    token: string;
    onClose: () => void;
}

const inputStyle: React.CSSProperties = {
    background: '#FFFDF9',
    border: '1px solid #D9CEBF',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#2D2017',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
};

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ token, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) {
            setError('비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        if (password !== confirm) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        setLoading(true);
        try {
            await authApi.resetPassword(token, password);
            setDone(true);
            setTimeout(() => {
                window.history.replaceState({}, '', window.location.pathname);
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(45,32,23,0.5)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: '#FBF8F3', border: '1px solid #E8DDD0', letterSpacing: '-0.02em' }}
            >
                {/* 로고 */}
                <div className="flex items-center justify-center gap-2 pt-8 pb-6">
                    <div
                        className="p-2 rounded-xl text-white"
                        style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}
                    >
                        <Icon name="Bot" size={24} />
                    </div>
                    <span
                        className="text-xl font-bold bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(135deg, #8E6FB7, #C49A6C)', WebkitBackgroundClip: 'text' }}
                    >
                        AI 페르소나
                    </span>
                </div>

                <div className="px-6 pb-2">
                    <h3 className="text-lg font-bold" style={{ color: '#2D2017' }}>새 비밀번호 설정</h3>
                    <p className="text-sm mt-1" style={{ color: '#A89080' }}>사용할 새 비밀번호를 입력해주세요.</p>
                </div>

                {done ? (
                    <div className="p-6">
                        <div className="flex flex-col items-center text-center py-4">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                                style={{ background: '#EDE4D8' }}
                            >
                                <Icon name="CheckCircle" size={24} style={{ color: '#8E6FB7' } as React.CSSProperties} />
                            </div>
                            <p className="font-semibold mb-2" style={{ color: '#2D2017' }}>비밀번호 변경 완료!</p>
                            <p className="text-sm" style={{ color: '#A89080' }}>잠시 후 로그인 화면으로 이동합니다.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#A89080' }}>새 비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="6자 이상"
                                required
                                style={inputStyle}
                                onFocus={e => (e.currentTarget.style.borderColor = '#8E6FB7')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#D9CEBF')}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: '#A89080' }}>비밀번호 확인</label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                placeholder="비밀번호 재입력"
                                required
                                style={inputStyle}
                                onFocus={e => (e.currentTarget.style.borderColor = '#8E6FB7')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#D9CEBF')}
                            />
                        </div>

                        {error && (
                            <div
                                className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
                                style={{ color: '#C0392B', background: '#FDF0ED', border: '1px solid #F5C6C0' }}
                            >
                                <Icon name="AlertCircle" size={15} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                            style={{ background: 'linear-gradient(135deg, #8E6FB7, #C49A6C)' }}
                        >
                            {loading ? '처리 중...' : '비밀번호 변경'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
