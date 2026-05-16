import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Settings, Menu, X, Megaphone, ChevronLeft, ChevronRight, Search, UserCircle } from 'lucide-react';
import { Persona, User, Category } from '../types';
import { Icon } from './Icons';
import { Theme, THEMES } from './themes';

interface MainPageProps {
    personas: Persona[];
    isLoading: boolean;
    user: User;
    onSelectPersona: (personaId: string) => void;
    onLogout: () => void;
    onAdminClick: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onPartnerBoardClick?: () => void;
    onProfileClick?: () => void;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    heroImageUrl?: string;
    categories?: Category[];
}

const ZigzagCards: React.FC<{ personas: Persona[]; accent: string; accentLight: string; onSelect: (id: string) => void }> = ({ personas, accent, accentLight, onSelect }) => {
    const cards = personas.slice(0, 3);
    const W = 160, H = 240;
    const configs = [
        { x: -185, y: -45, rotate: -6, z: 1, delay: '0s' },
        { x:    0, y:  45, rotate:  3, z: 3, delay: '0.5s' },
        { x:  185, y: -45, rotate: -4, z: 2, delay: '1s' },
    ];

    return (
        <div className="hidden lg:flex justify-center items-center" style={{ height: '380px' }}>
            <div className="relative" style={{ width: '560px', height: '380px' }}>
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
                                transform: `rotate(${cfg.rotate}deg)`,
                                zIndex: cfg.z,
                            }}
                        >
                            <div
                                className="w-full h-full hover:scale-105 transition-transform cursor-pointer"
                                style={{ animation: `card-float 2.8s ease-in-out ${cfg.delay} infinite` }}
                                onClick={() => onSelect(persona.id)}
                            >
                            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl"
                                style={{
                                    border: isNew ? '1.5px solid rgba(251,191,36,0.7)' : '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: isNew ? '0 0 18px rgba(251,191,36,0.25), 0 8px 32px rgba(0,0,0,0.5)' : undefined,
                                }}>
                                {persona.imageUrl ? (
                                    <img src={persona.imageUrl} alt={persona.name} className="w-full h-full object-cover object-top" />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${persona.colorClass} flex items-center justify-center`}>
                                        <Icon name={persona.iconName} size={64} className="text-white/80" />
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
                        </div>
                    );
                })}
                <div className="absolute rounded-full blur-3xl opacity-25 pointer-events-none"
                    style={{ width: '200px', height: '200px', backgroundColor: accent, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 0 }} />
            </div>
        </div>
    );
};

export const MainPage: React.FC<MainPageProps> = ({
    personas, isLoading, user, onSelectPersona, onLogout, onAdminClick,
    onAnnouncementClick, unreadAnnouncementCount = 0, onPartnerBoardClick, onProfileClick, theme, onThemeChange, heroImageUrl, categories = [],
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="min-h-screen bg-gray-950 text-gray-100">

            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <img src="/aichat_log2.png" alt="logo" className="h-[60px] w-auto" />
                            <span className="text-sm font-bold whitespace-nowrap">
                                <span style={{ color: t.accentLight }}>AI 페르소나</span>
                                <span className="text-gray-100">Chat</span>
                            </span>
                        </a>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">

                        <span className="text-sm text-gray-400">{user.username || user.email}</span>
                        {onAnnouncementClick && (
                            <button onClick={onAnnouncementClick} className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                                <Megaphone size={16} className="text-yellow-400" />
                                <span className="text-sm font-medium text-yellow-400">공지</span>
                                {unreadAnnouncementCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                                        {unreadAnnouncementCount > 9 ? '9+' : unreadAnnouncementCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {onPartnerBoardClick && (
                            <button onClick={onPartnerBoardClick} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                                <Icon name="Handshake" size={15} />제휴
                            </button>
                        )}
                        {user.role === 'ADMIN' && (
                            <button onClick={onAdminClick} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                                <Settings size={16} />관리
                            </button>
                        )}
                        {onProfileClick && (
                            <button onClick={onProfileClick} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                                <UserCircle size={16} />내정보
                            </button>
                        )}
                        <button onClick={onLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                            <LogOut size={16} />로그아웃
                        </button>
                    </div>

                    <button className="sm:hidden text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors" onClick={() => setMenuOpen(v => !v)}>
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {menuOpen && (
                    <div className="sm:hidden border-t border-gray-800 bg-gray-950 px-4 py-3 flex flex-col gap-1">
                        <div className="text-xs text-gray-500 px-3 py-1">{user.username || user.email}</div>
                        {onProfileClick && (
                            <button onClick={() => { setMenuOpen(false); onProfileClick(); }} className="flex items-center gap-2 text-gray-300 hover:text-white py-2 px-3 rounded-lg hover:bg-gray-800 transition-colors text-sm">
                                <UserCircle size={16} />내정보
                            </button>
                        )}
                        {user.role === 'ADMIN' && (
                            <button onClick={() => { setMenuOpen(false); onAdminClick(); }} className="flex items-center gap-2 text-gray-300 hover:text-white py-2 px-3 rounded-lg hover:bg-gray-800 transition-colors text-sm">
                                <Settings size={16} />관리
                            </button>
                        )}
                        <button onClick={() => { setMenuOpen(false); onLogout(); }} className="flex items-center gap-2 text-gray-300 hover:text-white py-2 px-3 rounded-lg hover:bg-gray-800 transition-colors text-sm">
                            <LogOut size={16} />로그아웃
                        </button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 px-4 overflow-hidden" style={{ background: t.heroGradient }}>
                <style>{`
                    @keyframes hero-float {
                        0%   { transform: translateY(0)   scale(1);   opacity: 0.12; }
                        100% { transform: translateY(-18px) scale(1.4); opacity: 0.28; }
                    }
                    @keyframes hero-shimmer {
                        0%   { transform: translateX(-120%) skewX(-18deg); }
                        100% { transform: translateX(320%)  skewX(-18deg); }
                    }
                `}</style>

                {/* 배경 블러 오브 */}
                <div className="absolute top-16 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: t.accent }} />
                <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ backgroundColor: t.accentLight }} />
                <div className="absolute top-1/2 left-0 w-56 h-56 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ backgroundColor: t.accent }} />

                {/* 빛 파티클 */}
                {([
                    { s: 3, l: '7%',  t2: '28%', d: '0s',   r: '3.2s' },
                    { s: 5, l: '21%', t2: '62%', d: '0.7s', r: '4s'   },
                    { s: 2, l: '37%', t2: '14%', d: '1.3s', r: '3.5s' },
                    { s: 4, l: '54%', t2: '72%', d: '0.4s', r: '2.8s' },
                    { s: 3, l: '71%', t2: '22%', d: '1.6s', r: '3.8s' },
                    { s: 6, l: '87%', t2: '48%', d: '0.9s', r: '4.3s' },
                ] as const).map((p, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            width: p.s, height: p.s,
                            left: p.l, top: p.t2,
                            backgroundColor: i % 2 === 0 ? t.accentLight : '#ffffff',
                            boxShadow: `0 0 ${p.s * 4}px ${i % 2 === 0 ? t.accentLight : 'rgba(255,255,255,0.9)'}`,
                            filter: p.s > 4 ? 'blur(1px)' : undefined,
                            animation: `hero-float ${p.r} ease-in-out ${p.d} infinite alternate`,
                        }}
                    />
                ))}

                {/* 네온 대각선 빔 */}
                <div className="absolute pointer-events-none" style={{
                    width: '1px', height: '180px',
                    left: '13%', top: '8%',
                    background: `linear-gradient(to bottom, transparent, ${t.accentLight}50, transparent)`,
                    transform: 'rotate(28deg)',
                    filter: 'blur(2px)',
                }} />
                <div className="absolute pointer-events-none" style={{
                    width: '1px', height: '120px',
                    left: '42%', top: '55%',
                    background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)`,
                    transform: 'rotate(-20deg)',
                    filter: 'blur(1.5px)',
                }} />

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="grid lg:grid-cols-[5fr_7fr] gap-0 items-center">
                        <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: t.accentLight }}>DIALOGUE WITH AI</p>
                            <h1 className="text-4xl sm:text-5xl font-extrabold mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
                                당신이 기다려온<br />
                                <span style={{ color: t.accentLight }}>모든 페르소나</span>
                            </h1>
                            <p className="text-gray-400 text-base mb-7 leading-relaxed">
                                AI와 나누는 특별한 대화,<br />
                                당신만을 위한 페르소나와 시작하세요.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {/* 메인 CTA — 샴페인 골드 테두리 + 시머 */}
                                <button
                                    onClick={() => sorted[0] && onSelectPersona(sorted[0].id)}
                                    className="relative overflow-hidden text-white font-semibold px-6 py-3 rounded-full transition-all hover:scale-105"
                                    style={{
                                        backgroundColor: t.accent,
                                        border: '1px solid rgba(212,175,55,0.45)',
                                        boxShadow: '0 0 24px rgba(212,175,55,0.18)',
                                    }}
                                >
                                    <span className="absolute inset-0 pointer-events-none" style={{
                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
                                        animation: 'hero-shimmer 2.8s ease-in-out infinite',
                                    }} />
                                    <span className="relative">지금 AI와 대화하기 →</span>
                                </button>
                                {/* 서브 고스트 버튼 */}
                                <button
                                    onClick={() => document.getElementById('carousel')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="relative overflow-hidden font-semibold px-6 py-3 rounded-full border transition-all hover:text-white"
                                    style={{ color: '#d1d5db', borderColor: '#4b5563' }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = '#9ca3af';
                                        e.currentTarget.style.boxShadow = '0 0 14px rgba(255,255,255,0.08)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#4b5563';
                                        e.currentTarget.style.boxShadow = '';
                                    }}
                                >
                                    <span className="absolute inset-0 pointer-events-none" style={{
                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                                        animation: 'hero-shimmer 3.5s ease-in-out 1.2s infinite',
                                    }} />
                                    <span className="relative">AI들 만나보기</span>
                                </button>
                            </div>
                        </div>

                        {/* 히어로 이미지 / ZigzagCards fallback */}
                        {heroImageUrl ? (
                            <div className="flex justify-center items-center mt-6 lg:mt-0">
                                <img
                                    src={heroImageUrl}
                                    alt="hero"
                                    className="w-full max-w-xl object-contain drop-shadow-2xl"
                                    style={{ maxHeight: '420px', mixBlendMode: 'multiply' }}
                                />
                            </div>
                        ) : (
                            <ZigzagCards
                                personas={sorted}
                                accent={t.accent}
                                accentLight={t.accentLight}
                                onSelect={onSelectPersona}
                            />
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
                                    ? { backgroundColor: t.accent, color: '#fff', border: '1px solid transparent' }
                                    : { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #2d3748' }
                                }
                            >
                                전체
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                                    {personas.filter(p => p.isVisible !== false).length}
                                </span>
                            </button>
                            {categories.map(cat => {
                                const count = personas.filter(p => p.isVisible !== false && p.categoryId === cat.id).length;
                                if (count === 0) return null;
                                const isSelected = selectedCategoryId === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategorySelect(cat.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
                                        style={isSelected
                                            ? { backgroundColor: t.accent, color: '#fff', border: '1px solid transparent' }
                                            : { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #2d3748' }
                                        }
                                    >
                                        {cat.name}
                                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
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
                        <div className="overflow-hidden">
                            <div className="flex gap-4">
                                {Array.from({ length: visibleCount }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex-shrink-0 bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 animate-pulse"
                                        style={{ width: `calc(${100 / visibleCount}% - ${16 * (visibleCount - 1) / visibleCount}px)` }}
                                    >
                                        <div className="h-64 bg-gray-800" />
                                        <div className="p-4 space-y-2">
                                            <div className="h-4 bg-gray-800 rounded w-1/2" />
                                            <div className="h-3 bg-gray-800 rounded w-full" />
                                            <div className="h-3 bg-gray-800 rounded w-3/4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div
                            className="select-none"
                            style={{
                                overflow: 'hidden',
                                cursor: isDragging ? 'grabbing' : 'grab',
                                paddingTop: '16px',
                                paddingBottom: '16px',
                                marginTop: '-16px',
                                marginBottom: '-16px',
                            }}
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
                                            onClick={() => { if (dragDistRef.current > 5) return; onSelectPersona(persona.id); }}
                                            className="relative flex-shrink-0 text-left group overflow-hidden"
                                            style={{
                                                width: `calc(${100 / visibleCount}% - ${16 * (visibleCount - 1) / visibleCount}px)`,
                                                borderRadius: '16px',
                                                border: isNew ? '1.5px solid rgba(251,191,36,0.55)' : '1px solid #1a2035',
                                                boxShadow: isNew ? '0 0 20px rgba(251,191,36,0.15)' : 'none',
                                                transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.3s ease',
                                                zIndex: 1,
                                                letterSpacing: '-0.02em',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.boxShadow = '0 0 0 1.5px rgba(212,175,55,0.5), 0 20px 60px rgba(0,0,0,0.7), 0 0 32px rgba(212,175,55,0.12)';
                                                e.currentTarget.style.zIndex = '10';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = isNew ? '0 0 20px rgba(251,191,36,0.15)' : 'none';
                                                e.currentTarget.style.zIndex = '1';
                                            }}
                                        >
                                            {/* 전체 이미지 영역 */}
                                            <div className="relative" style={{ height: '320px' }}>
                                                {persona.imageUrl ? (
                                                    <img
                                                        src={persona.imageUrl}
                                                        alt={persona.name}
                                                        draggable={false}
                                                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className={`w-full h-full bg-gradient-to-br ${persona.colorClass} flex items-center justify-center`}>
                                                        <Icon name={persona.iconName} size={64} className="text-white/80" />
                                                    </div>
                                                )}

                                                {/* 하단 다크 그라데이션 */}
                                                <div className="absolute inset-0" style={{
                                                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 40%, transparent 70%)',
                                                }} />

                                                {/* NEW 뱃지 */}
                                                {isNew && (
                                                    <span
                                                        className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                                                        style={{ background: 'linear-gradient(135deg,#fbbf24,#f97316)', color: '#000' }}
                                                    >
                                                        NEW
                                                    </span>
                                                )}

                                                {/* Multi+ 뱃지 (호버 시 출현) */}
                                                <span
                                                    className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                    style={{
                                                        background: 'rgba(109,40,217,0.85)',
                                                        color: '#e9d5ff',
                                                        border: '1px solid rgba(167,139,250,0.4)',
                                                        backdropFilter: 'blur(6px)',
                                                    }}
                                                >
                                                    Multi+
                                                </span>

                                                {/* 텍스트 오버레이 */}
                                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                                    <div className="flex items-baseline gap-1.5 mb-1">
                                                        <h3 className="text-base font-bold text-white">{persona.name}</h3>
                                                        {persona.jobTitle && (
                                                            <span className="text-[11px] text-gray-400 truncate">[{persona.jobTitle}]</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-2" style={{ color: '#aab0bd' }}>
                                                        {persona.description}
                                                    </p>
                                                </div>
                                            </div>
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
