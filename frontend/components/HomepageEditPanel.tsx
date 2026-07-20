import React, { useEffect, useRef, useState } from 'react';
import { homepageApi, HomepageRequestRow, HomepageEditRow } from '../services/apiService';

// 홈페이지 채팅 편집기 — 왼쪽 완성 시안 미리보기(iframe) + 오른쪽 채팅/사진편집 탭.
// 텍스트 수정(100P)=claude CLI가 지시만 반영해 즉시 배포. 사진(200P/100P)=생성·업로드 후
// Before/After 확인 → 적용해야 실제 반영(즉시배포 아님, 되돌릴 필요 없게 미리 확인시킴).

interface Props {
    request: HomepageRequestRow;
    onClose: () => void;
}

const INDIGO = '#5C6AC4';
const POLL_MS = 4000;

interface ChatMsg {
    id: number;
    role: 'user' | 'ai';
    text: string;
}

interface ImageSlot {
    file: string;   // 'img/hero.jpg'
    url: string;    // 절대 URL(썸네일)
}

// index.html 원본에서 img/ 상대경로 이미지 슬롯을 뽑는다(별도 메타 API 없이 배포 산출물 재사용).
function parseImageSlots(html: string, baseUrl: string): ImageSlot[] {
    const out: ImageSlot[] = [];
    const seen = new Set<string>();
    const re = /(?:src|href)=["'](img\/[a-z0-9_-]{1,40}\.(?:jpg|jpeg|png))["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
        const file = m[1];
        if (seen.has(file) || file.includes('_preview/')) continue;
        seen.add(file);
        out.push({ file, url: baseUrl + file });
    }
    return out;
}

