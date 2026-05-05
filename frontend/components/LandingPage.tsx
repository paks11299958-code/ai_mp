import React, { useState, useEffect, useRef } from 'react';
import { Bot, Menu, X, Bell, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Persona, Category } from '../types';
import { Icon } from './Icons';
import { Theme, ThemeConfig, THEMES } from './themes';

interface LandingPageProps {
    personas: Persona[];
    isLoading: boolean;
    onStart: () => void;
    onPersonaClick?: (personaId: string) => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    heroImageUrl?: string;
    categories?: Category[];
}

const ZigzagCards: React.FC<{ personas: Persona[]; accent: string; accentLight: string }> = ({ personas, accent, accentLight }) => {
    const cards = personas.slice(0, 6);
    const W = 148, H = 218;
    const configs = [
        { x: -220, y: 25,  rotate: -14, z: 1, scale: 0.80, delay: '0s' },
        { x: -130, y: -25, rotate: -7,  z: 2, scale: 0.88, delay: '0.35s' },
        { x: -38,  y: 28,  rotate: -1,  z: 3, scale: 0.95, delay: '0.7s' },
        { x:  62,  y: -22, rotate:  6,  z: 5, scale: 1.00, delay: '1.05s' },
        { x: 160,  y: 18,  rotate: 12,  z: 4, scale: 0.90, delay: '1.4s' },
        { x: 248,  y: -18, rotate: 17,  z: 2, scale: 0.82, delay: '1.75s' },
    ];

    return (
        <div className="hidden lg:flex justify-center items-center" style={{ height: '410px' }}>
            <div className="relative" style={{ width: '640px', height: '410px' }}>
                {cards.map((persona, i) => {
                    const cfg = configs[i];
                    const isNew = persona.createdAt
                        ? Date.now() - new Date(persona.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                        : false;
                    return (
                        <div
                            key={persona.id}
                            className="absolute"
                            style={{
                                width: W, height: H,
                                left: '50%', top: '50%',
                                marginLeft: -W / 2 + cfg.x,
                                marginTop: -H / 2 + cfg.y,
                                transform: `rotate(${cfg.rotate}deg) scale(${cfg.scale})`,
                                zIndex: cfg.z,
                            }}
                        >
                            <div
                                className="w-full h-full rounded-2xl overflow-hidden"
                                style={{
                                    animation: `card-float 2.8s ease-in-out ${cfg.delay} infinite`,
                                    border: isNew ? '1.5px solid rgba(251,191,36,0.7)' : '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: isNew
                                        ? '0 0 18px rgba(251,191,36,0.25), 0 8px 32px rgba(0,0,0,0.6)'
                                        : '0 8px 32px rgba(0,0,0,0.6)',
                                }}
                            >
                                {persona.imageUrl ? (
                                    <img src={persona.imageUrl} alt={persona.name} className="w-full h-full object-cover object-top" />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${persona.colorClass} flex items-center justify-center`}>
                                        <Icon name={persona.iconName} size={40} className="text-white/80" />
                                    </div>
                                )}
                                {isNew && (
                                    <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                                        style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)', color: '#000' }}>
                                        NEW
                                    </span>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                                    <p className="text-white font-bold text-sm">{persona.name}</p>
                                    {persona.jobTitle && <p className="text-xs" style={{ color: accentLight }}>{persona.jobTitle}</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="absolute rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ width: '260px', height: '260px', backgroundColor: accent, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 0 }} />
            </div>
        </div>
    );
};

export const LandingPage: React.FC<LandingPageProps> = ({
    personas, isLoading, onStart, onPersonaClick, onAnnouncementClick, unreadAnnouncementCount = 0,
    theme, onThemeChange, heroImageUrl, categories = [],
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [visibleCount, setVisibleCount] = useState(3);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const dragDistRef = useRef(0);
    const t = THEMES[theme];

    const onDragStart = (clientX: number) => {
        dragDistRef.current = 0;
        setIsDragging(true);
        setDragStartX(clientX);
        setDragOffset(0);
    };
    const onDragMove = (clientX: number) => {
        if (!isDragging) return;
        const offset = clientX - dragStartX;
        dragDistRef.current = Math.abs(offset);
        setDragOffset(offset);
    };
    const onDragEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (dragOffset < -60) setCarouselIndex(i => Math.min(maxIndex, i + 1));
        else if (dragOffset > 60) setCarouselIndex(i => Math.max(0, i - 1));
        setDragOffset(0);
    };

    useEffect(() => {
        const update = () => {
            if (window.innerWidth < 640) setVisibleCount(1);
            else if (window.innerWidth < 1024) setVisibleCount(2);
            else setVisibleCount(3);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    useEffect(() => { setCarouselIndex(0); }, [visibleCount]);

    const sorted = personas
        .filter(p => p.isVisible !== false)
        .filter(p => selectedCategoryId === null || p.categoryId === selectedCategoryId)
        .filter(p => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.jobTitle?.toLowerCase().includes(q);
        })
        .slice()
        .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
        });

    const handleCategorySelect = (id: number | null) => {
        setSelectedCategoryId(id);
        setCarouselIndex(0);
    };

    const maxIndex = Math.max(0, sorted.length - visibleCount);
    const prev = () => setCarouselIndex(i => Math.max(0, i - 1));
    const next = () => setCarouselIndex(i => Math.min(maxIndex, i + 1));

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100" onClick={() => themeOpen && setThemeOpen(false)}>

            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/aichat_log2.png" alt="logo" className="h-[60px] w-auto" />
                        <span className="text-sm font-bold whitespace-nowrap">
                            <span style={{ color: t.accentLight }}>AI 페르소나</span>
                            <span className="text-gray-100">Chat</span>
                        </span>
                    </a>

                    <div className="hidden sm:flex items-center gap-3">
                        {/* 테마 스위처 */}
                        <div className="relative" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setThemeOpen(v => !v)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-700 hover:border-gray-500 bg-gray-900 transition-all text-sm text-gray-300"
                            >
                                <div className="flex gap-1">
                                    {t.swatches.map((c, i) => (
                                        <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                                <span>{t.name}</span>
                                <ChevronRight size={12} className="text-gray-500" />
                            </button>
                            {themeOpen && (
                                <div className="absolute right-0 top-11 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-2 z-50">
                                    {(Object.entries(THEMES) as [Theme, ThemeConfig][]).map(([key, cfg]) => (
                                        <button
                                            key={key}
                                            onClick={() => { onThemeChange(key); setThemeOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${theme === key ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
                                        >
                                            <div className="flex gap-1">
                                                {cfg.swatches.map((c, i) => (
                                                    <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
                                                ))}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-gray-100">{cfg.name}</div>
                                                <div className="text-xs text-gray-500">{cfg.desc}</div>
                                            </div>
                                            {theme === key && <span className="ml-auto text-xs" style={{ color: t.accentLight }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {onAnnouncementClick && (
                            <button onClick={onAnnouncementClick} className="relative p-2 text-gray-400 hover:text-white transition-colors">
                                <Bell size={18} />
                                {unreadAnnouncementCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                                        {unreadAnnouncementCount > 9 ? '9+' : unreadAnnouncementCount}
                                    </span>
                                )}
                            </button>
                        )}
                        <button onClick={onStart} className="text-gray-400 hover:text-white text-sm font-medium transition-colors">로그인</button>
                        <button onClick={onStart} className="text-white text-sm font-semibold px-4 py-2 rounded-full transition-all hover:opacity-90" style={{ backgroundColor: t.accent }}>
                            무료 시작
                        </button>
                    </div>

                    <button className="sm:hidden text-gray-400 hover:text-white p-2" onClick={() => setMenuOpen(v => !v)}>
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {menuOpen && (
                    <div className="sm:hidden border-t border-gray-800 bg-gray-950 px-4 py-3 flex flex-col gap-2">
                        <button onClick={() => { setMenuOpen(false); onStart(); }} className="w-full text-left text-gray-300 hover:text-white py-2 px-3 rounded-lg hover:bg-gray-800 text-sm">로그인</button>
                        <button onClick={() => { setMenuOpen(false); onStart(); }} className="w-full text-white text-sm font-semibold py-2 px-3 rounded-lg" style={{ backgroundColor: t.accent }}>무료 시작</button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 px-4 overflow-hidden" style={{ background: t.heroGradient }}>
                <div className="absolute top-16 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: t.accent }} />
                <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ backgroundColor: t.accentLight }} />

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="grid lg:grid-cols-[5fr_7fr] gap-0 items-center">
                        <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: t.accentLight }}>DIALOGUE WITH AI</p>
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5 leading-tight">
                                어떤 AI와<br />
                                <span style={{ color: t.accentLight }}>대화할까요?</span>
                            </h1>
                            <p className="text-gray-400 text-base mb-7 leading-relaxed">
                                AI와 나누는 특별한 대화,<br />
                                당신만을 위한 페르소나와 시작하세요.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={onStart} className="text-white font-semibold px-6 py-3 rounded-full transition-all hover:opacity-90 hover:scale-105" style={{ backgroundColor: t.accent }}>
                                    지금 AI와 대화하기 →
                                </button>
                                <button
                                    onClick={() => document.getElementById('carousel')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-gray-300 font-semibold px-6 py-3 rounded-full border border-gray-600 hover:border-gray-400 transition-all"
                                >
                                    AI들 만나보기
                                </button>
                            </div>
                        </div>

                        {/* 히어로 이미지 */}
                        {heroImageUrl && (
                            <div className="flex justify-center items-center mt-6 lg:mt-0">
                                <img
                                    src={heroImageUrl}
                                    alt="hero"
                                    className="w-full max-w-xl object-contain drop-shadow-2xl"
                                    style={{ maxHeight: '420px', mixBlendMode: 'multiply' }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Carousel Section */}
            <section id="carousel" className="py-16 px-4 bg-gray-950">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-end justify-between mb-5">
                        <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: t.accentLight }}>AI PERSONAS</p>
                            <h2 className="text-2xl font-extrabold text-white">각 AI들을 선택하고 대화를 시작하세요.</h2>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={prev} disabled={carouselIndex === 0} className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-all">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={next} disabled={carouselIndex >= maxIndex} className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-all">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* 카테고리 필터 탭 + 검색창 */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="flex gap-2 flex-wrap flex-1">
                            <button
                                onClick={() => handleCategorySelect(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                                style={selectedCategoryId === null
                                    ? { backgroundColor: t.accent, color: '#fff' }
                                    : { backgroundColor: '#1f2937', color: '#9ca3af' }
                                }
                            >
                                전체
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                    {personas.filter(p => p.isVisible !== false).length}
                                </span>
                            </button>
                            {categories.map(cat => {
                                const count = personas.filter(p => p.isVisible !== false && p.categoryId === cat.id).length;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategorySelect(cat.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                                        style={selectedCategoryId === cat.id
                                            ? { backgroundColor: t.accent, color: '#fff' }
                                            : { backgroundColor: '#1f2937', color: '#9ca3af' }
                                        }
                                    >
                                        {cat.name}
                                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative flex-shrink-0">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCarouselIndex(0); }}
                                placeholder="AI 검색..."
                                className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center py-20 gap-4">
                            <Bot size={48} className="animate-bounce" style={{ color: t.accent }} />
                            <p className="text-gray-400 text-sm">AI 페르소나를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        <div
                            className="overflow-hidden select-none"
                            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                            onMouseDown={e => onDragStart(e.clientX)}
                            onMouseMove={e => onDragMove(e.clientX)}
                            onMouseUp={onDragEnd}
                            onMouseLeave={onDragEnd}
                            onTouchStart={e => onDragStart(e.touches[0].clientX)}
                            onTouchMove={e => onDragMove(e.touches[0].clientX)}
                            onTouchEnd={onDragEnd}
                        >
                            <div
                                className="flex gap-4"
                                style={{
                                    transform: `translateX(calc(-${carouselIndex} * (100% / ${visibleCount} + 5.33px) + ${dragOffset}px))`,
                                    transition: isDragging ? 'none' : 'transform 500ms ease-in-out',
                                }}
                            >
                                {sorted.map((persona) => {
                                    const isNew = persona.createdAt
                                        ? Date.now() - new Date(persona.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                                        : false;
                                    return (
                                        <button
                                            key={persona.id}
                                            onClick={() => { if (dragDistRef.current > 5) return; onPersonaClick ? onPersonaClick(persona.id) : onStart(); }}
                                            className="relative flex-shrink-0 bg-gray-900 rounded-2xl text-left hover:scale-[1.02] transition-all group overflow-hidden"
                                            style={{
                                                width: `calc(${100 / visibleCount}% - ${16 * (visibleCount - 1) / visibleCount}px)`,
                                                border: isNew ? '1.5px solid rgba(251,191,36,0.6)' : '1px solid #1f2937',
                                                boxShadow: isNew ? '0 0 16px rgba(251,191,36,0.2)' : undefined,
                                            }}
                                        >
                                            <div className="relative h-64 overflow-hidden">
                                                {persona.imageUrl ? (
                                                    <img src={persona.imageUrl} alt={persona.name} draggable={false} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className={`w-full h-full bg-gradient-to-br ${persona.colorClass} flex items-center justify-center`}>
                                                        <Icon name={persona.iconName} size={64} className="text-white/80" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                                                {isNew && (
                                                    <span className="absolute top-3 right-3 text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse"
                                                        style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316)', color: '#000' }}>
                                                        NEW
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-4">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <h3 className="text-base font-bold text-gray-100 group-hover:text-white">{persona.name}</h3>
                                                    {persona.jobTitle && <span className="text-xs text-gray-500">[{persona.jobTitle}]</span>}
                                                </div>
                                                <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{persona.description}</p>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: t.accent }} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {maxIndex > 0 && (
                        <div className="flex justify-center gap-1.5 mt-6">
                            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCarouselIndex(i)}
                                    className="h-1.5 rounded-full transition-all duration-300"
                                    style={{ backgroundColor: i === carouselIndex ? t.accent : '#374151', width: i === carouselIndex ? '20px' : '6px' }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
