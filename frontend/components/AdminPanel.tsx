import React, { useState, useEffect, useCallback } from 'react';
import { Persona, Category } from '../types';
import { categoryApi, adminApi } from '../services/apiService';
import { Icon } from './Icons';
import { pointApi } from '../services/pointService';
import { CleanupPanel } from './admin/CleanupPanel';
import { ToolsPanel } from './admin/ToolsPanel';
import { SettingsPanel } from './admin/SettingsPanel';
import { UsersPanel } from './admin/UsersPanel';
import { AiIdeasPanel } from './admin/AiIdeasPanel';
import { MarketingAssetsPanel } from './admin/MarketingAssetsPanel';
import { SitesPanel } from './admin/SitesPanel';
import { SkillsPanel } from './admin/SkillsPanel';
import { AnnouncementsPanel } from './admin/AnnouncementsPanel';
import { CategoriesPanel } from './admin/CategoriesPanel';
import { PersonasPanel } from './admin/PersonasPanel';
import { WebtoonAdminPanel } from './admin/WebtoonAdminPanel';
import { HeroCardAdminPanel } from './admin/HeroCardAdminPanel';
import { LearnShotsPanel } from './admin/LearnShotsPanel';
import { HomepageRequestsPanel } from './admin/HomepageRequestsPanel';
import { KinAnswerPanel } from './admin/KinAnswerPanel';
import { DocQnaPanel } from './admin/DocQnaPanel';
import { RefundGuidePanel } from './admin/RefundGuidePanel';
import { CardOrderPanel } from './admin/CardOrderPanel';
import { OmdDesignsPanel } from './admin/OmdDesignsPanel';
import { TossTraderPanel } from './admin/TossTraderPanel';
import { AiStudioPanel } from './admin/AiStudioPanel';
import { AgentGrowthPanel } from './admin/AgentGrowthPanel';
import { ReferralStatsPanel } from './admin/ReferralStatsPanel';
import { MarketingDailyPanel } from './admin/MarketingDailyPanel';
import { BatchJobsPanel } from './admin/BatchJobsPanel';
import { BizReportPanel } from './admin/BizReportPanel';
import { ShortsAdminPanel } from './admin/ShortsAdminPanel';
import { SampleVaultPanel } from './admin/SampleVaultPanel';

