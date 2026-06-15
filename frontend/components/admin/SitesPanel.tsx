import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 독립사이트(sites/) 관리 — Hermes가 만든 사이트 목록 + 삭제.
// 목록은 sites/README.md(GitHub) 파싱, 삭제는 큐에 적재 → 서버2 워커가 파일 제거+push.
interface Site { name: string; url: string; desc: string }
const BASE = 'https://aichat.dbzone.kr';

export const SitesPanel: React.FC = () => {
    const [sites, setSites] = useState<Site[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);   // 삭제 진행 중인 사이트명
    const [msg, setMsg] = useState('');

    const load = () => {
        setSites(null); setError(null);
        adminApi.getSites()
            .then(setSites)
            .catch(() => setError('목록을 불러오지 못했어요.'));
    };
    useEffect(load, []);

    const remove = async (name: string) => {
        if (!window.confirm(`'${name}' 사이트를 삭제할까요?\n\n폴더·목록이 제거되고 Vercel에서 내려갑니다. (되돌릴 수 없음)`)) return;
        setBusy(name); setMsg('');
        try {
            await adminApi.deleteSite(name);
            setMsg(`🗑 '${name}' 삭제를 요청했어요. 1~2분 후 목록을 새로고침하면 사라집니다.`);
            setSites(prev => prev?.filter(s => s.name !== name) ?? null);   // 낙관적 제거
        } catch {
            setMsg(`❌ '${name}' 삭제 요청 실패. 다시 시도해 주세요.`);
        } finally { setBusy(null); }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icon name="Globe" size={18} className="text-sky-400" />
                        <h3 className="text-base font-bold text-white">독립사이트 관리</h3>
                    </div>
                    <button onClick={load} className="text-xs text-gray-300 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10">
                        <Icon name="RefreshCw" size={13} /> 새로고침
                    </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">Hermes가 만든 독립 웹사이트 목록입니다. 제목을 누르면 사이트가 열립니다.</p>

                {msg && <div className="text-xs text-amber-300 mb-3">{msg}</div>}
                {error && <div className="text-xs text-red-400 py-6 text-center">{error}</div>}
                {sites === null && !error && <div className="text-sm text-gray-500 py-8 text-center">불러오는 중…</div>}
                {sites && sites.length === 0 && <div className="text-sm text-gray-500 py-8 text-center">아직 만든 사이트가 없어요.</div>}

                <div className="space-y-2.5">
                    {sites && sites.map(s => (
                        <div key={s.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <a href={`${BASE}${s.url}`} target="_blank" rel="noopener noreferrer"
                                        className="text-sm font-bold text-sky-300 hover:underline inline-flex items-center gap-1">
                                        {s.name} <Icon name="ExternalLink" size={12} />
                                    </a>
                                    <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{BASE}{s.url}</div>
                                    {s.desc && <div className="text-xs text-gray-300 mt-1.5 leading-relaxed">{s.desc}</div>}
                                </div>
                                <button onClick={() => remove(s.name)} disabled={busy === s.name}
                                    className="shrink-0 text-xs font-bold text-red-300 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40">
                                    {busy === s.name ? '삭제 중…' : '🗑 삭제'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
