import React, { useState, useEffect, useCallback, useRef } from 'react';
import { shortsApi, ShortsQueueItem } from '../../services/apiService';
import { Icon } from '../Icons';

// 유튜브 숏츠 승인 큐 관리 — 서버2 shorts-factory(Python) 파이프라인을
// shared-api /admin/shorts 브릿지를 통해 조회·수동생성·승인/반려한다.
// 실제 대본+TTS+ffmpeg 조립은 수십 초~1분 걸려 동기 응답이 불가능하므로,
// 생성 버튼은 즉시 반환되고 텔레그램에서처럼 이후 폴링으로 pending에 뜨는 걸 확인한다.
export const ShortsAdminPanel: React.FC = () => {
    const [topics, setTopics] = useState<string[]>([]);
    const [selectedTopic, setSelectedTopic] = useState('');
    const [pending, setPending] = useState<ShortsQueueItem[]>([]);
    const [approved, setApproved] = useState<ShortsQueueItem[]>([]);
    const [rejected, setRejected] = useState<ShortsQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadQueue = useCallback(() => {
        return shortsApi.getQueue()
            .then(d => { setPending(d.pending); setApproved(d.approved); setRejected(d.rejected); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        shortsApi.getTopics().then(d => { setTopics(d.topics); setSelectedTopic(d.topics[0] || ''); }).catch(() => {});
        loadQueue().finally(() => setLoading(false));
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [loadQueue]);

    const startPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        let ticks = 0;
        pollRef.current = setInterval(() => {
            ticks++;
            loadQueue();
            if (ticks >= 20 && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } // 최대 ~3분
        }, 8000);
    };

    const handleGenerate = async () => {
        if (!selectedTopic) return;
        setGenerating(true);
        setMsg(null);
        try {
            await shortsApi.generate(selectedTopic);
            setMsg('생성을 시작했어요. 완료되면(약 1~2분) 아래 승인대기 목록에 자동으로 나타납니다.');
            startPolling();
        } catch (e: any) {
            setMsg('생성 요청 실패: ' + e.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleResolve = async (id: string, decision: 'approved' | 'rejected') => {
        setResolvingId(id);
        try {
            await shortsApi.resolve(id, decision);
            await loadQueue();
        } catch (e: any) {
            alert('처리 실패: ' + e.message);
        } finally {
            setResolvingId(null);
        }
    };

    if (loading) return <div className="flex-1 p-6 text-sm text-gray-400">불러오는 중…</div>;

    const renderItem = (item: ShortsQueueItem, section: 'pending' | 'approved' | 'rejected') => (
        <div key={item.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex gap-3">
            <video
                src={shortsApi.videoUrl(item.id)}
                controls
                preload="metadata"
                className="w-24 h-40 object-cover rounded-lg bg-black shrink-0"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 font-medium">{item.topic}</span>
                    {item.decision === 'approved' && item.youtubeUrl && (
                        <a href={item.youtubeUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">유튜브에서 보기 ↗</a>
                    )}
                </div>
                <p className="text-sm text-white font-medium truncate">{item.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                <p className="text-[10px] text-gray-600 mt-1">{new Date(item.createdAt).toLocaleString('ko-KR')}</p>
                {section === 'pending' && (
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => handleResolve(item.id, 'approved')}
                            disabled={resolvingId === item.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white transition-colors"
                        >
                            ✅ 승인
                        </button>
                        <button
                            onClick={() => handleResolve(item.id, 'rejected')}
                            disabled={resolvingId === item.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-700 disabled:opacity-60 text-white transition-colors"
                        >
                            ❌ 반려
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-5">
                <div className="flex items-center gap-2">
                    <Icon name="Play" size={16} className="text-yellow-400" />
                    <h3 className="text-sm font-bold text-white">숏츠 관리</h3>
                </div>

                {/* 수동 생성 */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-400">수동 생성</p>
                    <div className="flex items-center gap-3 flex-wrap">
                        <select
                            value={selectedTopic}
                            onChange={e => setSelectedTopic(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                            {topics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                            onClick={handleGenerate}
                            disabled={generating || !selectedTopic}
                            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                        >
                            {generating ? '요청 중...' : '지금 생성'}
                        </button>
                    </div>
                    {msg && <p className="text-xs text-gray-400">{msg}</p>}
                </div>

                {/* 승인 대기 */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">✅ 승인 대기 ({pending.length})</p>
                    <div className="space-y-2">
                        {pending.length === 0 && <p className="text-xs text-gray-600 text-center py-6">승인 대기 중인 숏츠가 없어요.</p>}
                        {pending.map(item => renderItem(item, 'pending'))}
                    </div>
                </div>

                {/* 승인됨 */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">📤 승인됨/업로드 ({approved.length})</p>
                    <div className="space-y-2">
                        {approved.length === 0 && <p className="text-xs text-gray-600 text-center py-6">아직 승인된 숏츠가 없어요.</p>}
                        {approved.map(item => renderItem(item, 'approved'))}
                    </div>
                </div>

                {/* 반려됨 */}
                {rejected.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">❌ 반려됨 ({rejected.length})</p>
                        <div className="space-y-2">
                            {rejected.map(item => renderItem(item, 'rejected'))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
