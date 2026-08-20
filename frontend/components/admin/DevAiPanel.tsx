/**
 * 개발AI 콘솔 — 환경설정 탭 (1단계, 2026-08-20).
 *
 * 텔레그램으로 한 줄씩 지시하던 허드 개발 파이프라인을, 어드민에서 명세를 쓰고
 * 진행을 보고 결과를 받는 작업대로 옮긴다.
 *
 * ★이 화면의 핵심은 '비포/애프터'다 — 저장할 때마다 새 버전이 쌓이고 덮어쓰지 않는다.
 *   방향이 바뀌는 게 정상이라, 무엇을 언제 왜 바꿨는지가 남아야 한다.
 *
 * 2~4단계(작업 모니터링 / 디자인 선택 / 완료)는 아직이다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/apiService';
import type { DevProjectRow, DevProjectDetail, DevProjectVersionRow } from '../../services/apiService';
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
                                    <button onClick={remove} disabled={busy}
                                        className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-300 border border-gray-700">
                                        삭제
                                    </button>
                                )}
                                <span className="text-[10px] text-gray-600 ml-auto">
                                    첨부·이미지 업로드는 다음 단계에서 붙습니다
                                </span>
                            </div>

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