interface AdminPanelProps {
    personas: Persona[];
    onSave: (persona: Persona) => Promise<void>;
    onDelete: (id: string) => void;
    onClose: () => void;
    onImagesChanged?: (personaId: string) => void;
    user?: any;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ personas, onSave, onDelete, onClose, onImagesChanged, user }) => {
    const [mainView, setMainView] = useState<'personas' | 'categories' | 'announcements' | 'settings' | 'cleanup' | 'points' | 'users' | 'menu-limits' | 'monitor' | 'golf-courses' | 'tools' | 'product-extract' | 'ai-usage' | 'webtoon' | 'hero-cards' | 'card-order' | 'omd-designs' | 'ai-ideas' | 'marketing-assets' | 'learn-shots' | 'homepage-reqs' | 'kin-answer' | 'skills' | 'shorts' | 'doc-qna' | 'refund-guide' | 'sample-vault'>('personas');

    // 카테고리 상태는 페르소나 탭(PersonaInfoTab)과 카테고리 탭 양쪽에서 쓰이므로 본체가 소유한다.
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        categoryApi.getAll().then(setCategories).catch(() => {});
    }, []);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-900 z-40 relative animate-in fade-in duration-200">

            {/* ── 헤더 ── */}
            <header className="border-b border-gray-800 bg-gray-900/95 shrink-0">
                <div className="h-14 flex items-center justify-between px-5">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Icon name="Settings" size={18} className="text-blue-400" />
                        관리자 설정
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded-lg transition-colors">
                        <Icon name="X" size={18} />
                    </button>
                </div>
                {(() => {
                    // 14개 탭을 성격별 그룹으로 묶어 2단 네비(그룹 → 하위탭)로 표시. mainView 키는 그대로.
                    const GROUPS = [
                        { id: 'content', label: '콘텐츠', icon: 'BookOpen', tabs: [
                            { key: 'personas',      label: '페르소나', icon: 'Bot' },
                            { key: 'categories',    label: '카테고리', icon: 'Tag' },
                            { key: 'webtoon',       label: '웹툰 관리', icon: 'BookOpen' },
                            { key: 'hero-cards',    label: '메인 카드', icon: 'Image' },
                            { key: 'card-order',    label: '카드 순서', icon: 'Image' },
                            { key: 'omd-designs',   label: 'omd 디자인', icon: 'Image' },
                            { key: 'learn-shots',   label: '학습자료 이미지', icon: 'Image' },
                            { key: 'homepage-reqs', label: '홈페이지 신청', icon: 'BookOpen' },
                            { key: 'kin-answer',    label: '지식인 답변', icon: 'Search' },
                            { key: 'doc-qna',       label: '문서 QnA(뼈대)', icon: 'FileText' },
                            { key: 'refund-guide',  label: '💸 환불 절차',  icon: 'Coins' },
                            { key: 'marketing-assets', label: '마케팅 자산', icon: 'Megaphone' },
                            { key: 'shorts',        label: '쇼츠 관리', icon: 'Play' },
                            { key: 'sample-vault',  label: '샘플 영상 보관함', icon: 'Play' },
                            { key: 'announcements', label: '공지사항', icon: 'Megaphone' },
                        ] },
                        { id: 'members', label: '회원·포인트', icon: 'Users', tabs: [
                            { key: 'biz',           label: '경영 리포트', icon: 'BarChart2' },
                            { key: 'users',         label: '회원 관리',   icon: 'Users' },
                            { key: 'points',        label: '포인트 통계', icon: 'Coins' },
                            { key: 'menu-limits',   label: '메뉴권한',    icon: 'Shield' },
                            { key: 'referral',      label: '레퍼럴',      icon: 'Users' },
                            { key: 'marketing-daily', label: '📊 일별 마케팅', icon: 'BarChart2' },
                        ] },
                        { id: 'ops', label: '운영', icon: 'Wrench', tabs: [
                            { key: 'cleanup',       label: '메시지 정리', icon: 'Trash2' },
                            { key: 'golf-courses',  label: '골프장 관리', icon: 'MapPin' },
                            { key: 'product-extract', label: '제품추출',  icon: 'Package' },
                            { key: 'tools',         label: '기능연습',    icon: 'Zap' },
                        ] },
                        { id: 'system', label: '시스템', icon: 'Settings', tabs: [
                            { key: 'settings',      label: '공통 설정', icon: 'Settings' },
                            { key: 'monitor',       label: '서버 모니터', icon: 'Activity' },
                            { key: 'batch-jobs',    label: '⏰ 배치 작업',  icon: 'Clock' },
                            { key: 'ai-usage',      label: 'AI 사용량',   icon: 'BarChart2' },
                            { key: 'ai-ideas',      label: 'AI 아이디어', icon: 'Lightbulb' },
                            { key: 'agent-growth',  label: '직원 성장',   icon: 'Sparkles' },
                            { key: 'skills',        label: '스킬',       icon: 'Zap' },
                            { key: 'sites',         label: '독립사이트', icon: 'Globe' },
                            { key: 'toss-trader',   label: '토스 자동매매', icon: 'TrendingUp' },
                            // 가상매매 성과는 실봇 탭과 성격이 달라 분리(2026-08-05) —
                            // 실봇 탭은 '지금 뭘 하나', 이 탭은 '결과가 어땠나'가 중심.
                            { key: 'paper-trader',  label: '가상매매(페이퍼)', icon: 'Activity' },
                            // AI 스튜디오(서버3 GPU) — 필요할 때만 켜는 온디맨드 서버(2026-08-05)
                            { key: 'ai-studio',     label: 'AI 스튜디오', icon: 'Zap' },
                        ] },
                    ] as const;
                    // 현재 mainView가 속한 그룹을 활성 그룹으로
                    const activeGroup = GROUPS.find(g => g.tabs.some(t => t.key === mainView)) ?? GROUPS[0];
                    return (
                        <div className="px-4 pb-0">
                            {/* 1단: 그룹 */}
                            <nav className="flex gap-1 flex-wrap">
                                {GROUPS.map(g => {
                                    const on = g.id === activeGroup.id;
                                    return (
                                        <button
                                            key={g.id}
                                            onClick={() => { if (!g.tabs.some(t => t.key === mainView)) setMainView(g.tabs[0].key); }}
                                            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all
                                                ${on ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <Icon name={g.icon} size={13} />
                                            {g.label}
                                        </button>
                                    );
                                })}
                            </nav>
                            {/* 2단: 활성 그룹의 하위 탭 */}
                            <nav className="flex gap-1 flex-wrap bg-gray-800 rounded-b-lg rounded-tr-lg px-1.5 py-1">
                                {activeGroup.tabs.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setMainView(tab.key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap
                                            ${mainView === tab.key
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                            }`}
                                    >
                                        <Icon name={tab.icon} size={12} />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    );
                })()}
            </header>

            {/* ── 바디 ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* 페르소나 탭: 자체 좌측 목록 + 하위 탭을 모두 포함 */}
                {mainView === 'personas' && (
                    <PersonasPanel
                        personas={personas}
                        categories={categories}
                        onSave={onSave}
                        onDelete={onDelete}
                        onImagesChanged={onImagesChanged}
                    />
                )}

                {/* 그 외 탭: 우측 콘텐츠 영역 */}
                {mainView !== 'personas' && (
                <div className="flex-1 flex flex-col overflow-hidden">

                {/* 공통 설정 패널 */}
                {mainView === 'settings' && <SettingsPanel onGoPersonas={() => setMainView('personas')} />}

                {/* 메시지 정리 패널 */}
                {mainView === 'cleanup' && <CleanupPanel />}

                {/* 포인트 통계 패널 */}
                {mainView === 'points' && <AdminPointStats />}

                {/* 회원 관리 패널 */}
                {mainView === 'users' && <UsersPanel />}

                {/* 메뉴권한 패널 */}
                {mainView === 'menu-limits' && <MenuLimitsPanel />}

                {/* 서버 모니터링 패널 */}
                {mainView === 'monitor' && <ServerMonitorPanel />}
                {mainView === 'batch-jobs' && <BatchJobsPanel />}
                {mainView === 'ai-usage' && <AiUsagePanel />}
                {mainView === 'ai-ideas' && <AiIdeasPanel />}
                {mainView === 'agent-growth' && <AgentGrowthPanel />}
                {mainView === 'marketing-assets' && <MarketingAssetsPanel />}
                {mainView === 'skills' && <SkillsPanel />}
                {mainView === 'sites' && <SitesPanel />}
                {mainView === 'toss-trader' && <TossTraderPanel />}
                {mainView === 'paper-trader' && <TossTraderPanel mode="paper" />}
                {mainView === 'ai-studio' && <AiStudioPanel />}
                {mainView === 'referral' && <ReferralStatsPanel />}
                {mainView === 'marketing-daily' && <MarketingDailyPanel />}
                {mainView === 'biz' && <BizReportPanel />}

                {/* 골프장 관리 패널 */}
                {mainView === 'golf-courses' && <GolfCoursesPanel />}

                {/* 제품추출 관리 패널 */}
                {mainView === 'product-extract' && <ProductExtractPanel />}

                {/* 기능연습 패널 */}
                {mainView === 'tools' && <ToolsPanel user={user} />}

                {/* 카테고리 관리 패널 */}
                {mainView === 'categories' && <CategoriesPanel categories={categories} setCategories={setCategories} />}

                {/* 웹툰 관리 패널 (향기 페르소나 회차·컷) */}
                {mainView === 'webtoon' && <WebtoonAdminPanel />}
                {mainView === 'hero-cards' && <HeroCardAdminPanel personas={personas} />}
                {mainView === 'learn-shots' && <LearnShotsPanel />}
                {mainView === 'homepage-reqs' && <HomepageRequestsPanel />}
                {mainView === 'kin-answer' && <KinAnswerPanel personas={personas} />}
                {mainView === 'doc-qna' && <DocQnaPanel />}
                {mainView === 'refund-guide' && <RefundGuidePanel />}
                {mainView === 'card-order' && <CardOrderPanel />}
                {mainView === 'omd-designs' && <OmdDesignsPanel />}
                {mainView === 'shorts' && <ShortsAdminPanel />}
                {mainView === 'sample-vault' && <SampleVaultPanel />}

                {/* 공지사항 관리 패널 */}
                {mainView === 'announcements' && <AnnouncementsPanel personas={personas} />}

                </div>
                )}
            </div>
        </div>
    );
};

// 포인트를 차감하는 모든 기능(checkMenuAccess 기준). 순서 = 화면 표시 순서.
const FEATURE_LABELS: Record<string, string> = {
    'news':       '오늘 뉴스',
    'stock':      '주식 분석',
    'luxury':     '명품 감정',
    'used-item':  '중고판매 분석',
    'hot-keyword':'핫쇼핑 키워드',
    'insurance':  '보험 컨설팅',
    'face':       '얼굴 관상',
    'palm':       '손금',
    'quick-menu': '운세·사주(시운·재물·인연·꿈해몽)',
    'mathtutor':  'AI쌤 수학(풀이·출제)',
    'hair':       '헤어Style',
    'agetransform':'시간여행(나이변환)',
    'outfit':     '프로필 사진',
    'lookalike':  '연예인 매칭',
    'golf':       '골프 스윙 분석',
    'webtoon':    '웹툰 보기',
    'club':       '모임(출첵)',
    'ebook_docx_per1k': '전자책 문서 만들기(1,000자당)',
    'ebook_image_prompt': '전자책 그림 프롬프트 뽑기(일괄)',
    'ebook_image': '전자책 그림 이미지 생성(장당)',
    'ebook_cover': '전자책 AI 표지 생성(장당)',
    'marketing':  'AI 마케팅 글쓰기',
    'homepage':   '홈페이지 만들기',
    'homepage_edit_text':   '홈페이지 수정(텍스트)',
    'homepage_edit_image':  '홈페이지 수정(AI 사진)',
    'homepage_edit_upload': '홈페이지 수정(내 사진)',
    'shorts_maker_research': '쇼츠 만들기(리서치+시나리오5개)',
    'shorts_maker_produce':  '쇼츠 만들기(영상 제작)',
};
// 위 라벨의 key 순서 = 표시 순서 (차감 기능 전체)
const ALL_FEATURES = Object.keys(FEATURE_LABELS);

// 기능별 AI 실비 추정(원). 정확한 실측은 사용량 쌓여야 하므로 합리적 추정값.
// (Gemini Flash·Claude구독 기준, 합성은 nano-banana 이미지 비용)
const FEATURE_COST_KRW: Record<string, number> = {
    'news': 3, 'face': 2, 'palm': 2, 'hot-keyword': 3, 'mathtutor': 3, 'quick-menu': 3,
    'used-item': 5, 'golf': 10, 'luxury': 15, 'insurance': 15, 'stock': 30, 'hair': 92,
    'agetransform': 92, 'outfit': 92,  // nano-banana(gemini-3.1-flash-image) 1K 이미지 실측단가($0.067×환율, 2026-07-25 공식 가격표 확인)
    'lookalike': 2, 'webtoon': 0, 'club': 0, 'marketing': 12,
    'ebook_docx_per1k': 1,       // Gemini/Claude 텍스트 조립(1,000자당, 저렴)
    'ebook_image_prompt': 3,     // Claude sonnet 텍스트 호출 1회(자리 수 무관)
    'ebook_image': 92,           // 나노바나나 이미지 생성 1장(hair와 동일 모델·단가)
    'ebook_cover': 92,           // 나노바나나 이미지 생성 1장(그림 자리와 동일 모델·단가)
    'homepage': 250,   // claude구독(≈0)+나노바나나 최대4장(장당50~80원 실측)
    'homepage_edit_text': 0,      // claude 구독 1회 호출(API 과금 아님)
    'homepage_edit_image': 70,    // 나노바나나 1장 재생성
    'homepage_edit_upload': 5,    // Gemini 안전검수 1회(텍스트 판정)
    'shorts_maker_research': 5,   // Gemini flash 리서치+시나리오5개(텍스트만, 저렴)
    // 2026-07-23: Veo 3.1 fast 도입 — 세그먼트당 원가가 나노바나나(57원) vs Veo(약 1,100~1,650원)로
    // 12~18배 차이. LLM이 매번 손동작 세그먼트를 만들진 않아(실측: 시나리오에 명시 안 하면 0개)
    // 평균 추정치로 잡음 — Veo 미사용 시 약 350원(나노바나나 6장), 사용 시 최대 ~2,000원.
    // 실사용 데이터 쌓이면 재산정 필요.
    'shorts_maker_produce': 800,
};
const PT_TO_KRW = 1;   // 1pt = 1원 (2026-06-17 전환)

const ROLES = ['USER', 'MANAGE', 'ADMIN'] as const;

interface MenuLimit {
    feature: string;
    role: string;
    dailyLimit: number | null;
    pointsCost: number;
}

const MenuLimitsPanel: React.FC = () => {
    const [limits, setLimits] = useState<MenuLimit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [edits, setEdits] = useState<Record<string, { dailyLimit: string; pointsCost: string }>>({});
    const [savedKey, setSavedKey] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');   // 기능이 많아 이름/키로 찾기

    useEffect(() => {
        fetch('/api/admin/menu-limits', { credentials: 'include' })
            .then(r => r.json())
            .then((data: MenuLimit[]) => {
                setLimits(data);
                const initEdits: Record<string, { dailyLimit: string; pointsCost: string }> = {};
                data.forEach(l => {
                    initEdits[`${l.feature}:${l.role}`] = {
                        dailyLimit: l.dailyLimit === null ? '' : String(l.dailyLimit),
                        pointsCost: String(l.pointsCost),
                    };
                });
                setEdits(initEdits);
            })
            .catch(() => setError('로드 실패'))
            .finally(() => setLoading(false));
    }, []);

    const getEdit = (feature: string, role: string) => {
        return edits[`${feature}:${role}`] ?? { dailyLimit: '', pointsCost: '50' };
    };

    const setEdit = (feature: string, role: string, field: 'dailyLimit' | 'pointsCost', value: string) => {
        const key = `${feature}:${role}`;
        setEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    };

    const handleSave = async (feature: string, role: string) => {
        const key = `${feature}:${role}`;
        const edit = getEdit(feature, role);
        setSaving(key);
        setError('');
        try {
            const res = await fetch('/api/admin/menu-limits', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature,
                    role,
                    dailyLimit: edit.dailyLimit === '' ? null : Number(edit.dailyLimit),
                    pointsCost: Number(edit.pointsCost),
                }),
            });
            if (!res.ok) throw new Error('저장 실패');
            setSavedKey(key);
            setTimeout(() => setSavedKey(null), 1500);
        } catch {
            setError(`${feature}/${role} 저장 실패`);
        } finally {
            setSaving(null);
        }
    };

    const q = search.trim().toLowerCase();
    const features = Object.keys(FEATURE_LABELS).filter(feature =>
        q === '' ||
        feature.toLowerCase().includes(q) ||                        // 기능 키(예: marketing)
        (FEATURE_LABELS[feature] ?? '').toLowerCase().includes(q)   // 한글 이름(예: 마케팅)
    );

    if (loading) return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">불러오는 중...</div>;

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-bold text-white">포인트 차감 기능 설정</h3>
                    <p className="text-xs text-gray-500 mt-0.5">기능별·역할별 일일 이용 횟수 및 포인트 차감을 설정합니다. (일반 채팅은 무료 — 일 100회 한도)</p>
                </div>
            </div>

            {/* 안내: 차감 기능 / 무료 기능 구분 */}
            <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-blue-300 font-semibold mb-0.5">💸 포인트 차감 ({ALL_FEATURES.length}개)</p>
                    <p className="text-[11px] text-gray-400">{ALL_FEATURES.map(f => FEATURE_LABELS[f]).join(' · ')}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-gray-400 font-semibold mb-0.5">🆓 무료 기능 (차감 없음)</p>
                    <p className="text-[11px] text-gray-500">없음 (전 기능 차감)</p>
                </div>
            </div>

            {/* 기능 검색 — 항목이 많아 이름/키로 빠르게 찾기 */}
            <div className="mb-4 relative">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="기능 이름으로 찾기 (예: 마케팅, 주식, marketing)"
                    className="w-full pl-9 pr-8 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs px-1"
                        aria-label="검색어 지우기"
                    >✕</button>
                )}
            </div>

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            {features.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">"{search}" 검색 결과가 없습니다.</p>
            )}

            <div className="space-y-4">
                {features.map(feature => (
                    <div key={feature} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        {(() => {
                            const costKrw = FEATURE_COST_KRW[feature] ?? 0;          // AI 실비(원)
                            const pt = Number(getEdit(feature, 'USER').pointsCost) || 0;
                            const priceKrw = pt * PT_TO_KRW;                          // 차감 원화(USER 기준)
                            const margin = priceKrw > 0 ? Math.round((priceKrw - costKrw) / priceKrw * 100) : 0;
                            const marginColor = margin >= 80 ? 'text-emerald-400' : margin >= 50 ? 'text-yellow-400' : 'text-red-400';
                            return (
                                <div className="px-4 py-2.5 bg-gray-750 border-b border-gray-700 flex items-center gap-2 flex-wrap">
                                    <Icon name="Shield" size={13} className="text-blue-400" />
                                    <span className="text-sm font-semibold text-gray-200">{FEATURE_LABELS[feature] ?? feature}</span>
                                    <span className="text-[10px] text-gray-500 font-mono">{feature}</span>
                                    {/* 수익성: USER 차감 기준 (원가·차감원화·수익률) */}
                                    <span className="ml-auto flex items-center gap-2 text-[11px]">
                                        <span className="text-gray-500">원가 ~{costKrw}원</span>
                                        <span className="text-gray-400">차감 {priceKrw.toLocaleString()}원</span>
                                        <span className={`font-bold ${marginColor}`}>수익률 {margin}%</span>
                                    </span>
                                </div>
                            );
                        })()}
                        <div className="divide-y divide-gray-700/50">
                            {ROLES.map(role => {
                                const key = `${feature}:${role}`;
                                const edit = getEdit(feature, role);
                                const isSaving = saving === key;
                                const isSaved = savedKey === key;
                                const roleColors: Record<string, string> = {
                                    USER: 'text-green-400',
                                    MANAGE: 'text-yellow-400',
                                    ADMIN: 'text-red-400',
                                };
                                return (
                                    <div key={role} className="flex items-center gap-3 px-4 py-3">
                                        <span className={`text-xs font-bold w-14 shrink-0 ${roleColors[role]}`}>{role}</span>

                                        <div className="flex-1 flex items-center gap-2">
                                            <div className="flex flex-col gap-0.5">
                                                <label className="text-[10px] text-gray-500">일일 횟수 (비워두면 무제한)</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={edit.dailyLimit}
                                                    onChange={e => setEdit(feature, role, 'dailyLimit', e.target.value)}
                                                    placeholder="무제한"
                                                    className="w-24 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-0.5">
                                                <label className="text-[10px] text-gray-500">포인트 차감</label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={edit.pointsCost}
                                                        onChange={e => setEdit(feature, role, 'pointsCost', e.target.value)}
                                                        className="w-20 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                                    />
                                                    <span className="text-[10px] text-gray-500">pt</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleSave(feature, role)}
                                            disabled={isSaving}
                                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                isSaved
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                                            }`}
                                        >
                                            {isSaved ? '저장됨' : isSaving ? '...' : '저장'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-gray-600 mt-5 text-center">
                DB에서 직접 수정한 정책은 즉시 반영됩니다. 항목이 없으면 기본값(무제한/50pt)이 적용됩니다.
            </p>
        </div>
    );
};

const AdminPointStats: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [settle, setSettle] = useState<any>(null);   // 전사 일별 결산
    const [days, setDays] = useState(30);

    useEffect(() => {
        pointApi.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        adminApi.getPointSettlement(days).then(setSettle).catch(() => setSettle(null));
    }, [days]);

    if (loading) return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">불러오는 중...</div>;
    if (!stats) return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>;

    const fmt = (n: number) => (n ?? 0).toLocaleString();

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 전사 포인트 일별 결산 */}
            {settle && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-200">💰 포인트 결산 (전사)</p>
                        <select value={days} onChange={e => setDays(Number(e.target.value))}
                            className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1">
                            <option value={7}>최근 7일</option>
                            <option value={30}>최근 30일</option>
                            <option value={90}>최근 90일</option>
                        </select>
                    </div>
                    {/* 요약 카드 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-[11px] text-gray-400">충전(매출)</p>
                            <p className="text-lg font-bold text-emerald-400">+{fmt(settle.summary.chargePt)}pt</p>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-[11px] text-gray-400">소비</p>
                            <p className="text-lg font-bold text-red-400">-{fmt(settle.summary.spent)}pt</p>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-[11px] text-gray-400">무상 지급</p>
                            <p className="text-lg font-bold text-sky-400">+{fmt(settle.summary.granted)}pt</p>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3">
                            <p className="text-[11px] text-gray-400">환불</p>
                            <p className="text-lg font-bold text-amber-400">+{fmt(settle.summary.refund)}pt</p>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3 col-span-2 md:col-span-1">
                            <p className="text-[11px] text-gray-400">미사용 잔액(부채)</p>
                            <p className="text-lg font-bold text-gray-200">{fmt(settle.summary.outstandingPaid + settle.summary.outstandingBonus)}pt</p>
                            <p className="text-[10px] text-gray-500">유료 {fmt(settle.summary.outstandingPaid)} / 보너스 {fmt(settle.summary.outstandingBonus)}</p>
                        </div>
                    </div>
                    {/* 일별 표 */}
                    <div className="overflow-x-auto rounded-xl border border-gray-700">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-800 text-gray-400">
                                <tr>
                                    <th className="text-left px-3 py-2">날짜</th>
                                    <th className="text-right px-3 py-2">충전</th>
                                    <th className="text-right px-3 py-2">소비</th>
                                    <th className="text-right px-3 py-2">무상</th>
                                    <th className="text-right px-3 py-2">환불</th>
                                </tr>
                            </thead>
                            <tbody>
                                {settle.daily.length === 0 && (
                                    <tr><td colSpan={5} className="text-center text-gray-500 py-6">데이터 없음</td></tr>
                                )}
                                {settle.daily.map((d: any) => (
                                    <tr key={d.date} className="border-t border-gray-800">
                                        <td className="px-3 py-2 text-gray-300">{d.date}</td>
                                        <td className="px-3 py-2 text-right text-emerald-400">{d.chargeAmount ? `+${fmt(d.chargeAmount)}` : '-'}{d.chargeCount ? ` (${d.chargeCount}건)` : ''}</td>
                                        <td className="px-3 py-2 text-right text-red-400">{d.spent ? `-${fmt(d.spent)}` : '-'}</td>
                                        <td className="px-3 py-2 text-right text-sky-400">{d.granted ? `+${fmt(d.granted)}` : '-'}</td>
                                        <td className="px-3 py-2 text-right text-amber-400">{d.refund ? `+${fmt(d.refund)}` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <p className="text-sm font-semibold text-gray-300 pt-2 border-t border-gray-800">📊 내 포인트 통계</p>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">총 포인트 소비</p>
                    <p className="text-2xl font-bold text-red-400">{(stats.totalSpent ?? 0).toLocaleString()}pt</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">스타 선물 총계</p>
                    <p className="text-2xl font-bold text-yellow-400">{stats.balloonsSent}개</p>
                    <p className="text-xs text-gray-500">{stats.balloonsPointsSpent}pt 사용</p>
                </div>
            </div>

            {stats.byPersona.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-gray-300 mb-3">페르소나별 포인트 소비</p>
                    <div className="space-y-2">
                        {stats.byPersona.map((b: any) => (
                            <div key={b.personaId} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                                {b.persona?.imageUrl && <img src={b.persona.imageUrl} className="w-7 h-7 rounded-full object-cover object-top" alt="" />}
                                <span className="text-sm text-gray-300 flex-1 truncate">{b.persona?.name ?? '알 수 없음'}</span>
                                <span className="text-sm font-semibold text-yellow-400">{(b.spent ?? 0).toLocaleString()}pt</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── 골프장 관리 패널 ──────────────────────────────────────
interface GolfCourseAdmin {
    id: number;
    name: string;
    sido: string;
    sigungu: string;
    address: string | null;
    bookingUrl: string | null;
    hasAuto: boolean;
    bookerType: string | null;
    hasCredential: boolean;
    advanceDays: number;
    openHour: number;
    openMinute: number;
}

const EMPTY_FORM = { name: '', sido: '', sigungu: '', address: '', bookingUrl: '', hasAuto: false, bookerType: '', advanceDays: 30, openHour: 0, openMinute: 0 };

const GolfCoursesPanel: React.FC = () => {
    const [courses, setCourses]   = useState<GolfCourseAdmin[]>([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [editing, setEditing]   = useState<number | 'new' | null>(null);
    const [form, setForm]         = useState({ ...EMPTY_FORM });
    const [saving, setSaving]     = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    const load = () => {
        setLoading(true);
        fetch('/api/golf/admin/courses', { credentials: 'include' })
            .then(r => r.json())
            .then(d => { setCourses(Array.isArray(d) ? d : []); setError(''); })
            .catch(() => setError('로드 실패'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openNew = () => { setForm({ ...EMPTY_FORM }); setEditing('new'); setError(''); };
    const openEdit = (c: GolfCourseAdmin) => {
        setForm({ name: c.name, sido: c.sido, sigungu: c.sigungu, address: c.address || '', bookingUrl: c.bookingUrl || '', hasAuto: c.hasAuto, bookerType: c.bookerType || '', advanceDays: c.advanceDays ?? 30, openHour: c.openHour ?? 0, openMinute: c.openMinute ?? 0 });
        setEditing(c.id);
        setError('');
    };

    const handleSave = async () => {
        if (!form.name || !form.sido || !form.sigungu) { setError('골프장명, 시도, 시군구는 필수입니다.'); return; }
        setSaving(true); setError('');
        try {
            const url    = editing === 'new' ? '/api/golf/admin/courses' : `/api/golf/admin/courses/${editing}`;
            const method = editing === 'new' ? 'POST' : 'PUT';
            const res    = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || '저장 실패'); }
            setEditing(null);
            load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('이 골프장을 삭제하시겠습니까?')) return;
        setDeleting(id);
        try {
            await fetch(`/api/golf/admin/courses/${id}`, { method: 'DELETE', credentials: 'include' });
            load();
        } finally {
            setDeleting(null);
        }
    };

    const f = (k: keyof typeof EMPTY_FORM, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">골프장 관리</h3>
                <button onClick={openNew} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg font-medium">+ 골프장 추가</button>
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            {/* 수정/추가 폼 */}
            {editing !== null && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-300">{editing === 'new' ? '새 골프장 추가' : '골프장 수정'}</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-gray-400 text-xs block mb-1">골프장명 *</label>
                            <input value={form.name} onChange={e => f('name', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="청주떼제베CC" />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs block mb-1">시도 *</label>
                            <input value={form.sido} onChange={e => f('sido', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="충청북도" />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs block mb-1">시군구 *</label>
                            <input value={form.sigungu} onChange={e => f('sigungu', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="청주시" />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs block mb-1">주소</label>
                            <input value={form.address} onChange={e => f('address', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="충북 청주시 흥덕구..." />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs block mb-1">예약 URL</label>
                            <input value={form.bookingUrl} onChange={e => f('bookingUrl', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="https://..." />
                        </div>
                        <div>
                            <label className="text-gray-400 text-xs block mb-1">부커 타입</label>
                            <input value={form.bookerType} onChange={e => f('bookerType', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="adtgv" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="hasAuto" checked={form.hasAuto} onChange={e => f('hasAuto', e.target.checked)} className="rounded" />
                        <label htmlFor="hasAuto" className="text-xs text-gray-300">자동예약 지원</label>
                    </div>
                    {form.hasAuto && (
                        <div>
                            <p className="text-gray-400 text-xs mb-2">예약 오픈 규칙 (KST 기준)</p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-gray-500 text-xs block mb-1">며칠 전 오픈</label>
                                    <input type="number" min={1} max={180} value={form.advanceDays}
                                        onChange={e => f('advanceDays', Number(e.target.value) as any)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="30" />
                                </div>
                                <div>
                                    <label className="text-gray-500 text-xs block mb-1">오픈 시 (0~23)</label>
                                    <input type="number" min={0} max={23} value={form.openHour}
                                        onChange={e => f('openHour', Number(e.target.value) as any)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-gray-500 text-xs block mb-1">오픈 분 (0~59)</label>
                                    <input type="number" min={0} max={59} value={form.openMinute}
                                        onChange={e => f('openMinute', Number(e.target.value) as any)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" placeholder="0" />
                                </div>
                            </div>
                            <p className="text-gray-600 text-[11px] mt-1">예: 30일 전 00:00 KST → advanceDays=30, 시=0, 분=0</p>
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-xs hover:text-white">취소</button>
                        <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-medium">{saving ? '저장 중...' : '저장'}</button>
                    </div>
                </div>
            )}

            {/* 목록 */}
            {loading ? (
                <div className="text-gray-500 text-xs text-center py-8">불러오는 중...</div>
            ) : courses.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-8">등록된 골프장이 없습니다.</div>
            ) : (
                <div className="space-y-2">
                    {courses.map(c => (
                        <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white text-sm font-medium">{c.name}</span>
                                    {c.hasAuto && <span className="text-[10px] bg-green-900 text-green-400 px-2 py-0.5 rounded-full">자동예약</span>}
                                    {c.hasCredential
                                        ? <span className="text-[10px] bg-blue-900 text-blue-400 px-2 py-0.5 rounded-full">🔐 인증 등록됨</span>
                                        : <span className="text-[10px] bg-red-900/60 text-red-400 px-2 py-0.5 rounded-full">인증 없음</span>
                                    }
                                </div>
                                <p className="text-gray-500 text-xs mt-0.5">{c.sido} {c.sigungu} {c.address && `· ${c.address}`}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => openEdit(c)} className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg">수정</button>
                                <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="px-2.5 py-1.5 bg-red-900/60 hover:bg-red-800 disabled:opacity-40 text-red-400 text-xs rounded-lg">{deleting === c.id ? '...' : '삭제'}</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── 서버 모니터링 패널 ──────────────────────────────────────
// ── 외부 서비스 잔액(솔라피 SMS·OpenAI 사용액) — 서버 모니터링·AI 사용량 양쪽에서 재사용 ──
// 2026-07-20 사장 지시: 부족하면 직접 충전해야 하니 상시 확인 가능하게.
const BalancesCard: React.FC = () => {
    const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.getBalances>> | null>(null);
    const [loading, setLoading] = useState(true);

    const load = React.useCallback(() => {
        setLoading(true);
        adminApi.getBalances().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

    const solapiLow = data?.solapi?.balance != null && data?.solapi?.lowBalanceThreshold != null
        && data.solapi.balance <= data.solapi.lowBalanceThreshold;

    return (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Icon name="Coins" size={13} />외부 서비스 잔액
                </p>
                <button onClick={load} className="text-xs text-blue-400 hover:text-blue-300">
                    <Icon name="RefreshCw" size={11} />
                </button>
            </div>
            {loading ? (
                <p className="text-xs text-gray-500 text-center py-3">불러오는 중...</p>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-lg p-3 ${solapiLow ? 'bg-red-950/60 border border-red-500/50' : 'bg-gray-900/60'}`}>
                        <p className="text-[11px] text-gray-400 mb-1">솔라피(문자발송)</p>
                        {data?.solapi?.error ? (
                            <p className="text-xs text-gray-500">{data.solapi.error}</p>
                        ) : (
                            <>
                                <p className={`text-lg font-bold ${solapiLow ? 'text-red-300' : 'text-white'}`}>
                                    {data?.solapi?.balance?.toLocaleString() ?? '-'}원
                                </p>
                                {solapiLow && <p className="text-[10px] text-red-400 mt-0.5">⚠️ 잔액이 낮아요, 충전이 필요할 수 있어요</p>}
                            </>
                        )}
                    </div>
                    <div className="rounded-lg p-3 bg-gray-900/60">
                        <p className="text-[11px] text-gray-400 mb-1">OpenAI(ChatGPT API)</p>
                        {data?.openai?.error ? (
                            <p className="text-xs text-gray-500">{data.openai.error}</p>
                        ) : (
                            <p className="text-lg font-bold text-white">
                                {/* Number()로 감싸 API가 문자열을 보내도 안전(2026-07-20 실사고: OpenAI
                                    amount.value가 문자열이라 monthToDateUsd가 문자열로 새 .toFixed 크래시) */}
                                ${Number.isFinite(Number(data?.openai?.monthToDateUsd)) ? Number(data?.openai?.monthToDateUsd).toFixed(2) : '-'}
                                <span className="text-[10px] text-gray-400 font-normal ml-1">이번달 누적</span>
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ServerMonitorPanel: React.FC = () => {
    const [serverTab, setServerTab] = useState<'server1' | 'server2'>('server1');

    return (
        <div className="flex-1 overflow-y-auto">
            {/* 서버 탭 */}
            <div className="flex gap-1 border-b border-gray-800 px-5 pt-4 sticky top-0 bg-gray-900/95 backdrop-blur z-10">
                <button onClick={() => setServerTab('server1')}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px flex items-center gap-2
                        ${serverTab === 'server1' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <Icon name="Server" size={13} />
                    서버1 (운영 · 34.50.27.95)
                </button>
                <button onClick={() => setServerTab('server2')}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px flex items-center gap-2
                        ${serverTab === 'server2' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    <Icon name="Bot" size={13} />
                    서버2 (에이전트 · 34.50.44.87)
                </button>
            </div>

            {serverTab === 'server1' ? <Server1MonitorView /> : <Server2MonitorView />}
        </div>
    );
};

// ── 공통 유틸 ──────────────────────────────────────────────
const fmtUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};

// ISO 시각을 "N분/시간 전"으로, maxAgeMin 초과 시 stale(오래됨) 판정.
const agoInfo = (iso?: string | null, maxAgeMin = 0) => {
    if (!iso) return { text: '기록 없음', stale: true };
    const ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms)) return { text: '기록 없음', stale: true };
    const min = Math.floor(ms / 60000);
    const text = min < 60 ? `${min}분 전` : min < 1440 ? `${Math.floor(min / 60)}시간 전` : `${Math.floor(min / 1440)}일 전`;
    return { text, stale: maxAgeMin > 0 && min > maxAgeMin };
};

const Gauge: React.FC<{ label: string; value: number; color: string; sub?: string }> = ({ label, value, color, sub }) => (
    <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-2">{label}</p>
        <div className="flex items-end gap-2 mb-2">
            <span className={`text-2xl font-bold ${color}`}>{value}%</span>
            {sub && <span className="text-xs text-gray-500 mb-0.5">{sub}</span>}
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${color.replace('text-', 'bg-')}`} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
    </div>
);

// ── 서버1 (운영) 모니터링 뷰 — 기존 컨텐츠 ─────────────────
const Server1MonitorView: React.FC = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [logDates, setLogDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [logs, setLogs] = useState<string[]>([]);
    const [logTotal, setLogTotal] = useState(0);
    const [logPage, setLogPage] = useState(1);
    const [logLevel, setLogLevel] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [errorSummary, setErrorSummary] = useState<{ today: number; yesterday: number; recent: string[] } | null>(null);

    const fetchMetrics = useCallback(() => {
        setMetricsLoading(true);
        adminApi.getMonitorMetrics()
            .then(setMetrics)
            .catch(() => {})
            .finally(() => setMetricsLoading(false));
        adminApi.getErrorSummary().then(setErrorSummary).catch(() => {});
    }, []);

    useEffect(() => {
        fetchMetrics();
        const timer = setInterval(fetchMetrics, 10000);
        adminApi.getLogDates().then(d => {
            setLogDates(d.dates);
            if (d.dates.length) setSelectedDate(d.dates[0]);
        }).catch(() => {});
        return () => clearInterval(timer);
    }, [fetchMetrics]);

    useEffect(() => {
        if (!selectedDate) return;
        setLogLoading(true);
        adminApi.getLogs(selectedDate, logPage, logLevel)
            .then(r => { setLogs(r.lines); setLogTotal(r.total); })
            .catch(() => {})
            .finally(() => setLogLoading(false));
    }, [selectedDate, logPage, logLevel]);

    const totalPages = Math.ceil(logTotal / 200);

    const logColor = (line: string) => {
        if (line.includes(' ERROR ')) return 'text-red-400';
        if (line.includes(' WARN ')) return 'text-yellow-400';
        if (line.includes(' DEBUG ')) return 'text-gray-500';
        return 'text-gray-300';
    };

    return (
        <div className="p-5 space-y-5">
            <BalancesCard />

            {/* 시스템 지표 */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">시스템 현황</p>
                    <div className="flex items-center gap-3">
                        {metrics && (
                            <span className="text-xs text-gray-500">
                                서버 업타임 {fmtUptime(metrics.uptime)} / Node {fmtUptime(metrics.nodeUptime)}
                            </span>
                        )}
                        <button onClick={fetchMetrics} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            <Icon name="RefreshCw" size={11} />새로고침
                        </button>
                    </div>
                </div>
                {/* 배포 버전 정보 */}
                <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-gray-800/60 rounded-lg border border-gray-700/50">
                    <Icon name="GitCommit" size={13} className="text-purple-400 shrink-0" />
                    <span className="text-xs text-gray-400">배포 커밋:</span>
                    <span className="text-xs font-mono text-purple-300 font-bold">{__GIT_COMMIT__}</span>
                    <span className="text-gray-600 text-xs">|</span>
                    <span className="text-xs text-gray-400">빌드:</span>
                    <span className="text-xs font-mono text-blue-300">{new Date(__BUILD_TIME__).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                </div>
                {metricsLoading && !metrics
                    ? <div className="text-center text-gray-500 text-sm py-8">불러오는 중...</div>
                    : metrics && (
                        <>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <Gauge label={`CPU (${metrics.cpu.cores}코어)`} value={metrics.cpu.loadPercent}
                                    color={metrics.cpu.loadPercent >= 80 ? 'text-red-400' : metrics.cpu.loadPercent >= 50 ? 'text-yellow-400' : 'text-green-400'}
                                    sub={metrics.cpu.model} />
                                <Gauge label="메모리" value={metrics.memory.usedPercent}
                                    color={metrics.memory.usedPercent >= 85 ? 'text-red-400' : metrics.memory.usedPercent >= 60 ? 'text-yellow-400' : 'text-blue-400'}
                                    sub={`${metrics.memory.usedMB}MB / ${metrics.memory.totalMB}MB`} />
                                {metrics.disk && (
                                    <Gauge label={`디스크 (${metrics.disk.mount})`} value={metrics.disk.usedPercent}
                                        color={metrics.disk.usedPercent >= 85 ? 'text-red-400' : metrics.disk.usedPercent >= 60 ? 'text-yellow-400' : 'text-purple-400'}
                                        sub={`${metrics.disk.usedGB}GB / ${metrics.disk.totalGB}GB`} />
                                )}
                            </div>
                            {metrics.network && (
                                <div className="bg-gray-800 rounded-xl p-4 grid grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">네트워크 인터페이스</p>
                                        <p className="text-sm font-semibold text-gray-200">{metrics.network.iface || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">수신 속도</p>
                                        <p className="text-sm font-semibold text-cyan-400">{metrics.network.rxSecKB} KB/s</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">송신 속도</p>
                                        <p className="text-sm font-semibold text-orange-400">{metrics.network.txSecKB} KB/s</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">총 수신 / 송신</p>
                                        <p className="text-xs text-gray-300">{metrics.network.rxMB} MB / {metrics.network.txMB} MB</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                }
            </div>

            {/* 운영 서비스 status (PM2 + cron + DB) */}
            {metrics?.status && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="Activity" size={11} />
                        시스템 상태 (status)
                    </p>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50">
                            <span className="text-xs text-gray-400">⚡ shared-api (PM2)</span>
                            <span className="text-xs text-gray-200 font-medium">{metrics.status.sharedApi}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50">
                            <span className="text-xs text-gray-400">📊 PostgreSQL (aichat)</span>
                            <span className="text-xs text-gray-200 font-medium">{metrics.status.database}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50">
                            <span className="text-xs text-gray-400">📦 제품추출 cron (KST 08시)</span>
                            <span className="text-xs text-gray-200 font-medium">{metrics.status.extractCron}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3">
                            <span className="text-xs text-gray-400">🌐 Nginx 리버스 프록시</span>
                            <span className="text-xs text-gray-200 font-medium">{metrics.status.nginx}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 에러 로그 요약 (최근 24h) */}
            {errorSummary && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="AlertTriangle" size={11} />
                        에러 로그 요약
                    </p>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-4 py-3 px-3 border-b border-gray-800/50">
                            <div className="flex items-baseline gap-1.5">
                                <span className={`text-2xl font-bold ${errorSummary.today > 0 ? 'text-red-400' : 'text-green-400'}`}>{errorSummary.today}</span>
                                <span className="text-xs text-gray-400">오늘</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-lg font-semibold text-gray-300">{errorSummary.yesterday}</span>
                                <span className="text-xs text-gray-500">어제</span>
                            </div>
                            {errorSummary.today === 0 && errorSummary.yesterday === 0 && (
                                <span className="text-xs text-green-400 ml-auto">✓ 에러 없음</span>
                            )}
                        </div>
                        {errorSummary.recent.length > 0 && (
                            <div className="font-mono text-[11px] leading-5 p-3 max-h-40 overflow-y-auto space-y-1">
                                {errorSummary.recent.map((l, i) => (
                                    <div key={i} className="text-red-300/90 truncate" title={l}>{l}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PM2 프로세스 목록 */}
            {metrics?.pm2 && metrics.pm2.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="Zap" size={11} />
                        PM2 프로세스
                    </p>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                        {metrics.pm2.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
                                <span className="text-xs font-mono text-gray-200">{p.name}</span>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold ${p.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                        {p.status}
                                    </span>
                                    <span className="text-xs text-gray-500">pid {p.pid}</span>
                                    <span className="text-xs text-gray-500">CPU {p.cpu}%</span>
                                    <span className="text-xs text-gray-500">{p.memMB}MB</span>
                                    <span className="text-xs text-gray-500">재시작 {p.restarts}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Docker 컨테이너 (n8n / typebot 등) */}
            {metrics?.docker && metrics.docker.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="Package" size={11} />
                        Docker 컨테이너
                    </p>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                        {metrics.docker.map((d: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
                                <span className="text-xs font-mono text-gray-200">{d.name}</span>
                                <span className="text-xs text-gray-400">{d.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* cron 작업 목록 */}
            {metrics?.cron && metrics.cron.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Icon name="Clock" size={11} />
                        Cron 작업
                    </p>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden font-mono text-[11px] leading-5 p-3 max-h-48 overflow-y-auto">
                        {metrics.cron.map((c: string, i: number) => (
                            <div key={i} className="text-gray-300 py-0.5">{c}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* 로그 뷰어 */}
            <div>
                <p className="text-sm font-semibold text-white mb-3">서버 로그</p>
                <div className="flex items-center gap-2 mb-3">
                    <select
                        value={selectedDate}
                        onChange={e => { setSelectedDate(e.target.value); setLogPage(1); }}
                        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2"
                    >
                        {logDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                        value={logLevel}
                        onChange={e => { setLogLevel(e.target.value); setLogPage(1); }}
                        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2"
                    >
                        <option value="">전체</option>
                        <option value="error">ERROR</option>
                        <option value="warn">WARN</option>
                        <option value="info">INFO</option>
                    </select>
                    <span className="text-xs text-gray-500 ml-auto">총 {logTotal.toLocaleString()}줄</span>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    {logLoading
                        ? <div className="text-center text-gray-500 text-xs py-8">불러오는 중...</div>
                        : logs.length === 0
                            ? <div className="text-center text-gray-500 text-xs py-8">로그 없음</div>
                            : (
                                <div className="overflow-x-auto max-h-80 font-mono text-[11px] leading-5">
                                    {logs.map((line, i) => (
                                        <div key={i} className={`px-3 py-0.5 border-b border-gray-800/50 hover:bg-gray-800/30 ${logColor(line)}`}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            )
                    }
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                        <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                            className="px-3 py-1.5 text-xs bg-gray-800 rounded-lg disabled:opacity-40 text-gray-300 hover:bg-gray-700">이전</button>
                        <span className="text-xs text-gray-400">{logPage} / {totalPages}</span>
                        <button onClick={() => setLogPage(p => Math.min(totalPages, p + 1))} disabled={logPage === totalPages}
                            className="px-3 py-1.5 text-xs bg-gray-800 rounded-lg disabled:opacity-40 text-gray-300 hover:bg-gray-700">다음</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── 서버2 (에이전트) 모니터링 뷰 ───────────────────────────
const Server2MonitorView: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

    const fetchData = useCallback(() => {
        setLoading(true);
        setError(null);
        adminApi.getServer2Metrics()
            .then((d: any) => { setData(d); setError(null); })
            .catch((e: any) => {
                setError({ message: e?.message || '서버2 접속 실패', hint: e?.hint });
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchData();
        const timer = setInterval(fetchData, 15000);
        return () => clearInterval(timer);
    }, [fetchData]);

    const StatusRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
        <div className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
            <span className="text-xs text-gray-400">{label}</span>
            <span className={`text-xs text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
        </div>
    );

    return (
        <div className="p-5 space-y-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-white">
                        서버2 — {data?.role || '에이전트 전용'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {data?.host ? `${data.host} · ` : ''}{data?.ip || '34.50.44.87'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {data && (
                        <span className="text-xs text-gray-500">업타임 {fmtUptime(data.uptime)}</span>
                    )}
                    <button onClick={fetchData} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <Icon name="RefreshCw" size={11} />새로고침
                    </button>
                </div>
            </div>

            {/* 로딩/에러 */}
            {loading && !data && !error && (
                <div className="text-center text-gray-500 text-sm py-8">불러오는 중...</div>
            )}
            {error && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-300 mb-1">서버2 접속 실패</p>
                    <p className="text-xs text-red-200/80">{error.message}</p>
                    {error.hint && <p className="text-xs text-gray-400 mt-2">💡 {error.hint}</p>}
                </div>
            )}

            {data && (
                <>
                    {/* 시스템 메트릭 */}
                    <div className="grid grid-cols-3 gap-3">
                        <Gauge label={`CPU (${data.cpu.cores}코어)`} value={data.cpu.loadPercent}
                            color={data.cpu.loadPercent >= 80 ? 'text-red-400' : data.cpu.loadPercent >= 50 ? 'text-yellow-400' : 'text-green-400'}
                            sub={`load ${data.cpu.load1?.toFixed(2) ?? '-'}`} />
                        <Gauge label="메모리" value={data.memory.usedPercent}
                            color={data.memory.usedPercent >= 85 ? 'text-red-400' : data.memory.usedPercent >= 60 ? 'text-yellow-400' : 'text-blue-400'}
                            sub={`${data.memory.usedMB}MB / ${data.memory.totalMB}MB`} />
                        <Gauge label={`디스크 (${data.disk.mount})`} value={data.disk.usedPercent}
                            color={data.disk.usedPercent >= 85 ? 'text-red-400' : data.disk.usedPercent >= 60 ? 'text-yellow-400' : 'text-purple-400'}
                            sub={`${data.disk.usedGB}GB / ${data.disk.totalGB}GB`} />
                    </div>

                    {/* /status — 텔레그램 /status 출력값 (동적 검증) */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Icon name="Activity" size={11} />
                            시스템 상태 (텔레그램 /status)
                        </p>
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                            <StatusRow label="🤖 Hermes 리스너" value={data.status.hermesListener} />
                            <StatusRow label="🔍 Search Agent" value={data.status.searchAgent} />
                            <StatusRow label="💻 Dev Agent (Claude Code)" value={data.status.devAgent} />
                            <StatusRow label="📚 RAG DB" value={data.status.ragDb} />
                            <StatusRow label="👀 wiki-watcher" value={data.status.wikiWatcher} />
                            <StatusRow label="💾 wiki 백업" value={data.status.wikiBackup} />
                        </div>
                    </div>

                    {/* 사이트 점검 결과 (monitor.js — 서버2 이전) */}
                    {(() => {
                        const ms = data.monitorStatus;
                        const ago = agoInfo(ms?.lastRun, 200); // 3시간 주기 → 200분 넘으면 stale
                        return (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Icon name="Globe" size={11} />
                                    사이트 점검 (3시간 주기)
                                </p>
                                <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50">
                                        <span className="text-xs text-gray-400">마지막 점검</span>
                                        <span className={`text-xs font-medium ${ago.stale ? 'text-yellow-400' : 'text-gray-200'}`}>
                                            {ms?.lastRunKST || ago.text}{ago.stale && ms ? ' ⚠️ 지연' : ''}
                                        </span>
                                    </div>
                                    <StatusRow label="🌐 사이트 접속" value={ms ? (ms.site?.ok ? '🟢 정상' : '🔴 실패') : '⚪ 기록 없음'} />
                                    <StatusRow label="🔑 로그인 점검" value={ms ? (ms.login?.ok ? '🟢 정상' : '🔴 실패') : '⚪ 기록 없음'} />
                                </div>
                            </div>
                        );
                    })()}

                    {/* 뉴스 수집 결과 (오전/오후 슬롯) */}
                    {data.news && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Icon name="Newspaper" size={11} />
                                오늘뉴스 수집
                            </p>
                            <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                                {(['am', 'pm'] as const).map(slot => {
                                    const s = data.news.slots?.[slot];
                                    const ago = agoInfo(s?.collectedAt, 0);
                                    return (
                                        <div key={slot} className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
                                            <span className="text-xs text-gray-400">{slot === 'am' ? '🌅 오전 (06시)' : '🌇 오후 (18시)'}</span>
                                            <span className={`text-xs font-medium ${s ? 'text-gray-200' : 'text-gray-500'}`}>
                                                {s ? `🟢 ${s.categoryCount}개 · ${ago.text}` : '⚪ 미수집'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 텔레그램 /status 원본 텍스트 */}
                    {data.statusText && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Icon name="Bot" size={11} />
                                /status 원본 출력 (텔레그램 메시지)
                            </p>
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-4">
                                <pre className="text-[11px] text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
{data.statusText}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* supervisor 프로세스 */}
                    {data.supervisor && data.supervisor.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Icon name="Cpu" size={11} />
                                Supervisor 프로세스
                            </p>
                            <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                                {data.supervisor.map((s: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
                                        <span className="text-xs font-mono text-gray-200">{s.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-semibold ${s.state === 'RUNNING' ? 'text-green-400' : s.state === 'STOPPED' ? 'text-red-400' : 'text-yellow-400'}`}>
                                                {s.state}
                                            </span>
                                            <span className="text-xs text-gray-500 font-mono">{s.detail}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PM2 프로세스 */}
                    {data.pm2 && data.pm2.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Icon name="Zap" size={11} />
                                PM2 프로세스
                            </p>
                            <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                                {data.pm2.map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
                                        <span className="text-xs font-mono text-gray-200">{p.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-semibold ${p.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                                {p.status}
                                            </span>
                                            <span className="text-xs text-gray-500">pid {p.pid}</span>
                                            <span className="text-xs text-gray-500">CPU {p.cpu}%</span>
                                            <span className="text-xs text-gray-500">{p.memMB}MB</span>
                                            <span className="text-xs text-gray-500">재시작 {p.restarts}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Docker 컨테이너 */}
                    {data.docker && data.docker.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Icon name="Package" size={11} />
                                Docker 컨테이너
                            </p>
                            <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                                {data.docker.map((d: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-gray-800/50 last:border-0">
                                        <span className="text-xs font-mono text-gray-200">{d.name}</span>
                                        <span className="text-xs text-gray-400">{d.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* cron */}
                    {data.cron && data.cron.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Icon name="Clock" size={11} />
                                Cron 작업
                            </p>
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden font-mono text-[11px] leading-5 p-3">
                                {data.cron.map((c: string, i: number) => (
                                    <div key={i} className="text-gray-300 py-0.5">{c}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ──────────────────────────────────────────────────────────────
// 제품추출 관리 패널
// ──────────────────────────────────────────────────────────────
const ProductExtractPanel: React.FC = () => {
    const [subTab, setSubTab] = useState<'info' | 'schedule'>('info');

    // 스케줄 상태
    const [schedHour, setSchedHour] = useState(8);
    const [schedMinute, setSchedMinute] = useState(0);
    const [schedEnabled, setSchedEnabled] = useState(true);
    const [schedLoading, setSchedLoading] = useState(true);
    const [schedSaving, setSchedSaving] = useState(false);
    const [schedMsg, setSchedMsg] = useState<{ ok: boolean; text: string } | null>(null);

    // 즉시 실행 상태
    const [runEmail, setRunEmail] = useState('');
    const [running, setRunning] = useState(false);
    const [runMsg, setRunMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/product-extract/schedule', { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
                if (d.ok) {
                    setSchedHour(d.hour ?? 8);
                    setSchedMinute(d.minute ?? 0);
                    setSchedEnabled(d.enabled ?? true);
                }
            })
            .catch(() => {})
            .finally(() => setSchedLoading(false));
    }, []);

    const saveSchedule = async () => {
        setSchedSaving(true);
        setSchedMsg(null);
        try {
            const r = await fetch('/api/product-extract/schedule', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hour: schedHour, minute: schedMinute, enabled: schedEnabled }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || '저장 실패');
            setSchedMsg({ ok: true, text: d.message });
        } catch (e: any) {
            setSchedMsg({ ok: false, text: e.message });
        } finally {
            setSchedSaving(false);
        }
    };

    const runNow = async () => {
        if (!runEmail.trim()) { setRunMsg({ ok: false, text: '이메일을 입력해주세요.' }); return; }
        setRunning(true);
        setRunMsg(null);
        try {
            const r = await fetch('/api/product-extract/run', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryCode: '50000008', email: runEmail.trim() }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || '실행 실패');
            setRunMsg({ ok: true, text: '백그라운드에서 실행을 시작했습니다. 완료 후 이메일로 결과가 전송됩니다.' });
        } catch (e: any) {
            setRunMsg({ ok: false, text: e.message });
        } finally {
            setRunning(false);
        }
    };

    const hourLabel = (h: number) => `${h < 12 ? '오전' : '오후'} ${h === 0 ? 12 : h > 12 ? h - 12 : h}시`;

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
                {/* 헤더 */}
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-xl bg-emerald-900/40 border border-emerald-700/40">
                        <Icon name="Package" size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">제품추출 자동화</h3>
                        <p className="text-xs text-gray-500">도매매 → 도매꾹 → AI 제목 → 쿠팡윙 엑셀 → 이메일</p>
                    </div>
                </div>

                {/* 서브탭 */}
                <div className="flex gap-1 border-b border-gray-800 mb-6 mt-4">
                    {(['info', 'schedule'] as const).map(t => (
                        <button key={t} onClick={() => setSubTab(t)}
                            className={`px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px
                                ${subTab === t ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                            {t === 'info' ? '기능 설명' : '스케줄 관리'}
                        </button>
                    ))}
                </div>

                {/* ── 기능 설명 탭 ── */}
                {subTab === 'info' && (
                    <div className="space-y-5">
                        {/* 파이프라인 */}
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">파이프라인 흐름</h4>
                            <div className="flex flex-col gap-0">
                                {[
                                    { step: '1', label: '네이버 DataLab 분석', desc: '카테고리별 핫키워드 → 쿠팡 경쟁 낮은 블루오션 키워드 선별', icon: 'TrendingUp', color: 'text-blue-400 bg-blue-900/30 border-blue-700/40' },
                                    { step: '2', label: '도매매 검색', desc: 'domemedb.domeggook.com에서 키워드 검색 → 1위 상품 추출 (상품번호, 상품명)', icon: 'Search', color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700/40' },
                                    { step: '3', label: '도매꾹 가격+이미지 수집', desc: '대표이미지 (#lThumb, 760px↑) + 상세이미지 (#lInfoView, 최대 5장) + 도매가 수집', icon: 'Image', color: 'text-teal-400 bg-teal-900/30 border-teal-700/40' },
                                    { step: '4', label: 'AI 제목 생성', desc: 'Claude Haiku — 40~60자 소비자 친화 한국어 제목 자동 생성', icon: 'Bot', color: 'text-purple-400 bg-purple-900/30 border-purple-700/40' },
                                    { step: '5', label: '쿠팡윙 API 자동 등록', desc: '판매중지 상태로 업로드 (saleStartedAt: 2030-01-01). 확인 후 쿠팡윙에서 수동 활성화 필요', icon: 'Upload', color: 'text-orange-400 bg-orange-900/30 border-orange-700/40' },
                                    { step: '6', label: '엑셀 + 이메일 발송', desc: '쿠팡윙 양식 xlsx 파일 생성 → Brevo로 이메일 발송 (썸네일 + 도매꾹 링크 포함)', icon: 'Mail', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40' },
                                ].map((s, i, arr) => (
                                    <div key={s.step} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${s.color}`}>
                                                <Icon name={s.icon} size={13} />
                                            </div>
                                            {i < arr.length - 1 && <div className="w-px h-4 bg-gray-700 my-1" />}
                                        </div>
                                        <div className={`pb-4 ${i < arr.length - 1 ? '' : ''}`}>
                                            <p className="text-xs font-semibold text-white leading-tight">{s.step}. {s.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 가격 정책 */}
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">가격 정책</h4>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: '판매가', formula: '도매가 × 2.5', desc: '실제 결제 금액', color: 'text-emerald-400' },
                                    { label: '정가 (표시가)', formula: '도매가 × 3.5', desc: '할인 전 표시가', color: 'text-yellow-400' },
                                    { label: '할인율', formula: '약 28%', desc: '아이템위너 노출에 유리', color: 'text-blue-400' },
                                ].map(p => (
                                    <div key={p.label} className="bg-gray-900/60 rounded-lg p-3">
                                        <p className="text-[10px] text-gray-500 mb-1">{p.label}</p>
                                        <p className={`text-sm font-bold ${p.color}`}>{p.formula}</p>
                                        <p className="text-[10px] text-gray-600 mt-0.5">{p.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 현재 설정 */}
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">현재 설정</h4>
                            <div className="space-y-2">
                                {[
                                    { k: '활성 카테고리', v: '생활/건강 (displayCategoryCode: 80745)', color: 'text-white' },
                                    { k: '업로드 상태', v: '판매중지 → 쿠팡윙에서 수동 활성화 필요', color: 'text-yellow-400' },
                                    { k: '대표이미지 최소', v: '500×500px 이상 (760px 포맷 사용)', color: 'text-white' },
                                    { k: '이미지 CDN', v: 'Domeggook CDN 핫링크 차단 → vendorPath 방식 (쿠팡 서버가 직접 다운로드)', color: 'text-white' },
                                    { k: '로그 파일', v: '/ai_mp/product-extractor/cron.log', color: 'text-gray-400 font-mono text-[11px]' },
                                    { k: '스크립트', v: '/ai_mp/product-extractor/extractor.js', color: 'text-gray-400 font-mono text-[11px]' },
                                ].map(row => (
                                    <div key={row.k} className="flex gap-3 py-1.5 border-b border-gray-700/50 last:border-0">
                                        <span className="text-xs text-gray-500 w-36 shrink-0">{row.k}</span>
                                        <span className={`text-xs ${row.color} leading-relaxed`}>{row.v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 주의사항 */}
                        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
                            <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
                                <Icon name="AlertTriangle" size={12} /> 주의사항
                            </h4>
                            <ul className="space-y-1.5">
                                {[
                                    '업로드 후 쿠팡윙 판매관리 → 판매중지 상품에서 직접 활성화해야 판매됩니다.',
                                    '이미지 승인반려 시 원인: 500px 미달, CDN 차단. 현재 760px 포맷 사용 중.',
                                    '생활/건강 카테고리(코드 80745) 외 카테고리는 별도 코드 확인 후 추가 가능.',
                                    '도매꾹 쿠키 만료 시 스크래핑 실패 → extractor.js의 쿠키 수동 갱신 필요.',
                                    '쿠팡 HMAC 서명: 2자리 연도(yyMMdd), 구분자 없이 이어붙임 (dt+method+path+query).',
                                ].map((t, i) => (
                                    <li key={i} className="text-xs text-yellow-200/70 flex gap-2">
                                        <span className="text-yellow-500 shrink-0 mt-0.5">·</span>
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* ── 스케줄 관리 탭 ── */}
                {subTab === 'schedule' && (
                    <div className="space-y-5">
                        {/* 현재 스케줄 */}
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">자동 실행 스케줄</h4>

                            {schedLoading ? (
                                <div className="text-center text-gray-500 text-xs py-4">불러오는 중...</div>
                            ) : (
                                <div className="space-y-4">
                                    {/* 활성화 토글 */}
                                    <div className="flex items-center justify-between py-3 px-4 bg-gray-900/60 rounded-xl">
                                        <div>
                                            <p className="text-sm text-white font-medium">스케줄 자동 실행</p>
                                            <p className="text-xs text-gray-500 mt-0.5">crontab에 등록된 자동 실행 여부</p>
                                        </div>
                                        <button
                                            onClick={() => setSchedEnabled(e => !e)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${schedEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
                                        >
                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${schedEnabled ? 'left-6' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    {/* 시간 선택 */}
                                    <div className={`space-y-3 transition-opacity ${schedEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                        <p className="text-xs text-gray-400">실행 시각</p>
                                        <div className="flex gap-3 items-center">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 mb-1 block">시 (0~23)</label>
                                                <select
                                                    value={schedHour}
                                                    onChange={e => setSchedHour(Number(e.target.value))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                                >
                                                    {Array.from({ length: 24 }, (_, h) => (
                                                        <option key={h} value={h}>{hourLabel(h)} ({h}시)</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 mb-1 block">분</label>
                                                <select
                                                    value={schedMinute}
                                                    onChange={e => setSchedMinute(Number(e.target.value))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                                >
                                                    {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                                                        <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-500 mb-1 block">미리보기</label>
                                                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono">
                                                    {schedEnabled
                                                        ? `매일 ${hourLabel(schedHour)} ${String(schedMinute).padStart(2, '0')}분`
                                                        : '비활성화'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 저장 */}
                                    <button
                                        onClick={saveSchedule}
                                        disabled={schedSaving}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                                    >
                                        {schedSaving ? '저장 중...' : '스케줄 저장'}
                                    </button>

                                    {schedMsg && (
                                        <p className={`text-xs text-center ${schedMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {schedMsg.text}
                                        </p>
                                    )}

                                    <div className="bg-gray-900/60 rounded-lg px-4 py-2.5 mt-1">
                                        <p className="text-[10px] text-gray-500 font-mono">
                                            cron: {schedEnabled
                                                ? `${schedMinute} ${schedHour} * * * node extractor.js 50000008`
                                                : '# (비활성화됨)'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 즉시 실행 */}
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">지금 바로 실행</h4>
                            <p className="text-xs text-gray-500 mb-4">생활/건강 카테고리 제품 1개를 지금 즉시 추출하여 이메일로 전송합니다.</p>

                            <div className="mb-3">
                                <label className="text-[10px] text-gray-400 mb-1 block">결과 받을 이메일</label>
                                <input
                                    type="email"
                                    value={runEmail}
                                    onChange={e => setRunEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <button
                                onClick={runNow}
                                disabled={running}
                                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Icon name="Play" size={14} />
                                {running ? '실행 중...' : '지금 실행'}
                            </button>

                            {runMsg && (
                                <p className={`text-xs mt-3 ${runMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {runMsg.text}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── AI 사용량 대시보드 ───────────────────────────────────────────
const SERVICE_COLOR: Record<string, string> = {
    openai:    '#10a37f',
    anthropic: '#d97706',
    gemini:    '#4285f4',
};
const SERVICE_LABEL: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini',
};
const FEATURE_LABEL: Record<string, string> = {
    stock: '주식분석', luxury: '명품감정', 'used-item': '중고시세',
    chat: '채팅', research: '리서치',
};

const AiUsagePanel: React.FC = () => {
    const [days, setDays] = React.useState(30);
    const [data, setData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const load = async (d: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/ai-usage?days=${d}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const json = await res.json();
            if (!res.ok || json?.error) {
                setError(json?.error || `요청 실패 (HTTP ${res.status})`);
                setData(null);
            } else {
                setData(json);
            }
        } catch (e: any) {
            setError(e?.message || '네트워크 오류');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => { load(days); }, [days]);

    const dailyMap: Record<string, Record<string, { cost: number; calls: number }>> = {};
    if (data?.daily) {
        for (const r of data.daily) {
            const d = String(r.date).slice(0, 10);
            if (!dailyMap[d]) dailyMap[d] = {};
            if (!dailyMap[d][r.service]) dailyMap[d][r.service] = { cost: 0, calls: 0 };
            dailyMap[d][r.service].cost += r.cost;
            dailyMap[d][r.service].calls += r.calls;
        }
    }
    const dailyDates = Object.keys(dailyMap).sort();
    const maxDayCost = Math.max(...dailyDates.map(d => Object.values(dailyMap[d]).reduce((s, v) => s + v.cost, 0)), 0.001);
    const fmt = (v: number) => v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📊 AI 사용량 대시보드
                    <span className="text-xs font-normal text-gray-400">(지금부터 누적)</span>
                </h2>
                <div className="flex gap-2">
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                days === d ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >{d}일</button>
                    ))}
                </div>
            </div>

            <BalancesCard />

            {loading && <div className="text-center text-gray-400 py-8">불러오는 중...</div>}

            {!loading && error && (
                <div className="bg-red-900/40 border border-red-700 text-red-200 rounded-lg p-4 text-center">
                    오류: {error}
                </div>
            )}

            {!loading && !error && data && (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: '총 비용', value: fmt(Number(data?.total?.cost ?? 0)), sub: `${Number(data?.total?.calls ?? 0)}회 호출` },
                            { label: '총 토큰', value: Number(data?.total?.tokens ?? 0).toLocaleString(), sub: '토큰' },
                            { label: '평균/일', value: fmt(Number(data?.total?.cost ?? 0) / days), sub: `기준 ${days}일` },
                        ].map(c => (
                            <div key={c.label} className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
                                <div className="text-gray-400 text-xs mb-1">{c.label}</div>
                                <div className="text-white text-xl font-bold">{c.value}</div>
                                <div className="text-gray-500 text-xs mt-1">{c.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="text-gray-300 font-medium mb-3">일별 비용</div>
                        {dailyDates.length === 0 ? (
                            <div className="text-gray-500 text-center py-6">아직 데이터가 없습니다.<br/>AI 기능 사용 후 여기에 집계됩니다.</div>
                        ) : (
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {dailyDates.slice().reverse().map(date => {
                                    const services = dailyMap[date];
                                    const total = Object.values(services).reduce((s, v) => s + v.cost, 0);
                                    return (
                                        <div key={date} className="flex items-center gap-2">
                                            <span className="text-gray-400 text-xs w-20 shrink-0">{date.slice(5)}</span>
                                            <div className="flex-1 flex h-5 rounded overflow-hidden bg-gray-700">
                                                {Object.entries(services).map(([svc, v]) => (
                                                    <div key={svc}
                                                        style={{ width: `${(v.cost / maxDayCost) * 100}%`, backgroundColor: SERVICE_COLOR[svc] ?? '#666' }}
                                                        title={`${SERVICE_LABEL[svc]}: ${fmt(v.cost)} (${v.calls}회)`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-white text-xs w-16 text-right shrink-0">{fmt(total)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-700">
                            {Object.entries(SERVICE_COLOR).map(([svc, color]) => (
                                <div key={svc} className="flex items-center gap-1 text-xs text-gray-400">
                                    <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                                    {SERVICE_LABEL[svc]}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="text-gray-300 font-medium mb-3">기능별 상세</div>
                        {(!Array.isArray(data?.byFeature) || data.byFeature.length === 0) ? (
                            <div className="text-gray-500 text-center py-4">데이터 없음</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-gray-400 border-b border-gray-700">
                                        <th className="text-left pb-2">기능</th>
                                        <th className="text-left pb-2">서비스</th>
                                        <th className="text-left pb-2">모델</th>
                                        <th className="text-right pb-2">호출</th>
                                        <th className="text-right pb-2">토큰</th>
                                        <th className="text-right pb-2">비용</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.byFeature.map((r: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                            <td className="py-2 text-white">{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                                            <td className="py-2">
                                                <span className="px-2 py-0.5 rounded text-white text-xs"
                                                    style={{ backgroundColor: SERVICE_COLOR[r.service] ?? '#666' }}>
                                                    {SERVICE_LABEL[r.service] ?? r.service}
                                                </span>
                                            </td>
                                            <td className="py-2 text-gray-400">{r.model}</td>
                                            <td className="py-2 text-right text-gray-300">{r.calls.toLocaleString()}</td>
                                            <td className="py-2 text-right text-gray-300">{r.tokens.toLocaleString()}</td>
                                            <td className="py-2 text-right text-yellow-400 font-medium">{fmt(r.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
