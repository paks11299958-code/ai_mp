import React, { useCallback, useEffect, useRef, useState } from 'react';
import { aiStudioApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 🎨 AI 스튜디오(서버3 GPU) 어드민 — 2026-08-05 신설
//
// 서버3은 **꺼져 있는 것이 기본**인 온디맨드 GPU 서버다(시간당 약 1,260원).
// 이 화면의 목적은 셋이다:
//   ① 켜져 있는지 한눈에 보이게 — 끄는 걸 잊으면 요금이 계속 나간다
//   ② 터미널 없이 켜고/끄기
//   ③ 프롬프트를 넣어 이미지를 만들고 결과를 바로 보기
//
// ★서버가 꺼져 있어도 생성 요청이 된다 — 큐에 쌓이면 디스패처(서버2 크론)가
//   알아서 켜고 워커가 처리한다. 그래서 '켜고 나서 요청'할 필요가 없다.

const SIZES = [
    { label: '정사각 1024×1024', w: 1024, h: 1024 },
    { label: '인물 세로 832×1216', w: 832, h: 1216 },
    { label: '가로 1216×832', w: 1216, h: 832 },
];

const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

/** 생성 결과 썸네일 — 인증 헤더가 필요해 fetch 로 받아 blob 으로 그린다. */
const JobImage: React.FC<{ file: string }> = ({ file }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [err, setErr] = useState(false);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        let alive = true;
        aiStudioApi.fetchImage(file)
            .then((u) => {
                if (!alive) { URL.revokeObjectURL(u); return; }
                urlRef.current = u;
                setUrl(u);
            })
            .catch(() => alive && setErr(true));
        return () => {
            alive = false;
            // ★blob URL 은 명시적으로 해제하지 않으면 메모리에 남는다
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
    }, [file]);

    if (err) {
        return (
            <div className="w-full aspect-[3/4] rounded-lg bg-gray-900 border border-gray-700
                            flex items-center justify-center text-[11px] text-gray-600 text-center px-2">
                이미지를 불러올 수 없습니다<br />(서버가 꺼졌을 수 있음)
            </div>
        );
    }
    if (!url) {
        return <div className="w-full aspect-[3/4] rounded-lg bg-gray-800 animate-pulse" />;
    }
    return (
        <a href={url} download={file} title="클릭하면 다운로드">
            <img src={url} alt={file} className="w-full rounded-lg border border-gray-700 hover:opacity-90" />
        </a>
    );
};

