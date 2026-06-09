import React, { useState, useEffect, useCallback } from 'react';
import { X, BookOpen, Loader, Trash2, Plus, ChevronLeft, ChevronUp, ChevronDown, Save, Pencil, Search, Check, ExternalLink, AlertCircle, FileText } from 'lucide-react';
import { ebookApi, EbookProject, EbookTocChapter } from '../services/apiService';

// 퍼플/크림 톤 (앱 통일 — project_premium_ui_theme)
const T = {
    bg: '#FBF8F3', card: '#FFFFFF', border: '#E8DDD0', surface: '#F5F0E8',
    ink: '#2D2438', inkSoft: '#6B5F56', inkMute: '#9089A1',
    accent: '#8E6FB7', accentSoft: 'rgba(142,111,183,0.10)', accentBorder: 'rgba(142,111,183,0.4)',
};

// 자료수집 단계 칩 (접수→수집→완료)
// 단계 칩 (접수 → 수집 → 완료). state: 'done'(지난단계) | 'current'(진행중) | 'todo'(예정)
const Stage: React.FC<{ label: string; state: 'done' | 'current' | 'todo' }> = ({ label, state }) => {
    const isDone = state === 'done';
    const isCur = state === 'current';
    return (
        <span className="inline-flex items-center gap-1 rounded-full" style={{
            fontSize: 12, fontWeight: isCur ? 800 : isDone ? 700 : 500,
            padding: '4px 10px',
            color: isCur ? '#fff' : isDone ? '#fff' : T.inkMute,
            background: isCur ? T.accent : isDone ? '#7BAE7F' : '#EFE9F2',
            border: `1px solid ${isCur ? T.accent : isDone ? '#7BAE7F' : T.border}`,
            boxShadow: isCur ? '0 2px 8px -2px rgba(142,111,183,0.6)' : 'none',
        }}>
            {isCur ? <Loader size={12} className="animate-spin" /> : isDone ? <Check size={12} /> : null}
            {label}
        </span>
    );
};

interface Props { onClose: () => void; }

