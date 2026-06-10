import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen, Loader, Trash2, Plus, ChevronLeft, ChevronUp, ChevronDown, Save, Pencil, Search, Check, ExternalLink, AlertCircle, FileText, FileEdit, RefreshCw, ImagePlus } from 'lucide-react';
import { ebookApi, EbookProject, EbookTocChapter, EbookProvider, EbookVariant } from '../services/apiService';

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

// 본문 생성 AI 3종 (비교용)
const AI_PROVIDERS: { key: EbookProvider; label: string; emoji: string; color: string }[] = [
    { key: 'gemini', label: '제미나이', emoji: '✨', color: '#4285F4' },
    { key: 'claude', label: '클로드 Opus', emoji: '🅰️', color: '#C96442' },
    { key: 'gpt', label: '챗GPT', emoji: '🟢', color: '#10A37F' },
];

// 진행 탭 정의 (1~6 순서대로 진행)
type EbookTab = 1 | 2 | 3 | 4 | 5 | 6;
const TABS: { id: EbookTab; label: string }[] = [
    { id: 1, label: '제목' },
    { id: 2, label: '목차' },
    { id: 3, label: '목차 수정' },
    { id: 4, label: '자료 수집' },
    { id: 5, label: '초안 만들기' },
    { id: 6, label: '완성본' },
];

interface Props { onClose: () => void; }

