import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Mail, MessageSquare, CheckCircle, Loader, ChevronRight } from 'lucide-react';

interface Category {
    code: string;
    name: string;
    emoji: string;
    keywords: string;
}

interface Props {
    onClose: () => void;
    userEmail?: string | null;
    userPhone?: string | null;
}

type Step = 'select' | 'delivery' | 'sending' | 'done';
type DeliveryMethod = 'email' | 'sms' | 'both';

export const HotKeywordBoard: React.FC<Props> = ({ onClose, userEmail, userPhone }) => {
    const [step, setStep] = useState<Step>('select');
    const [categories, setCategories] = useState<Category[]>([]);
    const [selected, setSelected] = useState<Category[]>([]);
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('email');
    const [email, setEmail] = useState(userEmail || '');
    const [phone, setPhone] = useState(userPhone || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/hot-keyword/categories', { credentials: 'include' })
            .then(r => r.json())
            .then(data => setCategories(Array.isArray(data) ? data : []))
            .catch(() => setError('카테고리 로드 실패'));
    }, []);

    const toggleCategory = (cat: Category) => {
        setSelected(prev => {
            const exists = prev.find(c => c.code === cat.code);
            if (exists) return prev.filter(c => c.code !== cat.code);
            if (prev.length >= 3) {
                setError('최대 3개까지 선택 가능합니다.');
                return prev;
            }
            setError('');
            return [...prev, cat];
        });
    };

    const handleNext = () => {
        if (selected.length === 0) { setError('카테고리를 1개 이상 선택해주세요.'); return; }
        setError('');
        setStep('delivery');
    };

    const handleSend = async () => {
        if ((deliveryMethod === 'email' || deliveryMethod === 'both') && !email.trim()) {
            setError('이메일을 입력해주세요.'); return;
        }
        if ((deliveryMethod === 'sms' || deliveryMethod === 'both') && !phone.trim()) {
            setError('전화번호를 입력해주세요.'); return;
        }
        setError('');
        setStep('sending');

        const parsedCategories = selected.map(cat => ({
            code: cat.code,
            name: cat.name,
            emoji: cat.emoji,
            keywords: (() => { try { return JSON.parse(cat.keywords); } catch { return []; } })(),
        }));

        try {
            const res = await fetch('/api/hot-keyword/run', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categories: parsedCategories,
                    deliveryMethod,
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '발송 실패');
            setStep('done');
        } catch (e: any) {
            setError(e.message || '오류가 발생했습니다.');
            setStep('delivery');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-900/60">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={18} className="text-orange-400" />
                        <span className="text-white font-semibold text-sm">핫쇼핑키워드</span>
                        {step !== 'select' && (
                            <span className="text-slate-400 text-xs ml-1">
                                {step === 'delivery' ? '발송 설정' : step === 'sending' ? '발송 중...' : '완료'}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5">
                    {/* Step 1: 카테고리 선택 */}
                    {step === 'select' && (
                        <>
                            <p className="text-slate-300 text-xs mb-4">
                                네이버 쇼핑 카테고리를 <span className="text-orange-400 font-semibold">최대 3개</span> 선택하세요.
                                선택한 카테고리의 인기 키워드 TOP10을 바로 받아볼 수 있습니다.
                            </p>
                            {categories.length === 0 ? (
                                <div className="flex justify-center py-8">
                                    <Loader size={20} className="animate-spin text-slate-400" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {categories.map(cat => {
                                        const isSelected = !!selected.find(c => c.code === cat.code);
                                        return (
                                            <button
                                                key={cat.code}
                                                onClick={() => toggleCategory(cat)}
                                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                                    isSelected
                                                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                                        : 'bg-slate-800/60 border-slate-600 text-slate-300 hover:border-slate-500'
                                                }`}
                                            >
                                                <span className="text-base">{cat.emoji}</span>
                                                <span className="text-xs">{cat.name}</span>
                                                {isSelected && (
                                                    <CheckCircle size={12} className="ml-auto text-orange-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {selected.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {selected.map(cat => (
                                        <span key={cat.code} className="text-[11px] bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-full">
                                            {cat.emoji} {cat.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                            <button
                                onClick={handleNext}
                                disabled={selected.length === 0}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                            >
                                다음 <ChevronRight size={15} />
                            </button>
                        </>
                    )}

                    {/* Step 2: 발송 설정 */}
                    {step === 'delivery' && (
                        <>
                            <p className="text-slate-300 text-xs mb-4">결과를 받을 방법을 선택하세요.</p>

                            {/* 발송 방법 */}
                            <div className="flex gap-2 mb-4">
                                {([
                                    { value: 'email', label: '이메일', icon: Mail },
                                    { value: 'sms', label: '문자', icon: MessageSquare },
                                ] as const).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setDeliveryMethod(opt.value)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                                            deliveryMethod === opt.value
                                                ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                                : 'bg-slate-800/60 border-slate-600 text-slate-400 hover:border-slate-500'
                                        }`}
                                    >
                                        {opt.icon && <opt.icon size={13} />}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* 이메일 입력 */}
                            {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                                <div className="mb-3">
                                    <label className="text-slate-400 text-xs mb-1 block">이메일 주소</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="example@email.com"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            )}

                            {/* 전화번호 입력 */}
                            {(deliveryMethod === 'sms' || deliveryMethod === 'both') && (
                                <div className="mb-3">
                                    <label className="text-slate-400 text-xs mb-1 block">전화번호</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="01012345678"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            )}

                            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setStep('select'); setError(''); }}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:border-slate-500 transition-colors"
                                >
                                    이전
                                </button>
                                <button
                                    onClick={handleSend}
                                    className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-colors"
                                >
                                    지금 받기
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 3: 발송 중 */}
                    {step === 'sending' && (
                        <div className="flex flex-col items-center py-10 gap-4">
                            <Loader size={32} className="animate-spin text-orange-400" />
                            <p className="text-slate-300 text-sm">키워드 분석 중입니다...</p>
                            <p className="text-slate-500 text-xs">네이버 데이터랩에서 데이터를 수집하고 있습니다.</p>
                        </div>
                    )}

                    {/* Step 4: 완료 */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <CheckCircle size={40} className="text-green-400" />
                            <div className="text-center">
                                <p className="text-white font-semibold mb-1">발송 완료!</p>
                                <p className="text-slate-400 text-xs">
                                    {deliveryMethod === 'email' && `${email}로 이메일을 발송했습니다.`}
                                    {deliveryMethod === 'sms' && `${phone}으로 문자를 발송했습니다.`}
                                    {deliveryMethod === 'both' && `이메일과 문자를 모두 발송했습니다.`}
                                </p>
                                <p className="text-slate-500 text-xs mt-1">잠시 후 확인해보세요.</p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                                {selected.map(cat => (
                                    <span key={cat.code} className="text-[11px] bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-full">
                                        {cat.emoji} {cat.name}
                                    </span>
                                ))}
                            </div>
                            <button
                                onClick={onClose}
                                className="mt-2 px-6 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
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
