import React, { useState, useEffect } from 'react';
import { X, BookOpen, Loader, ChevronRight } from 'lucide-react';
import { webtoonApi, WebtoonEpisode } from '../services/apiService';
import { WebtoonScrollViewer } from './WebtoonScrollViewer';
import { GuideCard } from './GuideCard';

// 웹툰 회차 목록 모달 — 향기 채팅 '웹툰' 진입 시. 회차 선택 → 컷 뷰어(WebtoonViewer)로.
interface Props {
    personaId: string;
    personaName?: string;
    onClose: () => void;
}

const T = {
    bg: '#FBF8F3', card: '#FFFFFF', border: '#E8DDD0',
    ink: '#2D2438', inkSoft: '#6B5F56', inkMute: '#9089A1', accent: '#8E6FB7',
};

export const WebtoonEpisodeList: React.FC<Props> = ({ personaId, personaName, onClose }) => {
    const [list, setList] = useState<WebtoonEpisode[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewerCuts, setViewerCuts] = useState<string[] | null>(null);
    const [viewerTitle, setViewerTitle] = useState('');
    const [loadingId, setLoadingId] = useState<number | null>(null);

    useEffect(() => {
        webtoonApi.list(personaId)
            .then(setList)
            .catch(e => { setError(e?.message || '목록을 불러오지 못했어요.'); setList([]); });
    }, [personaId]);

    const openEpisode = async (ep: WebtoonEpisode) => {
        if (loadingId !== null) return;
        setLoadingId(ep.id); setError(null);
        try {
            const detail = await webtoonApi.get(ep.id);
            if (!detail.cuts || detail.cuts.length === 0) { setError('이 회차는 아직 준비 중이에요.'); return; }
            setViewerCuts(detail.cuts);
            setViewerTitle(`${detail.episodeNo}화 · ${detail.title}`);
        } catch (e: any) { setError(e?.message || '회차를 불러오지 못했어요.'); }
        finally { setLoadingId(null); }
    };

    // 뷰어가 떠 있으면 세로 스크롤 뷰어를 보여줌
    if (viewerCuts) {
        return <WebtoonScrollViewer cuts={viewerCuts} title={viewerTitle} onClose={() => setViewerCuts(null)} />;
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-stretch md:items-center justify-center md:p-4" style={{ background: 'rgba(20,12,30,0.5)' }}>
            <div className="w-full md:max-w-lg h-full md:h-auto md:max-h-[85vh] flex flex-col md:rounded-2xl overflow-hidden shadow-2xl" style={{ background: T.bg }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${T.border}`, background: T.card }}>
                    <div className="flex items-center gap-2">
                        <BookOpen size={17} style={{ color: T.accent }} />
                        <span className="font-bold text-base" style={{ color: T.ink }}>웹툰 {personaName ? `· ${personaName}` : ''}</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18} style={{ color: T.inkMute }} /></button>
                </div>

                {/* 회차 목록 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                    <GuideCard
                        storageKey="guide_webtoon"
                        accent={T.accent}
                        title="웹툰 보는 법"
                        steps={[
                            { emoji: '📖', title: '회차 고르기', desc: '보고 싶은 회차를 누르면 웹툰이 열려요.' },
                            { emoji: '📜', title: '아래로 넘기며 보기', desc: '화면을 위에서 아래로 쭉 내리면서 컷을 봐요.' },
                            { emoji: '✨', title: '다음 화 기다리기', desc: '마지막 컷까지 보면 끝! 새 회차가 올라오면 또 만나요.' },
                        ]}
                    />
                    {list === null ? (
                        <div className="flex items-center justify-center py-16" style={{ color: T.inkMute }}>
                            <Loader size={20} className="animate-spin" /> <span className="ml-2 text-sm">불러오는 중…</span>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="text-center text-sm py-16" style={{ color: T.inkMute }}>아직 연재된 웹툰이 없어요. 곧 찾아올게요 ✨</div>
                    ) : (
                        <div className="space-y-2">
                            {list.map(ep => (
                                <button key={ep.id} onClick={() => openEpisode(ep)} disabled={loadingId !== null}
                                    className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition hover:shadow-md disabled:opacity-60"
                                    style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                    {/* 썸네일 */}
                                    <div className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ width: 56, height: 56, background: '#F0E9F7' }}>
                                        {ep.coverUrl
                                            ? <img src={ep.coverUrl} alt={ep.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <BookOpen size={22} style={{ color: T.accent }} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold" style={{ color: T.accent }}>{ep.episodeNo}화</p>
                                        <p className="text-sm font-bold truncate" style={{ color: T.ink }}>{ep.title}</p>
                                    </div>
                                    {loadingId === ep.id
                                        ? <Loader size={16} className="animate-spin shrink-0" style={{ color: T.accent }} />
                                        : <ChevronRight size={18} className="shrink-0" style={{ color: T.inkMute }} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
