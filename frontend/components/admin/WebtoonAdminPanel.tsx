import React, { useState, useEffect, useCallback } from 'react';
import { webtoonApi, WebtoonAdminItem, PanelBox, fileToBase64Downscaled } from '../../services/apiService';
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

    // 그리드 이미지 분할 — 큰 만화 페이지를 칸 단위로 잘라 세로 컷으로
    const [gridBase64, setGridBase64] = useState<string | null>(null);
    const [gridMime, setGridMime] = useState<string>('image/png');
    const [gridDims, setGridDims] = useState<{ w: number; h: number } | null>(null);
    const [panels, setPanels] = useState<PanelBox[]>([]);
    const [detecting, setDetecting] = useState(false);
    const [splitting, setSplitting] = useState(false);
    const [splitMode, setSplitMode] = useState<'append' | 'replace'>('append');

    const resetGrid = () => { setGridBase64(null); setGridDims(null); setPanels([]); };

    const detectGrid = async (file: File) => {
        if (!selected || detecting) return;
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올릴 수 있어요.'); return; }
        setDetecting(true); setError(null); resetGrid();
        try {
            const { base64, mimeType } = await fileToBase64Downscaled(file, 3000);
            setGridBase64(base64); setGridMime(mimeType);
            const r = await webtoonApi.detectPanels(selected.id, base64, mimeType);
            setGridDims({ w: r.width, h: r.height });
            setPanels(r.boxes);
            if (r.boxes.length === 0) setError('칸을 찾지 못했어요. 다른 이미지를 시도하거나 직접 컷을 올려주세요.');
        } catch (e: any) { setError(e?.message || '칸 감지 실패'); resetGrid(); }
        finally { setDetecting(false); }
    };
    const removePanel = (i: number) => setPanels(prev => prev.filter((_, idx) => idx !== i));
    const confirmSplit = async () => {
        if (!selected || !gridBase64 || panels.length === 0 || splitting) return;
        setSplitting(true); setError(null);
        try {
            const r = await webtoonApi.splitConfirm(selected.id, gridBase64, gridMime, panels, splitMode);
            const u = await webtoonApi.update(selected.id, { cuts: r.cuts });
            setSelected(u); load(); resetGrid();
        } catch (e: any) { setError(e?.message || '분할 저장 실패'); }
        finally { setSplitting(false); }
    };

    // 표지 이미지 업로드/제거 (목록 썸네일용. 안 올리면 첫 컷이 자동 썸네일)
    const [coverUploading, setCoverUploading] = useState(false);
    const uploadCover = async (file: File) => {
        if (!selected || coverUploading) return;
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올릴 수 있어요.'); return; }
        setCoverUploading(true); setError(null);
        try {
            const url = await webtoonApi.uploadCut(selected.id, file); // 같은 업로드 엔드포인트 재사용
            const u = await webtoonApi.update(selected.id, { coverUrl: url });
            setSelected(u); load();
        } catch (e: any) { setError(e?.message || '표지 업로드 실패'); }
        finally { setCoverUploading(false); }
    };
    const removeCover = async () => {
        if (!selected || coverUploading) return;
        setCoverUploading(true); setError(null);
        try {
            // 표지를 지우면 첫 컷으로 되돌림(첫 컷도 없으면 null). 표지 없을 때 첫 컷이 썸네일.
            const fallback = selected.cuts[0] ?? null;
            const u = await webtoonApi.update(selected.id, { coverUrl: fallback });
            setSelected(u); load();
        } catch (e: any) { setError(e?.message || '표지 제거 실패'); }
        finally { setCoverUploading(false); }
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

                            {/* 표지 (목록 썸네일용. 안 올리면 첫 컷 자동) */}
                            <div className="rounded-xl p-3 mb-3 flex items-center gap-3" style={{ background: '#F9FAFB', border: `1px solid ${T.border}` }}>
                                <div className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ width: 60, height: 80, background: '#F0E9F7', border: `1px solid ${T.border}` }}>
                                    {selected.coverUrl
                                        ? <img src={selected.coverUrl} alt="표지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : (selected.cuts[0]
                                            ? <img src={selected.cuts[0]} alt="첫 컷(자동)" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                            : <Icon name="BookOpen" size={20} />)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold mb-0.5" style={{ color: T.ink }}>회차 표지 <span className="font-normal" style={{ color: T.inkSoft }}>{selected.coverUrl ? '(직접 등록됨)' : '(미등록 → 첫 컷 자동)'}</span></p>
                                    <p className="text-[11px] mb-1.5" style={{ color: T.inkSoft }}>목록에 보이는 썸네일이에요. 제목 박힌 커버 등 따로 올릴 수 있어요.</p>
                                    <div className="flex gap-1.5">
                                        <label className="inline-flex items-center text-[11px] font-bold rounded-lg cursor-pointer" style={{ padding: '5px 11px', background: T.accent, color: '#fff', opacity: coverUploading ? 0.5 : 1 }}>
                                            {coverUploading ? '올리는 중…' : (selected.coverUrl ? '표지 바꾸기' : '표지 올리기')}
                                            <input type="file" accept="image/*" disabled={coverUploading} className="hidden"
                                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.currentTarget.value = ''; }} />
                                        </label>
                                        {selected.coverUrl && (
                                            <button onClick={removeCover} disabled={coverUploading} className="text-[11px] font-bold rounded-lg disabled:opacity-40" style={{ padding: '5px 11px', color: '#C62828', background: '#FDECEC' }}>표지 제거</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 그리드 이미지 분할 — 큰 만화 페이지를 칸 단위로 잘라 세로 컷으로 */}
                            <div className="rounded-xl p-3 mb-3" style={{ background: '#F4F0FA', border: `1px solid ${T.accent}` }}>
                                <p className="text-xs font-bold mb-0.5" style={{ color: T.ink }}>✂️ 그리드 이미지 자동 분할</p>
                                <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>여러 칸이 든 만화 페이지를 올리면 <b style={{ color: T.accent }}>칸(네모) 경계를 찾아 한 장면씩 잘라</b> 컷으로 추가해요. 그림은 원본 그대로(다시 그리지 않음).</p>
                                <label className="inline-flex items-center gap-1.5 text-sm font-bold rounded-lg cursor-pointer" style={{ padding: '7px 14px', background: T.accent, color: '#fff', opacity: detecting ? 0.5 : 1 }}>
                                    {detecting ? '칸 감지 중…' : '그리드 이미지 올려서 칸 감지'}
                                    <input type="file" accept="image/*" disabled={detecting} className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) detectGrid(f); e.currentTarget.value = ''; }} />
                                </label>

                                {/* 감지 결과 미리보기: 원본에 박스 오버레이 */}
                                {gridBase64 && gridDims && (
                                    <div className="mt-3">
                                        <p className="text-[11px] mb-1.5" style={{ color: T.ink }}>
                                            감지된 칸 <b style={{ color: T.accent }}>{panels.length}개</b> · 박스의 <b>✕</b>로 잘못된 칸을 빼고, 아래에서 확정하세요.
                                        </p>
                                        <div className="relative inline-block max-w-full rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                                            <img src={`data:${gridMime};base64,${gridBase64}`} alt="그리드 원본" style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
                                            {/* 박스 오버레이 (원본 비율 → % 환산) */}
                                            {panels.map((b, i) => (
                                                <div key={i} className="absolute flex items-start justify-between" style={{
                                                    left: `${(b.x / gridDims.w) * 100}%`, top: `${(b.y / gridDims.h) * 100}%`,
                                                    width: `${(b.w / gridDims.w) * 100}%`, height: `${(b.h / gridDims.h) * 100}%`,
                                                    border: `2px solid ${T.accent}`, background: 'rgba(142,111,183,0.12)',
                                                }}>
                                                    <span className="text-[10px] font-bold m-0.5 rounded px-1" style={{ background: T.accent, color: '#fff' }}>{i + 1}</span>
                                                    <button onClick={() => removePanel(i)} className="text-[10px] font-bold m-0.5 rounded px-1" style={{ background: 'rgba(198,40,40,0.92)', color: '#fff' }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                                                <button onClick={() => setSplitMode('append')} className="text-[11px] font-bold px-2.5 py-1" style={{ background: splitMode === 'append' ? T.accent : '#fff', color: splitMode === 'append' ? '#fff' : T.inkSoft }}>기존 컷 뒤에 추가</button>
                                                <button onClick={() => setSplitMode('replace')} className="text-[11px] font-bold px-2.5 py-1" style={{ background: splitMode === 'replace' ? T.accent : '#fff', color: splitMode === 'replace' ? '#fff' : T.inkSoft }}>전체 교체</button>
                                            </div>
                                            <button onClick={confirmSplit} disabled={splitting || panels.length === 0}
                                                className="text-sm font-bold rounded-lg disabled:opacity-40" style={{ padding: '7px 16px', background: '#5BA36A', color: '#fff' }}>
                                                {splitting ? '자르고 올리는 중…' : `이 ${panels.length}컷으로 추가`}
                                            </button>
                                            <button onClick={resetGrid} className="text-[11px] font-bold rounded-lg px-2.5 py-1" style={{ color: T.inkSoft, border: `1px solid ${T.border}` }}>취소</button>
                                        </div>
                                    </div>
                                )}
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
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
                                            <img src={url} alt={`컷 ${i + 1}`} draggable={false} style={{ width: '100%', height: 180, objectFit: 'cover', pointerEvents: 'none' }} />
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
