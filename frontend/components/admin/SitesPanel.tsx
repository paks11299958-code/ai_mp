import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 독립사이트(sites/) 관리 — Hermes가 만든 사이트 목록 + 삭제.
// 목록은 sites/README.md(GitHub) 파싱, 삭제는 큐에 적재 → 서버2 워커가 파일 제거+push.
interface Site { name: string; url: string; desc: string }
const BASE = 'https://aichat.dbzone.kr';

export const resolveSiteUrl = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `${BASE}${url}`;

/** 사이트 화면 썸네일(scripts/site-thumbs.cjs 로 생성, 2026-10-09 사장 "썸네일로 볼 수 있게").
 *  공개 사이트 = sites/_thumbs/<name>.webp, 비공개 사이트 = 같은 비공개 경로의 thumb.webp(관리자 쿠키로만 열림). */
export const siteThumbUrl = (s: { name: string; url: string }) => {
    const m = s.url.match(/^\/api\/admin\/private-sites\/([^/]+)\//);
    return m ? `${BASE}/api/admin/private-sites/${m[1]}/thumb.webp` : `${BASE}/sites/_thumbs/${encodeURIComponent(s.name)}.webp`;
};
const isPrivateSite = (url: string) => url.startsWith('/api/admin/private-sites/');

const SiteThumb: React.FC<{ site: Site; href: string }> = ({ site, href }) => {
    const [failed, setFailed] = useState(false);
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${site.name} 사이트 열기`}
            className="block relative aspect-[16/10] bg-white/5 overflow-hidden rounded-t-xl border-b border-white/10 group">
            {failed
                ? <span className="absolute inset-0 grid place-items-center text-2xl font-bold text-white/30 uppercase">{site.name.slice(0, 2)}</span>
                : <img src={siteThumbUrl(site)} alt="" loading="lazy" onError={() => setFailed(true)}
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />}
            {isPrivateSite(site.url) && <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-amber-200">🔒 비공개</span>}
        </a>
    );
};

export const SitesPanel: React.FC = () => {
    const [sites, setSites] = useState<Site[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);   // 삭제 진행 중인 사이트명
    const [dl, setDl] = useState<string | null>(null);       // 다운로드 진행 중인 사이트명
    const [msg, setMsg] = useState('');

    const load = () => {
        setSites(null); setError(null);
        adminApi.getSites()
            .then(setSites)
            .catch(() => setError('목록을 불러오지 못했어요.'));
    };
    useEffect(load, []);

    // 소스 ZIP 받기 — 새 GitHub 저장소에 올려 Vercel 독립 주소로 서비스하기 위한 사본.
    const download = async (name: string) => {
        setDl(name); setMsg('');
        try {
            await adminApi.downloadSite(name);
            setMsg(`⬇ '${name}.zip' 내려받았어요. 압축을 풀고 README.md의 순서대로 GitHub에 올리면 Vercel에서 새 주소로 배포됩니다.`);
        } catch (e: any) {
            setMsg(`❌ '${name}' 다운로드 실패 — ${e?.message || '다시 시도해 주세요.'}`);
        } finally { setDl(null); }
    };

    const remove = async (name: string) => {
        if (!window.confirm(`'${name}' 사이트를 삭제할까요?\n\n폴더·목록이 제거되고 Vercel에서 내려갑니다. (되돌릴 수 없음)`)) return;
        setBusy(name); setMsg('');
        try {
            const r = await adminApi.deleteSite(name);
            setMsg(r.immediate
                ? `🗑 '${name}' 즉시 삭제 완료 — Vercel 재배포(1~2분) 후 사이트가 내려갑니다.`
                : `🗑 '${name}' 삭제를 큐에 등록했어요(서버2 응답 없음 — 워커가 순차 처리).`);
            setSites(prev => prev?.filter(s => s.name !== name) ?? null);   // 낙관적 제거
        } catch {
            setMsg(`❌ '${name}' 삭제 요청 실패. 다시 시도해 주세요.`);
        } finally { setBusy(null); }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icon name="Globe" size={18} className="text-sky-400" />
                        <h3 className="text-base font-bold text-white">독립사이트 관리</h3>
                    </div>
                    <button onClick={load} className="text-xs text-gray-300 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10">
                        <Icon name="RefreshCw" size={13} /> 새로고침
                    </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">독립 웹사이트 목록입니다. 화면이나 제목을 누르면 사이트가 열립니다.</p>

                {msg && <div className="text-xs text-amber-300 mb-3">{msg}</div>}
                {error && <div className="text-xs text-red-400 py-6 text-center">{error}</div>}
                {sites === null && !error && <div className="text-sm text-gray-500 py-8 text-center">불러오는 중…</div>}
                {sites && sites.length === 0 && <div className="text-sm text-gray-500 py-8 text-center">아직 만든 사이트가 없어요.</div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sites && sites.map(s => {
                        const siteUrl = resolveSiteUrl(s.url);
                        return (
                            <div key={s.name} className="bg-white/5 border border-white/10 rounded-xl flex flex-col min-w-0">
                                <SiteThumb site={s} href={siteUrl} />
                                <div className="p-3.5 flex flex-col gap-2 flex-1 min-w-0">
                                    <a href={siteUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-sm font-bold text-sky-300 hover:underline inline-flex items-center gap-1 break-all">
                                        {s.name} <Icon name="ExternalLink" size={12} />
                                    </a>
                                    {s.desc && <div className="text-xs text-gray-300 leading-relaxed">{s.desc}</div>}
                                    <div className="text-[11px] text-gray-500 font-mono break-all">{siteUrl}</div>
                                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                                        <button onClick={() => download(s.name)} disabled={dl === s.name}
                                            title="소스를 ZIP으로 받아 새 GitHub 저장소 + Vercel로 독립 배포"
                                            className="text-xs font-bold text-sky-300 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-40">
                                            {dl === s.name ? '준비 중…' : '⬇ 소스받기'}
                                        </button>
                                        <button onClick={() => remove(s.name)} disabled={busy === s.name}
                                            className="text-xs font-bold text-red-300 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40">
                                            {busy === s.name ? '삭제 중…' : '🗑 삭제'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