export const HomepageEditPanel: React.FC<Props> = ({ request, onClose }) => {
    const [tab, setTab] = useState<'chat' | 'image'>('chat');
    const [messages, setMessages] = useState<ChatMsg[]>([
        { id: 0, role: 'ai', text: '수정하고 싶은 내용을 말씀해 주세요. 예: "주소를 서울 강남구 테헤란로 1길로 바꿔줘"' },
    ]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [busyStage, setBusyStage] = useState<'queued' | 'working' | null>(null);
    const [iframeKey, setIframeKey] = useState(0);
    const [lastAppliedEditId, setLastAppliedEditId] = useState<number | null>(null);
    const [reverting, setReverting] = useState(false);
    const [urlCopied, setUrlCopied] = useState(false);

    const [slots, setSlots] = useState<ImageSlot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<ImageSlot | null>(null);
    const [imgInstruction, setImgInstruction] = useState('');
    const [uploadB64, setUploadB64] = useState<string | null>(null);
    const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
    const [pendingEdit, setPendingEdit] = useState<HomepageEditRow | null>(null);
    const [imgError, setImgError] = useState<string | null>(null);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const msgIdRef = useRef(1);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const baseUrl = request.url || '';

    // 이미지 슬롯 목록 — 배포된 index.html을 fetch해서 파싱(별도 API 불필요).
    useEffect(() => {
        if (!baseUrl) return;
        (async () => {
            try {
                const res = await fetch(baseUrl, { cache: 'no-store' });
                const html = await res.text();
                setSlots(parseImageSlots(html, baseUrl));
            } catch { /* 무시 — 사진편집 탭에서 빈 목록으로 표시 */ }
        })();
    }, [baseUrl, iframeKey]);

    // 재진입 복원 — 창을 닫아도 서버 작업은 계속 진행되므로(포인트 이미 차감), 다시 열었을 때
    // 진행 중이던 요청을 이어서 보여줘야 함(안 그러면 "적용됐는지 안 됐는지" 알 길이 없음,
    // 사장 지적 2026-07-20). 신규 홈페이지 생성(HomepageBoard)의 재진입 복원과 동일 패턴.
    useEffect(() => {
        (async () => {
            try {
                const history = await homepageApi.editHistory(request.id);
                const inFlight = history.find(r => ['pending', 'processing', 'applying', 'reverting'].includes(r.status));
                if (inFlight) {
                    setBusy(true);
                    if (inFlight.kind === 'text') {
                        addMsg('ai', '아까 요청하신 수정이 아직 진행 중이었어요. 이어서 알려드릴게요.');
                        pollEdit(inFlight.id, {
                            onDone: (row) => {
                                addMsg('ai', row.errorMessage || '반영했어요! 왼쪽 화면을 새로고침했어요.');
                                setLastAppliedEditId(row.id);
                                setIframeKey(k => k + 1);
                            },
                            onFailed: (msg) => addMsg('ai', `수정하지 못했어요: ${msg || '다시 시도해 주세요.'}`),
                        });
                    } else {
                        setTab('image');
                        if (inFlight.targetFile) setSelectedSlot({ file: inFlight.targetFile, url: baseUrl + inFlight.targetFile });
                        pollEdit(inFlight.id, {
                            onDone: (row) => setPendingEdit(row),
                            onFailed: (msg) => setImgError(msg || '처리에 실패했어요.'),
                        });
                    }
                    return;
                }
                // 진행 중인 건 없지만, 가장 최근 완료된 텍스트 수정이 있으면 되돌리기 버튼 복원.
                const lastDoneText = history.find(r => r.kind === 'text' && r.status === 'done');
                if (lastDoneText) setLastAppliedEditId(lastDoneText.id);
            } catch { /* 이력 조회 실패는 무시 — 새 편집은 그대로 가능 */ }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const addMsg = (role: ChatMsg['role'], text: string) => {
        setMessages(prev => [...prev, { id: msgIdRef.current++, role, text }]);
    };

    const stopPoll = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
    useEffect(() => () => stopPoll(), []);

    // 탭 닫기·새로고침으로 화면 자체가 사라지는 경우 대비 — 서버 작업은 계속되지만(재진입 시
    // 위 복원 로직이 이어줌) 그래도 실수로 놓치지 않게 브라우저 표준 확인창을 띄움.
    useEffect(() => {
        if (!busy) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [busy]);

    // ── 텍스트 채팅 편집 ──
    const sendText = async () => {
        const instruction = input.trim();
        if (!instruction || busy) return;
        addMsg('user', instruction);
        setInput('');
        setBusy(true);
        try {
            const res = await homepageApi.createEdit(request.id, { kind: 'text', instruction });
            pollEdit(res.id, {
                onDone: (row) => {
                    addMsg('ai', row.errorMessage || '반영했어요! 왼쪽 화면을 새로고침했어요.');
                    setLastAppliedEditId(row.id);
                    setIframeKey(k => k + 1);
                },
                onFailed: (msg) => addMsg('ai', `수정하지 못했어요: ${msg || '다시 시도해 주세요.'}`),
            });
        } catch (e: any) {
            setBusy(false);
            if (e.code !== 'INSUFFICIENT_POINTS') addMsg('ai', e.message || '요청에 실패했어요.');
        }
    };

    // 방금 반영한 텍스트 수정을 되돌리기 — 혹시 마음에 안 들 때 원본으로 복구.
    const revertLast = async () => {
        if (!lastAppliedEditId || busy) return;
        setBusy(true); setReverting(true);
        addMsg('user', '방금 수정을 되돌려줘');
        try {
            await homepageApi.revertEdit(request.id, lastAppliedEditId);
            pollEdit(lastAppliedEditId, {
                onDone: () => {
                    addMsg('ai', '원래대로 되돌렸어요.');
                    setLastAppliedEditId(null);
                    setReverting(false);
                    setIframeKey(k => k + 1);
                },
                onFailed: (msg) => { addMsg('ai', `되돌리지 못했어요: ${msg || '다시 시도해 주세요.'}`); setReverting(false); },
            });
        } catch (e: any) {
            setBusy(false); setReverting(false);
            addMsg('ai', e.message || '되돌리기에 실패했어요.');
        }
    };

    // 공용 폴링(text/image/upload 공통) — done/failed까지. pending=대기(워커가 아직 안 집음),
    // processing/applying/reverting=처리 중 — 단계를 구분해서 보여줘야 "눌렀는데 반응 없다"는
    // 불안을 줄인다(사장 피드백 2026-07-20).
    const pollEdit = (editId: number, handlers: { onDone: (row: HomepageEditRow) => void; onFailed: (msg?: string | null) => void }) => {
        stopPoll();
        setBusyStage('queued');
        const tick = async () => {
            try {
                const row = await homepageApi.getEdit(request.id, editId);
                if (row.status === 'done') {
                    stopPoll(); setBusy(false); setBusyStage(null);
                    handlers.onDone(row);
                } else if (row.status === 'failed') {
                    stopPoll(); setBusy(false); setBusyStage(null);
                    handlers.onFailed(row.errorMessage);
                } else if (row.status === 'pending') {
                    setBusyStage('queued');
                } else {
                    setBusyStage('working');   // processing/applying/reverting
                }
            } catch { /* 다음 폴링에서 재시도 */ }
        };
        tick();
        pollRef.current = setInterval(tick, POLL_MS);
    };

    // ── 사진편집: AI 재생성 ──
    const generateImage = async () => {
        if (!selectedSlot || imgInstruction.trim().length < 2 || busy) {
            setImgError('어떻게 바꿀지 적어 주세요.'); return;
        }
        setImgError(null); setBusy(true); setPendingEdit(null);
        try {
            const res = await homepageApi.createEdit(request.id, {
                kind: 'image', instruction: imgInstruction.trim(), targetFile: selectedSlot.file,
            });
            pollEdit(res.id, {
                onDone: (row) => setPendingEdit(row),
                onFailed: (msg) => setImgError(msg || '이미지 생성에 실패했어요.'),
            });
        } catch (e: any) {
            setBusy(false);
            if (e.code !== 'INSUFFICIENT_POINTS') setImgError(e.message || '요청에 실패했어요.');
        }
    };

    // ── 사진편집: 내 사진 업로드 ──
    const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) { setImgError('사진은 6MB 이하만 올릴 수 있어요.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            setUploadB64(String(reader.result));
            setUploadPreviewUrl(URL.createObjectURL(file));
            setImgError(null);
        };
        reader.readAsDataURL(file);
    };

    const submitUpload = async () => {
        if (!selectedSlot || !uploadB64 || busy) return;
        setImgError(null); setBusy(true); setPendingEdit(null);
        try {
            const res = await homepageApi.createEdit(request.id, {
                kind: 'upload', instruction: '', targetFile: selectedSlot.file, imageBase64: uploadB64,
            });
            pollEdit(res.id, {
                onDone: (row) => setPendingEdit(row),
                onFailed: (msg) => setImgError(msg || '업로드한 사진을 사용할 수 없어요.'),
            });
        } catch (e: any) {
            setBusy(false);
            if (e.code !== 'INSUFFICIENT_POINTS') setImgError(e.message || '요청에 실패했어요.');
        }
    };

    // 미리보기 적용/재시도
    const applyPreview = async () => {
        if (!pendingEdit) return;
        setBusy(true);
        try {
            await homepageApi.applyEdit(request.id, pendingEdit.id);
            pollEdit(pendingEdit.id, {
                onDone: () => {
                    setPendingEdit(null); setSelectedSlot(null); setImgInstruction('');
                    setUploadB64(null); setUploadPreviewUrl(null);
                    setIframeKey(k => k + 1);
                },
                onFailed: (msg) => setImgError(msg || '적용에 실패했어요.'),
            });
        } catch (e: any) {
            setBusy(false);
            setImgError(e.message || '적용에 실패했어요.');
        }
    };
    const discardPreview = () => {
        setPendingEdit(null); setUploadB64(null); setUploadPreviewUrl(null);
    };

    const inputCls = 'w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-indigo-400';
    const inputStyle: React.CSSProperties = { color: '#1f2937', backgroundColor: '#ffffff' };

    // 대기(queued)=요청 접수, 아직 워커가 안 집음(최대 1분) / 처리 중(working)=지금 반영 중.
    // 진행률을 서버가 주지 않으므로(단일 API 호출) 좌우로 흐르는 인디케이터 바로 "멈추지
    // 않고 움직인다"는 걸 보여줌 — 스피너만으로는 정적으로 느껴진다는 사장 피드백(2026-07-20).
    const StageBadge: React.FC = () => {
        if (!busyStage) return null;
        const label = busyStage === 'queued' ? '접수됐어요 — 곧 시작해요…' : '반영하고 있어요…';
        return (
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="inline-block w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                    {label}
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full"
                         style={{ backgroundColor: INDIGO, animation: 'edit-progress 1.2s ease-in-out infinite' }} />
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
            <div className="bg-white flex-1 flex flex-col overflow-hidden">
                {/* 헤더 */}
                <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🏠</span>
                        <h2 className="text-base font-bold" style={{ color: INDIGO }}>홈페이지 수정 — 박하진</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {request.zipUrl && (
                            <a href={`${request.zipUrl}?v=${iframeKey}`} download
                               className="text-xs font-semibold underline hover:opacity-80" style={{ color: INDIGO }}>
                                📦 소스 받기
                            </a>
                        )}
                        {busy ? (
                            <span className="text-[11px] text-gray-400" title="반영이 끝나면 닫을 수 있어요">
                                반영 중에는 닫을 수 없어요
                            </span>
                        ) : (
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
                        )}
                    </div>
                </div>

                {/* 본문: 데스크톱 좌우 분할, 모바일 상하 스택 */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* 왼쪽: 미리보기 */}
                    <div className="flex-1 md:flex-[3] min-h-[40vh] md:min-h-0 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col">
                        {baseUrl && (
                            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50 shrink-0">
                                <a href={baseUrl} target="_blank" rel="noopener noreferrer"
                                   className="flex-1 text-[11px] text-gray-500 truncate hover:underline">
                                    🔗 {baseUrl}
                                </a>
                                <button onClick={() => { navigator.clipboard?.writeText(baseUrl); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 1500); }}
                                        className="text-[11px] font-semibold shrink-0" style={{ color: INDIGO }}>
                                    {urlCopied ? '복사됨!' : '복사'}
                                </button>
                            </div>
                        )}
                        {baseUrl && (
                            <iframe key={iframeKey} src={`${baseUrl}?v=${iframeKey}`} title="홈페이지 미리보기"
                                    className="w-full flex-1" style={{ border: 'none' }} />
                        )}
                    </div>

                    {/* 오른쪽: 채팅/사진편집 */}
                    <div className="flex-1 md:flex-[2] flex flex-col overflow-hidden">
                        <div className="flex border-b border-gray-100 shrink-0">
                            <button onClick={() => setTab('chat')}
                                    className={`flex-1 py-2.5 text-sm font-semibold ${tab === 'chat' ? '' : 'text-gray-400'}`}
                                    style={tab === 'chat' ? { color: INDIGO, borderBottom: `2px solid ${INDIGO}` } : undefined}>
                                💬 대화
                            </button>
                            <button onClick={() => setTab('image')}
                                    className={`flex-1 py-2.5 text-sm font-semibold ${tab === 'image' ? '' : 'text-gray-400'}`}
                                    style={tab === 'image' ? { color: INDIGO, borderBottom: `2px solid ${INDIGO}` } : undefined}>
                                🖼️ 사진편집
                            </button>
                        </div>

                        {tab === 'chat' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {messages.map(m => (
                                        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
                                                 style={m.role === 'user' ? { backgroundColor: INDIGO } : undefined}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                    {busy && <StageBadge />}
                                </div>
                                <div className="border-t border-gray-100 p-3 space-y-2 shrink-0">
                                    {lastAppliedEditId && !busy && (
                                        <button onClick={revertLast}
                                                className="w-full py-2 rounded-xl border text-xs font-semibold text-gray-500 border-gray-200">
                                            ↩️ 방금 수정 되돌리기
                                        </button>
                                    )}
                                    <textarea value={input} onChange={e => setInput(e.target.value)} rows={2} maxLength={500}
                                              className={`${inputCls} resize-none`} style={inputStyle}
                                              placeholder="예: 주소를 서울 강남구로 바꿔줘" />
                                    <button onClick={sendText} disabled={busy || input.trim().length < 2}
                                            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                            style={{ backgroundColor: INDIGO }}>
                                        {busy ? (busyStage === 'queued' ? '접수됐어요…' : (reverting ? '되돌리는 중…' : '반영 중…')) : '적용 (100P)'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {tab === 'image' && (
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {!pendingEdit && (
                                    <>
                                        <p className="text-xs text-gray-500">바꾸고 싶은 사진을 선택하세요.</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {slots.map(s => (
                                                <button key={s.file} onClick={() => { setSelectedSlot(s); setImgError(null); setUploadB64(null); setUploadPreviewUrl(null); }}
                                                        className={`rounded-lg overflow-hidden border-2 ${selectedSlot?.file === s.file ? '' : 'border-transparent'}`}
                                                        style={selectedSlot?.file === s.file ? { borderColor: INDIGO } : undefined}>
                                                    <img src={s.url} alt={s.file} className="w-full h-16 object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                        {slots.length === 0 && <p className="text-xs text-gray-400">사진을 불러오는 중이거나 없어요.</p>}

                                        {selectedSlot && (
                                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-700 mb-1.5">✨ AI로 다시 만들기</p>
                                                    <textarea value={imgInstruction} onChange={e => setImgInstruction(e.target.value)} rows={2} maxLength={300}
                                                              className={`${inputCls} resize-none`} style={inputStyle}
                                                              placeholder="예: 더 밝은 느낌으로, 디저트 사진으로" />
                                                    <button onClick={generateImage} disabled={busy}
                                                            className="w-full mt-1.5 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                                            style={{ backgroundColor: INDIGO }}>
                                                        {busy ? (busyStage === 'queued' ? '접수됐어요…' : '생성 중…') : '생성 (200P)'}
                                                    </button>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-700 mb-1.5">📷 내 사진으로 교체</p>
                                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={onPickFile} className="hidden" />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                                            className="w-full py-2 rounded-xl border text-sm font-semibold text-gray-500 border-gray-200 hover:bg-gray-50">
                                                        {uploadPreviewUrl ? '📷 다른 사진 선택' : '📷 사진 선택하기'}
                                                    </button>
                                                    {uploadPreviewUrl && (
                                                        <div className="mt-1.5 space-y-1.5">
                                                            <img src={uploadPreviewUrl} alt="업로드 미리보기" className="w-full h-24 object-cover rounded-lg" />
                                                            <button onClick={submitUpload} disabled={busy}
                                                                    className="w-full py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                                                    style={{ backgroundColor: INDIGO }}>
                                                                {busy ? (busyStage === 'queued' ? '접수됐어요…' : '확인 중…') : '이 사진으로 교체 (100P)'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {busy && <StageBadge />}
                                                {imgError && <div className="text-xs text-red-500">{imgError}</div>}
                                            </div>
                                        )}
                                    </>
                                )}

                                {pendingEdit && (
                                    <div className="space-y-3">
                                        <p className="text-sm font-semibold text-gray-800">이렇게 바꿀까요?</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-[11px] text-gray-400 mb-1">원래 사진</p>
                                                {selectedSlot && <img src={selectedSlot.url} alt="원본" className="w-full h-28 object-cover rounded-lg" />}
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-gray-400 mb-1">새 사진</p>
                                                {pendingEdit.previewUrl && <img src={pendingEdit.previewUrl} alt="새 사진" className="w-full h-28 object-cover rounded-lg" />}
                                            </div>
                                        </div>
                                        {busy && <StageBadge />}
                                        {imgError && <div className="text-xs text-red-500">{imgError}</div>}
                                        <div className="flex gap-2">
                                            <button onClick={discardPreview} disabled={busy}
                                                    className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-500 border-gray-200 disabled:opacity-50">
                                                다시 만들기
                                            </button>
                                            <button onClick={applyPreview} disabled={busy}
                                                    className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                                    style={{ backgroundColor: INDIGO }}>
                                                {busy ? (busyStage === 'queued' ? '접수됐어요…' : '적용 중…') : '적용'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
