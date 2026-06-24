import React, { useState, useEffect } from 'react';
import { FEATURES_GRID } from '../MainPageNew';
import { settingsApi } from '../../services/apiService';

// 메인 화면 '오늘의 추천' / '새로운 기능' 카드 구성·순서를 어드민에서 지정.
// - 오늘의 추천: spotlight 목록(자유 구성). '오늘의 추천' 섹션에 노출.
// - 새로운 기능: spotlight 제외 나머지. 지정 순서 앞 + 새 기능 자동 뒤(상위 8개).
// 저장: AppConfig 키 spotlightOrder / newFeaturesOrder (콤마구분 키).

const DEFAULT_SPOTLIGHT = ['webtoon', 'hair', 'siwoon', 'stock'];

type FeatureMini = { key: string; name: string; personaName: string };
const ALL: FeatureMini[] = FEATURES_GRID.map(f => ({ key: f.key, name: f.name, personaName: f.personaName }));
const byKey = (k: string) => ALL.find(f => f.key === k);
const releasedSort = (a: string, b: string) => {
    const fa = FEATURES_GRID.find(f => f.key === a), fb = FEATURES_GRID.find(f => f.key === b);
    return ((fb as any)?.releasedAt || '').localeCompare((fa as any)?.releasedAt || '') || ((fb?.id ?? 0) - (fa?.id ?? 0));
};

export const CardOrderPanel: React.FC = () => {
    const [spotlight, setSpotlight] = useState<string[]>(DEFAULT_SPOTLIGHT);
    const [newFeat, setNewFeat] = useState<string[]>([]);   // 저장된 '새로운 기능' 명시 순서
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    useEffect(() => {
        settingsApi.get()
            .then(s => {
                if (s.spotlightOrder) setSpotlight(s.spotlightOrder.split(',').map(k => k.trim()).filter(Boolean));
                if (s.newFeaturesOrder) setNewFeat(s.newFeaturesOrder.split(',').map(k => k.trim()).filter(Boolean));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // '새로운 기능' 표시 목록 = spotlight 제외 전체. 저장된 순서 우선, 나머지는 출시일순으로 뒤에.
    const newFeatList: string[] = (() => {
        const pool = ALL.filter(f => !spotlight.includes(f.key)).map(f => f.key);
        const picked = newFeat.filter(k => pool.includes(k));
        const rest = pool.filter(k => !picked.includes(k)).sort(releasedSort);
        return [...picked, ...rest];
    })();

    const move = (list: string[], setList: (v: string[]) => void, idx: number, dir: -1 | 1) => {
        const next = [...list];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        setList(next);
    };

    // 추천으로 올리기: spotlight 끝에 추가(newFeat에서는 자동 제외됨).
    const addToSpotlight = (k: string) => {
        setSpotlight(prev => prev.includes(k) ? prev : [...prev, k]);
        setNewFeat(prev => prev.filter(x => x !== k));
    };
    // 추천에서 빼기: spotlight에서 제거 → 새로운 기능으로 내려감.
    const removeFromSpotlight = (k: string) => {
        setSpotlight(prev => prev.filter(x => x !== k));
    };

    const save = async () => {
        setSaving(true);
        setSavedMsg(null);
        try {
            await settingsApi.update({
                spotlightOrder: spotlight.join(','),
                newFeaturesOrder: newFeatList.join(','),
            });
            setSavedMsg('저장되었습니다. (메인 화면 새로고침 시 반영)');
        } catch (e: any) {
            setSavedMsg('저장 실패: ' + (e.message || '오류'));
        } finally {
            setSaving(false);
        }
    };

    const Row = ({ k, idx, list, setList, mode, noteOut }:
        { k: string; idx: number; list: string[]; setList: (v: string[]) => void; mode: 'spotlight' | 'new'; noteOut?: boolean }) => {
        const f = byKey(k);
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: '#fff', borderColor: '#e5e7eb', opacity: noteOut ? 0.5 : 1 }}>
                <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{f?.name ?? k}</span>
                    <span className="text-xs text-gray-400 ml-2">{f?.personaName}</span>
                    {noteOut && <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>미노출</span>}
                </div>
                {/* 추천 추가/빼기 */}
                {mode === 'new'
                    ? <button onClick={() => addToSpotlight(k)} title="오늘의 추천으로 올리기"
                        className="px-2 h-7 rounded-md border text-xs font-medium" style={{ borderColor: '#DDD6FE', color: '#7C3AED', background: '#F5F3FF' }}>＋추천</button>
                    : <button onClick={() => removeFromSpotlight(k)} title="추천에서 빼기"
                        className="px-2 h-7 rounded-md border text-xs font-medium" style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}>－빼기</button>}
                <button onClick={() => move(list, setList, idx, -1)} disabled={idx === 0}
                    className="w-7 h-7 rounded-md border text-gray-600 disabled:opacity-30" style={{ borderColor: '#e5e7eb' }}>↑</button>
                <button onClick={() => move(list, setList, idx, 1)} disabled={idx === list.length - 1}
                    className="w-7 h-7 rounded-md border text-gray-600 disabled:opacity-30" style={{ borderColor: '#e5e7eb' }}>↓</button>
            </div>
        );
    };

    if (loading) return <div className="flex-1 p-6 text-sm text-gray-400">불러오는 중…</div>;

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="max-w-2xl">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-gray-800">메인 카드 순서</h2>
                <button onClick={save} disabled={saving}
                    className="px-5 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-60"
                    style={{ background: '#7C3AED' }}>
                    {saving ? '저장 중…' : '저장'}
                </button>
            </div>
            <p className="text-xs text-gray-500 mb-1">'오늘의 추천'에 넣을 카드는 <b>＋추천</b>, 뺄 카드는 <b>－빼기</b>. ↑↓로 순서 조정 후 저장하세요.</p>
            {savedMsg && <p className="text-xs mb-4" style={{ color: savedMsg.startsWith('저장 실패') ? '#B91C1C' : '#15803D' }}>{savedMsg}</p>}

            {/* 오늘의 추천 */}
            <div className="mb-6 mt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">✨ 오늘의 추천 <span className="text-xs font-normal text-gray-400">({spotlight.length}개)</span></h3>
                <div className="space-y-1.5">
                    {spotlight.length === 0 && <p className="text-xs text-gray-400 px-1">추천 카드가 없습니다. 아래에서 ＋추천으로 추가하세요.</p>}
                    {spotlight.map((k, i) => (
                        <Row key={k} k={k} idx={i} list={spotlight} setList={setSpotlight} mode="spotlight" />
                    ))}
                </div>
            </div>

            {/* 새로운 기능 */}
            <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">🎁 새로운 기능</h3>
                <p className="text-[11px] text-gray-400 mb-2">위쪽일수록 먼저 노출. 새로 추가되는 기능은 자동으로 뒤에 붙습니다(상위 8개 노출, 그 아래는 '미노출').</p>
                <div className="space-y-1.5">
                    {newFeatList.map((k, i) => (
                        <Row key={k} k={k} idx={i} list={newFeatList} setList={setNewFeat} mode="new" noteOut={i >= 8} />
                    ))}
                </div>
            </div>
        </div></div>
    );
};
