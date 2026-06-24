import React, { useState, useEffect, useRef } from 'react';
import { FEATURES_GRID } from '../MainPageNew';
import { settingsApi } from '../../services/apiService';

// 메인 화면 카드 구성을 어드민에서 지정. 하위 탭 2개:
//  ① 오늘의 추천(spotlightOrder, 최대 8)  ② 새로운 기능(newFeaturesOrder)
// 각 탭 = 좌우 드래그 보드: 왼쪽(미선택) → 오른쪽(표시할 카드, 순서).
// 저장: AppConfig 콤마구분 키.

const DEFAULT_SPOTLIGHT = ['webtoon', 'hair', 'siwoon', 'stock'];
const SPOTLIGHT_MAX = 8;

type FeatureMini = { key: string; name: string; personaName: string };
const ALL: FeatureMini[] = FEATURES_GRID.map(f => ({ key: f.key, name: f.name, personaName: f.personaName }));
const byKey = (k: string) => ALL.find(f => f.key === k);
const ALL_KEYS = ALL.map(f => f.key);
const releasedSort = (a: string, b: string) => {
    const fa = FEATURES_GRID.find(f => f.key === a), fb = FEATURES_GRID.find(f => f.key === b);
    return ((fb as any)?.releasedAt || '').localeCompare((fa as any)?.releasedAt || '') || ((fb?.id ?? 0) - (fa?.id ?? 0));
};

// ── 좌우 드래그 보드(한 탭). right = 표시할 카드 순서. ──────────────
// ★ Card/Zone을 컴포넌트 함수 안에서 정의하면 리렌더마다 재생성돼 드래그가
//   끊긴다 → 전부 인라인 렌더로 둔다.
const DragBoard: React.FC<{ right: string[]; onChange: (right: string[]) => void; rightLabel: string; maxRight?: number }> =
    ({ right, onChange, rightLabel, maxRight }) => {
        const left = ALL_KEYS.filter(k => !right.includes(k)).sort(releasedSort);
        const dragKey = useRef<string | null>(null);
        const dragFrom = useRef<'left' | 'right' | null>(null);
        const [overZone, setOverZone] = useState<'left' | 'right' | null>(null);
        const [overIdx, setOverIdx] = useState<number>(-1);
        const [warn, setWarn] = useState<string | null>(null);

        const start = (zone: 'left' | 'right', key: string, e: React.DragEvent) => {
            dragKey.current = key;
            dragFrom.current = zone;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', key);   // 일부 브라우저는 setData 없으면 드래그 시작 안 함
        };
        const end = () => { dragKey.current = null; dragFrom.current = null; setOverZone(null); setOverIdx(-1); };

        // toZone/toIdx 위치에 드롭. toIdx=-1이면 영역 끝.
        const drop = (toZone: 'left' | 'right', toIdx: number) => {
            const key = dragKey.current;
            const from = dragFrom.current;
            end();
            if (!key) return;
            if (toZone === 'right') {
                const isNew = !right.includes(key);
                if (isNew && maxRight != null && right.length >= maxRight) {
                    setWarn(`최대 ${maxRight}개까지만 표시할 수 있어요.`);
                    setTimeout(() => setWarn(null), 2500);
                    return;
                }
                const next = right.filter(k => k !== key);
                const at = toIdx < 0 ? next.length : Math.min(toIdx, next.length);
                next.splice(at, 0, key);
                onChange(next);
            } else {
                // 왼쪽으로 = 표시에서 제외(우→좌). 좌→좌는 무시.
                if (from === 'right') onChange(right.filter(k => k !== key));
            }
        };

        const renderCard = (zone: 'left' | 'right', k: string, i: number) => {
            const f = byKey(k);
            const isOver = overZone === zone && overIdx === i;
            return (
                <div
                    key={k}
                    draggable
                    onDragStart={(e) => start(zone, k, e)}
                    onDragOver={(e) => { e.preventDefault(); if (overZone !== zone || overIdx !== i) { setOverZone(zone); setOverIdx(i); } }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(zone, i); }}
                    onDragEnd={end}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-grab active:cursor-grabbing select-none"
                    style={{ background: '#fff', borderColor: isOver ? '#7C3AED' : '#e5e7eb', boxShadow: isOver ? '0 0 0 2px rgba(124,58,237,0.25)' : 'none' }}
                >
                    <span className="text-gray-300">⠿</span>
                    {zone === 'right' && <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>}
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{f?.name ?? k}</span>
                        <span className="text-xs text-gray-400 ml-2">{f?.personaName}</span>
                    </div>
                </div>
            );
        };

        const renderZone = (zone: 'left' | 'right', keys: string[], label: string, hint: string) => (
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-600 mb-1.5">{label} <span className="font-normal text-gray-400">({keys.length}{zone === 'right' && maxRight ? `/${maxRight}` : ''})</span></div>
                <div
                    onDragOver={(e) => { e.preventDefault(); if (overZone !== zone || overIdx !== -1) { setOverZone(zone); setOverIdx(-1); } }}
                    onDrop={(e) => { e.preventDefault(); drop(zone, -1); }}
                    className="rounded-lg p-2 space-y-1.5"
                    style={{ minHeight: 200, background: zone === 'right' ? '#F5F3FF' : '#F9FAFB', border: `1px dashed ${overZone === zone && overIdx === -1 ? '#7C3AED' : '#e5e7eb'}` }}
                >
                    {keys.length === 0 && <p className="text-[11px] text-gray-400 text-center py-10">{hint}</p>}
                    {keys.map((k, i) => renderCard(zone, k, i))}
                </div>
            </div>
        );

        return (
            <>
                {warn && <p className="text-xs mb-2" style={{ color: '#B91C1C' }}>{warn}</p>}
                <div className="flex gap-3">
                    {renderZone('left', left, '모든 기능', '여기로 끌면 표시에서 제외')}
                    {renderZone('right', right, rightLabel, '왼쪽에서 카드를 끌어다 놓으세요')}
                </div>
            </>
        );
    };

