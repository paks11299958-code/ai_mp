import React, { useState, useEffect, useCallback } from 'react';
import { X, BookOpen, Loader, Trash2, Plus, ChevronLeft } from 'lucide-react';
import { ebookApi, EbookProject } from '../services/apiService';

// 퍼플/크림 톤 (앱 통일 — project_premium_ui_theme)
const T = {
    bg: '#FBF8F3', card: '#FFFFFF', border: '#E8DDD0', surface: '#F5F0E8',
    ink: '#2D2438', inkSoft: '#6B5F56', inkMute: '#9089A1',
    accent: '#8E6FB7', accentSoft: 'rgba(142,111,183,0.10)', accentBorder: 'rgba(142,111,183,0.4)',
};

interface Props { onClose: () => void; }

export const EbookBoard: React.FC<Props> = ({ onClose }) => {
    const [list, setList] = useState<EbookProject[]>([]);
    const [selected, setSelected] = useState<EbookProject | null>(null);
    const [topic, setTopic] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(true);

    const loadList = useCallback(() => {
        ebookApi.list().then(setList).catch(() => {});
    }, []);
    useEffect(() => { loadList(); }, [loadList]);

    const handleCreate = async () => {
        if (!topic.trim() || creating) return;
        setCreating(true); setError(null);
        try {
            const { project } = await ebookApi.create(topic.trim());
            setTopic('');
            setShowForm(false);
            setSelected(project);
            loadList();
        } catch (e: any) {
            setError(e.message || '목차 생성에 실패했습니다.');
        } finally { setCreating(false); }
    };

    const openProject = async (id: number) => {
        try { setSelected(await ebookApi.get(id)); setShowForm(false); } catch {}
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('이 전자책을 삭제할까요?')) return;
        try { await ebookApi.remove(id); if (selected?.id === id) setSelected(null); loadList(); } catch {}
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-stretch md:items-center justify-center md:p-4" style={{ background: 'rgba(20,12,30,0.5)' }}>
            <div className="w-full md:max-w-4xl h-full md:h-auto md:max-h-[92vh] flex flex-col md:rounded-2xl overflow-hidden shadow-2xl" style={{ background: T.bg }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
                    <div className="flex items-center gap-2">
                        <BookOpen size={17} style={{ color: T.accent }} />
                        <span className="font-bold text-base" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>전자책 만들기 <span className="text-[10px] tracking-[0.15em]" style={{ color: T.accent }}>EBOOK STUDIO</span></span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18} style={{ color: T.inkMute }} /></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* 좌측: 목록 */}
                    <div className={`${selected && !showForm ? 'hidden md:flex' : 'flex'} w-full md:w-60 shrink-0 flex-col`} style={{ borderRight: `1px solid ${T.border}` }}>
                        <div className="p-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                            <button onClick={() => { setShowForm(true); setSelected(null); }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold"
                                style={{ background: T.accent, color: '#fff' }}>
                                <Plus size={14} /> 새 전자책
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {list.length === 0 && <div className="text-center text-xs py-8" style={{ color: T.inkMute }}>아직 만든 전자책이 없어요</div>}
                            {list.map(p => (
                                <button key={p.id} onClick={() => openProject(p.id)}
                                    className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 group"
                                    style={{ background: selected?.id === p.id ? T.accentSoft : 'transparent', border: `1px solid ${selected?.id === p.id ? T.accentBorder : 'transparent'}` }}>
                                    <BookOpen size={13} style={{ color: T.accent, flexShrink: 0 }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate" style={{ color: T.ink }}>{p.title || p.topic}</p>
                                        <p className="text-[10px] truncate" style={{ color: T.inkMute }}>{new Date(p.updatedAt).toLocaleDateString('ko-KR')}</p>
                                    </div>
                                    <Trash2 size={12} className="opacity-0 group-hover:opacity-100" style={{ color: '#C62828' }} onClick={(e) => handleDelete(p.id, e)} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 우측: 폼 또는 상세 */}
                    <div className="flex-1 overflow-y-auto">
                        {showForm || !selected ? (
                            <div className="p-6 max-w-lg mx-auto">
                                <div className="flex items-center gap-2 mb-2">
                                    <button onClick={onClose} className="md:hidden p-1 -ml-1"><ChevronLeft size={18} style={{ color: T.inkMute }} /></button>
                                    <h3 className="text-lg font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>어떤 책을 만들까요?</h3>
                                </div>
                                <p className="text-xs mb-4" style={{ color: T.inkSoft }}>주제를 입력하면 강지훈 작가가 초보자용 책 목차를 설계해 드려요.</p>
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder="예: AI가 처음인 당신을 위한 쉬운 AI 이야기 — AI란 무엇이고 지금 어디로 가고 있나"
                                    rows={3}
                                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none"
                                    style={{ background: T.card, border: `1px solid ${T.border}`, color: T.ink }}
                                />
                                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                                <button onClick={handleCreate} disabled={creating || !topic.trim()}
                                    className="w-full mt-3 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(135deg, ${T.accent}, #A98BC9)`, color: '#fff' }}>
                                    {creating ? <><Loader size={15} className="animate-spin" /> 목차 설계 중...</> : <><BookOpen size={15} /> 목차 만들기</>}
                                </button>
                            </div>
                        ) : (
                            <div className="p-6">
                                <button onClick={() => setShowForm(true)} className="md:hidden mb-3 flex items-center gap-1 text-xs" style={{ color: T.inkMute }}>
                                    <ChevronLeft size={14} /> 목록
                                </button>
                                {/* 책 제목 카드 */}
                                <div className="rounded-2xl p-5 mb-4" style={{ background: 'linear-gradient(135deg, #ffffff, #f7f3fb)', border: `1px solid ${T.accentBorder}`, boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)' }}>
                                    <p className="text-[10px] tracking-widest mb-1" style={{ color: T.accent }}>전자책 목차</p>
                                    <h2 className="text-xl font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>{selected.title || selected.topic}</h2>
                                    <p className="text-xs mt-1" style={{ color: T.inkMute }}>주제: {selected.topic}</p>
                                </div>
                                {/* 목차 */}
                                <div className="space-y-2">
                                    {(selected.chapters ?? []).map(ch => (
                                        <div key={ch.no} className="flex gap-3 rounded-xl p-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.accentBorder}` }}>{ch.no}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold" style={{ color: T.ink }}>{ch.title}</p>
                                                <p className="text-xs mt-0.5" style={{ color: T.inkSoft }}>{ch.summary}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-center mt-4" style={{ color: T.inkMute }}>
                                    📖 목차가 마음에 들면, 다음 단계에서 챕터별 본문을 만들 수 있어요. (준비 중)
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
