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
import { HeroCard, personaApi } from '../services/apiService';
import { Icon } from './Icons';
import { TermsModal } from './TermsModal';
import { useAuthContext } from '../contexts/AuthContext';
import { usePoints } from '../contexts/PointsContext';

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
    onLoginClick?: () => void;
    onChargeClick?: () => void;
    categories?: Category[];
    onGoHome?: () => void;
    // 기능카드 클릭 시 해당 페르소나로 이동
    onFeatureSelect?: (personaName: string, featureKey?: string) => void;
    // 초기 탭 설정
    initialTab?: 'personas' | 'features';
    // 히어로에서 클릭한 포커스 대상
    initialFocusPersonaId?: string | null;
    initialFocusFeatureKey?: string | null;
    // 최근 대화 페르소나(최근순) — "최근 대화" 줄 + 개인화 인사용
    recentPersonas?: Persona[];
    recentFeatureKeys?: string[];  // 최근 사용 기능 — 기능 탭 '최근 사용' 줄
    // 즐겨찾기(자주가는 메뉴): 기능카드 ⭐ 토글
    isFavorite?: (key: string) => boolean;
    onToggleFavorite?: (key: string) => void;
    favoritableKeys?: string[]; // 즐겨찾기 가능한 키만 ⭐ 표시
    // 페르소나 즐겨찾기 (페르소나 카드 ☆ 토글)
    isFavoritePersona?: (id: string) => boolean;
    onToggleFavoritePersona?: (id: string) => void;
    // 공유: 기능 카드 🔗 버튼 (?f 딥링크)
    onShareFeature?: (featureKey: string, label: string) => void;
    // 통합 메인: 상단 '지금 주목' 캐러셀에 흡수할 어드민 메인 카드(없으면 기본 추천 항목으로 폴백)
    heroCards?: HeroCard[];
    // 어드민 지정 카드 순서(AppConfig). 키 배열. 없으면 기본/자동.
    spotlightOrder?: string[];
    newFeaturesOrder?: string[];
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
// category: 기능 둘러보기 탭 상단 칩 필터용 (FEATURE_CATEGORIES 참조)
export const FEATURE_CATEGORIES = [
    { key: 'invest',  label: '💰 투자·쇼핑' },
    { key: 'info',    label: '📰 정보·학습' },
    { key: 'create',  label: '🎨 창작·콘텐츠' },
    { key: 'fortune', label: '🔮 운세·사주' },
    { key: 'hobby',   label: '🏌️ 건강·취미' },
    { key: 'life',    label: '👥 생활·커뮤니티' },
];

export const FEATURES_GRID = [
    { id: 1,  numeral: 'I',   latin: 'News',    key: 'news',    name: '오늘 뉴스',      tag: 'AI 뉴스 브리핑', category: 'info',    desc: '매일 아침 AI가 핵심만 골라 요약 전달. 9개 카테고리 중 원하는 분야를 선택하세요.',         icon: 'newspaper', palette: { bg: '#E8EEF7', deep: '#9AAFCB', accent: '#5C7BA8' }, personaName: '서아',    releasedAt: '2026-05-01' },
    { id: 2,  numeral: 'II',  latin: 'Stock',   key: 'stock',   name: '주식 분석',      tag: 'AI 투자 리포트', category: 'invest',  desc: '종목명만 입력하면 Gemini·Claude·GPT 3중 AI가 투자 리포트를 드려요.',                     icon: 'chart',     palette: { bg: '#E0EFE3', deep: '#9CC4A7', accent: '#2E6B32' }, personaName: '윤채원',  releasedAt: '2026-05-01' },
    { id: 3,  numeral: 'III', latin: 'Swing',   key: 'swing',   name: '스윙 분석',      tag: '골프 AI 코치',   category: 'hobby',   desc: '스윙 영상을 올리면 AI가 5개 항목을 분석해 개선점을 제안해요. 나만의 AI 골프 코치.',        icon: 'golf',      palette: { bg: '#FEF6E8', deep: '#E2C9A0', accent: '#8B6020' }, personaName: '설아',    releasedAt: '2026-05-01' },
    { id: 4,  numeral: 'IV',  latin: 'Luxury',  key: 'luxury',  name: '명품 감정',      tag: '진품 여부 판별', category: 'invest',  desc: '사진만 올리면 AI가 브랜드 진위 여부를 분석해 감정 리포트를 드려요.',                        icon: 'shield',    palette: { bg: '#F0EAF8', deep: '#C4A8D8', accent: '#7A5FA0' }, personaName: '신은비',  releasedAt: '2026-05-01' },
    { id: 5,  numeral: 'V',   latin: 'Insurance',key: 'insurance',name: '보험 컨설팅',    tag: '중복보장 분석',  category: 'invest',  desc: '가입한 보험을 올리면 AI가 중복·부족 보장을 분석해 컨설팅 리포트를 드려요.',                  icon: 'umbrella',  palette: { bg: '#E6EEF6', deep: '#9BB4CE', accent: '#3E6695' }, personaName: '정우진',  releasedAt: '2026-06-14' },
    { id: 6,  numeral: 'VI',  latin: 'Used',    key: 'used',    name: '중고 판매',      tag: '중고마켓 도우미',category: 'invest',  desc: 'AI가 중고 상품 설명을 대신 작성해줘요. 사진 한 장으로 판매글 완성.',                        icon: 'shopping',  palette: { bg: '#FCEADD', deep: '#E2B89A', accent: '#C68760' }, personaName: '이아린',  releasedAt: '2026-05-01' },
    { id: 7,  numeral: 'VII', latin: 'Keyword', key: 'hotkeyword', name: '핫 키워드',      tag: '쇼핑 트렌드',    category: 'invest',  desc: '실시간 인기 쇼핑 키워드를 AI가 분석해 트렌드를 알려드려요.',                               icon: 'sparkles',  palette: { bg: '#E4ECEE', deep: '#9DB6BC', accent: '#5E7E86' }, personaName: '이아린',  releasedAt: '2026-05-01' },
    { id: 8,  numeral: 'VIII',latin: 'Math',    key: 'mathtutor', name: 'AI 수학 튜터',   tag: '학습 도우미',    category: 'info',    desc: '단계별 풀이로 수학 문제를 해결해 드려요. 개념 설명부터 심화까지.',                           icon: 'book',      palette: { bg: '#FDE6F0', deep: '#F4A4C6', accent: '#D85C95' }, personaName: '지우',    releasedAt: '2026-06-13' },
    { id: 9,  numeral: 'IX',  latin: 'Club',    key: 'club',    name: '모임 출첵',      tag: '커뮤니티 관리',  category: 'life',    desc: '모임 출석 체크와 멤버 관리를 AI가 도와드려요.',                                             icon: 'people',    palette: { bg: '#E5E1F2', deep: '#A99DCC', accent: '#6E5DA3' }, personaName: '지우',    releasedAt: '2026-06-06' },
    { id: 10, numeral: 'X',   latin: 'Fortune', key: 'siwoon',  name: '시운의 흐름',    tag: '운세 · 토정비결', category: 'fortune', desc: '',  subItems: ['📅 오늘의 운세', '🌙 이달의 흐름', '🌟 올해의 비결'], icon: 'fortune',   palette: { bg: '#EEE5F8', deep: '#B8A0D8', accent: '#6B4FA0' }, personaName: '도결(道潔) 선생', releasedAt: '2026-06-05' },
    { id: 11, numeral: 'XI',  latin: 'Wealth',  key: 'wealth',  name: '성취와 재물',    tag: '재물 · 사업 운세', category: 'fortune', desc: '', subItems: ['💰 재물 흐름', '🏆 사업 / 성취'],                   icon: 'coin',      palette: { bg: '#FDF6E0', deep: '#E8C86A', accent: '#A07828' }, personaName: '도결(道潔) 선생', releasedAt: '2026-06-05' },
    { id: 12, numeral: 'XII', latin: 'Love',    key: 'yeonn',   name: '인연의 결',      tag: '연애 · 궁합 운세', category: 'fortune', desc: '', subItems: ['❤️ 연애 운세', '💑 인연 궁합'],                   icon: 'heart',     palette: { bg: '#FDE8F0', deep: '#E8A0BC', accent: '#B84070' }, personaName: '도결(道潔) 선생', releasedAt: '2026-06-05' },
    { id: 13, numeral: 'XIII',latin: 'Dream',   key: 'dream',   name: '꿈해몽',         tag: 'AI 꿈 풀이',      category: 'fortune', desc: '어젯밤 꾼 꿈을 들려주시면 도결 선생이 그 뜻을 풀어드려요.',                                  icon: 'moon',      palette: { bg: '#E8E4F5', deep: '#A898D0', accent: '#5848A0' }, personaName: '도결(道潔) 선생', releasedAt: '2026-06-05' },
    { id: 14, numeral: 'XIV', latin: 'Gwansang',key: 'gwansang',name: '관상학',         tag: 'AI 관상 분석',    category: 'fortune', desc: '얼굴 사진 한 장으로 도결 선생이 관상과 성격·운세를 풀어드려요.',                              icon: 'gwansang',  palette: { bg: '#F0EAE0', deep: '#C8B098', accent: '#886040' }, personaName: '도결(道潔) 선생', releasedAt: '2026-06-05' },
    { id: 15, numeral: 'XV',  latin: 'Ebook',   key: 'ebook',   name: '전자책 만들기',  tag: 'AI 출판 도우미', category: 'create',  desc: '주제만 정하면 AI가 목차·본문·표지를 만들어 전자책(.docx)으로 완성해드려요.',                icon: 'ebook',     palette: { bg: '#EDE8F6', deep: '#B6A4D8', accent: '#6A4FA0' }, personaName: '강지훈',  releasedAt: '2026-06-11' },
    { id: 16, numeral: 'XVI', latin: 'Webtoon', key: 'webtoon', name: '웹툰 보기',      tag: 'AI 웹툰 연재',   category: 'create',  desc: '향기 작가가 연재하는 웹툰을 회차별로 감상하세요. 한 컷씩 풀스크린으로.',                      icon: 'webtoon',   palette: { bg: '#FCE8EF', deep: '#F0A8C4', accent: '#C84D85' }, personaName: '향기(필명)', releasedAt: '2026-06-12' },
    { id: 17, numeral: 'XVII',latin: 'Hair',    key: 'hair',    name: '헤어스타일 진단',tag: 'AI 뷰티 컨설팅', category: 'life',    desc: '내 사진을 올리고 헤어스타일을 고르면 윤채린이 어울리는지 진단해드려요.',                      icon: 'hair',      palette: { bg: '#F3E9F4', deep: '#D4A8DC', accent: '#9B5FA8' }, personaName: '윤채린',  releasedAt: '2026-06-16' },
    { id: 18, numeral: 'XVIII',latin: 'Lookalike',key: 'lookalike',name: '닮은 연예인 찾기',tag: 'AI 닮은꼴 분석', category: 'life',    desc: '내 사진을 올리면 윤채린이 닮은 연예인을 찾아드려요. 친구에게 자랑해 보세요!',                  icon: 'face',      palette: { bg: '#F0E8F8', deep: '#C4A9E0', accent: '#8E6FB7' }, personaName: '윤채린',  releasedAt: '2026-06-24' },
    { id: 19, numeral: 'XIX', latin: 'Marketing',key: 'marketing',name: 'AI 마케팅 글쓰기',tag: 'SNS 콘텐츠 작성', category: 'create',  desc: '홍보할 주제만 적으면 아린이가 인스타 콘텐츠 초안(후킹·해시태그·측정안)을 만들어 드려요. 첫 1회 무료!', icon: 'sparkles',  palette: { bg: '#F3E9F4', deep: '#D4A8DC', accent: '#8E6FB7' }, personaName: '이아린',  releasedAt: '2026-06-28' },
    { id: 20, numeral: 'XX',  latin: 'Future Me',key: 'agetransform',name: '미래의 나',     tag: 'AI 나이 변환',   category: 'life',    desc: '내 사진과 나이를 넣으면 윤채린이 미래(노화)의 모습을 보여드려요. Before/After 슬라이더로 확인!',  icon: 'face',      palette: { bg: '#F3E9F4', deep: '#D4A8DC', accent: '#9B5FA8' }, personaName: '윤채린',  releasedAt: '2026-06-21' },
];

