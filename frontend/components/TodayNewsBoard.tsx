import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Newspaper, Volume2, VolumeX, Loader, RefreshCw } from 'lucide-react';

interface Props {
    onClose: () => void;
}

interface CategoryItem {
    key: string;
    label: string;
    emoji: string;
    accent: string;
}

interface NewsData {
    date: string;
    category: string;
    label: string;
    report: string;
    sources_count: number;
    collected_at: string;
}

interface NewsItem {
    title: string;
    content: string;
    sources: string[];
}

const CATEGORIES: CategoryItem[] = [
    { key: '국내뉴스', label: '국내',   emoji: '🇰🇷', accent: '#5C7BA8' },
    { key: '해외뉴스', label: '해외',   emoji: '🌍', accent: '#5E9070' },
    { key: '경제증시', label: '경제',   emoji: '📈', accent: '#A07828' },
    { key: 'AI기술',   label: 'AI/기술', emoji: '🤖', accent: '#7A5FA0' },
    { key: '부동산',   label: '부동산', emoji: '🏢', accent: '#C68760' },
    { key: '스포츠',   label: '스포츠', emoji: '⚽', accent: '#5E7E86' },
];

function parseNewsItems(report: string): { intro: string; items: NewsItem[] } {
    const lines = report.split('\n');
    let intro = '';
    const items: NewsItem[] = [];
    let current: NewsItem | null = null;
    let foundFirstH3 = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
            foundFirstH3 = true;
            if (current) items.push(current);
            current = { title: trimmed.replace(/^###\s*/, ''), content: '', sources: [] };
        } else if (!foundFirstH3) {
            if (trimmed) intro += (intro ? ' ' : '') + trimmed;
        } else if (current) {
            const srcMatch = trimmed.match(/^-\s*\*\*출처\*\*[:\s]*(.+)$/);
            const contentMatch = trimmed.match(/^-\s*\*\*핵심\s*내용\*\*[:\s]*(.+)$/);
            if (srcMatch) {
                current.sources = srcMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean);
            } else if (contentMatch) {
                current.content = contentMatch[1].trim();
            } else if (trimmed.startsWith('- ')) {
                const plain = trimmed.replace(/^-\s*/, '').replace(/\*\*/g, '');
                if (!current.content) current.content = plain;
            }
        }
    }
    if (current) items.push(current);
    return { intro, items };
}

