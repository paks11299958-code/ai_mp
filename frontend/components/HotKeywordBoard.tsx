import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Mail, MessageSquare, CheckCircle, Loader, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const T = {
    bg:        '#FBF8F3',
    surface:   '#F5F0E8',
    card:      '#FFFFFF',
    border:    '#E8DDD0',
    borderSoft:'#EDE5D8',
    ink:       '#2D2520',
    inkSoft:   '#6B5F56',
    inkMute:   '#A0948A',
    orange:    '#D46A1A',
    orangeSoft:'#FEF3E8',
    orangeBorder:'#F0B882',
};

export const HotKeywordBoard: React.FC<Props> = ({ onClose, userEmail, userPhone }) => {
    const [step, setStep] = useState<Step>('select');
    const [categories, setCategories] = useState<Category[]>([]);
    const [selected, setSelected] = useState<Category[]>([]);
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('email');
    const [email, setEmail] = useState(userEmail || '');
    const [phone, setPhone] = useState(userPhone || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultContent, setResultContent] = useState<string | null>(null);

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
            if (prev.length >= 3) { setError('최대 3개까지 선택 가능합니다.'); return prev; }
            setError('');
            return [...prev, cat];
        });
    };

    const handleNext = () => {
        if (selected.length === 0) { setError('카테고리를 1개 이상 선택해주세요.'); return; }
        setError(''); setStep('delivery');
    };

    const handleSend = async () => {
        if ((deliveryMethod === 'email' || deliveryMethod === 'both') && !email.trim()) { setError('이메일을 입력해주세요.'); return; }
        if ((deliveryMethod === 'sms' || deliveryMethod === 'both') && !phone.trim()) { setError('전화번호를 입력해주세요.'); return; }
        setError(''); setStep('sending');
        const parsedCategories = selected.map(cat => ({
            code: cat.code, name: cat.name, emoji: cat.emoji,
            keywords: (() => { try { return JSON.parse(cat.keywords); } catch { return []; } })(),
        }));
        try {
            const res = await fetch('/api/hot-keyword/run', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories: parsedCategories, deliveryMethod, email: email.trim() || null, phone: phone.trim() || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '발송 실패');
            setResultContent(data.content || null);
            setStep('done');
        } catch (e: any) {
            setError(e.message || '오류가 발생했습니다.');
            setStep('delivery');
        }
    };

    const stepLabel = step === 'delivery' ? '발송 설정' : step === 'sending' ? '발송 중...' : step === 'done' ? '완료' : '';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(45,37,32,0.55)', backdropFilter: 'blur(6px)', padding: 16, fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: T.bg, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: '0 24px 60px rgba(45,37,32,0.2)', overflow: 'hidden' }}>

                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShoppingBag size={17} style={{ color: T.orange }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>핫쇼핑키워드</span>
                        {stepLabel && <span style={{ fontSize: 11, color: T.inkMute, marginLeft: 2 }}>{stepLabel}</span>}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute, display: 'flex', alignItems: 'center' }}>
                        <X size={17} />
                    </button>
                </div>

                <div style={{ padding: 20 }}>

                    {/* Step 1: 카테고리 선택 */}
                    {step === 'select' && (
                        <>
                            <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 16, lineHeight: 1.6 }}>
                                네이버 쇼핑 카테고리를 <span style={{ color: T.orange, fontWeight: 700 }}>최대 3개</span> 선택하세요.
                                선택한 카테고리의 인기 키워드 TOP10을 바로 받아볼 수 있습니다.
                            </p>

                            {categories.length === 0 ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                                    <Loader size={20} style={{ color: T.inkMute, animation: 'spin 1s linear infinite' }} />
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                    {categories.map(cat => {
                                        const isSel = !!selected.find(c => c.code === cat.code);
                                        return (
                                            <button key={cat.code} onClick={() => toggleCategory(cat)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '10px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                                                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                                                    background: isSel ? T.orangeSoft : T.card,
                                                    border: isSel ? `1.5px solid ${T.orange}` : `1px solid ${T.border}`,
                                                    color: isSel ? T.orange : T.inkSoft,
                                                    boxShadow: isSel ? `0 2px 8px ${T.orange}25` : '0 1px 3px rgba(45,37,32,0.06)',
                                                }}
                                                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.borderColor = T.orangeBorder; }}
                                                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
                                            >
                                                <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                                                <span style={{ flex: 1 }}>{cat.name}</span>
                                                {isSel && <CheckCircle size={13} style={{ color: T.orange, flexShrink: 0 }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selected.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                    {selected.map(cat => (
                                        <span key={cat.code} style={{ fontSize: 11, background: T.orangeSoft, color: T.orange, border: `1px solid ${T.orangeBorder}`, padding: '2px 10px', borderRadius: 999, fontWeight: 600 }}>
                                            {cat.emoji} {cat.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {error && <p style={{ fontSize: 11, color: '#dc2626', marginBottom: 10 }}>{error}</p>}

                            <button onClick={handleNext} disabled={selected.length === 0}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 12, background: selected.length === 0 ? T.border : T.orange, border: 'none', color: selected.length === 0 ? T.inkMute : '#fff', fontSize: 13, fontWeight: 700, cursor: selected.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                                다음 <ChevronRight size={15} />
                            </button>
                        </>
                    )}

                    {/* Step 2: 발송 설정 */}
                    {step === 'delivery' && (
                        <>
                            <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14 }}>결과를 받을 방법을 선택하세요.</p>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                {([{ value: 'email', label: '이메일', icon: Mail }, { value: 'sms', label: '문자', icon: MessageSquare }] as const).map(opt => {
                                    const isActive = deliveryMethod === opt.value;
                                    return (
                                        <button key={opt.value} onClick={() => setDeliveryMethod(opt.value)}
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? T.orangeSoft : T.surface, border: isActive ? `1.5px solid ${T.orange}` : `1px solid ${T.border}`, color: isActive ? T.orange : T.inkSoft }}>
                                            <opt.icon size={13} /> {opt.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 11, color: T.inkMute, display: 'block', marginBottom: 4 }}>이메일 주소</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com"
                                        style={{ width: '100%', background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 12, color: T.ink, outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = T.orange}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = T.border}
                                    />
                                </div>
                            )}

                            {(deliveryMethod === 'sms' || deliveryMethod === 'both') && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 11, color: T.inkMute, display: 'block', marginBottom: 4 }}>전화번호</label>
                                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01012345678"
                                        style={{ width: '100%', background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 12, color: T.ink, outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = T.orange}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = T.border}
                                    />
                                </div>
                            )}

                            {error && <p style={{ fontSize: 11, color: '#dc2626', marginBottom: 10 }}>{error}</p>}

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { setStep('select'); setError(''); }}
                                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                    이전
                                </button>
                                <button onClick={handleSend}
                                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: T.orange, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                    지금 받기
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 3: 발송 중 */}
                    {step === 'sending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 14 }}>
                            <Loader size={30} style={{ color: T.orange, animation: 'spin 1s linear infinite' }} />
                            <p style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>키워드 분석 중입니다...</p>
                            <p style={{ fontSize: 11, color: T.inkMute }}>네이버 데이터랩에서 데이터를 수집하고 있습니다.</p>
                        </div>
                    )}

                    {/* Step 4: 완료 */}
                    {step === 'done' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
                                <CheckCircle size={22} style={{ color: '#16a34a', flexShrink: 0 }} />
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>발송 완료!</p>
                                    <p style={{ fontSize: 11, color: T.inkMute, margin: '2px 0 0' }}>
                                        {deliveryMethod === 'email' && `${email}로 이메일 발송`}
                                        {deliveryMethod === 'sms' && `${phone}으로 문자 발송`}
                                        {deliveryMethod === 'both' && `이메일 + 문자 발송`}
                                    </p>
                                </div>
                            </div>

                            {resultContent && (
                                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, maxHeight: 280, overflowY: 'auto' }}>
                                    <p style={{ fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>발송된 내용</p>
                                    <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.7 }}
                                        className="[&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-[#D46A1A] [&_h2]:mb-2 [&_h2]:mt-0
                                        [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-[#2D2520] [&_h3]:mb-1.5 [&_h3]:mt-3
                                        [&_table]:w-full [&_table]:text-[11px] [&_table]:border-collapse
                                        [&_th]:text-[#A0948A] [&_th]:font-medium [&_th]:pb-1 [&_th]:border-b [&_th]:border-[#E8DDD0] [&_th]:px-1.5
                                        [&_td]:py-1 [&_td]:px-1.5 [&_td]:text-[#6B5F56] [&_td]:border-b [&_td]:border-[#EDE5D8]
                                        [&_tr:last-child_td]:border-0 [&_hr]:border-[#E8DDD0] [&_hr]:my-2
                                        [&_p]:text-[#6B5F56] [&_p]:text-[11px] [&_em]:text-[#A0948A] [&_em]:text-[10px]">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultContent}</ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            <button onClick={onClose}
                                style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                닫기
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
