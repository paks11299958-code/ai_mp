import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Persona, PersonaImage, PersonaVideo, Announcement, Category } from '../types';
import { personaApi, personaImageApi, personaVideoApi, settingsApi, knowledgeApi, triggerVideoApi, announcementApi, categoryApi, adminApi, AdminUser } from '../services/apiService';
import { TriggerVideo } from '../types';
import { STAGES } from '../utils/level';
import { generateImageDescription } from '../services/geminiService';
import { Icon } from './Icons';
import { pointApi } from '../services/pointService';
import { PersonaInfoTab } from './PersonaInfoTab';
import { PersonaGalleryTab } from './PersonaGalleryTab';
import { PersonaKnowledgeTab } from './PersonaKnowledgeTab';
import { PersonaTriggersTab } from './PersonaTriggersTab';
import { CleanupPanel } from './admin/CleanupPanel';
import { ToolsPanel } from './admin/ToolsPanel';

interface AdminPanelProps {
    personas: Persona[];
    onSave: (persona: Persona) => Promise<void>;
    onDelete: (id: string) => void;
    onClose: () => void;
    onImagesChanged?: (personaId: string) => void;
    user?: any;
}

const DEFAULT_IDS = ['general', 'coder', 'writer', 'translator'];

export const AdminPanel: React.FC<AdminPanelProps> = ({ personas, onSave, onDelete, onClose, onImagesChanged, user }) => {
    const [mainView, setMainView] = useState<'personas' | 'categories' | 'announcements' | 'settings' | 'cleanup' | 'points' | 'users' | 'menu-limits' | 'monitor' | 'golf-courses' | 'tools' | 'product-extract' | 'ai-usage'>('personas');
    const [selectedId, setSelectedId] = useState<string>(personas[0]?.id || '');
    const [activeTab, setActiveTab] = useState<'info' | 'gallery' | 'knowledge' | 'triggers'>('info');
    const [commonInstruction, setCommonInstruction] = useState('');
    const [heroImagePreview, setHeroImagePreview] = useState('');
    const [isSavingHeroImage, setIsSavingHeroImage] = useState(false);
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);
    const [showSavedModal, setShowSavedModal] = useState(false);

    // 회원 관리 상태
    const [userList, setUserList] = useState<AdminUser[]>([]);
    const [userListLoading, setUserListLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
    const [grantAmount, setGrantAmount] = useState('');
    const [grantDesc, setGrantDesc] = useState('');
    const [granting, setGranting] = useState(false);
    const [grantMsg, setGrantMsg] = useState<string | null>(null);
    const [bulkAmount, setBulkAmount] = useState('');
    const [bulkDesc, setBulkDesc] = useState('');
    const [bulkGranting, setBulkGranting] = useState(false);
    const [bulkMsg, setBulkMsg] = useState<string | null>(null);

    // 공지사항 관리 상태
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annCategory, setAnnCategory] = useState<'persona' | 'update' | 'news'>('update');
    const [annPersonaId, setAnnPersonaId] = useState<string>('');
    const [annIsPinned, setAnnIsPinned] = useState(false);
    const [annIsVisible, setAnnIsVisible] = useState(true);
    const [annSaving, setAnnSaving] = useState(false);
    const [annEditingId, setAnnEditingId] = useState<number | null>(null);

    // 카테고리 관리 상태
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSavingCategory, setIsSavingCategory] = useState(false);

    useEffect(() => {
        settingsApi.get().then(s => {
            setCommonInstruction(s.commonInstruction || '');
            setHeroImagePreview(s.heroImageUrl || '');
        }).catch(() => {});
        categoryApi.getAll().then(setCategories).catch(() => {});
    }, []);

    useEffect(() => {
        if (mainView === 'announcements') {
            announcementApi.getAll(true).then(setAnnouncements).catch(() => {});
        }
        if (mainView === 'users') {
            setUserListLoading(true);
            adminApi.getUsers().then(setUserList).catch(() => {}).finally(() => setUserListLoading(false));
        }
    }, [mainView]);

    const resetAnnForm = () => {
        setAnnTitle(''); setAnnContent(''); setAnnCategory('update');
        setAnnPersonaId(''); setAnnIsPinned(false); setAnnIsVisible(true); setAnnEditingId(null);
    };

    const handleAnnSave = async () => {
        if (!annTitle.trim() || !annContent.trim()) return alert('제목과 내용을 입력하세요.');
        setAnnSaving(true);
        try {
            if (annEditingId) {
                const updated = await announcementApi.update(annEditingId, { title: annTitle, content: annContent, category: annCategory, isPinned: annIsPinned, isVisible: annIsVisible, personaId: annPersonaId || null });
                setAnnouncements(prev => prev.map(a => a.id === annEditingId ? updated : a));
            } else {
                const created = await announcementApi.create({ title: annTitle, content: annContent, category: annCategory, isPinned: annIsPinned, isVisible: annIsVisible, personaId: annPersonaId || null });
                setAnnouncements(prev => [created, ...prev]);
            }
            resetAnnForm();
        } catch (e: any) { alert('저장 실패: ' + e.message); }
        finally { setAnnSaving(false); }
    };

    const handleAnnEdit = (a: Announcement) => {
        setAnnEditingId(a.id); setAnnTitle(a.title); setAnnContent(a.content);
        setAnnCategory(a.category); setAnnPersonaId(a.personaId || ''); setAnnIsPinned(a.isPinned); setAnnIsVisible(a.isVisible);
    };

    const handleAnnDelete = async (id: number) => {
        if (!confirm('삭제하시겠습니까?')) return;
        try {
            await announcementApi.delete(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            if (annEditingId === id) resetAnnForm();
        } catch (e: any) { alert('삭제 실패: ' + e.message); }
    };

    const handleAnnToggleVisible = async (a: Announcement) => {
        try {
            const updated = await announcementApi.update(a.id, { isVisible: !a.isVisible });
            setAnnouncements(prev => prev.map(x => x.id === a.id ? updated : x));
        } catch {}
    };

    useEffect(() => {
        setActiveTab('info');
    }, [selectedId]);

    const handleSaveGlobal = async () => {
        setIsSavingGlobal(true);
        try {
            await settingsApi.update({ commonInstruction });
            localStorage.removeItem('settings_cache');
            setShowSavedModal(true);
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setIsSavingGlobal(false);
        }
    };

    const isDefaultPersona = DEFAULT_IDS.includes(selectedId);
    const activePersona = personas.find(p => p.id === selectedId);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-900 z-40 relative animate-in fade-in duration-200">

            {/* 저장 완료 모달 */}
            {showSavedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-72 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <Icon name="Save" size={22} className="text-emerald-400" />
                        </div>
                        <p className="text-white font-semibold mb-1">저장되었습니다.</p>
                        <p className="text-xs text-gray-400 mb-5">공통 설정이 모든 페르소나에 적용됩니다.</p>
                        <button
                            onClick={() => { setShowSavedModal(false); setMainView('personas'); }}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-xl transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

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
                <nav className="flex gap-1 px-4 pb-0">
                    {([
                        { key: 'personas',      label: '페르소나', icon: 'Bot' },
                        { key: 'categories',    label: '카테고리', icon: 'Tag' },
                        { key: 'announcements', label: '공지사항', icon: 'Megaphone' },
                        { key: 'settings',      label: '공통 설정', icon: 'Settings' },
                        { key: 'cleanup',       label: '메시지 정리', icon: 'Trash2' },
                        { key: 'points',        label: '포인트 통계', icon: 'Coins' },
                        { key: 'users',         label: '회원 관리',   icon: 'Users' },
                        { key: 'menu-limits',   label: '메뉴권한',    icon: 'Shield' },
                        { key: 'monitor',       label: '서버 모니터', icon: 'Activity' },
                        { key: 'ai-usage',      label: 'AI 사용량',   icon: 'BarChart2' },
                        { key: 'golf-courses',  label: '골프장 관리', icon: 'MapPin'   },
                        { key: 'tools',          label: '기능연습',    icon: 'Zap'      },
                        { key: 'product-extract', label: '제품추출',   icon: 'Package'  },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setMainView(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap
                                ${mainView === tab.key
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Icon name={tab.icon} size={12} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* ── 바디 ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* 좌측: 페르소나 목록 (페르소나 탭에서만 표시) */}
                {mainView === 'personas' && <aside className="w-52 shrink-0 border-r border-gray-800 flex flex-col bg-gray-900/60">
                    <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">페르소나</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {personas.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group
                                    ${selectedId === p.id
                                        ? `bg-gradient-to-r ${p.colorClass} text-white shadow-md`
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                            >
                                {p.imageUrl ? (
                                    <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className={`w-8 h-8 rounded-lg object-cover shrink-0 border-2 transition-all ${
                                            selectedId === p.id ? 'border-white/40' : 'border-transparent'
                                        }`}
                                    />
                                ) : (
                                    <div className={`p-1.5 rounded-lg shrink-0 transition-colors
                                        ${selectedId === p.id ? 'bg-white/20' : 'bg-gray-800 group-hover:bg-gray-700'}`}>
                                        <Icon name={p.iconName} size={15} />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    {p.description && (
                                        <p className={`text-[10px] truncate ${selectedId === p.id ? 'text-white/70' : 'text-gray-600'}`}>
                                            {p.description}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="p-2 border-t border-gray-800">
                        <button
                            onClick={() => setSelectedId('new')}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border border-dashed
                                ${selectedId === 'new'
                                    ? 'bg-gray-800 text-white border-blue-500'
                                    : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300 border-gray-700'
                                }`}
                        >
                            <Icon name="Plus" size={15} />
                            새 AI 추가
                        </button>
                    </div>
                </aside>}

                {/* 우측: 탭 콘텐츠 */}
                <div className="flex-1 flex flex-col overflow-hidden">

                {/* 공통 설정 패널 */}
                {mainView === 'settings' && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="Settings" size={16} className="text-purple-400" />
                                <h3 className="text-sm font-bold text-white">공통 시스템 프롬프트</h3>
                                <span className="text-xs text-gray-500">— 모든 페르소나에 자동 적용</span>
                            </div>
                            <div className="bg-purple-900/10 border border-purple-800/30 rounded-xl px-4 py-3 text-xs text-purple-300 leading-relaxed">
                                여기에 입력한 내용이 <span className="font-semibold">모든 페르소나의 행동 지침 앞</span>에 자동으로 삽입됩니다.<br />
                                사용자 요청 우선 규칙, 언어 설정, 공통 금지 사항 등에 활용하세요.
                            </div>
                            <textarea
                                value={commonInstruction}
                                onChange={e => setCommonInstruction(e.target.value)}
                                rows={12}
                                className="w-full bg-gray-800 border border-purple-900/40 rounded-xl px-3.5 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none resize-y leading-relaxed"
                                placeholder={`[사용자 요청 우선]\n- 사용자가 호칭, 말투, 역할 등을 변경 요청하면 즉시 따른다\n- 시스템 설정보다 사용자의 실시간 요청을 우선시한다\n\n[공통 규칙]\n- 항상 한국어로 대화한다`}
                            />
                            <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                                <button onClick={() => setMainView('personas')}
                                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                                    취소
                                </button>
                                <div className="ml-auto">
                                    <button onClick={handleSaveGlobal} disabled={isSavingGlobal}
                                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center transition-colors">
                                        <Icon name="Save" size={15} className="mr-2" />
                                        {isSavingGlobal ? '저장 중...' : '저장'}
                                    </button>
                                </div>
                            </div>

                            {/* 히어로 이미지 */}
                            <div className="pt-4 border-t border-gray-700/50 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Icon name="Image" size={16} className="text-blue-400" />
                                    <h3 className="text-sm font-bold text-white">랜딩 히어로 이미지</h3>
                                    <span className="text-xs text-gray-500">— 히어로 섹션 오른쪽에 표시</span>
                                </div>
                                <div className="flex gap-3 items-start">
                                    {heroImagePreview && (
                                        <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-gray-700 flex-shrink-0">
                                            <img src={heroImagePreview} alt="hero preview" className="w-full h-full object-cover" />
                                            <button
                                                onClick={async () => {
                                                    await settingsApi.update({ heroImageUrl: '' });
                                                    setHeroImagePreview('');
                                                }}
                                                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                                            >×</button>
                                        </div>
                                    )}
                                    <label className="flex flex-col items-center justify-center w-40 h-28 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl cursor-pointer transition-colors text-gray-500 hover:text-blue-400 text-xs gap-1">
                                        <Icon name="Upload" size={20} />
                                        <span>{isSavingHeroImage ? '업로드 중...' : '이미지 선택'}</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setIsSavingHeroImage(true);
                                            const reader = new FileReader();
                                            reader.onload = async ev => {
                                                const base64 = ev.target?.result as string;
                                                try {
                                                    await settingsApi.update({ heroImageUrl: base64 });
                                                    const s = await settingsApi.get();
                                                    setHeroImagePreview(s.heroImageUrl || base64);
                                                } finally {
                                                    setIsSavingHeroImage(false);
                                                }
                                            };
                                            reader.readAsDataURL(file);
                                            e.target.value = '';
                                        }} />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-600">권장: 가로형 이미지 (예: 페르소나 카드 합성 이미지)</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 메시지 정리 패널 */}
                {mainView === 'cleanup' && <CleanupPanel />}

                {/* 포인트 통계 패널 */}
                {mainView === 'points' && <AdminPointStats />}

                {/* 회원 관리 패널 */}
                {mainView === 'users' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* 일괄 포인트 지급 */}
                        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                <Icon name="Zap" size={15} className="text-yellow-400" />
                                전체 회원 일괄 무료 포인트 지급
                            </h3>
                            <div className="flex gap-3 flex-wrap">
                                <input
                                    type="number"
                                    placeholder="지급 포인트"
                                    value={bulkAmount}
                                    onChange={e => setBulkAmount(e.target.value)}
                                    className="w-36 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="지급 사유 (선택)"
                                    value={bulkDesc}
                                    onChange={e => setBulkDesc(e.target.value)}
                                    className="flex-1 min-w-40 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    disabled={bulkGranting || !bulkAmount || Number(bulkAmount) <= 0}
                                    onClick={async () => {
                                        if (!window.confirm(`전체 ${userList.length}명에게 ${bulkAmount}포인트를 지급합니다. 계속하시겠습니까?`)) return;
                                        setBulkGranting(true); setBulkMsg(null);
                                        try {
                                            const r = await adminApi.bulkGrant(Number(bulkAmount), bulkDesc || undefined);
                                            setBulkMsg(`✅ ${r.userCount}명에게 ${r.granted}포인트 지급 완료`);
                                            setBulkAmount(''); setBulkDesc('');
                                            adminApi.getUsers().then(setUserList).catch(() => {});
                                        } catch { setBulkMsg('❌ 오류가 발생했습니다.'); }
                                        finally { setBulkGranting(false); }
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {bulkGranting ? '지급 중...' : '전체 지급'}
                                </button>
                            </div>
                            {bulkMsg && <p className="mt-2 text-xs text-gray-300">{bulkMsg}</p>}
                        </div>

                        {/* 개인 포인트 지급 */}
                        {grantTarget && (
                            <div className="bg-gray-800 rounded-xl p-5 border border-blue-700">
                                <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                                    <Icon name="Gift" size={15} className="text-blue-400" />
                                    개인 포인트 지급 — <span className="text-blue-300">{grantTarget.email ?? grantTarget.phone}</span>
                                </h3>
                                <div className="flex gap-3 flex-wrap">
                                    <input
                                        type="number"
                                        placeholder="지급 포인트"
                                        value={grantAmount}
                                        onChange={e => setGrantAmount(e.target.value)}
                                        className="w-36 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="지급 사유 (선택)"
                                        value={grantDesc}
                                        onChange={e => setGrantDesc(e.target.value)}
                                        className="flex-1 min-w-40 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        disabled={granting || !grantAmount || Number(grantAmount) <= 0}
                                        onClick={async () => {
                                            setGranting(true); setGrantMsg(null);
                                            try {
                                                const r = await adminApi.grantPoints(grantTarget.email ?? grantTarget.phone ?? '', Number(grantAmount), grantDesc || undefined);
                                                setGrantMsg(`✅ ${r.email}에게 ${r.granted}포인트 지급 완료 (잔액: ${r.newBalance})`);
                                                setGrantAmount(''); setGrantDesc(''); setGrantTarget(null);
                                                adminApi.getUsers().then(setUserList).catch(() => {});
                                            } catch { setGrantMsg('❌ 오류가 발생했습니다.'); }
                                            finally { setGranting(false); }
                                        }}
                                        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {granting ? '지급 중...' : '지급'}
                                    </button>
                                    <button onClick={() => { setGrantTarget(null); setGrantMsg(null); }}
                                        className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
                                        취소
                                    </button>
                                </div>
                                {grantMsg && <p className="mt-2 text-xs text-gray-300">{grantMsg}</p>}
                            </div>
                        )}

                        {/* 유저 목록 */}
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-700">
                                <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                                    <Icon name="Users" size={15} className="text-gray-400" />
                                    전체 회원 목록 ({userList.length}명)
                                </h3>
                                <input
                                    type="text"
                                    placeholder="이메일 / 이름 검색"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    className="w-48 px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            {userListLoading ? (
                                <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-700 text-gray-500 text-left">
                                                <th className="px-4 py-3 font-medium">이메일</th>
                                                <th className="px-4 py-3 font-medium">닉네임</th>
                                                <th className="px-4 py-3 font-medium text-right">유료P</th>
                                                <th className="px-4 py-3 font-medium text-right">무료P</th>
                                                <th className="px-4 py-3 font-medium text-right">세션</th>
                                                <th className="px-4 py-3 font-medium">가입일</th>
                                                <th className="px-4 py-3 font-medium">역할</th>
                                                <th className="px-4 py-3 font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {userList
                                                .filter(u => {
                                                    const q = userSearch.toLowerCase();
                                                    const identifier = u.email ?? u.phone ?? '';
                                                    return !q || identifier.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
                                                })
                                                .map(u => (
                                                    <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                                                        <td className="px-4 py-3 text-gray-200">{u.email ?? u.phone}</td>
                                                        <td className="px-4 py-3 text-gray-400">{u.username || '—'}</td>
                                                        <td className="px-4 py-3 text-right text-blue-300">{u.paidPoints.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-yellow-300">{u.bonusPoints.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-gray-400">{u.sessionCount}</td>
                                                        <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={u.role}
                                                                onChange={async (e) => {
                                                                    const newRole = e.target.value;
                                                                    if (!window.confirm(`${u.email ?? u.phone} 의 등급을 ${newRole}로 변경하시겠습니까?`)) return;
                                                                    try {
                                                                        await adminApi.changeRole(u.id, newRole);
                                                                        adminApi.getUsers().then(setUserList).catch(() => {});
                                                                    } catch { alert('역할 변경 실패'); }
                                                                }}
                                                                className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${u.role === 'ADMIN' ? 'bg-red-900/50 text-red-300' : u.role === 'MANAGE' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-gray-700 text-gray-400'}`}
                                                            >
                                                                <option value="USER">USER</option>
                                                                <option value="MANAGE">MANAGE</option>
                                                                <option value="ADMIN">ADMIN</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button
                                                                onClick={() => { setGrantTarget(u); setGrantMsg(null); setGrantAmount(''); setGrantDesc(''); }}
                                                                className="px-3 py-1 rounded-lg bg-blue-900/50 hover:bg-blue-800/70 text-blue-300 text-xs transition-colors"
                                                            >
                                                                포인트 지급
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                    {userList.length === 0 && (
                                        <div className="p-8 text-center text-sm text-gray-500">회원이 없습니다.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 메뉴권한 패널 */}
                {mainView === 'menu-limits' && <MenuLimitsPanel />}

                {/* 서버 모니터링 패널 */}
                {mainView === 'monitor' && <ServerMonitorPanel />}
                {mainView === 'ai-usage' && <AiUsagePanel />}

                {/* 골프장 관리 패널 */}
                {mainView === 'golf-courses' && <GolfCoursesPanel />}

                {/* 제품추출 관리 패널 */}
                {mainView === 'product-extract' && <ProductExtractPanel />}

                {/* 기능연습 패널 */}
                {mainView === 'tools' && <ToolsPanel user={user} />}

                {/* 카테고리 관리 패널 */}
                {mainView === 'categories' && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <h3 className="text-sm font-bold text-white mb-4">카테고리 관리</h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !isSavingCategory && newCategoryName.trim() && (async () => {
                                    setIsSavingCategory(true);
                                    try {
                                        const cat = await categoryApi.create(newCategoryName.trim());
                                        setCategories(prev => [...prev, cat]);
                                        setNewCategoryName('');
                                    } catch (e: any) { alert(e.message); }
                                    finally { setIsSavingCategory(false); }
                                })()}
                                placeholder="새 카테고리 이름"
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />
                            <button
                                disabled={isSavingCategory || !newCategoryName.trim()}
                                onClick={async () => {
                                    if (!newCategoryName.trim()) return;
                                    setIsSavingCategory(true);
                                    try {
                                        const cat = await categoryApi.create(newCategoryName.trim());
                                        setCategories(prev => [...prev, cat]);
                                        setNewCategoryName('');
                                    } catch (e: any) { alert(e.message); }
                                    finally { setIsSavingCategory(false); }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                추가
                            </button>
                        </div>
                        <div className="space-y-2">
                            {categories.length === 0 && (
                                <p className="text-gray-500 text-sm text-center py-8">카테고리가 없습니다.</p>
                            )}
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                                    <div>
                                        <span className="text-sm font-medium text-white">{cat.name}</span>
                                        <span className="ml-2 text-xs text-gray-500">({cat._count?.personas ?? 0}개)</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!window.confirm(`'${cat.name}' 카테고리를 삭제하시겠습니까?\n해당 카테고리의 페르소나는 미분류로 변경됩니다.`)) return;
                                            try {
                                                await categoryApi.delete(cat.id);
                                                setCategories(prev => prev.filter(c => c.id !== cat.id));
                                            } catch (e: any) { alert(e.message); }
                                        }}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <Icon name="Trash2" size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 공지사항 관리 패널 */}
                {mainView === 'announcements' && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-2xl mx-auto space-y-5">
                            <div className="flex items-center gap-2">
                                <Icon name="Megaphone" size={16} className="text-yellow-400" />
                                <h3 className="text-sm font-bold text-white">공지사항 관리</h3>
                            </div>

                            {/* 작성/수정 폼 */}
                            <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 space-y-3">
                                <p className="text-xs font-semibold text-gray-400">{annEditingId ? '공지 수정' : '새 공지 작성'}</p>
                                <input
                                    value={annTitle}
                                    onChange={e => setAnnTitle(e.target.value)}
                                    placeholder="제목"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-yellow-500 focus:outline-none"
                                />
                                <textarea
                                    value={annContent}
                                    onChange={e => setAnnContent(e.target.value)}
                                    placeholder="내용"
                                    rows={5}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-yellow-500 focus:outline-none resize-y"
                                />
                                <div className="flex items-center gap-3 flex-wrap">
                                    <select
                                        value={annCategory}
                                        onChange={e => { setAnnCategory(e.target.value as any); setAnnPersonaId(''); }}
                                        className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                                    >
                                        <option value="update">업데이트</option>
                                        <option value="persona">신규 페르소나</option>
                                        <option value="news">뉴스</option>
                                    </select>
                                    {annCategory === 'persona' && (
                                        <select
                                            value={annPersonaId}
                                            onChange={e => setAnnPersonaId(e.target.value)}
                                            className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                                        >
                                            <option value="">페르소나 선택 (선택사항)</option>
                                            {personas.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    )}
                                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                        <input type="checkbox" checked={annIsPinned} onChange={e => setAnnIsPinned(e.target.checked)} className="accent-yellow-500" />
                                        고정
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                                        <input type="checkbox" checked={annIsVisible} onChange={e => setAnnIsVisible(e.target.checked)} className="accent-yellow-500" />
                                        공개
                                    </label>
                                    <div className="ml-auto flex gap-2">
                                        {annEditingId && (
                                            <button onClick={resetAnnForm} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                                                취소
                                            </button>
                                        )}
                                        <button
                                            onClick={handleAnnSave}
                                            disabled={annSaving}
                                            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                                        >
                                            {annSaving ? '저장 중...' : annEditingId ? '수정 저장' : '등록'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 공지 목록 */}
                            <div className="space-y-2">
                                {announcements.length === 0 && (
                                    <p className="text-xs text-gray-600 text-center py-8">등록된 공지가 없습니다.</p>
                                )}
                                {announcements.map(a => {
                                    const catLabel = a.category === 'persona' ? '신규 페르소나' : a.category === 'news' ? '뉴스' : '업데이트';
                                    const catColor = a.category === 'persona' ? 'text-purple-400' : a.category === 'news' ? 'text-green-400' : 'text-blue-400';
                                    return (
                                        <div key={a.id} className={`bg-gray-800/50 border rounded-xl p-3 ${a.isVisible ? 'border-gray-700' : 'border-gray-800 opacity-50'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                        {a.isPinned && <Icon name="Pin" size={10} className="text-yellow-400 shrink-0" />}
                                                        <span className={`text-[10px] font-medium ${catColor}`}>{catLabel}</span>
                                                        {!a.isVisible && <span className="text-[10px] text-gray-600">비공개</span>}
                                                    </div>
                                                    <p className="text-sm text-white font-medium truncate">{a.title}</p>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => handleAnnToggleVisible(a)} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors" title={a.isVisible ? '숨기기' : '공개'}>
                                                        <Icon name={a.isVisible ? 'Eye' : 'EyeOff'} size={13} />
                                                    </button>
                                                    <button onClick={() => handleAnnEdit(a)} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors">
                                                        <Icon name="Save" size={13} />
                                                    </button>
                                                    <button onClick={() => handleAnnDelete(a.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                                                        <Icon name="Trash2" size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {mainView === 'personas' && <>

                    {/* 탭 바 */}
                    {selectedId !== 'new' && (
                        <div className="border-b border-gray-800 px-6 flex shrink-0">
                            {(['info', 'gallery', 'knowledge', 'triggers'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-all
                                        ${activeTab === tab
                                            ? 'border-blue-500 text-white'
                                            : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                                        }`}
                                >
                                    {tab === 'info' ? '기본 정보' : tab === 'gallery' ? '이미지 / 동영상' : tab === 'knowledge' ? '지식 창고' : '트리거 영상'}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 콘텐츠 영역 */}
                    <div className="flex-1 overflow-y-auto">

                        {/* ── 기본 정보 탭 ── */}
                        {(activeTab === 'info' || selectedId === 'new') && (
                            <PersonaInfoTab
                                selectedId={selectedId}
                                personas={personas}
                                categories={categories}
                                isDefaultPersona={isDefaultPersona}
                                onSave={onSave}
                                onDelete={(id) => { onDelete(id); setSelectedId(personas[0]?.id || 'new'); }}
                                onSelectId={setSelectedId}
                            />
                        )}

                        {/* ── 이미지 / 동영상 탭 ── */}
                        {activeTab === 'gallery' && selectedId !== 'new' && (
                            <PersonaGalleryTab personaId={selectedId} onImagesChanged={onImagesChanged} />
                        )}

                        {/* ── 지식 창고 탭 ── */}
                        {activeTab === 'knowledge' && selectedId !== 'new' && (
                            <PersonaKnowledgeTab personaId={selectedId} personas={personas} />
                        )}

                        {/* ── 트리거 영상 탭 ── */}
                        {activeTab === 'triggers' && selectedId !== 'new' && (
                            <PersonaTriggersTab personaId={selectedId} />
                        )}

                    </div>
                </>}
                </div>
            </div>
        </div>
    );
};

const FEATURE_LABELS: Record<string, string> = {
    'golf':       '골프 스윙 분석',
    'stock':      '주식 분석',
    'used-item':  '중고판매 분석',
    'hot-keyword':'핫쇼핑 키워드',
    'luxury':     '명품 감정',
    'face':       '얼굴 관상 분석',
    'quick-menu': '퀵메뉴',
};

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

    const features = Object.keys(FEATURE_LABELS);

    if (loading) return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">불러오는 중...</div>;

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-sm font-bold text-white">메뉴 권한 설정</h3>
                    <p className="text-xs text-gray-500 mt-0.5">기능별 역할별 일일 이용 횟수 및 포인트 차감을 설정합니다.</p>
                </div>
            </div>

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            <div className="space-y-4">
                {features.map(feature => (
                    <div key={feature} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-750 border-b border-gray-700 flex items-center gap-2">
                            <Icon name="Shield" size={13} className="text-blue-400" />
                            <span className="text-sm font-semibold text-gray-200">{FEATURE_LABELS[feature] ?? feature}</span>
                            <span className="text-[10px] text-gray-500 font-mono ml-1">{feature}</span>
                        </div>
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

    useEffect(() => {
        pointApi.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">불러오는 중...</div>;
    if (!stats) return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>;

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

    const fetchMetrics = useCallback(() => {
        setMetricsLoading(true);
        adminApi.getMonitorMetrics()
            .then(setMetrics)
            .catch(() => {})
            .finally(() => setMetricsLoading(false));
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
                            <span className="text-xs text-gray-400">🔍 monitor.js cron (3시간)</span>
                            <span className="text-xs text-gray-200 font-medium">{metrics.status.monitorCron}</span>
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
        <div className="p-4 space-y-6 text-sm">
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
