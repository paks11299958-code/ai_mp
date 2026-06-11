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
// 탭 콘텐츠 ID는 기존(1책정보 / 4자료 / 5초안) 유지. 2·3은 1로 통합, 6완성본은 제거.
type EbookTab = 1 | 2 | 3 | 4 | 5 | 6;
const TABS: { id: EbookTab; label: string }[] = [
    { id: 1, label: '제목·목차' },
    { id: 4, label: '자료 수집' },
    { id: 5, label: '초안 만들기' },
];

interface Props { onClose: () => void; }

export const EbookBoard: React.FC<Props> = ({ onClose }) => {
    const [list, setList] = useState<EbookProject[]>([]);
    const [selected, setSelected] = useState<EbookProject | null>(null);
    const [topic, setTopic] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false); // 초기엔 목록 화면(주식분석 패턴). 새 전자책 클릭 시 폼
    // 진행 탭: 1제목 2목차 3수정 4자료(배치) 5초안PDF 6완성본 (1~6 순서 진행)
    const [activeTab, setActiveTab] = useState<EbookTab>(1);
    // 목차 편집 모드 (탭3)
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editChapters, setEditChapters] = useState<EbookTocChapter[]>([]);
    const [savingToc, setSavingToc] = useState(false);
    // 탭1 제목·저자 편집 (목차는 보존, 제목/저자만 저장)
    const [titleDraft, setTitleDraft] = useState('');
    const [authorDraft, setAuthorDraft] = useState('');
    const [savingTitle, setSavingTitle] = useState(false);
    // 탭5 초안: 본문 일괄 생성 + PDF
    const [drafting, setDrafting] = useState(false);
    const [rewritingNo, setRewritingNo] = useState<number | null>(null); // 챕터별 다시쓰기 중
    const [draftResults, setDraftResults] = useState<import('../services/apiService').EbookDraftResult[] | null>(null);
    const [coverMaking, setCoverMaking] = useState(false);
    const [docxMaking, setDocxMaking] = useState(false);
    const [docxUrl, setDocxUrl] = useState<string | null>(null);
    const [pdfMaking, setPdfMaking] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [fontH1, setFontH1] = useState(24);
    const [fontH2, setFontH2] = useState(15);
    const [fontBody, setFontBody] = useState(11);
    // 탭2 자료 일괄수집(예약 + 즉시)
    const [collectingAll, setCollectingAll] = useState(false);
    const [collectResults, setCollectResults] = useState<import('../services/apiService').EbookCollectResult[] | null>(null);
    const [savingSchedule, setSavingSchedule] = useState(false);
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

    const patchChapter = (no: number, patch: Partial<EbookTocChapter>) =>
        setSelected(prev => prev ? { ...prev, chapters: (prev.chapters ?? []).map(c => c.no === no ? { ...c, ...patch } : c) } : prev);

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
            const updated = await ebookApi.updateToc(selected.id, titleDraft.trim() || selected.topic, clean, authorDraft.trim() || null);
            setSelected(updated);
            setEditing(false);
            loadList();
        } catch (e: any) { setError(e.message || '목차 저장 실패'); }
        finally { setSavingToc(false); }
    };

    // 탭1: 제목·저자 저장 (chapters는 그대로 보내 보존)
    const saveTitle = async () => {
        if (!selected || savingTitle) return;
        const t = titleDraft.trim();
        if (!t) { setError('제목을 입력해 주세요.'); return; }
        setSavingTitle(true); setError(null);
        try {
            const updated = await ebookApi.updateToc(selected.id, t, selected.chapters ?? [], authorDraft.trim() || null);
            setSelected(updated);
            loadList();
        } catch (e: any) { setError(e?.message || '저장 실패'); }
        finally { setSavingTitle(false); }
    };

    // 탭5: 본문 일괄 생성 (클로드, 본문 있으면 건너뜀)
    const generateDraft = async (force = false) => {
        if (!selected || drafting) return;
        setDrafting(true); setError(null); setDraftResults(null);
        try {
            const res = await ebookApi.generateDraft(selected.id, force);
            setDraftResults(res.results);
            setSelected(prev => prev ? { ...prev, chapters: res.chapters } : prev);
            setPdfUrl(null); // 본문 바뀌면 이전 PDF 무효
        } catch (e: any) { setError(e?.message || '본문 생성 실패'); }
        finally { setDrafting(false); }
    };

    // 탭3: 이 챕터만 클로드로 본문 다시 쓰기
    const rewriteChapter = async (no: number) => {
        if (!selected || rewritingNo !== null) return;
        if (!confirm(`${no}장 본문을 클로드로 다시 쓸까요? (현재 본문은 새 본문으로 교체돼요)`)) return;
        setRewritingNo(no); setError(null);
        try {
            const res = await ebookApi.rewriteChapter(selected.id, no);
            patchChapter(no, { contentMd: res.contentMd, finalProvider: 'claude' });
            setPdfUrl(null);
        } catch (e: any) { setError(e?.message || '다시 쓰기 실패'); }
        finally { setRewritingNo(null); }
    };

    // 탭3: 책 표지 생성(gpt-image)
    const makeCover = async () => {
        if (!selected || coverMaking) return;
        setCoverMaking(true); setError(null);
        try {
            const res = await ebookApi.generateCover(selected.id);
            setSelected(prev => prev ? { ...prev, coverUrl: res.coverUrl } : prev);
            setDocxUrl(null); // 표지 바뀌면 이전 문서 무효
        } catch (e: any) { setError(e?.message || '표지 생성 실패'); }
        finally { setCoverMaking(false); }
    };

    // 탭3: 구글 독스용 .docx 생성(북크크 양식)
    const makeDocx = async () => {
        if (!selected || docxMaking) return;
        setDocxMaking(true); setError(null);
        try {
            const res = await ebookApi.generateDocx(selected.id);
            setDocxUrl(res.url);
        } catch (e: any) { setError(e?.message || '문서 생성 실패'); }
        finally { setDocxMaking(false); }
    };

    // 탭3: PDF 생성(보조)
    const makePdf = async () => {
        if (!selected || pdfMaking) return;
        setPdfMaking(true); setError(null);
        try {
            const res = await ebookApi.generatePdf(selected.id, { h1: fontH1, h2: fontH2, body: fontBody });
            setPdfUrl(res.url);
        } catch (e: any) { setError(e?.message || 'PDF 생성 실패'); }
        finally { setPdfMaking(false); }
    };

    // 탭4: 예약 시각 저장
    const saveSchedule = async (hour: number | null) => {
        if (!selected || savingSchedule) return;
        setSavingSchedule(true); setError(null);
        try {
            await ebookApi.setSchedule(selected.id, hour);
            setSelected(prev => prev ? { ...prev, scheduledHour: hour } : prev);
        } catch (e: any) { setError(e?.message || '예약 저장 실패'); }
        finally { setSavingSchedule(false); }
    };

    // 탭2: 체크된 챕터만 자료 지금 바로 수집
    const collectAll = async (force = false) => {
        if (!selected || collectingAll) return;
        setCollectingAll(true); setError(null); setCollectResults(null);
        try {
            const res = await ebookApi.collectAll(selected.id, force);
            setCollectResults(res.results);
            setSelected(prev => prev ? { ...prev, chapters: res.chapters } : prev);
        } catch (e: any) { setError(e?.message || '자료 수집 실패'); }
        finally { setCollectingAll(false); }
    };

    // 탭2: 자료수집 체크 토글 저장 (개별/전체). collect 없으면 true로 간주.
    const saveCollectFlags = async (flags: Record<string, boolean>) => {
        if (!selected) return;
        // 낙관적 갱신
        setSelected(prev => prev ? { ...prev, chapters: (prev.chapters ?? []).map(c => flags[String(c.no)] !== undefined ? { ...c, collect: flags[String(c.no)] } : c) } : prev);
        try { await ebookApi.setCollectFlags(selected.id, flags); }
        catch (e: any) { setError(e?.message || '체크 저장 실패'); }
    };
    const toggleChapterCollect = (no: number, checked: boolean) => saveCollectFlags({ [String(no)]: checked });
    const toggleAllCollect = (checked: boolean) => {
        const flags: Record<string, boolean> = {};
        (selected?.chapters ?? []).forEach(c => { flags[String(c.no)] = checked; });
        saveCollectFlags(flags);
    };

    const loadList = useCallback(() => {
        ebookApi.list().then(setList).catch(() => {});
    }, []);
    useEffect(() => { loadList(); }, [loadList]);

    // 선택된 전자책이 바뀌면 제목 입력값 동기화
    useEffect(() => {
        setTitleDraft(selected?.title || selected?.topic || '');
        setAuthorDraft(selected?.author || '');
    }, [selected?.id]);

    const handleCreate = async () => {
        if (!topic.trim() || creating) return;
        setCreating(true); setError(null);
        try {
            const { project } = await ebookApi.create(topic.trim());
            setTopic('');
            setShowForm(false);
            setSelected(project);
            setActiveTab(1); // 생성 직후 책정보(제목·목차) 탭으로
            loadList();
        } catch (e: any) {
            setError(e.message || '목차 생성에 실패했습니다.');
        } finally { setCreating(false); }
    };

    const openProject = async (id: number) => {
        try { setSelected(await ebookApi.get(id)); setShowForm(false); setActiveTab(1); setEditing(false); } catch {}
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('이 전자책을 삭제할까요?')) return;
        try { await ebookApi.remove(id); if (selected?.id === id) setSelected(null); loadList(); } catch {}
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-stretch md:items-center justify-center md:p-4" style={{ background: 'rgba(20,12,30,0.5)' }}>
            <div className="w-full md:max-w-5xl h-full md:h-auto md:max-h-[92vh] flex flex-col md:rounded-2xl overflow-hidden shadow-2xl" style={{ background: T.bg }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
                    <div className="flex items-center gap-2">
                        <BookOpen size={17} style={{ color: T.accent }} />
                        <span className="font-bold text-base" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>전자책 만들기 <span className="text-[10px] tracking-[0.15em]" style={{ color: T.accent }}>EBOOK STUDIO</span></span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18} style={{ color: T.inkMute }} /></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* 목록 화면: 전체폭 (선택·작성 전에만). 선택/작성 시 숨기고 풀폭 전환(주식분석 패턴) */}
                    <div className={`${!selected && !showForm ? 'flex' : 'hidden'} w-full shrink-0 flex-col`}>
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="max-w-4xl mx-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>내 전자책</h3>
                                    <button onClick={() => { setShowForm(true); setSelected(null); }}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                                        style={{ background: T.accent, color: '#fff' }}>
                                        <Plus size={15} /> 새 전자책
                                    </button>
                                </div>
                                {list.length === 0
                                    ? <div className="text-center text-sm py-16" style={{ color: T.inkMute }}>아직 만든 전자책이 없어요. <b style={{ color: T.accent }}>새 전자책</b>으로 시작해 보세요.</div>
                                    : (
                                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                        {list.map(p => (
                                            <button key={p.id} onClick={() => openProject(p.id)}
                                                className="text-left p-4 rounded-2xl flex flex-col gap-2 group transition hover:shadow-md"
                                                style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <BookOpen size={18} style={{ color: T.accent, flexShrink: 0 }} />
                                                    <Trash2 size={14} className="opacity-0 group-hover:opacity-100 transition" style={{ color: '#C62828' }} onClick={(e) => handleDelete(p.id, e)} />
                                                </div>
                                                <p className="text-sm font-bold leading-snug" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>{p.title || p.topic}</p>
                                                <p className="text-[11px] mt-auto" style={{ color: T.inkMute }}>{new Date(p.updatedAt).toLocaleDateString('ko-KR')}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 폼(새 전자책) 또는 상세(작업) — 목록일 땐 숨김 */}
                    <div className={`${showForm || selected ? 'flex-1' : 'hidden'} overflow-y-auto`}>
                        {showForm ? (
                            <div className="p-6 max-w-lg mx-auto">
                                <div className="flex items-center gap-2 mb-2">
                                    {list.length > 0 && (
                                        <button onClick={() => setShowForm(false)} className="inline-flex items-center gap-1 text-xs font-bold mr-1" style={{ color: T.inkMute }}>
                                            <ChevronLeft size={15} /> 목록으로
                                        </button>
                                    )}
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
                        ) : selected ? (
                            <div className="p-5 md:p-6 max-w-4xl mx-auto">
                                {/* 목록으로 복귀 (데스크탑·모바일 공통, 주식분석 패턴) */}
                                <button onClick={() => { setSelected(null); setEditing(false); }} className="mb-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: T.inkMute }}>
                                    <ChevronLeft size={15} /> 목록으로
                                </button>

                                {/* ── 진행 탭 네비게이션 (1제목 → 6완성본) ── */}
                                <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                                    {TABS.map((t, i) => {
                                        const active = activeTab === t.id;
                                        return (
                                            <React.Fragment key={t.id}>
                                                {i > 0 && <span className="shrink-0 text-[10px]" style={{ color: T.inkMute }}>›</span>}
                                                <button onClick={() => { setActiveTab(t.id); setEditing(false); }}
                                                    className="shrink-0 inline-flex items-center gap-1 rounded-full font-bold transition"
                                                    style={{
                                                        fontSize: 12, padding: '5px 12px',
                                                        color: active ? '#fff' : T.inkSoft,
                                                        background: active ? T.accent : T.surface,
                                                        border: `1px solid ${active ? T.accent : T.border}`,
                                                        boxShadow: active ? '0 2px 8px -2px rgba(142,111,183,0.5)' : 'none',
                                                    }}>
                                                    <span className="inline-flex items-center justify-center rounded-full" style={{ width: 16, height: 16, fontSize: 10, background: active ? 'rgba(255,255,255,0.25)' : '#fff', color: active ? '#fff' : T.inkMute, border: active ? 'none' : `1px solid ${T.border}` }}>{i + 1}</span>
                                                    {t.label}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                {/* ── 탭 4~6: 준비중 (다음 단계에서 구현) ── */}
                                {/* 탭4·6: 준비중 placeholder */}
                                {/* ── 탭4: 자료 일괄 수집 (예약 + 지금 바로) ── */}
                                {activeTab === 4 && (() => {
                                    const chs = selected.chapters ?? [];
                                    const total = chs.length;
                                    const withSrc = chs.filter(c => c.sourceStatus === 'done').length;
                                    // 체크: collect 필드 없으면 true로 간주(하위호환)
                                    const isChecked = (c: typeof chs[number]) => c.collect !== false;
                                    const checkedCount = chs.filter(isChecked).length;
                                    const allChecked = total > 0 && checkedCount === total;
                                    return (
                                    <div className="space-y-4">
                                        {error && <p className="text-xs text-red-500">{error}</p>}

                                        {/* 예약 시각 */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>⏰ 새벽 자동 수집 예약</p>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>새벽 시간을 골라두면 그 시각에 <b style={{ color: T.accent }}>아래에서 체크한 챕터</b>의 자료를 자동으로 모아요. (수집 끝나면 체크 자동 해제 — 아침에 열어 확인하세요)</p>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {[1, 2, 3, 4, 5].map(h => {
                                                    const on = selected.scheduledHour === h;
                                                    return (
                                                        <button key={h} onClick={() => saveSchedule(on ? null : h)} disabled={savingSchedule}
                                                            className="rounded-xl text-sm font-bold disabled:opacity-50" style={{ padding: '7px 14px', color: on ? '#fff' : T.inkSoft, background: on ? T.accent : T.surface, border: `1px solid ${on ? T.accent : T.border}` }}>
                                                            새벽 {h}시
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[11px] mt-2" style={{ color: selected.scheduledHour ? T.accent : T.inkMute }}>
                                                {selected.scheduledHour ? `매일 새벽 ${selected.scheduledHour}시에 수집 예약됨 (다시 누르면 해제)` : '예약 안 됨'}
                                            </p>
                                        </div>

                                        {/* 수집 대상 선택(체크) + 수집 */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.accentBorder}` }}>
                                            <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>수집할 챕터 선택</p>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>체크한 챕터의 자료를 모아요(예약·지금수집 모두 체크 기준). 자료가 있어도 <b style={{ color: T.accent }}>새로 수집(덮어쓰기)</b>하고, 수집이 끝나면 체크는 자동 해제돼요. 다시 받고 싶으면 다시 체크하세요. · 선택 {checkedCount}/{total} · 자료완료 {withSrc}</p>

                                            {/* 전체 선택 토글 + 수집 버튼 */}
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none" style={{ color: T.ink }}>
                                                    <input type="checkbox" checked={allChecked} onChange={e => toggleAllCollect(e.target.checked)} style={{ accentColor: T.accent, width: 15, height: 15 }} />
                                                    전체 선택
                                                </label>
                                                <span className="text-[11px]" style={{ color: T.inkMute }}>›</span>
                                                <button onClick={() => collectAll(false)} disabled={collectingAll || checkedCount === 0}
                                                    className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                                                    {collectingAll ? <><Loader size={14} className="animate-spin" /> 자료 모으는 중… (시간이 걸려요)</> : <><Search size={14} /> 선택한 챕터 수집</>}
                                                </button>
                                            </div>

                                            {/* 챕터별 체크박스 + 상태 */}
                                            {total > 0 && (
                                                <div className="mt-1 space-y-1">
                                                    {chs.map(ch => {
                                                        const r = collectResults?.find(x => x.no === ch.no);
                                                        const done = ch.sourceStatus === 'done';
                                                        const checked = isChecked(ch);
                                                        const label = r
                                                            ? (r.status === 'done' ? '수집 완료' : r.status === 'skipped' ? '기존 자료 유지' : r.status === 'unchecked' ? '제외됨' : '실패')
                                                            : (done ? '자료 있음' : ch.sourceStatus === 'failed' ? '실패' : checked ? '대기' : '제외');
                                                        const color = (r?.status === 'failed' || ch.sourceStatus === 'failed') ? '#C62828' : (done || r?.status === 'done' || r?.status === 'skipped') ? '#5BA36A' : T.inkMute;
                                                        return (
                                                            <label key={ch.no} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 cursor-pointer select-none" style={{ background: checked ? T.surface : 'transparent', opacity: checked ? 1 : 0.55 }}>
                                                                <input type="checkbox" checked={checked} onChange={e => toggleChapterCollect(ch.no, e.target.checked)} style={{ accentColor: T.accent, width: 15, height: 15, flexShrink: 0 }} />
                                                                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: T.accentSoft, color: T.accent }}>{ch.no}</span>
                                                                <span className="flex-1 truncate" style={{ color: T.ink }}>{ch.title}</span>
                                                                <span className="shrink-0 font-semibold" style={{ color }}>{label}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* ── 탭3(초안): 본문 일괄 생성 → 문서(.docx)/PDF ── */}
                                {activeTab === 5 && (() => {
                                    const chs = selected.chapters ?? [];
                                    const total = chs.length;
                                    const withSrc = chs.filter(c => c.sourceStatus === 'done').length;
                                    const withBody = chs.filter(c => typeof c.contentMd === 'string' && c.contentMd.trim()).length;
                                    const canPdf = withBody > 0;
                                    return (
                                    <div className="space-y-4">
                                        {error && <p className="text-xs text-red-500">{error}</p>}

                                        {/* 1단계: 본문 만들기 */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ width: 18, height: 18, background: T.accent, color: '#fff' }}>1</span>
                                                <p className="text-sm font-bold" style={{ color: T.ink }}>전체 본문 만들기</p>
                                            </div>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>
                                                자료가 수집된 챕터를 <b style={{ color: '#C96442' }}>클로드</b>가 본문으로 써요.
                                                이미 본문이 있는 챕터는 건너뜁니다. · 전체 {total} · 자료완료 {withSrc} · 본문완료 {withBody}
                                            </p>
                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={() => generateDraft(false)} disabled={drafting || withSrc === 0}
                                                    className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                                                    {drafting ? <><Loader size={14} className="animate-spin" /> 본문 작성 중… (시간이 걸려요)</> : <><FileText size={14} /> 전체 본문 만들기</>}
                                                </button>
                                                {withBody > 0 && !drafting && (
                                                    <button onClick={() => { if (confirm('이미 만든 본문도 전부 다시 쓸까요?')) generateDraft(true); }}
                                                        className="inline-flex items-center gap-1 text-xs font-bold rounded-xl" style={{ padding: '8px 12px', color: T.accent, background: T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                                        <RefreshCw size={12} /> 전부 다시 쓰기
                                                    </button>
                                                )}
                                            </div>
                                            {withSrc === 0 && <p className="text-[11px] mt-2" style={{ color: '#C62828' }}>먼저 <b>자료 수집</b> 탭에서 자료를 모아주세요.</p>}

                                            {/* 챕터별 결과/상태 + 본문 보기·글 수정 */}
                                            {(draftResults || total > 0) && (
                                                <div className="mt-3 space-y-1.5">
                                                    {chs.map(ch => {
                                                        const r = draftResults?.find(x => x.no === ch.no);
                                                        const hasBody = typeof ch.contentMd === 'string' && ch.contentMd.trim();
                                                        const label = r
                                                            ? (r.status === 'done' ? `완성 · ${r.chars?.toLocaleString()}자` : r.status === 'skipped' ? '기존 본문 유지' : r.status === 'no-sources' ? '자료 없음' : '실패')
                                                            : (hasBody ? '본문 있음' : ch.sourceStatus === 'done' ? '대기' : '자료 없음');
                                                        const color = r?.status === 'failed' || (!hasBody && ch.sourceStatus !== 'done') ? '#C62828' : hasBody || r?.status === 'done' || r?.status === 'skipped' ? '#5BA36A' : T.inkMute;
                                                        const open = contentOpenNo === ch.no;
                                                        return (
                                                            <div key={ch.no} className="rounded-lg" style={{ border: open ? `1px solid ${T.border}` : 'none' }}>
                                                                <div className="flex items-center gap-2 text-xs px-1 py-1">
                                                                    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: T.accentSoft, color: T.accent }}>{ch.no}</span>
                                                                    <span className="flex-1 truncate" style={{ color: T.ink }}>{ch.title}</span>
                                                                    {hasBody && (
                                                                        <button onClick={() => setContentOpenNo(open ? null : ch.no)}
                                                                            className="shrink-0 text-[11px] font-bold rounded-md" style={{ padding: '3px 8px', color: T.accent, background: T.accentSoft }}>
                                                                            {open ? '접기 ▲' : '본문 보기 ▼'}
                                                                        </button>
                                                                    )}
                                                                    <span className="shrink-0 font-semibold" style={{ color }}>{label}</span>
                                                                </div>

                                                                {/* 펼침: 본문 미리보기 + 다시 쓰기 */}
                                                                {open && hasBody && (
                                                                    <div className="px-2 pb-2">
                                                                        <div className="rounded-lg p-3 text-sm leading-relaxed ebook-md" style={{ background: '#fff', border: `1px solid ${T.border}`, color: T.ink, fontFamily: '"Nanum Myeongjo", serif', maxHeight: 280, overflowY: 'auto' }}>
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ch.contentMd!}</ReactMarkdown>
                                                                        </div>
                                                                        <button onClick={() => rewriteChapter(ch.no)} disabled={rewritingNo !== null}
                                                                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold rounded-lg disabled:opacity-40" style={{ padding: '5px 12px', color: '#fff', background: '#C96442' }}>
                                                                            {rewritingNo === ch.no ? <><Loader size={11} className="animate-spin" /> 다시 쓰는 중…</> : <><RefreshCw size={11} /> 클로드로 다시 쓰기</>}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>
                                                💡 본문을 만든 뒤 아래에서 <b style={{ color: T.accent }}>문서(.docx)</b>를 받아 구글 독스에서 자유롭게 편집·출판하세요. 글·표·그림 모두 거기서 다듬을 수 있어요.
                                            </p>
                                        </div>

                                        {/* 2단계: 표지 만들기 (gpt-image) */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ width: 18, height: 18, background: T.accent, color: '#fff' }}>2</span>
                                                <p className="text-sm font-bold" style={{ color: T.ink }}>표지 만들기 <span className="text-[11px] font-normal" style={{ color: T.inkMute }}>(선택)</span></p>
                                            </div>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>책 제목·주제에 맞는 표지를 <b style={{ color: '#10A37F' }}>챗GPT</b>가 그려줘요. 만든 표지는 문서(.docx) 첫 페이지에 꽉 차게 들어가요.</p>
                                            <div className="flex items-start gap-3 flex-wrap">
                                                <button onClick={makeCover} disabled={coverMaking}
                                                    className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                                                    {coverMaking ? <><Loader size={14} className="animate-spin" /> 표지 그리는 중… (시간이 걸려요)</> : <><BookOpen size={14} /> {selected.coverUrl ? '표지 다시 만들기' : '표지 만들기'}</>}
                                                </button>
                                                {selected.coverUrl && (
                                                    <img src={selected.coverUrl} alt="표지 미리보기" className="rounded-lg" style={{ width: 90, height: 120, objectFit: 'cover', border: `1px solid ${T.border}` }} />
                                                )}
                                            </div>
                                        </div>

                                        {/* 3단계: 문서 만들기 (구글 독스용 .docx / PDF) */}
                                        <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${canPdf ? T.accentBorder : T.border}`, opacity: canPdf ? 1 : 0.6 }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ width: 18, height: 18, background: canPdf ? T.accent : T.inkMute, color: '#fff' }}>3</span>
                                                <p className="text-sm font-bold" style={{ color: T.ink }}>문서 만들기</p>
                                            </div>
                                            <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>
                                                북크크 양식으로 문서를 만들어요. <b style={{ color: T.accent }}>구글 문서(.docx)</b>로 받아 구글 독스에서 열면 글·표·그림을 자유롭게 편집하고 그대로 출판할 수 있어요. · 저자명: <b style={{ color: T.accent }}>{selected.author || '미설정'}</b> · 표지: <b style={{ color: selected.coverUrl ? '#10A37F' : T.inkMute }}>{selected.coverUrl ? '있음(첫 페이지)' : '없음'}</b>
                                            </p>

                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={makeDocx} disabled={!canPdf || docxMaking}
                                                    className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl disabled:opacity-40" style={{ padding: '8px 16px', color: '#fff', background: T.accent }}>
                                                    {docxMaking ? <><Loader size={14} className="animate-spin" /> 문서 만드는 중…</> : <><FileText size={14} /> 구글 문서(.docx) 만들기</>}
                                                </button>
                                                {docxUrl && (
                                                    <a href={docxUrl} target="_blank" rel="noopener noreferrer" download
                                                        className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl" style={{ padding: '8px 16px', color: '#fff', background: '#5BA36A' }}>
                                                        <ExternalLink size={14} /> 문서 다운로드
                                                    </a>
                                                )}
                                            </div>

                                            <div className="flex gap-2 flex-wrap mt-2">
                                                <button onClick={makePdf} disabled={!canPdf || pdfMaking}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl disabled:opacity-40" style={{ padding: '7px 14px', color: T.accent, background: T.accentSoft, border: `1px solid ${T.accentBorder}` }}>
                                                    {pdfMaking ? <><Loader size={12} className="animate-spin" /> PDF 만드는 중…</> : <><FileText size={12} /> PDF로도 받기</>}
                                                </button>
                                                {pdfUrl && (
                                                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl" style={{ padding: '7px 14px', color: '#fff', background: '#5BA36A' }}>
                                                        <ExternalLink size={12} /> PDF 다운로드
                                                    </a>
                                                )}
                                            </div>

                                            {docxUrl && <p className="text-[11px] mt-2" style={{ color: T.inkSoft }}>📎 받은 .docx를 구글 드라이브에 올리고 우클릭 → <b>연결 앱 → Google 문서</b>로 열면 편집됩니다.</p>}
                                            {!canPdf && <p className="text-[11px] mt-2" style={{ color: T.inkMute }}>본문을 먼저 만들어 주세요.</p>}
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* ── 탭1: 책 정보 (제목·저자) + 목차(보기/수정) ── */}
                                {activeTab === 1 && <>
                                {/* 제목·저자 카드 */}
                                <div className="rounded-2xl p-5 mb-4" style={{ background: 'linear-gradient(135deg, #ffffff, #f7f3fb)', border: `1px solid ${T.accentBorder}`, boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)' }}>
                                    <p className="text-[10px] tracking-widest mb-2" style={{ color: T.accent }}>책 정보</p>
                                    <div className="flex flex-col gap-2">
                                        <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} placeholder="책 제목"
                                            className="w-full text-xl font-bold rounded-lg px-3 py-2" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', border: `1px solid ${T.accentBorder}`, background: '#fff' }} />
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] shrink-0" style={{ color: T.inkSoft }}>저자명</span>
                                            <input value={authorDraft} onChange={e => setAuthorDraft(e.target.value)} placeholder="예: 강지훈"
                                                className="flex-1 text-sm rounded-lg px-3 py-1.5" style={{ color: T.ink, border: `1px solid ${T.border}`, background: '#fff', maxWidth: 260 }} />
                                            <button onClick={saveTitle} disabled={savingTitle || !titleDraft.trim()} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg disabled:opacity-50" style={{ padding: '8px 14px', color: '#fff', background: T.accent }}>
                                                {savingTitle ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} 저장
                                            </button>
                                        </div>
                                        <p className="text-[11px]" style={{ color: T.inkMute }}>주제: {selected.topic}</p>
                                    </div>
                                </div>
                                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                                {/* 목차 헤더 + 보기/수정 토글 */}
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-bold" style={{ color: T.ink }}>목차 <span className="text-[11px] font-normal" style={{ color: T.inkMute }}>({(selected.chapters ?? []).length}챕터)</span></p>
                                    {editing
                                        ? <div className="flex gap-1.5 shrink-0">
                                            <button onClick={saveToc} disabled={savingToc} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: '#fff', background: T.accent }}>{savingToc ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} 목차 저장</button>
                                            <button onClick={() => cancelEdit()} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.inkMute, border: `1px solid ${T.border}` }}>취소</button>
                                          </div>
                                        : <button onClick={startEdit} className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ color: T.accent, border: `1px solid ${T.accentBorder}`, background: T.accentSoft }}><Pencil size={12} /> 목차 수정</button>}
                                </div>

                                {/* 목차 보기 (단순 챕터 리스트) */}
                                {!editing && (
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

                                            </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* 목차 수정 (editing 모드): 챕터 편집 + 순서변경 */}
                                {editing && (
                                    <div className="space-y-2">
                                        <p className="text-[11px] mb-2" style={{ color: T.inkMute }}>챕터를 수정/추가/삭제하고 순서를 바꾼 뒤 위의 <b style={{ color: T.accent }}>목차 저장</b>을 눌러주세요. (책 제목·저자는 위 카드에서 수정)</p>
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
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};
