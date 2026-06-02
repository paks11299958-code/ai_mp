/**
 * MainPageNew.tsx
 * 뉴페이지 - 타로카드 스타일 채팅 화면
 * 디자인 레퍼런스: AI Persona Chat.html (Anthropic Design)
 *
 * 3단 레이아웃:
 *   Rail(84px) | Stage(300px) | Chat(flex-1)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, Settings, Megaphone, UserCircle, Search, Bell, X, Menu } from 'lucide-react';
import { Persona, Category } from '../types';
import { Icon } from './Icons';
import { useAuthContext } from '../contexts/AuthContext';

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
    onSelectPersona: (personaId: string) => void;
    onAdminClick: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onPartnerBoardClick?: () => void;
    onProfileClick?: () => void;
    categories?: Category[];
    onGoHome?: () => void;
    // 기능카드 클릭 시 해당 페르소나로 이동
    onFeatureSelect?: (personaName: string) => void;
    // 초기 탭 설정
    initialTab?: 'personas' | 'features';
    // 히어로에서 클릭한 포커스 대상
    initialFocusPersonaId?: string | null;
    initialFocusFeatureKey?: string | null;
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
                    draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties} />
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
    onAdminClick: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onProfileClick?: () => void;
    onGoHome?: () => void;
}> = ({ personas, activeId, onSelect, onAdminClick, onAnnouncementClick, unreadAnnouncementCount = 0, onProfileClick, onGoHome }) => {
    const { user, onLogout } = useAuthContext();
    return (
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

        {/* HOME 버튼 */}
        <button onClick={onGoHome} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            marginBottom: 10, paddingBottom: 10,
            borderBottom: `1px solid ${T.lineSoft}`,
            width: '100%', textAlign: 'center',
            padding: '0 0 10px',
        }}>
            <span style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 28, fontWeight: 700,
                color: T.gold,
                lineHeight: 1,
                display: 'block',
            }}>H</span>
        </button>

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
};

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
                    {/* 트럼프 카드 격자 테두리 */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
                        viewBox="0 0 180 280" preserveAspectRatio="none">
                        <rect x="4" y="4" width="172" height="272" rx="10" fill="none" stroke={gold} strokeWidth="1.3" opacity="0.6"/>
                        <rect x="8" y="8" width="164" height="264" rx="7" fill="none" stroke={gold} strokeWidth="0.6" opacity="0.4"/>
                        {[[15,15],[165,15],[15,265],[165,265]].map(([cx,cy],idx) => (
                            <g key={idx} transform={`translate(${cx},${cy})`}>
                                <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill={gold} opacity="0.55"/>
                                <polygon points="0,-3 3,0 0,3 -3,0" fill={gold} opacity="0.3"/>
                            </g>
                        ))}
                        <line x1="13" y1="140" x2="167" y2="140" stroke={gold} strokeWidth="0.5" opacity="0.18" strokeDasharray="4 4"/>
                    </svg>
                    {/* 로마 숫자 */}
                    <div style={{ position: 'absolute', top: 8, left: 10, zIndex: 3, fontFamily: "'Cinzel', serif", fontSize: 9, color: gold, letterSpacing: '0.18em', opacity: 0.9 }}>I</div>
                    <div style={{ position: 'absolute', bottom: 8, right: 10, zIndex: 3, fontFamily: "'Cinzel', serif", fontSize: 9, color: gold, letterSpacing: '0.18em', opacity: 0.9, transform: 'rotate(180deg)' }}>I</div>

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
                                draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties} />
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
                            fontSize: 11, color: gold,
                            letterSpacing: '0.08em', marginBottom: 3, opacity: 0.85, fontWeight: 500,
                        }}>{persona.jobTitle || 'PERSONA'}</div>
                        <div style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: 20, fontWeight: 700,
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
// 기능 카드 데이터
// ─────────────────────────────────────────────
// chat 카드 제거, 각 기능에 연결 페르소나 이름 매핑
export const FEATURES_GRID = [
    { id: 1,  numeral: 'I',   latin: 'News',    key: 'news',    name: '오늘 뉴스',      tag: 'AI 뉴스 브리핑', desc: '매일 아침 AI가 핵심만 골라 요약 전달. 9개 카테고리 중 원하는 분야를 선택하세요.',         icon: 'newspaper', palette: { bg: '#E8EEF7', deep: '#9AAFCB', accent: '#5C7BA8' }, personaName: '서아'    },
    { id: 2,  numeral: 'II',  latin: 'Stock',   key: 'stock',   name: '주식 분석',      tag: 'AI 투자 리포트', desc: '종목명만 입력하면 Gemini·Claude·GPT 3중 AI가 투자 리포트를 드려요.',                     icon: 'chart',     palette: { bg: '#E0EFE3', deep: '#9CC4A7', accent: '#2E6B32' }, personaName: '윤채원'  },
    { id: 3,  numeral: 'III', latin: 'Swing',   key: 'swing',   name: '스윙 분석',      tag: '골프 AI 코치',   desc: '스윙 영상을 올리면 AI가 5개 항목을 분석해 개선점을 제안해요. 나만의 AI 골프 코치.',        icon: 'golf',      palette: { bg: '#FEF6E8', deep: '#E2C9A0', accent: '#8B6020' }, personaName: '설아'    },
    { id: 4,  numeral: 'IV',  latin: 'Luxury',  key: 'luxury',  name: '명품 감정',      tag: '진품 여부 판별', desc: '사진만 올리면 AI가 브랜드 진위 여부를 분석해 감정 리포트를 드려요.',                        icon: 'shield',    palette: { bg: '#F0EAF8', deep: '#C4A8D8', accent: '#7A5FA0' }, personaName: '신은비'  },
    { id: 6,  numeral: 'VI',  latin: 'Used',    key: 'used',    name: '중고 판매',      tag: '중고마켓 도우미',desc: 'AI가 중고 상품 설명을 대신 작성해줘요. 사진 한 장으로 판매글 완성.',                        icon: 'shopping',  palette: { bg: '#FCEADD', deep: '#E2B89A', accent: '#C68760' }, personaName: '이아린'  },
    { id: 7,  numeral: 'VII', latin: 'Keyword', key: 'keyword', name: '핫 키워드',      tag: '쇼핑 트렌드',    desc: '실시간 인기 쇼핑 키워드를 AI가 분석해 트렌드를 알려드려요.',                               icon: 'sparkles',  palette: { bg: '#E4ECEE', deep: '#9DB6BC', accent: '#5E7E86' }, personaName: '이아린'  },
    { id: 8,  numeral: 'VIII',latin: 'Math',    key: 'math',    name: 'AI 수학 튜터',   tag: '학습 도우미',    desc: '단계별 풀이로 수학 문제를 해결해 드려요. 개념 설명부터 심화까지.',                           icon: 'book',      palette: { bg: '#FDE6F0', deep: '#F4A4C6', accent: '#D85C95' }, personaName: '지우'    },
    { id: 9,  numeral: 'IX',  latin: 'Club',    key: 'attend',  name: '모임 출첵',      tag: '커뮤니티 관리',  desc: '모임 출석 체크와 멤버 관리를 AI가 도와드려요.',                                             icon: 'people',    palette: { bg: '#E5E1F2', deep: '#A99DCC', accent: '#6E5DA3' }, personaName: '지우'    },
    { id: 10, numeral: 'X',   latin: 'Fortune', key: 'siwoon',  name: '시운의 흐름',    tag: '운세 · 토정비결', desc: '',  subItems: ['📅 오늘의 운세', '🌙 이달의 흐름', '🌟 올해의 비결'], icon: 'fortune',   palette: { bg: '#EEE5F8', deep: '#B8A0D8', accent: '#6B4FA0' }, personaName: '도결(道潔) 선생' },
    { id: 11, numeral: 'XI',  latin: 'Wealth',  key: 'wealth',  name: '성취와 재물',    tag: '재물 · 사업 운세', desc: '', subItems: ['💰 재물 흐름', '🏆 사업 / 성취'],                   icon: 'coin',      palette: { bg: '#FDF6E0', deep: '#E8C86A', accent: '#A07828' }, personaName: '도결(道潔) 선생' },
    { id: 12, numeral: 'XII', latin: 'Love',    key: 'yeonn',   name: '인연의 결',      tag: '연애 · 궁합 운세', desc: '', subItems: ['❤️ 연애 운세', '💑 인연 궁합'],                   icon: 'heart',     palette: { bg: '#FDE8F0', deep: '#E8A0BC', accent: '#B84070' }, personaName: '도결(道潔) 선생' },
    { id: 13, numeral: 'XIII',latin: 'Dream',   key: 'dream',   name: '꿈해몽',         tag: 'AI 꿈 풀이',      desc: '어젯밤 꾼 꿈을 들려주시면 도결 선생이 그 뜻을 풀어드려요.',                                  icon: 'moon',      palette: { bg: '#E8E4F5', deep: '#A898D0', accent: '#5848A0' }, personaName: '도결(道潔) 선생' },
    { id: 14, numeral: 'XIV', latin: 'Gwansang',key: 'gwansang',name: '관상학',         tag: 'AI 관상 분석',    desc: '얼굴 사진 한 장으로 도결 선생이 관상과 성격·운세를 풀어드려요.',                              icon: 'gwansang',  palette: { bg: '#F0EAE0', deep: '#C8B098', accent: '#886040' }, personaName: '도결(道潔) 선생' },
];

