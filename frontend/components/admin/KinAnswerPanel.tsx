import React, { useEffect, useState } from 'react';
import { kinAnswerApi, type KinKeywordRow, type KinAnswerRow } from '../../services/apiService';
import type { Persona } from '../../types';

// 🛠️ 네이버 지식인 자동 답변 — 뼈대 (2026-07-20 사장 발안).
// 키워드 등록(담당 페르소나 지정) → 서버2 워커가 매일 아침 검색·2단계 답변 생성
// (담당 페르소나 1차 답변 → 강지훈이 사람처럼 재편집) → 텔레그램 승인 요청.
// ★자동 게시 없음 — 사장이 텔레그램에서 답변안을 복사해 직접 지식인에 게시.
// 정본 메모리=[[project_kin_answer]].

const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending:  { label: '승인대기', cls: 'bg-amber-950 text-amber-100' },
    approved: { label: '게시완료', cls: 'bg-green-950 text-green-100' },
    rejected: { label: '반려', cls: 'bg-gray-800 text-gray-300' },
};

function fmtDate(s?: string | null): string {
    if (!s) return '';
    try { return new Date(s).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return s; }
}

export const KinAnswerPanel: React.FC<{ personas: Persona[] }> = ({ personas }) => {
    const [keywords, setKeywords] = useState<KinKeywordRow[]>([]);
    const [answers, setAnswers] = useState<KinAnswerRow[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [newPersonaId, setNewPersonaId] = useState('');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [filterKeywordId, setFilterKeywordId] = useState<number | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);

    const load = React.useCallback(() => {
        setLoading(true);
        Promise.all([kinAnswerApi.keywords(), kinAnswerApi.answers(filterKeywordId ?? undefined)])
            .then(([kw, ans]) => { setKeywords(kw); setAnswers(ans); setErr(''); })
            .catch(e => setErr(e?.message || '목록을 불러오지 못했어요.'))
            .finally(() => setLoading(false));
    }, [filterKeywordId]);
    useEffect(load, [load]);

    const handleAdd = async () => {
        const kw = newKeyword.trim();
        if (!kw) return;
        try {
            await kinAnswerApi.addKeyword(kw, newPersonaId || undefined);
            setNewKeyword(''); setNewPersonaId('');
            load();
        } catch (e: any) {
            setErr(e?.message || '키워드 등록에 실패했어요.');
        }
    };

    const toggleActive = async (row: KinKeywordRow) => {
        try { await kinAnswerApi.updateKeyword(row.id, { active: !row.active }); load(); }
        catch (e: any) { setErr(e?.message || '변경에 실패했어요.'); }
    };

    const handleDelete = async (row: KinKeywordRow) => {
        if (!confirm(`'${row.keyword}' 키워드를 삭제할까요? (이력은 남아있어요)`)) return;
        try { await kinAnswerApi.deleteKeyword(row.id); load(); }
        catch (e: any) { setErr(e?.message || '삭제에 실패했어요.'); }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-white">🔍 네이버 지식인 답변</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        키워드를 등록하면 매일 아침 검색해서 담당 페르소나가 답변안을 만들고,
                        강지훈이 사람처럼 다듬어 텔레그램으로 승인 요청을 보내요. (자동 게시 없음 — 직접 복사해서 올려주세요)
                    </p>
                </div>
                <button onClick={load} className="text-xs font-bold px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800">🔄 새로고침</button>
            </div>

            {err && (
                <div className="bg-red-950 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-100 flex justify-between gap-3">
                    <span>{err}</span>
                    <button onClick={() => setErr('')} className="text-xs font-bold underline flex-shrink-0">닫기</button>
                </div>
            )}

            {/* 키워드 등록 */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-100">검색어 등록</h3>
                <div className="flex gap-2 flex-wrap">
                    <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder="예: 꿈해몽"
                        className="flex-1 min-w-[160px] bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                    <select value={newPersonaId} onChange={e => setNewPersonaId(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
                        <option value="">담당 페르소나 선택(선택)</option>
                        {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={handleAdd} className="text-sm font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">등록</button>
                </div>
            </div>

            {/* 등록된 키워드 목록 */}
            <div className="space-y-2">
                {keywords.map(k => (
                    <div key={k.id} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5">
                        <button onClick={() => setFilterKeywordId(filterKeywordId === k.id ? null : k.id)}
                            className={`text-sm font-bold ${filterKeywordId === k.id ? 'text-indigo-400' : 'text-gray-100'}`}>
                            {k.keyword}
                        </button>
                        <span className="text-xs text-gray-400">{k.personaName || '(페르소나 미지정)'}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${k.active ? 'bg-green-950 text-green-200' : 'bg-gray-700 text-gray-400'}`}>
                            {k.active ? '가동중' : '중지'}
                        </span>
                        <div className="ml-auto flex gap-2">
                            <button onClick={() => toggleActive(k)} className="text-xs font-bold text-gray-300 hover:text-white">
                                {k.active ? '중지' : '재개'}
                            </button>
                            <button onClick={() => handleDelete(k)} className="text-xs font-bold text-red-300 hover:text-red-200">삭제</button>
                        </div>
                    </div>
                ))}
                {keywords.length === 0 && !loading && (
                    <p className="text-sm text-gray-500 py-4 text-center">등록된 검색어가 없어요.</p>
                )}
            </div>

            {/* 답변 이력 */}
            <div>
                <h3 className="text-sm font-bold text-gray-100 mb-2">
                    답변 이력 {filterKeywordId && <span className="text-xs text-gray-400 font-normal">(선택한 키워드만 — 다시 눌러 해제)</span>}
                </h3>
                {loading ? (
                    <p className="text-sm text-gray-500 py-8 text-center">불러오는 중...</p>
                ) : answers.length === 0 ? (
                    <p className="text-sm text-gray-500 py-8 text-center">아직 생성된 답변이 없어요.</p>
                ) : (
                    <div className="space-y-2">
                        {answers.map(a => {
                            const meta = STATUS_META[a.status] || { label: a.status, cls: 'bg-gray-800 text-gray-200' };
                            const open = openId === a.id;
                            return (
                                <div key={a.id} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                                    <button onClick={() => setOpenId(open ? null : a.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700/50">
                                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-md ${meta.cls}`}>{meta.label}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-sm truncate text-gray-100">{a.questionTitle || '(제목 없음)'}</div>
                                            <div className="text-[11px] text-gray-400 truncate">{a.keyword} · {fmtDate(a.createdAt)}</div>
                                        </div>
                                        <span className="text-gray-400 flex-shrink-0">{open ? '▲' : '▼'}</span>
                                    </button>
                                    {open && (
                                        <div className="px-4 pb-4 pt-1 border-t border-gray-700 bg-gray-900/40 text-sm space-y-2 text-gray-200">
                                            <a href={a.questionUrl} target="_blank" rel="noreferrer"
                                                className="text-xs text-indigo-300 underline break-all">{a.questionUrl}</a>
                                            {a.answerDraft && (
                                                <p className="whitespace-pre-wrap text-xs bg-gray-900 rounded-lg p-3">{a.answerDraft}</p>
                                            )}
                                            {a.errorMessage && (
                                                <div className="text-xs text-red-100 bg-red-950 rounded-lg px-3 py-2">❌ {a.errorMessage}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
