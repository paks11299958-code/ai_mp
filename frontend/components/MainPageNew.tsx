/**
 * MainPageNew.tsx
 * 뉴페이지 - 타로카드 스타일 채팅 화면
 * 디자인 레퍼런스: AI Persona Chat.html (Anthropic Design)
 *
 * 3단 레이아웃:
 *   Rail(84px) | Stage(300px) | Chat(flex-1)
 */

import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Settings, Megaphone, UserCircle, Search, Bell, X } from 'lucide-react';
import { Persona, User, Category } from '../types';
import { Icon } from './Icons';

// ─────────────────────────────────────────────
// 디자인 토큰
// ─────────────────────────────────────────────
const T = {
    bg:       '#FBF8F3',
    bgTint:   '#F5EEF6',
    panel:    '#FFFFFF',
    ink:      '#2D2438',
    inkSoft:  '#6B5F7A',
    inkMute:  '#9089A1',
    line:     '#EAE2D3',
    lineSoft: '#F0E9DE',
    gold:     '#B58F4A',
    goldSoft: '#D9C28F',
    accent:   '#8E6FB7',
    accent2:  '#E48BB0',
};

const PALETTE_CYCLE = [
    { bg: '#F5E6F7', deep: '#B49AC9', accent: '#8E6FB7' },
    { bg: '#E8EEF7', deep: '#9AAFCB', accent: '#5C7BA8' },
    { bg: '#FCEADD', deep: '#E2B89A', accent: '#C68760' },
    { bg: '#FAE3EA', deep: '#E8A8BC', accent: '#C76A8A' },
    { bg: '#E0EFE3', deep: '#9CC4A7', accent: '#5E9070' },
    { bg: '#FFF3D6', deep: '#E8C56A', accent: '#B89232' },
    { bg: '#E4ECEE', deep: '#9DB6BC', accent: '#5E7E86' },
    { bg: '#EEE5DA', deep: '#C8AE93', accent: '#8E6F50' },
    { bg: '#FDE6F0', deep: '#F4A4C6', accent: '#D85C95' },
    { bg: '#E5E1F2', deep: '#A99DCC', accent: '#6E5DA3' },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface MainPageNewProps {
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
    categories?: Category[];
}

// ─────────────────────────────────────────────
// 페르소나 아바타 (Rail용 원형)
// ─────────────────────────────────────────────
const PersonaAvatar: React.FC<{
    persona: Persona;
    index: number;
    size?: number;
    active?: boolean;
    hasUnread?: boolean;
    onClick?: () => void;
}> = ({ persona, index, size = 44, active = false, hasUnread = false, onClick }) => {
    const palette = PALETTE_CYCLE[index % PALETTE_CYCLE.length];
    return (
        <button
            onClick={onClick}
            title={persona.name}
            style={{
                position: 'relative',
                width: size, height: size,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                border: active
                    ? `2.5px solid ${palette.accent}`
                    : `2px solid ${T.lineSoft}`,
                boxShadow: active
                    ? `0 0 0 3px ${palette.accent}22, 0 4px 12px -4px ${palette.accent}55`
                    : '0 2px 8px rgba(80,50,110,0.12)',
                transition: 'transform 0.18s, box-shadow 0.18s',
                cursor: 'pointer',
                background: `radial-gradient(circle at 50% 38%, ${palette.bg} 0%, ${palette.deep}88 100%)`,
                padding: 0,
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
            {persona.imageUrl ? (
                <img src={persona.imageUrl} alt={persona.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            ) : (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: size * 0.38, color: palette.accent, fontWeight: 700,
                }}>
                    {persona.name[0]}
                </div>
            )}
            {/* 읽지 않은 메시지 dot */}
            {hasUnread && (
                <span style={{
                    position: 'absolute', top: 1, right: 1,
                    width: 10, height: 10,
                    background: T.accent2,
                    border: `2px solid #fff`,
                    borderRadius: '50%',
                }} />
            )}
        </button>
    );
};

// ─────────────────────────────────────────────
// Left Rail — 브랜드 로고 + 페르소나 목록 + 하단 아이콘
// ─────────────────────────────────────────────
const ChatRail: React.FC<{
    personas: Persona[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onLogout: () => void;
    onAdminClick: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onProfileClick?: () => void;
    user: User;
}> = ({ personas, activeId, onSelect, onLogout, onAdminClick, onAnnouncementClick, unreadAnnouncementCount = 0, onProfileClick, user }) => (
    <aside style={{
        width: 80,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        borderRight: `1px solid ${T.lineSoft}`,
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(10px)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        zIndex: 10,
    }}>
        {/* 브랜드 로고 */}
        <div style={{ marginBottom: 14 }}>
            <img src="/aichat_log2.png" alt="logo" style={{
                width: 44, height: 44,
                borderRadius: 12,
                mixBlendMode: 'multiply',
            }} />
        </div>

        {/* FRIENDS 라벨 */}
        <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 8, letterSpacing: '0.28em',
            color: T.gold, marginBottom: 10,
            paddingBottom: 10,
            borderBottom: `1px solid ${T.lineSoft}`,
            width: '100%', textAlign: 'center',
        }}>친구</div>

        {/* 페르소나 목록 */}
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 10, overflowY: 'auto',
            paddingBottom: 8, width: '100%',
        }}>
            {personas.map((p, i) => (
                <div key={p.id} style={{ position: 'relative' }}>
                    {/* active 인디케이터 바 */}
                    {p.id === activeId && (
                        <div style={{
                            position: 'absolute',
                            left: -14, top: '50%',
                            width: 3, height: 22,
                            background: `linear-gradient(180deg, ${T.accent}, ${T.accent2})`,
                            borderRadius: '0 4px 4px 0',
                            transform: 'translateY(-50%)',
                        }} />
                    )}
                    <PersonaAvatar
                        persona={p} index={i}
                        active={p.id === activeId}
                        onClick={() => onSelect(p.id)}
                    />
                </div>
            ))}
        </div>

        {/* 하단 아이콘 버튼들 */}
        <div style={{
            borderTop: `1px solid ${T.lineSoft}`,
            paddingTop: 10,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
        }}>
            {onAnnouncementClick && (
                <button
                    onClick={onAnnouncementClick}
                    title="공지사항"
                    style={{
                        position: 'relative',
                        width: 34, height: 34, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(142,111,183,0.1)`; (e.currentTarget as HTMLElement).style.color = T.accent; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = T.inkSoft; }}
                >
                    <Bell size={18} />
                    {unreadAnnouncementCount > 0 && (
                        <span style={{
                            position: 'absolute', top: 2, right: 2,
                            width: 8, height: 8,
                            background: T.accent2, borderRadius: '50%',
                            border: '1.5px solid #fff',
                        }} />
                    )}
                </button>
            )}
            {(user.role === 'ADMIN' || user.role === 'MANAGE') && (
                <button onClick={onAdminClick} title="관리자"
                    style={{
                        width: 34, height: 34, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(142,111,183,0.1)`; (e.currentTarget as HTMLElement).style.color = T.accent; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = T.inkSoft; }}
                >
                    <Settings size={18} />
                </button>
            )}
            <button onClick={onProfileClick ?? onLogout} title="프로필"
                style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(142,111,183,0.1)`; (e.currentTarget as HTMLElement).style.color = T.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = T.inkSoft; }}
            >
                <UserCircle size={18} />
            </button>
            <button onClick={onLogout} title="로그아웃"
                style={{
                    width: 34, height: 34, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(142,111,183,0.1)`; (e.currentTarget as HTMLElement).style.color = T.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = T.inkSoft; }}
            >
                <LogOut size={18} />
            </button>
        </div>
    </aside>
);

