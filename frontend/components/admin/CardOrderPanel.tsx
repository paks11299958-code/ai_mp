import React, { useState, useEffect, useRef } from 'react';
import { FEATURES_GRID } from '../MainPageNew';
import { settingsApi } from '../../services/apiService';

// 메인 화면 카드 구성을 어드민에서 지정. 하위 탭 2개:
//  ① 오늘의 추천(spotlightOrder)   ② 새로운 기능(newFeaturesOrder)
// 각 탭 = 좌우 드래그 보드: 왼쪽(미선택) → 오른쪽(표시할 카드, 순서).
//  - 좌→우 드래그 = 추가, 우→좌 = 제거, 우 내부 드래그 = 순서변경.
// 저장: AppConfig 콤마구분 키.

const DEFAULT_SPOTLIGHT = ['webtoon', 'hair', 'siwoon', 'stock'];

type FeatureMini = { key: string; name: string; personaName: string };
const ALL: FeatureMini[] = FEATURES_GRID.map(f => ({ key: f.key, name: f.name, personaName: f.personaName }));
const byKey = (k: string) => ALL.find(f => f.key === k);
const ALL_KEYS = ALL.map(f => f.key);
const releasedSort = (a: string, b: string) => {
    const fa = FEATURES_GRID.find(f => f.key === a), fb = FEATURES_GRID.find(f => f.key === b);
    return ((fb as any)?.releasedAt || '').localeCompare((fa as any)?.releasedAt || '') || ((fb?.id ?? 0) - (fa?.id ?? 0));
};

// 카드 한 장(드래그 가능)
const Card: React.FC<{
    k: string; idx: number; zone: 'left' | 'right';
    onDragStart: () => void; onDragOverIdx: () => void; onDrop: () => void; onDragEnd: () => void; isOver: boolean;
}> = ({ k, idx, zone, onDragStart, onDragOverIdx, onDrop, onDragEnd, isOver }) => {
    const f = byKey(k);
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={(e) => { e.preventDefault(); onDragOverIdx(); }}
            onDrop={(e) => { e.preventDefault(); onDrop(); }}
            onDragEnd={onDragEnd}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-grab active:cursor-grabbing select-none"
            style={{ background: '#fff', borderColor: isOver ? '#7C3AED' : '#e5e7eb', boxShadow: isOver ? '0 0 0 2px rgba(124,58,237,0.25)' : 'none' }}
        >
            <span className="text-gray-300">⠿</span>
            {zone === 'right' && <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>}
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{f?.name ?? k}</span>
                <span className="text-xs text-gray-400 ml-2">{f?.personaName}</span>
            </div>
        </div>
    );
};

// 좌우 드래그 보드 (한 탭). right = 표시할 카드 순서, onChange로 부모에 알림.
const DragBoard: React.FC<{ right: string[]; onChange: (right: string[]) => void; rightLabel: string }> =
    ({ right, onChange, rightLabel }) => {
        const left = ALL_KEYS.filter(k => !right.includes(k)).sort(releasedSort);
        const drag = useRef<{ zone: 'left' | 'right'; idx: number; key: string } | null>(null);
        const [over, setOver] = useState<{ zone: string; idx: number } | null>(null);

        const handleDrop = (toZone: 'left' | 'right', toIdx: number) => {
            const d = drag.current;
            drag.current = null;
            setOver(null);
            if (!d) return;
            if (toZone === 'right') {
                // 오른쪽으로: 추가(좌→우) 또는 순서변경(우→우)
                const next = right.filter(k => k !== d.key);
                const insertAt = Math.min(toIdx, next.length);
                next.splice(insertAt, 0, d.key);
                onChange(next);
            } else {
                // 왼쪽으로: 제거(우→좌). 좌→좌는 의미 없음(왼쪽은 자동 정렬).
                if (d.zone === 'right') onChange(right.filter(k => k !== d.key));
            }
        };

        const Zone = ({ zone, keys, label, hint }: { zone: 'left' | 'right'; keys: string[]; label: string; hint: string }) => (
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-600 mb-1.5">{label} <span className="font-normal text-gray-400">({keys.length})</span></div>
                <div
                    onDragOver={(e) => { e.preventDefault(); if (!keys.length) setOver({ zone, idx: 0 }); }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(zone, keys.length); }}
                    className="rounded-lg p-2 space-y-1.5 min-h-[120px]"
                    style={{ background: zone === 'right' ? '#F5F3FF' : '#F9FAFB', border: `1px dashed ${over?.zone === zone ? '#7C3AED' : '#e5e7eb'}` }}
                >
                    {keys.length === 0 && <p className="text-[11px] text-gray-400 text-center py-6">{hint}</p>}
                    {keys.map((k, i) => (
                        <Card key={k} k={k} idx={i} zone={zone}
                            onDragStart={() => { drag.current = { zone, idx: i, key: k }; }}
                            onDragOverIdx={() => setOver({ zone, idx: i })}
                            onDrop={() => handleDrop(zone, i)}
                            onDragEnd={() => { drag.current = null; setOver(null); }}
                            isOver={over?.zone === zone && over?.idx === i}
                        />
                    ))}
                </div>
            </div>
        );

        return (
            <div className="flex gap-3">
                <Zone zone="left" keys={left} label="모든 기능" hint="여기로 끌어다 놓으면 표시에서 제외됩니다" />
                <Zone zone="right" keys={right} label={rightLabel} hint="왼쪽에서 카드를 끌어다 놓으세요" />
            </div>
        );
    };

export const CardOrderPanel: React.FC = () => {
    const [tab, setTab] = useState<'spotlight' | 'new'>('spotlight');
    const [spotlight, setSpotlight] = useState<string[]>(DEFAULT_SPOTLIGHT);
    const [newFeat, setNewFeat] = useState<string[]>([]);   // 빈 배열이면 아래 newRight로 기본 채움
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    useEffect(() => {
        settingsApi.get()
            .then(s => {
                const sp = s.spotlightOrder ? s.spotlightOrder.split(',').map(k => k.trim()).filter(Boolean) : DEFAULT_SPOTLIGHT;
                setSpotlight(sp);
                if (s.newFeaturesOrder) setNewFeat(s.newFeaturesOrder.split(',').map(k => k.trim()).filter(Boolean));
                else setNewFeat(ALL_KEYS.filter(k => !sp.includes(k)).sort(releasedSort));  // 기본: 추천 제외 전체
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // 새로운 기능 오른쪽 = 추천에 든 카드는 자동 제외(추천 우선).
    const newRight = newFeat.filter(k => !spotlight.includes(k));

    const setSpotlightAndSync = (next: string[]) => {
        setSpotlight(next);
        // 추천에 새로 들어온 카드는 새기능에서 빠지고, 추천에서 빠진 카드는 새기능에 합류.
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
            <p className="text-xs text-gray-500 mb-3">왼쪽 '모든 기능'에서 카드를 <b>마우스로 끌어</b> 오른쪽에 놓으면 메인에 표시됩니다. 오른쪽 안에서 끌면 순서가 바뀝니다.</p>
            {savedMsg && <p className="text-xs mb-3" style={{ color: savedMsg.startsWith('저장 실패') ? '#B91C1C' : '#15803D' }}>{savedMsg}</p>}

            {/* 하위 탭 */}
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
                ? <DragBoard right={spotlight} onChange={setSpotlightAndSync} rightLabel="✨ 오늘의 추천에 표시" />
                : <DragBoard right={newRight} onChange={setNewFeat} rightLabel="🎁 새로운 기능에 표시" />}
        </div></div>
    );
};