// 기능 연관 키워드(동의어) 맵 — 이름/설명에 없는 표현으로도 찾게 함.
// 예: "심심해" → 운세류, "재테크" → 주식. 검색어가 아래 키워드에 부분일치하면 그 기능이 검색됨.
// FEATURES_GRID의 key와 1:1. 새 기능 추가 시 여기도 한 줄 넣어주면 의미검색이 넓어짐.
export const FEATURE_SYNONYMS: Record<string, string[]> = {
    news:        ['뉴스', '기사', '소식', '신문', '브리핑', '시사', '헤드라인', '오늘일'],
    stock:       ['주식', '증시', '투자', '재테크', '재테크', '종목', '코스피', '나스닥', '주가', '돈불리기', '자산'],
    swing:       ['골프', '스윙', '자세', '필드', '라운딩', '운동', '스포츠'],
    luxury:      ['명품', '진품', '가품', '짝퉁', '정품', '감정', '럭셔리', '브랜드', '가방', '시계'],
    insurance:   ['보험', '보장', '실비', '중복보장', '설계', '컨설팅', '보험료', '연금'],
    used:        ['중고', '판매', '당근', '중고나라', '거래', '판매글', '팔기', '마켓'],
    hotkeyword:  ['키워드', '트렌드', '쇼핑', '인기', '유행', '핫템', '검색어', '순위'],
    mathtutor:   ['수학', '공부', '학습', '문제풀이', '숙제', '과외', '튜터', '계산', '학생', '학원'],
    club:        ['모임', '출석', '출첵', '동호회', '커뮤니티', '멤버', '동아리', '단체', '카페'],
    siwoon:      ['운세', '사주', '토정비결', '점', '점집', '타로', '심심', '오늘운세', '미래', '팔자', '길흉'],
    wealth:      ['재물운', '금전운', '사업운', '성공', '성취', '돈운', '재물', '부자', '사업'],
    yeonn:       ['연애', '궁합', '인연', '사랑', '짝사랑', '이성', '연애운', '커플', '솔로', '만남'],
    dream:       ['꿈', '해몽', '꿈풀이', '악몽', '길몽', '개꿈', '자면서'],
    gwansang:    ['관상', '얼굴', '인상', '성격', '얼굴분석', 'face', '외모'],
    ebook:       ['전자책', '책', '출판', '집필', '글쓰기', '작가', '도서', 'pdf', 'docx', '책만들기'],
    webtoon:     ['웹툰', '만화', '연재', '그림', '향기', '카툰', '툰'],
    hair:        ['헤어', '머리', '미용', '스타일', '뷰티', '헤어스타일', '펌', '염색', '이발', '미용실'],
    lookalike:   ['닮은꼴', '닮은연예인', '연예인', '닮은', '얼굴', '나랑닮은', '유명인', '셀럽'],
    marketing:   ['마케팅', '홍보', 'sns', '인스타', '광고', '콘텐츠', '글쓰기', '피드', '해시태그', '게시물', '바이럴'],
    agetransform:['나이변환', '노화', '늙은', '미래의나', '나이든', '늙으면', '변환', '얼굴변환', '나이', '미래모습'],
};

// 기능이 검색어와 매칭되는지 — 이름/태그/설명(부분일치) + 연관 키워드(동의어)까지.
// q는 이미 소문자·trim 된 검색어. 빈 검색어는 호출 전에 걸러짐.
const featureMatches = (f: typeof FEATURES_GRID[number], q: string): boolean =>
    f.name.toLowerCase().includes(q) ||
    f.desc.toLowerCase().includes(q) ||
    f.tag.toLowerCase().includes(q) ||
    (FEATURE_SYNONYMS[f.key] ?? []).some(kw => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()));

const ROMAN_MPN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII'];