// ─────────────────────────────────────────────
// Middle Stage — 타로카드 + 페르소나 정보
// ─────────────────────────────────────────────
const ChatStage: React.FC<{
    persona: Persona;
    index: number;
}> = ({ persona, index }) => {
    const palette = PALETTE_CYCLE[index % PALETTE_CYCLE.length];
    const gold = T.gold;

    return (
        <aside style={{
            width: 300,
            flexShrink: 0,
            borderRight: `1px solid ${T.lineSoft}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '28px 20px',
            overflowY: 'auto',
            background: `
                radial-gradient(ellipse 100% 40% at 50% 0%, rgba(245,230,247,0.6) 0%, transparent 70%),
                rgba(255,255,255,0.4)
            `,
        }}>
            {/* 타로카드 */}
            <div style={{
                marginBottom: 20,
                transform: 'rotate(-2deg)',
                transition: 'transform 0.4s cubic-bezier(.2,.8,.2,1)',
                flexShrink: 0,
            }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'rotate(0deg) scale(1.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'rotate(-2deg)'; }}
            >
                {/* 카드 본체 */}
                <div style={{
                    width: 180, height: 280,
                    borderRadius: 12,
                    background: `linear-gradient(155deg, ${palette.bg} 0%, #FBF8F3 55%, ${palette.bg} 100%)`,
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 24px 50px -20px rgba(80,50,110,0.4), 0 8px 20px -8px rgba(80,50,110,0.2)',
                }}>
                    {/* 시머 */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)',
                        animation: 'mpn-shimmer 4s ease-in-out infinite',
                        pointerEvents: 'none', zIndex: 2,
                    }} />
                    {/* 골드 테두리 */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
                        viewBox="0 0 180 280" preserveAspectRatio="none">
                        <rect x="4" y="4" width="172" height="272" rx="8"
                            fill="none" stroke={gold} strokeWidth="1.2" opacity="0.55" />
                        <rect x="8" y="8" width="164" height="264" rx="5"
                            fill="none" stroke={gold} strokeWidth="0.6" opacity="0.4" />
                    </svg>
                    {/* 로마 숫자 */}
                    <div style={{
                        position: 'absolute', top: 8, left: 10, zIndex: 3,
                        fontFamily: "'Cinzel', serif", fontSize: 9,
                        color: gold, letterSpacing: '0.18em', opacity: 0.85,
                    }}>I</div>
                    <div style={{
                        position: 'absolute', bottom: 8, right: 10, zIndex: 3,
                        fontFamily: "'Cinzel', serif", fontSize: 9,
                        color: gold, letterSpacing: '0.18em', opacity: 0.85,
                        transform: 'rotate(180deg)',
                    }}>I</div>

                    {/* 이미지 영역 */}
                    <div style={{
                        position: 'absolute', top: 20, left: 12, right: 12, height: 180,
                        borderRadius: 6, overflow: 'hidden',
                        border: `1px solid ${gold}44`,
                        background: `radial-gradient(circle at 50% 40%, ${palette.bg} 0%, ${palette.deep}55 100%)`,
                        zIndex: 1,
                    }}>
                        {persona.imageUrl ? (
                            <img src={persona.imageUrl} alt={persona.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                        ) : (
                            <div style={{
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 52, color: palette.accent, opacity: 0.4,
                            }}>✦</div>
                        )}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
                            background: `linear-gradient(to top, ${palette.bg}bb, transparent)`,
                        }} />
                    </div>

                    {/* 네임 플레이트 */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '8px 12px 12px', textAlign: 'center', zIndex: 3,
                    }}>
                        <div style={{
                            fontFamily: "'Cinzel', serif", fontSize: 7,
                            color: gold, letterSpacing: '0.25em', marginBottom: 3, opacity: 0.85,
                        }}>— PERSONA —</div>
                        <div style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: 18, fontWeight: 600,
                            color: palette.accent, lineHeight: 1.1,
                        }}>{persona.name}</div>
                    </div>
                </div>
            </div>

            {/* 이름 블록 */}
            <div style={{ textAlign: 'center', marginBottom: 14, width: '100%' }}>
                <div style={{
                    fontFamily: "'Cinzel', serif", fontSize: 9,
                    letterSpacing: '0.3em', color: gold,
                    textTransform: 'uppercase', marginBottom: 5, opacity: 0.9,
                }}>— {persona.jobTitle || 'AI Persona'} —</div>
                <h2 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 30, fontWeight: 600,
                    margin: '0 0 3px', lineHeight: 1,
                    letterSpacing: '-0.01em', color: T.ink,
                }}>{persona.name}</h2>
                {persona.jobTitle && (
                    <div style={{ fontSize: 12, color: T.inkSoft, letterSpacing: '0.02em' }}>
                        {persona.jobTitle}
                    </div>
                )}
            </div>

            {/* 인용구 */}
            {persona.description && (
                <blockquote style={{
                    position: 'relative',
                    margin: '0 0 18px',
                    padding: '12px 16px 12px 22px',
                    background: 'rgba(255,255,255,0.75)',
                    borderLeft: `2px solid ${palette.accent}`,
                    borderRadius: '0 10px 10px 0',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: 'italic',
                    fontSize: 13, lineHeight: 1.6,
                    color: T.inkSoft, width: '100%',
                    boxSizing: 'border-box',
                }}>
                    <span style={{
                        position: 'absolute', left: 5, top: 3,
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 22, color: T.goldSoft, lineHeight: 1,
                    }}>❝</span>
                    {persona.description.slice(0, 80)}{persona.description.length > 80 ? '…' : ''}
                </blockquote>
            )}

            {/* 구분선 */}
            <div style={{
                width: '100%', height: 1, marginBottom: 14,
                background: `linear-gradient(to right, transparent, ${T.lineSoft}, transparent)`,
            }} />

            {/* 메타 정보 */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.inkSoft }}>
                    <span style={{
                        fontFamily: "'Cinzel', serif", fontSize: 8,
                        letterSpacing: '0.2em', color: gold,
                        textTransform: 'uppercase', width: 40, flexShrink: 0,
                    }}>기분</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: palette.accent,
                            animation: 'mpn-pulse 2.4s ease-in-out infinite',
                            display: 'inline-block',
                        }} />
                        오늘은 기대되는 하루예요
                    </span>
                </div>
            </div>
        </aside>
    );
};

