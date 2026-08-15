import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthModal } from '../AuthModal';
import {
    reversePromptApi,
    checkFile,
    fileCheckMessage,
    fileToBase64,
    savePendingUpload,
    loadPendingUpload,
    clearPendingUpload,
    isLoggedIn,
    type RpAnalyzeResult,
    type RpQuota,
    type RpItemSummary,
} from './api';
import { RpHeader, PromptBlock, RpError, RpLoading, QuotaBadge } from './parts';

// 🎨 리버스 프롬프트 S1 — 업로드 + 결과 (/reverse-prompt)
// app/reverse-prompt/PRD.md 5장 S1.
//
// ★첫 화면에는 로그인 유도 요소를 두지 않는다(PRD 2.1). 업로드 영역만 보인다.
//   로그인은 "비로그인 2회를 다 쓰고 3회차를 시도하는 시점"에만 요구한다.
// ★AuthModal은 onSuccess로 상위에 토큰을 넘기는 구조인데, 이 화면은 App.tsx 상태 밖에서
//   독립적으로 도는 얼리리턴 라우트다. 그래서 성공 시 localStorage를 직접 읽어 이어간다
//   (AuthModal이 이미 localStorage.token을 심는다 — AuthModal.tsx:144).

export const ReversePromptMain: React.FC = () => {
    const [quota, setQuota] = useState<RpQuota | null>(null);
    const [result, setResult] = useState<RpAnalyzeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [recent, setRecent] = useState<RpItemSummary[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /** 마지막으로 시도한 파일 — 실패 시 재시도에 쓴다(지시 18번: 파일을 잃지 않는다). */
    const lastUpload = useRef<{ base64: string; mimeType: string; name: string } | null>(null);

    const loggedIn = isLoggedIn();

    // ── 잔여 횟수 + 최근 보관 항목 ────────────────────────────────────
    const refreshQuota = useCallback(async () => {
        try {
            setQuota(await reversePromptApi.quota());
        } catch {
            /* 잔여 횟수를 못 불러와도 업로드 자체는 막지 않는다 */
        }
    }, []);

    const refreshRecent = useCallback(async () => {
        if (!isLoggedIn()) return;
        try {
            const page = await reversePromptApi.items(1, 3); // 최근 3개(PRD 4.2)
            setRecent(page.items);
        } catch {
            /* 보관함을 못 불러와도 메인 기능은 계속 쓸 수 있어야 한다 */
        }
    }, []);

    // ── 분석 실행 ─────────────────────────────────────────────────────
    const runAnalyze = useCallback(
        async (base64: string, mimeType: string, name: string) => {
            lastUpload.current = { base64, mimeType, name };
            setLoading(true);
            setError(null);
            try {
                const r = await reversePromptApi.analyze(base64, mimeType);
                setResult(r);
                setQuota(r.quota);
                void refreshRecent();
            } catch (e) {
                const err = e as { status?: number; body?: { requiresLogin?: boolean; quota?: RpQuota }; message?: string };

                // ★429 + requiresLogin → 로그인 모달(PRD 9장, 지시 8~9번)
                if (err.status === 429 && err.body?.requiresLogin) {
                    // 모달을 띄우기 **전에** 파일을 보관한다. 이탈해도 잃지 않게.
                    const saved = savePendingUpload({ base64, mimeType, name });
                    if (!saved) {
                        // sessionStorage 상한 초과 — 조용히 넘기지 않고 안내한다(PRD 2.1)
                        setError('이미지가 커서 임시 보관하지 못했어요. 로그인 후 다시 올려주세요.');
                    }
                    if (err.body.quota) setQuota(err.body.quota);
                    setShowAuth(true);
                    return;
                }
                // 로그인 사용자의 한도 초과 등 그 외 429
                if (err.status === 429) {
                    if (err.body?.quota) setQuota(err.body.quota);
                    setError(err.message || '오늘 이용 횟수를 다 쓰셨어요.');
                    return;
                }
                setError(err.message || '분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
            } finally {
                setLoading(false);
            }
        },
        [refreshRecent],
    );

    // ── 파일 선택 ─────────────────────────────────────────────────────
    const handleFile = useCallback(
        async (file: File) => {
            setError(null);
            // ★클라이언트에서 먼저 거른다 — 5MB 초과·형식 위반은 서버에 보내지 않는다(지시 2번).
            //   413을 사용자가 볼 일이 없게 한다.
            const bad = checkFile(file);
            if (bad) {
                setError(fileCheckMessage(bad));
                return;
            }
            try {
                const base64 = await fileToBase64(file);
                await runAnalyze(base64, file.type, file.name);
            } catch (e) {
                setError((e as Error).message || '파일을 읽지 못했어요.');
            }
        },
        [runAnalyze],
    );

    // ── 최초 로드 + 로그인 복귀 시 자동 재개 ──────────────────────────
    useEffect(() => {
        void refreshQuota();
        void refreshRecent();

        // ★로그인하고 돌아왔는데 보관분이 있으면 자동으로 이어서 분석한다(지시 10번).
        //   재개 후 sessionStorage를 비운다 — 안 그러면 다음 방문에 또 실행된다.
        const pending = loadPendingUpload();
        if (pending && isLoggedIn()) {
            clearPendingUpload();
            void runAnalyze(pending.base64, pending.mimeType, pending.name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 로그인 모달 콜백 ──────────────────────────────────────────────
    const onAuthSuccess = useCallback(() => {
        setShowAuth(false);
        // AuthModal이 localStorage.token을 이미 심었다. 보관분으로 바로 이어간다.
        const pending = loadPendingUpload();
        clearPendingUpload();
        void refreshQuota();
        void refreshRecent();
        if (pending) {
            void runAnalyze(pending.base64, pending.mimeType, pending.name);
        }
    }, [refreshQuota, refreshRecent, runAnalyze]);

    const onAuthClose = useCallback(() => {
        setShowAuth(false);
        clearPendingUpload(); // ★사용자가 닫으면 보관분도 정리한다(지시 11번)
    }, []);

    // ── 드래그앤드롭 ──────────────────────────────────────────────────
    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
        },
        [handleFile],
    );

    const retry = useCallback(() => {
        const u = lastUpload.current;
        if (u) void runAnalyze(u.base64, u.mimeType, u.name);
    }, [runAnalyze]);

    return (
        <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438]">
            <RpHeader
                title="🎨 리버스 프롬프트"
                right={
                    loggedIn ? (
                        <button
                            onClick={() => { window.location.href = '/reverse-prompt/library'; }}
                            className="text-xs font-bold text-indigo-700"
                        >
                            보관함
                        </button>
                    ) : null
                }
            />

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                <p className="text-sm text-[#5C5468] leading-relaxed mb-5">
                    마음에 드는 이미지를 올리면 <b className="text-[#2D2438]">Midjourney</b>와{' '}
                    <b className="text-[#2D2438]">Stable Diffusion</b> 프롬프트를 한 번에 만들어 드려요.
                </p>

                {/* ── 업로드 영역 ── */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                        dragOver
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-[#D9CFC2] bg-white hover:border-indigo-400'
                    }`}
                >
                    <div className="text-3xl mb-2">🖼️</div>
                    <p className="text-sm font-bold">이미지를 끌어다 놓거나 클릭해 선택하세요</p>
                    <p className="text-xs text-[#9089A1] mt-1">JPG · PNG · WEBP / 5MB 이하</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleFile(f);
                            e.target.value = ''; // 같은 파일 재선택이 가능하도록
                        }}
                    />
                </div>

                {/* 잔여 횟수 — 첫 화면에서는 이것만. 로그인 유도 요소는 두지 않는다 */}
                {quota && (
                    <div className="mt-3 text-right">
                        <QuotaBadge remaining={quota.remaining} limit={quota.limit} />
                    </div>
                )}

                {/* ── 상태 표시 ── */}
                {loading && <div className="mt-5"><RpLoading /></div>}
                {error && !loading && (
                    <div className="mt-5">
                        <RpError message={error} onRetry={lastUpload.current ? retry : undefined} />
                    </div>
                )}

                {/* ── 결과 ── */}
                {result && !loading && (
                    <section className="mt-6 space-y-3">
                        {/* ★캐시 적중 표시(지시 5번) — 같은 이미지를 다시 올렸을 때 혼란스럽지 않게 */}
                        {result.cached && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    💡 전에 분석한 것과 <b>같은 이미지</b>예요. 저장해 둔 결과를 그대로 보여드려요
                                    <span className="text-amber-700">(횟수가 차감되지 않았어요).</span>
                                </p>
                            </div>
                        )}

                        <PromptBlock
                            title="Midjourney"
                            hint="그대로 붙여넣어 쓰세요"
                            text={result.midjourney}
                        />
                        <PromptBlock
                            title="Stable Diffusion — Positive"
                            hint="원하는 요소"
                            text={result.stableDiffusion.positive}
                        />
                        <PromptBlock
                            title="Stable Diffusion — Negative"
                            hint="피할 요소"
                            tone="slate"
                            text={result.stableDiffusion.negative}
                        />

                        {/* 분석 요약 */}
                        <div className="rounded-2xl bg-white border border-[#F0E9DE] p-4">
                            <h3 className="text-sm font-extrabold text-[#5C5468] mb-2">이미지 분석</h3>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                                {([
                                    ['피사체', result.subject],
                                    ['화풍', result.style],
                                    ['구도', result.composition],
                                    ['조명', result.lighting],
                                    ['색감', result.color],
                                    ['분위기', result.mood],
                                    ['비율', result.aspectRatio],
                                ] as const).map(([k, v]) => (
                                    <div key={k} className="flex gap-2 min-w-0">
                                        <dt className="text-[#9089A1] shrink-0">{k}</dt>
                                        <dd className="text-[#2D2438] break-words min-w-0">{v}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        {/* ★비로그인 안내(지시 6번) — 차단하지 않고 부드럽게만 */}
                        {quota && !quota.isLoggedIn && (
                            <div className="rounded-2xl bg-indigo-500/10 border border-indigo-200 p-4 text-center">
                                <p className="text-sm text-[#2D2438]">
                                    로그인하면 <b>결과가 보관함에 저장</b>돼요.
                                </p>
                                <p className="text-xs text-[#5C5468] mt-1">
                                    지금은 브라우저를 닫으면 사라져요.
                                </p>
                                <button
                                    onClick={() => setShowAuth(true)}
                                    className="mt-3 text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    로그인하고 저장하기
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* ── 최근 보관 항목 3개(로그인 시, 지시 7번) ── */}
                {loggedIn && recent.length > 0 && !loading && (
                    <section className="mt-8">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-extrabold text-[#5C5468]">최근 보관</h2>
                            <button
                                onClick={() => { window.location.href = '/reverse-prompt/library'; }}
                                className="text-xs font-bold text-indigo-700"
                            >
                                전체 보기 →
                            </button>
                        </div>
                        <div className="space-y-2">
                            {recent.map((it) => (
                                <button
                                    key={it.id}
                                    onClick={() => { window.location.href = '/reverse-prompt/library'; }}
                                    className="w-full flex items-center gap-3 rounded-xl bg-white border border-[#F0E9DE] p-2.5 text-left hover:border-indigo-300"
                                >
                                    {it.thumbnail ? (
                                        <img
                                            src={`data:image/jpeg;base64,${it.thumbnail}`}
                                            alt=""
                                            className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[#F0E9DE]"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-[#F0E9DE] shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-[#2D2438] line-clamp-2 break-words">
                                            {it.mjPreview}
                                        </p>
                                        <p className="text-[11px] text-[#9089A1] mt-0.5">
                                            {new Date(it.createdAt).toLocaleDateString('ko-KR')}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {showAuth && (
                <AuthModal onSuccess={onAuthSuccess} onClose={onAuthClose} />
            )}
        </div>
    );
};
