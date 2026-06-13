import React, { useState, useEffect, useCallback } from 'react';
import { heroCardApi, HeroCardAdmin } from '../../services/apiService';
import { FEATURE_REGISTRY } from '../../personaFeatures';
import { Persona } from '../../types';
import { Icon } from '../Icons';

// 메인 카드 관리 — 어드민이 카드 이미지를 올려 메인 캐러셀에 노출. 클릭 시 페르소나/기능 이동.
const T = {
    accent: '#8E6FB7', accentSoft: 'rgba(142,111,183,0.10)', border: '#E5E7EB',
    ink: '#1F2937', inkSoft: '#6B7280', card: '#FFFFFF', bg: '#F9FAFB',
};

interface Props { personas: Persona[]; }

export const HeroCardAdminPanel: React.FC<Props> = ({ personas }) => {
    const [list, setList] = useState<HeroCardAdmin[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [uploadingId, setUploadingId] = useState<number | null>(null);

    // 새 카드 입력
    const [newLinkType, setNewLinkType] = useState<'persona' | 'feature'>('persona');
    const [newTarget, setNewTarget] = useState('');
    const [newTitle, setNewTitle] = useState('');

    const load = useCallback(() => {
        heroCardApi.adminList().then(setList).catch(e => setError(e?.message || '목록 조회 실패'));
    }, []);
    useEffect(() => { load(); }, [load]);

    // 연결 대상 라벨(목록 표시용)
    const targetLabel = (c: HeroCardAdmin) => {
        if (c.linkType === 'persona') return personas.find(p => p.id === c.linkTarget)?.name || '(없는 페르소나)';
        return FEATURE_REGISTRY.find(f => f.key === c.linkTarget)?.label || c.linkTarget;
    };

    const createCard = async () => {
        if (!newTarget || creating) return;
        setCreating(true); setError(null);
        try {
            await heroCardApi.create({ linkType: newLinkType, linkTarget: newTarget, title: newTitle.trim() || undefined });
            setNewTarget(''); setNewTitle('');
            load();
        } catch (e: any) { setError(e?.message || '생성 실패'); }
        finally { setCreating(false); }
    };

    const uploadImage = async (id: number, file: File) => {
        if (uploadingId) return;
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올릴 수 있어요.'); return; }
        setUploadingId(id); setError(null);
        try { await heroCardApi.uploadImage(id, file); load(); }
        catch (e: any) { setError(e?.message || '이미지 업로드 실패'); }
        finally { setUploadingId(null); }
    };

    const toggleVisible = async (c: HeroCardAdmin) => {
        if (!c.imageUrl && !c.isVisible) { setError('이미지를 먼저 올려야 공개할 수 있어요.'); return; }
        try { await heroCardApi.update(c.id, { isVisible: !c.isVisible }); load(); }
        catch (e: any) { setError(e?.message || '저장 실패'); }
    };
    const updateTarget = async (c: HeroCardAdmin, linkType: 'persona' | 'feature', linkTarget: string) => {
        try { await heroCardApi.update(c.id, { linkType, linkTarget }); load(); }
        catch (e: any) { setError(e?.message || '저장 실패'); }
    };
    const removeCard = async (id: number) => {
        if (!confirm('이 카드를 삭제할까요?')) return;
        try { await heroCardApi.remove(id); load(); }
        catch (e: any) { setError(e?.message || '삭제 실패'); }
    };

    // 순서 드래그
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    const onDrop = (to: number) => {
        if (dragIdx === null || dragIdx === to) { setDragIdx(null); setOverIdx(null); return; }
        const arr = [...list];
        const [moved] = arr.splice(dragIdx, 1);
        arr.splice(to, 0, moved);
        setList(arr); setDragIdx(null); setOverIdx(null);
        heroCardApi.reorder(arr.map(c => c.id)).catch(() => {});
    };

    return (
        <div className="flex-1 overflow-y-auto p-4" style={{ background: T.bg }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: T.ink }}>🖼️ 메인 카드 관리</h3>
            <p className="text-xs mb-4" style={{ color: T.inkSoft }}>메인 첫 화면 캐러셀에 보일 카드를 직접 등록해요. 카드를 누르면 지정한 페르소나·기능으로 이동해요. <b>카드가 없으면</b> 기존 페르소나·기능 카드가 자동으로 보여요.</p>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

            {/* 새 카드 추가 */}
            <div className="rounded-xl p-3 mb-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-bold mb-2" style={{ color: T.ink }}>새 카드 추가</p>
                <div className="flex gap-1.5 mb-2">
                    <button onClick={() => { setNewLinkType('persona'); setNewTarget(''); }} className="text-[11px] font-bold rounded-lg px-2.5 py-1.5" style={{ background: newLinkType === 'persona' ? T.accent : '#fff', color: newLinkType === 'persona' ? '#fff' : T.inkSoft, border: `1px solid ${T.border}` }}>페르소나로 연결</button>
                    <button onClick={() => { setNewLinkType('feature'); setNewTarget(''); }} className="text-[11px] font-bold rounded-lg px-2.5 py-1.5" style={{ background: newLinkType === 'feature' ? T.accent : '#fff', color: newLinkType === 'feature' ? '#fff' : T.inkSoft, border: `1px solid ${T.border}` }}>기능으로 연결</button>
                </div>
                <select value={newTarget} onChange={e => setNewTarget(e.target.value)}
                    className="w-full text-sm rounded-lg px-2 py-2 mb-2" style={{ border: `1px solid ${T.border}`, color: T.ink, background: '#fff' }}>
                    <option value="">{newLinkType === 'persona' ? '페르소나 선택…' : '기능 선택…'}</option>
                    {newLinkType === 'persona'
                        ? personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                        : FEATURE_REGISTRY.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="카드 이름(관리용, 선택)"
                    className="w-full text-sm rounded-lg px-2 py-2 mb-2" style={{ border: `1px solid ${T.border}`, color: T.ink, background: '#fff' }} />
                <button onClick={createCard} disabled={creating || !newTarget}
                    className="w-full text-sm font-bold rounded-lg py-2 disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>
                    {creating ? '추가 중…' : '+ 카드 추가 (다음에 이미지 올리기)'}
                </button>
            </div>

            {/* 카드 목록 */}
            {list.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: T.inkSoft }}>아직 카드가 없어요. 위에서 추가하세요.</p>
            ) : (
                <div className="space-y-2">
                    {list.map((c, i) => (
                        <div key={c.id}
                            draggable
                            onDragStart={() => setDragIdx(i)}
                            onDragOver={e => { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                            onDrop={e => { e.preventDefault(); onDrop(i); }}
                            className="rounded-xl p-2.5 flex items-center gap-3"
                            style={{ background: T.card, border: `1px solid ${overIdx === i && dragIdx !== null && dragIdx !== i ? T.accent : T.border}`, opacity: dragIdx === i ? 0.4 : 1, cursor: 'grab' }}>
                            {/* 썸네일 */}
                            <div className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ width: 52, height: 80, background: '#F0E9F7', border: `1px solid ${T.border}` }}>
                                {c.imageUrl
                                    ? <img src={c.imageUrl} alt={c.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                                    : <Icon name="Image" size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate" style={{ color: T.ink }}>{c.title || targetLabel(c)}</p>
                                <p className="text-[11px]" style={{ color: T.inkSoft }}>
                                    {c.linkType === 'persona' ? '👤 페르소나' : '⚡ 기능'} · {targetLabel(c)}
                                </p>
                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                    <label className="inline-flex items-center text-[11px] font-bold rounded-lg cursor-pointer" style={{ padding: '4px 9px', background: T.accent, color: '#fff', opacity: uploadingId === c.id ? 0.5 : 1 }}>
                                        {uploadingId === c.id ? '올리는 중…' : (c.imageUrl ? '이미지 바꾸기' : '이미지 올리기')}
                                        <input type="file" accept="image/*" disabled={uploadingId === c.id} className="hidden"
                                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(c.id, f); e.currentTarget.value = ''; }} />
                                    </label>
                                    <button onClick={() => toggleVisible(c)} className="text-[11px] font-bold rounded-lg px-2.5 py-1" style={{ background: c.isVisible ? '#E8F5E9' : '#FDECEC', color: c.isVisible ? '#2E7D32' : '#C62828' }}>
                                        {c.isVisible ? '공개 중' : '숨김'}
                                    </button>
                                    <button onClick={() => removeCard(c.id)} className="text-[11px] font-bold rounded-lg px-2.5 py-1" style={{ color: '#C62828', background: '#FDECEC' }}>삭제</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-[11px] mt-3" style={{ color: T.inkSoft }}>💡 카드 이미지는 <b style={{ color: T.accent }}>세로형(권장 600×930px, 비율 1:1.55)</b>이 가장 잘 맞아요. 마우스로 끌어 순서를 바꿀 수 있어요.</p>
        </div>
    );
};