// ─────────────────────────────────────────────
// 가로 캐러셀 래퍼 — 내용이 넘칠 때만 좌우 화살표 노출, 클릭 시 스크롤.
// (children은 flex row. overflowX:auto는 내부에서 직접 줌)
// 가로 캐러셀 — 마우스 드래그(모바일 스와이프 느낌)로만 이동. 화살표 없음.
// 드래그는 window 리스너로 처리해 컨테이너 밖에서 손을 떼도 안전하게 끝남.
const Carousel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        const el = ref.current; if (!el) return;
        drag.current = { active: true, startX: e.pageX, startScroll: el.scrollLeft, moved: 0 };
        el.style.cursor = 'grabbing';
        e.preventDefault();
    };
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const el = ref.current; if (!el || !drag.current.active) return;
            const dx = e.pageX - drag.current.startX;
            drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
            el.scrollLeft = drag.current.startScroll - dx;
        };
        const onUp = () => {
            if (!drag.current.active) return;
            drag.current.active = false;
            if (ref.current) ref.current.style.cursor = 'grab';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);
    // 드래그 후 직후 클릭은 막아 카드가 실수로 열리지 않게.
    const onClickCapture = (e: React.MouseEvent) => {
        if (drag.current.moved > 6) { e.preventDefault(); e.stopPropagation(); }
        drag.current.moved = 0;
    };

    return (
        <div
            ref={ref}
            onMouseDown={onMouseDown}
            onClickCapture={onClickCapture}
            style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', cursor: 'grab', userSelect: 'none' }}
        >
            {children}
        </div>
    );
};

// 큰 수를 한글 단위로 — 10000 이상이면 'N.N만', 그 미만은 콤마. (히어로 통계·랭킹 대화수)
const formatCount = (n: number): string => {
    if (!n || n < 0) return '0';
    if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
    return n.toLocaleString();
};

// 섹션 제목 — 왼쪽 컬러 강조 바 + 키운 글씨로 눈에 띄게.
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ width: 4, height: 16, borderRadius: 2, background: 'linear-gradient(180deg, #8E6FB7 0%, #C4A9E0 100%)', flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#2D2438', letterSpacing: '-0.01em' }}>{children}</span>
    </div>
);

