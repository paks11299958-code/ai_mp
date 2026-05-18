import React, { useState, useEffect } from 'react';
import { X, Package, Mail, Loader, CheckCircle, ChevronRight } from 'lucide-react';

interface Category {
    code: string;
    name: string;
    emoji: string;
    keywords: string;
}

interface Props {
    onClose: () => void;
    userEmail?: string | null;
}

type Step = 'select' | 'confirm' | 'running' | 'done';

export const ProductExtractDialog: React.FC<Props> = ({ onClose, userEmail }) => {
    const [step, setStep] = useState<Step>('select');
    const [categories, setCategories] = useState<Category[]>([]);
    const [selected, setSelected] = useState<Category | null>(null);
    const [email, setEmail] = useState(userEmail || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/hot-keyword/categories', { credentials: 'include' })
            .then(r => r.json())
            .then(data => setCategories(Array.isArray(data) ? data : []))
            .catch(() => setError('카테고리 로드 실패'));
    }, []);

    const handleNext = () => {
        if (!selected) { setError('카테고리를 선택해주세요.'); return; }
        setError('');
        setStep('confirm');
    };

    const handleRun = async () => {
        if (!email.trim()) { setError('이메일을 입력해주세요.'); return; }
        setError('');
        setLoading(true);
        setStep('running');

        try {
            const res = await fetch('/api/product-extract/run', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryCode: selected!.code, email: email.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '실행 실패');
            setStep('done');
        } catch (e: any) {
            setError(e.message);
            setStep('confirm');
        } finally {
            setLoading(false);
        }
    };

    const keywords = selected ? (() => { try { return JSON.parse(selected.keywords).slice(0, 5); } catch { return []; } })() : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-900/40 to-teal-900/40">
                    <div className="flex items-center gap-2">
                        <Package size={18} className="text-emerald-400" />
                        <span className="text-white font-semibold">제품추출</span>
                        <span className="text-xs text-white/40 ml-1">도매매 → 쿠팡윙 엑셀</span>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5">
                    {/* 카테고리 선택 */}
                    {step === 'select' && (
                        <>
                            <p className="text-sm text-white/60 mb-4">
                                카테고리 1개를 선택하면 해당 카테고리 핫키워드로 도매매를 검색해서<br />
                                상위 상품 정보를 쿠팡윙 업로드용 엑셀로 만들어 이메일로 보내드립니다.
                            </p>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                                {categories.map(cat => (
                                    <button
                                        key={cat.code}
                                        onClick={() => { setSelected(cat); setError(''); }}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${
                                            selected?.code === cat.code
                                                ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200'
                                                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white'
                                        }`}
                                    >
                                        <span className="text-base">{cat.emoji || '🛍️'}</span>
                                        <span className="truncate">{cat.name}</span>
                                    </button>
                                ))}
                            </div>
                            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                            <button
                                onClick={handleNext}
                                disabled={!selected}
                                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                            >
                                다음 <ChevronRight size={14} />
                            </button>
                        </>
                    )}

                    {/* 이메일 확인 */}
                    {step === 'confirm' && (
                        <>
                            <div className="bg-white/5 rounded-xl p-4 mb-4">
                                <p className="text-white/40 text-xs mb-1">선택한 카테고리</p>
                                <p className="text-white font-medium">{selected?.emoji} {selected?.name}</p>
                                {keywords.length > 0 && (
                                    <p className="text-white/50 text-xs mt-1.5">
                                        키워드: {keywords.join(' · ')}
                                    </p>
                                )}
                            </div>
                            <div className="mb-4">
                                <label className="block text-white/60 text-xs mb-1.5 flex items-center gap-1">
                                    <Mail size={11} /> 결과 받을 이메일
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm hover:text-white hover:border-white/30 transition-colors"
                                >
                                    이전
                                </button>
                                <button
                                    onClick={handleRun}
                                    disabled={loading}
                                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    추출 시작
                                </button>
                            </div>
                        </>
                    )}

                    {/* 실행 중 */}
                    {step === 'running' && (
                        <div className="text-center py-8">
                            <Loader size={32} className="text-emerald-400 animate-spin mx-auto mb-4" />
                            <p className="text-white font-medium">제품추출 시작 중...</p>
                            <p className="text-white/50 text-sm mt-2">백그라운드에서 실행됩니다</p>
                        </div>
                    )}

                    {/* 완료 */}
                    {step === 'done' && (
                        <div className="text-center py-8">
                            <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
                            <p className="text-white font-semibold text-lg">추출 시작!</p>
                            <p className="text-white/60 text-sm mt-2">
                                {selected?.name} 카테고리 제품추출을 시작했습니다.<br />
                                완료되면 <span className="text-emerald-400">{email}</span>로 엑셀을 보내드립니다.
                            </p>
                            <p className="text-white/40 text-xs mt-3">보통 3~5분 소요됩니다</p>
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
