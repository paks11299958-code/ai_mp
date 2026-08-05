import React, { useCallback, useEffect, useState } from 'react';
import { shortsApi } from '../../services/apiService';

// 🎂 생일 축하카드 배경 관리 (2026-08-05 사장 지시)
//
// 배경: 축하카드가 단색이라 "화면 분위기가 너무 단조롭다"는 지적으로 배경 6종을
// 신설했는데(칠판·해변·풍선·밤하늘·폴라로이드·생화), 연출을 늘리려면 매번 코드를
// 고쳐야 했다. 사장 지시로 **어드민에서 보고 추가/삭제**할 수 있게 하고,
// [새 스타일 추가]는 AI가 기존과 겹치지 않는 새 연출을 스스로 지어낸다.
//
// ★미리보기는 '저장된 그림'이 아니라 그때그때 새로 생성한 예시다 — 실제 영상에선
//   매번 새로 그려지므로 같은 연출이어도 그림은 매번 다르다. 이 성격을 화면에
//   명시해 "미리보기와 다르게 나왔다"는 오해를 막는다.

interface CardBg {
    key: string;
    label: string;
    prompt: string;
    scrim: boolean;
}

export const ShortsCardBgPanel: React.FC = () => {
    const [items, setItems] = useState<CardBg[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);   // 작업 중인 key 또는 'generate'
    const [preview, setPreview] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState('');
    // AI가 지어낸 새 연출(저장 전 확인용) — 사장이 보고 마음에 들면 저장, 아니면 버린다
    const [candidate, setCandidate] = useState<(CardBg & { image?: string | null }) | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await shortsApi.getCardBgList();
            setItems(r.items ?? []);
        } catch (e: any) {
            setMsg(e?.message ?? '목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const doPreview = async (key: string) => {
        setBusy(key); setMsg('');
        try {
            const r = await shortsApi.previewCardBg(key);
            setPreview(p => ({ ...p, [key]: r.image }));
        } catch (e: any) {
            setMsg(e?.message ?? '미리보기 생성에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const doGenerate = async () => {
        setBusy('generate'); setMsg(''); setCandidate(null);
        try {
            const r = await shortsApi.generateCardBg();
            setCandidate({ ...r.candidate, image: r.image });
            if (r.note) setMsg(r.note);
        } catch (e: any) {
            setMsg(e?.message ?? '새 스타일 생성에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const doSave = async () => {
        if (!candidate) return;
        setBusy('save');
        try {
            await shortsApi.saveCardBg({
                key: candidate.key, label: candidate.label,
                prompt: candidate.prompt, scrim: candidate.scrim,
            });
            setCandidate(null);
            setMsg('추가했습니다.');
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '저장에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    const doDelete = async (bg: CardBg) => {
        if (!window.confirm(`'${bg.label}' 배경을 삭제할까요?\n앞으로 만들어지는 영상에서 이 연출은 나오지 않습니다.`)) return;
        setBusy(bg.key);
        try {
            await shortsApi.deleteCardBg(bg.key);
            setMsg('삭제했습니다.');
            await load();
        } catch (e: any) {
            setMsg(e?.message ?? '삭제에 실패했습니다.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <p className="text-xs font-semibold text-gray-300">🎂 생일 축하카드 배경 ({items.length})</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        영상 마지막 축하 화면의 배경입니다. AI가 대본 분위기에 맞춰 이 중 하나를 고릅니다.
                    </p>
                </div>
                <button
                    onClick={doGenerate}
                    disabled={busy !== null}
                    className="text-xs px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white font-bold disabled:opacity-50"
                >
                    {busy === 'generate' ? 'AI가 만드는 중…' : '+ 새 스타일 추가'}
                </button>
            </div>

            {msg && <p className="text-[11px] text-amber-300">{msg}</p>}

            {/* AI가 지어낸 후보 — 확인 후 저장 */}
            {candidate && (
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-purple-200">AI가 만든 새 스타일 — 확인 후 추가하세요</p>
                    <div className="flex gap-3 flex-wrap">
                        {candidate.image && (
                            <img src={candidate.image} alt="미리보기"
                                 className="w-32 rounded-lg border border-gray-700 shrink-0" />
                        )}
                        <div className="flex-1 min-w-[200px] space-y-1">
                            <p className="text-sm font-bold text-gray-100">{candidate.label}</p>
                            <p className="text-[11px] text-gray-500">{candidate.key} · 밝은배경보정 {candidate.scrim ? 'ON' : 'OFF'}</p>
                            <p className="text-[11px] text-gray-400 leading-relaxed">{candidate.prompt}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={doSave} disabled={busy !== null}
                            className="text-xs px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white font-bold disabled:opacity-50">
                            {busy === 'save' ? '추가 중…' : '이걸로 추가'}
                        </button>
                        <button onClick={doGenerate} disabled={busy !== null}
                            className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50">
                            다시 만들기
                        </button>
                        <button onClick={() => setCandidate(null)} disabled={busy !== null}
                            className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 disabled:opacity-50">
                            취소
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="text-xs text-gray-500 py-4 text-center">불러오는 중…</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(bg => (
                        <div key={bg.key} className="bg-gray-900/60 border border-gray-700 rounded-lg p-2.5 flex gap-2.5">
                            <div className="w-20 shrink-0">
                                {preview[bg.key] ? (
                                    <img src={preview[bg.key]} alt={bg.label}
                                         className="w-20 rounded border border-gray-700" />
                                ) : (
                                    <button onClick={() => doPreview(bg.key)} disabled={busy !== null}
                                        className="w-20 h-32 rounded border border-dashed border-gray-600 text-[10px]
                                                   text-gray-500 hover:text-gray-300 hover:border-gray-500 disabled:opacity-50">
                                        {busy === bg.key ? '생성 중…' : '미리보기'}
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                                <p className="text-sm font-bold text-gray-100 truncate">{bg.label}</p>
                                <p className="text-[10px] text-gray-600">{bg.key} · 보정 {bg.scrim ? 'ON' : 'OFF'}</p>
                                <p className="text-[11px] text-gray-400 mt-1 line-clamp-3 leading-relaxed">{bg.prompt}</p>
                                <div className="mt-auto pt-1.5 flex gap-1.5">
                                    <button onClick={() => doPreview(bg.key)} disabled={busy !== null}
                                        className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50">
                                        다시 미리보기
                                    </button>
                                    <button onClick={() => doDelete(bg)} disabled={busy !== null}
                                        className="text-[11px] px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 disabled:opacity-50">
                                        삭제
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[10px] text-gray-600 leading-relaxed border-t border-gray-800 pt-2">
                ★미리보기는 <b className="text-gray-500">그때그때 새로 만든 예시</b>입니다 — 실제 영상에서는 매번 다시
                그려지므로 같은 연출이어도 그림은 조금씩 달라집니다. 문구(생일 축하해 / 서명)는 AI가 아니라
                코드가 얹으므로 한글이 깨지거나 이름이 틀릴 일은 없습니다.
            </p>
        </div>
    );
};
