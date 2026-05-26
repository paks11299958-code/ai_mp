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

interface Props { onClose: () => void; }

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
                    {/* 모바일 이력 토글 버튼 */}
                    <button
                        onClick={() => setShowHistoryMobile(v => !v)}
                        className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white/90 text-xs font-medium hover:bg-white/20 transition-colors border border-white/30"
                    >
                        <BookOpen size={12} />
                        이력 {history.length > 0 && `(${history.length})`}
                    </button>
                    <button onClick={onClose} className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

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
        </div>
    );
};
