import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, ShieldCheck, Clock, CheckCircle, XCircle, Loader,
    Trash2, RotateCcw, ChevronLeft, UploadCloud, AlertTriangle, RefreshCw, Printer, MessageCircle, Sparkles, ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GuideCard } from './GuideCard';

// ── 타입 ──────────────────────────────────────────────────

type Status = 'pending' | 'processing' | 'completed' | 'failed';

interface InsuranceUserInfo {
    title: string; gender: string; age: string;
    job: string; health: string; budget: string; purpose: string;
    lunar?: boolean;  // 생년월일 음력 여부
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
    consultingReport: string | null;
}

interface Props {
    onClose: () => void;
    // 분석 결과를 김지훈 채팅으로 넘겨 추가 상담 — (분석제목, AI에 주입할 컨텍스트 텍스트)
    onConsult?: (title: string, context: string) => void;
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

export const InsuranceBoard: React.FC<Props> = ({ onClose, onConsult }) => {
    const [tasks, setTasks] = useState<InsuranceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<InsuranceDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [info, setInfo] = useState<InsuranceUserInfo>({
        title: '', gender: '', age: '', job: '', health: '', budget: '', purpose: '', lunar: false,
    });
    const [showAdditional, setShowAdditional] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch<InsuranceTask[]>(API(''));
            setTasks(data);
        } catch { /* 무시 */ }
        finally { setLoading(false); }
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try { await loadTasks(); }
        finally { setTimeout(() => setRefreshing(false), 400); }
    };

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
            setInfo({ title: '', gender: '', age: '', job: '', health: '', budget: '', purpose: '', lunar: false });
            setShowAdditional(false);
            await loadTasks();
            // 분석 시작 직후 맨 위로 올려 진행 상태(분석 내역)를 바로 보이게
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    {selected ? (
                        <ResultView detail={selected} loading={detailLoading} onConsult={onConsult} onClose={onClose} />
                    ) : (
                        <div className="p-4 space-y-4 max-w-2xl mx-auto">
                            {/* 분석 내역 — 재방문 시 바로 확인하도록 맨 위 */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-xs font-bold tracking-widest uppercase text-[#9089A1]">분석 내역</span>
                                    <button type="button" onClick={handleRefresh} disabled={refreshing}
                                        className="flex items-center gap-1 text-xs font-medium text-[#8E6FB7] hover:text-[#7A5FA0] transition-colors disabled:opacity-50">
                                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                                        새로고침
                                    </button>
                                </div>
                                {tasks.some(t => t.status === 'pending' || t.status === 'processing') && (
                                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-xs"
                                        style={{ background: 'rgba(142,111,183,0.07)', border: '1px solid rgba(142,111,183,0.2)', color: '#7A5FA0' }}>
                                        <Loader size={13} className="animate-spin shrink-0" />
                                        AI가 분석 중이에요. 보통 1분 안에 끝나며 자동으로 갱신됩니다.
                                    </div>
                                )}
                                {loading ? (
                                    <div className="text-center py-6 text-sm text-[#9089A1]">불러오는 중...</div>
                                ) : tasks.length === 0 ? (
                                    <div className="rounded-xl bg-white border border-dashed border-[#EAE2D3] py-6 text-center text-sm text-[#9089A1]">
                                        아직 분석한 내역이 없어요.<br />아래에서 첫 보험 분석을 시작해 보세요 👇
                                    </div>
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
                                                        {t.status === 'pending' && (
                                                            <div className="text-xs text-orange-500 truncate mt-0.5">분석 대기 중… 곧 시작돼요</div>
                                                        )}
                                                        {t.status === 'processing' && (
                                                            <div className="text-xs text-[#8E6FB7] truncate mt-0.5">보장항목을 읽고 중복을 분석하고 있어요…</div>
                                                        )}
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

                            {/* 새 분석하기 구분 */}
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-xs font-bold tracking-widest uppercase text-[#9089A1]">새 분석하기</span>
                                <span className="flex-1 h-px bg-[#F0E9DE]" />
                            </div>

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

                                <div>
                                    <label className="text-xs font-semibold text-[#6B5F56]">성별</label>
                                    <div className="flex rounded-xl overflow-hidden border border-[#EAE2D3] mt-1.5 max-w-[220px]">
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

                                {/* 생년월일 — 연/월/일 드롭다운 + 음력 체크 */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-[#6B5F56]">생년월일</label>
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <input type="checkbox" checked={!!info.lunar}
                                                onChange={e => setInfo(p => ({ ...p, lunar: e.target.checked }))}
                                                className="w-3 h-3 cursor-pointer" style={{ accentColor: '#8E6FB7' }} />
                                            <span className="text-xs text-[#6B5F56]">음력</span>
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                                        {(() => {
                                            const [y, m, d] = (info.age || '').split('-');
                                            const setYmd = (ny: string, nm: string, nd: string) =>
                                                setInfo(p => ({ ...p, age: (ny && nm && nd) ? `${ny}-${nm.padStart(2, '0')}-${nd.padStart(2, '0')}` : '' }));
                                            const nowY = new Date().getFullYear();
                                            const years = Array.from({ length: 100 }, (_, i) => nowY - i);
                                            const months = Array.from({ length: 12 }, (_, i) => i + 1);
                                            const days = Array.from({ length: 31 }, (_, i) => i + 1);
                                            const sel = 'border border-[#EAE2D3] rounded-xl px-2 py-2 text-sm outline-none focus:border-[#8E6FB7] bg-white text-[#2D2438]';
                                            return (<>
                                                <select className={sel} value={y || ''} onChange={e => setYmd(e.target.value, m || '', d || '')}>
                                                    <option value="">연도</option>
                                                    {years.map(yy => <option key={yy} value={String(yy)}>{yy}년</option>)}
                                                </select>
                                                <select className={sel} value={m ? String(Number(m)) : ''} onChange={e => setYmd(y || '', e.target.value, d || '')}>
                                                    <option value="">월</option>
                                                    {months.map(mm => <option key={mm} value={String(mm)}>{mm}월</option>)}
                                                </select>
                                                <select className={sel} value={d ? String(Number(d)) : ''} onChange={e => setYmd(y || '', m || '', e.target.value)}>
                                                    <option value="">일</option>
                                                    {days.map(dd => <option key={dd} value={String(dd)}>{dd}일</option>)}
                                                </select>
                                            </>);
                                        })()}
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── 결과 보기 ──────────────────────────────────────────────

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

const ResultView: React.FC<{
    detail: InsuranceDetail;
    loading: boolean;
    onConsult?: (title: string, context: string) => void;
    onClose: () => void;
}> = ({ detail, loading, onConsult, onClose }) => {
    const [report, setReport] = useState<string | null>(detail.consultingReport ?? null);
    const [genLoading, setGenLoading] = useState(false);
    const [genError, setGenError] = useState('');
    const [reportOpen, setReportOpen] = useState(true);

    useEffect(() => { setReport(detail.consultingReport ?? null); setGenError(''); setReportOpen(true); }, [detail.id, detail.consultingReport]);

    const generateConsulting = async (force = false) => {
        setGenLoading(true);
        setGenError('');
        try {
            const r = await apiFetch<{ consultingReport: string }>(
                API(`/${detail.id}/consulting`),
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) },
            );
            setReport(r.consultingReport);
        } catch (e: any) {
            setGenError(e.message || '컨설팅 보고서 생성에 실패했습니다.');
        } finally {
            setGenLoading(false);
        }
    };

    if (loading) return <div className="text-center py-16 text-sm text-[#9089A1]">결과를 불러오는 중...</div>;
    const duplicates = parseJson<Duplicate[]>(detail.duplicatesJson, []);
    const ui = parseJson<Partial<InsuranceUserInfo>>(detail.userInfo, {});
    const title = ui.title || '보험 중복 보장 분석';

    // 김지훈 채팅에 주입할 컨텍스트(AI만 보는 model 메시지). 사용자 후속질문의 근거.
    const buildConsultContext = (): string => {
        const lines: string[] = [];
        lines.push('[보험 중복 보장 분석 결과 — 아래 내용을 바탕으로 사용자 상담]');
        lines.push('아래 가입자 정보(나이·성별·건강·예산)를 반영해 연령대별 보장 필요도와 해지·유지를 조언하세요. 정보가 없는 항목은 필요하면 사용자에게 자연스럽게 물어보세요.');
        // 생년월일 → 만 나이 환산(AI가 연령대별 보장 판단하기 쉽게)
        let ageStr = '';
        if (ui.age) {
            const b = new Date(ui.age);
            if (!isNaN(b.getTime())) {
                const now = new Date();
                let a = now.getFullYear() - b.getFullYear();
                const m = now.getMonth() - b.getMonth();
                if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
                ageStr = `만 ${a}세(${b.getFullYear()}년생)`;
            } else ageStr = ui.age;
            if (ui.lunar && ageStr) ageStr += ' (음력 생일)';
        }
        lines.push(`· 나이: ${ageStr || '정보 없음(필요시 질문)'}`);
        lines.push(`· 성별: ${ui.gender || '정보 없음(필요시 질문)'}`);
        lines.push(`· 직업: ${ui.job || '정보 없음(필요시 질문)'}`);
        lines.push(`· 건강: ${ui.health || '정보 없음(필요시 질문)'}`);
        lines.push(`· 예산: ${ui.budget || '정보 없음(필요시 질문)'}`);
        if (ui.purpose) lines.push(`· 분석 목적: ${ui.purpose}`);
        lines.push(`· 분석 보험 ${detail.totalPolicies ?? 0}개, 중복 ${detail.duplicateCount ?? 0}건, 절감 예상 ${detail.monthlySavings || '-'}, 위험도 ${detail.riskLevel || '-'}`);
        if (detail.aiSummary) lines.push(`\n[요약] ${detail.aiSummary}`);
        if (duplicates.length) {
            lines.push('\n[중복 보장 상세]');
            duplicates.forEach((d, i) => {
                lines.push(`${i + 1}. ${d.item} (${d.policies}) — ${d.type}/${d.severity}, 절감 ${d.monthlySavings}. A: ${d.coverageA} / B: ${d.coverageB}. 권고: ${d.action}`);
            });
        }
        if (detail.recommendation) lines.push(`\n[권고] ${detail.recommendation}`);
        return lines.join('\n');
    };

    const handleConsult = () => {
        if (!onConsult) return;
        onConsult(title, buildConsultContext());
        onClose();
    };

    const metrics = [
        { value: detail.duplicateCount ?? 0, label: '중복 항목', color: '#EF4444' },
        { value: detail.totalPolicies ?? 0, label: '분석 보험', color: '#2D2438' },
        { value: detail.monthlySavings || '-', label: '절감 예상', color: '#F59E0B' },
        { value: detail.riskLevel || '-', label: '위험도', color: riskColor(detail.riskLevel) },
    ];

    // 인쇄/PDF용 HTML 생성 → 새 창 window.print() (서버 부하 0, 한글 안전)
    const buildPrintHtml = (): string => {
        const date = new Date(detail.updatedAt).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const sevCls = (s: string) => s === '높음' ? 'badge-high' : s === '중간' ? 'badge-mid' : 'badge-low';
        const rows = duplicates.length === 0
            ? `<tr><td colspan="6" style="text-align:center;color:#888;padding:8mm 0">중복 보장 항목이 발견되지 않았습니다</td></tr>`
            : duplicates.map(d => `<tr><td><strong>${esc(d.item)}</strong><br/><span style="color:#888;font-size:8pt">${esc(d.action)}</span></td><td>${esc(d.policies)}</td><td>A: ${esc(d.coverageA)}<br/>B: ${esc(d.coverageB)}</td><td>${esc(d.type)}</td><td style="color:#92400e;font-weight:500">${esc(d.monthlySavings)}</td><td><span class="badge ${sevCls(d.severity)}">${esc(d.severity)}</span></td></tr>`).join('');
        return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#fff;color:#1a1a1a;padding:18mm 20mm;font-size:10.5pt;line-height:1.6}
.title-row{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111827;padding-bottom:3mm;margin-bottom:5mm}.title-row h1{font-size:16pt;font-weight:700}.title-row .meta{font-size:8.5pt;color:#888;text-align:right;line-height:1.8}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:6mm}.card{border:1px solid #e5e7eb;border-radius:6px;padding:3.5mm 4mm;text-align:center}.card .val{font-size:15pt;font-weight:700}.card .lbl{font-size:8pt;color:#888;margin-top:1mm}
.section-title{font-size:9pt;font-weight:600;color:#374151;letter-spacing:0.08em;margin:5mm 0 2.5mm}
.box{background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid #8E6FB7;border-radius:6px;padding:4mm 5mm;font-size:9.5pt;line-height:1.8;color:#374151;margin-bottom:5mm}
table{width:100%;border-collapse:collapse;margin-bottom:5mm;font-size:8.5pt}th{background:#f3f4f6;border:1px solid #e5e7eb;padding:2mm 3mm;text-align:left;font-weight:600;color:#6b7280;white-space:nowrap}td{border:1px solid #e5e7eb;padding:2.5mm 3mm;vertical-align:top;color:#374151}tr:nth-child(even) td{background:#f9fafb}
.badge{display:inline-block;padding:0.5mm 2.5mm;border-radius:3px;font-size:8pt;font-weight:500}.badge-high{background:#fee2e2;color:#991b1b}.badge-mid{background:#fef3c7;color:#92400e}.badge-low{background:#d1fae5;color:#065f46}
.disc{font-size:8pt;color:#9ca3af;border:1px solid #e5e7eb;border-radius:5px;padding:3mm 4mm}@media print{body{padding:12mm 14mm}@page{margin:10mm}}</style></head><body>
<div class="title-row"><h1>${esc(title)}</h1><div class="meta">분석 일시: ${esc(date)}<br/>AI 보험 중복 보장 분석</div></div>
<div class="cards">
<div class="card"><div class="val" style="color:#ef4444">${esc(detail.duplicateCount ?? 0)}</div><div class="lbl">중복 보장 항목</div></div>
<div class="card"><div class="val">${esc(detail.totalPolicies ?? 0)}</div><div class="lbl">분석 보험 수</div></div>
<div class="card"><div class="val" style="color:#f59e0b">${esc(detail.monthlySavings || '-')}</div><div class="lbl">절감 예상액</div></div>
<div class="card"><div class="val">${esc(detail.riskLevel || '-')}</div><div class="lbl">중복 위험도</div></div></div>
${detail.aiSummary ? `<div class="section-title">AI 분석 요약</div><div class="box">${esc(detail.aiSummary)}</div>` : ''}
<div class="section-title">중복 보장 상세 목록</div>
<table><thead><tr><th>중복 항목</th><th>해당 보험</th><th>보장 내용 비교</th><th>유형</th><th>절감 예상</th><th>심각도</th></tr></thead><tbody>${rows}</tbody></table>
${detail.recommendation ? `<div class="section-title">AI 권고사항</div><div class="box">${esc(detail.recommendation)}</div>` : ''}
${report ? `<div class="section-title">종합 컨설팅 보고서</div><div class="box" style="white-space:pre-wrap">${esc(report)}</div>` : ''}
${detail.disclaimer ? `<div class="disc">${esc(detail.disclaimer)}</div>` : ''}
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script></body></html>`;
    };

    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.'); return; }
        w.document.write(buildPrintHtml());
        w.document.close();
    };

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-5">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-base font-bold text-[#2D2438]">분석 완료 보고서</h3>
                    <div className="text-xs text-[#9089A1] mt-0.5">{new Date(detail.updatedAt).toLocaleString('ko-KR')}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {onConsult && (
                        <button onClick={handleConsult}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: '#fff', color: '#7A5FA0', border: '1px solid #D8C9EA' }}>
                            <MessageCircle size={13} /> 채팅 상담
                        </button>
                    )}
                    <button onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#fff', color: '#7A5FA0', border: '1px solid #D8C9EA' }}>
                        <Printer size={13} /> 인쇄 · PDF
                    </button>
                </div>
            </div>

            {/* 종합 컨설팅 받기 — 보고서 없을 때만 전체폭 메인 버튼 */}
            {!report && (
                <button onClick={() => generateConsulting(false)} disabled={genLoading}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60"
                    style={{ background: '#8E6FB7', color: '#fff', boxShadow: '0 3px 12px -4px rgba(142,111,183,0.6)' }}>
                    {genLoading
                        ? <><Loader size={15} className="animate-spin" /> 보고서 작성 중…</>
                        : <><Sparkles size={15} /> 종합 컨설팅 받기</>}
                </button>
            )}
            {genError && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>{genError}</div>
            )}

            {/* 종합 컨설팅 보고서 — 한 번 생성되면 분석에 영구 저장돼 항상 표시. 접기/펼치기. */}
            {report && (
                <div className="rounded-2xl bg-white border border-[#F0E9DE] overflow-hidden" style={{ borderLeft: '3px solid #8E6FB7' }}>
                    <button onClick={() => setReportOpen(o => !o)} className="w-full flex items-center gap-2 px-5 py-3.5 text-left">
                        <Sparkles size={15} className="text-[#8E6FB7] shrink-0" />
                        <span className="text-sm font-bold text-[#2D2438] flex-1 truncate">종합 컨설팅 보고서</span>
                        <ChevronDown size={16} className={`text-[#9089A1] shrink-0 transition-transform ${reportOpen ? '' : '-rotate-90'}`} />
                    </button>
                    {reportOpen && (
                        <div className="px-5 pb-5 pt-1 ins-report text-[#3A3340]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                        </div>
                    )}
                </div>
            )}

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
