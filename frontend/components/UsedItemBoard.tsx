import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Plus, ShoppingBag, Clock, CheckCircle, XCircle, Loader,
    Trash2, RefreshCw, RotateCcw, ChevronLeft, Upload, Copy, Check,
    ImageIcon, Tag, Banknote, Package,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────

interface UsedItemTask {
    id: number;
    itemName: string | null;
    modelName: string | null;
    brand: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    suggestedPrice: number | null;
    finalPrice: number | null;
    imageUrls: string;
    createdAt: string;
    updatedAt: string;
    errorMessage: string | null;
}

interface UsedItemDetail extends UsedItemTask {
    category: string | null;
    condition: string | null;
    conditionDetail: string | null;
    visibleDamage: string | null;
    includedItems: string | null;
    confidence: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    priceReason: string | null;
    aiTitle: string | null;
    aiDescription: string | null;
    aiHashtags: string | null;
    finalTitle: string | null;
    finalDescription: string | null;
}

interface Props {
    onClose: () => void;
}

// ── 유틸 ──────────────────────────────────────────────────

const API = (path: string) => `/api/used-item${path}`;

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}

const STATUS_CONFIG = {
    pending:    { label: '대기중',  icon: Clock,        cls: 'text-yellow-400' },
    processing: { label: '분석중',  icon: Loader,       cls: 'text-blue-400' },
    completed:  { label: '완료',    icon: CheckCircle,  cls: 'text-green-400' },
    failed:     { label: '실패',    icon: XCircle,      cls: 'text-red-400' },
};

const CONDITION_COLOR: Record<string, string> = {
    '상': 'text-green-400 bg-green-400/10 border-green-500/30',
    '중': 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
    '하': 'text-red-400 bg-red-400/10 border-red-500/30',
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
}

function fmtPrice(n: number | null | undefined) {
    if (!n) return '—';
    return n.toLocaleString('ko-KR') + '원';
}

// ── 메인 컴포넌트 ──────────────────────────────────────────