export const CardOrderPanel: React.FC = () => {
    const [tab, setTab] = useState<'spotlight' | 'new'>('spotlight');
    const [spotlight, setSpotlight] = useState<string[]>(DEFAULT_SPOTLIGHT);
    const [newFeat, setNewFeat] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    useEffect(() => {
        settingsApi.get()
            .then(s => {
                const sp = s.spotlightOrder ? s.spotlightOrder.split(',').map(k => k.trim()).filter(Boolean) : DEFAULT_SPOTLIGHT;
                setSpotlight(sp);
                if (s.newFeaturesOrder) setNewFeat(s.newFeaturesOrder.split(',').map(k => k.trim()).filter(Boolean));
                else setNewFeat(ALL_KEYS.filter(k => !sp.includes(k)).sort(releasedSort));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // 새로운 기능 오른쪽 = 추천에 든 카드는 자동 제외.
    const newRight = newFeat.filter(k => !spotlight.includes(k));

    const setSpotlightAndSync = (next: string[]) => {
        setSpotlight(next);
        setNewFeat(prev => {
            const cleaned = prev.filter(k => !next.includes(k));
            const released = ALL_KEYS.filter(k => !next.includes(k) && !cleaned.includes(k)).sort(releasedSort);
            return [...cleaned, ...released];
        });
    };

    const save = async () => {
        setSaving(true);
        setSavedMsg(null);
        try {
            await settingsApi.update({ spotlightOrder: spotlight.join(','), newFeaturesOrder: newRight.join(',') });
            setSavedMsg('저장되었습니다. (메인 화면 새로고침 시 반영)');
        } catch (e: any) {
            setSavedMsg('저장 실패: ' + (e.message || '오류'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex-1 p-6 text-sm text-gray-400">불러오는 중…</div>;

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="max-w-3xl">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-gray-800">메인 카드 순서</h2>
                <button onClick={save} disabled={saving}
                    className="px-5 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>
                    {saving ? '저장 중…' : '저장'}
                </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">왼쪽 '모든 기능'에서 카드를 <b>마우스로 끌어</b> 오른쪽에 놓으면 메인에 표시됩니다. 오른쪽 카드 위에 끌어다 놓으면 그 자리에 끼워집니다.</p>
            {savedMsg && <p className="text-xs mb-3" style={{ color: savedMsg.startsWith('저장 실패') ? '#B91C1C' : '#15803D' }}>{savedMsg}</p>}

            <div className="flex gap-1 mb-4 border-b border-gray-200">
                {([['spotlight', '✨ 오늘의 추천'], ['new', '🎁 새로운 기능']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                        className="px-4 py-2 text-sm font-medium border-b-2 -mb-px"
                        style={{ borderColor: tab === key ? '#7C3AED' : 'transparent', color: tab === key ? '#7C3AED' : '#9CA3AF' }}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'spotlight'
                ? <DragBoard right={spotlight} onChange={setSpotlightAndSync} rightLabel="✨ 오늘의 추천에 표시" maxRight={SPOTLIGHT_MAX} />
                : <DragBoard right={newRight} onChange={setNewFeat} rightLabel="🎁 새로운 기능에 표시" />}
        </div></div>
    );
};
