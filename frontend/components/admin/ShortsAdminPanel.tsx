import React, { useState, useEffect, useCallback, useRef } from 'react';
import { shortsApi, ShortsQueueItem, ShortsStatus, shortsMakerAdminApi, UserShortsAdminRow } from '../../services/apiService';
import { Icon } from '../Icons';

// 드롭다운에 표시할 한글 기능카드 명칭 — agent-api KNOWN_TOPICS(영문 키)와 1:1 대응.
// 새 소재 추가 시 agent-api/routers/shorts.py의 KNOWN_TOPICS와 함께 여기도 갱신.
const TOPIC_LABELS: Record<string, string> = {
    hair: 'AI 헤어스타일 시뮬레이션',
    outfit: 'AI 프로필 사진 만들기',
    lookalike: '연예인 매칭(닮은꼴 찾기)',
    agetransform: '시간여행(나이 변환)',
    mathtutor: 'AI쌤(수학 문제 풀이)',
    hotkeyword: '핫쇼핑키워드',
    'golf-swing': '골프 스윙 분석',
    ebook: '전자책 만들기',
    used: '중고거래 판매글 작성',
    luxury: '명품 진위 감정',
    insurance: '보험 분석 컨설팅',
    club: '모임 출석 관리',
    news: '오늘뉴스',
    stock: '주식 분석',
    marketing: 'AI 마케팅 글쓰기',
    homepage: '홈페이지 만들기',
    learn: '학습자료',
    webtoon: 'AI 웹툰',
    tarot: '타로 리딩',
};

// 회원용 UserShorts 상태 라벨 — ShortsMakerBoard.tsx의 STATUS_LABEL과 동일 매핑(중복 정의,
// 두 파일이 다른 목적이라 공유 모듈로 안 뺌).
const STATUS_LABEL: Record<string, string> = {
    pending: '시나리오 준비 중', processing_research: '시나리오 준비 중',
    scenarios_ready: '선택 대기', producing: '영상 제작 중', processing_produce: '영상 제작 중',
    done: '완성', failed: '실패',
};

// 언어 코드 라벨 — ShortsMakerBoard.tsx의 LANGUAGES와 동일 매핑(다국어 폰트 검수용,
// 2026-07-25 사장 지시로 나라별 완성본을 이 패널에서 구분해 볼 수 있어야 함).
const LANGUAGE_LABEL: Record<string, string> = {
    ko: '한국어', zh: '중국어', ja: '일본어', en: '영어', vi: '베트남어',
};

// 카테고리 라벨 — ShortsMakerBoard.tsx의 CATEGORIES와 동일 매핑(카테고리 5종 도입,
// 2026-07-25 사장 지시).
const CATEGORY_LABEL: Record<string, string> = {
    community: '커뮤니티', product: '제품·상품', insight: '지식·인사이트',
    wellness: '웰니스', meme: '밈·POV',
};

