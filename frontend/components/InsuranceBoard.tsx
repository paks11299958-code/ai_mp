import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, ShieldCheck, Clock, CheckCircle, XCircle, Loader,
    Trash2, RotateCcw, ChevronLeft, UploadCloud, FileText, AlertTriangle,
} from 'lucide-react';
import { GuideCard } from './GuideCard';

// ── 타입 ──────────────────────────────────────────────────

type Status = 'pending' | 'processing' | 'completed' | 'failed';

interface InsuranceUserInfo {
    title: string; gender: string; age: string;
    job: string; health: string; budget: string; purpose: string;
}

interface InsuranceTask {
    id: number;
    status: Status;
    fileNames: string;      // JSON 배열 문자열
    userInfo: string | null;
    totalPolicies: number | null;
    duplicateCount: number | null;
    monthlySavings: string | null;
    riskLevel: string | null;
    createdAt: string;
    updatedAt: string;
    errorMessage: string | null;
}

interface Duplicate {
    item: string; policies: string; coverageA: string; coverageB: string;
    type: string; monthlySavings: string; severity: string; action: string;
}

interface InsuranceDetail extends InsuranceTask {
    duplicatesJson: string | null;
    aiSummary: string | null;
    recommendation: string | null;
    disclaimer: string | null;
}

interface Props {
    onClose: () => void;
}

// ── 유틸 ──────────────────────────────────────────────────

const API = (path: string) => `/api/insurance-analysis${path}`;
const MAX_FILES = 5;

const isPDF = (n: string) => /\.pdf$/i.test(n);
const isImage = (n: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(n);
const fileIcon = (n: string) => isPDF(n) ? '📕' : isImage(n) ? '🖼️' : '📄';
const fmtSize = (b: number) => b < 1024 ? b + 'B' : b < 1048576 ? (b / 1024).toFixed(1) + 'KB' : (b / 1048576).toFixed(1) + 'MB';

const getMediaType = (n: string): string =>
    /\.pdf$/i.test(n) ? 'application/pdf' :
    /\.png$/i.test(n) ? 'image/png' :
    /\.gif$/i.test(n) ? 'image/gif' :
    /\.webp$/i.test(n) ? 'image/webp' : 'image/jpeg';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
}

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ElementType; cls: string }> = {
    pending:    { label: '대기중', icon: Clock,       cls: 'text-orange-500' },
    processing: { label: '분석중', icon: Loader,      cls: 'text-[#8E6FB7]' },
    completed:  { label: '완료',   icon: CheckCircle, cls: 'text-emerald-600' },
    failed:     { label: '실패',   icon: XCircle,     cls: 'text-red-400' },
};