export const EbookBoard: React.FC<Props> = ({ onClose }) => {
    const [list, setList] = useState<EbookProject[]>([]);
    const [selected, setSelected] = useState<EbookProject | null>(null);
    const [topic, setTopic] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(true);
    // 진행 탭: 1제목 2목차 3수정 4자료(배치) 5초안PDF 6완성본 (1~6 순서 진행)
    const [activeTab, setActiveTab] = useState<EbookTab>(1);
    // 목차 편집 모드 (탭3)
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editChapters, setEditChapters] = useState<EbookTocChapter[]>([]);
    const [savingToc, setSavingToc] = useState(false);
    // 탭1 제목 편집 (목차는 보존, 제목만 저장)
    const [titleDraft, setTitleDraft] = useState('');
    const [savingTitle, setSavingTitle] = useState(false);
    // 2-B 자료수집: 현재 수집 중인 챕터 번호, 펼쳐진 챕터 번호
    const [collectingNo, setCollectingNo] = useState<number | null>(null);
    const [expandedNo, setExpandedNo] = useState<number | null>(null);
    // 2-C 본문생성(3 AI 비교): 현재 생성 중인 "챕터:provider" 키, 본문 펼침, 피드백
    const [writingKey, setWritingKey] = useState<string | null>(null); // "no:provider"
    const [contentOpenNo, setContentOpenNo] = useState<number | null>(null);
    const [feedbackText, setFeedbackText] = useState<Record<string, string>>({}); // key "no:provider"

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

    // 2-C 챕터 본문 생성 (provider별 비교). 한 번에 하나(어느 AI든 진행 중이면 막음).
    const generateContent = async (no: number, provider: EbookProvider, feedback?: string) => {
        if (!selected || writingKey !== null) return;
        const key = `${no}:${provider}`;
        setWritingKey(key);
        setError(null);
        const patchVariant = (status: EbookVariant['status'], md?: string) =>
            setSelected(prev => prev ? {
                ...prev,
                chapters: (prev.chapters ?? []).map(c => {
                    if (c.no !== no) return c;
                    const cv = { ...(c.contentVariants ?? {}) };
                    cv[provider] = { status, md: md !== undefined ? md : cv[provider]?.md };
                    return { ...c, contentVariants: cv };
                }),
            } : prev);
        patchVariant('generating');
        try {
            const res = await ebookApi.generateContent(selected.id, no, provider, feedback);
            patchVariant('done', res.contentMd);
            setContentOpenNo(no);
            setFeedbackText(prev => ({ ...prev, [key]: '' }));
        } catch (e: any) {
            patchVariant('failed');
            setError(e?.message || '본문 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
        } finally {
            setWritingKey(null);
        }
    };

    // 최종본 선택/편집 상태
    const [editingMdNo, setEditingMdNo] = useState<number | null>(null); // 본문 편집 중인 챕터
    const [editMdText, setEditMdText] = useState('');
    const [savingMd, setSavingMd] = useState(false);
    const [uploadingImgNo, setUploadingImgNo] = useState<number | null>(null);

    const patchChapter = (no: number, patch: Partial<EbookTocChapter>) =>
        setSelected(prev => prev ? { ...prev, chapters: (prev.chapters ?? []).map(c => c.no === no ? { ...c, ...patch } : c) } : prev);

    // 비교본 → 최종본 선택
    const selectContent = async (no: number, provider: EbookProvider) => {
        if (!selected) return;
        try {
            const res = await ebookApi.selectContent(selected.id, no, provider);
            patchChapter(no, { contentMd: res.contentMd, finalProvider: provider });
        } catch (e: any) { setError(e?.message || '선택 실패'); }
    };

    // 최종본 편집 시작/저장
    const startEditMd = (no: number, md: string) => { setEditingMdNo(no); setEditMdText(md); };
    const saveMd = async (no: number) => {
        if (!selected || savingMd) return;
        setSavingMd(true); setError(null);
        try {
            const res = await ebookApi.saveContentMd(selected.id, no, editMdText);
            patchChapter(no, { contentMd: res.contentMd });
            setEditingMdNo(null);
        } catch (e: any) { setError(e?.message || '저장 실패'); }
        finally { setSavingMd(false); }
    };

    // 그림 자리에 이미지 업로드 → GCS → 본문의 [그림: ...]을 마크다운 이미지로 치환
    const uploadImage = async (no: number, file: File, placeholderText: string) => {
        if (!selected || uploadingImgNo !== null) return;
        setUploadingImgNo(no); setError(null);
        try {
            const { signedUrl, publicUrl } = await ebookApi.imageUploadUrl(selected.id, file.type);
            await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            // 본문에서 해당 [그림: ...] 한 줄을 마크다운 이미지로 교체
            const ch = (selected.chapters ?? []).find(c => c.no === no);
            const md = ch?.contentMd ?? '';
            const replaced = md.replace(placeholderText, `![${placeholderText.replace(/^\[그림:\s*|\]$/g, '')}](${publicUrl})`);
            const res = await ebookApi.saveContentMd(selected.id, no, replaced);
            patchChapter(no, { contentMd: res.contentMd });
        } catch (e: any) { setError(e?.message || '이미지 업로드 실패'); }
        finally { setUploadingImgNo(null); }
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

    // 탭1: 제목만 저장 (chapters는 그대로 보내 보존)
    const saveTitle = async () => {
        if (!selected || savingTitle) return;
        const t = titleDraft.trim();
        if (!t) { setError('제목을 입력해 주세요.'); return; }
        setSavingTitle(true); setError(null);
        try {
            const updated = await ebookApi.updateToc(selected.id, t, selected.chapters ?? []);
            setSelected(updated);
            loadList();
        } catch (e: any) { setError(e?.message || '제목 저장 실패'); }
        finally { setSavingTitle(false); }
    };

    const loadList = useCallback(() => {
        ebookApi.list().then(setList).catch(() => {});
    }, []);
    useEffect(() => { loadList(); }, [loadList]);

    // 선택된 전자책이 바뀌면 제목 입력값 동기화
    useEffect(() => { setTitleDraft(selected?.title || selected?.topic || ''); }, [selected?.id]);

    const handleCreate = async () => {
        if (!topic.trim() || creating) return;
        setCreating(true); setError(null);
        try {
            const { project } = await ebookApi.create(topic.trim());
            setTopic('');
            setShowForm(false);
            setSelected(project);
            setActiveTab(2); // 생성 직후 목차 탭으로
            loadList();
        } catch (e: any) {
            setError(e.message || '목차 생성에 실패했습니다.');
        } finally { setCreating(false); }
    };

    const openProject = async (id: number) => {
        try { setSelected(await ebookApi.get(id)); setShowForm(false); setActiveTab(2); setEditing(false); } catch {}
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

                                {/* ── 진행 탭 네비게이션 (1제목 → 6완성본) ── */}
                                <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                                    {TABS.map((t, i) => {
                                        const active = activeTab === t.id;
                                        return (
                                            <React.Fragment key={t.id}>
                                                {i > 0 && <span className="shrink-0 text-[10px]" style={{ color: T.inkMute }}>›</span>}
                                                <button onClick={() => { setActiveTab(t.id); if (t.id === 3) startEdit(); else setEditing(false); }}
                                                    className="shrink-0 inline-flex items-center gap-1 rounded-full font-bold transition"
                                                    style={{
                                                        fontSize: 12, padding: '5px 12px',
                                                        color: active ? '#fff' : T.inkSoft,
                                                        background: active ? T.accent : T.surface,
                                                        border: `1px solid ${active ? T.accent : T.border}`,
                                                        boxShadow: active ? '0 2px 8px -2px rgba(142,111,183,0.5)' : 'none',
                                                    }}>
                                                    <span className="inline-flex items-center justify-center rounded-full" style={{ width: 16, height: 16, fontSize: 10, background: active ? 'rgba(255,255,255,0.25)' : '#fff', color: active ? '#fff' : T.inkMute, border: active ? 'none' : `1px solid ${T.border}` }}>{t.id}</span>
                                                    {t.label}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                {/* ── 탭 4~6: 준비중 (다음 단계에서 구현) ── */}
                                {activeTab >= 4 && (
                                    <div className="rounded-2xl p-8 text-center" style={{ background: T.card, border: `1px dashed ${T.accentBorder}` }}>
                                        <BookOpen size={28} className="mx-auto mb-3" style={{ color: T.accentBorder }} />
                                        <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>
                                            {activeTab === 4 ? '자료 일괄 수집' : activeTab === 5 ? '초안 만들기 (PDF)' : '완성본 만들기'}
                                        </p>
                                        <p className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                                            {activeTab === 4 && '새벽 시간(1~5시)을 골라 전체 챕터 자료를 한 번에 수집하는 기능을 준비 중이에요.'}
                                            {activeTab === 5 && '수집된 자료로 클로드가 본문을 쓰고, 폰트 크기를 지정해 PDF로 만드는 기능을 준비 중이에요.'}
                                            {activeTab === 6 && '수정한 PDF를 올리면 표지와 북크크 양식을 입혀 최종 PDF로 만들어 드릴 예정이에요.'}
                                        </p>
                                        <p className="text-[11px] mt-3 inline-block px-3 py-1 rounded-full" style={{ color: T.accent, background: T.accentSoft }}>곧 추가됩니다</p>
                                    </div>
                                )}

                                {/* ── 탭 1~3 공통: 책 제목 카드 ── */}
                                {activeTab <= 3 && <>
                                <div className="rounded-2xl p-5 mb-4" style={{ background: 'linear-gradient(135deg, #ffffff, #f7f3fb)', border: `1px solid ${T.accentBorder}`, boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)' }}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] tracking-widest mb-1" style={{ color: T.accent }}>{activeTab === 1 ? '책 제목' : '전자책 목차'}</p>
                                            {activeTab === 1
                                                ? <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} placeholder="책 제목"
                                                    className="w-full text-xl font-bold rounded-lg px-2 py-1" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', border: `1px solid ${T.accentBorder}`, background: '#fff' }} />
                                                : <h2 className="text-xl font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>{selected.title || selected.topic}</h2>}
                                            <p className="text-xs mt-1" style={{ color: T.inkMute }}>주제: {selected.topic}</p>
                                        </div>
                                        {/* 탭3(목차 수정)에서만 저장/취소 버튼 */}
                                        {activeTab === 3 && (editing
                                            ? <div className="flex gap-1.5 shrink-0">
                                                <button onClick={saveToc} disabled={savingToc} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: '#fff', background: T.accent }}>{savingToc ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} 저장</button>
                                                <button onClick={() => { cancelEdit(); setActiveTab(2); }} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.inkMute, border: `1px solid ${T.border}` }}>취소</button>
                                              </div>
                                            : <button onClick={startEdit} className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.accent, border: `1px solid ${T.accentBorder}`, background: T.accentSoft }}><Pencil size={12} /> 편집 시작</button>)}
                                    </div>
                                </div>

                                {/* 탭1: 제목 저장 + 다음 단계 안내 */}
                                {activeTab === 1 && (
                                    <div className="mb-4">
                                        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                                        <div className="flex gap-2">
                                            <button onClick={saveTitle} disabled={savingTitle || !titleDraft.trim()} className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-50" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                                                {savingTitle ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} 제목 저장
                                            </button>
                                            <button onClick={() => setActiveTab(2)} className="inline-flex items-center gap-1 text-sm font-bold rounded-xl" style={{ padding: '8px 16px', color: T.accent, background: T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                                목차 보기 ›
                                            </button>
                                        </div>
                                        <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>제목을 정한 뒤 <b style={{ color: T.accent }}>목차</b> 탭에서 챕터 구성을 확인하세요.</p>
                                    </div>
                                )}
                                {error && editing && <p className="text-xs text-red-500 mb-2">{error}</p>}
                                {/* 탭2: 목차 보기 (단순 챕터 리스트) */}
                                {activeTab === 2 && (
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

                                                        {/* 자료수집 영역 — 탭5(초안/배치)에서 부활 예정, 현재 비활성 */}
                                                        {false && (
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
                                                                    <button onClick={() => collectSources(ch.no)} disabled={collectingNo !== null} className="inline-flex items-center gap-1 font-bold rounded-xl disabled:opacity-40" style={{ fontSize: 13, padding: '7px 14px', color: '#fff', background: '#B58F4A', boxShadow: '0 3px 10px -3px rgba(181,143,74,0.6)' }}>
                                                                        <Search size={14} /> 다시 수집
                                                                    </button>
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
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 수집된 자료 목록 (펼치기) — 어떤 형태로 와도 안전하게 문자열화 */}
                                                {false && open && isDone && Array.isArray(ch.sources) && ch.sources.length > 0 && (
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

                                                {/* 2-C 본문 생성 — 3개 AI 비교 (탭5에서 클로드 단일로 재구성 예정, 현재 비활성) */}
                                                {false && isDone && (() => {
                                                    const cOpen = contentOpenNo === ch.no;
                                                    const anyWriting = writingKey?.startsWith(`${ch.no}:`);
                                                    return (
                                                    <div className="mt-3 ml-10 pt-3" style={{ borderTop: `1px dashed ${T.border}` }}>
                                                        <p className="text-xs font-bold mb-2" style={{ color: T.ink }}>✍️ 본문 만들기 — AI별로 써보고 비교하세요</p>
                                                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                                                            {AI_PROVIDERS.map(ai => {
                                                                const v = ch.contentVariants?.[ai.key];
                                                                const st = v?.status ?? 'idle';
                                                                const writing = writingKey === `${ch.no}:${ai.key}`;
                                                                const done = st === 'done' && !!v?.md;
                                                                const failed = st === 'failed';
                                                                return (
                                                                <div key={ai.key} className="rounded-xl p-2.5" style={{ background: '#fff', border: `1.5px solid ${ai.color}55` }}>
                                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                                        <span className="text-sm">{ai.emoji}</span>
                                                                        <span className="text-xs font-bold" style={{ color: ai.color }}>{ai.label}</span>
                                                                        {done && <Check size={13} strokeWidth={3} style={{ color: ai.color, marginLeft: 'auto' }} />}
                                                                    </div>
                                                                    {writing ? (
                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: ai.color }}>
                                                                            <Loader size={11} className="animate-spin" /> 작성 중…
                                                                        </span>
                                                                    ) : (
                                                                        <button onClick={() => generateContent(ch.no, ai.key)} disabled={writingKey !== null}
                                                                            className="w-full text-[11px] font-bold rounded-lg py-1.5 disabled:opacity-40"
                                                                            style={{ color: '#fff', background: ai.color }}>
                                                                            {done ? '다시 쓰기' : failed ? '다시 시도' : '본문 작성'}
                                                                        </button>
                                                                    )}
                                                                    {failed && <p className="text-[10px] mt-1" style={{ color: '#C62828' }}>실패</p>}
                                                                </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* 결과 보기 토글 (하나라도 완료되면) */}
                                                        {AI_PROVIDERS.some(ai => ch.contentVariants?.[ai.key]?.status === 'done') && (
                                                            <button onClick={() => setContentOpenNo(cOpen ? null : ch.no)} className="mt-2 text-xs font-bold rounded-lg" style={{ padding: '6px 12px', color: T.accent, background: T.accentSoft, border: `1.5px solid ${T.accentBorder}` }}>
                                                                {cOpen ? '본문 비교 접기 ▲' : '본문 비교 보기 ▼'}
                                                            </button>
                                                        )}

                                                        {cOpen && (
                                                            <div className="mt-3 space-y-3">
                                                                {AI_PROVIDERS.filter(ai => ch.contentVariants?.[ai.key]?.md).map(ai => {
                                                                    const md = ch.contentVariants![ai.key]!.md!;
                                                                    const fbKey = `${ch.no}:${ai.key}`;
                                                                    return (
                                                                    <div key={ai.key} className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${ch.finalProvider === ai.key ? ai.color : ai.color + '55'}`, boxShadow: ch.finalProvider === ai.key ? `0 0 0 2px ${ai.color}44` : 'none' }}>
                                                                        <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: `${ai.color}14` }}>
                                                                            <span>{ai.emoji}</span>
                                                                            <span className="text-xs font-bold" style={{ color: ai.color }}>{ai.label} 본문</span>
                                                                            <span className="text-[10px]" style={{ color: T.inkMute }}>{md.length.toLocaleString()}자</span>
                                                                            <button onClick={() => selectContent(ch.no, ai.key)}
                                                                                className="ml-auto text-[11px] font-bold rounded-lg" style={{ padding: '4px 10px', color: ch.finalProvider === ai.key ? '#fff' : ai.color, background: ch.finalProvider === ai.key ? ai.color : `${ai.color}1a`, border: `1px solid ${ai.color}` }}>
                                                                                {ch.finalProvider === ai.key ? '✓ 선택됨' : '이 본문 선택'}
                                                                            </button>
                                                                        </div>
                                                                        <div className="p-4 text-sm leading-relaxed ebook-md" style={{ background: '#fff', color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
                                                                        </div>
                                                                        {/* AI별 피드백 → 다시 쓰기 */}
                                                                        <div className="px-3 py-2 flex gap-2 items-end" style={{ background: `${ai.color}08` }}>
                                                                            <textarea value={feedbackText[fbKey] ?? ''} onChange={e => setFeedbackText(prev => ({ ...prev, [fbKey]: e.target.value }))}
                                                                                placeholder="이 본문 고칠 점 (예: 더 쉽게)" rows={1}
                                                                                className="flex-1 text-xs rounded-lg px-2 py-1.5 resize-none" style={{ color: T.ink, border: `1px solid ${T.border}`, background: '#fff' }} />
                                                                            <button onClick={() => generateContent(ch.no, ai.key, (feedbackText[fbKey] ?? '').trim() || undefined)} disabled={writingKey !== null}
                                                                                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold rounded-lg disabled:opacity-40" style={{ padding: '7px 10px', color: '#fff', background: ai.color }}>
                                                                                <RefreshCw size={12} /> 다시
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* ── 최종본: 선택된 본문 편집 + 그림 자리 이미지 ── */}
                                                        {ch.contentMd && (() => {
                                                            const isEdit = editingMdNo === ch.no;
                                                            // 본문에 남은 [그림: 설명] 자리 추출(아직 이미지 안 넣은 것)
                                                            const placeholders = (ch.contentMd.match(/\[그림:[^\]]*\]/g)) ?? [];
                                                            return (
                                                            <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `2px solid ${T.accent}` }}>
                                                                <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: T.accentSoft }}>
                                                                    <Check size={14} strokeWidth={3} style={{ color: T.accent }} />
                                                                    <span className="text-xs font-bold" style={{ color: T.accent }}>최종 본문{ch.finalProvider ? ` (${AI_PROVIDERS.find(a => a.key === ch.finalProvider)?.label})` : ''}</span>
                                                                    {!isEdit && (
                                                                        <button onClick={() => startEditMd(ch.no, ch.contentMd!)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold rounded-lg" style={{ padding: '4px 10px', color: T.accent, background: '#fff', border: `1px solid ${T.accent}` }}>
                                                                            <Pencil size={11} /> 글 수정
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {isEdit ? (
                                                                    <div className="p-3">
                                                                        <textarea value={editMdText} onChange={e => setEditMdText(e.target.value)} rows={16}
                                                                            className="w-full text-xs rounded-lg px-3 py-2 resize-y" style={{ color: T.ink, border: `1px solid ${T.border}`, background: '#fff', fontFamily: 'monospace', lineHeight: 1.6 }} />
                                                                        <div className="flex gap-2 mt-2">
                                                                            <button onClick={() => saveMd(ch.no)} disabled={savingMd} className="inline-flex items-center gap-1 text-xs font-bold rounded-lg disabled:opacity-50" style={{ padding: '7px 14px', color: '#fff', background: T.accent }}>
                                                                                {savingMd ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} 저장
                                                                            </button>
                                                                            <button onClick={() => setEditingMdNo(null)} className="text-xs rounded-lg" style={{ padding: '7px 14px', color: T.inkMute, border: `1px solid ${T.border}` }}>취소</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="p-4 text-sm leading-relaxed ebook-md" style={{ background: '#fff', color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ch.contentMd}</ReactMarkdown>
                                                                        </div>
                                                                        {/* 그림 자리: 이미지 업로드 */}
                                                                        {placeholders.length > 0 && (
                                                                            <div className="px-3 pb-3 space-y-2">
                                                                                <p className="text-[11px] font-bold" style={{ color: T.inkSoft }}>🖼 이미지 넣을 자리 {placeholders.length}곳</p>
                                                                                {placeholders.map((ph, pi) => (
                                                                                    <div key={pi} className="flex items-center gap-2 rounded-lg p-2" style={{ background: T.surface, border: `1px dashed ${T.accentBorder}` }}>
                                                                                        <span className="flex-1 text-[11px] truncate" style={{ color: T.inkSoft }}>{ph}</span>
                                                                                        <label className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold rounded-lg cursor-pointer" style={{ padding: '5px 10px', color: '#fff', background: T.accent, opacity: uploadingImgNo === ch.no ? 0.5 : 1 }}>
                                                                                            {uploadingImgNo === ch.no ? <Loader size={11} className="animate-spin" /> : <ImagePlus size={12} />} 이미지 추가
                                                                                            <input type="file" accept="image/*" className="hidden" disabled={uploadingImgNo !== null}
                                                                                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(ch.no, f, ph); e.currentTarget.value = ''; }} />
                                                                                        </label>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    );
                                                })()}
                                            </div>
                                            );
                                        })}
                                        <button onClick={() => { setActiveTab(3); startEdit(); }} className="w-full py-2.5 mt-1 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5" style={{ color: T.accent, border: `1px dashed ${T.accentBorder}`, background: T.accentSoft }}>
                                            <Pencil size={14} /> 목차 수정하기 ›
                                        </button>
                                    </div>
                                )}

                                {/* 탭3: 목차 수정 (제목/챕터 편집 + 순서변경) */}
                                {activeTab === 3 && (
                                    <div className="space-y-2">
                                        {/* 제목도 함께 수정 */}
                                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="책 제목"
                                            className="w-full text-base font-bold rounded-xl px-3 py-2 mb-1" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', border: `1px solid ${T.accentBorder}`, background: '#fff' }} />
                                        {!editing && <p className="text-[11px] mb-2" style={{ color: T.inkMute }}>아래에서 챕터를 수정/추가/삭제하고 순서를 바꾼 뒤 위의 <b style={{ color: T.accent }}>저장</b>을 눌러주세요.</p>}
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
                                </>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