export const EbookBoard: React.FC<Props> = ({ onClose }) => {
    const [list, setList] = useState<EbookProject[]>([]);
    const [selected, setSelected] = useState<EbookProject | null>(null);
    const [topic, setTopic] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(true);
    // 목차 편집 모드
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editChapters, setEditChapters] = useState<EbookTocChapter[]>([]);
    const [savingToc, setSavingToc] = useState(false);
    // 2-B 자료수집: 현재 수집 중인 챕터 번호, 펼쳐진 챕터 번호
    const [collectingNo, setCollectingNo] = useState<number | null>(null);
    const [expandedNo, setExpandedNo] = useState<number | null>(null);

    // 챕터별 자료수집: 호출 → 접수→수집→완료. selected.chapters를 즉시 갱신해 단계 표시.
    const collectSources = async (no: number) => {
        if (!selected || collectingNo !== null) return;
        setCollectingNo(no);
        setError(null);
        // 낙관적 상태: 해당 챕터를 collecting으로
        const patch = (status: EbookTocChapter['sourceStatus'], sources?: EbookTocChapter['sources']) =>
            setSelected(prev => prev ? {
                ...prev,
                chapters: (prev.chapters ?? []).map(c =>
                    c.no === no ? { ...c, sourceStatus: status, ...(sources ? { sources } : {}) } : c),
            } : prev);
        patch('collecting');
        try {
            const res = await ebookApi.collectSources(selected.id, no);
            patch('done', res.sources);
            setExpandedNo(no); // 완료되면 자동으로 펼쳐 보여줌
        } catch (e: any) {
            patch('failed');
            setError(e?.message || '자료 수집에 실패했어요. 잠시 후 다시 시도해주세요.');
        } finally {
            setCollectingNo(null);
        }
    };

    const startEdit = () => {
        if (!selected) return;
        setEditTitle(selected.title || '');
        setEditChapters((selected.chapters ?? []).map(c => ({ ...c })));
        setEditing(true);
    };
    const cancelEdit = () => setEditing(false);
    const setCh = (i: number, key: 'title' | 'summary', v: string) =>
        setEditChapters(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: v } : c));
    const addCh = () => setEditChapters(prev => [...prev, { no: prev.length + 1, title: '', summary: '' }]);
    const delCh = (i: number) => setEditChapters(prev => prev.filter((_, idx) => idx !== i));
    const moveCh = (i: number, dir: -1 | 1) => setEditChapters(prev => {
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
    const saveToc = async () => {
        if (!selected || savingToc) return;
        const clean = editChapters.filter(c => c.title.trim());
        if (!clean.length) { setError('챕터가 최소 1개는 있어야 해요.'); return; }
        setSavingToc(true); setError(null);
        try {
            const updated = await ebookApi.updateToc(selected.id, editTitle.trim() || selected.topic, clean);
            setSelected(updated);
            setEditing(false);
            loadList();
        } catch (e: any) { setError(e.message || '목차 저장 실패'); }
        finally { setSavingToc(false); }
    };

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
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] tracking-widest mb-1" style={{ color: T.accent }}>전자책 목차</p>
                                            {editing
                                                ? <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                                    className="w-full text-xl font-bold rounded-lg px-2 py-1" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', border: `1px solid ${T.accentBorder}`, background: '#fff' }} />
                                                : <h2 className="text-xl font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>{selected.title || selected.topic}</h2>}
                                            <p className="text-xs mt-1" style={{ color: T.inkMute }}>주제: {selected.topic}</p>
                                        </div>
                                        {!editing
                                            ? <button onClick={startEdit} className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.accent, border: `1px solid ${T.accentBorder}`, background: T.accentSoft }}><Pencil size={12} /> 목차 수정</button>
                                            : <div className="flex gap-1.5 shrink-0">
                                                <button onClick={saveToc} disabled={savingToc} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: '#fff', background: T.accent }}>{savingToc ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} 저장</button>
                                                <button onClick={cancelEdit} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.inkMute, border: `1px solid ${T.border}` }}>취소</button>
                                              </div>}
                                    </div>
                                </div>
                                {error && editing && <p className="text-xs text-red-500 mb-2">{error}</p>}
                                {/* 목차 — 보기/편집 */}
                                {!editing ? (
                                    <div className="space-y-2">
                                        {(selected.chapters ?? []).map(ch => {
                                            const st = ch.sourceStatus ?? 'idle';
                                            const isCollecting = st === 'collecting' || collectingNo === ch.no;
                                            const isDone = st === 'done';
                                            const isFailed = st === 'failed';
                                            const open = expandedNo === ch.no;
                                            return (
                                            <div key={ch.no} className="rounded-xl p-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                                <div className="flex gap-3">
                                                    <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.accentBorder}` }}>{ch.no}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold" style={{ color: T.ink }}>{ch.title}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: T.inkSoft }}>{ch.summary}</p>

                                                        {/* 자료수집 영역 */}
                                                        <div className="mt-3">
                                                            {/* 수집 전: 큰 버튼 */}
                                                            {!isCollecting && !isDone && !isFailed && (
                                                                <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null}
                                                                    className="inline-flex items-center gap-1.5 font-bold rounded-xl disabled:opacity-40"
                                                                    style={{ fontSize: 13, padding: '8px 16px', color: '#fff', background: T.accent, boxShadow: '0 3px 10px -3px rgba(142,111,183,0.6)' }}>
                                                                    <Search size={15} /> 자료 수집하기
                                                                </button>
                                                            )}

                                                            {/* 수집 중: 또렷한 단계 표시줄 (접수 → 수집 → 완료) */}
                                                            {isCollecting && (
                                                                <div className="rounded-xl p-3" style={{ background: T.accentSoft, border: `1.5px solid ${T.accentBorder}` }}>
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <Stage label="접수" state="done" />
                                                                        <span style={{ color: T.accent, fontWeight: 700 }}>›</span>
                                                                        <Stage label="자료 수집 중" state="current" />
                                                                        <span style={{ color: T.inkMute, fontWeight: 700 }}>›</span>
                                                                        <Stage label="완료" state="todo" />
                                                                    </div>
                                                                    <p className="mt-2" style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>웹에서 자료를 찾고 있어요… 잠시만 기다려 주세요 (보통 5~15초)</p>
                                                                </div>
                                                            )}

                                                            {/* 완료: 또렷한 완료 배지 + 액션 */}
                                                            {isDone && (
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1.5 rounded-xl" style={{ fontSize: 13, fontWeight: 800, padding: '7px 14px', color: '#fff', background: '#5BA36A', boxShadow: '0 3px 10px -3px rgba(91,163,106,0.6)' }}>
                                                                        <Check size={16} strokeWidth={3} /> 수집 완료 · {ch.sources?.length ?? 0}건
                                                                    </span>
                                                                    <button onClick={() => setExpandedNo(open ? null : ch.no)} className="font-bold rounded-xl" style={{ fontSize: 13, padding: '7px 14px', color: T.accent, background: T.accentSoft, border: `1.5px solid ${T.accentBorder}` }}>
                                                                        {open ? '자료 접기 ▲' : '자료 보기 ▼'}
                                                                    </button>
                                                                    <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null} className="rounded-xl disabled:opacity-40" style={{ fontSize: 12, padding: '7px 12px', color: T.inkMute, border: `1px solid ${T.border}` }}>다시 수집</button>
                                                                </div>
                                                            )}

                                                            {/* 실패 */}
                                                            {isFailed && (
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1.5 rounded-xl" style={{ fontSize: 13, fontWeight: 700, padding: '7px 14px', color: '#fff', background: '#D04545' }}>
                                                                        <AlertCircle size={15} /> 수집 실패
                                                                    </span>
                                                                    <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null} className="font-bold rounded-xl disabled:opacity-40" style={{ fontSize: 13, padding: '7px 14px', color: '#fff', background: T.accent }}>다시 시도</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 수집된 자료 목록 (펼치기) — 어떤 형태로 와도 안전하게 문자열화 */}
                                                {open && isDone && Array.isArray(ch.sources) && ch.sources.length > 0 && (
                                                    <div className="mt-3 ml-10 space-y-2">
                                                        {ch.sources.map((s: any, si) => {
                                                            const sTitle = typeof s?.title === 'string' ? s.title : (s == null ? '' : String(s));
                                                            const sSummary = typeof s?.summary === 'string' ? s.summary : '';
                                                            const sTable = typeof s?.tableData === 'string' ? s.tableData : '';
                                                            const sUrl = typeof s?.url === 'string' ? s.url : '';
                                                            return (
                                                            <div key={si} className="rounded-lg p-2.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                                                                <p className="text-xs font-semibold flex items-start gap-1.5" style={{ color: T.ink }}>
                                                                    <FileText size={12} className="shrink-0 mt-0.5" style={{ color: T.accent }} />{sTitle}
                                                                </p>
                                                                {sSummary && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>{sSummary}</p>}
                                                                {sTable && (
                                                                    <p className="text-[10px] mt-1 px-2 py-1 rounded" style={{ color: T.inkSoft, background: '#fff', border: `1px dashed ${T.border}` }}>📊 {sTable}</p>
                                                                )}
                                                                {sUrl && (
                                                                    <a href={sUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] mt-1.5" style={{ color: T.accent }}>
                                                                        <ExternalLink size={10} /> 출처 보기
                                                                    </a>
                                                                )}
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {editChapters.map((ch, i) => (
                                            <div key={i} className="flex gap-2 rounded-xl p-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                                <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                                                    <button onClick={() => moveCh(i, -1)} disabled={i === 0} className="disabled:opacity-30"><ChevronUp size={14} style={{ color: T.inkMute }} /></button>
                                                    <span className="text-[10px] text-center" style={{ color: T.accent }}>{i + 1}</span>
                                                    <button onClick={() => moveCh(i, 1)} disabled={i === editChapters.length - 1} className="disabled:opacity-30"><ChevronDown size={14} style={{ color: T.inkMute }} /></button>
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <input value={ch.title} onChange={e => setCh(i, 'title', e.target.value)} placeholder="챕터 제목"
                                                        className="w-full text-sm font-semibold rounded-lg px-2 py-1" style={{ color: T.ink, border: `1px solid ${T.border}`, background: '#fff' }} />
                                                    <input value={ch.summary} onChange={e => setCh(i, 'summary', e.target.value)} placeholder="한 줄 요약"
                                                        className="w-full text-xs rounded-lg px-2 py-1" style={{ color: T.inkSoft, border: `1px solid ${T.border}`, background: '#fff' }} />
                                                </div>
                                                <button onClick={() => delCh(i)} className="shrink-0 self-start"><Trash2 size={14} style={{ color: '#C62828' }} /></button>
                                            </div>
                                        ))}
                                        <button onClick={addCh} className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1" style={{ color: T.accent, border: `1px dashed ${T.accentBorder}`, background: T.accentSoft }}>
                                            <Plus size={13} /> 챕터 추가
                                        </button>
                                    </div>
                                )}
                                {!editing && <p className="text-[11px] text-center mt-4" style={{ color: T.inkMute }}>
                                    ✏️ 목차를 수정하거나, 챕터별 <b style={{ color: T.accent }}>자료 수집</b>을 해보세요. 본문 생성은 곧 추가됩니다.
                                </p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