const riskColor = (s: string | null) => s === '높음' ? '#EF4444' : s === '중간' ? '#F59E0B' : '#22C55E';
const sevStyle = (s: string) =>
    s === '높음' ? { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' } :
    s === '중간' ? { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' } :
                   { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' };

// ── 메인 컴포넌트 ──────────────────────────────────────────

export const InsuranceBoard: React.FC<Props> = ({ onClose }) => {
    const [tasks, setTasks] = useState<InsuranceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<InsuranceDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [info, setInfo] = useState<InsuranceUserInfo>({
        title: '', gender: '', age: '', job: '', health: '', budget: '', purpose: '',
    });
    const [showAdditional, setShowAdditional] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch<InsuranceTask[]>(API(''));
            setTasks(data);
        } catch { /* 무시 */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // 진행 중 작업이 있으면 10초마다 폴링
    useEffect(() => {
        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
        if (!hasActive) return;
        const t = setTimeout(loadTasks, 10000);
        return () => clearTimeout(t);
    }, [tasks, loadTasks]);

    const addFiles = (list: FileList | File[] | null) => {
        if (!list) return;
        const allowed = Array.from(list).filter(f => isPDF(f.name) || isImage(f.name));
        setFiles(prev => {
            const names = new Set(prev.map(f => f.name));
            const incoming = allowed.filter(f => !names.has(f.name));
            return [...prev, ...incoming].slice(0, MAX_FILES);
        });
    };

    const handleSubmit = async () => {
        if (!files.length) { setError('보험 문서를 1개 이상 올려주세요.'); return; }
        if (!info.title.trim()) { setError('분석 제목을 입력해 주세요.'); return; }
        setError('');
        setUploading(true);
        try {
            const urlReqs = files.map(f => ({ name: f.name, type: getMediaType(f.name) }));
            const signed = await apiFetch<{ signedUrl: string; publicUrl: string }[]>(
                API('/upload-urls'),
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: urlReqs }) },
            );
            await Promise.all(files.map((file, i) =>
                fetch(signed[i].signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': getMediaType(file.name) } }),
            ));
            await apiFetch(API(''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileUrls: signed.map(r => r.publicUrl),
                    fileNames: files.map(f => f.name),
                    userInfo: info,
                }),
            });
            setFiles([]);
            setInfo({ title: '', gender: '', age: '', job: '', health: '', budget: '', purpose: '' });
            setShowAdditional(false);
            await loadTasks();
        } catch (e: any) {
            setError(e.message || '분석 요청에 실패했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const handleSelect = async (task: InsuranceTask) => {
        if (task.status !== 'completed') return;
        setDetailLoading(true);
        try {
            const detail = await apiFetch<InsuranceDetail>(API(`/${task.id}`));
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
        if (!confirm('이 분석 내역을 삭제하시겠습니까?')) return;
        await apiFetch(API(`/${id}`), { method: 'DELETE' });
        setTasks(prev => prev.filter(t => t.id !== id));
        if (selected?.id === id) setSelected(null);
    };

    const taskTitle = (t: InsuranceTask) => {
        const ui = parseJson<Partial<InsuranceUserInfo>>(t.userInfo, {});
        return ui.title || '보험 분석';
    };

    const inputCls = 'w-full border border-[#EAE2D3] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#8E6FB7] transition-colors bg-white text-[#2D2438]';

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[60px] md:pt-[84px] md:px-6 md:pb-6">
            <div className="bg-[#FBF8F3] md:border border-[#F0E9DE] rounded-t-2xl md:rounded-2xl w-full max-w-3xl h-[calc(100vh-60px)] md:h-auto md:max-h-[calc(100vh-108px)] flex flex-col shadow-2xl overflow-hidden">

                {/* 헤더 */}
                <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-[#F0E9DE] shrink-0 bg-white md:rounded-t-2xl">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {selected && (
                            <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 font-bold shrink-0 rounded-full transition" style={{ fontSize: 12, padding: '5px 13px', color: '#fff', background: '#8E6FB7', border: '1px solid #8E6FB7', boxShadow: '0 2px 8px -3px rgba(142,111,183,0.5)' }}>
                                <ChevronLeft size={14} strokeWidth={2.6} /> 목록으로
                            </button>
                        )}
                        <ShieldCheck size={17} style={{ color: '#8E6FB7', flexShrink: 0 }} />
                        <h2 className="text-sm font-bold truncate" style={{ color: '#2D2438', fontFamily: '"Nanum Myeongjo", serif', letterSpacing: '0.02em' }}>
                            보험 분석 <span className="text-[10px] tracking-[0.2em]" style={{ color: '#8E6FB7' }}>INSURE CHECK</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-[#9089A1] hover:text-[#2D2438] hover:bg-white transition-colors">
                        <X size={17} />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto">
                    {selected ? (
                        <ResultView detail={selected} loading={detailLoading} />
                    ) : (
                        <div className="p-4 space-y-4 max-w-2xl mx-auto">
                            <GuideCard
                                storageKey="guide_insurance"
                                accent="#8E6FB7"
                                title="보험 분석 사용법"
                                steps={[
                                    { emoji: '1️⃣', title: '정보 입력', desc: '제목·성별·생년월일을 넣어요. 건강·예산을 더하면 분석이 정확해져요.' },
                                    { emoji: '2️⃣', title: '보험증권 올리기', desc: '가입한 보험 증권을 PDF나 사진으로 올려요(여러 개 가능).' },
                                    { emoji: '3️⃣', title: 'AI 중복 분석', desc: 'AI가 중복 보장 항목과 절감 가능 금액을 찾아드려요.' },
                                ]}
                                tip="첨부 문서는 분석에만 쓰이고 분석 후 삭제돼요. 참고용이니 변경 전 전문가 상담을 권장해요."
                            />

                            {/* 기본 정보 */}
                            <div className="rounded-2xl bg-white border border-[#F0E9DE] p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-1 h-4 rounded-full bg-[#8E6FB7]" />
                                    <span className="text-sm font-bold text-[#2D2438]">기본 정보</span>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-[#6B5F56]">제목 <span className="text-red-500">*</span></label>
                                    <input className={`${inputCls} mt-1.5`} value={info.title}
                                        onChange={e => setInfo(p => ({ ...p, title: e.target.value }))}
                                        placeholder="예: 내보험 점검" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-[#6B5F56]">성별</label>
                                        <div className="flex rounded-xl overflow-hidden border border-[#EAE2D3] mt-1.5">
                                            {['남성', '여성'].map(opt => (
                                                <button key={opt} type="button"
                                                    onClick={() => setInfo(p => ({ ...p, gender: opt }))}
                                                    className="flex-1 py-2 text-sm font-medium transition-all"
                                                    style={info.gender === opt
                                                        ? { background: '#8E6FB7', color: '#fff', fontWeight: 700 }
                                                        : { color: '#9089A1', background: '#fff' }}>
                                                    {opt === '남성' ? '♂ 남성' : '♀ 여성'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-[#6B5F56]">생년월일</label>
                                        <input type="date" className={`${inputCls} mt-1.5`} value={info.age}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={e => setInfo(p => ({ ...p, age: e.target.value }))} />
                                    </div>
                                </div>

                                <button type="button" onClick={() => setShowAdditional(v => !v)}
                                    className="flex items-center gap-2 text-xs text-[#8E6FB7] font-medium">
                                    <span className={`transition-transform ${showAdditional ? 'rotate-90' : ''}`}>▶</span>
                                    추가 정보 입력 (선택)
                                </button>

                                {showAdditional && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        {([
                                            { key: 'job', label: '직업', ph: '예: 사무직' },
                                            { key: 'health', label: '건강', ph: '예: 고혈압 복용 중' },
                                            { key: 'budget', label: '예산', ph: '예: 월 15만원' },
                                            { key: 'purpose', label: '목적', ph: '예: 중복 보장 제거' },
                                        ] as const).map(f => (
                                            <div key={f.key}>
                                                <label className="text-xs font-semibold text-[#6B5F56]">{f.label}</label>
                                                <input className={`${inputCls} mt-1.5`} value={info[f.key]}
                                                    onChange={e => setInfo(p => ({ ...p, [f.key]: e.target.value }))}
                                                    placeholder={f.ph} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 업로드 */}
                            <div className="rounded-2xl bg-white border border-[#F0E9DE] p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-1 h-4 rounded-full bg-[#8E6FB7]" />
                                    <span className="text-sm font-bold text-[#2D2438]">보험 문서 업로드</span>
                                </div>
                                <div className="flex items-center justify-center gap-1.5 text-xs text-[#9089A1]">
                                    <span>🔒</span><span>첨부 파일은 분석에만 쓰이며 분석 후 삭제됩니다.</span>
                                </div>

                                <div
                                    className="rounded-2xl p-6 text-center cursor-pointer transition-all select-none"
                                    style={{ border: `2px dashed ${dragging ? '#8E6FB7' : '#EAE2D3'}`, background: dragging ? 'rgba(142,111,183,0.05)' : '#FBF8F3' }}
                                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                                    onClick={() => fileInputRef.current?.click()}>
                                    <input ref={fileInputRef} type="file" multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                                        className="hidden" onChange={e => addFiles(e.target.files)} />
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: '#F0E9DE' }}>
                                        <UploadCloud size={22} color="#8E6FB7" strokeWidth={1.5} />
                                    </div>
                                    <p className="text-sm font-medium text-[#6B5F56]">드래그하거나 클릭하여 업로드</p>
                                    <p className="text-xs text-[#9089A1] mt-0.5">PDF · JPG · PNG · 최대 {MAX_FILES}개</p>
                                </div>

                                {files.length > 0 && (
                                    <div className="space-y-2">
                                        {files.map((f, i) => (
                                            <div key={f.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FBF8F3] border border-[#F0E9DE]">
                                                <span className="text-base">{fileIcon(f.name)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm truncate text-[#2D2438]">{f.name}</div>
                                                    <div className="text-xs text-[#9089A1]">{fmtSize(f.size)}</div>
                                                </div>
                                                <button className="p-1 text-[#9089A1] hover:text-red-500 transition-colors"
                                                    onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>{error}</div>
                            )}

                            <button
                                disabled={uploading || !files.length}
                                onClick={handleSubmit}
                                className="w-full py-3.5 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition-all"
                                style={{
                                    background: uploading || !files.length ? '#EAE2D3' : '#8E6FB7',
                                    color: uploading || !files.length ? '#9089A1' : '#fff',
                                    cursor: uploading || !files.length ? 'not-allowed' : 'pointer',
                                }}>
                                {uploading ? <><Loader size={16} className="animate-spin" /> 요청 중...</> : <>🔍 AI 중복 분석 시작</>}
                            </button>

                            {/* 분석 내역 */}
                            <div>
                                <div className="text-xs font-bold tracking-widest uppercase text-[#9089A1] mb-2.5 mt-2">분석 내역</div>
                                {loading ? (
                                    <div className="text-center py-8 text-sm text-[#9089A1]">불러오는 중...</div>
                                ) : tasks.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-[#9089A1]">아직 분석한 내역이 없어요.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {tasks.map(t => {
                                            const sc = STATUS_CONFIG[t.status];
                                            const Icon = sc.icon;
                                            const names = parseJson<string[]>(t.fileNames, []);
                                            return (
                                                <div key={t.id}
                                                    onClick={() => handleSelect(t)}
                                                    className={`rounded-xl bg-white border border-[#F0E9DE] p-3 flex items-center gap-3 ${t.status === 'completed' ? 'cursor-pointer hover:border-[#8E6FB7]/50' : ''} transition-colors`}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-[#2D2438] truncate">{taskTitle(t)}</div>
                                                        <div className="text-xs text-[#9089A1] truncate">
                                                            문서 {names.length}개 · {new Date(t.createdAt).toLocaleDateString('ko-KR')}
                                                            {t.status === 'completed' && t.duplicateCount != null && ` · 중복 ${t.duplicateCount}건`}
                                                        </div>
                                                        {t.status === 'failed' && t.errorMessage && (
                                                            <div className="text-xs text-red-400 truncate mt-0.5">{t.errorMessage}</div>
                                                        )}
                                                    </div>
                                                    <div className={`flex items-center gap-1 text-xs font-medium shrink-0 ${sc.cls}`}>
                                                        <Icon size={13} className={t.status === 'processing' ? 'animate-spin' : ''} />
                                                        {sc.label}
                                                    </div>
                                                    {t.status === 'failed' && (
                                                        <button onClick={e => { e.stopPropagation(); handleRetry(t.id); }}
                                                            className="p-1.5 text-[#9089A1] hover:text-[#8E6FB7] transition-colors" title="재시도">
                                                            <RotateCcw size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                                                        className="p-1.5 text-[#9089A1] hover:text-red-500 transition-colors" title="삭제">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── 결과 보기 ──────────────────────────────────────────────

const ResultView: React.FC<{ detail: InsuranceDetail; loading: boolean }> = ({ detail, loading }) => {
    if (loading) return <div className="text-center py-16 text-sm text-[#9089A1]">결과를 불러오는 중...</div>;
    const duplicates = parseJson<Duplicate[]>(detail.duplicatesJson, []);

    const metrics = [
        { value: detail.duplicateCount ?? 0, label: '중복 항목', color: '#EF4444' },
        { value: detail.totalPolicies ?? 0, label: '분석 보험', color: '#2D2438' },
        { value: detail.monthlySavings || '-', label: '절감 예상', color: '#F59E0B' },
        { value: detail.riskLevel || '-', label: '위험도', color: riskColor(detail.riskLevel) },
    ];

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-5">
            <div>
                <h3 className="text-base font-bold text-[#2D2438]">분석 완료 보고서</h3>
                <div className="text-xs text-[#9089A1] mt-0.5">{new Date(detail.updatedAt).toLocaleString('ko-KR')}</div>
            </div>

            {/* 요약 지표 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {metrics.map((m, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-[#F0E9DE] p-4 text-center">
                        <div className="text-lg font-bold mb-1 truncate" style={{ color: m.color }}>{m.value}</div>
                        <div className="text-xs text-[#9089A1]">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* AI 요약 */}
            {detail.aiSummary && (
                <div className="rounded-2xl bg-white border border-[#F0E9DE] p-4" style={{ borderLeft: '3px solid #8E6FB7' }}>
                    <div className="text-xs font-bold tracking-widest uppercase text-[#8E6FB7] mb-2">AI 분석 요약</div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#6B5F56]">{detail.aiSummary}</p>
                </div>
            )}

            {/* 중복 상세 */}
            <div>
                <div className="text-xs font-bold tracking-widest uppercase text-[#9089A1] mb-2.5">중복 보장 상세</div>
                {duplicates.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-[#F0E9DE] p-6 text-center text-sm text-[#9089A1]">
                        중복 보장 항목이 발견되지 않았습니다 👍
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {duplicates.map((d, i) => {
                            const sv = sevStyle(d.severity);
                            return (
                                <div key={i} className="rounded-2xl bg-white border border-[#F0E9DE] p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-[#2D2438]">{d.item}</div>
                                            <div className="text-xs text-[#9089A1] mt-0.5">{d.policies}</div>
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0"
                                            style={{ color: sv.color, background: sv.bg, borderColor: sv.border }}>{d.severity}</span>
                                    </div>
                                    <div className="text-xs text-[#6B5F56] space-y-0.5 mb-2">
                                        <div>A: {d.coverageA}</div>
                                        <div className="text-[#9089A1]">B: {d.coverageB}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-[#9089A1]">{d.type}</span>
                                        <span className="font-semibold text-[#F59E0B]">{d.monthlySavings}</span>
                                    </div>
                                    {d.action && (
                                        <div className="mt-2 pt-2 border-t border-[#F0E9DE] text-xs text-[#6B5F56] flex items-start gap-1.5">
                                            <AlertTriangle size={13} className="text-[#8E6FB7] shrink-0 mt-0.5" />
                                            {d.action}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* AI 권고 */}
            {detail.recommendation && (
                <div>
                    <div className="text-xs font-bold tracking-widest uppercase text-[#9089A1] mb-2.5">AI 권고사항</div>
                    <div className="rounded-2xl bg-white border border-[#F0E9DE] p-4 text-sm leading-relaxed text-[#6B5F56]" style={{ borderLeft: '3px solid #8E6FB7' }}>
                        {detail.recommendation}
                    </div>
                </div>
            )}

            {detail.disclaimer && (
                <div className="text-xs rounded-xl px-4 py-3 text-[#9089A1] bg-[#FBF8F3] border border-[#F0E9DE]">
                    {detail.disclaimer}
                </div>
            )}
        </div>
    );
};