export const UsedItemBoard: React.FC<Props> = ({ onClose }) => {
    const [tasks, setTasks] = useState<UsedItemTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<UsedItemDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // 업로드 상태
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [itemName, setItemName] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 수정 상태
    const [editTitle, setEditTitle] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch<UsedItemTask[]>(API(''));
            setTasks(data);
        } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // pending/processing 있으면 10초마다 폴링
    useEffect(() => {
        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
        if (!hasActive) return;
        const t = setTimeout(loadTasks, 10000);
        return () => clearTimeout(t);
    }, [tasks, loadTasks]);

    // 파일 선택
    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;
        const accepted = Array.from(newFiles)
            .filter(f => f.type.startsWith('image/'))
            .slice(0, 5);
        setFiles(accepted);
        const urls = accepted.map(f => URL.createObjectURL(f));
        setPreviews(urls);
    };

    // GCS 서명 URL 업로드 후 목록 생성
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.length) return;
        setUploading(true);
        try {
            // 1) 서명 URL 요청
            const urlReqs = files.map(f => ({ name: f.name, type: f.type }));
            const signedResults = await apiFetch<{ signedUrl: string; publicUrl: string }[]>(
                API('/upload-urls'),
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: urlReqs }) }
            );

            // 2) GCS에 직접 업로드
            await Promise.all(
                files.map((file, i) =>
                    fetch(signedResults[i].signedUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    })
                )
            );

            // 3) 분석 요청 생성
            const imageUrls = signedResults.map(r => r.publicUrl);
            await apiFetch(API(''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrls, itemName: itemName.trim() || undefined }),
            });

            // 초기화
            setFiles([]);
            setPreviews([]);
            setItemName('');
            await loadTasks();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setUploading(false);
        }
    };

    // 상세 조회
    const handleSelect = async (task: UsedItemTask) => {
        if (task.status !== 'completed') return;
        setDetailLoading(true);
        try {
            const detail = await apiFetch<UsedItemDetail>(API(`/${task.id}`));
            setSelected(detail);
            setEditTitle(detail.finalTitle || detail.aiTitle || '');
            setEditPrice(String(detail.finalPrice || detail.suggestedPrice || ''));
            setEditDesc(detail.finalDescription || detail.aiDescription || '');
        } finally {
            setDetailLoading(false);
        }
    };

    // 수정 저장
    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await apiFetch(API(`/${selected.id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    finalTitle: editTitle,
                    finalPrice: Number(editPrice),
                    finalDescription: editDesc,
                }),
            });
            setSelected(prev => prev ? {
                ...prev, finalTitle: editTitle,
                finalPrice: Number(editPrice), finalDescription: editDesc,
            } : null);
        } catch (e: any) { alert(e.message); }
        finally { setSaving(false); }
    };

    // 당근마켓 올리기: 클립보드 복사 + 앱 딥링크
    const handlePostToKarrot = async () => {
        const text = `${editTitle}\n\n가격: ${Number(editPrice).toLocaleString()}원\n\n${editDesc}`;
        try {
            await navigator.clipboard.writeText(text);
        } catch { }
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);

        // 당근마켓 앱 열기 시도 → 실패 시 웹으로 폴백
        window.location.href = 'karrot://';
        setTimeout(() => {
            window.open('https://www.daangn.com', '_blank');
        }, 1500);
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


    const displayName = (t: UsedItemTask) =>
        [t.brand, t.modelName].filter(Boolean).join(' ') || t.itemName || '상품 분석중...';

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center md:p-4">
            <div className="bg-slate-900 md:border border-slate-700 md:rounded-2xl w-full md:max-w-5xl h-full md:h-auto md:max-h-[95vh] flex flex-col shadow-2xl">

                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0 bg-gradient-to-r from-slate-900 to-orange-950/30 md:rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={17} className="text-orange-400" />
                        <h2 className="text-sm font-bold text-white">중고 판매</h2>
                        <span className="text-[10px] text-orange-300/70 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">Vision AI</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                        <X size={17} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* ── 좌측: 업로드 + 목록 ── */}
                    <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-64 shrink-0 border-r border-slate-800 flex-col`}>

                        {/* 업로드 폼 */}
                        <form onSubmit={handleSubmit} className="p-3 border-b border-slate-800 space-y-2">
                            {/* 드롭존 */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-700 hover:border-orange-500/50 rounded-xl p-3 text-center cursor-pointer transition-colors"
                            >
                                {previews.length > 0 ? (
                                    <div className="flex gap-1 flex-wrap justify-center">
                                        {previews.map((p, i) => (
                                            <img key={i} src={p} className="w-12 h-12 object-cover rounded-lg" alt="" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 py-1">
                                        <ImageIcon size={22} className="text-slate-600" />
                                        <p className="text-[11px] text-slate-500">사진 선택 (최대 5장)</p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={e => handleFiles(e.target.files)}
                            />

                            {/* 품목명 (선택) */}
                            <input
                                value={itemName}
                                onChange={e => setItemName(e.target.value)}
                                placeholder="품목명 입력 (선택, 예: 아이폰15)"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />

                            <button
                                type="submit"
                                disabled={uploading || !files.length}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                            >
                                {uploading
                                    ? <><Loader size={13} className="animate-spin" /> 업로드 중...</>
                                    : <><Upload size={13} /> AI 분석 요청</>}
                            </button>
                        </form>

                        {/* 목록 */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loading && <div className="text-center py-8 text-slate-500 text-xs">불러오는 중...</div>}
                            {!loading && tasks.length === 0 && (
                                <div className="px-3 py-6 space-y-4">
                                    <div className="text-center space-y-1.5">
                                        <div className="text-slate-300 text-xs font-semibold">🛍 중고 판매 도우미</div>
                                        <p className="text-slate-500 text-[11px] leading-relaxed">
                                            사진을 올리면 AI가 상품을 분석하고<br />판매글을 자동으로 작성해드립니다.
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-xl px-3 py-2.5 space-y-1">
                                        <p className="text-slate-400 text-[11px]">사진 선택 후 <span className="text-orange-400 font-medium">AI 분석 요청</span> 클릭</p>
                                        <p className="text-slate-600 text-[10px]">예) 스마트폰, 노트북, 가전제품</p>
                                        <p className="text-slate-600 text-[10px] mt-1">⏱ 분석은 최대 1분 소요됩니다</p>
                                    </div>
                                    <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-1.5">
                                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                            <div key={k} className="flex items-center gap-1.5">
                                                <v.icon size={11} className={`${v.cls} shrink-0`} />
                                                <span className="text-[10px] text-slate-500">{v.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {tasks.map(task => {
                                const cfg = STATUS_CONFIG[task.status];
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => handleSelect(task)}
                                        className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                                            task.status === 'completed' ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'
                                        } ${selected?.id === task.id ? 'bg-slate-800 ring-1 ring-orange-500/40' : ''}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white truncate">{displayName(task)}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <cfg.icon size={10} className={`${cfg.cls} shrink-0 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                                                <span className={`text-[10px] ${cfg.cls}`}>{cfg.label}</span>
                                                {task.finalPrice && (
                                                    <span className="text-[10px] text-slate-400">{fmtPrice(task.finalPrice)}</span>
                                                )}
                                            </div>
                                            {task.status === 'failed' && task.errorMessage && (
                                                <div className="text-[10px] text-red-400 truncate mt-0.5">{task.errorMessage}</div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {task.status === 'failed' && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleRetry(task.id); }}
                                                    className="p-1 rounded text-slate-500 hover:text-yellow-400 transition-colors"
                                                    title="재분석"
                                                >
                                                    <RotateCcw size={11} />
                                                </button>
                                            )}
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                                                className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-2 border-t border-slate-800">
                            <button onClick={loadTasks} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
                                <RefreshCw size={11} /> 새로고침
                            </button>
                        </div>
                    </div>

                    {/* ── 우측: 분석 결과 + 편집 카드 ── */}
                    <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
                        {/* 모바일 뒤로가기 */}
                        <div className="md:hidden flex items-center px-4 py-2 border-b border-slate-800 shrink-0">
                            <button
                                onClick={() => setSelected(null)}
                                className="flex items-center gap-1 text-slate-400 hover:text-white text-xs transition-colors"
                            >
                                <ChevronLeft size={14} /> 목록으로
                            </button>
                        </div>

                        {detailLoading && (
                            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                                <Loader size={16} className="animate-spin mr-2" /> 불러오는 중...
                            </div>
                        )}
                        {!detailLoading && !selected && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                                <ShoppingBag size={40} className="text-slate-700" />
                                <p className="text-xs">완료된 분석을 클릭하면 결과가 표시됩니다</p>
                            </div>
                        )}

                        {!detailLoading && selected && (
                            <div className="flex-1 overflow-y-auto">
                                {/* 상단 헤더 */}
                                <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-orange-950/20">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">
                                                {[selected.brand, selected.modelName].filter(Boolean).join(' ') || selected.itemName || '분석 결과'}
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {selected.category} &nbsp;·&nbsp; {new Date(selected.updatedAt).toLocaleDateString('ko-KR')}
                                            </p>
                                        </div>
                                        {selected.condition && (
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${CONDITION_COLOR[selected.condition] || 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                                                상태 {selected.condition}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* AI 분석 정보 */}
                                    <AnalysisCard detail={selected} />

                                    {/* 가격 범위 */}
                                    <PriceCard detail={selected} />

                                    {/* 편집 가능한 판매글 카드 */}
                                    <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Tag size={14} className="text-orange-400" />
                                            <span className="text-xs font-semibold text-white">판매글 편집</span>
                                            <span className="text-[10px] text-slate-500 ml-auto">수정 후 저장하세요</span>
                                        </div>

                                        {/* 제목 */}
                                        <div>
                                            <label className="text-[10px] text-slate-400 mb-1 block">제목</label>
                                            <input
                                                value={editTitle}
                                                onChange={e => setEditTitle(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                placeholder="판매 제목"
                                            />
                                        </div>

                                        {/* 가격 */}
                                        <div>
                                            <label className="text-[10px] text-slate-400 mb-1 block">가격 (원)</label>
                                            <input
                                                type="number"
                                                value={editPrice}
                                                onChange={e => setEditPrice(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* 본문 */}
                                        <div>
                                            <label className="text-[10px] text-slate-400 mb-1 block">본문</label>
                                            <textarea
                                                value={editDesc}
                                                onChange={e => setEditDesc(e.target.value)}
                                                rows={6}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                                                placeholder="판매 본문"
                                            />
                                        </div>

                                        {/* 해시태그 */}
                                        <HashtagRow raw={selected.aiHashtags} />

                                        {/* 버튼 영역 */}
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                                            >
                                                {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                                                저장
                                            </button>

                                            <button
                                                onClick={handlePostToKarrot}
                                                className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors"
                                            >
                                                {copied
                                                    ? <><Copy size={13} /> 복사 완료! 당근마켓 열기</>
                                                    : <><ShoppingBag size={13} /> 당근마켓에 올리기</>}
                                            </button>
                                        </div>

                                        {copied && (
                                            <p className="text-[10px] text-orange-300 text-center">
                                                판매글이 복사됐습니다. 당근마켓 앱에서 글쓰기 → 붙여넣기 하세요.
                                            </p>
                                        )}
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
                <img
                    key={i}
                    src={url}
                    className="h-24 w-24 object-cover rounded-xl shrink-0 border border-slate-700"
                    alt={`상품 사진 ${i + 1}`}
                />
            ))}
        </div>
    );
};

const AnalysisCard: React.FC<{ detail: UsedItemDetail }> = ({ detail }) => {
    const damage = parseJson<string[]>(detail.visibleDamage, []);
    const included = parseJson<string[]>(detail.includedItems, []);
    const confidence = detail.confidence != null ? Math.round(detail.confidence * 100) : null;

    return (
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-white">AI 분석 결과</span>
                {confidence != null && (
                    <span className="ml-auto text-[10px] text-slate-500">신뢰도 {confidence}%</span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
                <InfoRow label="카테고리" value={detail.category} />
                <InfoRow label="브랜드" value={detail.brand} />
                <InfoRow label="모델명" value={detail.modelName} />
                <InfoRow label="상태" value={detail.condition} />
            </div>
            {detail.conditionDetail && (
                <p className="mt-2 text-[11px] text-slate-400 bg-slate-900/60 rounded-lg px-3 py-1.5">
                    {detail.conditionDetail}
                </p>
            )}
            {damage.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[10px] text-slate-500 mr-1">하자:</span>
                    {damage.map((d, i) => (
                        <span key={i} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">{d}</span>
                    ))}
                </div>
            )}
            {included.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[10px] text-slate-500 mr-1">구성품:</span>
                    {included.map((item, i) => (
                        <span key={i} className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">{item}</span>
                    ))}
                </div>
            )}
        </div>
    );
};

const PriceCard: React.FC<{ detail: UsedItemDetail }> = ({ detail }) => {
    if (!detail.suggestedPrice) return null;
    return (
        <div className="bg-orange-950/30 rounded-2xl border border-orange-800/30 p-4">
            <div className="flex items-center gap-2 mb-3">
                <Banknote size={14} className="text-orange-400" />
                <span className="text-xs font-semibold text-white">AI 추천 가격</span>
            </div>
            <div className="flex items-end gap-3">
                <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">추천가</div>
                    <div className="text-xl font-bold text-orange-300">{fmtPrice(detail.suggestedPrice)}</div>
                </div>
                <div className="text-[10px] text-slate-500 pb-0.5">
                    {fmtPrice(detail.minPrice)} ~ {fmtPrice(detail.maxPrice)}
                </div>
            </div>
            {detail.priceReason && (
                <p className="mt-2 text-[11px] text-slate-400">{detail.priceReason}</p>
            )}
        </div>
    );
};

const HashtagRow: React.FC<{ raw: string | null }> = ({ raw }) => {
    const tags = parseJson<string[]>(raw, []);
    if (!tags.length) return null;
    return (
        <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
                <span key={i} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
        </div>
    );
};

const InfoRow: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
    <div>
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-white font-medium mt-0.5">{value || '—'}</div>
    </div>
);