function useTTS() {
    const [speaking, setSpeaking] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stop = useCallback(() => {
        audioRef.current?.pause();
        setSpeaking(false);
        setTtsLoading(false);
    }, []);

    const speakCategory = useCallback(async (category: string, slot?: 'am' | 'pm') => {
        stop();
        setTtsLoading(true);
        try {
            const slotQs = slot ? `&slot=${slot}` : '';
            const res = await fetch(`/api/news/tts?category=${encodeURIComponent(category)}${slotQs}`, {
                credentials: 'include',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) throw new Error('캐시 없음');
            const url = URL.createObjectURL(await res.blob());
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
            audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
            setTtsLoading(false);
            setSpeaking(true);
            await audio.play();
        } catch {
            setTtsLoading(false);
            setSpeaking(false);
        }
    }, [stop]);

    useEffect(() => () => { audioRef.current?.pause(); }, []);
    return { speaking, ttsLoading, speakCategory, stop };
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleString('ko-KR', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch { return ''; }
}

function formatDate(dateStr: string) {
    try {
        const d = new Date(dateStr);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch { return dateStr; }
}

// 크림 테마 팔레트
const T = {
    bg:       '#FBF8F3',
    surface:  '#F5F0E8',
    border:   '#E8DDD0',
    borderSoft: '#EDE5D8',
    ink:      '#2D2520',
    inkSoft:  '#6B5F56',
    inkMute:  '#A0948A',
    gold:     '#C9A84C',
};

export const TodayNewsBoard: React.FC<Props> = ({ onClose }) => {
    const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);
    // 오전(am)/오후(pm) 슬롯 — 기본은 현재 시각 기준(12시 전=am). 가용 슬롯은 status로 확인.
    const [slot, setSlot] = useState<'am' | 'pm'>(new Date().getHours() < 12 ? 'am' : 'pm');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    // 캐시 키를 'slot:category'로 → 오전/오후 따로 캐시(중복 호출·중복 과금 방지)
    const [newsMap, setNewsMap] = useState<Record<string, NewsData | null>>({});
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [collectedAt, setCollectedAt] = useState<string | null>(null);
    const { speaking, ttsLoading, speakCategory, stop } = useTTS();

    // mount 시 가용 슬롯 조회 → 둘 다 있으면 토글 노출, 하나뿐이면 그 슬롯으로
    useEffect(() => {
        fetch('/api/news/status', { credentials: 'include', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(r => r.json())
            .then((d: any) => {
                const slots: string[] = Array.isArray(d?.slots) ? d.slots : [];
                setAvailableSlots(slots);
                // 현재 선택 슬롯이 없으면 가용한 것으로 보정
                if (slots.length && !slots.includes(slot)) setSlot(slots[slots.length - 1] as 'am' | 'pm');
            })
            .catch(() => {});
    }, []);

    const fetchCategory = useCallback(async (key: string, s: 'am' | 'pm') => {
        const cacheKey = `${s}:${key}`;
        if (newsMap[cacheKey] !== undefined) return;
        setLoadingKey(cacheKey);
        setError(null);
        try {
            const res = await fetch(`/api/news/today?category=${encodeURIComponent(key)}&slot=${s}`, {
                credentials: 'include',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({})) as any;
                throw new Error(d.error || `오류 ${res.status}`);
            }
            const data: NewsData = await res.json();
            setNewsMap(prev => ({ ...prev, [cacheKey]: data }));
            setCollectedAt(data.collected_at);
        } catch (e: any) {
            setNewsMap(prev => ({ ...prev, [cacheKey]: null }));
            setError(e.message);
        } finally {
            setLoadingKey(null);
        }
    }, [newsMap]);

    useEffect(() => { fetchCategory(activeKey, slot); }, [activeKey, slot]);

    const handleTab = (key: string) => {
        if (key !== activeKey) stop();
        setActiveKey(key);
        fetchCategory(key, slot);
    };

    const handleSlot = (s: 'am' | 'pm') => {
        if (s !== slot) { stop(); setSlot(s); }
    };

    const cacheKey = `${slot}:${activeKey}`;
    const current = newsMap[cacheKey];
    const isLoading = loadingKey === cacheKey;
    const activeCat = CATEGORIES.find(c => c.key === activeKey)!;
    const parsed = current ? parseNewsItems(current.report) : null;

    return (
        <div className="news-modal-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: 72, paddingBottom: 16, paddingLeft: 16, paddingRight: 16,
            background: 'rgba(45,37,32,0.55)',
            backdropFilter: 'blur(6px)',
        }}>
            <div style={{
                position: 'relative',
                width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 88px)',
                display: 'flex', flexDirection: 'column',
                borderRadius: 20,
                background: T.bg,
                border: `1px solid ${T.border}`,
                boxShadow: '0 24px 60px -12px rgba(45,37,32,0.25)',
                overflow: 'hidden',
                fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif",
            }}>

                {/* 헤더 */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: `1px solid ${T.border}`,
                    background: T.surface,
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Newspaper size={16} style={{ color: activeCat.accent }} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>오늘뉴스</span>
                        </div>
                        {collectedAt && (
                            <span style={{ fontSize: 10, color: T.inkMute, marginLeft: 24 }}>
                                수집 {formatTime(collectedAt)}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {current && (
                            <button
                                onClick={() => speaking ? stop() : speakCategory(activeKey, slot)}
                                disabled={ttsLoading}
                                onMouseEnter={(e) => {
                                    if (ttsLoading) return;
                                    e.currentTarget.style.filter = 'brightness(0.92)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.filter = 'none';
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    fontSize: 12, padding: '8px 16px',
                                    minHeight: 40, minWidth: 80,
                                    borderRadius: 999,
                                    border: speaking
                                        ? '1px solid #8E6FB7'
                                        : '1px solid #D1D5DB',
                                    background: speaking ? '#8E6FB7' : '#E5E7EB',
                                    color: speaking ? '#FFFFFF' : '#6B7280',
                                    cursor: ttsLoading ? 'not-allowed' : 'pointer',
                                    opacity: ttsLoading ? 0.5 : 1,
                                    fontWeight: 700,
                                    boxShadow: speaking
                                        ? '0 2px 10px rgba(142, 111, 183, 0.45)'
                                        : 'none',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {ttsLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                {ttsLoading ? '준비중' : speaking ? '중지' : '음성'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                padding: 6, borderRadius: 8,
                                border: 'none', background: 'transparent',
                                color: T.inkMute, cursor: 'pointer',
                                display: 'flex', alignItems: 'center',
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* 오전/오후 슬롯 토글 — 둘 다 수집됐을 때만 노출 */}
                {availableSlots.length > 1 && (
                    <div style={{
                        display: 'flex', gap: 6, padding: '10px 16px 0',
                        background: T.bg, flexShrink: 0,
                    }}>
                        {([['am', '🌅 오전'], ['pm', '🌇 오후']] as const).map(([s, label]) => {
                            const on = slot === s;
                            const has = availableSlots.includes(s);
                            return (
                                <button
                                    key={s}
                                    onClick={() => has && handleSlot(s)}
                                    disabled={!has}
                                    onMouseEnter={(e) => {
                                        if (!has || on) return;
                                        e.currentTarget.style.filter = 'brightness(0.96)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.filter = 'none';
                                    }}
                                    style={{
                                        flex: 1, padding: '8px 12px', borderRadius: 999,
                                        fontSize: 12, fontWeight: 700,
                                        border: on
                                            ? '1px solid #8E6FB7'
                                            : `1px solid ${T.borderSoft}`,
                                        background: on ? '#8E6FB7' : '#E5E7EB',
                                        color: on ? '#FFFFFF' : (has ? '#6B7280' : T.inkMute),
                                        cursor: has ? 'pointer' : 'not-allowed',
                                        opacity: has ? 1 : 0.4,
                                        boxShadow: on
                                            ? '0 2px 10px rgba(142, 111, 183, 0.45)'
                                            : 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 카테고리 탭 */}
                <div style={{
                    display: 'flex', gap: 6, padding: '10px 16px',
                    borderBottom: `1px solid ${T.borderSoft}`,
                    background: T.bg,
                    overflowX: 'auto', flexShrink: 0,
                }}>
                    {CATEGORIES.map(cat => {
                        const isActive = activeKey === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => handleTab(cat.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 11, fontWeight: 600,
                                    padding: '5px 12px', borderRadius: 999,
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    border: isActive ? `1.5px solid ${cat.accent}` : `1px solid ${T.border}`,
                                    background: isActive ? cat.accent : T.surface,
                                    color: isActive ? '#fff' : T.inkSoft,
                                    boxShadow: isActive ? `0 2px 8px ${cat.accent}40` : 'none',
                                }}
                            >
                                <span>{cat.emoji}</span>
                                <span>{cat.label}</span>
                                {newsMap[cat.key] !== undefined && newsMap[cat.key] !== null && !isActive && (
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.accent, display: 'inline-block' }} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 컨텐츠 */}
                <div style={{ flex: 1, overflowY: 'auto' }}>

                    {/* 로딩 */}
                    {isLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 0' }}>
                            <div style={{ position: 'relative', width: 44, height: 44 }}>
                                <div style={{
                                    position: 'absolute', inset: 0, borderRadius: '50%',
                                    border: `2px solid ${activeCat.accent}30`,
                                    borderTopColor: activeCat.accent,
                                    animation: 'spin 0.9s linear infinite',
                                }} />
                                <Newspaper size={16} style={{ position: 'absolute', inset: 0, margin: 'auto', color: activeCat.accent }} />
                            </div>
                            <p style={{ fontSize: 13, color: T.inkSoft }}>뉴스를 불러오는 중...</p>
                        </div>
                    )}

                    {/* 에러 */}
                    {!isLoading && error && newsMap[activeKey] === null && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 16px', textAlign: 'center' }}>
                            <span style={{ fontSize: 36 }}>⚠️</span>
                            <p style={{ fontSize: 13, color: '#C0392B' }}>{error}</p>
                            <button
                                onClick={() => {
                                    setNewsMap(prev => { const n = { ...prev }; delete n[activeKey]; return n; });
                                    fetchCategory(activeKey);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 10,
                                    border: `1px solid ${T.border}`,
                                    background: T.surface, color: T.inkSoft,
                                    fontSize: 13, cursor: 'pointer',
                                }}
                            >
                                <RefreshCw size={13} /> 다시 시도
                            </button>
                        </div>
                    )}

                    {/* 뉴스 목록 */}
                    {!isLoading && parsed && (
                        <div style={{ padding: 16 }}>

                            {/* 날짜 + 출처 수 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '4px 10px', borderRadius: 8,
                                    background: `${activeCat.accent}15`,
                                    border: `1px solid ${activeCat.accent}30`,
                                }}>
                                    <span style={{ fontSize: 14 }}>{activeCat.emoji}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: activeCat.accent }}>{activeCat.label}</span>
                                </div>
                                {current && (
                                    <span style={{ fontSize: 11, color: T.inkMute }}>{formatDate(current.date)} 뉴스</span>
                                )}
                                {current && (
                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: T.inkMute }}>출처 {current.sources_count}개</span>
                                )}
                            </div>

                            {/* 인트로 */}
                            {parsed.intro && (
                                <div style={{
                                    marginBottom: 12, padding: '10px 14px',
                                    borderRadius: 10,
                                    background: `${activeCat.accent}08`,
                                    borderLeft: `3px solid ${activeCat.accent}60`,
                                }}>
                                    <p style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.7 }}>{parsed.intro}</p>
                                </div>
                            )}

                            {/* 뉴스 카드 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {parsed.items.map((item, idx) => (
                                    <NewsCard key={idx} item={item} index={idx} accent={activeCat.accent} />
                                ))}
                            </div>

                            {parsed.items.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: T.inkMute }}>
                                    뉴스 항목을 불러올 수 없습니다.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

const NewsCard: React.FC<{ item: NewsItem; index: number; accent: string }> = ({ item, index, accent }) => {
    return (
        <div style={{
            borderRadius: 12,
            border: `1px solid ${T.borderSoft}`,
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(45,37,32,0.06)',
            transition: 'box-shadow 0.2s',
        }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(45,37,32,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(45,37,32,0.06)'}
        >
            {/* 제목 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
                <span style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                    background: accent, color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 1,
                }}>
                    {index + 1}
                </span>
                <p style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.5, margin: 0 }}>
                    {item.title}
                </p>
            </div>

            {/* 핵심 + 출처 */}
            {(item.content || item.sources.length > 0) && (
                <div style={{
                    padding: '10px 14px', paddingTop: 0,
                    borderTop: `1px solid ${T.borderSoft}`,
                }}>
                    {item.content && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingTop: 10, marginBottom: 8 }}>
                            <span style={{
                                flexShrink: 0, fontSize: 10, fontWeight: 700,
                                color: accent, background: `${accent}18`,
                                padding: '2px 6px', borderRadius: 4, marginTop: 1,
                            }}>
                                핵심
                            </span>
                            <p style={{ flex: 1, fontSize: 12, color: T.inkSoft, lineHeight: 1.65, margin: 0 }}>
                                {item.content}
                            </p>
                        </div>
                    )}

                    {item.sources.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                            <span style={{ fontSize: 10, color: T.inkMute }}>출처</span>
                            {item.sources.map((src, i) => (
                                <span key={i} style={{
                                    fontSize: 10, padding: '2px 8px', borderRadius: 999,
                                    background: T.surface,
                                    border: `1px solid ${T.border}`,
                                    color: T.inkSoft,
                                    fontFamily: 'monospace',
                                }}>
                                    {src}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
