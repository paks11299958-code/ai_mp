import React, { useState, useEffect, useCallback } from 'react';
import { webtoonApi, WebtoonAdminItem } from '../../services/apiService';
import { Icon } from '../Icons';

// 웹툰 관리 탭 — 페르소나별 회차 등록 + 컷 이미지 업로드(순서 조정). 현재 향기(translator) 대상.
const PERSONA_ID = 'translator'; // 향기(필명). 추후 다른 페르소나 확장 시 선택 UI 추가.

const T = {
    accent: '#8E6FB7', accentSoft: 'rgba(142,111,183,0.10)', border: '#E5E7EB',
    ink: '#1F2937', inkSoft: '#6B7280', card: '#FFFFFF', bg: '#F9FAFB',
};

export const WebtoonAdminPanel: React.FC = () => {
    const [list, setList] = useState<WebtoonAdminItem[]>([]);
    const [selected, setSelected] = useState<WebtoonAdminItem | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newEp, setNewEp] = useState('');
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        webtoonApi.adminList(PERSONA_ID).then(setList).catch(e => setError(e?.message || '목록 조회 실패'));
    }, []);
    useEffect(() => { load(); }, [load]);

    // 선택 회차 동기화(목록 갱신 후 selected도 최신으로)
    useEffect(() => {
        if (selected) {
            const fresh = list.find(w => w.id === selected.id);
            if (fresh) setSelected(fresh);
        }
    }, [list]);

    const createEpisode = async () => {
        if (!newTitle.trim() || creating) return;
        setCreating(true); setError(null);
        try {
            const ep = Number(newEp) || (list.length ? Math.max(...list.map(w => w.episodeNo)) + 1 : 1);
            const w = await webtoonApi.create(PERSONA_ID, ep, newTitle.trim());
            setNewTitle(''); setNewEp('');
            load();
            setSelected(w);
        } catch (e: any) { setError(e?.message || '생성 실패'); }
        finally { setCreating(false); }
    };

    const removeEpisode = async (id: number) => {
        if (!confirm('이 회차를 삭제할까요? (컷도 함께 사라집니다)')) return;
        try { await webtoonApi.remove(id); if (selected?.id === id) setSelected(null); load(); }
        catch (e: any) { setError(e?.message || '삭제 실패'); }
    };

    // 컷 여러 장 업로드 → cuts 배열에 추가
    const uploadCuts = async (files: FileList) => {
        if (!selected || uploading) return;
        setUploading(true); setError(null);
        try {
            const urls: string[] = [...(selected.cuts || [])];
            for (const f of Array.from(files)) {
                if (!f.type.startsWith('image/')) continue;
                const url = await webtoonApi.uploadCut(selected.id, f);
                urls.push(url);
            }
            const updated = await webtoonApi.update(selected.id, { cuts: urls });
            setSelected(updated); load();
        } catch (e: any) { setError(e?.message || '컷 업로드 실패'); }
        finally { setUploading(false); }
    };

    const saveCuts = async (cuts: string[], extra: any = {}) => {
        if (!selected) return;
        try { const u = await webtoonApi.update(selected.id, { cuts, ...extra }); setSelected(u); load(); }
        catch (e: any) { setError(e?.message || '저장 실패'); }
    };
    const moveCut = (i: number, dir: -1 | 1) => {
        if (!selected) return;
        const cuts = [...selected.cuts]; const j = i + dir;
        if (j < 0 || j >= cuts.length) return;
        [cuts[i], cuts[j]] = [cuts[j], cuts[i]];
        saveCuts(cuts);
    };
    const delCut = (i: number) => {
        if (!selected) return;
        saveCuts(selected.cuts.filter((_, idx) => idx !== i));
    };

    // 마우스 드래그로 컷 순서 옮기기 (HTML5 native DnD)
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    const onDrop = (to: number) => {
        if (!selected || dragIdx === null || dragIdx === to) { setDragIdx(null); setOverIdx(null); return; }
        const cuts = [...selected.cuts];
        const [moved] = cuts.splice(dragIdx, 1);
        cuts.splice(to, 0, moved);
        setDragIdx(null); setOverIdx(null);
        saveCuts(cuts);
    };
    const toggleVisible = async () => {
        if (!selected) return;
        try { const u = await webtoonApi.update(selected.id, { isVisible: !selected.isVisible }); setSelected(u); load(); }
        catch (e: any) { setError(e?.message || '저장 실패'); }
    };

    // 제목·화수 인라인 편집
    const [editingMeta, setEditingMeta] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editEp, setEditEp] = useState('');
    const startEditMeta = () => { if (!selected) return; setEditTitle(selected.title); setEditEp(String(selected.episodeNo)); setEditingMeta(true); };
    const saveMeta = async () => {
        if (!selected || !editTitle.trim()) return;
        try {
            const u = await webtoonApi.update(selected.id, { title: editTitle.trim(), episodeNo: Number(editEp) || selected.episodeNo });
            setSelected(u); setEditingMeta(false); load();
        } catch (e: any) { setError(e?.message || '제목 저장 실패'); }
    };

    return (
        <div className="p-4" style={{ background: T.bg }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: T.ink }}>📖 웹툰 관리 <span className="text-xs font-normal" style={{ color: T.inkSoft }}>(향기 페르소나)</span></h3>
            <p className="text-xs mb-4" style={{ color: T.inkSoft }}>회차를 만들고 컷 이미지를 순서대로 올리세요. 사용자는 향기 채팅의 '웹툰'에서 회차를 골라 좌우로 넘겨봅니다.</p>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

            <div className="flex gap-4 flex-col md:flex-row">
                {/* 좌: 회차 목록 + 새 회차 */}
                <div className="md:w-72 shrink-0">
                    <div className="rounded-xl p-3 mb-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                        <p className="text-xs font-bold mb-2" style={{ color: T.ink }}>새 회차</p>
                        <div className="flex gap-1.5 mb-2">
                            <input value={newEp} onChange={e => setNewEp(e.target.value)} placeholder="화수"
                                className="w-16 text-sm rounded-lg px-2 py-1.5" style={{ border: `1px solid ${T.border}`, color: T.ink, background: '#fff' }} />
                            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="회차 제목"
                                onKeyDown={e => e.key === 'Enter' && createEpisode()}
                                className="flex-1 min-w-0 text-sm rounded-lg px-2 py-1.5" style={{ border: `1px solid ${T.border}`, color: T.ink, background: '#fff' }} />
                        </div>
                        <button onClick={createEpisode} disabled={creating || !newTitle.trim()}
                            className="w-full text-sm font-bold rounded-lg py-2 disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>
                            {creating ? '추가 중…' : '+ 회차 추가'}
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {list.length === 0 && <p className="text-xs text-center py-6" style={{ color: T.inkSoft }}>아직 회차가 없어요.</p>}
                        {list.map(w => (
                            <button key={w.id} onClick={() => setSelected(w)}
                                className="w-full text-left rounded-lg px-3 py-2 flex items-center gap-2"
                                style={{ background: selected?.id === w.id ? T.accentSoft : T.card, border: `1px solid ${selected?.id === w.id ? T.accent : T.border}` }}>
                                <span className="shrink-0 text-[11px] font-bold rounded px-1.5 py-0.5" style={{ background: T.accent, color: '#fff' }}>{w.episodeNo}화</span>
                                <span className="flex-1 text-sm truncate" style={{ color: T.ink }}>{w.title}</span>
                                <span className="text-[10px]" style={{ color: w.isVisible ? '#5BA36A' : '#C62828' }}>{w.isVisible ? '공개' : '숨김'}</span>
                                <span className="text-[10px]" style={{ color: T.inkSoft }}>{w.cuts?.length || 0}컷</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 우: 선택 회차의 컷 관리 */}
                <div className="flex-1 min-w-0">
                    {!selected ? (
                        <div className="rounded-xl p-8 text-center text-sm" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                            왼쪽에서 회차를 선택하거나 새로 만드세요.
                        </div>
                    ) : (
                        <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                {editingMeta ? (
                                    <>
                                        <input value={editEp} onChange={e => setEditEp(e.target.value)} placeholder="화수"
                                            className="w-14 text-sm rounded-lg px-2 py-1" style={{ border: `1px solid ${T.accent}`, color: T.ink, background: '#fff' }} />
                                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="회차 제목"
                                            onKeyDown={e => e.key === 'Enter' && saveMeta()} autoFocus
                                            className="text-sm rounded-lg px-2 py-1" style={{ border: `1px solid ${T.accent}`, color: T.ink, background: '#fff', minWidth: 160 }} />
                                        <button onClick={saveMeta} disabled={!editTitle.trim()} className="text-[11px] font-bold rounded-lg px-2.5 py-1 disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>저장</button>
                                        <button onClick={() => setEditingMeta(false)} className="text-[11px] font-bold rounded-lg px-2.5 py-1" style={{ color: T.inkSoft, border: `1px solid ${T.border}` }}>취소</button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm font-bold" style={{ color: T.ink }}>{selected.episodeNo}화 · {selected.title}</span>
                                        <button onClick={startEditMeta} className="text-[11px] font-bold rounded-lg px-2 py-1" style={{ color: T.accent, background: T.accentSoft }}>✏️ 제목 수정</button>
                                    </>
                                )}
                                <button onClick={toggleVisible} className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ background: selected.isVisible ? '#E8F5E9' : '#FDECEC', color: selected.isVisible ? '#2E7D32' : '#C62828' }}>
                                    {selected.isVisible ? '공개 중 (클릭 시 숨김)' : '숨김 (클릭 시 공개)'}
                                </button>
                                <button onClick={() => removeEpisode(selected.id)} className="ml-auto text-[11px] font-bold rounded-lg px-2.5 py-1" style={{ color: '#C62828', background: '#FDECEC' }}>회차 삭제</button>
                            </div>

                            {/* 컷 업로드 */}
                            <label className="inline-flex items-center gap-1.5 text-sm font-bold rounded-lg cursor-pointer mb-3" style={{ padding: '8px 16px', background: T.accent, color: '#fff', opacity: uploading ? 0.5 : 1 }}>
                                {uploading ? '올리는 중…' : '+ 컷 이미지 올리기 (여러 장 가능)'}
                                <input type="file" accept="image/*" multiple disabled={uploading} className="hidden"
                                    onChange={e => { if (e.target.files?.length) uploadCuts(e.target.files); e.currentTarget.value = ''; }} />
                            </label>

                            {/* 컷 목록 (순서/삭제) */}
                            {selected.cuts.length === 0 ? (
                                <p className="text-xs" style={{ color: T.inkSoft }}>아직 컷이 없어요. 이미지를 순서대로 올려주세요.</p>
                            ) : (
                                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                                    {selected.cuts.map((url, i) => (
                                        <div key={i}
                                            draggable
                                            onDragStart={() => setDragIdx(i)}
                                            onDragOver={e => { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                                            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                                            onDrop={e => { e.preventDefault(); onDrop(i); }}
                                            className="rounded-lg overflow-hidden relative group"
                                            style={{
                                                border: overIdx === i && dragIdx !== null && dragIdx !== i ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                                                opacity: dragIdx === i ? 0.4 : 1,
                                                cursor: 'grab',
                                            }}>
                                            <img src={url} alt={`컷 ${i + 1}`} draggable={false} style={{ width: '100%', height: 150, objectFit: 'cover', pointerEvents: 'none' }} />
                                            <div className="absolute top-1 left-1 text-[10px] font-bold rounded px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{i + 1}</div>
                                            <div className="absolute bottom-1 left-1 right-1 flex gap-1 justify-center">
                                                <button onClick={() => moveCut(i, -1)} disabled={i === 0} className="text-xs font-bold rounded px-2 py-1 disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>◀</button>
                                                <button onClick={() => moveCut(i, 1)} disabled={i === selected.cuts.length - 1} className="text-xs font-bold rounded px-2 py-1 disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>▶</button>
                                                <button onClick={() => delCut(i)} className="text-xs font-bold rounded px-2 py-1" style={{ background: 'rgba(198,40,40,0.92)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-[11px] mt-3" style={{ color: T.inkSoft }}>💡 <b style={{ color: T.accent }}>마우스로 컷을 끌어다 놓으면</b> 순서가 바뀌어요. ◀▶로도 한 칸씩 조정, ✕로 삭제. 첫 컷이 목록 썸네일이 돼요.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
