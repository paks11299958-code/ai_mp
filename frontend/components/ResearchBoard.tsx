import React, { useState, useEffect } from 'react';
import { X, Search, BookOpen, Loader, CheckCircle, AlertCircle, Plus, Trash2, ExternalLink, Clock } from 'lucide-react';

interface ResearchHistory {
    id: number;
    topic: string;
    notebookName: string;
    status: 'pending' | 'running' | 'done' | 'error';
    notebookUrl?: string;
    createdAt: string;
    errorMessage?: string;
}

interface Props {
    onClose: () => void;
    user: any;
}

const API = (path: string) => `/api/research${path}`;

export const ResearchBoard: React.FC<Props> = ({ onClose, user }) => {
    const [topic, setTopic]               = useState('');
    const [notebookName, setNotebookName] = useState('');
    const [history, setHistory]           = useState<ResearchHistory[]>([]);
    const [cookieConnected, setCookieConnected] = useState(false);
    const [cookieUpdatedAt, setCookieUpdatedAt] = useState<string | null>(null);
    const [cookieInput, setCookieInput]   = useState('');
    const [showCookieForm, setShowCookieForm] = useState(false);
    const [running, setRunning]           = useState(false);
    const [msg, setMsg]                   = useState('');
    const [tab, setTab]                   = useState<'research' | 'settings'>('research');

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };

    useEffect(() => {
        fetchHistory();
        fetchCookieStatus();
        const timer = setInterval(fetchHistory, 10_000);
        return () => clearInterval(timer);
    }, []);

    async function fetchHistory() {
        try {
            const res = await fetch(API('/history'), { headers });
            if (res.ok) { const d = await res.json(); setHistory(d.list); }
        } catch {}
    }

    async function fetchCookieStatus() {
        try {
            const res = await fetch(API('/cookies/status'), { headers });
            if (res.ok) {
                const d = await res.json();
                setCookieConnected(d.connected);
                setCookieUpdatedAt(d.updatedAt);
            }
        } catch {}
    }

    async function handleRun() {
        if (!topic.trim()) return setMsg('주제를 입력해주세요');
        setRunning(true); setMsg('');
        try {
            const res = await fetch(API('/run'), {
                method: 'POST', headers,
                body: JSON.stringify({ topic: topic.trim(), notebookName: notebookName.trim() || topic.trim() }),
            });
            const d = await res.json();
            if (res.ok) {
                setMsg('✅ 리서치가 시작됐습니다. 완료되면 이메일로 알려드립니다.');
                setTopic(''); setNotebookName('');
                fetchHistory();
            } else {
                setMsg(`❌ ${d.error}`);
            }
        } catch { setMsg('❌ 서버 오류'); } finally { setRunning(false); }
    }

    async function handleSaveCookies() {
        try {
            const parsed = JSON.parse(cookieInput);
            const cookies = Array.isArray(parsed) ? parsed : [parsed];
            const res = await fetch(API('/cookies'), {
                method: 'POST', headers,
                body: JSON.stringify({ cookies }),
            });
            const d = await res.json();
            if (res.ok) {
                setMsg('✅ NotebookLM 연결됐습니다');
                setCookieInput(''); setShowCookieForm(false);
                fetchCookieStatus();
            } else { setMsg(`❌ ${d.error}`); }
        } catch { setMsg('❌ 쿠키 형식이 올바르지 않습니다 (JSON 배열)'); }
    }

    async function handleDeleteCookies() {
        if (!confirm('NotebookLM 연결을 해제하시겠습니까?')) return;
        await fetch(API('/cookies'), { method: 'DELETE', headers });
        setCookieConnected(false); setCookieUpdatedAt(null);
        setMsg('연결 해제됐습니다');
    }

    const statusBadge = (s: string) => {
        const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
            pending: { label: '대기', color: 'text-gray-400', icon: <Clock size={12} /> },
            running: { label: '진행 중', color: 'text-blue-400', icon: <Loader size={12} className="animate-spin" /> },
            done:    { label: '완료', color: 'text-green-400', icon: <CheckCircle size={12} /> },
            error:   { label: '실패', color: 'text-red-400', icon: <AlertCircle size={12} /> },
        };
        const { label, color, icon } = map[s] || map.pending;
        return <span className={`flex items-center gap-1 text-xs ${color}`}>{icon}{label}</span>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* 헤더 */}
                <div className="flex items-center justify-between p-5 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <BookOpen size={20} className="text-blue-400" />
                        <span className="font-bold text-white">AI 딥 리서치</span>
                        <span className="text-xs text-gray-500 ml-1">→ NotebookLM</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* 탭 */}
                <div className="flex border-b border-gray-800">
                    {(['research', 'settings'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                            {t === 'research' ? '리서치 실행' : 'NotebookLM 설정'}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ── 리서치 탭 ── */}
                    {tab === 'research' && (
                        <>
                            {/* 연결 상태 뱃지 */}
                            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${cookieConnected ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                                {cookieConnected
                                    ? <><CheckCircle size={12} /> NotebookLM 연결됨 — 자동 업로드 활성화</>
                                    : <><AlertCircle size={12} /> NotebookLM 미연결 — 파일을 이메일로 발송합니다</>}
                            </div>

                            {/* 입력 폼 */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">리서치 주제 *</label>
                                    <input
                                        value={topic}
                                        onChange={e => setTopic(e.target.value)}
                                        placeholder="예: AI의 역사와 현재"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">
                                        노트북 이름 <span className="text-gray-600">(비우면 주제명 사용)</span>
                                    </label>
                                    <input
                                        value={notebookName}
                                        onChange={e => setNotebookName(e.target.value)}
                                        placeholder="예: AI 기초 학습 (같은 이름 = 기존 노트북에 추가)"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleRun}
                                disabled={running || !topic.trim()}
                                className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {running ? <><Loader size={15} className="animate-spin" />처리 중...</> : <><Search size={15} />리서치 시작</>}
                            </button>

                            {msg && (
                                <p className={`text-sm ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
                            )}

                            {/* 이력 */}
                            {history.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500 font-medium">최근 이력</p>
                                    {history.map(h => (
                                        <div key={h.id} className="bg-gray-800 rounded-xl p-3 flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white font-medium truncate">{h.topic}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{h.notebookName} · {new Date(h.createdAt).toLocaleDateString('ko-KR')}</p>
                                                {h.errorMessage && <p className="text-xs text-red-400 mt-1">{h.errorMessage}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {statusBadge(h.status)}
                                                {h.notebookUrl && (
                                                    <a href={h.notebookUrl} target="_blank" rel="noopener noreferrer"
                                                        className="text-gray-500 hover:text-blue-400 transition-colors">
                                                        <ExternalLink size={13} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── 설정 탭 ── */}
                    {tab === 'settings' && (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-xl border ${cookieConnected ? 'bg-green-900/20 border-green-800' : 'bg-gray-800 border-gray-700'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white">NotebookLM 연결</p>
                                        {cookieConnected && cookieUpdatedAt && (
                                            <p className="text-xs text-gray-400 mt-0.5">등록일: {new Date(cookieUpdatedAt).toLocaleDateString('ko-KR')}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cookieConnected
                                            ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={12} />연결됨</span>
                                            : <span className="text-xs text-gray-500">미연결</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <button onClick={() => setShowCookieForm(v => !v)}
                                        className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center gap-1">
                                        <Plus size={12} />{cookieConnected ? '쿠키 갱신' : '쿠키 등록'}
                                    </button>
                                    {cookieConnected && (
                                        <button onClick={handleDeleteCookies}
                                            className="py-2 px-3 rounded-lg text-xs font-medium bg-gray-700 hover:bg-red-900/40 text-gray-300 hover:text-red-400 transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <a href="https://accounts.google.com/signup" target="_blank" rel="noopener noreferrer"
                                className="block w-full py-2 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 text-center transition-colors mt-2">
                                + 리서치 전용 구글 계정 만들기
                            </a>

                            {showCookieForm && (
                                <div className="space-y-3">
                                    <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-3 text-xs text-blue-300 space-y-1.5">
                                        <p className="font-medium">쿠키 내보내기 방법</p>
                                        <ol className="list-decimal list-inside space-y-1 text-blue-400">
                                            <li>Chrome에서 <b>NotebookLM</b> 로그인</li>
                                            <li>확장 프로그램 <b>"Cookie Editor"</b> 설치</li>
                                            <li>notebooklm.google.com 에서 확장 실행</li>
                                            <li><b>Export → Export as JSON</b> 클릭</li>
                                            <li>복사한 내용을 아래에 붙여넣기</li>
                                        </ol>
                                    </div>
                                    <textarea
                                        value={cookieInput}
                                        onChange={e => setCookieInput(e.target.value)}
                                        placeholder='[{"name":"...", "value":"...", ...}]'
                                        rows={5}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                    <button onClick={handleSaveCookies}
                                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">
                                        저장
                                    </button>
                                </div>
                            )}

                            {msg && (
                                <p className={`text-sm ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
