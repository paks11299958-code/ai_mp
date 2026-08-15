import React, { useCallback, useEffect, useState } from 'react';
import {
    reversePromptApi,
    isLoggedIn,
    type RpItemSummary,
    type RpItemDetail,
} from './api';
import { RpHeader, PromptBlock, RpError, CopyButton } from './parts';

// 🎨 리버스 프롬프트 S2 — 보관함 (/reverse-prompt/library)
// app/reverse-prompt/PRD.md 5장 S2.
//
// ★로그인 전용이다. 비로그인은 메인으로 돌려보낸다(모달을 띄우지 않는다 —
//   보관함은 로그인 후에만 의미가 있고, PRD 2.1의 로그인 요구 시점은 3회차 업로드다).
// ★목록에는 프롬프트 전문이 없다(서버가 앞 120자만 준다). 항목을 펼칠 때
//   GET /items/:id로 상세를 불러온다(지시 13번).

const PAGE_SIZE = 10;

export const ReversePromptLibrary: React.FC = () => {
    const [items, setItems] = useState<RpItemSummary[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** 펼친 항목의 상세. id → 상세(로딩 중이면 null). */
    const [openId, setOpenId] = useState<string | null>(null);
    const [detail, setDetail] = useState<RpItemDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(async (p: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await reversePromptApi.items(p, PAGE_SIZE);
            setItems(res.items);
            setTotal(res.total);
            setHasNext(res.hasNext);
            setPage(res.page);
        } catch (e) {
            const err = e as { status?: number; message?: string };
            if (err.status === 401) {
                window.location.href = '/reverse-prompt';
                return;
            }
            setError(err.message || '보관함을 불러오지 못했어요.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isLoggedIn()) {
            window.location.href = '/reverse-prompt';
            return;
        }
        void load(1);
    }, [load]);

    // ── 펼치기: 상세를 그때 불러온다 ──────────────────────────────────
    const toggle = useCallback(
        async (id: string) => {
            if (openId === id) {
                setOpenId(null);
                setDetail(null);
                return;
            }
            setOpenId(id);
            setDetail(null);
            setDetailError(null);
            setDetailLoading(true);
            try {
                setDetail(await reversePromptApi.itemDetail(id));
            } catch (e) {
                const err = e as { status?: number; message?: string };
                setDetailError(
                    err.status === 404
                        ? '항목을 찾을 수 없어요. 이미 삭제되었을 수 있어요.'
                        : err.message || '항목을 불러오지 못했어요.',
                );
            } finally {
                setDetailLoading(false);
            }
        },
        [openId],
    );

    // ── 삭제: 확인 후 실행(지시 14번) ─────────────────────────────────
    const remove = useCallback(
        async (id: string) => {
            if (!window.confirm('이 항목을 삭제할까요?\n삭제하면 되돌릴 수 없어요.')) return;
            setDeletingId(id);
            try {
                await reversePromptApi.deleteItem(id);
                if (openId === id) {
                    setOpenId(null);
                    setDetail(null);
                }
                // 마지막 항목을 지워 페이지가 비면 앞 페이지로
                const nextPage = items.length === 1 && page > 1 ? page - 1 : page;
                await load(nextPage);
            } catch (e) {
                setError((e as Error).message || '삭제하지 못했어요.');
            } finally {
                setDeletingId(null);
            }
        },
        [items.length, load, openId, page],
    );

    return (
        <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438]">
            <RpHeader title="🗂️ 보관함" backTo="/reverse-prompt" />

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {loading && (
                    <div className="py-16 text-center">
                        <div className="inline-block w-7 h-7 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                )}

                {error && !loading && (
                    <RpError message={error} onRetry={() => void load(page)} />
                )}

                {/* ★빈 상태 — 신규 사용자가 처음 보는 화면이다.
                    상단에 몰리면 화면이 휑해 보여서 세로 중앙에 놓고, 무엇을 하면 되는지
                    한 줄 더 설명한다(2026-08-15 빈 상태 확인 중 보완). */}
                {!loading && !error && items.length === 0 && (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                        <div className="text-4xl mb-3">🗂️</div>
                        <p className="text-base font-extrabold">아직 보관한 프롬프트가 없어요</p>
                        <p className="text-xs text-[#5C5468] mt-2 leading-relaxed">
                            이미지를 올려 분석하면 결과가 자동으로 여기에 쌓여요.
                            <br />
                            나중에 다시 꺼내 복사하거나 변형해 쓸 수 있어요.
                        </p>
                        <button
                            onClick={() => { window.location.href = '/reverse-prompt'; }}
                            className="mt-5 text-sm font-bold px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            이미지 올리러 가기
                        </button>
                    </div>
                )}

                {!loading && !error && items.length > 0 && (
                    <>
                        <p className="text-xs text-[#9089A1] mb-3">전체 {total}개</p>
                        <div className="space-y-2">
                            {items.map((it) => {
                                const open = openId === it.id;
                                return (
                                    <div
                                        key={it.id}
                                        className="rounded-2xl bg-white border border-[#F0E9DE] overflow-hidden"
                                    >
                                        {/* 목록 행 — 썸네일·생성일·미리보기(지시 12번) */}
                                        <button
                                            onClick={() => void toggle(it.id)}
                                            className="w-full flex items-center gap-3 p-3 text-left"
                                        >
                                            {it.thumbnail ? (
                                                <img
                                                    src={`data:image/jpeg;base64,${it.thumbnail}`}
                                                    alt=""
                                                    className="w-14 h-14 rounded-lg object-cover shrink-0 bg-[#F0E9DE]"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-lg bg-[#F0E9DE] shrink-0" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] text-[#2D2438] line-clamp-2 break-words">
                                                    {it.mjPreview}
                                                </p>
                                                <p className="text-[11px] text-[#9089A1] mt-1">
                                                    {new Date(it.createdAt).toLocaleString('ko-KR', {
                                                        year: 'numeric', month: 'short', day: 'numeric',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                            <span className="text-[#9089A1] text-xs shrink-0">
                                                {open ? '▲' : '▼'}
                                            </span>
                                        </button>

                                        {/* 펼침 — 여기서 상세를 불러온다 */}
                                        {open && (
                                            <div className="border-t border-[#F0E9DE] p-3 space-y-3 bg-[#FBF8F3]">
                                                {detailLoading && (
                                                    <div className="py-6 text-center">
                                                        <div className="inline-block w-6 h-6 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                                    </div>
                                                )}
                                                {detailError && (
                                                    <RpError
                                                        message={detailError}
                                                        onRetry={() => void toggle(it.id)}
                                                    />
                                                )}
                                                {detail && detail.id === it.id && (
                                                    <>
                                                        <PromptBlock title="Midjourney" text={detail.midjourney} />
                                                        <PromptBlock
                                                            title="Stable Diffusion — Positive"
                                                            text={detail.stableDiffusion.positive}
                                                        />
                                                        <PromptBlock
                                                            title="Stable Diffusion — Negative"
                                                            tone="slate"
                                                            text={detail.stableDiffusion.negative}
                                                        />
                                                        <div className="flex items-center justify-between gap-2 pt-1">
                                                            <CopyButton
                                                                text={detail.midjourney}
                                                                label="MJ 전체 복사"
                                                            />
                                                            <button
                                                                onClick={() => void remove(it.id)}
                                                                disabled={deletingId === it.id}
                                                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                                            >
                                                                {deletingId === it.id ? '삭제 중…' : '삭제'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 페이지네이션(지시 15번) */}
                        {(page > 1 || hasNext) && (
                            <div className="flex items-center justify-center gap-3 mt-6">
                                <button
                                    onClick={() => void load(page - 1)}
                                    disabled={page <= 1}
                                    className="text-xs font-bold px-3 py-2 rounded-lg bg-white border border-[#F0E9DE] disabled:opacity-40"
                                >
                                    ← 이전
                                </button>
                                <span className="text-xs text-[#5C5468]">{page}</span>
                                <button
                                    onClick={() => void load(page + 1)}
                                    disabled={!hasNext}
                                    className="text-xs font-bold px-3 py-2 rounded-lg bg-white border border-[#F0E9DE] disabled:opacity-40"
                                >
                                    다음 →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};
