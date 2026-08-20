/**
 * 개발AI 콘솔 — 환경설정 탭 (1단계, 2026-08-20).
 *
 * 텔레그램으로 한 줄씩 지시하던 허드 개발 파이프라인을, 어드민에서 명세를 쓰고
 * 진행을 보고 결과를 받는 작업대로 옮긴다.
 *
 * ★이 화면의 핵심은 '비포/애프터'다 — 저장할 때마다 새 버전이 쌓이고 덮어쓰지 않는다.
 *   방향이 바뀌는 게 정상이라, 무엇을 언제 왜 바꿨는지가 남아야 한다.
 *
 * 2단계(2026-08-20): 파이프라인 연결 + 진행·결과 동기화 + 명세서 내보내기.
 *   ★sync 는 허드 상태파일을 읽기만 한다 — 파이프라인이 죽어도 어드민은 산다.
 * 3단계(2026-08-20): 진행 중이면 5초마다 자동 갱신 + 승인/반려 버튼.
 *   ★파이프라인이 devai_events.py 로 이벤트를 DB에 직접 적으므로 실시간이다.
 *   승인은 텔레그램 버튼과 같은 결재 큐를 쓴다.
 * 4단계(2026-08-20): 디자인 시안 목록·선택.
 *   ★시안 생성·확정은 design_preview.py 가 이미 한다 — 여기서는 보여주고 고를 뿐이다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../services/apiService';
import type {
    DevProjectRow, DevProjectDetail, DevProjectVersionRow, DevDesignRow, DevApprovalRow,
} from '../../services/apiService';
import { Icon } from '../Icons';
import {
    BRIEF_SECTIONS, parseBrief, stringifyBrief,
    type BriefValues,
} from './devaiBrief';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
    draft: { label: '작성중', cls: 'bg-gray-700 text-gray-300' },
    queued: { label: '대기', cls: 'bg-amber-900/60 text-amber-300' },
    planned: { label: '계획됨', cls: 'bg-blue-900/60 text-blue-300' },
    awaiting_approval: { label: '승인대기', cls: 'bg-orange-900/60 text-orange-300' },
    running: { label: '개발중', cls: 'bg-emerald-900/60 text-emerald-300' },
    review: { label: '검증중', cls: 'bg-purple-900/60 text-purple-300' },
    done: { label: '완료', cls: 'bg-teal-900/60 text-teal-300' },
    failed: { label: '실패', cls: 'bg-red-900/60 text-red-300' },
    canceled: { label: '취소', cls: 'bg-gray-800 text-gray-500' },
};

const parseUrls = (json: string): string[] => {
    try { const a = JSON.parse(json); return Array.isArray(a) ? a.map(String) : []; }
    catch { return []; }
};
const fmt = (iso: string) => {
    try {
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return '-'; }
};

interface FormState {
    title: string;
    features: string;
    specBody: string;
    refUrls: string;   // 줄바꿈 구분
    note: string;
    brief: BriefValues;   // 홈페이지 요구사항(상호명·서비스·연락처 등)
    useReview: boolean;   // 허드 메이커-체커(Reviewer 검증) 사용
}
const emptyForm: FormState = { title: '', features: '', specBody: '', refUrls: '', note: '', brief: {}, useReview: false };

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <label className="block">
        <span className="text-[11px] text-gray-400">{label}</span>
        {hint && <span className="text-[10px] text-gray-600 ml-2">{hint}</span>}
        <div className="mt-1">{children}</div>
    </label>
);

const inputCls =
    'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 ' +
    'focus:border-blue-500 outline-none';

export const DevAiPanel: React.FC = () => {
    const [rows, setRows] = useState<DevProjectRow[]>([]);
    const [concurrency, setConcurrency] = useState({ running: 0, max: 1, canStart: true });
    const [selected, setSelected] = useState<DevProjectDetail | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');
    // 비포/애프터 비교 대상 버전
    const [diffWith, setDiffWith] = useState<number | null>(null);
    // 2단계 — 파이프라인 연결 / 결과
    const [linkId, setLinkId] = useState('');
    const [batches, setBatches] = useState<{ name: string; title: string; status: string; commit: string | null }[]>([]);
    // 3단계 — 자동 갱신 / 승인
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [approveTaskId, setApproveTaskId] = useState('');
    // 승인 대기 — ★시간 제한이 있어 화면 맨 위에 띄운다(못 보면 자동 거부된다).
    const [approvals, setApprovals] = useState<DevApprovalRow[]>([]);
    // 4단계 — 디자인 시안
    const [designs, setDesigns] = useState<DevDesignRow[]>([]);
    // 펼쳐 둔 시안 제목(목차). 한 번에 하나만 펼쳐 화면이 길어지지 않게 한다.
    const [openDesign, setOpenDesign] = useState<string | null>(null);
    const [showDesigns, setShowDesigns] = useState(false);
    // 참조 이미지 업로드
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    // 홈페이지 요구사항 — 칸이 많아 기본은 접어 둔다(프로그램 개발엔 안 쓰인다).
    const [showBrief, setShowBrief] = useState(false);

    const load = useCallback(async () => {
        try {
            setErr('');
            const d = await adminApi.listDevProjects();
            setRows(d.projects);
            setConcurrency(d.concurrency);
        } catch (e: any) {
            setErr(e?.message || '목록을 불러오지 못했습니다.');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    /** 승인 대기 목록 — ★조용히 실패시킨다. 파이프라인이 안 돌 때도 화면은 살아야 한다. */
    const loadApprovals = useCallback(async () => {
        try {
            const d = await adminApi.listDevApprovals();
            setApprovals(d.approvals);
        } catch { /* 목록을 못 읽어도 나머지 화면은 그대로 쓴다 */ }
    }, []);

    /**
     * 승인 대기 폴링.
     * ★프로젝트를 고르지 않아도 **항상** 돈다 — 승인 요청은 아무 때나 오고,
     *   놓치면 자동 거부된다. 남은 시간 표시도 갱신해야 하므로 10초 간격.
     */
    useEffect(() => {
        void loadApprovals();
        const t = setInterval(() => { void loadApprovals(); }, 10000);
        return () => clearInterval(t);
    }, [loadApprovals]);

    const open = async (id: string) => {
        try {
            setErr(''); setBusy(true);
            const d = await adminApi.getDevProject(id);
            setSelected(d.project);
            setDiffWith(null);
            setBatches([]);
            setLinkId(d.project.herdrProjectId ?? '');
            const v = d.project.versions[0];
            setForm({
                title: d.project.title,
                features: v?.features ?? '',
                specBody: v?.specBody ?? '',
                refUrls: parseUrls(v?.refUrls ?? '[]').join('\n'),
                note: '',
                brief: parseBrief(v?.brief),
                useReview: Boolean((d.project as any).useReview),
            });
            setMode('edit');
        } catch (e: any) {
            setErr(e?.message || '프로젝트를 불러오지 못했습니다.');
        } finally { setBusy(false); }
    };

    /** 폴링용 — 편집 중인 입력을 덮지 않도록 프로젝트 데이터만 갱신한다. */
    const refreshQuiet = useCallback(async (id: string) => {
        try {
            const d = await adminApi.getDevProject(id);
            setSelected(d.project);
        } catch { /* 폴링 실패는 조용히 넘긴다 — 다음 주기에 다시 시도 */ }
    }, []);

    // 진행 중일 때만 5초 폴링. 끝났거나 작성중이면 돌지 않는다.
    const isLive = !!selected && ['planned', 'awaiting_approval', 'running', 'review'].includes(selected.status);
    useEffect(() => {
        if (!autoRefresh || !isLive || !selected) return;
        const t = setInterval(() => { void refreshQuiet(selected.id); }, 5000);
        return () => clearInterval(t);
    }, [autoRefresh, isLive, selected?.id, refreshQuiet]);

    const approve = async (decision: 'approved' | 'rejected') => {
        if (!selected || !approveTaskId.trim()) { setErr('결재 항목 ID를 입력하세요(예: DEV-001).'); return; }
        try {
            setBusy(true); setErr(''); setMsg('');
            await adminApi.approveDevProject(selected.id, approveTaskId.trim(), decision);
            setMsg(`${decision === 'approved' ? '승인' : '반려'}했습니다 — ${approveTaskId.trim()}`);
            setApproveTaskId('');
            await load(); await refreshQuiet(selected.id);
        } catch (e: any) { setErr(e?.message || '결재에 실패했습니다.'); }
        finally { setBusy(false); }
    };

    const startDev = async () => {
        if (!selected) return;
        if (!concurrency.canStart) { setErr(`이미 ${concurrency.running}건이 진행 중입니다(상한 ${concurrency.max}건).`); return; }
        if (!window.confirm(`'${selected.title}' 개발을 시작할까요?\n최신 명세(v${selected.versions[0]?.version ?? 0})로 계획을 세웁니다.`)) return;
        try {
            setBusy(true); setErr(''); setMsg('');
            const d = await adminApi.startDevProject(selected.id);
            setMsg(d.message);
            await load(); await refreshQuiet(selected.id);
        } catch (e: any) { setErr(e?.message || '개발 시작에 실패했습니다.'); }
        finally { setBusy(false); }
    };

    const loadDesigns = useCallback(async () => {
        try {
            const d = await adminApi.listDevDesigns();
            setDesigns(d.designs);
        } catch (e: any) { setErr(e?.message || '시안 목록을 불러오지 못했습니다.'); }
    }, []);

    /** 승인/반려 — 텔레그램 버튼과 **같은 결재 큐**에 쓴다. */
    const decideApproval = async (taskId: string, decision: 'approved' | 'rejected') => {
        try {
            setBusy(true); setErr(''); setMsg('');
            // 프로젝트 id 는 이벤트 기록용이라 없으면 빈 문자열로 보낸다(결재 자체는 성립).
            await adminApi.approveDevProject(selected?.id ?? '', taskId, decision);
            setMsg(decision === 'approved'
                ? `승인했습니다 — ${taskId}. 개발이 이어서 진행됩니다.`
                : `반려했습니다 — ${taskId}.`);
            await loadApprovals();
            if (selected) await refreshQuiet(selected.id);
        } catch (e: any) {
            setErr(e?.message || '승인 처리에 실패했습니다.');
        } finally { setBusy(false); }
    };

    /** 시안 삭제. version 을 주면 1장만, 없으면 그 제목 전부.
     *  ★되돌릴 수 없으므로 반드시 확인을 받는다. */
    const removeDesign = async (projectName: string, version?: string) => {
        const what = version ? `'${projectName}' 의 ${version} 시안` : `'${projectName}' 의 시안 전체`;
        if (!window.confirm(`${what}를 삭제할까요?\n파일까지 지워지며 되돌릴 수 없습니다.`)) return;
        try {
            setBusy(true); setErr(''); setMsg('');
            await adminApi.deleteDevDesign(projectName, version);
            setMsg(`${what}를 삭제했습니다.`);
            await loadDesigns();
        } catch (e: any) {
            setErr(e?.message || '시안 삭제에 실패했습니다.');
        } finally { setBusy(false); }
    };

    const chooseDesign = async (projectName: string, version: string) => {
        if (!window.confirm(`'${projectName}' 디자인을 ${version} 으로 확정할까요?\n선택한 시안이 보관되고 나머지는 정리됩니다.`)) return;
        try {
            setBusy(true); setErr(''); setMsg('');
            const d = await adminApi.chooseDevDesign(projectName, version, selected?.id);
            setMsg(`${projectName} → ${version} 확정했습니다.`);
            await loadDesigns();
            if (selected) await refreshQuiet(selected.id);
        } catch (e: any) { setErr(e?.message || '시안 확정에 실패했습니다.'); }
        finally { setBusy(false); }
    };

    const startCreate = () => {
        setSelected(null); setForm(emptyForm); setMode('create'); setErr(''); setMsg('');
    };

    const save = async () => {
        if (!form.title.trim()) { setErr('제목을 입력하세요.'); return; }
        try {
            setBusy(true); setErr(''); setMsg('');
            const body = {
                title: form.title,
                features: form.features,
                specBody: form.specBody,
                refUrls: form.refUrls,
                note: form.note,
                brief: stringifyBrief(form.brief ?? {}),
                useReview: form.useReview,
            };
            if (mode === 'create') {
                const d = await adminApi.createDevProject(body);
                setMsg('새 프로젝트를 만들었습니다 (v1).');
                await load();
                await open(d.project.id);
            } else if (selected) {
                const d = await adminApi.updateDevProject({ ...body, id: selected.id });
                setMsg(d.versionAdded
                    ? `저장했습니다 — v${d.project.versions[0]?.version} 로 새 버전이 쌓였습니다.`
                    : '변경된 내용이 없어 버전을 늘리지 않았습니다.');
                await load();
                await open(selected.id);
            }
        } catch (e: any) {
            setErr(e?.message || '저장에 실패했습니다.');
        } finally { setBusy(false); }
    };

    const link = async () => {
        if (!selected || !linkId.trim()) { setErr('허드 프로젝트 ID를 입력하세요.'); return; }
        try {
            setBusy(true); setErr(''); setMsg('');
            await adminApi.linkDevProject(selected.id, linkId.trim());
            setMsg(`파이프라인 ${linkId.trim()} 에 연결했습니다.`);
            await load(); await open(selected.id);
        } catch (e: any) { setErr(e?.message || '연결에 실패했습니다.'); }
        finally { setBusy(false); }
    };

    const sync = async () => {
        if (!selected) return;
        try {
            setBusy(true); setErr(''); setMsg('');
            const d = await adminApi.syncDevProject(selected.id);
            setBatches(d.batches);
            setMsg(d.eventsAdded > 0
                ? `진행 상황을 가져왔습니다 — 새 이벤트 ${d.eventsAdded}건.`
                : '이미 최신입니다(새 이벤트 없음).');
            await load(); await open(selected.id);
        } catch (e: any) { setErr(e?.message || '동기화에 실패했습니다.'); }
        finally { setBusy(false); }
    };

    const remove = async () => {
        if (!selected) return;
        if (!window.confirm(`'${selected.title}' 프로젝트를 삭제할까요?\n명세 버전·첨부·이벤트가 함께 지워지며 되돌릴 수 없습니다.`)) return;
        try {
            setBusy(true); setErr('');
            await adminApi.deleteDevProject(selected.id);
            setSelected(null); setMode('none'); setMsg('삭제했습니다.');
            await load();
        } catch (e: any) {
            setErr(e?.message || '삭제에 실패했습니다.');
        } finally { setBusy(false); }
    };

    /** 참조 이미지 업로드. ★프로젝트가 저장된 뒤에만 가능하다(저장 경로가 id 기준). */
    const pickImages = async (files: FileList | null) => {
        if (!files?.length || !selected) return;
        setErr(''); setUploading(true);
        try {
            // 쿼터·순서 꼬임을 피해 한 장씩 순차로 올린다.
            for (const f of Array.from(files)) {
                if (f.size > 5 * 1024 * 1024) {
                    setErr(`'${f.name}' 은 5MB를 넘어 건너뜁니다.`);
                    continue;
                }
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const r = new FileReader();
                    r.onload = () => resolve(String(r.result));
                    r.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
                    r.readAsDataURL(f);
                });
                await adminApi.uploadDevImage(selected.id, dataUrl);
            }
            const d = await adminApi.getDevProject(selected.id);
            setSelected(d.project);
            setMsg('참조 이미지를 올렸습니다.');
        } catch (e: any) {
            setErr(e?.message || '이미지 업로드에 실패했습니다.');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';   // 같은 파일 재선택 허용
        }
    };

    const removeImage = async (fileId: number) => {
        if (!selected) return;
        try {
            setUploading(true); setErr('');
            await adminApi.deleteDevImage(fileId);
            const d = await adminApi.getDevProject(selected.id);
            setSelected(d.project);
        } catch (e: any) {
            setErr(e?.message || '이미지 삭제에 실패했습니다.');
        } finally { setUploading(false); }
    };

    /** 요구사항 한 칸 수정. 폼 전체를 갈아끼우지 않도록 brief 만 얕게 복사한다. */
    const setBriefField = (key: string, value: string) =>
        setForm(f => ({ ...f, brief: { ...(f.brief ?? {}), [key]: value } }));

    const versions = selected?.versions ?? [];
    // ★`?? {}` 를 빼면 안 된다 — form.brief 가 없는 상태(구버전 캐시 번들, 예상 못한
    //   폼 초기화)에서 Object.values(undefined) 가 터지면 **어드민 화면 전체가**
    //   ErrorBoundary 로 떨어진다(2026-08-20 실사고).
    const briefFilled = Object.values(form.brief ?? {}).filter(v => (v ?? '').trim()).length;
    const refImages = (selected?.files ?? []).filter(f => f.kind === 'image');
    const current = versions[0];
    const compare: DevProjectVersionRow | undefined = useMemo(
        () => versions.find(v => v.version === diffWith),
        [versions, diffWith]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="text-base font-semibold text-gray-100 flex items-center gap-2">
                        <Icon name="Cpu" size={16} /> 개발AI 콘솔
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        명세를 쓰고 개발을 맡깁니다. 저장할 때마다 새 버전이 쌓여 비포/애프터가 남습니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-1 rounded-lg ${concurrency.canStart ? 'bg-gray-800 text-gray-400' : 'bg-amber-900/60 text-amber-300'}`}>
                        동시 실행 {concurrency.running}/{concurrency.max}
                    </span>
                    <button onClick={startCreate}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">
                        + 새 프로젝트
                    </button>
                </div>
            </div>

            {err && <div className="text-xs text-red-300 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">{err}</div>}
            {msg && <div className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-800 rounded-lg px-3 py-2">{msg}</div>}

            {/* ── ★승인 대기 ──────────────────────────────────────
                파이프라인이 계획을 내면 여기 뜬다. 맨 위에 두는 이유는 **시간 제한이
                있기 때문**이다 — 예전엔 텔레그램으로만 나가서, 어드민에서 시작한
                사람이 못 보고 5분 뒤 자동 거부를 맞았다(2026-08-20 실사고). */}
            {approvals.length > 0 && (
                <div className="rounded-xl border-2 border-orange-700 bg-orange-950/30 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <Icon name="Bell" size={15} />
                        <span className="text-sm font-semibold text-orange-200">
                            승인이 필요합니다 ({approvals.length}건)
                        </span>
                    </div>
                    {approvals.map(a => (
                        <div key={a.taskId} className="bg-gray-900/70 border border-orange-900/50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <code className="text-[11px] text-orange-300">{a.taskId}</code>
                                {a.remainSec !== null && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded ${a.remainSec < 300
                                        ? 'bg-red-900/60 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
                                        {a.remainSec > 0
                                            ? `${Math.floor(a.remainSec / 60)}분 ${a.remainSec % 60}초 남음`
                                            : '시간 초과 — 곧 자동 거부됩니다'}
                                    </span>
                                )}
                            </div>
                            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed
                                max-h-64 overflow-y-auto bg-gray-950/60 rounded p-2 border border-gray-800">
                                {a.description}
                            </pre>
                            <div className="flex items-center gap-2">
                                <button onClick={() => void decideApproval(a.taskId, 'approved')} disabled={busy}
                                    className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white">
                                    ✅ 승인
                                </button>
                                <button onClick={() => void decideApproval(a.taskId, 'rejected')} disabled={busy}
                                    className="text-xs px-4 py-2 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-300 border border-gray-700">
                                    ❌ 반려
                                </button>
                                <span className="text-[10px] text-gray-600 ml-auto">
                                    텔레그램 버튼과 같은 결재입니다 — 어느 쪽으로 눌러도 됩니다
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── 디자인 시안 (4단계) ── */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl">
                <button
                    onClick={() => { const n = !showDesigns; setShowDesigns(n); if (n && designs.length === 0) void loadDesigns(); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                    <span className="text-xs text-gray-300 flex items-center gap-2">
                        <Icon name="Image" size={14} /> 디자인 시안
                        {designs.filter(d => d.status === 'waiting').length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
                                대기 {designs.filter(d => d.status === 'waiting').length}
                            </span>
                        )}
                    </span>
                    <span className="text-[11px] text-gray-500">{showDesigns ? '접기' : '펼치기'}</span>
                </button>

                {showDesigns && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-700 pt-3">
                        {designs.length === 0 && (
                            <p className="text-xs text-gray-600 py-4 text-center">
                                시안이 없습니다.
                            </p>
                        )}
                        {/* ★목차 방식 — 제목만 나열하고, 누르면 그 제목의 시안 3장이 펼쳐진다.
                            전부 펼쳐 두면 6개 프로젝트 × 3장 = 18장이 쏟아져 지금 골라야 할 게
                            묻힌다(사장 지적 2026-08-20). 확정된 것도 지우지 않고 남긴다. */}
                        {designs.map(d => {
                            const isOpen = openDesign === d.projectName;
                            return (
                            <div key={d.projectName} className="bg-gray-900/60 border border-gray-800 rounded-lg">
                                {/* 목차 줄 */}
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <button onClick={() => setOpenDesign(isOpen ? null : d.projectName)}
                                        className="flex-1 flex items-center gap-2 text-left min-w-0">
                                        <span className="text-[10px] text-gray-600 shrink-0">{isOpen ? '▼' : '▶'}</span>
                                        <span className="text-xs text-gray-200 truncate">{d.projectName}</span>
                                        {d.status === 'approved' ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-300 shrink-0">
                                                ✓ {d.selectedVersion} 선택됨
                                            </span>
                                        ) : (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 shrink-0">
                                                선택 대기
                                            </span>
                                        )}
                                    </button>
                                    <button onClick={() => void removeDesign(d.projectName)} disabled={busy}
                                        title="이 제목의 시안을 모두 삭제"
                                        className="text-[10px] px-2 py-1 rounded text-gray-600 hover:text-red-300 hover:bg-red-900/30 shrink-0">
                                        제목 삭제
                                    </button>
                                </div>

                                {isOpen && (
                                    <div className="px-3 pb-3 border-t border-gray-800 pt-2.5">
                                        {d.description && (
                                            <p className="text-[10px] text-gray-500 mb-2">{d.description}</p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {d.versions.map(v => {
                                                const isPicked = d.selectedVersion === v.version;
                                                return (
                                                    <div key={v.version}
                                                        className={`rounded-lg border p-2 flex flex-col gap-1.5
                                                            ${isPicked ? 'border-teal-700 bg-teal-900/20' : 'border-gray-800 bg-gray-900'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-mono text-gray-300">{v.version}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                {isPicked && <span className="text-[10px] text-teal-400">선택됨</span>}
                                                                <button onClick={() => void removeDesign(d.projectName, v.version)} disabled={busy}
                                                                    title="이 시안 1장만 삭제"
                                                                    className="text-[10px] text-gray-700 hover:text-red-300">×</button>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 leading-snug min-h-[28px]">{v.label}</p>
                                                        <div className="flex gap-1.5">
                                                            {/* ★파일이 없으면 링크를 막는다 — 404 면 Vercel SPA 폴백으로
                                                                **메인 페이지가 대신 뜬다**(빈 화면보다 헷갈린다). */}
                                                            {v.exists === false ? (
                                                                <span title="시안 파일이 없어 미리보기를 볼 수 없습니다"
                                                                    className="flex-1 text-center text-[10px] px-2 py-1 rounded bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed">
                                                                    미리보기 없음
                                                                </span>
                                                            ) : (
                                                                <a href={v.url} target="_blank" rel="noreferrer"
                                                                    className="flex-1 text-center text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">
                                                                    미리보기
                                                                </a>
                                                            )}
                                                            {!isPicked && (
                                                                <button onClick={() => chooseDesign(d.projectName, v.version)} disabled={busy}
                                                                    className="flex-1 text-[10px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">
                                                                    선택
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                {/* 목록 */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                    <div className="text-[11px] text-gray-500 mb-2">프로젝트 {rows.length}건</div>
                    <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
                        {rows.length === 0 && (
                            <p className="text-xs text-gray-600 py-6 text-center">
                                아직 없습니다.<br />[+ 새 프로젝트]로 시작하세요.
                            </p>
                        )}
                        {rows.map(r => {
                            const st = STATUS_STYLE[r.status] ?? { label: r.status, cls: 'bg-gray-700 text-gray-300' };
                            const on = selected?.id === r.id;
                            return (
                                <button key={r.id} onClick={() => open(r.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg border transition
                                        ${on ? 'bg-blue-900/30 border-blue-700' : 'bg-gray-900/60 border-gray-800 hover:border-gray-600'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-gray-200 truncate">{r.title}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${st.cls}`}>{st.label}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        v{r.latestVersion} · {fmt(r.updatedAt)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 편집 */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    {mode === 'none' ? (
                        <p className="text-xs text-gray-600 py-16 text-center">
                            왼쪽에서 프로젝트를 고르거나 새로 만드세요.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            <Field label="제목" hint="필수">
                                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="예: 어드민에 인버스 자동매매 탭 추가" className={inputCls} />
                            </Field>

                            <Field label="기능" hint="만들 기능을 한 줄씩">
                                <textarea value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
                                    rows={4} placeholder={'로그인 화면\n대시보드\n설정 저장'} className={`${inputCls} font-mono text-xs`} />
                            </Field>

                            <Field label="참조 사이트" hint="URL 한 줄씩 · 이런 느낌으로">
                                <textarea value={form.refUrls} onChange={e => setForm(f => ({ ...f, refUrls: e.target.value }))}
                                    rows={2} placeholder={'https://toss.im\nhttps://daangn.com'} className={`${inputCls} font-mono text-xs`} />
                            </Field>

                            {/* 참조 이미지 — 저장된 뒤에만 올릴 수 있다(저장 경로가 프로젝트 id 기준). */}
                            <Field label="참조 이미지"
                                hint={mode === 'create'
                                    ? '먼저 [만들기]로 저장한 뒤 올릴 수 있습니다'
                                    : '로고·스크린샷·분위기 참고 · PNG/JPG/WEBP · 5MB 이하'}>
                                {mode === 'edit' && selected ? (
                                    <div className="space-y-2">
                                        <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif"
                                            className="hidden" onChange={e => void pickImages(e.target.files)} />
                                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || busy}
                                            className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 border border-gray-700">
                                            {uploading ? '올리는 중...' : '＋ 이미지 선택'}
                                        </button>
                                        {refImages.length > 0 && (
                                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                {refImages.map(f => (
                                                    <div key={f.id} className="relative group rounded-lg overflow-hidden border border-gray-800 bg-gray-900">
                                                        <a href={f.url} target="_blank" rel="noreferrer">
                                                            <img src={f.url} alt={f.fileName} className="w-full h-16 object-cover" />
                                                        </a>
                                                        <button type="button" onClick={() => void removeImage(f.id)} disabled={uploading}
                                                            title="삭제"
                                                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/70 text-gray-300
                                                                hover:bg-red-900 hover:text-red-200 text-[11px] leading-none">
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-600">
                                            올린 이미지는 명세와 함께 개발AI에게 전달됩니다({refImages.length}/20장).
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-gray-600 py-2">
                                        프로젝트를 만든 뒤 참조 이미지를 올릴 수 있습니다.
                                    </p>
                                )}
                            </Field>

                            {/* ── 홈페이지 요구사항 ──────────────────────────
                                ★칸을 늘리기만 하면 안 읽힌다 — 배경색 카드로 묶는다(사장 피드백).
                                비워두면 개발AI가 알아서 채우되, 연락처류는 비워둔 채로 둔다. */}
                            <div className="rounded-xl border border-gray-700 bg-gray-900/40 overflow-hidden">
                                <button type="button" onClick={() => setShowBrief(v => !v)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/40">
                                    <span className="text-xs text-gray-300 flex items-center gap-2">
                                        <Icon name="Home" size={14} /> 홈페이지 요구사항
                                        <span className="text-[10px] text-gray-600">
                                            {briefFilled > 0 ? `${briefFilled}개 입력됨` : '비워두면 AI가 채웁니다'}
                                        </span>
                                    </span>
                                    <span className="text-[10px] text-gray-500">{showBrief ? '접기 ▲' : '펼치기 ▼'}</span>
                                </button>

                                {showBrief && (
                                    <div className="px-3 pb-3 space-y-3 border-t border-gray-800 pt-3">
                                        <p className="text-[10px] text-gray-500 leading-relaxed">
                                            홈페이지를 만들 때만 쓰입니다. 빈칸은 개발AI가 알아서 채우고, 나중에 수정하면 됩니다.
                                            <br />
                                            <span className="text-amber-400/80">
                                                ★단, 연락처·주소·사업자번호는 비워두면 <b>비워둔 채로</b> 나갑니다 — 지어내지 않습니다.
                                            </span>
                                        </p>

                                        {BRIEF_SECTIONS.map(sec => (
                                            <div key={sec.key}
                                                className={`rounded-lg p-3 space-y-2.5 border ${sec.key === 'contact'
                                                    ? 'bg-amber-950/20 border-amber-900/40'
                                                    : 'bg-gray-800/40 border-gray-800'}`}>
                                                <div>
                                                    <div className="text-[11px] font-semibold text-gray-200">{sec.title}</div>
                                                    <div className={`text-[10px] ${sec.key === 'contact' ? 'text-amber-400/70' : 'text-gray-500'}`}>
                                                        {sec.desc}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    {sec.fields.map(fd => (
                                                        <div key={fd.key} className={fd.multiline ? 'sm:col-span-2' : ''}>
                                                            <label className="block">
                                                                <span className="text-[10px] text-gray-400">{fd.label}</span>
                                                                {fd.hint && <span className="text-[10px] text-gray-600 ml-1.5">{fd.hint}</span>}
                                                                {fd.multiline ? (
                                                                    <textarea rows={2}
                                                                        value={form.brief?.[fd.key] ?? ''}
                                                                        onChange={e => setBriefField(fd.key, e.target.value)}
                                                                        className={`${inputCls} mt-1 text-xs`} />
                                                                ) : (
                                                                    <input
                                                                        value={form.brief?.[fd.key] ?? ''}
                                                                        onChange={e => setBriefField(fd.key, e.target.value)}
                                                                        className={`${inputCls} mt-1 text-xs`} />
                                                                )}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Field label="명세 본문" hint="마크다운">
                                <textarea value={form.specBody} onChange={e => setForm(f => ({ ...f, specBody: e.target.value }))}
                                    rows={10} placeholder={'## 목표\n\n## 화면\n\n## 데이터\n\n## 안 할 것'}
                                    className={`${inputCls} font-mono text-xs`} />
                            </Field>

                            {/* ★메이커-체커 — 건별로 고른다. 단일 홈페이지처럼 눈으로 보면
                                되는 작업엔 낭비고(비용 2배, pane 2개), 로직 있는 개발엔 필요하다. */}
                            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-700 bg-gray-900/40 cursor-pointer">
                                <input type="checkbox" checked={form.useReview}
                                    onChange={e => setForm(f => ({ ...f, useReview: e.target.checked }))}
                                    className="mt-0.5 accent-purple-500" />
                                <span className="min-w-0">
                                    <span className="text-xs text-gray-200 flex items-center gap-1.5">
                                        <Icon name="Shield" size={13} /> 검증 받기 (메이커-체커)
                                    </span>
                                    <span className="block text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                                        지우가 만든 결과를 Reviewer가 검토하고 고칠 점을 되돌려 왕복합니다.
                                        품질은 올라가지만 <b>시간·비용이 2배</b>가 됩니다.
                                        <br />
                                        홈페이지 한 장처럼 눈으로 확인되는 작업은 꺼 두고,
                                        로직·API·DB가 얽힌 개발에 켜세요.
                                    </span>
                                </span>
                            </label>

                            <Field label="이번 변경 메모" hint="무엇을 왜 바꿨는지 — 버전 이력에 남습니다">
                                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="예: 결제 화면 추가" className={inputCls} />
                            </Field>

                            <div className="flex items-center gap-2 pt-1">
                                <button onClick={save} disabled={busy}
                                    className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">
                                    {busy ? '저장 중...' : mode === 'create' ? '만들기' : '저장(새 버전)'}
                                </button>
                                {mode === 'edit' && (
                                    <button onClick={startDev} disabled={busy || !concurrency.canStart || isLive}
                                        title={isLive ? '이미 진행 중입니다' : !concurrency.canStart ? '다른 프로젝트가 진행 중입니다' : ''}
                                        className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white">
                                        ▶ 개발 시작
                                    </button>
                                )}
                                {mode === 'edit' && (
                                    <button onClick={remove} disabled={busy}
                                        className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-300 border border-gray-700">
                                        삭제
                                    </button>
                                )}
                                <span className="text-[10px] text-gray-600 ml-auto">
                                    명세서(.md) 첨부는 다음 단계에서 붙습니다
                                </span>
                            </div>

                            {/* ── 파이프라인 연결 · 결과 (2단계) ── */}
                            {mode === 'edit' && selected && (
                                <div className="mt-4 pt-3 border-t border-gray-700 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] text-gray-400 shrink-0">파이프라인</span>
                                        <input value={linkId} onChange={e => setLinkId(e.target.value)}
                                            placeholder="허드 프로젝트 ID (예: p180458)"
                                            className={`${inputCls} flex-1 min-w-[180px] font-mono text-xs`} />
                                        <button onClick={link} disabled={busy}
                                            className="text-xs px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200">
                                            연결
                                        </button>
                                        <button onClick={sync} disabled={busy || !selected.herdrProjectId}
                                            title={selected.herdrProjectId ? '' : '먼저 파이프라인을 연결하세요'}
                                            className="text-xs px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white">
                                            진행 가져오기
                                        </button>
                                        <a href={adminApi.devProjectExportUrl(selected.id)}
                                            className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700">
                                            명세서 .md
                                        </a>
                                    </div>

                                    {/* 수동 결재(보조) + 자동갱신 (3단계)
                                        ★평소에는 화면 맨 위 '승인이 필요합니다' 카드로 누른다.
                                          여기는 대기 목록이 안 뜰 때를 위한 수동 입력 경로다. */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] text-gray-400 shrink-0">수동 결재</span>
                                        <input value={approveTaskId} onChange={e => setApproveTaskId(e.target.value)}
                                            placeholder="항목 ID 직접 입력 (예: PLAN-APPROVAL)"
                                            className={`${inputCls} flex-1 min-w-[180px] font-mono text-xs`} />
                                        <button onClick={() => approve('approved')} disabled={busy}
                                            className="text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white">
                                            승인
                                        </button>
                                        <button onClick={() => approve('rejected')} disabled={busy}
                                            className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-300 border border-gray-700">
                                            반려
                                        </button>
                                        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 ml-auto cursor-pointer">
                                            <input type="checkbox" checked={autoRefresh}
                                                onChange={e => setAutoRefresh(e.target.checked)}
                                                className="accent-blue-500" />
                                            자동갱신
                                            {isLive && autoRefresh && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            )}
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-gray-600 -mt-1">
                                        승인 요청이 오면 화면 맨 위에 자동으로 뜹니다(10초마다 확인). 여기는 보조 경로입니다.
                                    </p>

                                    {/* 묶음 진행 */}
                                    {batches.length > 0 && (
                                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                                            <div className="text-[10px] text-gray-500 mb-1.5">묶음 {batches.length}개</div>
                                            <div className="space-y-1">
                                                {batches.map(b => (
                                                    <div key={b.name} className="flex items-center gap-2 text-[11px]">
                                                        <span className={`px-1.5 py-0.5 rounded font-mono shrink-0
                                                            ${b.status === 'done' ? 'bg-teal-900/60 text-teal-300' : 'bg-gray-800 text-gray-500'}`}>
                                                            {b.name}
                                                        </span>
                                                        <span className="text-gray-400 truncate flex-1">{b.title}</span>
                                                        {b.commit && (
                                                            <code className="text-[10px] text-gray-600 shrink-0">{b.commit.slice(0, 8)}</code>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 완료 결과 */}
                                    {selected.result && (
                                        <div className="bg-teal-900/15 border border-teal-800/50 rounded-lg p-3 space-y-2">
                                            <div className="text-[11px] text-teal-300 font-medium">완료 결과</div>
                                            {selected.result.deployUrl ? (
                                                <a href={selected.result.deployUrl} target="_blank" rel="noreferrer"
                                                    className="text-xs text-blue-300 hover:text-blue-200 underline break-all block">
                                                    {selected.result.deployUrl}
                                                </a>
                                            ) : (
                                                <p className="text-[11px] text-gray-500">
                                                    배포 URL 없음 — sites/ 아래 사이트를 만든 작업이 아닙니다.
                                                </p>
                                            )}
                                            {(() => {
                                                let cs: string[] = [];
                                                try { cs = JSON.parse(selected.result.commits || '[]'); } catch { /* 무시 */ }
                                                return cs.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {cs.map(c => (
                                                            <code key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900 text-gray-500 border border-gray-800">
                                                                {c.slice(0, 8)}
                                                            </code>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                            {selected.result.summary && (
                                                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                    {selected.result.summary}
                                                </pre>
                                            )}
                                        </div>
                                    )}

                                    {/* 최근 이벤트 */}
                                    {(selected.events?.length ?? 0) > 0 && (
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-1">최근 진행</div>
                                            <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                                {selected.events!.slice(0, 12).map(ev => (
                                                    <div key={ev.id} className="flex items-baseline gap-2 text-[10px]">
                                                        <span className="text-gray-600 font-mono shrink-0">{fmt(ev.at)}</span>
                                                        <span className={`shrink-0 ${ev.actor === 'reviewer' ? 'text-amber-400'
                                                            : ev.actor === 'developer' ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                            {ev.actor}
                                                        </span>
                                                        <span className="text-gray-400 truncate">{ev.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 버전 이력 = 비포/애프터 */}
                            {mode === 'edit' && versions.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] text-gray-400">버전 이력 {versions.length}개</span>
                                        {diffWith !== null && (
                                            <button onClick={() => setDiffWith(null)}
                                                className="text-[10px] text-gray-500 hover:text-gray-300">비교 닫기</button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {versions.map(v => (
                                            <button key={v.id}
                                                onClick={() => setDiffWith(d => d === v.version ? null : v.version)}
                                                title={v.note ?? ''}
                                                className={`text-[10px] px-2 py-1 rounded border font-mono transition
                                                    ${v.version === current?.version
                                                        ? 'border-blue-600 bg-blue-900/30 text-blue-300'
                                                        : diffWith === v.version
                                                            ? 'border-amber-600 bg-amber-900/30 text-amber-300'
                                                            : 'border-gray-700 bg-gray-900 text-gray-500 hover:text-gray-300'}`}>
                                                v{v.version} · {fmt(v.createdAt)}
                                            </button>
                                        ))}
                                    </div>

                                    {compare && current && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            <div>
                                                <div className="text-[10px] text-amber-400 mb-1">
                                                    비포 — v{compare.version} {compare.note ? `(${compare.note})` : ''}
                                                </div>
                                                <pre className="text-[10px] text-gray-400 bg-gray-900 border border-gray-800 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap max-h-64">
                                                    {compare.specBody || '(비어 있음)'}
                                                </pre>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-blue-400 mb-1">
                                                    애프터 — v{current.version} {current.note ? `(${current.note})` : ''}
                                                </div>
                                                <pre className="text-[10px] text-gray-300 bg-gray-900 border border-gray-800 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap max-h-64">
                                                    {current.specBody || '(비어 있음)'}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
