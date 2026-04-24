import React, { useState } from 'react';
import { authApi } from '../services/apiService';
import { Icon } from './Icons';

interface ResetPasswordModalProps {
    token: string;
    onClose: () => void;
}

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
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">

                {/* 로고 */}
                <div className="flex items-center justify-center gap-2 pt-8 pb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        <Icon name="Bot" size={24} />
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        AI 페르소나
                    </span>
                </div>

                <div className="px-6 pb-2">
                    <h3 className="text-lg font-bold text-gray-100">새 비밀번호 설정</h3>
                    <p className="text-sm text-gray-400 mt-1">사용할 새 비밀번호를 입력해주세요.</p>
                </div>

                {done ? (
                    <div className="p-6">
                        <div className="flex flex-col items-center text-center py-4">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                <Icon name="CheckCircle" size={24} className="text-green-400" />
                            </div>
                            <p className="text-gray-200 font-semibold mb-2">비밀번호 변경 완료!</p>
                            <p className="text-sm text-gray-400">잠시 후 로그인 화면으로 이동합니다.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">새 비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="6자 이상"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">비밀번호 확인</label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                placeholder="비밀번호 재입력"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
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
                )}
            </div>
        </div>
    );
};
