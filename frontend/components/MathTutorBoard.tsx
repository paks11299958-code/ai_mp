import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Camera, ChevronLeft, Volume2, VolumeX, Loader, RotateCcw, Trash2, CheckCircle, XCircle, Clock, BookOpen, Sparkles } from 'lucide-react';

// ── 타입 ─────────────────────────────────────────────────

interface MathStep {
    emoji: string;
    title: string;
    content: string;
    highlight: string;
}

interface MathResult {
    id: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    problem: string | null;
    answer: string | null;
    steps: MathStep[];
    tip: string | null;
    imageUrl: string | null;
    createdAt: string;
    errorMessage: string | null;
}

interface MathProblem {
    no: number;
    problemMd: string;
    answer: string;
    explanation: string;
}

interface Props { onClose: () => void; }

const SUBJECTS = ['수와 연산', '도형', '측정', '규칙성', '자료와 가능성'];

// ── 유틸 ─────────────────────────────────────────────────

const API = (path: string) => `/api/math-tutor${path}`;
const MAX_BYTES = 3.5 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
    if (file.size <= MAX_BYTES) return file;
    const img = await new Promise<HTMLImageElement | null>(resolve => {
        const el = new Image();
        const url = URL.createObjectURL(file);
        el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
        el.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        el.src = url;
    });
    if (!img) return file;
    for (const { s, q } of [{ s: 0.8, q: 0.85 }, { s: 0.7, q: 0.80 }, { s: 0.5, q: 0.70 }]) {
        const blob = await new Promise<Blob | null>(res => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * s);
            canvas.height = Math.round(img.naturalHeight * s);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(res, 'image/jpeg', q);
        });
        if (blob && blob.size <= MAX_BYTES)
            return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    }
    return file;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}

// ── 파스텔 카드 색상 팔레트 ────────────────────────────────

const STEP_COLORS = [
    { bg: '#FFF0F6', border: '#FFB7D5', title: '#C2185B', highlight: '#FCE4EC' },
    { bg: '#F3F0FF', border: '#C5B4E3', title: '#6A1B9A', highlight: '#EDE7F6' },
    { bg: '#E8F5FF', border: '#90CAF9', title: '#1565C0', highlight: '#E3F2FD' },
    { bg: '#F0FFF4', border: '#A5D6A7', title: '#2E7D32', highlight: '#E8F5E9' },
];

// ── TTS 훅 ────────────────────────────────────────────────

function useTTS() {
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setSpeakingId(null);
        setLoadingId(null);
    }, []);

    const speak = useCallback(async (text: string, id: string) => {
        stop();
        setLoadingId(id);
        try {
            const res = await fetch('/api/math-tutor-tts', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            if (!res.ok) throw new Error('TTS 실패');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
            audio.onerror = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
            setLoadingId(null);
            setSpeakingId(id);
            await audio.play();
        } catch {
            setLoadingId(null);
            setSpeakingId(null);
        }
    }, [stop]);

    useEffect(() => () => { audioRef.current?.pause(); }, []);

    return { speakingId, loadingId, speak, stop };
}


// ── 메인 컴포넌트 ─────────────────────────────────────────