const ROMAN_MPN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV'];

// ─────────────────────────────────────────────
// Feature 아이콘 SVG (MainPageNew용)
// ─────────────────────────────────────────────
const MpnFeatureIcon: React.FC<{ kind: string; size?: number; color?: string; bg?: string }> = ({ kind, size = 64, color = '#8E6FB7', bg = '#F5E6F7' }) => {
    const c = color, a = bg;
    switch (kind) {
        case 'chat':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M18 22 Q18 16 24 16 L72 16 Q78 16 78 22 L78 58 Q78 64 72 64 L54 64 L44 78 L34 64 L24 64 Q18 64 18 58 Z" fill={c} opacity="0.9"/><circle cx="36" cy="40" r="4" fill={a}/><circle cx="48" cy="40" r="4" fill={a}/><circle cx="60" cy="40" r="4" fill={a}/></svg>;
        case 'newspaper': return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><rect x="14" y="18" width="54" height="62" rx="5" fill={c} opacity="0.9"/><rect x="68" y="26" width="14" height="46" rx="3" fill={c} opacity="0.55"/><rect x="22" y="28" width="24" height="18" rx="3" fill={a} opacity="0.7"/><line x1="22" y1="54" x2="60" y2="54" stroke={a} strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="62" x2="52" y2="62" stroke={a} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/><line x1="22" y1="70" x2="46" y2="70" stroke={a} strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/></svg>;
        case 'chart':     return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><rect x="14" y="64" width="14" height="18" rx="3" fill={c} opacity="0.5"/><rect x="34" y="48" width="14" height="34" rx="3" fill={c} opacity="0.7"/><rect x="54" y="30" width="14" height="52" rx="3" fill={c} opacity="0.9"/><path d="M14 62 Q34 40 54 28 L68 20" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/><circle cx="68" cy="20" r="4" fill={c}/><line x1="14" y1="82" x2="82" y2="82" stroke={c} strokeWidth="2" opacity="0.3"/></svg>;
        case 'golf':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><line x1="48" y1="20" x2="48" y2="80" stroke={c} strokeWidth="3" strokeLinecap="round"/><path d="M48 20 Q62 28 60 38 Q58 46 48 44 Z" fill={c} opacity="0.9"/><ellipse cx="48" cy="82" rx="16" ry="4" fill={c} opacity="0.25"/><path d="M28 55 Q36 48 48 52 Q60 56 68 46" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6"/></svg>;
        case 'shield':    return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M48 14 L74 24 V46 Q74 68 48 78 Q22 68 22 46 V24 Z" fill={c} opacity="0.9"/><path d="M36 46 L44 54 L62 36" stroke={a} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;
        case 'face':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><ellipse cx="48" cy="44" rx="28" ry="32" fill={c} opacity="0.9"/><circle cx="38" cy="40" r="4" fill={a} opacity="0.9"/><circle cx="58" cy="40" r="4" fill={a} opacity="0.9"/><path d="M36 56 Q48 64 60 56" stroke={a} strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M30 24 Q48 14 66 24" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6"/></svg>;
        case 'shopping':  return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M28 36 L20 76 L76 76 L68 36 Z" fill={c} opacity="0.9"/><path d="M34 36 Q34 22 48 22 Q62 22 62 36" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round"/><line x1="38" y1="50" x2="38" y2="64" stroke={a} strokeWidth="2" strokeLinecap="round"/><line x1="48" y1="48" x2="48" y2="66" stroke={a} strokeWidth="2" strokeLinecap="round"/><line x1="58" y1="50" x2="58" y2="64" stroke={a} strokeWidth="2" strokeLinecap="round"/></svg>;
        case 'sparkles':  return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M48 14 L52 40 L78 44 L52 48 L48 74 L44 48 L18 44 L44 40 Z" fill={c} opacity="0.9"/><path d="M76 66 L78 74 L86 76 L78 78 L76 86 L74 78 L66 76 L74 74 Z" fill={c} opacity="0.65"/><path d="M20 18 L22 24 L28 26 L22 28 L20 34 L18 28 L12 26 L18 24 Z" fill={c} opacity="0.5"/></svg>;
        case 'book':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M14 22 Q30 18 48 22 L48 76 Q30 72 14 76 Z" fill={c} opacity="0.9"/><path d="M82 22 Q66 18 48 22 L48 76 Q66 72 82 76 Z" fill={c} opacity="0.65"/><path d="M22 34 Q32 32 42 34 M22 44 Q32 42 42 44 M22 54 Q32 52 42 54" stroke={a} strokeWidth="1.8" strokeLinecap="round"/></svg>;
        case 'people':    return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><circle cx="34" cy="30" r="13" fill={c} opacity="0.9"/><path d="M14 76 Q14 54 34 54 Q54 54 54 76 Z" fill={c} opacity="0.9"/><circle cx="64" cy="36" r="11" fill={c} opacity="0.6"/><path d="M46 78 Q46 60 64 60 Q82 60 82 78 Z" fill={c} opacity="0.6"/></svg>;
        case 'fortune':   return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><circle cx="48" cy="46" r="26" fill={c} opacity="0.15"/><path d="M48 14 L52 36 L74 30 L58 46 L74 62 L52 56 L48 78 L44 56 L22 62 L38 46 L22 30 L44 36 Z" fill={c} opacity="0.9"/><circle cx="48" cy="46" r="7" fill={a} opacity="0.8"/></svg>;
        case 'coin':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><circle cx="48" cy="48" r="30" fill={c} opacity="0.9"/><circle cx="48" cy="48" r="22" fill="none" stroke={a} strokeWidth="2" opacity="0.5"/><text x="48" y="55" textAnchor="middle" fontSize="22" fontWeight="bold" fill={a} opacity="0.9">₩</text></svg>;
        case 'heart':     return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M48 74 Q18 56 18 36 Q18 20 32 18 Q40 18 48 28 Q56 18 64 18 Q78 20 78 36 Q78 56 48 74 Z" fill={c} opacity="0.9"/><path d="M38 40 Q42 36 48 40 Q54 36 58 40" stroke={a} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/></svg>;
        case 'moon':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M62 18 Q38 22 34 48 Q30 72 54 80 Q30 82 20 62 Q10 38 28 22 Q42 10 62 18 Z" fill={c} opacity="0.9"/><circle cx="66" cy="28" r="4" fill={c} opacity="0.5"/><circle cx="72" cy="40" r="2.5" fill={c} opacity="0.35"/><circle cx="60" cy="42" r="2" fill={c} opacity="0.3"/></svg>;
        case 'gwansang':  return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><ellipse cx="48" cy="42" rx="24" ry="28" fill={c} opacity="0.9"/><circle cx="38" cy="38" r="3.5" fill={a} opacity="0.9"/><circle cx="58" cy="38" r="3.5" fill={a} opacity="0.9"/><path d="M37 52 Q48 58 59 52" stroke={a} strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M34 30 Q48 22 62 30" stroke={c} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.5"/><line x1="48" y1="70" x2="48" y2="80" stroke={c} strokeWidth="2" opacity="0.3"/><path d="M36 80 Q48 76 60 80" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3"/></svg>;
        default: return null;
    }
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
    onFeatureSelect?: (personaName: string) => void;
    initialTab?: 'personas' | 'features';
    focusPersonaId?: string | null;
    focusFeatureKey?: string | null;
    // 햄버거 메뉴용
    onGoHome?: () => void;
    onAdminClick?: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onProfileClick?: () => void;
    onPartnerBoardClick?: () => void;
}> = ({ personas, categories, onSelect, searchQuery, onSearchChange, selectedCategoryId, onCategorySelect, onFeatureSelect, initialTab = 'personas', focusPersonaId, focusFeatureKey, onGoHome, onAdminClick, onAnnouncementClick, unreadAnnouncementCount = 0, onProfileClick, onPartnerBoardClick }) => {
    const { user, onLogout } = useAuthContext();
    const [tab, setTab] = useState<'personas' | 'features'>(initialTab);
    const [featureSearchQuery, setFeatureSearchQuery] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const focusPersonaRef = useRef<HTMLDivElement | null>(null);
    const focusFeatureRef = useRef<HTMLDivElement | null>(null);

    // initialTab 변경 시 탭 동기화
    React.useEffect(() => { setTab(initialTab); }, [initialTab]);

    // 포커스 대상 카드로 스크롤
    React.useEffect(() => {
        if (focusPersonaId && tab === 'personas') {
            setTimeout(() => {
                focusPersonaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [focusPersonaId, tab]);
    React.useEffect(() => {
        if (focusFeatureKey && tab === 'features') {
            setTimeout(() => {
                focusFeatureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [focusFeatureKey, tab]);

    const filtered = personas
        .filter(p => selectedCategoryId === null || p.categoryId === selectedCategoryId)
        .filter(p => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.jobTitle?.toLowerCase().includes(q);
        });

    const filteredFeatures = FEATURES_GRID.filter(f => {
        if (!featureSearchQuery.trim()) return true;
        const q = featureSearchQuery.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q) || f.tag.toLowerCase().includes(q);
    });

    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: T.bg, overflow: 'hidden',
        }}>
            {/* 모바일 드로어 */}
            {mobileMenuOpen && (
                <>
                    <div onClick={() => setMobileMenuOpen(false)} style={{
                        position: 'fixed', inset: 0, zIndex: 98,
                        background: 'rgba(45,36,56,0.3)', backdropFilter: 'blur(2px)',
                    }} />
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 99,
                        width: 240,
                        background: 'rgba(251,248,243,0.97)',
                        backdropFilter: 'blur(16px)',
                        borderLeft: `1px solid ${T.lineSoft}`,
                        padding: '20px 0',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '-8px 0 32px -8px rgba(80,50,110,0.18)',
                    }}>
                        {/* 닫기 */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 12px' }}>
                            <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                <X size={20} color={T.inkMute} />
                            </button>
                        </div>

                        {/* 유저 정보 */}
                        {user && (
                            <div style={{ padding: '8px 20px 14px', borderBottom: `1px solid ${T.lineSoft}`, marginBottom: 4 }}>
                                <div style={{ fontSize: 11, color: T.inkMute, marginBottom: 2 }}>로그인됨</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                                    {user.username || user.email.split('@')[0]}님 ✦
                                </div>
                            </div>
                        )}

                        {/* 메뉴 아이템 */}
                        {[
                            { label: '🏠 첫 화면', onClick: onGoHome },
                            { label: '🧑‍🤝‍🧑 페르소나 목록', onClick: () => { setTab('personas'); setMobileMenuOpen(false); } },
                            { label: '✨ 기능 둘러보기', onClick: () => { setTab('features'); setMobileMenuOpen(false); } },
                            { label: '👤 내 정보', onClick: onProfileClick },
                            { label: '📢 공지사항', onClick: onAnnouncementClick, badge: unreadAnnouncementCount },
                            { label: '🤝 제휴 문의', onClick: onPartnerBoardClick },
                            ...(user?.role === 'ADMIN' ? [{ label: '⚙️ 어드민', onClick: onAdminClick }] : []),
                        ].filter(item => item.onClick).map((item, i) => (
                            <button key={i} onClick={() => { setMobileMenuOpen(false); item.onClick?.(); }} style={{
                                padding: '13px 20px', background: 'none', border: 'none',
                                textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8,
                                borderTop: i === 0 ? 'none' : 'none',
                            }}>
                                {item.label}
                                {item.badge && item.badge > 0 ? (
                                    <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, background: T.accent2, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{item.badge}</span>
                                ) : null}
                            </button>
                        ))}

                        {/* 로그아웃 */}
                        {onLogout && (
                            <button onClick={() => { setMobileMenuOpen(false); onLogout(); }} style={{
                                marginTop: 'auto', padding: '13px 20px', background: 'none', border: 'none',
                                textAlign: 'left', fontSize: 14, color: '#C0505A', cursor: 'pointer',
                                borderTop: `1px solid ${T.lineSoft}`,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <LogOut size={15} /> 로그아웃
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* 헤더 */}
            <div style={{
                padding: '20px 28px 0px',
                borderBottom: `1px solid ${T.lineSoft}`,
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(8px)',
                position: 'relative',
            }}>
                {/* 모바일 햄버거 버튼 — mpn-rail 숨겨질 때만 표시 */}
                <button
                    className="mpn-hamburger"
                    onClick={() => setMobileMenuOpen(true)}
                    style={{
                        position: 'absolute', top: 18, right: 20,
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 6, borderRadius: 8,
                        display: 'none', // CSS로 모바일만 표시
                    }}
                >
                    <Menu size={22} color={T.ink} />
                </button>

                <button onClick={() => { setTab('personas'); setFeatureSearchQuery(''); onSearchChange(''); }} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, marginBottom: 8, display: 'block',
                }}>
                    <span style={{
                        fontFamily: "'Cinzel', serif", fontSize: 15,
                        fontWeight: 700, letterSpacing: '0.35em',
                        color: T.gold, opacity: 1,
                    }}>✦ AI PERSONAS</span>
                </button>
                <h2 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 26, fontWeight: 600,
                    margin: '0 0 14px', color: T.ink,
                    letterSpacing: '-0.01em',
                }}>{tab === 'personas' ? '대화할 AI를 선택하세요' : '기능 둘러보기'}</h2>

                {/* 탭 */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                    {[
                        {
                            key: 'personas',
                            label: '✦ 캐릭터 둘러보기',
                            activeGradient: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                            inactiveGradient: `linear-gradient(135deg, rgba(142,111,183,0.18), rgba(228,139,176,0.18))`,
                            inactiveColor: T.accent,
                            activeShadow: 'rgba(142,111,183,0.4)',
                        },
                        {
                            key: 'features',
                            label: '◆ 기능 둘러보기',
                            activeGradient: 'linear-gradient(135deg, #4CAF82, #7CC56A)',
                            inactiveGradient: 'linear-gradient(135deg, rgba(76,175,130,0.18), rgba(124,197,106,0.18))',
                            inactiveColor: '#3a9e6e',
                            activeShadow: 'rgba(76,175,130,0.4)',
                        },
                    ].map(t => {
                        const isActive = tab === t.key;
                        return (
                            <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                                padding: '6px 16px', borderRadius: 999, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer', border: 'none',
                                background: isActive ? t.activeGradient : t.inactiveGradient,
                                color: isActive ? '#fff' : t.inactiveColor,
                                boxShadow: isActive ? `0 4px 12px -4px ${t.activeShadow}` : 'none',
                                outline: 'none',
                                transition: 'all 0.2s',
                            }}>{t.label}</button>
                        );
                    })}
                </div>

                {/* 검색바 - 양 탭 모두 */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: T.panel,
                    border: `1px solid ${T.line}`,
                    borderRadius: 12,
                    transition: 'border-color 0.18s, box-shadow 0.18s',
                    marginBottom: (tab === 'personas' && categories.length > 0) ? 0 : 14,
                }}>
                    <Search size={15} color={T.inkMute} />
                    <input
                        value={tab === 'personas' ? searchQuery : featureSearchQuery}
                        onChange={e => tab === 'personas' ? onSearchChange(e.target.value) : setFeatureSearchQuery(e.target.value)}
                        placeholder={tab === 'personas' ? '이름, 설명으로 검색...' : '기능 이름, 설명으로 검색...'}
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
                    {(tab === 'personas' ? searchQuery : featureSearchQuery) && (
                        <button
                            onClick={() => tab === 'personas' ? onSearchChange('') : setFeatureSearchQuery('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* 카테고리 - 페르소나 탭, 검색창 아래 별도 행 */}
                {tab === 'personas' && categories.length > 0 && (
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 14,
                    }}>
                        <button onClick={() => onCategorySelect(null)} style={{
                            padding: '5px 12px', borderRadius: 999, fontSize: 12,
                            fontWeight: 600, cursor: 'pointer',
                            background: selectedCategoryId === null ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})` : 'rgba(255,255,255,0.7)',
                            color: selectedCategoryId === null ? '#fff' : T.inkSoft,
                            boxShadow: selectedCategoryId === null ? `0 4px 12px -4px rgba(142,111,183,0.4)` : 'none',
                            border: selectedCategoryId === null ? 'none' : `1px solid ${T.line}`,
                            whiteSpace: 'nowrap', transition: 'all 0.15s',
                        } as React.CSSProperties}>전체</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => onCategorySelect(cat.id)} style={{
                                padding: '5px 12px', borderRadius: 999, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer',
                                background: selectedCategoryId === cat.id ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})` : 'rgba(255,255,255,0.7)',
                                color: selectedCategoryId === cat.id ? '#fff' : T.inkSoft,
                                boxShadow: selectedCategoryId === cat.id ? `0 4px 12px -4px rgba(142,111,183,0.4)` : 'none',
                                border: selectedCategoryId === cat.id ? 'none' : `1px solid ${T.line}`,
                                whiteSpace: 'nowrap', transition: 'all 0.15s',
                            } as React.CSSProperties}>{cat.name}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* 기능 그리드 - 타로카드 스타일 */}
            {tab === 'features' && (
                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: '20px 28px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 16,
                    alignContent: 'start',
                }}>
                    {filteredFeatures.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.inkMute, paddingTop: 40, fontSize: 14 }}>
                            검색 결과가 없습니다
                        </div>
                    )}
                    {filteredFeatures.map((feat, i) => {
                        const gold = T.gold;
                        const numeral = ROMAN_MPN[i % ROMAN_MPN.length];
                        const isFocused = feat.key === focusFeatureKey;
                        const subItems = (feat as any).subItems as string[] | undefined;
                        const W = 160, H = 280;
                        return (
                            <div key={feat.key}
                                ref={isFocused ? focusFeatureRef : undefined}
                                onClick={() => feat.personaName && onFeatureSelect?.(feat.personaName)}
                                style={{
                                    borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                                    background: `linear-gradient(160deg, ${feat.palette.bg} 0%, #FDFAF6 50%, ${feat.palette.bg} 100%)`,
                                    boxShadow: isFocused
                                        ? `0 0 0 2.5px ${feat.palette.accent}, 0 16px 36px -8px ${feat.palette.accent}60`
                                        : `0 6px 20px -6px ${feat.palette.accent}40`,
                                    transition: 'transform 0.22s, box-shadow 0.22s',
                                    position: 'relative', height: H,
                                    transform: isFocused ? 'translateY(-5px) scale(1.03)' : 'none',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-5px) scale(1.02)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 36px -8px ${feat.palette.accent}55`;
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.transform = isFocused ? 'translateY(-5px) scale(1.03)' : 'none';
                                    (e.currentTarget as HTMLElement).style.boxShadow = isFocused
                                        ? `0 0 0 2.5px ${feat.palette.accent}, 0 16px 36px -8px ${feat.palette.accent}60`
                                        : `0 6px 20px -6px ${feat.palette.accent}40`;
                                }}
                            >
                                {/* 시머 */}
                                <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', borderRadius: 16,
                                    background: 'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%)',
                                    animation: 'mpn-shimmer 4s ease-in-out infinite' }} />

                                {/* 트럼프 카드 격자 테두리 SVG */}
                                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}
                                    viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                                    {/* 외곽 테두리 */}
                                    <rect x="3.5" y="3.5" width={W-7} height={H-7} rx="11" fill="none" stroke={gold} strokeWidth="1.2" opacity="0.6"/>
                                    {/* 안쪽 테두리 */}
                                    <rect x="7" y="7" width={W-14} height={H-14} rx="8" fill="none" stroke={gold} strokeWidth="0.6" opacity="0.4"/>
                                    {/* 코너 다이아몬드 장식 — 4개 */}
                                    {[[14,14],[W-14,14],[14,H-14],[W-14,H-14]].map(([cx,cy], idx) => (
                                        <g key={idx} transform={`translate(${cx},${cy})`}>
                                            <polygon points="0,-4.5 4.5,0 0,4.5 -4.5,0" fill={gold} opacity="0.55"/>
                                            <polygon points="0,-2.5 2.5,0 0,2.5 -2.5,0" fill={gold} opacity="0.35"/>
                                        </g>
                                    ))}
                                    {/* 중앙 가로 구분선 */}
                                    <line x1="12" y1={H/2} x2={W-12} y2={H/2} stroke={gold} strokeWidth="0.5" opacity="0.2" strokeDasharray="3 3"/>
                                </svg>

                                {/* 로마 숫자 — 좌상 / 우하 (뒤집기) */}
                                <div style={{ position: 'absolute', top: 8, left: 10, zIndex: 4, fontFamily: "'Cinzel', serif", fontSize: 9, color: gold, letterSpacing: '0.15em', opacity: 0.9, lineHeight: 1 }}>{numeral}</div>
                                <div style={{ position: 'absolute', bottom: 8, right: 10, zIndex: 4, fontFamily: "'Cinzel', serif", fontSize: 9, color: gold, letterSpacing: '0.15em', opacity: 0.9, lineHeight: 1, transform: 'rotate(180deg)' }}>{numeral}</div>

                                {/* 아이콘 영역 — 카드 상단 62% */}
                                <div style={{
                                    position: 'absolute', top: 18, left: 10, right: 10, height: Math.round(H * 0.62),
                                    borderRadius: 9, border: `1px solid ${gold}40`,
                                    background: `radial-gradient(ellipse at 50% 40%, ${feat.palette.bg} 0%, ${feat.palette.deep}50 100%)`,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: 7, zIndex: 1,
                                }}>
                                    <MpnFeatureIcon kind={feat.icon} size={60} color={feat.palette.accent} bg={feat.palette.bg} />
                                    {/* 태그 뱃지 */}
                                    <div style={{
                                        background: feat.palette.accent, color: '#fff',
                                        fontSize: 10, fontWeight: 700,
                                        padding: '3px 11px', borderRadius: 999,
                                        letterSpacing: '0.04em', boxShadow: `0 2px 6px ${feat.palette.accent}50`,
                                    }}>{feat.tag}</div>
                                </div>

                                {/* 네임 플레이트 — 카드 하단 */}
                                <div style={{
                                    position: 'absolute', top: Math.round(H * 0.62) + 22, left: 0, right: 0, bottom: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    padding: '4px 10px 10px', zIndex: 4, textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: 11, color: gold, letterSpacing: '0.08em', opacity: 0.85, marginBottom: 3, fontWeight: 500 }}>{feat.latin}</div>
                                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 700, color: feat.palette.accent, lineHeight: 1.15 }}>{feat.name}</div>
                                    {subItems && (
                                        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 3 }}>
                                            {subItems.map((item: string) => (
                                                <span key={item} style={{ fontSize: 9, color: feat.palette.accent, opacity: 0.75 }}>
                                                    {item.replace(/^[^\s]+\s/, '')}
                                                </span>
                                            )).reduce((acc: React.ReactNode[], el, idx, arr) => {
                                                acc.push(el);
                                                if (idx < arr.length - 1) acc.push(<span key={`dot-${idx}`} style={{ fontSize: 9, color: gold, opacity: 0.5 }}>·</span>);
                                                return acc;
                                            }, [])}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 페르소나 그리드 */}
            {tab === 'personas' && <div style={{
                flex: 1, overflowY: 'auto',
                padding: '20px 28px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 16,
                alignContent: 'start',
            }}>
                {filtered.map((persona, i) => {
                    const palette = PALETTE_CYCLE[i % PALETTE_CYCLE.length];
                    const numeral = ROMAN_MPN[i % ROMAN_MPN.length];
                    const gold = T.gold;
                    const isFocused = persona.id === focusPersonaId;
                    const isNew = persona.createdAt
                        ? Date.now() - new Date(persona.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                        : false;
                    return (
                        <div
                            key={persona.id}
                            ref={isFocused ? focusPersonaRef : undefined}
                            onClick={() => onSelect(persona.id)}
                            style={{
                                borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                                background: `linear-gradient(155deg, ${palette.bg} 0%, #FBF8F3 55%, ${palette.bg} 100%)`,
                                boxShadow: isFocused
                                    ? `0 0 0 3px ${palette.accent}, 0 20px 40px -12px rgba(80,50,110,0.45)`
                                    : '0 8px 24px -12px rgba(80,50,110,0.25)',
                                transition: 'transform 0.25s, box-shadow 0.25s',
                                position: 'relative', height: 280,
                                transform: isFocused ? 'translateY(-6px) scale(1.03)' : 'none',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.02)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px -15px rgba(80,50,110,0.4)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = isFocused ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)';
                                (e.currentTarget as HTMLElement).style.boxShadow = isFocused
                                    ? `0 0 0 3px ${palette.accent}, 0 20px 40px -12px rgba(80,50,110,0.45)`
                                    : '0 8px 24px -12px rgba(80,50,110,0.25)';
                            }}
                        >
                            {/* 시머 */}
                            <div style={{
                                position: 'absolute', inset: 0, borderRadius: 14, zIndex: 2, pointerEvents: 'none',
                                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                                animation: 'mpn-shimmer 4s ease-in-out infinite',
                            }} />

                            {/* 트럼프 카드 격자 테두리 */}
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}
                                viewBox="0 0 160 280" preserveAspectRatio="none">
                                <rect x="4" y="4" width="152" height="272" rx="10" fill="none" stroke={gold} strokeWidth="1.3" opacity="0.6"/>
                                <rect x="8" y="8" width="144" height="264" rx="7" fill="none" stroke={gold} strokeWidth="0.6" opacity="0.4"/>
                                {[[15,15],[145,15],[15,265],[145,265]].map(([cx,cy],idx) => (
                                    <g key={idx} transform={`translate(${cx},${cy})`}>
                                        <polygon points="0,-5 5,0 0,5 -5,0" fill={gold} opacity="0.55"/>
                                        <polygon points="0,-2.8 2.8,0 0,2.8 -2.8,0" fill={gold} opacity="0.3"/>
                                    </g>
                                ))}
                                <line x1="12" y1="140" x2="148" y2="140" stroke={gold} strokeWidth="0.5" opacity="0.18" strokeDasharray="3 3"/>
                            </svg>

                            {/* 로마 숫자 TL / BR */}
                            <div style={{ position: 'absolute', top: 8, left: 10, zIndex: 4, fontFamily: "'Cinzel', serif", fontSize: 9, color: gold, letterSpacing: '0.18em', opacity: 0.9 }}>{numeral}</div>
                            <div style={{ position: 'absolute', bottom: 8, right: 10, zIndex: 4, fontFamily: "'Cinzel', serif", fontSize: 9, color: gold, letterSpacing: '0.18em', opacity: 0.9, transform: 'rotate(180deg)' }}>{numeral}</div>

                            {/* 이미지 영역 */}
                            <div style={{
                                position: 'absolute', top: 22, left: 12, right: 12, height: 172,
                                borderRadius: 8, overflow: 'hidden',
                                border: `1px solid ${gold}55`,
                                background: `radial-gradient(circle at 50% 40%, ${palette.bg} 0%, ${palette.deep}55 100%)`,
                                zIndex: 1,
                            }}>
                                {persona.imageUrl ? (
                                    <img src={persona.imageUrl} alt={persona.name}
                                        draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: palette.accent, opacity: 0.4 }}>✦</div>
                                )}
                                {/* 하단 페이드 */}
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: `linear-gradient(to top, ${palette.bg}cc, transparent)` }} />
                                {/* NEW 뱃지 */}
                                {isNew && (
                                    <span style={{
                                        position: 'absolute', top: 6, right: 6, zIndex: 3,
                                        background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                                        color: '#000', fontSize: 8, fontWeight: 700,
                                        padding: '2px 6px', borderRadius: 999,
                                        animation: 'mpn-pulse 1.5s ease-in-out infinite',
                                    }}>NEW</span>
                                )}
                            </div>

                            {/* 네임 플레이트 */}
                            <div style={{
                                position: 'absolute', top: 202, left: 0, right: 0, bottom: 0,
                                padding: '6px 12px 12px',
                                textAlign: 'center', zIndex: 3,
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                            }}>
                                <div style={{ fontSize: 11, color: gold, letterSpacing: '0.08em', marginBottom: 3, opacity: 0.85, fontWeight: 500 }}>{persona.jobTitle || 'PERSONA'}</div>
                                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: palette.accent, lineHeight: 1.1 }}>{persona.name}</div>
                            </div>
                        </div>
                    );
                })}
            </div>}
        </div>
    );
};

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export const MainPageNew: React.FC<MainPageNewProps> = ({
    personas,
    isLoading,
    onSelectPersona,
    onAdminClick,
    onAnnouncementClick,
    unreadAnnouncementCount = 0,
    onPartnerBoardClick,
    onProfileClick,
    categories = [],
    onGoHome,
    onFeatureSelect,
    initialTab = 'personas',
    initialFocusPersonaId = null,
    initialFocusFeatureKey = null,
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

    // 기능 카드 클릭 → 페르소나 이름으로 찾아서 채팅 이동
    const handleFeatureSelect = (personaName: string) => {
        const persona = personas.find(p => p.name === personaName);
        if (persona) {
            handleSelectPersona(persona.id);
        } else if (onFeatureSelect) {
            onFeatureSelect(personaName);
        }
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
                    .mpn-hamburger { display: flex !important; }
                }
            `}</style>

            {/* Left Rail */}
            <div className="mpn-rail">
                <ChatRail
                    personas={personas}
                    activeId={activePersonaId}
                    onSelect={handleSelectPersona}
                    onAdminClick={onAdminClick}
                    onAnnouncementClick={onAnnouncementClick}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    onProfileClick={onProfileClick}
                    onGoHome={onGoHome}
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
                onFeatureSelect={handleFeatureSelect}
                initialTab={initialTab}
                focusPersonaId={initialFocusPersonaId}
                focusFeatureKey={initialFocusFeatureKey}
                onGoHome={onGoHome}
                onAdminClick={onAdminClick}
                onAnnouncementClick={onAnnouncementClick}
                unreadAnnouncementCount={unreadAnnouncementCount}
                onProfileClick={onProfileClick}
                onPartnerBoardClick={onPartnerBoardClick}
            />
        </div>
    );
};

export default MainPageNew;