// ─────────────────────────────────────────────
// 페르소나 선택 화면 (채팅 전)
// ─────────────────────────────────────────────
const PersonaSelectPanel: React.FC<{
    personas: Persona[];
    categories: Category[];
    onSelect: (id: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedCategoryId: number | null;
    onCategorySelect: (id: number | null) => void;
}> = ({ personas, categories, onSelect, searchQuery, onSearchChange, selectedCategoryId, onCategorySelect }) => {
    const filtered = personas
        .filter(p => selectedCategoryId === null || p.categoryId === selectedCategoryId)
        .filter(p => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.jobTitle?.toLowerCase().includes(q);
        });

    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: T.bg, overflow: 'hidden',
        }}>
            {/* 헤더 */}
            <div style={{
                padding: '20px 28px 16px',
                borderBottom: `1px solid ${T.lineSoft}`,
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(8px)',
            }}>
                <div style={{
                    fontFamily: "'Cinzel', serif", fontSize: 10,
                    letterSpacing: '0.35em', color: T.gold,
                    marginBottom: 6, opacity: 0.9,
                }}>✦ AI PERSONAS</div>
                <h2 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 26, fontWeight: 600,
                    margin: '0 0 14px', color: T.ink,
                    letterSpacing: '-0.01em',
                }}>대화할 AI를 선택하세요</h2>

                {/* 검색바 */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: T.panel,
                    border: `1px solid ${T.line}`,
                    borderRadius: 12,
                    transition: 'border-color 0.18s, box-shadow 0.18s',
                }}>
                    <Search size={15} color={T.inkMute} />
                    <input
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="이름, 설명으로 검색..."
                        style={{
                            flex: 1, border: 'none', outline: 'none',
                            background: 'transparent', fontSize: 13.5,
                            color: T.ink,
                        }}
                        onFocus={e => {
                            const p = e.currentTarget.parentElement!;
                            p.style.borderColor = T.accent;
                            p.style.boxShadow = `0 0 0 3px rgba(142,111,183,0.1)`;
                        }}
                        onBlur={e => {
                            const p = e.currentTarget.parentElement!;
                            p.style.borderColor = T.line;
                            p.style.boxShadow = 'none';
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => onSearchChange('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* 카테고리 탭 */}
                {categories.length > 0 && (
                    <div style={{
                        display: 'flex', gap: 6, marginTop: 10,
                        overflowX: 'auto', paddingBottom: 2,
                    }}>
                        <button
                            onClick={() => onCategorySelect(null)}
                            style={{
                                padding: '5px 12px', borderRadius: 999, fontSize: 12,
                                fontWeight: 600, border: 'none', cursor: 'pointer',
                                background: selectedCategoryId === null
                                    ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})`
                                    : 'rgba(255,255,255,0.7)',
                                color: selectedCategoryId === null ? '#fff' : T.inkSoft,
                                boxShadow: selectedCategoryId === null ? `0 4px 12px -4px rgba(142,111,183,0.4)` : 'none',
                                border: selectedCategoryId === null ? 'none' : `1px solid ${T.line}`,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s',
                            } as React.CSSProperties}
                        >전체</button>
                        {categories.map(cat => (
                            <button key={cat.id}
                                onClick={() => onCategorySelect(cat.id)}
                                style={{
                                    padding: '5px 12px', borderRadius: 999, fontSize: 12,
                                    fontWeight: 600, border: 'none', cursor: 'pointer',
                                    background: selectedCategoryId === cat.id
                                        ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})`
                                        : 'rgba(255,255,255,0.7)',
                                    color: selectedCategoryId === cat.id ? '#fff' : T.inkSoft,
                                    boxShadow: selectedCategoryId === cat.id ? `0 4px 12px -4px rgba(142,111,183,0.4)` : 'none',
                                    border: selectedCategoryId === cat.id ? 'none' : `1px solid ${T.line}`,
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s',
                                } as React.CSSProperties}
                            >{cat.name}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* 페르소나 그리드 */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: '20px 28px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 16,
                alignContent: 'start',
            }}>
                {filtered.map((persona, i) => {
                    const palette = PALETTE_CYCLE[i % PALETTE_CYCLE.length];
                    const isNew = persona.createdAt
                        ? Date.now() - new Date(persona.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                        : false;
                    return (
                        <div
                            key={persona.id}
                            onClick={() => onSelect(persona.id)}
                            style={{
                                borderRadius: 14,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                background: `linear-gradient(155deg, ${palette.bg} 0%, #FBF8F3 55%, ${palette.bg} 100%)`,
                                border: `1px solid ${T.goldSoft}55`,
                                boxShadow: '0 4px 16px -8px rgba(80,50,110,0.2)',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                position: 'relative',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 32px -12px rgba(80,50,110,0.35)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px -8px rgba(80,50,110,0.2)';
                            }}
                        >
                            {/* 골드 테두리 */}
                            <div style={{
                                position: 'absolute', inset: 0, borderRadius: 14,
                                border: `1px solid ${T.gold}44`, pointerEvents: 'none', zIndex: 2,
                            }} />

                            {/* 이미지 */}
                            <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                                {persona.imageUrl ? (
                                    <img src={persona.imageUrl} alt={persona.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        background: `radial-gradient(circle at 50% 40%, ${palette.bg} 0%, ${palette.deep}55 100%)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 40, color: palette.accent, opacity: 0.5,
                                    }}>✦</div>
                                )}
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                                    background: `linear-gradient(to top, ${palette.bg}dd, transparent)`,
                                }} />
                                {isNew && (
                                    <span style={{
                                        position: 'absolute', top: 8, right: 8,
                                        background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                                        color: '#000', fontSize: 9, fontWeight: 700,
                                        padding: '2px 6px', borderRadius: 999,
                                        animation: 'mpn-pulse 1.5s ease-in-out infinite',
                                    }}>NEW</span>
                                )}
                            </div>

                            {/* 정보 */}
                            <div style={{ padding: '10px 12px 12px', textAlign: 'center' }}>
                                <div style={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: 17, fontWeight: 600,
                                    color: palette.accent, marginBottom: 3,
                                }}>{persona.name}</div>
                                {persona.jobTitle && (
                                    <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.4 }}>
                                        {persona.jobTitle}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export const MainPageNew: React.FC<MainPageNewProps> = ({
    personas,
    isLoading,
    user,
    onSelectPersona,
    onLogout,
    onAdminClick,
    onAnnouncementClick,
    unreadAnnouncementCount = 0,
    onPartnerBoardClick,
    onProfileClick,
    categories = [],
}) => {
    const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

    const activePersona = personas.find(p => p.id === activePersonaId) ?? null;
    const activeIndex = personas.findIndex(p => p.id === activePersonaId);

    const handleSelectPersona = (id: string) => {
        setActivePersonaId(id);
        onSelectPersona(id);
    };

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            background: `
                radial-gradient(ellipse 50% 30% at 0% 0%, #F5E6F7 0%, transparent 60%),
                radial-gradient(ellipse 50% 30% at 100% 100%, #FCEADD 0%, transparent 60%),
                ${T.bg}
            `,
            fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif",
            color: T.ink,
        }}>
            {/* Google Fonts */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cinzel:wght@400;500;600&display=swap');
                @keyframes mpn-shimmer {
                    0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
                    30%  { opacity: 1; }
                    70%  { opacity: 1; }
                    100% { transform: translateX(320%) skewX(-18deg); opacity: 0; }
                }
                @keyframes mpn-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50%      { transform: scale(1.35); opacity: 0.7; }
                }
                @media (max-width: 1100px) {
                    .mpn-stage { display: none !important; }
                }
                @media (max-width: 700px) {
                    .mpn-rail { display: none !important; }
                }
            `}</style>

            {/* Left Rail */}
            <div className="mpn-rail">
                <ChatRail
                    personas={personas}
                    activeId={activePersonaId}
                    onSelect={handleSelectPersona}
                    onLogout={onLogout}
                    onAdminClick={onAdminClick}
                    onAnnouncementClick={onAnnouncementClick}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    onProfileClick={onProfileClick}
                    user={user}
                />
            </div>

            {/* Middle Stage (active persona 선택 시) */}
            {activePersona && (
                <div className="mpn-stage">
                    <ChatStage persona={activePersona} index={activeIndex >= 0 ? activeIndex : 0} />
                </div>
            )}

            {/* Right: 페르소나 선택 화면 (채팅은 기존 ChatPage로 이동) */}
            <PersonaSelectPanel
                personas={personas}
                categories={categories}
                onSelect={handleSelectPersona}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={setSelectedCategoryId}
            />
        </div>
    );
};

export default MainPageNew;