// ─────────────────────────────────────────────
// 히어로 배너 — 그라데이션 카드 + 검색 + 실제 통계. (시안 aichat-main-mobile 참고)
// 검색 input은 personas 검색 상태(searchQuery)를 그대로 공유 → 탭 아래 검색바와 논리적 중복 없음.
// 입력 시 personas 탭으로 전환해 결과 리스트가 바로 필터되게 함.
// ─────────────────────────────────────────────
const HeroBanner: React.FC<{
    personaCount: number;
    featureCount: number;
    totalSessions: number;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    onSwitchToPersonas: () => void;
}> = ({ personaCount, featureCount, totalSessions, searchQuery, onSearchChange, onSwitchToPersonas }) => (
    <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 22,
        background: 'linear-gradient(135deg, #6A4B93 0%, #8E6FB7 48%, #B79BE0 100%)',
        color: '#fff', padding: '22px 18px 20px', marginBottom: 18,
        boxShadow: '0 8px 28px rgba(106,75,147,0.22)',
    }}>
        {/* 장식 원 */}
        <span style={{ position: 'absolute', right: -50, top: -50, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ position: 'absolute', right: 26, bottom: -64, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: 'clamp(20px, 5.5vw, 30px)', lineHeight: 1.25, margin: '0 0 8px', fontWeight: 800, letterSpacing: '-0.03em', wordBreak: 'keep-all' }}>
                오늘은 누구와<br />이야기해 볼까요?
            </h1>
            <p style={{ margin: 0, fontSize: 'clamp(12.5px, 3.4vw, 14px)', color: 'rgba(255,255,255,0.9)', maxWidth: 520, wordBreak: 'keep-all' }}>
                운세·주식·관상부터 마음 터놓는 대화까지. 나만의 AI 페르소나를 포인트로 자유롭게 만나보세요.
            </p>
            {/* 검색 */}
            <div style={{ marginTop: 15, display: 'flex', alignItems: 'center', gap: 7, background: '#fff', borderRadius: 13, padding: '5px 5px 5px 13px', boxShadow: '0 8px 24px rgba(40,20,70,0.22)' }}>
                <Search size={17} color="#908AA3" style={{ flexShrink: 0 }} />
                <input
                    value={searchQuery}
                    onChange={e => { onSwitchToPersonas(); onSearchChange(e.target.value); }}
                    placeholder="페르소나·기능 검색"
                    aria-label="검색"
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 14, color: '#191527', background: 'transparent', padding: '9px 0' }}
                />
            </div>
            {/* 통계 — 실제값만(만족도 별점 없음) */}
            <div style={{ display: 'flex', gap: 'clamp(16px, 6vw, 32px)', marginTop: 16 }}>
                {[
                    { b: `${personaCount}+`, t: 'AI 페르소나' },
                    { b: `${featureCount}`, t: 'AI 기능' },
                    ...(totalSessions > 0 ? [{ b: formatCount(totalSessions), t: '누적 대화' }] : []),
                ].map((s, i) => (
                    <div key={i} style={{ fontSize: 'clamp(11px, 3.2vw, 12.5px)', color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>
                        <b style={{ display: 'block', fontSize: 'clamp(16px, 4.6vw, 19px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{s.b}</b>
                        {s.t}
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────
// 모바일 하단 탭바 — 홈·기능·대화(FAB)·랭킹·내정보. PC(≥768px)에선 CSS로 숨김.
// 빠른 이동용(전체 메뉴는 햄버거). 시안 aichat-main-mobile 참고.
// ─────────────────────────────────────────────
const TAB_ICONS: Record<string, React.ReactNode> = {
    home: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    features: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>,
    chat: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-5.9A8.4 8.4 0 1 1 21 11.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    ranking: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 21h8M12 17v4" strokeLinecap="round" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    me: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" /></svg>,
};

const BottomTabBar: React.FC<{
    onHome: () => void;
    onFeatures: () => void;
    onChat: () => void;
    onRanking: () => void;
    onMe: () => void;
}> = ({ onHome, onFeatures, onChat, onRanking, onMe }) => {
    const tab = (key: string, label: string, onClick: () => void) => (
        <button onClick={onClick} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 600, color: '#908AA3', padding: '4px 0',
        }}>
            {TAB_ICONS[key]}
            {label}
        </button>
    );
    return (
        <nav className="mpn-tabbar" aria-label="하단 탭" style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid #ECEAF2',
            display: 'flex', justifyContent: 'space-around',
            padding: '6px 4px calc(6px + env(safe-area-inset-bottom))',
        }}>
            {tab('home', '홈', onHome)}
            {tab('features', '기능', onFeatures)}
            {/* 가운데 FAB — 대화 */}
            <button onClick={onChat} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: '#8E6FB7',
            }}>
                <span style={{
                    marginTop: -20, width: 46, height: 46, borderRadius: '50%', background: '#8E6FB7', color: '#fff',
                    display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(142,111,183,0.5)', border: '4px solid #fff',
                }}>{TAB_ICONS.chat}</span>
                대화
            </button>
            {tab('ranking', '랭킹', onRanking)}
            {tab('me', '내정보', onMe)}
        </nav>
    );
};

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
        case 'umbrella':  return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><path d="M48 18 Q22 18 16 44 Q30 36 48 44 Q66 36 80 44 Q74 18 48 18 Z" fill={c} opacity="0.9"/><line x1="48" y1="44" x2="48" y2="74" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><path d="M48 74 Q48 82 40 82 Q34 82 34 76" stroke={c} strokeWidth="3.5" fill="none" strokeLinecap="round"/><line x1="48" y1="16" x2="48" y2="22" stroke={c} strokeWidth="3" strokeLinecap="round"/></svg>;
        case 'ebook':     return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><rect x="22" y="16" width="48" height="64" rx="6" fill={c} opacity="0.9"/><line x1="46" y1="16" x2="46" y2="80" stroke={a} strokeWidth="2" opacity="0.5"/><path d="M30 30 Q38 28 42 30 M30 40 Q38 38 42 40 M30 50 Q38 48 42 50" stroke={a} strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/><path d="M52 30 Q60 28 64 30 M52 40 Q60 38 64 40 M52 50 Q60 48 64 50" stroke={a} strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/><path d="M58 60 L62 70 L72 60 Z" fill={a} opacity="0.5"/></svg>;
        case 'webtoon':   return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><rect x="20" y="16" width="56" height="64" rx="6" fill={c} opacity="0.9"/><rect x="28" y="24" width="40" height="20" rx="3" fill={a} opacity="0.7"/><circle cx="40" cy="34" r="4" fill={c} opacity="0.6"/><path d="M30 40 Q40 32 50 40" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/><rect x="28" y="50" width="18" height="22" rx="3" fill={a} opacity="0.55"/><rect x="50" y="50" width="18" height="22" rx="3" fill={a} opacity="0.4"/></svg>;
        case 'hair':      return <svg width={size} height={size} viewBox="0 0 96 96" fill="none"><ellipse cx="48" cy="50" rx="20" ry="24" fill={a} opacity="0.5"/><path d="M28 50 Q24 24 48 20 Q72 24 68 50 Q66 38 58 34 Q60 44 54 40 Q56 30 48 30 Q40 30 42 40 Q36 44 38 34 Q30 38 28 50 Z" fill={c} opacity="0.9"/><circle cx="40" cy="50" r="3" fill={c} opacity="0.7"/><circle cx="56" cy="50" r="3" fill={c} opacity="0.7"/><path d="M40 60 Q48 66 56 60" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>;
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
    onFeatureSelect?: (personaName: string, featureKey?: string) => void;
    initialTab?: 'personas' | 'features';
    focusPersonaId?: string | null;
    focusFeatureKey?: string | null;
    // 햄버거 메뉴용
    onGoHome?: () => void;
    onAdminClick?: () => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onProfileClick?: () => void;
    onLoginClick?: () => void;
    onChargeClick?: () => void;
    onPartnerBoardClick?: () => void;
    recentPersonas?: Persona[];
    recentFeatureKeys?: string[];
    isFavorite?: (key: string) => boolean;
    onToggleFavorite?: (key: string) => void;
    favoritableKeys?: string[];
    isFavoritePersona?: (id: string) => boolean;
    onToggleFavoritePersona?: (id: string) => void;
    onShareFeature?: (featureKey: string, label: string) => void;
    heroCards?: HeroCard[];
    spotlightOrder?: string[];
    newFeaturesOrder?: string[];
}> = ({ personas, categories, onSelect, searchQuery, onSearchChange, selectedCategoryId, onCategorySelect, onFeatureSelect, initialTab = 'personas', focusPersonaId, focusFeatureKey, onGoHome, onAdminClick, onAnnouncementClick, unreadAnnouncementCount = 0, onProfileClick, onLoginClick, onChargeClick, onPartnerBoardClick, recentPersonas = [], recentFeatureKeys = [], isFavorite, onToggleFavorite, favoritableKeys, isFavoritePersona, onToggleFavoritePersona, onShareFeature, heroCards = [], spotlightOrder, newFeaturesOrder }) => {
    const { user, onLogout } = useAuthContext();
    const { paidPoints, bonusPoints } = usePoints();
    const totalPoints = (paidPoints ?? 0) + (bonusPoints ?? 0);
    const [tab, setTab] = useState<'personas' | 'features'>(initialTab);
    const [termsModal, setTermsModal] = useState<'terms' | 'privacy' | null>(null);  // 사업자정보 푸터 약관
    const [featureSearchQuery, setFeatureSearchQuery] = useState('');
    const [featureCategory, setFeatureCategory] = useState<string | null>(null);   // null=전체
    // 하이브리드 검색: 동의어로 못 찾은(0개) 검색어를 AI 의미검색으로 구제한 결과 key들.
    const [aiSearchKeys, setAiSearchKeys] = useState<string[]>([]);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showFavorites, setShowFavorites] = useState(false);   // 즐겨찾기 모달(메뉴에서 진입)
    const focusPersonaRef = useRef<HTMLDivElement | null>(null);
    const focusFeatureRef = useRef<HTMLDivElement | null>(null);
    const rootScrollRef = useRef<HTMLDivElement | null>(null);  // 하단 탭바 스크롤 이동용

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

    // ── 통합 메인 상단 섹션 데이터 ──────────────────────────────
    // 큐레이션 순서는 어드민(AppConfig)에서 지정. 미지정이면 아래 기본값 폴백.
    const DEFAULT_SPOTLIGHT_KEYS = ['webtoon', 'hair', 'siwoon', 'stock'];
    // 어드민이 지정한 '오늘의 추천' 키 순서(props). 없으면 기본값.
    const spotlightKeys = (spotlightOrder && spotlightOrder.length ? spotlightOrder : DEFAULT_SPOTLIGHT_KEYS);

    // '지금 주목': 사장 지정 큐레이션. 특별 배지 수동(키별).
    const spotlightFeatures = React.useMemo(() => {
        const badges: Record<string, string> = { webtoon: '1화 오픈', hair: 'NEW', siwoon: '오늘의 운세', stock: 'AI 리포트' };
        return spotlightKeys
            .map(k => FEATURES_GRID.find(f => f.key === k))
            .filter((f): f is typeof FEATURES_GRID[number] => !!f)
            .map(f => ({ ...f, badge: badges[f.key] }));
    }, [spotlightKeys.join(',')]);

    // '새로 나온 기능': spotlight 제외.
    // - 어드민이 newFeaturesOrder를 지정했으면(어드민 카드순서 탭 저장) → 그 목록·순서 '그대로'(표시 정본).
    // - 미지정(빈 값)이면 → spotlight 제외 전체를 출시일 최신순 자동(새 기능 자동 노출).
    const newFeatures = React.useMemo(() => {
        const pool = FEATURES_GRID.filter(f => !spotlightKeys.includes(f.key));
        const order = newFeaturesOrder ?? [];
        if (order.length) {
            return order
                .map(k => pool.find(f => f.key === k))
                .filter((f): f is typeof FEATURES_GRID[number] => !!f);
        }
        return pool.slice().sort((a, b) => ((b as any).releasedAt || '').localeCompare((a as any).releasedAt || '') || (b.id - a.id));
    }, [spotlightKeys.join(','), (newFeaturesOrder ?? []).join(',')]);

    // '나의 즐겨찾기': 로그인 사용자가 ⭐한 페르소나 + 기능
    const favoritePersonas = React.useMemo(
        () => (isFavoritePersona ? personas.filter(p => isFavoritePersona(p.id)) : []),
        [personas, isFavoritePersona]
    );
    const favoriteFeatures = React.useMemo(
        () => (isFavorite ? FEATURES_GRID.filter(f => isFavorite(f.key)) : []),
        [isFavorite]
    );

    // 'AI 페르소나 랭킹': 세션 수 기준 인기순(서버 /personas/ranking).
    // 로딩 전/실패 시엔 createdAt 최신순으로 폴백.
    const fallbackPersonas = React.useMemo(() => {
        return [...personas]
            .filter(p => p.createdAt)
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 16);
    }, [personas]);
    const [rankedPersonas, setRankedPersonas] = useState<Persona[]>([]);
    const [totalSessions, setTotalSessions] = useState(0);  // 히어로 통계 '누적 대화수' (랭킹 sessionCount 합계)
    useEffect(() => {
        let alive = true;
        personaApi.getRanking(16)
            .then(list => {
                if (!alive) return;
                setRankedPersonas(list);
                setTotalSessions(list.reduce((s, p) => s + ((p as any).sessionCount || 0), 0));
            })
            .catch(() => { /* 폴백 사용 */ });
        return () => { alive = false; };
    }, []);
    const newPersonas = rankedPersonas.length > 0 ? rankedPersonas : fallbackPersonas;

    // ── 통합검색 ────────────────────────────────────────────────
    // 히어로 검색바(searchQuery)와 탭 검색바(featureSearchQuery 포함) 중 입력된 것이 통합 검색어가 된다.
    // 검색 중이면 탭과 무관하게 페르소나·기능을 '둘 다' 필터해서 두 섹션으로 보여준다.
    // 사용자는 무엇이 페르소나인지 기능인지 몰라도 한 번에 검색됨.
    const activeQuery = (searchQuery.trim() || featureSearchQuery.trim());
    const isSearching = activeQuery.length > 0;

    // 탭별 둘러보기(검색 아님)용 필터: 카테고리만 적용
    const browsePersonas = personas
        .filter(p => selectedCategoryId === null || p.categoryId === selectedCategoryId);
    const browseFeatures = FEATURES_GRID
        .filter(f => featureCategory === null || f.category === featureCategory);

    // 통합검색 결과: 카테고리 무시하고 전체에서 검색어로만 매칭(검색은 발견이 목적)
    const q = activeQuery.toLowerCase();
    const searchedPersonas = isSearching
        ? personas.filter(p =>
            p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.jobTitle?.toLowerCase().includes(q))
        : [];
    // 동의어/이름 매칭 결과. 여기서 0개면 아래 useEffect가 AI 의미검색으로 구제 → aiSearchKeys.
    const localFeatureMatches = isSearching ? FEATURES_GRID.filter(f => featureMatches(f, q)) : [];
    const searchedFeatures = !isSearching
        ? []
        : localFeatureMatches.length > 0
            ? localFeatureMatches
            : FEATURES_GRID.filter(f => aiSearchKeys.includes(f.key));   // 동의어 0개 → AI 구제 결과

    // ── 하이브리드 검색 AI 구제 ──────────────────────────────────────
    // 동의어·이름으로 기능/페르소나 모두 0개일 때만 /api/feature-search(Vertex 임베딩)로 한 번 더 찾는다.
    // 350ms debounce로 타이핑 중 과호출 방지. 검색어가 바뀌면 이전 AI 결과는 즉시 비운다.
    const localHitCount = localFeatureMatches.length + searchedPersonas.length;
    React.useEffect(() => {
        if (!isSearching) { setAiSearchKeys([]); return; }
        if (localHitCount > 0) { setAiSearchKeys([]); return; }   // 로컬로 찾았으면 AI 불필요
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                // 각 기능의 검색용 텍스트 = 이름 + 태그 + 설명 + 동의어(의미검색 정확도↑)
                const items = FEATURES_GRID.map(f => ({
                    key: f.key,
                    text: [f.name, f.tag, f.desc, ...(FEATURE_SYNONYMS[f.key] ?? [])].filter(Boolean).join(' '),
                }));
                const res = await fetch('/api/feature-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: activeQuery, items }),
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && Array.isArray(data?.keys)) setAiSearchKeys(data.keys);
            } catch { /* 실패해도 조용히 — 로컬 결과 그대로(0개) */ }
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [activeQuery, isSearching, localHitCount]);

    // 그리드에 실제로 렌더할 목록: 검색 중이면 검색결과, 아니면 둘러보기(카테고리)
    const filtered = isSearching ? searchedPersonas : browsePersonas;
    const filteredFeatures = isSearching ? searchedFeatures : browseFeatures;

    // ── 카드 렌더 함수(탭 그리드·통합검색 결과에서 공용) ──────────────
    const renderFeatureCard = (feat: typeof FEATURES_GRID[number], i: number) => {
        const gold = T.gold;
        const numeral = ROMAN_MPN[i % ROMAN_MPN.length];
        const isFocused = feat.key === focusFeatureKey;
        const subItems = (feat as any).subItems as string[] | undefined;
        const W = 160, H = 280;
        return (
            <div key={feat.key}
                ref={isFocused ? focusFeatureRef : undefined}
                onClick={() => feat.personaName && onFeatureSelect?.(feat.personaName, feat.key)}
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
                {/* 공유 🔗 버튼 (좌상단) — ?f 딥링크 복사/공유 */}
                {onShareFeature && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onShareFeature(feat.key, feat.name); }}
                        title="이 기능 공유하기"
                        style={{
                            position: 'absolute', top: 6, left: 6, zIndex: 5,
                            width: 30, height: 30, borderRadius: '50%', border: 'none',
                            background: 'rgba(255,255,255,0.82)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, lineHeight: 1,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        }}
                    >
                        🔗
                    </button>
                )}
                {/* 즐겨찾기 ⭐ 토글 (우상단) — 즐겨찾기 가능한 기능만 */}
                {onToggleFavorite && (!favoritableKeys || favoritableKeys.includes(feat.key)) && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(feat.key); }}
                        title={isFavorite?.(feat.key) ? '바로가기에서 빼기' : '바로가기에 추가'}
                        style={{
                            position: 'absolute', top: 6, right: 6, zIndex: 5,
                            width: 30, height: 30, borderRadius: '50%', border: 'none',
                            background: 'rgba(255,255,255,0.82)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, lineHeight: 1,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        }}
                    >
                        {isFavorite?.(feat.key) ? '⭐' : '☆'}
                    </button>
                )}
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
    };

    const renderPersonaCard = (persona: Persona, i: number) => {
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
                {/* 즐겨찾기 ⭐ 토글 (우상단) */}
                {onToggleFavoritePersona && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavoritePersona(persona.id); }}
                        title={isFavoritePersona?.(persona.id) ? '내 페르소나에서 빼기' : '내 페르소나에 추가'}
                        style={{
                            position: 'absolute', top: 6, right: 6, zIndex: 6,
                            width: 30, height: 30, borderRadius: '50%', border: 'none',
                            background: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        }}
                    >
                        {isFavoritePersona?.(persona.id) ? '⭐' : '☆'}
                    </button>
                )}
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
    };

    return (
        <div className="mpn-root" ref={rootScrollRef} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: T.bg, overflowY: 'auto',
        }}>
            {/* 모바일 하단 탭바 표시/숨김 + 콘텐츠 하단 여백(탭바에 안 가리게). PC(≥768)에선 탭바 숨김. */}
            <style>{`
                .mpn-tabbar { display: flex; }
                .mpn-root { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
                @media (min-width: 768px) {
                    .mpn-tabbar { display: none !important; }
                    .mpn-root { padding-bottom: 0; }
                }
            `}</style>
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
                            ...(user ? [{ label: '⭐ 즐겨찾기', onClick: () => { setShowFavorites(true); setMobileMenuOpen(false); } }] : []),
                            ...(user ? [{ label: '💎 충전하기', onClick: onChargeClick }] : []),
                            ...(user ? [{ label: '👤 내 정보', onClick: onProfileClick }] : []),
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

                        {/* 로그인/로그아웃 토글 — 햄버거 하단 고정 */}
                        {user ? (
                            <button onClick={() => { setMobileMenuOpen(false); onLogout(); }} style={{
                                marginTop: 'auto', padding: '13px 20px', background: 'none', border: 'none',
                                textAlign: 'left', fontSize: 14, color: '#C0505A', cursor: 'pointer',
                                borderTop: `1px solid ${T.lineSoft}`,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <LogOut size={15} /> 로그아웃
                            </button>
                        ) : (
                            <button onClick={() => { setMobileMenuOpen(false); onLoginClick?.(); }} style={{
                                marginTop: 'auto', padding: '13px 20px', background: 'none', border: 'none',
                                textAlign: 'left', fontSize: 14, fontWeight: 600, color: T.accent, cursor: 'pointer',
                                borderTop: `1px solid ${T.lineSoft}`,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <UserCircle size={15} /> 로그인
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ⭐ 즐겨찾기 모달 — 메뉴에서 진입. 첫 화면 인라인 섹션을 대체. */}
            {showFavorites && (
                <>
                    <div onClick={() => setShowFavorites(false)} style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        background: 'rgba(45,36,56,0.4)', backdropFilter: 'blur(3px)',
                    }} />
                    <div style={{
                        position: 'fixed', zIndex: 101, left: '50%', top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 'min(420px, calc(100vw - 32px))', maxHeight: '70vh', overflowY: 'auto',
                        background: 'rgba(251,248,243,0.98)', borderRadius: 20,
                        boxShadow: '0 16px 48px -12px rgba(60,40,80,0.4)', padding: 22,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>⭐ 나의 즐겨찾기</div>
                            <button onClick={() => setShowFavorites(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                <X size={20} color={T.inkMute} />
                            </button>
                        </div>
                        {favoritePersonas.length === 0 && favoriteFeatures.length === 0 ? (
                            <div style={{ fontSize: 13, color: T.inkMute, textAlign: 'center', padding: '28px 0' }}>
                                아직 즐겨찾기한 항목이 없어요.<br />페르소나·기능 카드의 ☆를 눌러 담아보세요.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {/* 즐겨찾기 페르소나 — 가로 캐러셀(드래그/스와이프) */}
                                {favoritePersonas.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMute, marginBottom: 8 }}>페르소나</div>
                                        <Carousel>
                                            {favoritePersonas.map(p => (
                                                <button key={`fp-${p.id}`} onClick={() => { setShowFavorites(false); onSelect(p.id); }} style={{
                                                    flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                                    background: 'none', border: 'none', cursor: 'pointer', width: 64,
                                                }}>
                                                    <div style={{
                                                        width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
                                                        border: `2px solid ${T.gold}`, background: T.lineSoft,
                                                    }}>
                                                        {p.imageUrl
                                                            ? <img src={p.imageUrl} alt={p.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: T.inkMute }}>{p.name[0]}</div>}
                                                    </div>
                                                    <span style={{ fontSize: 10.5, color: T.inkSoft, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                                </button>
                                            ))}
                                        </Carousel>
                                    </div>
                                )}
                                {/* 즐겨찾기 기능 — 가로 캐러셀(드래그/스와이프) */}
                                {favoriteFeatures.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: T.inkMute, marginBottom: 8 }}>기능</div>
                                        <Carousel>
                                            {favoriteFeatures.map(f => (
                                                <button key={`ff-${f.key}`} onClick={() => { setShowFavorites(false); onFeatureSelect?.(f.personaName, f.key); }} style={{
                                                    flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                                    background: 'none', border: 'none', cursor: 'pointer', width: 64,
                                                }}>
                                                    <div style={{
                                                        width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        border: `2px solid ${f.palette.deep}`, background: f.palette.bg,
                                                    }}>
                                                        <MpnFeatureIcon kind={f.icon} size={30} color={f.palette.accent} bg={f.palette.bg} />
                                                    </div>
                                                    <span style={{ fontSize: 10.5, color: T.inkSoft, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                </button>
                                            ))}
                                        </Carousel>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ⬆ 상단 로고 바 — 로고+햄버거만 sticky 고정. 그 아래 콘텐츠는 전체 스크롤. */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 30,
                padding: '13px max(28px, calc((100% - 960px) / 2))',
                background: 'rgba(251,248,243,0.85)',
                backdropFilter: 'blur(10px)',
            }}>
                <div style={{ textAlign: 'left', position: 'relative' }}>
                    <button onClick={() => onGoHome?.()} title="첫 화면으로" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, display: 'inline-block',
                    }}>
                        <span style={{
                            fontFamily: "'Cinzel', serif", fontSize: 13,
                            fontWeight: 700, letterSpacing: '0.35em',
                            color: T.gold, opacity: 1,
                        }}>✦ AI PERSONAS</span>
                    </button>
                    {/* 즐겨찾기 ⭐ — 햄버거 왼쪽. 회원은 즐겨찾기 모달, 비회원은 로그인 유도 */}
                    <button
                        onClick={() => { if (user) setShowFavorites(true); else onLoginClick?.(); }}
                        aria-label="즐겨찾기"
                        title="즐겨찾기"
                        style={{
                            position: 'absolute', top: '50%', right: 38, transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center',
                            fontSize: 18, lineHeight: 1,
                        }}
                    >
                        ⭐
                    </button>
                    {/* 메뉴 햄버거 — 로고 바 우측 고정 (로그인/로그아웃은 햄버거 안으로) */}
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="메뉴 열기"
                        style={{
                            position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 6, borderRadius: 8, display: 'flex',
                        }}
                    >
                        <Menu size={22} color={T.ink} />
                    </button>
                </div>
            </div>

            {/* 헤더 콘텐츠 — 개인화 인사 + 지금주목 등 섹션(이제 전체와 함께 스크롤) */}
            <div style={{
                padding: '13px max(28px, calc((100% - 960px) / 2)) 0px',
                position: 'relative',
            }}>
                {/* 제목 영역만 가운데 정렬(검색·칩·목록은 왼쪽 유지) */}
                <div style={{ textAlign: 'center' }}>

                {/* ② 개인화 인사 — 로그인 사용자 + personas 탭에서만 */}
                {user && tab === 'personas' && (
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, color: T.inkSoft }}>
                            <span style={{ color: T.accent, fontWeight: 700 }}>{user.username || user.email.split('@')[0]}</span>님, 다시 만나 반가워요 ✦
                        </span>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, color: '#B89232',
                            background: '#FFF3D6', border: '1px solid #E8C56A',
                            borderRadius: 999, padding: '2px 10px',
                        }}>
                            <span style={{ fontSize: 13 }}>✦</span> {totalPoints.toLocaleString()}P
                        </span>
                    </div>
                )}
                </div>
                {/* ↑ 제목 영역 가운데 정렬 끝. 아래(최근대화·검색·칩·목록)는 왼쪽 정렬 */}

                {/* 히어로 배너 — 그라데이션+검색+실제 통계(2026-06-26 omd 시안 부분채택) */}
                <HeroBanner
                    personaCount={personas.length}
                    featureCount={FEATURES_GRID.length}
                    totalSessions={totalSessions}
                    searchQuery={searchQuery}
                    onSearchChange={onSearchChange}
                    onSwitchToPersonas={() => setTab('personas')}
                />

                {/* ★ 통합 메인 상단 섹션: 지금 주목 → 나의 즐겨찾기 (검색/탭 위 공통 노출) */}
                {/* 지금 주목 — 신규·이벤트 기능 가로 캐러셀. 검색 중이면 숨김(검색 결과 가림 방지) */}
                {!isSearching && spotlightFeatures.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                        <SectionTitle>✨ 오늘의 추천</SectionTitle>
                        {/* 캐러셀: 큐레이션 4개+라 모바일에선 3개 보이고 나머지는 드래그/스와이프로. */}
                        <Carousel>
                            {spotlightFeatures.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => onFeatureSelect?.(f.personaName, f.key)}
                                    style={{
                                        flex: '0 0 44%', maxWidth: 200, textAlign: 'left',
                                        border: `1px solid ${f.palette.deep}55`, borderRadius: 16,
                                        background: `linear-gradient(150deg, ${f.palette.bg} 0%, #FFFFFF 100%)`,
                                        padding: '14px 13px', cursor: 'pointer', position: 'relative',
                                        boxShadow: '0 4px 14px -8px rgba(60,40,80,0.35)',
                                    }}
                                >
                                    {f.badge && (
                                        <span style={{
                                            position: 'absolute', top: 8, right: 8, fontSize: 8.5, fontWeight: 800,
                                            color: '#fff', background: f.palette.accent, borderRadius: 999, padding: '2px 6px',
                                            maxWidth: 'calc(100% - 16px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{f.badge}</span>
                                    )}
                                    {/* 즐겨찾기 ⭐ 토글 (우하단 — 상단 배지와 분리) */}
                                    {onToggleFavorite && (!favoritableKeys || favoritableKeys.includes(f.key)) && (
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(f.key); }}
                                            title={isFavorite?.(f.key) ? '바로가기에서 빼기' : '바로가기에 추가'}
                                            style={{
                                                position: 'absolute', bottom: 6, right: 6, zIndex: 5,
                                                width: 26, height: 26, borderRadius: '50%',
                                                background: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 14, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                            }}
                                        >{isFavorite?.(f.key) ? '⭐' : '☆'}</span>
                                    )}
                                    <div style={{ marginBottom: 8 }}><MpnFeatureIcon kind={f.icon} size={32} color={f.palette.accent} bg={f.palette.bg} /></div>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                    <div style={{ fontSize: 10, color: T.inkMute, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.personaName}</div>
                                </button>
                            ))}
                        </Carousel>
                    </div>
                )}

                {/* 새로 나온 기능 — 지정 3개 제외, id 최신순 캐러셀. 고정폭(140)+가로스크롤(PC 포함).
                    새 기능 추가 시 자동으로 맨 앞에 노출. 특별 배지 없이 깔끔하게. */}
                {!isSearching && newFeatures.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                        <SectionTitle>🎁 새로운 기능</SectionTitle>
                        <Carousel>
                            {newFeatures.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => onFeatureSelect?.(f.personaName, f.key)}
                                    style={{
                                        flex: '0 0 44%', maxWidth: 200, textAlign: 'left',
                                        border: `1px solid ${f.palette.deep}55`, borderRadius: 16,
                                        background: `linear-gradient(150deg, ${f.palette.bg} 0%, #FFFFFF 100%)`,
                                        padding: '14px 13px', cursor: 'pointer', position: 'relative',
                                        boxShadow: '0 4px 14px -8px rgba(60,40,80,0.3)',
                                    }}
                                >
                                    {/* 즐겨찾기 ⭐ 토글 (우하단 — 추천 카드와 통일) */}
                                    {onToggleFavorite && (!favoritableKeys || favoritableKeys.includes(f.key)) && (
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(f.key); }}
                                            title={isFavorite?.(f.key) ? '바로가기에서 빼기' : '바로가기에 추가'}
                                            style={{
                                                position: 'absolute', bottom: 6, right: 6, zIndex: 5,
                                                width: 26, height: 26, borderRadius: '50%',
                                                background: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 14, lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                            }}
                                        >{isFavorite?.(f.key) ? '⭐' : '☆'}</span>
                                    )}
                                    <div style={{ marginBottom: 8 }}><MpnFeatureIcon kind={f.icon} size={32} color={f.palette.accent} bg={f.palette.bg} /></div>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                    <div style={{ fontSize: 10, color: T.inkMute, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.personaName}</div>
                                </button>
                            ))}
                        </Carousel>
                    </div>
                )}

                {/* 나의 즐겨찾기는 첫 화면에서 제거 → 우측 메뉴 '⭐ 즐겨찾기'(showFavorites 모달)로 이동.
                    첫 화면은 모두에게 동일한 콘텐츠(최근대화·지금주목·인기신규)로 일관 유지(PC 헐렁함 해소). */}

                {/* '이어서 대화' 섹션 제거(2026-06-24): 정보 과부하 해소 + 채팅 헤더 '최근 페르소나' 칩이
                    복귀 동선 대체. 첫 화면 상단 = 오늘의 추천 → 새로운 기능 → AI 페르소나 랭킹 3단. */}

                {/* AI 페르소나 랭킹 — 세션 수 인기순(서버 /ranking). 상위 6명 세로 리스트 + 역할 배지·대화수. 검색 중이면 숨김 */}
                {!isSearching && newPersonas.length > 0 && (
                    <div id="mpn-ranking" style={{ marginBottom: 18 }}>
                        <SectionTitle>🏆 AI 페르소나 랭킹</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 9 }}>
                            {newPersonas.slice(0, 6).map((p, i) => {
                                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                                const role = p.category?.name || p.jobTitle;
                                const cnt = (p as any).sessionCount as number | undefined;
                                return (
                                <button key={`rk-${p.id}`} onClick={() => onSelect(p.id)} style={{
                                    display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
                                    background: T.panel, border: `1px solid ${T.line}`, borderRadius: 15,
                                    padding: '10px 12px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 22px -10px rgba(106,75,147,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                                >
                                    {/* 순위 */}
                                    <span style={{ flexShrink: 0, width: 18, textAlign: 'center', fontWeight: 800, fontSize: medal ? 16 : 15, color: medal ? undefined : T.inkMute }}>{medal ?? (i + 1)}</span>
                                    {/* 아바타 */}
                                    <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${i < 3 ? T.gold : `${T.accent}33`}`, background: T.lineSoft }}>
                                        {p.imageUrl
                                            ? <img src={p.imageUrl} alt={p.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: T.inkMute }}>{p.name[0]}</div>}
                                    </div>
                                    {/* 정보 */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                            <span style={{ fontWeight: 700, fontSize: 14, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                            {role && (
                                                <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: T.accent, background: `${T.accent}14`, padding: '2px 6px', borderRadius: 6 }}>{role}</span>
                                            )}
                                        </div>
                                        {p.jobTitle && p.jobTitle !== role && (
                                            <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.jobTitle}</div>
                                        )}
                                    </div>
                                    {/* 대화수 */}
                                    {cnt != null && cnt > 0 && (
                                        <span style={{ flexShrink: 0, fontSize: 11.5, color: T.inkMute, fontWeight: 600 }}>{formatCount(cnt)} 대화</span>
                                    )}
                                </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* CTA 충전 배너 — 실제 보너스 문구(최대 20%). 로그인=충전, 비로그인=로그인 유도. 검색 중이면 숨김 */}
                {!isSearching && (
                <div style={{
                    margin: '4px 0 18px', borderRadius: 22,
                    background: 'linear-gradient(120deg, #F1ECFA, #FBF2F8)',
                    border: `1px solid ${T.accent}33`, padding: '18px 18px',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                }}>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <div style={{ fontSize: 'clamp(15px, 4.4vw, 18px)', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4, wordBreak: 'keep-all' }}>💎 충전하고 최대 20% 보너스</div>
                        <div style={{ fontSize: 12.5, color: T.inkSoft, wordBreak: 'keep-all' }}>5만원 충전 시 60,000P · 1만원 충전 시 11,000P — 모든 기능을 더 넉넉하게.</div>
                    </div>
                    <button
                        onClick={() => { if (user) onChargeClick?.(); else onLoginClick?.(); }}
                        style={{
                            flex: '1 1 100%', textAlign: 'center', background: T.accent, color: '#fff',
                            fontWeight: 700, fontSize: 14.5, padding: '13px 22px', borderRadius: 13, border: 'none',
                            cursor: 'pointer', boxShadow: '0 6px 16px rgba(142,111,183,0.35)',
                        }}
                    >포인트 충전하기</button>
                </div>
                )}

                {/* ③-2 최근 사용 기능 줄 — 기능 탭에서만. 최근 사용 없으면 즐겨찾기한 기능으로 대체 */}
                {user && tab === 'features' && (() => {
                    let label = '최근 사용';
                    let recentFeats = recentFeatureKeys
                        .map(k => FEATURES_GRID.find(f => f.key === k))
                        .filter((f): f is typeof FEATURES_GRID[number] => !!f);
                    // 최근 사용이 비면 즐겨찾기(⭐)한 기능으로 폴백
                    if (!recentFeats.length && isFavorite) {
                        recentFeats = FEATURES_GRID.filter(f => isFavorite(f.key));
                        label = '즐겨찾는 기능';
                    }
                    if (!recentFeats.length) return null;
                    return (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: T.inkMute, marginBottom: 8, letterSpacing: '0.05em' }}>{label}</div>
                            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                {recentFeats.map(f => (
                                    <button key={f.key} onClick={() => f.personaName && onFeatureSelect?.(f.personaName, f.key)} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        flexShrink: 0, cursor: 'pointer',
                                        padding: '6px 12px', borderRadius: 999,
                                        background: 'rgba(255,255,255,0.85)', border: `1px solid ${T.lineSoft}`,
                                        transition: 'border-color 0.15s, box-shadow 0.15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.palette.accent}77`; e.currentTarget.style.boxShadow = `0 4px 14px -6px ${f.palette.accent}66`; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.lineSoft; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${f.palette.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: f.palette.accent, fontWeight: 700 }}>{f.name.charAt(0)}</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{f.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })()}

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

                {/* 카테고리 - 기능 탭, 검색창 아래 별도 행 */}
                {tab === 'features' && (
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 14,
                    }}>
                        <button onClick={() => setFeatureCategory(null)} style={{
                            padding: '5px 12px', borderRadius: 999, fontSize: 12,
                            fontWeight: 600, cursor: 'pointer',
                            background: featureCategory === null ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})` : 'rgba(255,255,255,0.7)',
                            color: featureCategory === null ? '#fff' : T.inkSoft,
                            boxShadow: featureCategory === null ? `0 4px 12px -4px rgba(142,111,183,0.4)` : 'none',
                            border: featureCategory === null ? 'none' : `1px solid ${T.line}`,
                            whiteSpace: 'nowrap', transition: 'all 0.15s',
                        } as React.CSSProperties}>전체</button>
                        {FEATURE_CATEGORIES.map(cat => (
                            <button key={cat.key} onClick={() => setFeatureCategory(cat.key)} style={{
                                padding: '5px 12px', borderRadius: 999, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer',
                                background: featureCategory === cat.key ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})` : 'rgba(255,255,255,0.7)',
                                color: featureCategory === cat.key ? '#fff' : T.inkSoft,
                                boxShadow: featureCategory === cat.key ? `0 4px 12px -4px rgba(142,111,183,0.4)` : 'none',
                                border: featureCategory === cat.key ? 'none' : `1px solid ${T.line}`,
                                whiteSpace: 'nowrap', transition: 'all 0.15s',
                            } as React.CSSProperties}>{cat.label}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 통합검색 결과 — 검색 중이면 페르소나·기능을 두 섹션으로 함께 보여준다 ── */}
            {isSearching && (
                <div style={{ padding: '8px max(28px, calc((100% - 960px) / 2)) 24px' }}>
                    {searchedPersonas.length === 0 && searchedFeatures.length === 0 && (
                        <div style={{ textAlign: 'center', color: T.inkMute, paddingTop: 40, fontSize: 14 }}>
                            '{activeQuery}' 검색 결과가 없습니다
                        </div>
                    )}

                    {/* 🧑 페르소나 섹션 */}
                    {searchedPersonas.length > 0 && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 2px 12px' }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>🧑 페르소나</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{searchedPersonas.length}</span>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                gap: 16, alignContent: 'start', marginBottom: 28,
                            }}>
                                {searchedPersonas.map((persona, i) => renderPersonaCard(persona, i))}
                            </div>
                        </>
                    )}

                    {/* ⚡ 기능 섹션 */}
                    {searchedFeatures.length > 0 && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 2px 12px' }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>⚡ 기능</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#3a9e6e' }}>{searchedFeatures.length}</span>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                gap: 16, alignContent: 'start',
                            }}>
                                {searchedFeatures.map((feat, i) => renderFeatureCard(feat, i))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 기능 그리드 - 타로카드 스타일 (검색 중 아닐 때만, 탭 둘러보기) */}
            {!isSearching && tab === 'features' && (
                <div style={{
                    padding: '14px max(28px, calc((100% - 960px) / 2)) 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 16,
                    alignContent: 'start',
                }}>
                    {filteredFeatures.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.inkMute, paddingTop: 40, fontSize: 14 }}>
                            해당 카테고리에 기능이 없습니다
                        </div>
                    )}
                    {filteredFeatures.map((feat, i) => renderFeatureCard(feat, i))}
                </div>
            )}

            {/* 페르소나 그리드 (검색 중 아닐 때만, 탭 둘러보기) */}
            {!isSearching && tab === 'personas' && <div style={{
                padding: '14px max(28px, calc((100% - 960px) / 2)) 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 16,
                alignContent: 'start',
            }}>
                {filtered.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.inkMute, paddingTop: 40, fontSize: 14 }}>
                        해당 카테고리에 페르소나가 없습니다
                    </div>
                )}
                {filtered.map((persona, i) => renderPersonaCard(persona, i))}
            </div>}

            {/* ── 사업자 정보 푸터 (탭 무관 항상 노출) ── */}
            <footer style={{
                borderTop: `1px solid ${T.lineSoft}`,
                padding: '28px max(24px, calc((100% - 960px) / 2))',
                textAlign: 'center',
                marginTop: 8,
            }}>
                <div style={{
                    fontFamily: "'Cinzel', serif", fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.3em', color: T.gold, marginBottom: 14,
                }}>
                    ✦ AI PERSONAS
                </div>
                <div style={{
                    display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
                    gap: '6px 16px', fontSize: 11, color: T.inkMute, lineHeight: 1.8,
                    maxWidth: 620, margin: '0 auto',
                }}>
                    <span>상호명: 입소문</span>
                    <span style={{ color: T.lineSoft }}>|</span>
                    <span>대표자: 신지윤</span>
                    <span style={{ color: T.lineSoft }}>|</span>
                    <span>사업자등록번호: 656-08-03261</span>
                    <span style={{ color: T.lineSoft }}>|</span>
                    <span>통신판매업 신고번호: 제 2026-충북청주-0690호</span>
                    <span style={{ color: T.lineSoft }}>|</span>
                    <span>주소: 충북 청주 흥덕 옥산 오송가락로 1056 청주리버파크자이 104-1303</span>
                    <span style={{ color: T.lineSoft }}>|</span>
                    <span>전화: 0502-468-0502</span>
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 20 }}>
                    <button onClick={() => setTermsModal('terms')} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
                        color: T.inkMute, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
                    }}>이용약관</button>
                    <button onClick={() => setTermsModal('privacy')} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
                        color: T.accent, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
                    }}>개인정보처리방침</button>
                </div>
                <div style={{ marginTop: 12, fontSize: 10, color: T.inkMute, opacity: 0.6, letterSpacing: '0.1em' }}>
                    © 2026 입소문. All rights reserved.
                </div>
            </footer>

            {/* 약관 모달 */}
            {termsModal && (
                <TermsModal initialTab={termsModal} onClose={() => setTermsModal(null)} />
            )}

            {/* 모바일 하단 탭바 — 빠른 이동(전체 메뉴는 햄버거). PC에선 위 <style>로 숨김. */}
            <BottomTabBar
                onHome={() => onGoHome?.()}
                onFeatures={() => { setTab('features'); rootScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onChat={() => { setTab('personas'); rootScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onRanking={() => document.getElementById('mpn-ranking')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                onMe={() => { if (user) onProfileClick?.(); else onLoginClick?.(); }}
            />
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
    onLoginClick,
    onChargeClick,
    categories = [],
    onGoHome,
    onFeatureSelect,
    initialTab = 'personas',
    initialFocusPersonaId = null,
    initialFocusFeatureKey = null,
    recentPersonas = [],
    recentFeatureKeys = [],
    isFavorite,
    onToggleFavorite,
    favoritableKeys,
    isFavoritePersona,
    onToggleFavoritePersona,
    onShareFeature,
    heroCards = [],
    spotlightOrder,
    newFeaturesOrder,
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
                onFeatureSelect={onFeatureSelect ?? handleFeatureSelect}
                initialTab={initialTab}
                focusPersonaId={initialFocusPersonaId}
                focusFeatureKey={initialFocusFeatureKey}
                onGoHome={onGoHome}
                onAdminClick={onAdminClick}
                onAnnouncementClick={onAnnouncementClick}
                unreadAnnouncementCount={unreadAnnouncementCount}
                onProfileClick={onProfileClick}
                onLoginClick={onLoginClick}
                onChargeClick={onChargeClick}
                onPartnerBoardClick={onPartnerBoardClick}
                recentPersonas={recentPersonas}
                recentFeatureKeys={recentFeatureKeys}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
                favoritableKeys={favoritableKeys}
                isFavoritePersona={isFavoritePersona}
                onToggleFavoritePersona={onToggleFavoritePersona}
                onShareFeature={onShareFeature}
                heroCards={heroCards}
                spotlightOrder={spotlightOrder}
                newFeaturesOrder={newFeaturesOrder}
            />
        </div>
    );
};

export default MainPageNew;