// 유튜브 쇼츠 승인 큐 관리 — 서버2 shorts-factory(Python) 파이프라인을
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
    const [status, setStatus] = useState<ShortsStatus | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // ★품질 검수용 임시 상태(안정화되면 제거) — 회원 쇼츠 목록+완성영상
    const [memberRows, setMemberRows] = useState<UserShortsAdminRow[]>([]);
    const [memberVideoId, setMemberVideoId] = useState<number | null>(null);

    const loadQueue = useCallback(() => {
        return shortsApi.getQueue()
            .then(d => { setPending(d.pending); setApproved(d.approved); setRejected(d.rejected); })
            .catch(() => {});
    }, []);

    const loadStatus = useCallback(() => {
        return shortsApi.getStatus()
            .then(d => { setStatus(d); setStatusError(null); })
            .catch(e => { setStatus(null); setStatusError(e.message || '조회 실패'); });
    }, []);

    const loadMemberRows = useCallback(() => {
        return shortsMakerAdminApi.list().then(setMemberRows).catch(() => {});
    }, []);

    useEffect(() => {
        shortsApi.getTopics().then(d => { setTopics(d.topics); setSelectedTopic(d.topics[0] || ''); }).catch(() => {});
        loadQueue().finally(() => setLoading(false));
        loadStatus();
        loadMemberRows();
        const statusTimer = setInterval(loadStatus, 30000);   // 30초마다 서버 상태 갱신
        return () => { if (pollRef.current) clearInterval(pollRef.current); clearInterval(statusTimer); };
    }, [loadQueue, loadStatus, loadMemberRows]);

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

    const handleDelete = async (id: string, section: 'approved' | 'rejected') => {
        if (!window.confirm('이 쇼츠를 완전히 삭제할까요? 영상 파일이 지워지며 되돌릴 수 없습니다.')) return;
        setResolvingId(id);
        try {
            await shortsApi.delete(id, section);
            await loadQueue();
        } catch (e: any) {
            alert('삭제 실패: ' + e.message);
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
                {(section === 'approved' || section === 'rejected') && (
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => handleDelete(item.id, section)}
                            disabled={resolvingId === item.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-700 disabled:opacity-60 text-white transition-colors"
                        >
                            🗑 삭제
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
                    <h3 className="text-sm font-bold text-white">쇼츠 관리</h3>
                </div>

                {/* 서버 상태 — 서버2 agent-api 응답성 + 워커 크론 신선도 + 회원용 쇼츠 대기열 */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-400">서버 상태</p>
                    {statusError && (
                        <p className="text-xs text-red-400">🔴 서버2 응답 없음: {statusError}</p>
                    )}
                    {status && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span>{status.agentApi ? '🟢' : '🔴'}</span>
                                <span className="text-gray-300">agent-api</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span>{status.userShortsWorkerLog.exists ? '🟢' : '🟡'}</span>
                                <span className="text-gray-300">
                                    쇼츠만들기 워커
                                    {status.userShortsWorkerLog.ageSeconds != null && (
                                        <span className="text-gray-500"> ({Math.round(status.userShortsWorkerLog.ageSeconds / 60)}분 전)</span>
                                    )}
                                </span>
                            </div>
                            {/* 대기중/완료 분리 표시 — 예전엔 status별 건수를 한 줄에 다 나열해
                                "done 2"가 '대기열' 라벨 아래 보이며 완료건을 대기로 오해하게 함
                                (2026-07-23 사장 실사용 지적). */}
                            <div className="col-span-2 flex items-center gap-2 flex-wrap">
                                <span className="text-gray-300">회원 신청 대기중:</span>
                                {status.userShortsQueue.ok ? (
                                    Object.entries(status.userShortsQueue.waiting || {}).length === 0
                                        ? <span className="text-gray-500">없음</span>
                                        : Object.entries(status.userShortsQueue.waiting || {}).map(([k, v]) => (
                                            <span key={k} className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{k} {v}</span>
                                        ))
                                ) : <span className="text-red-400">DB 조회 실패</span>}
                            </div>
                            <div className="col-span-2 flex items-center gap-2 flex-wrap">
                                <span className="text-gray-300">회원 신청 완료:</span>
                                {status.userShortsQueue.ok ? (
                                    Object.entries(status.userShortsQueue.completed || {}).length === 0
                                        ? <span className="text-gray-500">없음</span>
                                        : Object.entries(status.userShortsQueue.completed || {}).map(([k, v]) => (
                                            <span key={k} className={`px-1.5 py-0.5 rounded text-gray-300 ${k === 'failed' ? 'bg-red-900/60' : 'bg-green-900/60'}`}>{k} {v}</span>
                                        ))
                                ) : <span className="text-red-400">DB 조회 실패</span>}
                            </div>
                        </div>
                    )}
                    {!status && !statusError && <p className="text-xs text-gray-500">불러오는 중…</p>}
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
                            {topics.map(t => <option key={t} value={t}>{TOPIC_LABELS[t] ? `${TOPIC_LABELS[t]} (${t})` : t}</option>)}
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
                        {pending.length === 0 && <p className="text-xs text-gray-600 text-center py-6">승인 대기 중인 쇼츠가 없어요.</p>}
                        {pending.map(item => renderItem(item, 'pending'))}
                    </div>
                </div>

                {/* 승인됨 */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">📤 승인됨/업로드 ({approved.length})</p>
                    <div className="space-y-2">
                        {approved.length === 0 && <p className="text-xs text-gray-600 text-center py-6">아직 승인된 쇼츠가 없어요.</p>}
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

                {/* ★품질 검수용 임시 섹션(2026-07-25 사장 지시) — 회원용 쇼츠 만들기가
                    안정화될 때까지만 완성 영상을 어드민이 직접 볼 수 있게 함. 회원 얼굴 등이
                    담긴 완성물이라 안정화 후엔 이 섹션+관련 API 통째로 제거할 것. */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-400">👤 회원 쇼츠 만들기(검수용, 임시)</p>
                        <button onClick={loadMemberRows} className="text-[10px] text-gray-500 hover:text-gray-300">🔄 새로고침</button>
                    </div>
                    <div className="space-y-2">
                        {memberRows.length === 0 && <p className="text-xs text-gray-600 text-center py-6">회원 신청 내역이 없어요.</p>}
                        {memberRows.map(row => {
                            const label = STATUS_LABEL[row.status] || row.status;
                            const isDone = row.status === 'done';
                            const isFailed = row.status === 'failed';
                            const open = memberVideoId === row.id;
                            return (
                                <div key={row.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                            isFailed ? 'bg-red-900/60 text-red-200' : isDone ? 'bg-green-900/60 text-green-200' : 'bg-gray-700 text-gray-300'
                                        }`}>{label}</span>
                                        <span className="text-sm text-white font-medium truncate">{row.biz || row.topic || '(업종/주제 미입력)'}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-900/60 text-blue-200">
                                            {LANGUAGE_LABEL[row.language] || row.language}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-900/60 text-purple-200">
                                            {CATEGORY_LABEL[row.category] || row.category}
                                        </span>
                                        <span className="text-[10px] text-gray-500 ml-auto">id={row.id} · userId={row.userId}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-600 mb-1">{new Date(row.createdAt).toLocaleString('ko-KR')}</p>
                                    {row.errorMessage && (
                                        <p className="text-[11px] text-red-300 bg-red-950/40 rounded px-2 py-1 mt-1">❌ {row.errorMessage}</p>
                                    )}
                                    {row.hasVideo && (
                                        <button
                                            onClick={() => setMemberVideoId(open ? null : row.id)}
                                            className="text-xs font-medium px-3 py-1.5 mt-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
                                        >
                                            {open ? '영상 닫기' : '▶ 완성 영상 보기'}
                                        </button>
                                    )}
                                    {open && row.hasVideo && (
                                        <video
                                            src={shortsMakerAdminApi.videoUrl(row.id)}
                                            controls
                                            preload="metadata"
                                            className="w-32 h-56 object-cover rounded-lg bg-black mt-2"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
