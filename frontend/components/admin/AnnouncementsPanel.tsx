import React, { useState, useEffect } from 'react';
import { Persona, Announcement } from '../../types';
import { announcementApi } from '../../services/apiService';
import { Icon } from '../Icons';
import { fmtDate } from '../../utils/datetime';

// 공지사항 관리 탭 — 작성/수정 폼 + 목록(고정/공개 토글, 수정, 삭제).
// AdminPanel #6 분해(2026-06-01). 상태 8개·핸들러 5개가 자기 탭에 갇혀 있어
// 추출. persona 카테고리 공지의 페르소나 선택용으로 personas만 prop으로 받음.
export const AnnouncementsPanel: React.FC<{ personas: Persona[] }> = ({ personas }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annCategory, setAnnCategory] = useState<'persona' | 'update' | 'news'>('update');
    const [annPersonaId, setAnnPersonaId] = useState<string>('');
    const [annIsPinned, setAnnIsPinned] = useState(false);
    const [annIsVisible, setAnnIsVisible] = useState(true);
    const [annSaving, setAnnSaving] = useState(false);
    const [annEditingId, setAnnEditingId] = useState<number | null>(null);

    useEffect(() => {
        announcementApi.getAll(true).then(setAnnouncements).catch(() => {});
    }, []);

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

    return (
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
                                        <p className="text-[11px] text-gray-500 mt-0.5">{fmtDate(a.createdAt)}</p>
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
    );
};
