import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { shortsApi, type CodexShortsRemoteJob } from '../../services/apiService';
import {
    createCodexShortsDraft,
    deriveDraftStatus,
    estimateSegmentLayout,
    parseCodexShortsScript,
    toImageTasks,
    toRendererJob,
    type CodexShortsAssetMeta,
    type CodexShortsDraft,
    type CodexShortsSegmentDraft,
} from './codexShortsDraft';
import { deleteCodexAsset, getCodexAsset, putCodexAsset, type CodexAssetKind } from './codexShortsAssets';

const STORAGE_KEY = 'aichat:codex-shorts-factory:v1';
const MAX_DRAFTS = 20;

const STATUS_LABEL = {
    draft: { text: '대본 작성', cls: 'bg-gray-700 text-gray-200' },
    awaiting_assets: { text: '파일 준비 중', cls: 'bg-amber-900/70 text-amber-200' },
    ready: { text: '렌더 준비', cls: 'bg-emerald-900/70 text-emerald-200' },
} as const;

const assetKey = (segmentId: string, kind: CodexAssetKind) => `${segmentId}:${kind}`;

function loadDrafts(): CodexShortsDraft[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter(row => row?.version === 1).slice(0, MAX_DRAFTS) : [];
    } catch {
        return [];
    }
}

function downloadJson(name: string, payload: object): void {
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
}

function downloadBlob(name: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
}

const extensionFor = (kind: CodexAssetKind, meta?: CodexShortsAssetMeta): string => {
    if (kind === 'audio') return 'mp3';
    if (meta?.type === 'image/jpeg') return 'jpg';
    if (meta?.type === 'image/webp') return 'webp';
    return 'png';
};

