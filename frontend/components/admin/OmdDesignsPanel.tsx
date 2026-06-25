import React, { useState, useEffect } from 'react';

// 'omd 디자인' 패널 — /design(텔레그램) 또는 omd로 생성된 sites/designs/ 디자인 목록.
// manifest.json(빌드 시 자동 생성)을 읽어 카드 + iframe 썸네일 + 새탭 열기.

interface DesignEntry { slug: string; title: string; createdAt: string; url: string; }

export const OmdDesignsPanel: React.FC = () => {
    const [designs, setDesigns] = useState<DesignEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/designs-manifest.json?cb=${Date.now()}`)
            .then(r => { if (!r.ok) throw new Error('목록을 불러오지 못했어요 (아직 배포 전일 수 있어요)'); return r.json(); })
            .then(d => setDesigns(d.designs || []))
            .catch(e => { setError(e.message); setDesigns([]); });
    }, []);

    const fmtDate = (iso: string) => {
        try { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
        catch { return ''; }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-gray-100">🎨 omd 디자인</h2>
                <button onClick={() => { setDesigns(null); setError(null); fetch(`/designs-manifest.json?cb=${Date.now()}`).then(r => r.json()).then(d => setDesigns(d.designs || [])).catch(() => setDesigns([])); }}
                    className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)', color: '#C4A9E0', border: '1px solid rgba(196,169,224,0.3)' }}>
                    새로고침
                </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">텔레그램 <code className="text-purple-300">/design</code> 또는 omd로 만든 디자인 목록입니다. 카드를 누르면 새 탭에서 크게 볼 수 있어요.</p>

            {error && <p className="text-xs text-amber-400 mb-3">{error}</p>}

            {designs === null ? (
                <p className="text-sm text-gray-400 py-10 text-center">불러오는 중…</p>
            ) : designs.length === 0 ? (
                <p className="text-sm text-gray-400 py-10 text-center">아직 만든 디자인이 없어요.<br />텔레그램에서 <code className="text-purple-300">/design 토스 스타일 홈 화면</code> 처럼 요청해보세요.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {designs.map(d => (
                        <a key={d.slug} href={d.url} target="_blank" rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden border transition hover:shadow-lg group"
                            style={{ background: '#1f2330', borderColor: '#374151' }}>
                            {/* iframe 썸네일 — 클릭 가로채지 않게 pointer-events none, 390px를 0.5배 축소 */}
                            <div className="relative overflow-hidden" style={{ height: 220, background: '#fff' }}>
                                <iframe src={d.url} title={d.title} scrolling="no"
                                    style={{ width: 780, height: 440, border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }} />
                                <div className="absolute inset-0" style={{ background: 'transparent' }} />
                            </div>
                            <div className="p-3">
                                <div className="text-sm font-medium text-gray-100 truncate" title={d.title}>{d.title}</div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[11px] text-gray-500">{fmtDate(d.createdAt)}</span>
                                    <span className="text-[11px] text-purple-300 group-hover:underline">새 탭에서 열기 ↗</span>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};