export const MathTutorBoard: React.FC<Props> = ({ onClose }) => {
    const [history, setHistory] = useState<MathResult[]>([]);
    const [selected, setSelected] = useState<MathResult | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHistoryMobile, setShowHistoryMobile] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const { speakingId, loadingId, speak, stop } = useTTS();
    const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([0]));

    // ── 문제 만들기(출제) 모드 ──
    const [mode, setMode] = useState<'solve' | 'generate'>('solve');
    const [genGrade, setGenGrade] = useState<number | null>(null);
    const [genSubject, setGenSubject] = useState<string | null>(null);
    const [chapters, setChapters] = useState<string[] | null>(null);
    const [genChapter, setGenChapter] = useState<string | null>(null);
    const [genCount, setGenCount] = useState(5);
    const [chapterLoading, setChapterLoading] = useState(false);
    const [genLoading, setGenLoading] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);
    const [problemSet, setProblemSet] = useState<{ id: number; problems: MathProblem[] } | null>(null);
    const [openAnswers, setOpenAnswers] = useState<Set<number>>(new Set());
    const [docxLoading, setDocxLoading] = useState(false);

    const resetGen = () => { setGenChapter(null); setChapters(null); setProblemSet(null); setGenError(null); setOpenAnswers(new Set()); };

    const loadChapters = useCallback(async (grade: number, subject: string) => {
        setChapterLoading(true); setGenError(null); setChapters(null); setGenChapter(null); setProblemSet(null);
        try {
            const { chapters } = await apiFetch<{ chapters: string[] }>(API(`/chapters?grade=${grade}&subject=${encodeURIComponent(subject)}`));
            setChapters(chapters);
        } catch (e: any) { setGenError(e.message || '단원을 불러오지 못했어요.'); }
        finally { setChapterLoading(false); }
    }, []);

    const generateProblems = useCallback(async () => {
        if (!genGrade || !genSubject || !genChapter || genLoading) return;
        setGenLoading(true); setGenError(null); setProblemSet(null); setOpenAnswers(new Set());
        try {
            const res = await apiFetch<{ id: number; problems: MathProblem[] }>(API('/generate'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade: genGrade, subject: genSubject, chapter: genChapter, count: genCount }),
            });
            setProblemSet(res);
        } catch (e: any) { setGenError(e.message || '문제 생성에 실패했어요.'); }
        finally { setGenLoading(false); }
    }, [genGrade, genSubject, genChapter, genCount, genLoading]);

    const downloadDocx = useCallback(async () => {
        if (!problemSet || docxLoading) return;
        setDocxLoading(true);
        try {
            const { url } = await apiFetch<{ url: string }>(API(`/${problemSet.id}/docx`), { method: 'POST' });
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = `초등${genGrade}_${genSubject}_문제.docx`;
            document.body.appendChild(a); a.click(); a.remove();
        } catch (e: any) { setGenError(e.message || '문서 받기에 실패했어요.'); }
        finally { setDocxLoading(false); }
    }, [problemSet, docxLoading, genGrade, genSubject]);

    // PDF 출력 — 인쇄용 깔끔한 HTML을 새 창에 띄우고 브라우저 인쇄(→ 'PDF로 저장') 호출. 한글 안전.
    const printPdf = useCallback(() => {
        if (!problemSet) return;
        const esc = (s: string) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));
        const title = `초등 ${genGrade}학년 ${genSubject} — ${genChapter}`;
        const probHtml = problemSet.problems.map(p =>
            `<div class="q"><span class="no">${p.no}.</span> <span class="t">${esc(p.problemMd).replace(/\n/g, '<br>')}</span><div class="ans-line">답: ____________________</div></div>`
        ).join('');
        const ansHtml = problemSet.problems.map(p =>
            `<div class="a"><b>${p.no}.</b> 정답: ${esc(p.answer)}${p.explanation ? ` <span class="exp">(${esc(p.explanation)})</span>` : ''}</div>`
        ).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Malgun Gothic','맑은 고딕',sans-serif; color:#222; line-height:1.6; }
  h1 { font-size:18px; text-align:center; margin:0 0 4px; }
  .sub { text-align:center; color:#666; font-size:12px; margin-bottom:18px; }
  .q { margin:0 0 18px; font-size:15px; }
  .q .no { font-weight:bold; color:#C2185B; }
  .ans-line { color:#999; font-size:13px; margin-top:6px; }
  .page-break { page-break-before: always; }
  h2 { font-size:15px; border-top:1px solid #ccc; padding-top:12px; margin-top:0; }
  .a { font-size:13px; margin-bottom:8px; }
  .exp { color:#666; }
</style></head><body>
  <h1>${esc(title)}</h1>
  <div class="sub">이름: ____________   날짜: ____________</div>
  ${probHtml}
  <div class="page-break"></div>
  <h2>정답과 풀이</h2>
  ${ansHtml}
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
        const w = window.open('', '_blank');
        if (!w) { setGenError('팝업이 차단됐어요. 팝업 허용 후 다시 시도해 주세요.'); return; }
        w.document.write(html); w.document.close();
    }, [problemSet, genGrade, genSubject, genChapter]);

    // 만든 문제 이력
    const [historyOpen, setHistoryOpen] = useState(false);
    const [genHistory, setGenHistory] = useState<Array<{ id: number; grade: number; subject: string; chapter: string; count: number; createdAt: string }> | null>(null);
    const loadGenHistory = useCallback(async () => {
        try { setGenHistory(await apiFetch(API('/sets'))); } catch { setGenHistory([]); }
    }, []);
    const openHistorySet = useCallback(async (id: number) => {
        setGenError(null);
        try {
            const d = await apiFetch<{ id: number; grade: number; subject: string; chapter: string; problems: MathProblem[] }>(API(`/sets/${id}`));
            setGenGrade(d.grade); setGenSubject(d.subject); setGenChapter(d.chapter);
            setProblemSet({ id: d.id, problems: d.problems }); setHistoryOpen(false); setOpenAnswers(new Set());
        } catch (e: any) { setGenError(e.message || '불러오기 실패'); }
    }, []);

    const loadHistory = useCallback(async () => {
        try {
            const data = await apiFetch<MathResult[]>(API(''));
            setHistory(data);
        } catch { }
        finally { setListLoading(false); }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleFileSelect = useCallback(async (files: FileList | null) => {
        if (!files || !files[0]) return;
        const compressed = await compressImage(files[0]);
        setSelected(null);
        setError(null);
        setPreview(URL.createObjectURL(compressed));
        setLoading(true);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(compressed);
            });
            const result = await apiFetch<MathResult>(API(''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64, mimeType: compressed.type || 'image/jpeg' }),
            });
            setSelected(result);
            setHistory(prev => [result, ...prev]);
            setPreview(null);
            setFile(null);
        } catch (e: any) {
            setFile(compressed);
            setError(e.message || '분석 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const result = await apiFetch<MathResult>(API(''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
            });
            setSelected(result);
            setHistory(prev => [result, ...prev]);
            setPreview(null);
            setFile(null);
        } catch (e: any) {
            setError(e.message || '분석 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [file]);

    const handleHistorySelect = useCallback(async (item: MathResult) => {
        setSelected(item);
        setOpenSteps(new Set([0]));
        stop();
        setPreview(null);
        setFile(null);
        setShowHistoryMobile(false);
        setDetailLoading(true);
        try {
            const detail = await apiFetch<MathResult>(API(`/${item.id}`));
            setSelected(detail);
        } catch { }
        finally { setDetailLoading(false); }
    }, [stop]);

    const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await apiFetch(API(`/${id}`), { method: 'DELETE' });
            setHistory(prev => prev.filter(h => h.id !== id));
            if (selected?.id === id) setSelected(null);
        } catch { }
    }, [selected]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFF8FC' }}>
            {/* 헤더 */}
            <div style={{ background: 'linear-gradient(135deg, #FF6B9D 0%, #C44FD8 100%)' }} className="flex items-center justify-between px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">📚</span>
                    <div>
                        <div className="text-white font-bold text-base leading-tight">찰칵! AI쌤</div>
                        <div className="text-pink-100 text-[10px]">수학 문제를 찍으면 쉽게 설명해드려요</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* 풀이 / 만들기 모드 토글 */}
                    <div className="flex rounded-full overflow-hidden border border-white/40">
                        <button onClick={() => setMode('solve')}
                            className="px-2.5 py-1.5 text-xs font-bold transition-colors"
                            style={{ background: mode === 'solve' ? '#fff' : 'transparent', color: mode === 'solve' ? '#C2185B' : 'rgba(255,255,255,0.9)' }}>
                            풀이
                        </button>
                        <button onClick={() => setMode('generate')}
                            className="px-2.5 py-1.5 text-xs font-bold transition-colors"
                            style={{ background: mode === 'generate' ? '#fff' : 'transparent', color: mode === 'generate' ? '#C2185B' : 'rgba(255,255,255,0.9)' }}>
                            문제 만들기
                        </button>
                    </div>
                    {/* 모바일 이력 토글 버튼 (풀이 모드만) */}
                    {mode === 'solve' && (
                        <button
                            onClick={() => setShowHistoryMobile(v => !v)}
                            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white/90 text-xs font-medium hover:bg-white/20 transition-colors border border-white/30"
                        >
                            <BookOpen size={12} />
                            이력 {history.length > 0 && `(${history.length})`}
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {mode === 'generate' ? (
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-lg mx-auto w-full p-4 space-y-5">
                        <div className="text-center relative">
                            <p className="font-bold text-lg" style={{ color: '#C2185B' }}>✏️ 수학 문제 만들기</p>
                            <p className="text-xs text-pink-400 mt-1">학년·과목·단원을 고르면 AI쌤이 연습 문제를 만들어줘요</p>
                            <button onClick={() => { const n = !historyOpen; setHistoryOpen(n); if (n && !genHistory) loadGenHistory(); }}
                                className="absolute right-0 top-0 text-xs font-bold px-2.5 py-1 rounded-full border-2"
                                style={{ borderColor: '#FFD6E8', color: '#FF6B9D', background: '#fff' }}>
                                📂 이력
                            </button>
                        </div>

                        {/* 만든 문제 이력 */}
                        {historyOpen && (
                            <div className="rounded-2xl border-2 p-3" style={{ borderColor: '#FFD6E8', background: '#FFF8FC' }}>
                                <p className="text-xs font-bold text-gray-500 mb-2">📂 이전에 만든 문제</p>
                                {genHistory === null ? (
                                    <div className="flex items-center gap-2 text-pink-400 text-xs py-2"><Loader size={13} className="animate-spin" /> 불러오는 중…</div>
                                ) : genHistory.length === 0 ? (
                                    <p className="text-xs text-pink-300 py-2">아직 만든 문제가 없어요.</p>
                                ) : (
                                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                        {genHistory.map(h => (
                                            <button key={h.id} onClick={() => openHistorySet(h.id)}
                                                className="w-full text-left rounded-xl px-3 py-2 border transition-all hover:border-pink-300"
                                                style={{ borderColor: '#FFE0EF', background: '#fff' }}>
                                                <p className="text-sm font-medium text-gray-700">초{h.grade} · {h.subject} · {h.chapter}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{h.count}문제 · {new Date(h.createdAt).toLocaleDateString('ko-KR')}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 1) 학년 */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">1. 학년</p>
                            <div className="grid grid-cols-6 gap-1.5">
                                {[1, 2, 3, 4, 5, 6].map(g => (
                                    <button key={g} onClick={() => { setGenGrade(g); resetGen(); }}
                                        className="py-2 rounded-xl text-sm font-bold border-2 transition-all"
                                        style={genGrade === g
                                            ? { borderColor: '#FF6B9D', background: 'linear-gradient(135deg,#FF6B9D,#C44FD8)', color: '#fff' }
                                            : { borderColor: '#FFD6E8', background: '#fff', color: '#FF6B9D' }}>
                                        {g}학년
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2) 과목 */}
                        {genGrade && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-2">2. 과목(영역)</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {SUBJECTS.map(s => (
                                        <button key={s} onClick={() => { setGenSubject(s); loadChapters(genGrade, s); }}
                                            className="px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all"
                                            style={genSubject === s
                                                ? { borderColor: '#FF6B9D', background: '#FFF0F8', color: '#C2185B' }
                                                : { borderColor: '#FFD6E8', background: '#fff', color: '#FF6B9D' }}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3) 단원 */}
                        {genSubject && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-2">3. 단원</p>
                                {chapterLoading ? (
                                    <div className="flex items-center gap-2 text-pink-400 text-xs py-3"><Loader size={14} className="animate-spin" /> 단원을 불러오는 중…</div>
                                ) : chapters ? (
                                    <div className="flex flex-col gap-1.5">
                                        {chapters.map(c => (
                                            <button key={c} onClick={() => { setGenChapter(c); setProblemSet(null); }}
                                                className="px-3 py-2.5 rounded-xl text-sm font-medium text-left border-2 transition-all"
                                                style={genChapter === c
                                                    ? { borderColor: '#FF6B9D', background: '#FFF0F8', color: '#C2185B' }
                                                    : { borderColor: '#FFD6E8', background: '#fff', color: '#555' }}>
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* 4) 문제 수 + 생성 */}
                        {genChapter && (
                            <div>
                                <p className="text-xs font-bold text-gray-500 mb-2">4. 문제 수: <span style={{ color: '#C2185B' }}>{genCount}개</span></p>
                                <input type="range" min={1} max={10} value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                                    className="w-full accent-pink-500" style={{ accentColor: '#FF6B9D' }} />
                                <button onClick={generateProblems} disabled={genLoading}
                                    style={{ background: 'linear-gradient(135deg,#FF6B9D,#C44FD8)' }}
                                    className="w-full mt-3 py-3 rounded-2xl text-white text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    {genLoading ? <><Loader size={16} className="animate-spin" /> AI쌤이 문제를 만들고 있어요…</> : <><Sparkles size={16} /> 문제 {genCount}개 만들기</>}
                                </button>
                            </div>
                        )}

                        {genError && <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-500 text-center">{genError}</div>}

                        {/* 결과: 문제 목록 */}
                        {problemSet && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-sm font-bold" style={{ color: '#C2185B' }}>📝 문제 {problemSet.problems.length}개</p>
                                    <div className="flex gap-1.5">
                                        <button onClick={printPdf}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border-2"
                                            style={{ borderColor: '#FF6B9D', color: '#FF6B9D', background: '#fff' }}>
                                            🖨️ 인쇄·PDF
                                        </button>
                                        <button onClick={downloadDocx} disabled={docxLoading}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 disabled:opacity-50"
                                            style={{ borderColor: '#FF6B9D', color: '#fff', background: 'linear-gradient(135deg,#FF6B9D,#C44FD8)' }}>
                                            {docxLoading ? <><Loader size={12} className="animate-spin" /> 만드는 중…</> : <>📄 .docx</>}
                                        </button>
                                    </div>
                                </div>
                                {problemSet.problems.map(p => {
                                    const open = openAnswers.has(p.no);
                                    return (
                                        <div key={p.no} className="rounded-2xl border-2 p-3.5" style={{ borderColor: '#FFD6E8', background: '#fff' }}>
                                            <div className="flex gap-2">
                                                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#FF6B9D' }}>{p.no}</span>
                                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap flex-1">{p.problemMd}</p>
                                            </div>
                                            <button onClick={() => setOpenAnswers(prev => { const n = new Set(prev); n.has(p.no) ? n.delete(p.no) : n.add(p.no); return n; })}
                                                className="mt-2.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: '#C2185B', background: '#FFF0F8' }}>
                                                {open ? '정답 숨기기 ▲' : '정답 보기 ▼'}
                                            </button>
                                            {open && (
                                                <div className="mt-2 px-3 py-2 rounded-xl text-sm" style={{ background: '#F0FFF4', border: '1px solid #A5D6A7' }}>
                                                    <p className="font-bold" style={{ color: '#2E7D32' }}>정답: {p.answer}</p>
                                                    {p.explanation && <p className="text-gray-600 text-xs mt-1 leading-relaxed">{p.explanation}</p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="pb-6" />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
            <div className="flex flex-1 overflow-hidden">
                {/* 좌측: 이력 목록 — 모바일: showHistoryMobile 일때만 / 데스크탑: 항상 */}
                <div className={`${showHistoryMobile ? 'flex' : 'hidden'} md:flex w-full md:w-52 shrink-0 flex-col border-r overflow-y-auto absolute md:relative inset-0 md:inset-auto z-10 md:z-auto`} style={{ borderColor: '#FFD6E8', background: '#FFF0F8' }}>
                    <div className="p-3">
                        <button
                            onClick={() => { setSelected(null); setPreview(null); setFile(null); setError(null); setShowHistoryMobile(false); }}
                            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FD8)' }}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
                        >
                            <Camera size={13} /> 새 문제 풀기
                        </button>
                    </div>

                    {listLoading ? (
                        <div className="flex justify-center py-4"><Loader size={16} className="animate-spin text-pink-400" /></div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-6 px-3">
                            <BookOpen size={28} className="mx-auto text-pink-300 mb-2" />
                            <p className="text-xs text-pink-400">아직 풀이 기록이 없어요</p>
                        </div>
                    ) : (
                        <div className="px-2 pb-2 space-y-1.5">
                            {history.map(h => (
                                <div
                                    key={h.id}
                                    onClick={() => handleHistorySelect(h)}
                                    className={`p-2.5 rounded-xl cursor-pointer transition-all border ${selected?.id === h.id ? 'border-pink-400 bg-pink-50' : 'border-pink-100 bg-white hover:border-pink-300'}`}
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <p className="text-[11px] font-medium text-gray-700 line-clamp-2 flex-1">{h.problem || '분석 중...'}</p>
                                        <button onClick={e => handleDelete(h.id, e)} className="p-0.5 text-gray-300 hover:text-red-400 shrink-0">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                    {h.answer && <p className="text-[10px] text-pink-500 font-bold mt-1">정답: {h.answer}</p>}
                                    <p className="text-[9px] text-gray-400 mt-1">{new Date(h.createdAt).toLocaleDateString('ko-KR')}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 우측: 메인 영역 — 모바일: 이력 패널 닫혔을 때만 표시 */}
                <div className={`${showHistoryMobile ? 'hidden' : 'flex'} md:flex flex-1 flex-col overflow-y-auto`}>
                    {/* 이미지 업로드 화면 */}
                    {!selected && (
                        <div className="flex flex-col items-center p-6 gap-4 max-w-lg mx-auto w-full">
                            {/* 미리보기 존 (분석 중 / 에러 재시도) */}
                            {(preview || loading) && (
                                <div className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-6 overflow-hidden"
                                    style={{ borderColor: '#FF6B9D', background: '#FFF0F8' }}>
                                    {preview && <img src={preview} alt="미리보기" className="max-h-52 rounded-xl object-contain shadow-md" />}
                                    {loading && (
                                        <div className="flex flex-col items-center gap-2 py-2">
                                            <Loader size={28} className="text-pink-400 animate-spin" />
                                            <p className="text-pink-500 text-sm font-medium">AI쌤이 문제를 풀고 있어요...</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 업로드 존 (아이들 전 상태) */}
                            {!preview && !loading && (
                                <div className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10"
                                    style={{ borderColor: '#FFB3D1', background: '#FFF0F8' }}>
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: '#FFE0EF' }}>📷</div>
                                    <div className="text-center">
                                        <p className="font-bold text-pink-500">문제 사진을 찍거나 올려주세요</p>
                                        <p className="text-xs text-pink-300 mt-1">아래 버튼을 눌러 카메라로 찍거나 갤러리에서 선택하세요</p>
                                    </div>
                                </div>
                            )}

                            {/* 숨겨진 input들 */}
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
                            />
                            <input
                                ref={galleryInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
                            />

                            {/* 버튼 영역 */}
                            {!loading && (
                                <div className="flex gap-3 w-full">
                                    {preview ? (
                                        /* 에러 후 재시도 상태 */
                                        <button
                                            onClick={() => { setPreview(null); setFile(null); setError(null); }}
                                            className="flex-1 py-3 rounded-2xl border-2 border-pink-200 text-pink-400 text-sm font-medium hover:bg-pink-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw size={15} /> 다시 찍기
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => cameraInputRef.current?.click()}
                                                style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FD8)' }}
                                                className="flex-1 py-3.5 rounded-2xl text-white text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Camera size={16} /> 카메라로 찍기
                                            </button>
                                            <button
                                                onClick={() => galleryInputRef.current?.click()}
                                                className="flex-1 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2"
                                                style={{ borderColor: '#FFB3D1', color: '#FF6B9D', background: '#FFF0F8' }}
                                            >
                                                🖼️ 갤러리
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="w-full p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-500 text-center">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 결과 화면 */}
                    {selected && (
                        <div className="p-4 max-w-lg mx-auto space-y-4">
                            {/* 상단 네비 */}
                            <button
                                onClick={() => setSelected(null)}
                                className="flex items-center gap-1 text-pink-400 text-xs hover:text-pink-600 transition-colors"
                            >
                                <ChevronLeft size={14} /> 새 문제 풀기
                            </button>

                            {/* 풀이 로딩 중 */}
                            {detailLoading && (
                                <div className="flex items-center justify-center gap-2 py-2 text-pink-400 text-xs">
                                    <Loader size={13} className="animate-spin" /> 풀이를 불러오는 중...
                                </div>
                            )}

                            {/* 문제 카드 */}
                            <div className="rounded-2xl p-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FD8)' }}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <p className="text-pink-100 text-[10px] font-semibold uppercase tracking-wider mb-1">📝 오늘의 문제</p>
                                        <p className="text-white font-bold text-sm leading-snug">{selected.problem || '문제를 분석 중입니다...'}</p>
                                    </div>
                                    {selected.imageUrl && (
                                        <img src={selected.imageUrl} alt="문제" className="w-16 h-16 rounded-lg object-cover border-2 border-white/30 shrink-0" />
                                    )}
                                </div>
                                {selected.answer && (
                                    <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2">
                                        <span className="text-pink-100 text-xs">✅ 정답:</span>
                                        <span className="text-white font-bold text-base">{selected.answer}</span>
                                    </div>
                                )}
                            </div>

                            {/* 단계별 아코디언 카드 */}
                            {selected.steps?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">📖 단계별 풀이</p>
                                    {selected.steps.map((step, i) => {
                                        const color = STEP_COLORS[i % STEP_COLORS.length];
                                        const isOpen = openSteps.has(i);
                                        const ttsId = `step-${selected.id}-${i}`;
                                        const isSpeaking = speakingId === ttsId;
                                        const isLoading = loadingId === ttsId;
                                        const stepText = `${step.title}. ${step.content}${step.highlight ? `. ${step.highlight}` : ''}`;
                                        return (
                                            <div key={i} className="rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: color.border }}>
                                                {/* 헤더 — 클릭으로 열고 닫기 */}
                                                <button
                                                    className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
                                                    style={{ background: isOpen ? color.bg : '#fff' }}
                                                    onClick={() => {
                                                        setOpenSteps(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(i)) next.delete(i); else next.add(i);
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    <span className="text-lg">{step.emoji}</span>
                                                    <span className="font-bold text-sm flex-1" style={{ color: color.title }}>
                                                        {step.title}
                                                    </span>
                                                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                                                </button>

                                                {/* 내용 */}
                                                {isOpen && (
                                                    <div className="px-4 pb-4 pt-1" style={{ background: color.bg }}>
                                                        <p className="text-gray-600 text-sm leading-relaxed">{step.content}</p>
                                                        {step.highlight && (
                                                            <div className="mt-2.5 px-3 py-2 rounded-xl text-center font-bold text-sm" style={{ background: color.highlight, color: color.title }}>
                                                                {step.highlight}
                                                            </div>
                                                        )}
                                                        {/* 단계별 TTS 버튼 */}
                                                        <button
                                                            onClick={() => isSpeaking ? stop() : speak(stepText, ttsId)}
                                                            disabled={isLoading}
                                                            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors"
                                                            style={isSpeaking
                                                                ? { borderColor: color.title, background: color.highlight, color: color.title }
                                                                : isLoading
                                                                ? { borderColor: color.border, background: '#fff', color: color.title }
                                                                : { borderColor: color.title, background: color.title, color: '#fff' }
                                                            }
                                                        >
                                                            {isLoading
                                                                ? <><Loader size={11} className="animate-spin" /> 준비 중</>
                                                                : isSpeaking
                                                                ? <><VolumeX size={11} /> 중지</>
                                                                : <><Volume2 size={11} /> 이 단계 듣기</>
                                                            }
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 선생님 꿀팁 */}
                            {selected.tip && (
                                <div className="rounded-2xl p-4 border-2" style={{ background: '#FFFDE7', borderColor: '#FFD54F' }}>
                                    <p className="text-xs font-bold text-amber-600 mb-1">💡 선생님 꿀팁</p>
                                    <p className="text-sm text-amber-800">{selected.tip}</p>
                                </div>
                            )}

                            {/* 에러 상태 */}
                            {selected.status === 'failed' && (
                                <div className="rounded-2xl p-4 border-2 border-red-200 bg-red-50 text-center">
                                    <p className="text-red-500 text-sm">{selected.errorMessage || '분석 중 오류가 발생했어요 😥'}</p>
                                </div>
                            )}

                            <div className="pb-6" />
                        </div>
                    )}
                </div>
            </div>
            )}
        </div>
    );
};