export const AiStudioPanel: React.FC = () => {
    const [st, setSt] = useState<Awaited<ReturnType<typeof aiStudioApi.getStatus>> | null>(null);
    const [models, setModels] = useState<string[]>([]);
    const [jobs, setJobs] = useState<Awaited<ReturnType<typeof aiStudioApi.getJobs>>['jobs']>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState('');

    // 생성 폼
    const [prompt, setPrompt] = useState('');
    const [negative, setNegative] = useState('');
    const [model, setModel] = useState('');
    const [sizeIdx, setSizeIdx] = useState(1);
    const [steps, setSteps] = useState(30);
    const [count, setCount] = useState(1);

    const load = useCallback(async () => {
        try {
            const [s, j] = await Promise.all([
                aiStudioApi.getStatus(),
                aiStudioApi.getJobs(12).catch(() => ({ jobs: [] })),
            ]);
            setSt(s);
            setJobs(j.jobs ?? []);
            // 모델 목록은 서버가 켜져 있을 때만 읽을 수 있다
            if (s.server?.status === 'RUNNING') {
                aiStudioApi.getModels().then((m) => {
                    setModels(m.models ?? []);
                    if (!model && m.models?.length) setModel(m.models[0]);
                }).catch(() => {});
            }
        } catch (e: any) {
            setMsg(e?.message ?? '상태를 불러오지 못했습니다.');
        }
    }, [model]);

    useEffect(() => {
        load();
        // 큐가 도는 동안 진행 상황이 보여야 하므로 주기 갱신
        const t = setInterval(load, 15_000);
        return () => clearInterval(t);
    }, [load]);

    const running = st?.server?.status === 'RUNNING';
    const transitioning = ['STARTING', 'STOPPING', 'STAGING', 'PROVISIONING'].includes(st?.server?.status ?? '');

    const doPower = async (action: 'start' | 'stop') => {
        if (action === 'stop' && !window.confirm(
            '서버를 끕니다.\n처리 중인 작업이 있으면 다음 기동 때 다시 처리됩니다(유실 없음).\n계속할까요?')) return;
        setBusy(action); setMsg('');
        try {
            const r = await aiStudioApi.power(action);
            setMsg(r.detail || (action === 'start' ? '기동 요청 완료' : '종료 요청 완료'));
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '제어에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const doGenerate = async () => {
        if (!prompt.trim()) { setMsg('프롬프트를 입력하세요.'); return; }
        setBusy('generate'); setMsg('');
        try {
            const size = SIZES[sizeIdx];
            const r = await aiStudioApi.generate({
                prompt, negative: negative || undefined, model: model || undefined,
                width: size.w, height: size.h, steps, count,
            });
            setMsg(running
                ? `${r.queued}건 접수 — 곧 처리됩니다.`
                : `${r.queued}건 접수 — 서버가 꺼져 있어 자동으로 켜집니다(약 1~2분).`);
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '생성 요청에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const busySec = st?.today?.busySec ?? 0;
    const estKrw = (busySec / 3600) * (st?.krwPerHour ?? 1260);

    return (
        <div className="p-4 sm:p-6 space-y-5 text-gray-200">
            {/* 헤더 — 상태와 전원 */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Icon name="Zap" className="w-5 h-5 text-purple-400" />
                            AI 스튜디오
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded border ${
                                running ? 'bg-green-900/50 text-green-300 border-green-700'
                                        : 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                                {running ? '🟢 가동 중' : transitioning ? '🟡 전환 중' : '⚫ 꺼짐'}
                            </span>
                        </h2>
                        <p className="text-[11px] text-gray-500 mt-1">
                            NVIDIA L4 24GB · 필요할 때만 켜는 서버 · 시간당 약 {won(st?.krwPerHour ?? 1260)}원
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {running ? (
                            <button onClick={() => doPower('stop')} disabled={busy !== null}
                                className="text-xs px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 font-bold disabled:opacity-50">
                                {busy === 'stop' ? '끄는 중…' : '⏹ 끄기'}
                            </button>
                        ) : (
                            <button onClick={() => doPower('start')} disabled={busy !== null || transitioning}
                                className="text-xs px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 font-bold disabled:opacity-50">
                                {busy === 'start' ? '켜는 중…' : '▶ 켜기'}
                            </button>
                        )}
                        <button onClick={load} className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
                            새로고침
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <Stat label="대기" value={`${st?.queue.pending ?? 0}건`} />
                    <Stat label="처리 중" value={`${st?.queue.processing ?? 0}건`} />
                    <Stat label="오늘 생성" value={`${st?.today.jobs ?? 0}장`} />
                    {/* ★얼마 쓰고 있는지가 항상 보여야 끄는 걸 잊지 않는다 */}
                    <Stat label="오늘 GPU 사용" value={`${Math.round(busySec / 60)}분 · 약 ${won(estKrw)}원`} />
                </div>

                {!running && (
                    <p className="text-[11px] text-gray-500 mt-2">
                        ★꺼져 있어도 <b className="text-gray-400">생성 요청은 가능</b>합니다 —
                        큐에 쌓이면 자동으로 켜집니다(약 1~2분).
                    </p>
                )}
                {msg && <p className="text-xs text-amber-300 mt-2">{msg}</p>}
            </div>

            {/* 생성 폼 */}
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-gray-200">이미지 만들기</p>

                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
                    placeholder="프롬프트 (영문 권장) — 예: a professional Korean woman in a modern office, photorealistic…"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm
                               placeholder-gray-600 focus:border-purple-500 focus:outline-none" />

                <textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={2}
                    placeholder="네거티브(선택) — 비워두면 손·얼굴 왜곡 방지 기본값이 적용됩니다"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs
                               placeholder-gray-600 focus:border-purple-500 focus:outline-none" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Field label="모델">
                        <select value={model} onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                            {models.length === 0 && <option value="">서버 켜면 목록 표시</option>}
                            {models.map((m) => <option key={m} value={m}>{m.replace('.safetensors', '')}</option>)}
                        </select>
                    </Field>
                    <Field label="크기">
                        <select value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                            {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                        </select>
                    </Field>
                    <Field label="스텝">
                        <input type="number" min={10} max={60} value={steps}
                            onChange={(e) => setSteps(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs" />
                    </Field>
                    <Field label="장수">
                        <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs">
                            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}장</option>)}
                        </select>
                    </Field>
                </div>

                <button onClick={doGenerate} disabled={busy !== null}
                    className="w-full text-sm px-4 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600
                               font-bold disabled:opacity-50">
                    {busy === 'generate' ? '접수 중…' : '🎨 생성 요청'}
                </button>
                <p className="text-[10px] text-gray-600">
                    장당 약 14~16초, 원가 약 5원. 같은 프롬프트라도 매번 다른 그림이 나옵니다.
                </p>
            </div>

            {/* 결과 */}
            <div>
                <p className="text-sm font-bold text-gray-200 mb-2">최근 작업</p>
                {jobs.length === 0 ? (
                    <p className="text-xs text-gray-600 py-6 text-center">아직 생성한 이미지가 없습니다.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {jobs.map((j) => (
                            <div key={j.id} className="bg-gray-900/60 border border-gray-700 rounded-lg p-2 space-y-1.5">
                                {j.status === 'completed' && j.files[0] ? (
                                    <JobImage file={j.files[0]} />
                                ) : (
                                    <div className="w-full aspect-[3/4] rounded-lg bg-gray-800 flex items-center
                                                    justify-center text-[11px] text-gray-500">
                                        {j.status === 'pending' ? '대기 중…'
                                            : j.status === 'processing' ? '생성 중…'
                                            : <span className="text-red-400 px-2 text-center">실패<br />{(j.error || '').slice(0, 40)}</span>}
                                    </div>
                                )}
                                <p className="text-[10px] text-gray-400 line-clamp-2 leading-snug">{j.prompt}</p>
                                <p className="text-[9px] text-gray-600">
                                    #{j.id} · {j.model.replace('.safetensors', '')} · {j.size}
                                    {j.elapsedSec != null && ` · ${j.elapsedSec}초`}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-[10px] text-gray-600 leading-relaxed border-t border-gray-800 pt-3">
                서버3(ai-studio-gpu)은 마지막 작업 후 <b className="text-gray-500">30분이 지나면 자동으로 꺼집니다</b>
                (최대 가동 4시간). 일이 들어오면 유휴 시간이 다시 0으로 초기화됩니다.
                이미지는 서버3에 저장되며, 서버가 꺼지면 목록은 남지만 미리보기는 표시되지 않습니다 —
                필요한 이미지는 <b className="text-gray-500">클릭해서 내려받아 두세요</b>.
            </p>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-gray-900/60 rounded px-3 py-2">
        <div className="text-[10px] text-gray-500">{label}</div>
        <div className="text-sm font-bold text-gray-100">{value}</div>
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <div className="text-[10px] text-gray-500 mb-1">{label}</div>
        {children}
    </div>
);
