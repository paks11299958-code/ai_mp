/**
 * LandingPageNew.tsx
 * 뉴페이지 - 타로카드 스타일 히어로 랜딩
 * 디자인 레퍼런스: AI Persona Hero.html (Anthropic Design)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, Users, Sparkles } from 'lucide-react';
import { Persona, Category } from '../types';
import { TermsModal } from './TermsModal';

// 나의 AI 기능 썸네일 이모지(기능은 사진이 없어 아이콘 썸네일로)
const FEATURE_EMOJI: Record<string, string> = {
    news: '📰', stock: '📈', hotkeyword: '🛍️', used: '🏷️',
    luxury: '💎', mathtutor: '🧮', club: '🤝',
};

// ─────────────────────────────────────────────
// 디자인 토큰
// ─────────────────────────────────────────────
const T = {
    bg:        '#FBF8F3',
    bgTint:    '#F5EEF6',
    ink:       '#2D2438',
    inkSoft:   '#6B5F7A',
    inkMute:   '#9089A1',
    line:      '#EAE2D3',
    lineSoft:  '#F0E9DE',
    gold:      '#B58F4A',
    goldSoft:  '#D9C28F',
    accent:    '#8E6FB7',
    accent2:   '#E48BB0',
    panel:     '#FFFFFF',
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface LandingPageNewProps {
    personas: Persona[];
    isLoading: boolean;
    onStart: () => void;
    onLoginClick?: () => void;
    onPersonaClick?: (personaId: string) => void;
    onAnnouncementClick?: () => void;
    unreadAnnouncementCount?: number;
    onPartnerBoardClick?: () => void;
    heroImageUrl?: string;
    categories?: Category[];
    // 기능 카드 클릭 핸들러
    onFeatureClick?: (featureKey: string) => void;
    // 로그인 상태 전달 (로그인 후 히어로 페이지 표시 시)
    user?: { username?: string; email: string; role?: string } | null;
    onGoToChat?: () => void;
    onLogout?: () => void;
    onAdminClick?: () => void;
    onPersonaListClick?: () => void;
    onFeatureListClick?: () => void;
    onProfileClick?: () => void;
    // 재방문 바로진입: 마지막 대화 페르소나 이름 + "이어서 대화" 핸들러 (있을 때만 배너 표시)
    continuePersonaName?: string;
    onContinueChat?: () => void;
    // 즐겨찾기(자주가는 메뉴) 칩 — 담은 게 있을 때만 표시
    favoriteChips?: { key: string; label: string; icon: string; color: string; bgColor: string; borderColor: string; onClick: () => void }[];
    // 나의 AI 페르소나 칩 (최근 대화 페르소나, 썸네일+강조)
    personaChips?: { id: string; name: string; imageUrl?: string; highlight?: boolean; onClick: () => void }[];
}

// ─────────────────────────────────────────────
// Feature 데이터 (실제 앱 기능 10개)
// ─────────────────────────────────────────────
const FEATURES = [
    {
        id: 2, numeral: 'II', latin: 'News',
        name: '오늘 뉴스', tag: 'AI 뉴스 브리핑',
        desc: '국내·해외·경제 등 9개 카테고리 뉴스를 AI가 핵심만 골라 매일 아침 요약해드려요.',
        palette: { bg: '#E8EEF7', deep: '#9AAFCB', accent: '#5C7BA8' },
        icon: 'newspaper', key: 'news',
    },
    {
        id: 3, numeral: 'III', latin: 'Stock',
        name: '주식 분석', tag: 'AI 투자 리포트',
        desc: '종목명만 입력하면 Gemini·Claude·GPT 3중 AI가 재무·차트·뉴스를 종합해 투자 리포트를 드려요.',
        palette: { bg: '#E0EFE3', deep: '#9CC4A7', accent: '#5E9070' },
        icon: 'chart', key: 'stock',
    },
    {
        id: 4, numeral: 'IV', latin: 'Swing',
        name: '스윙 분석', tag: '골프 AI 코치',
        desc: '스윙 영상을 올리면 AI가 5개 항목을 분석해 개선점을 제안해요. 나만의 AI 골프 코치.',
        palette: { bg: '#FCEADD', deep: '#E2B89A', accent: '#C68760' },
        icon: 'golf', key: 'swing',
    },
    {
        id: 5, numeral: 'V', latin: 'Luxury',
        name: '명품 감정', tag: '진품 여부 판별',
        desc: '사진만 올리면 AI가 브랜드·진위 여부를 분석해 감정 리포트를 드려요.',
        palette: { bg: '#EEE5DA', deep: '#C8AE93', accent: '#8E6F50' },
        icon: 'shield', key: 'luxury',
    },
    {
        id: 7, numeral: 'VII', latin: 'Resell',
        name: '중고판매 분석', tag: '최적 판매가 추천',
        desc: '팔려는 물건 사진을 올리면 AI가 적정 가격과 판매 전략을 알려드려요.',
        palette: { bg: '#FFF3D6', deep: '#E8C56A', accent: '#B89232' },
        icon: 'shopping', key: 'used',
    },
    {
        id: 8, numeral: 'VIII', latin: 'Trend',
        name: '핫쇼핑 키워드', tag: '트렌드 쇼핑 정보',
        desc: '지금 가장 뜨는 쇼핑 키워드와 트렌드를 카테고리별로 정리해드려요.',
        palette: { bg: '#FAE3EA', deep: '#E8A8BC', accent: '#C76A8A' },
        icon: 'sparkles', key: 'hotkeyword',
    },
    {
        id: 9, numeral: 'IX', latin: 'Math',
        name: '수학 튜터', tag: 'AI 수학 선생님',
        desc: '문제 사진을 찍으면 AI가 단계별로 풀이를 설명해드려요. 초·중·고 모든 수준 지원.',
        palette: { bg: '#E5E1F2', deep: '#A99DCC', accent: '#6E5DA3' },
        icon: 'book', key: 'mathtutor',
    },
    {
        id: 10, numeral: 'X', latin: 'Club',
        name: '모임 출석', tag: '그룹 출석 체크',
        desc: 'QR코드로 모임 출석을 간편하게 관리해요. 리더와 멤버 모두 편리하게.',
        palette: { bg: '#E4ECEE', deep: '#9DB6BC', accent: '#5E7E86' },
        icon: 'people', key: 'club',
    },
    {
        id: 11, numeral: 'XI', latin: 'Fortune',
        name: '시운의 흐름', tag: '운세 · 토정비결',
        desc: '오늘·이달·올해의 시운을 도결 선생이 명부를 펼쳐 읽어드려요.',
        palette: { bg: '#EEE5F8', deep: '#B8A0D8', accent: '#6B4FA0' },
        icon: 'fortune', key: 'siwoon',
    },
    {
        id: 12, numeral: 'XII', latin: 'Wealth',
        name: '성취와 재물', tag: '재물 · 사업 운세',
        desc: '재물이 차오를 때인지, 성을 쌓고 지켜야 할 때인지 명부로 살펴드려요.',
        palette: { bg: '#FDF6E0', deep: '#E8C86A', accent: '#A07828' },
        icon: 'coin', key: 'wealth',
    },
    {
        id: 13, numeral: 'XIII', latin: 'Love',
        name: '인연의 결', tag: '연애 · 궁합 운세',
        desc: '스쳐 가는 인연인지, 머무를 인연인지 도결 선생이 살펴드려요.',
        palette: { bg: '#FDE8F0', deep: '#E8A0BC', accent: '#B84070' },
        icon: 'heart', key: 'yeonn',
    },
    {
        id: 14, numeral: 'XIV', latin: 'Dream',
        name: '꿈해몽', tag: 'AI 꿈 풀이',
        desc: '어젯밤 꾼 꿈을 들려주시면 도결 선생이 그 뜻을 풀어드려요.',
        palette: { bg: '#E8E4F5', deep: '#A898D0', accent: '#5848A0' },
        icon: 'moon', key: 'dream',
    },
    {
        id: 15, numeral: 'XV', latin: 'Gwansang',
        name: '관상학', tag: 'AI 관상 분석',
        desc: '얼굴 사진 한 장으로 도결 선생이 관상과 성격·운세를 풀어드려요.',
        palette: { bg: '#F0EAE0', deep: '#C8B098', accent: '#886040' },
        icon: 'gwansang', key: 'gwansang',
    },
];

// 페르소나 팔레트 순환 (실제 DB 페르소나에 적용)
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

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

// ─────────────────────────────────────────────
// 별빛 배경 컴포넌트
// ─────────────────────────────────────────────
const StarField: React.FC = () => {
    const stars = [
        { x: '8%',  y: '22%', s: 1.6, o: 0.35, d: '0s'   },
        { x: '19%', y: '61%', s: 1.2, o: 0.25, d: '0.8s' },
        { x: '31%', y: '14%', s: 2.0, o: 0.40, d: '1.4s' },
        { x: '45%', y: '78%', s: 1.4, o: 0.30, d: '0.3s' },
        { x: '57%', y: '35%', s: 1.8, o: 0.35, d: '1.9s' },
        { x: '68%', y: '88%', s: 1.2, o: 0.22, d: '0.6s' },
        { x: '76%', y: '18%', s: 2.2, o: 0.45, d: '1.1s' },
        { x: '85%', y: '55%', s: 1.6, o: 0.30, d: '2.2s' },
        { x: '93%', y: '32%', s: 1.4, o: 0.28, d: '0.4s' },
        { x: '3%',  y: '72%', s: 1.8, o: 0.32, d: '1.7s' },
    ];
    return (
        <>
            {stars.map((st, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    left: st.x, top: st.y,
                    width: st.s, height: st.s,
                    borderRadius: '50%',
                    background: i % 3 === 0 ? T.goldSoft : i % 3 === 1 ? T.accent : '#fff',
                    opacity: st.o,
                    animation: `lp-star-twinkle 3s ease-in-out ${st.d} infinite`,
                    pointerEvents: 'none',
                }} />
            ))}
        </>
    );
};

// ─────────────────────────────────────────────
// 골드 코너 장식 SVG
// ─────────────────────────────────────────────
const CornerOrnament: React.FC<{ rotate?: number }> = ({ rotate = 0 }) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
        style={{ transform: `rotate(${rotate}deg)` }}>
        <path d="M0 0 L4 7 M0 0 L-4 7 M0 0 L7 0 M0 0 L0 7"
            stroke={T.gold} strokeWidth="0.9" opacity="0.8"
            transform="translate(9,9)" />
        <circle cx="9" cy="9" r="1.6" fill={T.gold} />
        <path d="M3 15 Q9 18 15 15" stroke={T.gold} strokeWidth="0.8" fill="none" opacity="0.6" />
    </svg>
);

// ─────────────────────────────────────────────
// Feature 아이콘 SVG
// ─────────────────────────────────────────────
const FeatureIcon: React.FC<{ kind: string; size?: number; color?: string; bg?: string }> = ({
    kind, size = 80, color = '#8E6FB7', bg = '#F5E6F7',
}) => {
    const c = color;
    const a = bg;
    switch (kind) {
        case 'chat':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M18 22 Q18 16 24 16 L72 16 Q78 16 78 22 L78 58 Q78 64 72 64 L54 64 L44 78 L34 64 L24 64 Q18 64 18 58 Z" fill={c} opacity="0.9" />
                    <circle cx="36" cy="40" r="4" fill={a} />
                    <circle cx="48" cy="40" r="4" fill={a} />
                    <circle cx="60" cy="40" r="4" fill={a} />
                </svg>
            );
        case 'newspaper':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <rect x="14" y="18" width="54" height="62" rx="5" fill={c} opacity="0.9" />
                    <rect x="68" y="26" width="14" height="46" rx="3" fill={c} opacity="0.55" />
                    <rect x="22" y="28" width="24" height="18" rx="3" fill={a} opacity="0.7" />
                    <line x1="22" y1="54" x2="60" y2="54" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="22" y1="62" x2="52" y2="62" stroke={a} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
                    <line x1="22" y1="70" x2="46" y2="70" stroke={a} strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
                </svg>
            );
        case 'chart':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <rect x="14" y="64" width="14" height="18" rx="3" fill={c} opacity="0.5" />
                    <rect x="34" y="48" width="14" height="34" rx="3" fill={c} opacity="0.7" />
                    <rect x="54" y="30" width="14" height="52" rx="3" fill={c} opacity="0.9" />
                    <path d="M14 62 Q34 40 54 28 L68 20" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <circle cx="68" cy="20" r="4" fill={c} />
                    <line x1="14" y1="82" x2="82" y2="82" stroke={c} strokeWidth="2" opacity="0.3" />
                </svg>
            );
        case 'golf':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <line x1="48" y1="20" x2="48" y2="80" stroke={c} strokeWidth="3" strokeLinecap="round" />
                    <path d="M48 20 Q62 28 60 38 Q58 46 48 44 Z" fill={c} opacity="0.9" />
                    <ellipse cx="48" cy="82" rx="16" ry="4" fill={c} opacity="0.25" />
                    <path d="M28 55 Q36 48 48 52 Q60 56 68 46" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
                </svg>
            );
        case 'shield':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M48 14 L74 24 V46 Q74 68 48 78 Q22 68 22 46 V24 Z" fill={c} opacity="0.9" />
                    <path d="M36 46 L44 54 L62 36" stroke={a} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
            );
        case 'face':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <ellipse cx="48" cy="44" rx="28" ry="32" fill={c} opacity="0.9" />
                    <circle cx="38" cy="40" r="4" fill={a} opacity="0.9" />
                    <circle cx="58" cy="40" r="4" fill={a} opacity="0.9" />
                    <path d="M36 56 Q48 64 60 56" stroke={a} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M30 24 Q48 14 66 24" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6" />
                    <circle cx="72" cy="32" r="3" fill={T.goldSoft} opacity="0.7" />
                    <circle cx="24" cy="32" r="2" fill={T.goldSoft} opacity="0.5" />
                </svg>
            );
        case 'shopping':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M28 36 L20 76 L76 76 L68 36 Z" fill={c} opacity="0.9" />
                    <path d="M34 36 Q34 22 48 22 Q62 22 62 36" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
                    <line x1="38" y1="50" x2="38" y2="64" stroke={a} strokeWidth="2" strokeLinecap="round" />
                    <line x1="48" y1="48" x2="48" y2="66" stroke={a} strokeWidth="2" strokeLinecap="round" />
                    <line x1="58" y1="50" x2="58" y2="64" stroke={a} strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case 'sparkles':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M48 14 L52 40 L78 44 L52 48 L48 74 L44 48 L18 44 L44 40 Z" fill={c} opacity="0.9" />
                    <path d="M76 66 L78 74 L86 76 L78 78 L76 86 L74 78 L66 76 L74 74 Z" fill={c} opacity="0.65" />
                    <path d="M20 18 L22 24 L28 26 L22 28 L20 34 L18 28 L12 26 L18 24 Z" fill={c} opacity="0.5" />
                </svg>
            );
        case 'book':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M14 22 Q30 18 48 22 L48 76 Q30 72 14 76 Z" fill={c} opacity="0.9" />
                    <path d="M82 22 Q66 18 48 22 L48 76 Q66 72 82 76 Z" fill={c} opacity="0.65" />
                    <path d="M22 34 Q32 32 42 34 M22 44 Q32 42 42 44 M22 54 Q32 52 42 54" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M54 34 Q64 32 74 34 M54 44 Q64 42 74 44" stroke={a} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
                    <circle cx="48" cy="14" r="5" fill={T.goldSoft} opacity="0.7" />
                </svg>
            );
        case 'people':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <circle cx="34" cy="30" r="13" fill={c} opacity="0.9" />
                    <path d="M14 76 Q14 54 34 54 Q54 54 54 76 Z" fill={c} opacity="0.9" />
                    <circle cx="64" cy="36" r="11" fill={c} opacity="0.6" />
                    <path d="M46 78 Q46 60 64 60 Q82 60 82 78 Z" fill={c} opacity="0.6" />
                </svg>
            );
        case 'fortune':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <circle cx="48" cy="46" r="26" fill={c} opacity="0.15"/>
                    <path d="M48 14 L52 36 L74 30 L58 46 L74 62 L52 56 L48 78 L44 56 L22 62 L38 46 L22 30 L44 36 Z" fill={c} opacity="0.9"/>
                    <circle cx="48" cy="46" r="7" fill={a} opacity="0.8"/>
                </svg>
            );
        case 'coin':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <circle cx="48" cy="48" r="30" fill={c} opacity="0.9"/>
                    <circle cx="48" cy="48" r="22" fill="none" stroke={a} strokeWidth="2" opacity="0.5"/>
                    <text x="48" y="56" textAnchor="middle" fontSize="24" fontWeight="bold" fill={a} opacity="0.9">₩</text>
                </svg>
            );
        case 'heart':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M48 74 Q18 56 18 36 Q18 20 32 18 Q40 18 48 28 Q56 18 64 18 Q78 20 78 36 Q78 56 48 74 Z" fill={c} opacity="0.9"/>
                    <path d="M38 40 Q42 36 48 40 Q54 36 58 40" stroke={a} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
                </svg>
            );
        case 'moon':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <path d="M62 18 Q38 22 34 48 Q30 72 54 80 Q30 82 20 62 Q10 38 28 22 Q42 10 62 18 Z" fill={c} opacity="0.9"/>
                    <circle cx="66" cy="28" r="4" fill={c} opacity="0.5"/>
                    <circle cx="72" cy="40" r="2.5" fill={c} opacity="0.35"/>
                    <circle cx="60" cy="42" r="2" fill={c} opacity="0.3"/>
                </svg>
            );
        case 'gwansang':
            return (
                <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
                    <ellipse cx="48" cy="42" rx="24" ry="28" fill={c} opacity="0.9"/>
                    <circle cx="38" cy="38" r="3.5" fill={a} opacity="0.9"/>
                    <circle cx="58" cy="38" r="3.5" fill={a} opacity="0.9"/>
                    <path d="M37 52 Q48 58 59 52" stroke={a} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    <path d="M34 30 Q48 22 62 30" stroke={c} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.5"/>
                    <line x1="48" y1="70" x2="48" y2="80" stroke={c} strokeWidth="2" opacity="0.3"/>
                    <path d="M36 80 Q48 76 60 80" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3"/>
                </svg>
            );
        default:
            return null;
    }
};

// ─────────────────────────────────────────────
// 페르소나 타로 카드 (실제 DB 이미지 사용)
// ─────────────────────────────────────────────
const PersonaTarotCard: React.FC<{
    persona: Persona;
    index: number;
    focused?: boolean;
    onClick?: () => void;
}> = ({ persona, index, focused = false, onClick }) => {
    const palette = PALETTE_CYCLE[index % PALETTE_CYCLE.length];
    const numeral = ROMAN[index % ROMAN.length];
    const gold = T.gold;
    const W = 200, H = 310;

    return (
        <div
            onClick={onClick}
            style={{
                width: W, height: H,
                borderRadius: 14,
                background: `linear-gradient(155deg, ${palette.bg} 0%, #FBF8F3 55%, ${palette.bg} 100%)`,
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 0.35s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s',
                transform: focused ? 'translateY(-12px) scale(1.04)' : 'translateY(0) scale(1)',
                boxShadow: focused
                    ? `0 28px 56px -20px rgba(80,50,110,0.45), 0 8px 20px -8px rgba(80,50,110,0.25)`
                    : `0 8px 24px -12px rgba(80,50,110,0.28)`,
            }}
        >
            {/* 시머 오버레이 */}
            <div style={{
                position: 'absolute', inset: 0, borderRadius: 14,
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
                animation: 'lp-shimmer 4s ease-in-out infinite',
                pointerEvents: 'none', zIndex: 2,
            }} />

            {/* 트럼프 카드 격자 테두리 */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
                viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <rect x="4" y="4" width={W-8} height={H-8} rx="10" fill="none" stroke={gold} strokeWidth="1.3" opacity="0.6"/>
                <rect x="8" y="8" width={W-16} height={H-16} rx="7" fill="none" stroke={gold} strokeWidth="0.6" opacity="0.4"/>
                {[[16,16],[W-16,16],[16,H-16],[W-16,H-16]].map(([cx,cy],idx) => (
                    <g key={idx} transform={`translate(${cx},${cy})`}>
                        <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill={gold} opacity="0.55"/>
                        <polygon points="0,-3 3,0 0,3 -3,0" fill={gold} opacity="0.3"/>
                    </g>
                ))}
                <line x1="14" y1={H/2} x2={W-14} y2={H/2} stroke={gold} strokeWidth="0.5" opacity="0.18" strokeDasharray="4 4"/>
            </svg>

            {/* 로마 숫자 TL */}
            <div style={{
                position: 'absolute', top: 9, left: 12, zIndex: 3,
                fontFamily: "'Cinzel', serif", fontSize: 10,
                color: gold, letterSpacing: '0.18em', opacity: 0.9,
            }}>{numeral}</div>
            {/* 로마 숫자 BR */}
            <div style={{
                position: 'absolute', bottom: 9, right: 12, zIndex: 3,
                fontFamily: "'Cinzel', serif", fontSize: 10,
                color: gold, letterSpacing: '0.18em', opacity: 0.9,
                transform: 'rotate(180deg)',
            }}>{numeral}</div>

            {/* 초상 이미지 영역 */}
            <div style={{
                position: 'absolute', top: 24, left: 14, right: 14, height: 186,
                borderRadius: 8, overflow: 'hidden',
                border: `1px solid ${gold}55`,
                background: `radial-gradient(circle at 50% 40%, ${palette.bg} 0%, ${palette.deep}55 100%)`,
                zIndex: 1,
            }}>
                {persona.imageUrl ? (
                    <img
                        src={persona.imageUrl}
                        alt={persona.name}
                        draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 48, opacity: 0.4,
                    }}>✦</div>
                )}
                {/* 하단 그라데이션 */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
                    background: `linear-gradient(to top, ${palette.bg}cc, transparent)`,
                }} />
            </div>

            {/* 네임 플레이트 */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '10px 14px 14px',
                textAlign: 'center', zIndex: 3,
            }}>
                <div style={{
                    fontSize: 11, color: gold,
                    letterSpacing: '0.08em', marginBottom: 3,
                    opacity: 0.85, fontWeight: 500,
                }}>{persona.jobTitle || 'PERSONA'}</div>
                <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 22, fontWeight: 700,
                    color: palette.accent, lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                }}>{persona.name}</div>
            </div>

            {/* 호버 시 말풍선 (quote) */}
            {focused && persona.description && (
                <div style={{
                    position: 'absolute', bottom: 72, left: 10, right: 10,
                    background: 'rgba(255,255,255,0.92)',
                    borderRadius: 10, padding: '8px 12px',
                    fontSize: 11, color: T.inkSoft, lineHeight: 1.5,
                    boxShadow: '0 4px 14px rgba(80,50,110,0.15)',
                    zIndex: 4,
                    animation: 'lp-fade-up 0.25s ease',
                }}>
                    "{persona.description.slice(0, 50)}{persona.description.length > 50 ? '…' : ''}"
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// 기능 타로 카드
// ─────────────────────────────────────────────
const FeatureTarotCard: React.FC<{
    feature: typeof FEATURES[0];
    focused?: boolean;
    onClick?: () => void;
}> = ({ feature, focused = false, onClick }) => {
    const { numeral, latin, name, tag, desc, palette, icon } = feature;
    const gold = T.gold;
    const W = 200, H = 310;

    return (
        <div
            onClick={onClick}
            style={{
                width: W, height: H,
                borderRadius: 14,
                background: `linear-gradient(155deg, ${palette.bg} 0%, #FBF8F3 55%, ${palette.bg} 100%)`,
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 0.35s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s',
                transform: focused ? 'translateY(-12px) scale(1.04)' : 'translateY(0) scale(1)',
                boxShadow: focused
                    ? `0 28px 56px -20px rgba(80,50,110,0.45), 0 8px 20px -8px rgba(80,50,110,0.25)`
                    : `0 8px 24px -12px rgba(80,50,110,0.28)`,
            }}
        >
            {/* 시머 */}
            <div style={{
                position: 'absolute', inset: 0, borderRadius: 14,
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
                animation: 'lp-shimmer 4s ease-in-out infinite',
                pointerEvents: 'none', zIndex: 2,
            }} />

            {/* 트럼프 카드 격자 테두리 */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
                viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <rect x="4" y="4" width={W-8} height={H-8} rx="10" fill="none" stroke={gold} strokeWidth="1.3" opacity="0.6"/>
                <rect x="8" y="8" width={W-16} height={H-16} rx="7" fill="none" stroke={gold} strokeWidth="0.6" opacity="0.4"/>
                {[[16,16],[W-16,16],[16,H-16],[W-16,H-16]].map(([cx,cy],idx) => (
                    <g key={idx} transform={`translate(${cx},${cy})`}>
                        <polygon points="0,-5.5 5.5,0 0,5.5 -5.5,0" fill={gold} opacity="0.55"/>
                        <polygon points="0,-3 3,0 0,3 -3,0" fill={gold} opacity="0.3"/>
                    </g>
                ))}
                <line x1="14" y1={H/2} x2={W-14} y2={H/2} stroke={gold} strokeWidth="0.5" opacity="0.18" strokeDasharray="4 4"/>
            </svg>

            {/* 로마 숫자 */}
            <div style={{ position: 'absolute', top: 9, left: 12, zIndex: 3, fontFamily: "'Cinzel', serif", fontSize: 10, color: gold, letterSpacing: '0.18em', opacity: 0.9 }}>{numeral}</div>
            <div style={{ position: 'absolute', bottom: 9, right: 12, zIndex: 3, fontFamily: "'Cinzel', serif", fontSize: 10, color: gold, letterSpacing: '0.18em', opacity: 0.9, transform: 'rotate(180deg)' }}>{numeral}</div>

            {/* 아이콘 씬 */}
            <div style={{
                position: 'absolute', top: 22, left: 12, right: 12, height: 170,
                borderRadius: 9, border: `1px solid ${gold}40`,
                background: `radial-gradient(ellipse at 50% 40%, ${palette.bg} 0%, ${palette.deep}50 100%)`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 9, zIndex: 1,
            }}>
                <FeatureIcon kind={icon} size={80} color={palette.accent} bg={palette.bg} />
                <div style={{
                    background: palette.accent, color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    padding: '4px 13px', borderRadius: 999,
                    letterSpacing: '0.04em',
                    boxShadow: `0 2px 6px ${palette.accent}50`,
                }}>{tag}</div>
            </div>

            {/* 네임 플레이트 */}
            <div style={{
                position: 'absolute',
                top: 200, left: 0, right: 0, bottom: 0,
                padding: '8px 14px 14px',
                textAlign: 'center', zIndex: 3,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    fontSize: 11, color: gold,
                    letterSpacing: '0.08em', marginBottom: 4,
                    opacity: 0.85, fontWeight: 500,
                }}>{latin}</div>
                <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 22, fontWeight: 700,
                    color: palette.accent, lineHeight: 1.15,
                }}>{name}</div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// 타로 캐러셀 (수동 스와이프)
// ─────────────────────────────────────────────
const CARD_W = 200;
const GAP = 16;
const VISIBLE = 4; // 한 번에 보이는 카드 수 (데스크탑 기준)

// 캐러셀에 페르소나·기능을 섞어서 보여주기 위한 혼합 아이템 타입
type MixedItem =
    | { type: 'persona'; persona: Persona }
    | { type: 'feature'; feature: typeof FEATURES[0] };

const TarotCarousel: React.FC<{
    personas: Persona[];
    onPersonaClick?: (id: string) => void;
    onFeatureClick?: (key: string) => void;
}> = ({ personas, onPersonaClick, onFeatureClick }) => {
    const [offset, setOffset] = useState(0);           // 스냅 인덱스
    const [dragDx, setDragDx] = useState(0);           // 드래그 중 실시간 픽셀 오프셋
    const [dragging, setDragging] = useState(false);   // 드래그 중 여부 (transition 제어)
    const dragStartX = useRef<number | null>(null);
    const dragStartOffset = useRef(0);
    const hasDragged = useRef(false);

    // 페르소나 + 기능을 한 캐러셀에 번갈아 섞어서 배치(페르소나 먼저 노출, 이후 교차)
    const items: MixedItem[] = useMemo(() => {
        const ps: MixedItem[] = personas.map(p => ({ type: 'persona', persona: p }));
        const fs: MixedItem[] = FEATURES.map(f => ({ type: 'feature', feature: f }));
        const mixed: MixedItem[] = [];
        const max = Math.max(ps.length, fs.length);
        for (let i = 0; i < max; i++) {
            if (i < ps.length) mixed.push(ps[i]);
            if (i < fs.length) mixed.push(fs[i]);
        }
        return mixed;
    }, [personas]);
    const count = items.length;
    const maxOffset = Math.max(0, count - VISIBLE);
    const clamp = (v: number) => Math.max(0, Math.min(v, maxOffset));

    const goLeft  = () => setOffset(o => clamp(o - 1));
    const goRight = () => setOffset(o => clamp(o + 1));

    const startDrag = (clientX: number) => {
        dragStartX.current = clientX;
        dragStartOffset.current = offset;
        hasDragged.current = false;
        setDragging(true);
        setDragDx(0);
    };

    const moveDrag = (clientX: number) => {
        if (dragStartX.current === null) return;
        const dx = clientX - dragStartX.current;
        if (Math.abs(dx) > 4) hasDragged.current = true;
        setDragDx(dx);
    };

    const endDrag = (clientX: number) => {
        if (dragStartX.current === null) return;
        const dx = clientX - dragStartX.current;
        setDragging(false);
        setDragDx(0);
        if (Math.abs(dx) > 40) {
            setOffset(clamp(dragStartOffset.current - Math.round(dx / (CARD_W + GAP))));
        }
        dragStartX.current = null;
        // 클릭 억제용 — 약간의 딜레이 후 초기화
        setTimeout(() => { hasDragged.current = false; }, 50);
    };

    // 마우스
    const onMouseDown  = (e: React.MouseEvent) => startDrag(e.clientX);
    const onMouseMove  = (e: React.MouseEvent) => moveDrag(e.clientX);
    const onMouseUp    = (e: React.MouseEvent) => endDrag(e.clientX);

    // 터치
    const onTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0].clientX);
    const onTouchMove  = (e: React.TouchEvent) => moveDrag(e.touches[0].clientX);
    const onTouchEnd   = (e: React.TouchEvent) => endDrag(e.changedTouches[0].clientX);

    const translateX = -(offset * (CARD_W + GAP)) + dragDx;

    return (
        <div style={{ width: '100%', position: 'relative', padding: '16px 0 28px', userSelect: 'none' }}>
            {/* 좌우 화살표 */}
            {offset > 0 && (
                <button onClick={goLeft} style={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    zIndex: 20, width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.92)', border: `1px solid ${T.lineSoft}`,
                    boxShadow: '0 2px 12px rgba(80,50,110,0.15)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.accent, fontSize: 18, transition: 'all 0.15s',
                }}>‹</button>
            )}
            {offset < maxOffset && (
                <button onClick={goRight} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    zIndex: 20, width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.92)', border: `1px solid ${T.lineSoft}`,
                    boxShadow: '0 2px 12px rgba(80,50,110,0.15)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.accent, fontSize: 18, transition: 'all 0.15s',
                }}>›</button>
            )}

            {/* 좌우 페이드 마스크 */}
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 60, background: `linear-gradient(to right, ${T.bg}, transparent)`, zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 60, background: `linear-gradient(to left, ${T.bg}, transparent)`, zIndex: 10, pointerEvents: 'none' }} />

            {/* 트랙 */}
            <div style={{ overflow: 'hidden', padding: '4px 40px' }}>
                <div
                    style={{
                        display: 'flex', gap: GAP,
                        transform: `translateX(${translateX}px)`,
                        transition: dragging ? 'none' : 'transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)',
                        cursor: dragging ? 'grabbing' : 'grab',
                        willChange: 'transform',
                    }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {items.map((item, i) => {
                        if (item.type === 'persona') {
                            const p = item.persona;
                            return (
                                <div key={`p-${p.id}`} style={{ flexShrink: 0 }}
                                    onClick={() => { if (!hasDragged.current) onPersonaClick?.(p.id); }}>
                                    <PersonaTarotCard persona={p} index={i} focused={false} onClick={() => {}} />
                                </div>
                            );
                        } else {
                            const f = item.feature;
                            return (
                                <div key={`f-${f.id}`} style={{ flexShrink: 0 }}
                                    onClick={() => { if (!hasDragged.current) onFeatureClick?.(f.key); }}>
                                    <FeatureTarotCard feature={f} focused={false} onClick={() => {}} />
                                </div>
                            );
                        }
                    })}
                </div>
            </div>

            {/* 페이지 닷 */}
            {count > VISIBLE && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                    {Array.from({ length: maxOffset + 1 }).map((_, i) => (
                        <button key={i} onClick={() => setOffset(i)} style={{
                            width: i === offset ? 16 : 6, height: 6, borderRadius: 999,
                            background: i === offset ? T.accent : T.lineSoft,
                            border: 'none', cursor: 'pointer', padding: 0,
                            transition: 'all 0.2s',
                        }} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export const LandingPageNew: React.FC<LandingPageNewProps> = ({
    personas,
    isLoading,
    onStart,
    onLoginClick,
    onPersonaClick,
    onAnnouncementClick,
    unreadAnnouncementCount = 0,
    onPartnerBoardClick,
    onFeatureClick,
    categories = [],
    user,
    onGoToChat,
    onLogout,
    onAdminClick,
    onPersonaListClick,
    onFeatureListClick,
    onProfileClick,
    continuePersonaName,
    onContinueChat,
    favoriteChips,
    personaChips,
}) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [termsModal, setTermsModal] = useState<'terms' | 'privacy' | null>(null);

    const handleFeatureClick = (key: string) => {
        onFeatureClick?.(key);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: `
                radial-gradient(ellipse 60% 40% at 15% 10%, #F5E6F7 0%, transparent 55%),
                radial-gradient(ellipse 50% 35% at 85% 80%, #FCEADD 0%, transparent 55%),
                radial-gradient(ellipse 40% 30% at 80% 15%, #E8EEF7 0%, transparent 50%),
                ${T.bg}
            `,
            fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif",
            color: T.ink,
            overflowX: 'hidden',
            position: 'relative',
        }}>

            {/* Google Fonts */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cinzel:wght@400;500;600&family=Dancing+Script:wght@700&display=swap');
                @keyframes lp-shimmer {
                    0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
                    30%  { opacity: 1; }
                    70%  { opacity: 1; }
                    100% { transform: translateX(320%) skewX(-18deg); opacity: 0; }
                }
                @keyframes lp-marquee {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-${FEATURES.length * (200 + 20)}px); }
                }
                @keyframes lp-star-twinkle {
                    0%, 100% { opacity: var(--op, 0.3); transform: scale(1); }
                    50%      { opacity: calc(var(--op, 0.3) * 1.8); transform: scale(1.4); }
                }
                @keyframes lp-fade-up {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes lp-float {
                    0%, 100% { transform: translateY(0px); }
                    50%      { transform: translateY(-6px); }
                }
                .lp-cta-toggle {
                    padding: 10px 22px;
                    border-radius: 999px;
                    font-size: 14px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1.5px solid transparent;
                }
                .lp-cta-toggle:hover {
                    transform: translateY(-1px);
                }
                .lp-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 12px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.7);
                    border: 1px solid ${T.lineSoft};
                    font-size: 12px;
                    color: ${T.inkSoft};
                    backdrop-filter: blur(6px);
                }
                .lp-nav-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    color: ${T.inkSoft};
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: background 0.15s, color 0.15s;
                }
                .lp-nav-btn:hover {
                    background: rgba(142,111,183,0.08);
                    color: ${T.accent};
                }
                /* 모바일/데스크탑 전환 */
                .lp-nav-desktop { display: flex; }
                .lp-nav-mobile  { display: none; position: relative; }
                @media (max-width: 640px) {
                    .lp-nav-desktop { display: none !important; }
                    .lp-nav-mobile  { display: flex !important; }
                }
            `}</style>

            {/* 별빛 배경 */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <StarField />
            </div>

            {/* ── TopNav ── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: 'rgba(251,248,243,0.82)',
                backdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${T.lineSoft}`,
                height: 60,
                display: 'flex', alignItems: 'center',
                padding: '0 24px',
            }}>
                <div style={{
                    maxWidth: 1100, margin: '0 auto', width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    {/* 로고 */}
                    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                fontFamily: "'Cinzel', serif",
                                fontSize: 11, letterSpacing: '0.25em',
                                color: T.gold, lineHeight: 1,
                                fontWeight: 700,
                            }}>AI PERSONA</div>
                            <div style={{
                                fontFamily: "'Dancing Script', cursive",
                                fontSize: 18, fontWeight: 700,
                                color: T.ink, lineHeight: 1.2,
                                letterSpacing: '0.03em',
                            }}>Chat</div>
                        </div>
                    </a>

                    {/* 우측 버튼 — 데스크탑 */}
                    <div className="lp-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {onAnnouncementClick && (
                            <button className="lp-nav-btn" onClick={onAnnouncementClick} style={{ position: 'relative', padding: '6px 10px' }}>
                                <Bell size={18} />
                                {unreadAnnouncementCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: 2, right: 2,
                                        minWidth: 14, height: 14,
                                        background: T.accent2, color: '#fff',
                                        fontSize: 9, fontWeight: 700,
                                        borderRadius: 999,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '0 2px',
                                    }}>{unreadAnnouncementCount > 9 ? '9+' : unreadAnnouncementCount}</span>
                                )}
                            </button>
                        )}
                        {user ? (
                            <>
                                {onProfileClick ? (
                                    <button onClick={onProfileClick} title="내 정보" style={{
                                        fontSize: 13, color: T.inkSoft, fontWeight: 500,
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                                    }}>
                                        {user.username || user.email.split('@')[0]}님 ✦
                                    </button>
                                ) : (
                                    <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>
                                        {user.username || user.email.split('@')[0]}님 ✦
                                    </span>
                                )}
                                <button onClick={onProfileClick} style={{
                                    padding: '8px 20px', borderRadius: 999,
                                    background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                                    color: '#fff', fontSize: 13, fontWeight: 700,
                                    border: 'none', cursor: 'pointer',
                                    boxShadow: `0 6px 18px -6px rgba(142,111,183,0.55)`,
                                    transition: 'transform 0.15s', letterSpacing: '0.03em',
                                }}>내 정보 보기</button>
                            </>
                        ) : (
                            <>
                                <button className="lp-nav-btn" onClick={onLoginClick ?? onStart}>로그인</button>
                                <button onClick={onStart} style={{
                                    padding: '8px 20px', borderRadius: 999,
                                    background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                                    color: '#fff', fontSize: 13, fontWeight: 700,
                                    border: 'none', cursor: 'pointer',
                                    boxShadow: `0 6px 18px -6px rgba(142,111,183,0.55)`,
                                    transition: 'transform 0.15s', letterSpacing: '0.03em',
                                }}>무료 시작</button>
                            </>
                        )}
                    </div>

                    {/* 햄버거 버튼 — 모바일 */}
                    <button
                        className="lp-nav-mobile"
                        onClick={() => setMobileMenuOpen(v => !v)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px', borderRadius: 8,
                            display: 'flex', flexDirection: 'column', gap: 5,
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <span style={{ display: 'block', width: 22, height: 2, background: T.ink, borderRadius: 2, transition: 'all 0.2s',
                            transform: mobileMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
                        <span style={{ display: 'block', width: 22, height: 2, background: T.ink, borderRadius: 2, transition: 'all 0.2s',
                            opacity: mobileMenuOpen ? 0 : 1 }} />
                        <span style={{ display: 'block', width: 22, height: 2, background: T.ink, borderRadius: 2, transition: 'all 0.2s',
                            transform: mobileMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
                        {unreadAnnouncementCount > 0 && !mobileMenuOpen && (
                            <span style={{
                                position: 'absolute', top: 6, right: 6,
                                width: 8, height: 8, borderRadius: '50%',
                                background: T.accent2, border: '1.5px solid #fff',
                            }} />
                        )}
                    </button>
                </div>
            </nav>

            {/* 모바일 드로어 */}
            {mobileMenuOpen && (
                <>
                    {/* 배경 딤 */}
                    <div
                        onClick={() => setMobileMenuOpen(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 98,
                            background: 'rgba(45,36,56,0.3)',
                            backdropFilter: 'blur(2px)',
                        }}
                    />
                    {/* 드로어 패널 */}
                    <div style={{
                        position: 'fixed', top: 60, right: 0, zIndex: 99,
                        width: 220,
                        background: 'rgba(251,248,243,0.97)',
                        backdropFilter: 'blur(16px)',
                        borderLeft: `1px solid ${T.lineSoft}`,
                        borderBottom: `1px solid ${T.lineSoft}`,
                        borderRadius: '0 0 0 16px',
                        padding: '16px 0 20px',
                        boxShadow: '-8px 8px 32px -8px rgba(80,50,110,0.18)',
                        display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                        {user ? (
                            <>
                                <div style={{
                                    padding: '10px 20px 12px',
                                    borderBottom: `1px solid ${T.lineSoft}`,
                                    marginBottom: 4,
                                }}>
                                    <div style={{ fontSize: 11, color: T.inkMute, marginBottom: 2 }}>로그인됨</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                                        {user.username || user.email.split('@')[0]}님 ✦
                                    </div>
                                </div>
                                <button onClick={() => { setMobileMenuOpen(false); (onGoToChat ?? onStart)(); }} style={{
                                    padding: '13px 20px', background: 'none', border: 'none',
                                    textAlign: 'left', fontSize: 14, fontWeight: 700,
                                    color: T.accent, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    ✦ 채팅 시작하기
                                </button>
                                {onPersonaListClick && (
                                    <button onClick={() => { setMobileMenuOpen(false); onPersonaListClick(); }} style={{
                                        padding: '13px 20px', background: 'none', border: 'none',
                                        textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        borderTop: `1px solid ${T.lineSoft}`, marginTop: 4,
                                    }}>
                                        <span style={{ fontSize: 16 }}>🧑‍🤝‍🧑</span> 페르소나 목록
                                    </button>
                                )}
                                {onFeatureListClick && (
                                    <button onClick={() => { setMobileMenuOpen(false); onFeatureListClick(); }} style={{
                                        padding: '13px 20px', background: 'none', border: 'none',
                                        textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <span style={{ fontSize: 16 }}>✨</span> 기능 둘러보기
                                    </button>
                                )}
                                {onProfileClick && (
                                    <button onClick={() => { setMobileMenuOpen(false); onProfileClick(); }} style={{
                                        padding: '13px 20px', background: 'none', border: 'none',
                                        textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        borderTop: `1px solid ${T.lineSoft}`, marginTop: 4,
                                    }}>
                                        <span style={{ fontSize: 16 }}>👤</span> 내 정보
                                    </button>
                                )}
                                {onAdminClick && user?.role === 'ADMIN' && (
                                    <button onClick={() => { setMobileMenuOpen(false); onAdminClick(); }} style={{
                                        padding: '13px 20px', background: 'none', border: 'none',
                                        textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <span style={{ fontSize: 16 }}>⚙️</span> 어드민
                                    </button>
                                )}
                                {onLogout && (
                                    <button onClick={() => { setMobileMenuOpen(false); onLogout(); }} style={{
                                        padding: '13px 20px', background: 'none', border: 'none',
                                        textAlign: 'left', fontSize: 14, color: '#C0505A', cursor: 'pointer',
                                        borderTop: `1px solid ${T.lineSoft}`, marginTop: 4,
                                    }}>로그아웃</button>
                                )}
                            </>
                        ) : (
                            <>
                                <button onClick={() => { setMobileMenuOpen(false); (onLoginClick ?? onStart)(); }} style={{
                                    padding: '13px 20px', background: 'none', border: 'none',
                                    textAlign: 'left', fontSize: 14, fontWeight: 600,
                                    color: T.ink, cursor: 'pointer',
                                }}>로그인</button>
                                <button onClick={() => { setMobileMenuOpen(false); onStart(); }} style={{
                                    padding: '13px 20px', background: 'none', border: 'none',
                                    textAlign: 'left', fontSize: 14, fontWeight: 700,
                                    color: T.accent, cursor: 'pointer',
                                }}>✦ 무료 시작</button>
                            </>
                        )}
                        {onAnnouncementClick && (
                            <button onClick={() => { setMobileMenuOpen(false); onAnnouncementClick(); }} style={{
                                padding: '13px 20px', background: 'none', border: 'none',
                                textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8,
                                borderTop: `1px solid ${T.lineSoft}`, marginTop: 4,
                            }}>
                                <Bell size={15} />
                                공지사항
                                {unreadAnnouncementCount > 0 && (
                                    <span style={{
                                        marginLeft: 'auto', minWidth: 18, height: 18,
                                        background: T.accent2, color: '#fff',
                                        fontSize: 10, fontWeight: 700, borderRadius: 999,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '0 4px',
                                    }}>{unreadAnnouncementCount}</span>
                                )}
                            </button>
                        )}
                        {onPartnerBoardClick && (
                            <button onClick={() => { setMobileMenuOpen(false); onPartnerBoardClick(); }} style={{
                                padding: '13px 20px', background: 'none', border: 'none',
                                textAlign: 'left', fontSize: 14, color: T.inkSoft, cursor: 'pointer',
                            }}>제휴 문의</button>
                        )}
                    </div>
                </>
            )}

            {/* ── 히어로 섹션 ── */}
            <section style={{
                position: 'relative', zIndex: 1,
                paddingTop: 70, paddingBottom: 0,
                textAlign: 'center',
            }}>
                {/* 타로 킥커 */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    color: T.gold, marginBottom: 18, opacity: 0.9,
                }}>
                    <span style={{ fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: '0.25em', textTransform: 'uppercase' }}>✦ AI Persona</span>
                    <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: 22, fontWeight: 700, letterSpacing: '0.05em' }}>Chat</span>
                    <span style={{ fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: '0.25em' }}>✦</span>
                </div>

                {/* 메인 타이틀 (나의 AI 기능·페르소나가 추가돼 폰트 축소) */}
                <h1 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 'clamp(30px, 4.5vw, 50px)',
                    fontWeight: 600, lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    margin: '0 0 14px',
                    background: `linear-gradient(135deg, ${T.ink} 0%, ${T.accent} 55%, ${T.accent2} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                }}>
                    나만의 AI 친구를<br />만나보세요
                </h1>

                {/* 서브타이틀 */}
                <p style={{
                    fontSize: 'clamp(14px, 2vw, 17px)',
                    color: T.inkSoft, lineHeight: 1.7,
                    margin: '0 auto 28px',
                    maxWidth: 480,
                    padding: '0 20px',
                }}>
                    페르소나에 숨겨진 기능을 찾아보세요.<br />
                    대화 한 마디가 새로운 세계로 이어집니다.
                </p>

                {/* 나의 AI 기능 + 나의 AI 페르소나 (세로, 동그라미 썸네일) */}
                {user && (
                    <div style={{ maxWidth: 560, margin: '0 auto 24px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* 나의 AI 페르소나 */}
                        <div style={{
                            background: 'rgba(255,255,255,0.7)', border: `1px solid ${T.accent2}22`,
                            borderRadius: 16, padding: '14px 16px', backdropFilter: 'blur(8px)',
                            boxShadow: '0 6px 20px -10px rgba(228,139,176,0.28)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                <Users size={16} style={{ color: T.accent }} strokeWidth={2.4} />
                                <span style={{ fontSize: 14, color: T.ink, fontWeight: 800 }}>나의 AI 페르소나</span>
                            </div>
                            {personaChips && personaChips.length > 0 ? (
                                <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, justifyContent: 'center' }}>
                                    {personaChips.map(pc => (
                                        <button key={pc.id} onClick={pc.onClick}
                                            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', width: 58, position: 'relative' }}>
                                            <span style={{
                                                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                                                border: pc.highlight ? `2.5px solid ${T.accent}` : `2px solid ${T.accent2}55`,
                                                boxShadow: pc.highlight ? `0 0 0 3px ${T.accent}22` : 'none',
                                                background: `${T.accent2}14`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {pc.imageUrl
                                                    ? <img src={pc.imageUrl} alt={pc.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <span style={{ fontSize: 20 }}>💬</span>}
                                            </span>
                                            <span style={{ fontSize: 11, color: pc.highlight ? T.accent : T.ink, fontWeight: pc.highlight ? 800 : 600, whiteSpace: 'nowrap', maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {pc.highlight ? '✨' : ''}{pc.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 2px' }}>
                                    <p style={{ fontSize: 12.5, color: T.inkMute, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
                                        아직 담은 페르소나가 없어요.<br />마음에 드는 친구에 ⭐를 눌러 담으면 <b style={{ color: T.accent }}>+500P</b> 🎁
                                    </p>
                                    <button onClick={onPersonaListClick}
                                        style={{
                                            padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
                                            background: `${T.accent2}14`, border: `1.5px solid ${T.accent2}66`,
                                            color: T.accent, fontSize: 12.5, fontWeight: 700,
                                        }}>페르소나 둘러보기 →</button>
                                </div>
                            )}
                        </div>

                        {/* 나의 AI 기능 */}
                        <div style={{
                            background: 'rgba(255,255,255,0.7)', border: `1px solid ${T.accent}22`,
                            borderRadius: 16, padding: '14px 16px', backdropFilter: 'blur(8px)',
                            boxShadow: '0 6px 20px -10px rgba(142,111,183,0.3)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                <Sparkles size={16} style={{ color: T.accent }} strokeWidth={2.4} />
                                <span style={{ fontSize: 14, color: T.ink, fontWeight: 800 }}>나의 AI 기능</span>
                            </div>
                            {favoriteChips && favoriteChips.length > 0 ? (
                                <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, justifyContent: 'center' }}>
                                    {favoriteChips.map(chip => (
                                        <button key={chip.key} onClick={chip.onClick}
                                            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', width: 58 }}>
                                            <span style={{
                                                width: 46, height: 46, borderRadius: 14,
                                                background: chip.bgColor, border: `2px solid ${chip.borderColor}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                                            }}>{FEATURE_EMOJI[chip.key] ?? '✨'}</span>
                                            <span style={{ fontSize: 11.5, color: T.ink, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>{chip.label}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 2px' }}>
                                    <p style={{ fontSize: 12.5, color: T.inkMute, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
                                        아직 담은 기능이 없어요.<br />자주 쓰는 기능에 ⭐를 눌러 담으면 <b style={{ color: T.accent }}>+500P</b> 🎁
                                    </p>
                                    <button onClick={onFeatureListClick}
                                        style={{
                                            padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
                                            background: `${T.accent}14`, border: `1.5px solid ${T.accent}55`,
                                            color: T.accent, fontSize: 12.5, fontWeight: 700,
                                        }}>기능 둘러보기 →</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CTA 토글 버튼 */}
                <div style={{
                    display: 'flex', justifyContent: 'center',
                    gap: 10, marginBottom: 28, flexWrap: 'wrap',
                    padding: '0 20px',
                }}>
                    <button
                        className="lp-cta-toggle"
                        onClick={() => onPersonaListClick?.()}
                        style={{
                            background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                            color: '#fff',
                            border: '1.5px solid transparent',
                            boxShadow: `0 8px 20px -8px rgba(142,111,183,0.5)`,
                            backdropFilter: 'blur(6px)',
                        }}
                    >
                        ✦ 캐릭터 둘러보기
                    </button>
                    <button
                        className="lp-cta-toggle"
                        onClick={() => onFeatureListClick?.()}
                        style={{
                            background: 'linear-gradient(135deg, #4CAF82, #7CC56A)',
                            color: '#fff',
                            border: '1.5px solid transparent',
                            boxShadow: `0 8px 20px -8px rgba(76,175,130,0.5)`,
                            backdropFilter: 'blur(6px)',
                        }}
                    >
                        ◈ 기능 둘러보기
                    </button>
                </div>

                {/* 신뢰 칩 */}
                <div style={{
                    display: 'flex', justifyContent: 'center',
                    gap: 8, marginBottom: 40,
                    flexWrap: 'wrap', padding: '0 20px',
                }}>
                    <span className="lp-chip">✦ 10가지 AI 기능</span>
                    <span className="lp-chip">♦ 다양한 페르소나</span>
                    <span className="lp-chip">✧ 무료로 시작</span>
                </div>

                {/* 캐러셀 */}
                {isLoading ? (
                    <div style={{
                        height: 360,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: T.inkMute, fontSize: 14,
                    }}>
                        <div style={{ animation: 'lp-float 1.4s ease-in-out infinite' }}>
                            ✦ 불러오는 중...
                        </div>
                    </div>
                ) : (
                    <TarotCarousel
                        personas={personas}
                        onPersonaClick={onPersonaClick}
                        onFeatureClick={handleFeatureClick}
                    />
                )}
            </section>

            {/* ── 하단 골드 라인 + 힌트 ── */}
            <div style={{
                position: 'relative', zIndex: 1,
                textAlign: 'center',
                paddingBottom: 40,
            }}>
                {/* 골드 구분선 */}
                <div style={{
                    maxWidth: 320, margin: '0 auto 20px',
                    height: 1,
                    background: `linear-gradient(to right, transparent, ${T.goldSoft}, transparent)`,
                }} />

                {/* 힌트 텍스트 */}
                <p style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10, letterSpacing: '0.3em',
                    color: T.gold, opacity: 0.7,
                    margin: 0,
                }}>SCROLL TO EXPLORE  ↓</p>

                {/* 코너 장식 */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: 24,
                    marginTop: 16,
                }}>
                    <CornerOrnament rotate={-90} />
                    <CornerOrnament rotate={0} />
                    <CornerOrnament rotate={90} />
                </div>
            </div>
        {/* ── 사업자 정보 푸터 ── */}
        <footer style={{
            background: 'rgba(20,14,30,0.85)',
            borderTop: '1px solid rgba(197,168,100,0.15)',
            padding: '28px 24px',
            textAlign: 'center',
        }}>
            <div style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.25em',
                color: '#C5A864',
                marginBottom: 14,
            }}>
                WHISPR
            </div>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '6px 20px',
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.8,
                maxWidth: 600,
                margin: '0 auto',
            }}>
                <span>상호명: Whispr</span>
                <span style={{ color: 'rgba(197,168,100,0.3)' }}>|</span>
                <span>대표자: 신지윤</span>
                <span style={{ color: 'rgba(197,168,100,0.3)' }}>|</span>
                <span>사업자등록번호: 656-08-03261</span>
                <span style={{ color: 'rgba(197,168,100,0.3)' }}>|</span>
                <span>통신판매업 신고번호: 제 2026-충북청주-0690호</span>
                <span style={{ color: 'rgba(197,168,100,0.3)', width: '100%', display: 'none' }} className="lp-footer-divider">|</span>
                <span>주소: 충청북도 청주시 흥덕구 옥산면 오송가락로 1056</span>
                <span style={{ color: 'rgba(197,168,100,0.3)' }}>|</span>
                <span>전화: 0502-468-0502</span>
            </div>
            {/* 약관 링크 */}
            <div style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'center',
                gap: 20,
            }}>
                <button
                    onClick={() => setTermsModal('terms')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: 'rgba(197,168,100,0.6)',
                        textDecoration: 'underline', textUnderlineOffset: 3,
                        padding: 0,
                    }}
                >
                    이용약관
                </button>
                <button
                    onClick={() => setTermsModal('privacy')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: 'rgba(197,168,100,0.8)',
                        fontWeight: 700,
                        textDecoration: 'underline', textUnderlineOffset: 3,
                        padding: 0,
                    }}
                >
                    개인정보처리방침
                </button>
            </div>
            <div style={{
                marginTop: 12,
                fontSize: 10,
                color: 'rgba(255,255,255,0.2)',
                letterSpacing: '0.1em',
            }}>
                © 2026 Whispr. All rights reserved.
            </div>
        </footer>

        {/* 약관 모달 */}
        {termsModal && (
            <TermsModal
                initialTab={termsModal}
                onClose={() => setTermsModal(null)}
            />
        )}
        </div>
    );
};

export default LandingPageNew;