const fmtDate = (iso: string): string => {
    const date = new Date(iso);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const copyText = async (value: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-bold text-gray-400 mb-1">{children}</label>
);

export const CodexShortsFactoryPanel: React.FC = () => {
    const [drafts, setDrafts] = useState<CodexShortsDraft[]>(() => loadDrafts());
    const [selectedId, setSelectedId] = useState<string>(() => loadDrafts()[0]?.id || '');
    const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busyAsset, setBusyAsset] = useState('');
    const [remoteJob, setRemoteJob] = useState<CodexShortsRemoteJob | null>(null);
    const [remoteBusy, setRemoteBusy] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const fileRef = useRef<HTMLInputElement | null>(null);
    const remotePollBusy = useRef(false);

    const current = drafts.find(row => row.id === selectedId) || null;

    const loadRemote = useCallback(async (jobId: string) => {
        if (remotePollBusy.current) return;
        remotePollBusy.current = true;
        try {
            setRemoteJob(await shortsApi.getCodexJob(jobId));
        } catch (e: any) {
            if (e?.status !== 404) setError(e?.message || '서버 작업 상태를 불러오지 못했습니다.');
        } finally {
            remotePollBusy.current = false;
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
        } catch {
            setError('작업 내용을 저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요.');
        }
    }, [drafts]);

    useEffect(() => {
        if (!selectedId && drafts.length) setSelectedId(drafts[0].id);
    }, [drafts, selectedId]);

    useEffect(() => {
        setRemoteJob(null);
        setVideoUrl('');
        if (current) void loadRemote(current.id);
    }, [current?.id, loadRemote]);

    useEffect(() => {
        if (!current || remoteJob?.status !== 'rendering') return;
        const timer = setInterval(() => { void loadRemote(current.id); }, 4000);
        return () => clearInterval(timer);
    }, [current?.id, remoteJob?.status, loadRemote]);

    useEffect(() => {
        if (!current || remoteJob?.status !== 'completed' || !remoteJob.outputReady || videoUrl) return;
        void shortsApi.fetchCodexVideo(current.id)
            .then(setVideoUrl)
            .catch(e => setError(e?.message || '완성 영상을 불러오지 못했습니다.'));
    }, [current?.id, remoteJob?.status, remoteJob?.outputReady, videoUrl]);

    useEffect(() => () => {
        if (videoUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(videoUrl);
    }, [videoUrl]);

    useEffect(() => {
        let disposed = false;
        const madeUrls: string[] = [];
        setAssetUrls({});
        if (!current) return;
        void Promise.all(current.segments.flatMap(segment => (['image', 'audio'] as const).map(async kind => {
            const meta = segment[kind];
            if (!meta) return;
            try {
                const blob = await getCodexAsset(current.id, segment.id, kind);
                if (!blob || disposed) return;
                const url = URL.createObjectURL(blob);
                madeUrls.push(url);
                setAssetUrls(prev => ({ ...prev, [assetKey(segment.id, kind)]: url }));
            } catch { /* IndexedDB 파일이 없으면 메타만 남기고 다시 업로드하도록 표시한다. */ }
        })));
        return () => {
            disposed = true;
            if (typeof URL.revokeObjectURL === 'function') madeUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [current?.id, current?.updatedAt]);

    const updateCurrent = useCallback((updater: (draft: CodexShortsDraft) => CodexShortsDraft) => {
        setDrafts(prev => prev.map(row => {
            if (row.id !== selectedId) return row;
            const next = updater(row);
            return { ...next, status: deriveDraftStatus(next.segments), updatedAt: new Date().toISOString() };
        }));
    }, [selectedId]);

    const newDraft = () => {
        const draft = createCodexShortsDraft();
        setDrafts(prev => [draft, ...prev].slice(0, MAX_DRAFTS));
        setSelectedId(draft.id);
        setMessage('새 작업을 만들었습니다.');
        setError('');
    };

    const removeDraft = async () => {
        if (!current || !confirm(`'${current.title}' 작업을 지울까요? 이 브라우저에 저장된 이미지와 음성도 함께 지워집니다.`)) return;
        await Promise.all(current.segments.flatMap(segment => (['image', 'audio'] as const).map(kind =>
            deleteCodexAsset(current.id, segment.id, kind).catch(() => undefined)
        )));
        setDrafts(prev => prev.filter(row => row.id !== current.id));
        setSelectedId('');
    };

    const parseScript = async () => {
        if (!current?.sourceScript.trim()) { setError('대본을 먼저 입력해 주세요.'); return; }
        const parsed = parseCodexShortsScript(current.sourceScript);
        if (!parsed.length) { setError('장면을 찾지 못했습니다. [장면 1], 화면 자막, 내레이션 형식을 확인해 주세요.'); return; }
        const staleSegments: CodexShortsSegmentDraft[] = current.segments.slice(parsed.length);
        const segments = parsed.map((row, index) => {
            const previous = current.segments[index];
            const sameScene = previous?.caption === row.caption && previous?.narration === row.narration;
            if (previous && !sameScene) staleSegments.push(previous);
            return sameScene ? { ...row, image: previous.image, audio: previous.audio } : row;
        });
        await Promise.all(staleSegments.flatMap(segment => (['image', 'audio'] as const).map(kind =>
            deleteCodexAsset(current.id, segment.id, kind).catch(() => undefined)
        )));
        updateCurrent(row => ({ ...row, segments }));
        setMessage(`${segments.length}개 장면으로 나눴습니다. 원문 내레이션은 바꾸지 않았습니다.`);
        setError('');
    };

    const importScript = async (file: File) => {
        if (!/\.(txt|md)$/i.test(file.name) || file.size > 200 * 1024) {
            setError('.txt 또는 .md 파일만 가능하며 최대 200KB입니다.');
            return;
        }
        const sourceScript = await file.text();
        updateCurrent(row => ({ ...row, sourceScript }));
        setMessage(`${file.name} 대본을 불러왔습니다.`);
        setError('');
    };

    const updateSegment = (segmentId: string, patch: Partial<CodexShortsSegmentDraft>) => {
        updateCurrent(row => ({
            ...row,
            segments: row.segments.map(segment => segment.id === segmentId ? { ...segment, ...patch } : segment),
        }));
    };

    const uploadAsset = async (segment: CodexShortsSegmentDraft, kind: CodexAssetKind, file: File) => {
        if (!current) return;
        if (file.size > 9 * 1024 * 1024) {
            setError('파일은 9MB 이하만 올릴 수 있습니다.');
            return;
        }
        const isValid = kind === 'image'
            ? ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
            : (file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name));
        if (!isValid) {
            setError(kind === 'image' ? 'PNG·JPG·WEBP 이미지만 올릴 수 있습니다.' : 'MP3 음성만 올릴 수 있습니다.');
            return;
        }
        const key = assetKey(segment.id, kind);
        setBusyAsset(key);
        try {
            await putCodexAsset(current.id, segment.id, kind, file);
            const meta = { name: file.name, type: file.type, size: file.size };
            updateSegment(segment.id, { [kind]: meta });
            setMessage(`장면 ${current.segments.indexOf(segment) + 1} ${kind === 'image' ? '이미지' : '음성'}를 저장했습니다.`);
            setError('');
        } catch (e: any) {
            setError(e?.message || '파일을 저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요.');
        } finally {
            setBusyAsset('');
        }
    };

    const clearAsset = async (segment: CodexShortsSegmentDraft, kind: CodexAssetKind) => {
        if (!current) return;
        await deleteCodexAsset(current.id, segment.id, kind).catch(() => undefined);
        updateSegment(segment.id, { [kind]: undefined });
    };

    const synthesizeAudio = async (segment: CodexShortsSegmentDraft, index: number) => {
        if (!segment.narration.trim()) { setError('내레이션을 먼저 입력해 주세요.'); return; }
        const key = assetKey(segment.id, 'audio');
        setBusyAsset(key);
        try {
            const blob = await shortsApi.synthesizeCodexSpeech(segment.narration);
            const file = new File([blob], `scene${index + 1}.mp3`, { type: 'audio/mpeg' });
            await uploadAsset(segment, 'audio', file);
            setMessage(`장면 ${index + 1} AI 음성을 만들었습니다.`);
        } catch (e: any) {
            setError(e?.message || 'AI 음성을 만들지 못했습니다.');
        } finally {
            setBusyAsset('');
        }
    };

    const exportAsset = async (segment: CodexShortsSegmentDraft, index: number, kind: CodexAssetKind) => {
        if (!current) return;
        const blob = await getCodexAsset(current.id, segment.id, kind);
        if (!blob) { setError('저장된 파일을 찾지 못했습니다. 다시 올려 주세요.'); return; }
        downloadBlob(`scene${index + 1}.${extensionFor(kind, segment[kind])}`, blob);
    };

    const unsafeCount = useMemo(() => current?.segments.filter(row => !estimateSegmentLayout(row).safe).length || 0, [current]);
    const readyAssets = current?.segments.filter(row => row.image && row.audio).length || 0;

    const startRender = async () => {
        if (!current) return;
        if (current.status !== 'ready') { setError('모든 장면의 이미지와 MP3를 먼저 준비해 주세요.'); return; }
        if (unsafeCount) { setError('문구 겹침 위험 장면을 먼저 수정해 주세요.'); return; }
        setRemoteBusy('sync');
        setError('');
        setVideoUrl('');
        try {
            setMessage('서버에 작업 정보를 저장하고 있습니다.');
            await shortsApi.saveCodexJob(toRendererJob(current));
            for (let index = 0; index < current.segments.length; index++) {
                const segment = current.segments[index];
                for (const kind of ['image', 'audio'] as const) {
                    const blob = await getCodexAsset(current.id, segment.id, kind);
                    if (!blob) throw new Error(`장면 ${index + 1} ${kind === 'image' ? '이미지' : '음성'} 파일을 찾지 못했습니다. 다시 올려 주세요.`);
                    setMessage(`서버로 파일 전송 중 · 장면 ${index + 1}/${current.segments.length} ${kind === 'image' ? '이미지' : '음성'}`);
                    await shortsApi.uploadCodexAsset(current.id, index, kind, blob);
                }
            }
            await shortsApi.renderCodexJob(current.id);
            setRemoteJob(prev => prev ? { ...prev, status: 'rendering' } : {
                jobId: current.id, title: current.title, status: 'rendering', assets: [],
                outputReady: false, updatedAt: new Date().toISOString(),
            });
            setMessage('영상 렌더링을 시작했습니다. 창을 닫아도 서버에서 계속 진행됩니다.');
        } catch (e: any) {
            setError(e?.message || '영상 렌더링 요청에 실패했습니다.');
            await loadRemote(current.id);
        } finally {
            setRemoteBusy('');
        }
    };

    const sendTelegram = async () => {
        if (!current) return;
        setRemoteBusy('telegram');
        setError('');
        try {
            await shortsApi.sendCodexTelegram(current.id);
            setMessage('완성 영상을 텔레그램으로 보냈습니다.');
        } catch (e: any) {
            setError(e?.message || '텔레그램 전송에 실패했습니다.');
        } finally {
            setRemoteBusy('');
        }
    };

    if (!current) {
        return (
            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
                <div className="max-w-md text-center bg-gray-800/70 border border-gray-700 rounded-2xl p-8">
                    <div className="text-4xl mb-3">🎬</div>
                    <h2 className="text-xl font-bold text-white">Codex 쇼츠 공장</h2>
                    <p className="text-sm text-gray-400 mt-2">기존 회원용 쇼츠와 분리된 관리자 전용 작업대입니다.</p>
                    <button onClick={newDraft} className="mt-5 min-h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold">
                        첫 작업 만들기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-950 p-3 sm:p-5">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-extrabold text-white">🎬 Codex 쇼츠 공장</h2>
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-900 text-violet-200">관리자 베타</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_LABEL[current.status].cls}`}>{STATUS_LABEL[current.status].text}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">GCP GPU 없이 대본·Codex 이미지·음성을 모아 v2 렌더러 작업을 준비합니다.</p>
                    </div>
                    <div className="flex gap-2">
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="max-w-48 min-h-11 rounded-lg bg-gray-800 border border-gray-700 px-3 text-xs text-gray-200">
                            {drafts.map(row => <option key={row.id} value={row.id}>{row.title} · {fmtDate(row.updatedAt)}</option>)}
                        </select>
                        <button onClick={newDraft} className="min-h-11 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white">+ 새 작업</button>
                        <button onClick={() => void removeDraft()} className="min-h-11 px-3 rounded-lg border border-red-800 text-xs font-bold text-red-300 hover:bg-red-950">삭제</button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className={`rounded-xl border p-3 ${current.segments.length ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200' : 'border-violet-700 bg-violet-950/40 text-violet-200'}`}>1. 대본·장면<br/><b>{current.segments.length || 0}개</b></div>
                    <div className={`rounded-xl border p-3 ${readyAssets === current.segments.length && current.segments.length ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200' : 'border-gray-700 bg-gray-900 text-gray-300'}`}>2. 이미지·음성<br/><b>{readyAssets}/{current.segments.length}</b></div>
                    <div className={`rounded-xl border p-3 ${current.status === 'ready' && !unsafeCount ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200' : 'border-gray-700 bg-gray-900 text-gray-300'}`}>3. 안전검사·렌더<br/><b>{unsafeCount ? `${unsafeCount}개 수정` : '정상'}</b></div>
                </div>

                {message && <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100 flex justify-between gap-3"><span>{message}</span><button onClick={() => setMessage('')}>×</button></div>}
                {error && <div className="rounded-xl border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-100 flex justify-between gap-3"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-3">
                        <div><FieldLabel>작업 제목</FieldLabel><input value={current.title} onChange={e => updateCurrent(row => ({ ...row, title: e.target.value }))} className="w-full min-h-11 rounded-lg bg-gray-950 border border-gray-700 px-3 text-sm text-white" /></div>
                        <div><FieldLabel>브랜드 문구</FieldLabel><input value={current.brand} onChange={e => updateCurrent(row => ({ ...row, brand: e.target.value }))} className="w-full min-h-11 rounded-lg bg-gray-950 border border-gray-700 px-3 text-sm text-white" /></div>
                    </div>
                    <div><FieldLabel>캐릭터 바이블 — 모든 인물 이미지 프롬프트에 반복할 외형·의상·화풍</FieldLabel><textarea value={current.characterBible} onChange={e => updateCurrent(row => ({ ...row, characterBible: e.target.value }))} rows={3} className="w-full rounded-lg bg-gray-950 border border-gray-700 p-3 text-sm text-white resize-y" placeholder="예: 40대 한국인 부부, 아내는 단정한 검은 단발과 베이지 니트..." /></div>
                    <div>
                        <div className="flex items-center justify-between gap-3 mb-1"><FieldLabel>가져온 대본</FieldLabel><button onClick={() => fileRef.current?.click()} className="text-xs font-bold text-violet-300 hover:text-violet-200">📄 파일 불러오기</button></div>
                        <textarea value={current.sourceScript} onChange={e => updateCurrent(row => ({ ...row, sourceScript: e.target.value }))} rows={9} className="w-full rounded-xl bg-gray-950 border border-gray-700 p-3 text-sm leading-6 text-gray-100 resize-y" placeholder={'[장면 1]\n화면 연출: ...\n화면 자막: ...\n내레이션 (지은): ...'} />
                        <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void importScript(file); e.target.value = ''; }} />
                        <div className="flex justify-between gap-3 items-center mt-2 flex-wrap"><span className="text-[11px] text-gray-500">원문 내레이션은 고치지 않고 장면 필드만 추출합니다. 최대 10장면.</span><button onClick={() => void parseScript()} className="min-h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-bold text-white">장면으로 나누기</button></div>
                    </div>
                </section>

                <div className="space-y-4">
                    {current.segments.map((segment, index) => {
                        const layout = estimateSegmentLayout(segment);
                        const imageUrl = assetUrls[assetKey(segment.id, 'image')];
                        const imageBusy = busyAsset === assetKey(segment.id, 'image');
                        const audioBusy = busyAsset === assetKey(segment.id, 'audio');
                        return (
                            <section key={segment.id} className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="font-bold text-white">장면 {index + 1}{segment.speaker && <span className="ml-2 text-xs text-violet-300">🎙 {segment.speaker}</span>}</div>
                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${layout.safe ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>{layout.safe ? `안전 · 간격 ${layout.gap}px` : '문구가 길어 겹침 위험'}</span>
                                </div>
                                <div className="p-4 grid lg:grid-cols-[minmax(0,1fr)_260px] gap-4">
                                    <div className="space-y-3 min-w-0">
                                        <div><FieldLabel>큰 제목</FieldLabel><input value={segment.caption} onChange={e => updateSegment(segment.id, { caption: e.target.value })} className="w-full min-h-11 rounded-lg bg-gray-950 border border-gray-700 px-3 text-sm text-white" /></div>
                                        <div><FieldLabel>내레이션·화면 자막</FieldLabel><textarea value={segment.narration} onChange={e => updateSegment(segment.id, { narration: e.target.value })} rows={3} className="w-full rounded-lg bg-gray-950 border border-gray-700 p-3 text-sm text-white resize-y" /></div>
                                        <div><FieldLabel>화면 연출</FieldLabel><input value={segment.direction} onChange={e => updateSegment(segment.id, { direction: e.target.value })} className="w-full min-h-11 rounded-lg bg-gray-950 border border-gray-700 px-3 text-sm text-white" /></div>
                                        <div><FieldLabel>Codex 이미지 프롬프트</FieldLabel><textarea value={segment.imagePrompt} onChange={e => updateSegment(segment.id, { imagePrompt: e.target.value })} rows={3} className="w-full rounded-lg bg-gray-950 border border-gray-700 p-3 text-sm text-white resize-y" /><button onClick={() => void copyText(`${current.characterBible}\n\n장면 ${index + 1}: ${segment.imagePrompt || segment.direction}`).then(() => setMessage('이미지 프롬프트를 복사했습니다.')).catch(() => setError('클립보드 복사에 실패했습니다.'))} className="mt-1 text-xs font-bold text-violet-300 hover:text-violet-200">프롬프트 복사</button></div>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-3">
                                                <div className="text-xs font-bold text-gray-200 mb-2">🖼 장면 이미지 {segment.image ? '✓' : ''}</div>
                                                <div className="flex gap-2 flex-wrap"><label className="min-h-11 inline-flex items-center px-3 rounded-lg bg-violet-700 hover:bg-violet-600 text-xs font-bold text-white cursor-pointer">{imageBusy ? '저장 중...' : segment.image ? '이미지 바꾸기' : '이미지 올리기'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={imageBusy} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadAsset(segment, 'image', file); e.target.value = ''; }} /></label>{segment.image && <><button onClick={() => void exportAsset(segment, index, 'image')} className="min-h-11 px-3 rounded-lg border border-gray-700 text-xs text-gray-200">받기</button><button onClick={() => void clearAsset(segment, 'image')} className="min-h-11 px-3 rounded-lg text-xs text-red-300">지우기</button></>}</div>
                                            </div>
                                            <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-3">
                                                <div className="text-xs font-bold text-gray-200 mb-2">🎙 장면 음성 MP3 {segment.audio ? '✓' : ''}</div>
                                                <div className="flex gap-2 flex-wrap"><button onClick={() => void synthesizeAudio(segment, index)} disabled={audioBusy} className="min-h-11 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-xs font-bold text-white">{audioBusy ? '만드는 중...' : '✨ AI 음성 만들기'}</button><label className="min-h-11 inline-flex items-center px-3 rounded-lg bg-blue-700 hover:bg-blue-600 text-xs font-bold text-white cursor-pointer">{segment.audio ? 'MP3 바꾸기' : 'MP3 올리기'}<input type="file" accept="audio/mpeg,.mp3" className="hidden" disabled={audioBusy} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadAsset(segment, 'audio', file); e.target.value = ''; }} /></label>{segment.audio && <><button onClick={() => void exportAsset(segment, index, 'audio')} className="min-h-11 px-3 rounded-lg border border-gray-700 text-xs text-gray-200">받기</button><button onClick={() => void clearAsset(segment, 'audio')} className="min-h-11 px-3 rounded-lg text-xs text-red-300">지우기</button></>}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mx-auto w-[230px] h-[409px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#121018] to-[#221b30] border border-gray-700 p-3 flex flex-col text-center shadow-xl">
                                        <div className="mx-auto text-[7px] text-gray-400 border border-violet-500/50 rounded-full px-3 py-1">{current.brand}</div>
                                        <div className="mt-5 h-[205px] rounded-xl bg-gray-800 bg-cover bg-center shadow-lg" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>{!imageUrl && <div className="h-full flex items-center justify-center text-4xl text-gray-600">🖼</div>}</div>
                                        <div className="mt-4 px-1 text-[15px] leading-[18px] font-extrabold text-white line-clamp-3">▤ {segment.caption || '큰 제목'}</div>
                                        <div className={`mt-auto rounded-lg bg-black/80 px-2 py-1.5 text-[9px] leading-[12px] text-gray-200 line-clamp-4 ${layout.safe ? '' : 'ring-2 ring-red-500'}`}>{segment.narration || '내레이션 자막'}</div>
                                        <div className="mt-2 text-[8px] tracking-[3px] text-gray-600"><span className="text-violet-400">●</span> ● ● ●</div>
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>

                {current.segments.length > 0 && (
                    <section className="rounded-2xl border border-violet-800/70 bg-violet-950/30 p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="font-bold text-white">렌더러 작업 묶음</h3>
                                <p className="text-xs text-gray-400 mt-1">서버1 관리자 API를 거쳐 서버2 v2 렌더러로 안전하게 전송합니다. 렌더링 중에는 창을 닫아도 계속 진행됩니다.</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => downloadJson('image-tasks.json', toImageTasks(current))} className="min-h-11 px-3 rounded-lg border border-violet-700 text-xs font-bold text-violet-200">이미지 작업표 받기</button>
                                <button onClick={() => downloadJson('job.json', toRendererJob(current))} className="min-h-11 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white">작업 JSON 받기</button>
                            </div>
                        </div>
                        <div className="mt-3 grid sm:grid-cols-3 gap-2 text-xs">
                            <div className={`rounded-lg p-3 ${current.status === 'ready' ? 'bg-emerald-950 text-emerald-200' : 'bg-gray-900 text-gray-400'}`}>파일: {readyAssets}/{current.segments.length} 장면</div>
                            <div className={`rounded-lg p-3 ${unsafeCount === 0 ? 'bg-emerald-950 text-emerald-200' : 'bg-red-950 text-red-200'}`}>안전영역: {unsafeCount === 0 ? '통과' : `${unsafeCount}개 수정 필요`}</div>
                            <button onClick={() => void startRender()} disabled={remoteBusy !== '' || current.status !== 'ready' || unsafeCount > 0 || remoteJob?.status === 'rendering'} className="rounded-lg p-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold">{remoteBusy === 'sync' ? '파일 전송 중...' : remoteJob?.status === 'rendering' ? '영상 렌더링 중...' : '🎬 영상 렌더링'}</button>
                        </div>
                        {remoteJob && (
                            <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${remoteJob.status === 'failed' ? 'border-red-700 bg-red-950/40 text-red-100' : remoteJob.status === 'completed' ? 'border-emerald-700 bg-emerald-950/40 text-emerald-100' : 'border-blue-800 bg-blue-950/40 text-blue-100'}`}>
                                서버 작업: <b>{remoteJob.status === 'rendering' ? '렌더링 중' : remoteJob.status === 'completed' ? '완성' : remoteJob.status === 'failed' ? '실패' : '파일 준비 중'}</b>
                                {remoteJob.duration ? ` · ${remoteJob.duration.toFixed(1)}초` : ''}
                                {remoteJob.error && <div className="mt-1 text-xs">{remoteJob.error}</div>}
                            </div>
                        )}
                        {videoUrl && (
                            <div className="mt-4 grid md:grid-cols-[240px_1fr] gap-4 items-start">
                                <video src={videoUrl} controls playsInline className="w-full max-w-[240px] aspect-[9/16] rounded-xl bg-black border border-gray-700" />
                                <div className="space-y-2">
                                    <h4 className="font-bold text-white">완성 영상</h4>
                                    <p className="text-xs text-gray-400">장면별 프레임과 자막을 확인한 뒤 텔레그램으로 보내세요.</p>
                                    <div className="flex gap-2 flex-wrap">
                                        <a href={videoUrl} download={`${current.id}.mp4`} className="min-h-11 inline-flex items-center px-4 rounded-lg border border-gray-700 text-xs font-bold text-gray-100">영상 받기</a>
                                        <button onClick={() => void sendTelegram()} disabled={remoteBusy === 'telegram'} className="min-h-11 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white">{remoteBusy === 'telegram' ? '보내는 중...' : '✈️ 텔레그램으로 보내기'}</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};
