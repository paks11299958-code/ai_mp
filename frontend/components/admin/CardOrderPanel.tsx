import React, { useState, useEffect } from 'react';
import { FEATURES_GRID } from '../MainPageNew';
import { settingsApi } from '../../services/apiService';

// 메인 화면 '오늘의 추천' / '새로운 기능' 카드 순서를 어드민에서 지정.
// 저장: AppConfig 키 spotlightOrder / newFeaturesOrder (콤마구분 키).
// 미지정 카드는 메인에서 출시일 자동순으로 뒤에 붙음(하이브리드).

const DEFAULT_SPOTLIGHT = ['webtoon', 'hair', 'siwoon', 'stock'];

type FeatureMini = { key: string; name: string; personaName: string };
const ALL: FeatureMini[] = FEATURES_GRID.map(f => ({ key: f.key, name: f.name, personaName: f.personaName }));
const byKey = (k: string) => ALL.find(f => f.key === k);

export const CardOrderPanel: React.FC = () => {
    const [spotlight, setSpotlight] = useState<string[]>(DEFAULT_SPOTLIGHT);
    const [newFeat, setNewFeat] = useState<string[]>([]);   // 빈 배열 = 전부 자동(출시일순)
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

    // '새로운 기능' 목록 = spotlight 제외 전체. 저장된 순서 우선, 나머지는 출시일순으로 뒤에.
    const newFeatList: string[] = (() => {
        const pool = ALL.filter(f => !spotlight.includes(f.key)).map(f => f.key);
        const picked = newFeat.filter(k => pool.includes(k));
        const rest = pool
            .filter(k => !picked.includes(k))
            .sort((a, b) => {
                const fa = FEATURES_GRID.find(f => f.key === a), fb = FEATURES_GRID.find(f => f.key === b);
                return ((fb as any)?.releasedAt || '').localeCompare((fa as any)?.releasedAt || '') || ((fb?.id ?? 0) - (fa?.id ?? 0));
            });
        return [...picked, ...rest];
    })();

    const move = (list: string[], setList: (v: string[]) => void, idx: number, dir: -1 | 1) => {
        const next = [...list];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        setList(next);
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

    const Row = ({ k, idx, list, setList, badge }: { k: string; idx: number; list: string[]; setList: (v: string[]) => void; badge?: string }) => {
        const f = byKey(k);
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: '#fff', borderColor: '#e5e7eb' }}>
                <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{f?.name ?? k}</span>
                    <span className="text-xs text-gray-400 ml-2">{f?.personaName}</span>
                    {badge && <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded-full" style={{ background: '#EDE9FE', color: '#7C3AED' }}>{badge}</span>}
                </div>
                <button onClick={() => move(list, setList, idx, -1)} disabled={idx === 0}
                    className="w-7 h-7 rounded-md border text-gray-600 disabled:opacity-30" style={{ borderColor: '#e5e7eb' }}>↑</button>
                <button onClick={() => move(list, setList, idx, 1)} disabled={idx === list.length - 1}
                    className="w-7 h-7 rounded-md border text-gray-600 disabled:opacity-30" style={{ borderColor: '#e5e7eb' }}>↓</button>
            </div>
        );
    };

    if (loading) return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">메인 카드 순서</h2>
            <p className="text-xs text-gray-500 mb-5">메인 화면 '오늘의 추천'과 '새로운 기능' 카드의 노출 순서를 지정합니다. ↑↓로 옮긴 뒤 저장하세요.</p>

            {/* 오늘의 추천 */}
            <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">✨ 오늘의 추천</h3>
                <div className="space-y-1.5">
                    {spotlight.map((k, i) => (
                        <Row key={k} k={k} idx={i} list={spotlight} setList={setSpotlight} />
                    ))}
                </div>
            </div>

            {/* 새로운 기능 */}
            <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-2">🎁 새로운 기능</h3>
                <p className="text-[11px] text-gray-400 mb-2">위쪽에 둘수록 먼저 노출됩니다. 새로 추가되는 기능은 자동으로 뒤에 붙습니다(상위 8개 노출).</p>
                <div className="space-y-1.5">
                    {newFeatList.map((k, i) => (
                        <Row key={k} k={k} idx={i} list={newFeatList} setList={setNewFeat} badge={i < 8 ? undefined : '미노출'} />
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving}
                    className="px-5 py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-60"
                    style={{ background: '#7C3AED' }}>
                    {saving ? '저장 중…' : '저장'}
                </button>
                {savedMsg && <span className="text-xs text-gray-600">{savedMsg}</span>}
            </div>
        </div>
    );
};
