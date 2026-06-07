import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Shield, Clock, CheckCircle, XCircle, Loader,
    Trash2, RefreshCw, RotateCcw, ChevronLeft, Upload, ImageIcon, AlertTriangle,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────

interface LuxuryTask {
    id: number;
    brandHint: string | null;
    geminiBrand: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    finalScore: number | null;
    finalVerdict: string | null;
    imageUrls: string;
    createdAt: string;
    updatedAt: string;
    errorMessage: string | null;
}

interface AnalysisPoint {
    item: string;
    result: '정상' | '이상' | '확인불가';
    detail: string;
}

interface LuxuryDetail extends LuxuryTask {
    geminiBrand: string | null;
    geminiModel: string | null;
    geminiScore: number | null;
    geminiPoints: string | null;
    geminiVerdict: string | null;
    geminiSummary: string | null;
    claudeBrand: string | null;
    claudeModel: string | null;
    claudeScore: number | null;
    claudePoints: string | null;
    claudeVerdict: string | null;
    claudeSummary: string | null;
    gptBrand: string | null;
    gptModel: string | null;
    gptScore: number | null;
    gptPoints: string | null;
    gptVerdict: string | null;
    gptSummary: string | null;
    agreements: string | null;
    disagreements: string | null;
}

interface Props {
    onClose: () => void;
}

// ── 유틸 ──────────────────────────────────────────────────

const API = (path: string) => `/api/luxury-verify${path}`;

const MAX_BYTES = 3.5 * 1024 * 1024; // base64 인코딩 33% 팽창 고려, Claude 5MB 제한 안전 통과

