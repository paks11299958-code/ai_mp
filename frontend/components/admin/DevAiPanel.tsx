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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/apiService';
import type { DevProjectRow, DevProjectDetail, DevProjectVersionRow, DevDesignRow } from '../../services/apiService';
import { Icon } from '../Icons';

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
}
const emptyForm: FormState = { title: '', features: '', specBody: '', refUrls: '', note: '' };

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
    // 4단계 — 디자인 시안
    const [designs, setDesigns] = useState<DevDesignRow[]>([]);
    const [showDesigns, setShowDesigns] = useState(false);

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

    const versions = selected?.versions ?? [];
    const current = versions[0];
    const compare: DevProjectVersionRow | undefined = useMemo(
        () => versions.find(v => v.version === diffWith),
        [versions, diffWith]);

    return (
        <div className="space-y-4">
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
                            <p className="text-xs text-gray-600 py-4 text-center">대기 중인 시안이 없습니다.</p>
                        )}
                        {designs.map(d => (
                            <div key={d.projectName} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-xs text-gray-200 truncate">{d.projectName}</span>
                                    {d.status === 'approved' ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-300 shrink-0">
                                            {d.selectedVersion} 확정
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 shrink-0">
                                            선택 대기
                                        </span>
                                    )}
                                </div>
                                {d.description && (
                                    <p className="text-[10px] text-gray-500 mb-2 line-clamp-2">{d.description}</p>
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
                                                    {isPicked && <span className="text-[10px] text-teal-400">선택됨</span>}
                                                </div>
                                                <p className="text-[10px] text-gray-500 leading-snug min-h-[28px]">{v.label}</p>
                                                <div className="flex gap-1.5">
                                                    <a href={v.url} target="_blank" rel="noreferrer"
                                                        className="flex-1 text-center text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">
                                                        미리보기
                                                    </a>
                                                    {d.status !== 'approved' && (
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
                        ))}
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

                            <Field label="명세 본문" hint="마크다운">
                                <textarea value={form.specBody} onChange={e => setForm(f => ({ ...f, specBody: e.target.value }))}
                                    rows={10} placeholder={'## 목표\n\n## 화면\n\n## 데이터\n\n## 안 할 것'}
                                    className={`${inputCls} font-mono text-xs`} />
                            </Field>

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
                                    첨부·이미지 업로드는 다음 단계에서 붙습니다
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

                                    {/* 승인/반려 + 자동갱신 (3단계) */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] text-gray-400 shrink-0">결재</span>
                                        <input value={approveTaskId} onChange={e => setApproveTaskId(e.target.value)}
                                            placeholder="항목 ID (예: PLAN-APPROVAL, DEV-001)"
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
                                        텔레그램 버튼과 같은 결재 큐를 씁니다. 진행 중이면 5초마다 자동으로 갱신됩니다.
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