async function compressImage(file: File): Promise<File> {
    if (file.size <= MAX_BYTES) return file;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        const url = URL.createObjectURL(file);
        el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
        el.onerror = () => { URL.revokeObjectURL(url); reject(); };
        el.src = url;
    }).catch(() => null);
    if (!img) return file;

    const toBlob = (scaleW: number, scaleH: number, quality: number) =>
        new Promise<Blob | null>(res => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * scaleW);
            canvas.height = Math.round(img.naturalHeight * scaleH);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(res, 'image/jpeg', quality);
        });

    // 단계적으로 더 강하게 압축
    const steps = [
        { s: 0.8, q: 0.85 },
        { s: 0.7, q: 0.80 },
        { s: 0.6, q: 0.75 },
        { s: 0.5, q: 0.70 },
        { s: 0.4, q: 0.60 },
    ];
    for (const { s, q } of steps) {
        const blob = await toBlob(s, s, q);
        if (blob && blob.size <= MAX_BYTES) {
            return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        }
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

const STATUS_CONFIG = {
    pending:    { label: '대기중',  icon: Clock,        cls: 'text-orange-500' },
    processing: { label: '분석중',  icon: Loader,       cls: 'text-[#8E6FB7]' },
    completed:  { label: '완료',    icon: CheckCircle,  cls: 'text-emerald-600' },
    failed:     { label: '실패',    icon: XCircle,      cls: 'text-red-400' },
};

const VERDICT_CONFIG: Record<string, { label: string; cls: string; bg: string; icon: React.ElementType }> = {
    '정품가능':     { label: '정품 고유 특성 일치',  cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-600/40', icon: CheckCircle },
    '전문감정권고': { label: '전문 감정 권고',       cls: 'text-amber-800',   bg: 'bg-amber-50 border-amber-600/50',     icon: AlertTriangle },
    '위조의심':     { label: '가품 징후 관찰',       cls: 'text-rose-700',    bg: 'bg-rose-50 border-rose-600/40',       icon: XCircle },
};

const POINT_RESULT_CLS: Record<string, string> = {
    '정상':   'text-emerald-600',
    '이상':   'text-rose-600',
    '확인불가': 'text-[#9089A1]',
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
}

// ── 메인 컴포넌트 ──────────────────────────────────────────

export const LuxuryBoard: React.FC<Props> = ({ onClose }) => {
    const [tasks, setTasks] = useState<LuxuryTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<LuxuryDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [brandHint, setBrandHint] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch<LuxuryTask[]>(API(''));
            setTasks(data);
        } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    useEffect(() => {
        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
        if (!hasActive) return;
        const t = setTimeout(loadTasks, 10000);
        return () => clearTimeout(t);
    }, [tasks, loadTasks]);

    const MAX_FILES = 8;

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;
        const incoming = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
        setFiles(prev => {
            const combined = [...prev, ...incoming].slice(0, MAX_FILES);
            setPreviews(combined.map(f => URL.createObjectURL(f)));
            return combined;
        });
    };

    const removeFile = (index: number) => {
        setFiles(prev => {
            const next = prev.filter((_, i) => i !== index);
            setPreviews(next.map(f => URL.createObjectURL(f)));
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.length) return;
        setUploading(true);
        try {
            // 5MB 초과 이미지 압축
            const compressed = await Promise.all(files.map(compressImage));
            const urlReqs = compressed.map(f => ({ name: f.name, type: f.type }));
            const signedResults = await apiFetch<{ signedUrl: string; publicUrl: string }[]>(
                API('/upload-urls'),
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: urlReqs }) }
            );
            await Promise.all(
                compressed.map((file, i) =>
                    fetch(signedResults[i].signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
                )
            );
            const imageUrls = signedResults.map(r => r.publicUrl);
            await apiFetch(API(''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrls, brandHint: brandHint.trim() || undefined }),
            });
            setFiles([]);
            setPreviews([]);
            setBrandHint('');
            await loadTasks();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSelect = async (task: LuxuryTask) => {
        if (task.status !== 'completed') return;
        setDetailLoading(true);
        try {
            const detail = await apiFetch<LuxuryDetail>(API(`/${task.id}`));
            setSelected(detail);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleRetry = async (id: number) => {
        await apiFetch(API(`/${id}/retry`), { method: 'POST' });
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending', errorMessage: null } : t));
    };

    const handleDelete = async (id: number) => {
        if (!confirm('삭제하시겠습니까?')) return;
        await apiFetch(API(`/${id}`), { method: 'DELETE' });
        setTasks(prev => prev.filter(t => t.id !== id));
        if (selected?.id === id) setSelected(null);
    };

    const displayName = (t: LuxuryTask) => t.brandHint || t.geminiBrand || '명품 분석중...';

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-stretch md:items-center justify-center md:p-4">
            <div className="bg-[#FBF8F3] md:border border-[#F0E9DE] md:rounded-2xl w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0E9DE] shrink-0 bg-white md:rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <Shield size={17} style={{ color: '#8E6FB7' }} />
                        <h2 className="text-sm font-bold" style={{ color: '#2D2438', fontFamily: '"Nanum Myeongjo", serif', letterSpacing: '0.02em' }}>
                            명품 감정원 <span className="text-[10px] tracking-[0.2em]" style={{ color: '#8E6FB7' }}>LUXE VERIFY</span>
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#8E6FB7', background: 'rgba(142,111,183,0.1)', border: '1px solid rgba(142,111,183,0.3)' }}>Gemini + Claude</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-[#9089A1] hover:text-[#2D2438] hover:bg-white transition-colors">
                        <X size={17} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* ── 좌측: 업로드 + 목록 ── */}
                    <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-64 shrink-0 border-r border-[#F0E9DE] flex-col`}>
                        <form onSubmit={handleSubmit} className="p-3 border-b border-[#F0E9DE] space-y-2">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-[#EAE2D3] hover:border-purple-500/50 rounded-xl p-3 text-center cursor-pointer transition-colors"
                            >
                                {previews.length > 0 ? (
                                    <div className="flex gap-1 flex-wrap justify-center">
                                        {previews.map((p, i) => (
                                            <div key={i} className="relative">
                                                <img src={p} className="w-12 h-12 object-cover rounded-lg" alt="" />
                                                <button
                                                    type="button"
                                                    onClick={e => { e.stopPropagation(); removeFile(i); }}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[#2D2438] flex items-center justify-center text-[9px] leading-none"
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 py-1">
                                        <ImageIcon size={22} className="text-[#C9BEDB]" />
                                        <p className="text-[11px] text-[#9089A1]">사진 선택 (최대 8장)</p>
                                        <p className="text-[10px] text-[#C9BEDB]">로고·스티칭·시리얼 등 다각도</p>
                                    </div>
                                )}
                                {previews.length > 0 && previews.length < MAX_FILES && (
                                    <p className="text-[10px] text-[#9089A1] text-center mt-1">
                                        {previews.length}장 선택됨 · 탭하면 {MAX_FILES - previews.length}장 더 추가 가능
                                    </p>
                                )}
                                {previews.length >= MAX_FILES && (
                                    <p className="text-[10px] text-purple-400 text-center mt-1">최대 8장 선택됨</p>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
                            <input
                                value={brandHint}
                                onChange={e => setBrandHint(e.target.value)}
                                placeholder="브랜드 입력 (선택, 예: 샤넬)"
                                className="w-full bg-white border border-[#EAE2D3] rounded-xl px-3 py-2 text-xs text-[#2D2438] placeholder-[#9089A1] focus:outline-none focus:ring-1 focus:ring-[#8E6FB7]"
                            />
                            <button
                                type="submit"
                                disabled={uploading || !files.length}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-[#2D2438] text-xs font-medium transition-colors"
                            >
                                {uploading
                                    ? <><Loader size={13} className="animate-spin" /> 업로드 중...</>
                                    : <><Upload size={13} /> AI 검증 요청</>}
                            </button>
                        </form>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loading && <div className="text-center py-8 text-[#9089A1] text-xs">불러오는 중...</div>}
                            {!loading && tasks.length === 0 && (
                                <div className="px-3 py-4 space-y-3">
                                    <p className="text-[11px] font-semibold text-[#5C5468]">📸 정확한 감정을 위한 촬영 가이드</p>

                                    <div className="space-y-2">
                                        <div className="bg-white rounded-xl px-3 py-2.5 space-y-1.5">
                                            <p className="text-[10px] font-semibold text-purple-300">🌤 환경</p>
                                            <p className="text-[10px] text-[#9089A1] leading-relaxed">자연광(창가) · 단색 배경 · 필터 사용 금지</p>
                                        </div>

                                        <div className="bg-white rounded-xl px-3 py-2.5 space-y-1.5">
                                            <p className="text-[10px] font-semibold text-purple-300">📷 필수 5대 컷</p>
                                            <div className="space-y-1">
                                                {[
                                                    ['정면 전체샷', '전체 비율·로고 위치'],
                                                    ['로고 근접샷 ★★★', '폰트 두께·각인 선명도'],
                                                    ['박음질(스티치) ★★★', '실 굵기·땀수·각도'],
                                                    ['금속 부속품 ★★★', '지퍼·버클 각인 마감'],
                                                    ['내부 탭/시리얼 ★★★', '열박인 상태·번호 서체'],
                                                ].map(([name, desc]) => (
                                                    <div key={name} className="flex gap-1.5 text-[10px]">
                                                        <span className="text-[#5C5468] shrink-0 font-medium">{name}</span>
                                                        <span className="text-[#9089A1]">{desc}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl px-3 py-2.5 space-y-1">
                                            <p className="text-[10px] font-semibold text-purple-300">🔍 초근접 촬영</p>
                                            <p className="text-[10px] text-[#9089A1]">10cm 이내 · 로고/각인에 초점 정확히</p>
                                        </div>
                                    </div>

                                    <div className="bg-amber-950/30 border border-amber-700/30 rounded-xl px-3 py-2">
                                        <p className="text-[10px] text-orange-600">⏱ 분석 최대 1분 · AI 결과는 참고용입니다</p>
                                    </div>
                                </div>
                            )}

                            {tasks.map(task => {
                                const cfg = STATUS_CONFIG[task.status];
                                const grade = task.finalScore != null ? getMarketGrade(task.finalScore) : null;
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => handleSelect(task)}
                                        className={`flex items-center gap-2 p-2 rounded-xl transition-all ${task.status === 'completed' ? 'cursor-pointer hover:bg-white' : 'cursor-default'} ${selected?.id === task.id ? 'bg-white ring-1 ring-purple-500/40' : ''}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-[#2D2438] truncate">{displayName(task)}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <cfg.icon size={10} className={`${cfg.cls} shrink-0 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                                                {grade
                                                    ? <>
                                                        <span className={`text-[10px] font-bold ${grade.lightCls}`}>{grade.grade}</span>
                                                        <span className="text-[10px] text-[#9089A1]">{task.finalScore}점</span>
                                                      </>
                                                    : <span className={`text-[10px] ${cfg.cls}`}>{cfg.label}</span>
                                                }
                                            </div>
                                            {/* 진행 단계 스텝퍼 (대기중/분석중일 때) */}
                                            {(task.status === 'pending' || task.status === 'processing') && (() => {
                                                const stepIdx = task.status === 'pending' ? 0 : 1;
                                                const steps = ['대기중', '분석중', '완료'];
                                                const colors = ['#d97706', '#2563eb', '#16a34a'];
                                                return (
                                                    <>
                                                        <div className="flex items-center mt-1.5">
                                                            {steps.map((lbl, i) => (
                                                                <React.Fragment key={lbl}>
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <span style={{
                                                                            width: 7, height: 7, borderRadius: '50%',
                                                                            background: i <= stepIdx ? colors[i] : '#EAE2D3',
                                                                            boxShadow: i === stepIdx ? `0 0 0 3px ${colors[i]}33` : 'none',
                                                                            transition: 'all 0.2s',
                                                                        }} />
                                                                        <span style={{ fontSize: 7.5, fontWeight: i <= stepIdx ? 700 : 500, color: i <= stepIdx ? colors[i] : '#9089A1', whiteSpace: 'nowrap' }}>{lbl}</span>
                                                                    </div>
                                                                    {i < steps.length - 1 && (
                                                                        <span style={{ flex: 1, height: 2, margin: '0 2px', marginBottom: 9, borderRadius: 2, background: i < stepIdx ? colors[i] : '#EAE2D3', transition: 'all 0.2s' }} />
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                        <div className="text-[9px] text-[#9089A1] mt-1 leading-tight">
                                                            {task.status === 'processing' ? 'AI가 분석 중이에요 · 최대 1분, 자동 갱신' : '분석 순서를 기다리는 중 · 곧 시작돼요'}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                            {task.status === 'completed' && (
                                                <div className="text-[9px] text-[#9089A1] mt-1">클릭하면 상세 결과를 볼 수 있어요</div>
                                            )}
                                            {task.status === 'failed' && task.errorMessage && (
                                                <div className="text-[10px] text-red-400 truncate mt-0.5">{task.errorMessage}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {task.status === 'failed' && (
                                                <button onClick={e => { e.stopPropagation(); handleRetry(task.id); }} className="p-1 rounded text-[#9089A1] hover:text-orange-500 transition-colors" title="재분석">
                                                    <RotateCcw size={11} />
                                                </button>
                                            )}
                                            <button onClick={e => { e.stopPropagation(); handleDelete(task.id); }} className="p-1 rounded text-[#9089A1] hover:text-red-400 transition-colors">
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-2 border-t border-[#F0E9DE]">
                            <button onClick={loadTasks} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#9089A1] hover:text-[#2D2438] bg-white hover:bg-[#F5EFE6] border border-[#EAE2D3] rounded-xl transition-colors">
                                <RefreshCw size={11} /> 새로고침
                            </button>
                        </div>
                    </div>

                    {/* ── 우측: 결과 패널 ── */}
                    <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
                        <div className="md:hidden flex items-center px-4 py-2 border-b border-[#F0E9DE] shrink-0">
                            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-[#9089A1] hover:text-[#2D2438] text-xs transition-colors">
                                <ChevronLeft size={14} /> 목록으로
                            </button>
                        </div>

                        {detailLoading && (
                            <div className="flex items-center justify-center h-full text-[#9089A1] text-sm">
                                <Loader size={16} className="animate-spin mr-2" /> 불러오는 중...
                            </div>
                        )}
                        {!detailLoading && !selected && (
                            <div className="flex flex-col items-center justify-center h-full text-[#C9BEDB] gap-3">
                                <Shield size={40} className="text-[#C9BEDB]" />
                                <p className="text-xs">완료된 검증을 클릭하면 결과가 표시됩니다</p>
                            </div>
                        )}

                        {!detailLoading && selected && (
                            <div className="flex-1 overflow-y-auto">
                                {/* 헤더 */}
                                <div className="px-5 py-4">
                                    {/* 진단명 헤더 — 명품 보증서 카드(골드 테두리) */}
                                    <div className="flex items-start justify-between gap-3 rounded-2xl px-4 py-3.5" style={{
                                        background: 'linear-gradient(135deg, #ffffff 0%, #f7f3fb 100%)',
                                        border: '1px solid rgba(142,111,183,0.4)',
                                        boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)',
                                    }}>
                                        <div>
                                            <h3 className="text-lg font-bold text-[#2D2438]" style={{ fontFamily: '"Nanum Myeongjo", serif' }}>
                                                {selected.geminiBrand || selected.brandHint || '명품'}
                                                {selected.geminiModel && <span className="text-[#9089A1] font-normal text-base ml-2">{selected.geminiModel}</span>}
                                            </h3>
                                            <p className="text-xs text-[#9089A1] mt-0.5">{new Date(selected.updatedAt).toLocaleDateString('ko-KR')}</p>
                                        </div>
                                        {selected.finalVerdict && (() => {
                                            const vcfg = VERDICT_CONFIG[selected.finalVerdict];
                                            const VIcon = vcfg.icon;
                                            return (
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${vcfg.bg} shrink-0`}>
                                                    <VIcon size={13} className={vcfg.cls} />
                                                    <span className={`text-xs font-bold ${vcfg.cls}`}>{vcfg.label}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* 종합 점수 */}
                                    <FinalScoreCard detail={selected} />

                                    {/* 3개 AI 분석 카드 */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <AiAnalysisCard
                                            aiName="Gemini 2.5 Flash"
                                            color="blue"
                                            brand={selected.geminiBrand}
                                            model={selected.geminiModel}
                                            score={selected.geminiScore}
                                            verdict={selected.geminiVerdict}
                                            pointsRaw={selected.geminiPoints}
                                            summary={selected.geminiSummary}
                                        />
                                        <AiAnalysisCard
                                            aiName="Claude Sonnet"
                                            color="purple"
                                            brand={selected.claudeBrand}
                                            model={selected.claudeModel}
                                            score={selected.claudeScore}
                                            verdict={selected.claudeVerdict}
                                            pointsRaw={selected.claudePoints}
                                            summary={selected.claudeSummary}
                                        />
                                        <AiAnalysisCard
                                            aiName="GPT-4o"
                                            color="green"
                                            brand={selected.gptBrand}
                                            model={selected.gptModel}
                                            score={selected.gptScore}
                                            verdict={selected.gptVerdict}
                                            pointsRaw={selected.gptPoints}
                                            summary={selected.gptSummary}
                                        />
                                    </div>

                                    {/* 일치/불일치 */}
                                    <CompareCard agreements={selected.agreements} disagreements={selected.disagreements} />

                                    {/* 면책 문구 — 차분한 베이지 카드 + 진한 글씨(가독성) */}
                                    <div className="rounded-xl px-4 py-3" style={{ background: '#F5EFE3', border: '1px solid #E0D3B8' }}>
                                        <p className="text-[11px] leading-relaxed" style={{ color: '#6B5A3E' }}>
                                            ⚠️ 본 분석은 AI가 사진만으로 제공하는 참고 정보입니다. 100% 정확하지 않으며, 고가 명품 구매 시 반드시 공식 매장 또는 전문 감정 기관의 검증을 받으시기 바랍니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── 서브 컴포넌트 ──────────────────────────────────────────

const ImageGallery: React.FC<{ raw: string }> = ({ raw }) => {
    const urls = parseJson<string[]>(raw, []);
    if (!urls.length) return null;
    return (
        <div className="flex gap-2 overflow-x-auto pb-1">
            {urls.map((url, i) => (
                <img key={i} src={url} className="h-20 w-20 object-cover rounded-xl shrink-0 border border-[#EAE2D3]" alt={`사진 ${i + 1}`} />
            ))}
        </div>
    );
};

// cls = 다크 배경(점수카드)용 밝은 톤 / lightCls = 밝은 배경(좌측 목록)용 진한 톤
function getMarketGrade(score: number) {
    if (score >= 90) return { grade: '정품예상', desc: '정품으로 추정 (만에 하나 오류 가능)', cls: 'text-emerald-300', lightCls: 'text-emerald-700', bg: 'bg-emerald-500/10 border-emerald-500/40' };
    if (score >= 80) return { grade: '미러급',   desc: '1:1 정밀 복제 수준 · 전문가도 육안 구분 어려움', cls: 'text-amber-200', lightCls: 'text-amber-800', bg: 'bg-amber-500/10 border-amber-400/40' };
    if (score >= 70) return { grade: 'S급',      desc: '커스텀급 · 외관 거의 완벽, 정밀 검사 필요', cls: 'text-amber-300', lightCls: 'text-amber-700', bg: 'bg-amber-500/10 border-amber-500/30' };
    if (score >= 60) return { grade: 'A급',      desc: '하이퀄리티 · 일반인 식별 어려움', cls: 'text-orange-300', lightCls: 'text-orange-600', bg: 'bg-orange-500/10 border-orange-500/30' };
    return                  { grade: 'B급',      desc: '일반 가품 · AI가 99% 이상 식별 가능', cls: 'text-rose-300', lightCls: 'text-rose-600', bg: 'bg-rose-500/10 border-rose-500/30' };
}

const FinalScoreCard: React.FC<{ detail: LuxuryDetail }> = ({ detail }) => {
    if (detail.finalScore == null) return null;
    const score = detail.finalScore;
    const barColor = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    const grade = getMarketGrade(score);
    return (
        <div className="rounded-2xl p-4 space-y-3" style={{
            background: 'linear-gradient(160deg, #1e2436 0%, #161b29 100%)',
            border: '1px solid rgba(142,111,183,0.3)',
            boxShadow: '0 8px 28px -10px rgba(0,0,0,0.5)',
        }}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: '#D9C9A3', fontFamily: '"Nanum Myeongjo", serif', letterSpacing: '0.03em' }}>
                    AI 정밀 감정 지수
                </span>
                <span className="text-2xl font-bold" style={{ color: '#E8DCC0' }}>{score}<span className="text-sm" style={{ color: '#8A7E63' }}>/100</span></span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${score}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[10px]" style={{ color: '#8A7E63' }}>
                <span>가품 징후</span>
                <span>정품 헤리티지 충족</span>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${grade.bg}`}>
                <div>
                    <span className="text-[10px]" style={{ color: '#8A7E63' }}>정밀 복제도 평가</span>
                    <p className={`text-xs font-semibold ${grade.cls}`}>{grade.desc}</p>
                </div>
                <span className={`text-2xl font-black ${grade.cls}`} style={{ fontFamily: '"Nanum Myeongjo", serif' }}>{grade.grade}</span>
            </div>
        </div>
    );
};

const AiAnalysisCard: React.FC<{
    aiName: string; color: 'blue' | 'purple' | 'green';
    brand: string | null; model: string | null;
    score: number | null; verdict: string | null;
    pointsRaw: string | null; summary: string | null;
}> = ({ aiName, color, brand, model, score, verdict, pointsRaw, summary }) => {
    const points = parseJson<AnalysisPoint[]>(pointsRaw, []);
    const vcfg = verdict ? VERDICT_CONFIG[verdict] : null;
    const colorCls = color === 'blue'
        ? 'text-[#8E6FB7] bg-[#8E6FB7]/10 border-[#8E6FB7]/20'
        : color === 'green'
        ? 'text-green-600 bg-green-500/10 border-green-500/20'
        : 'text-purple-500 bg-purple-500/10 border-purple-500/20';

    return (
        <div className="bg-white/40 rounded-2xl border border-[#EAE2D3] p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${colorCls}`}>{aiName}</span>
                {score != null && <span className="text-sm font-bold text-[#2D2438]">{score}점</span>}
            </div>
            {brand && <div className="text-xs font-semibold text-[#2D2438]">{brand}{model && <span className="text-[#9089A1] font-normal ml-1">{model}</span>}</div>}
            {vcfg && (
                <div className={`flex items-center gap-1.5 text-[11px] font-medium ${vcfg.cls}`}>
                    <vcfg.icon size={11} />{vcfg.label}
                </div>
            )}
            {points.length > 0 && (
                <div className="space-y-1">
                    {points.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px]">
                            <span className={`shrink-0 font-medium ${POINT_RESULT_CLS[p.result] || 'text-[#9089A1]'}`}>
                                {p.result === '정상' ? '✅' : p.result === '이상' ? '❌' : '❓'}
                            </span>
                            <div>
                                <span className="text-[#5C5468] font-medium">{p.item}</span>
                                {p.detail && <span className="text-[#9089A1] ml-1">{p.detail}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {summary && <p className="text-[11px] text-[#9089A1] leading-relaxed border-t border-[#EAE2D3] pt-2">{summary}</p>}
        </div>
    );
};

const CompareCard: React.FC<{ agreements: string | null; disagreements: string | null }> = ({ agreements, disagreements }) => {
    const agr = parseJson<string[]>(agreements, []);
    const dis = parseJson<string[]>(disagreements, []);
    if (!agr.length && !dis.length) return null;
    return (
        <div className="bg-white/40 rounded-2xl border border-[#EAE2D3] p-4 space-y-3">
            <span className="text-xs font-semibold text-[#2D2438]">3중 AI 비교</span>
            {agr.length > 0 && (
                <div>
                    <div className="text-[11px] text-emerald-700 font-bold mb-1">✅ 일치 항목 ({agr.length})</div>
                    <div className="space-y-0.5">
                        {agr.map((a, i) => <div key={i} className="text-[11px] text-[#5C5468]">{a}</div>)}
                    </div>
                </div>
            )}
            {dis.length > 0 && (
                <div>
                    <div className="text-[11px] text-orange-600 font-bold mb-1">⚠️ 불일치 항목 ({dis.length}) — 주의 필요</div>
                    <div className="space-y-0.5">
                        {dis.map((d, i) => <div key={i} className="text-[11px] text-orange-700/90">{d}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
};
