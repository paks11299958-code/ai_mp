import React, { useState, useEffect, useMemo } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// AI 기능 스카우트 일자별 아이디어 조회 + 개발 요청 탭.
// 날짜 클릭 → 후보들이 체크박스 리스트로 펼쳐짐 → 체크하면 상단 고정 입력창에 자동 반영 → Hermes 개발 요청.
interface Idea { id: number; ideaDate: string; content: string; createdAt: string }
interface Candidate { key: string; title: string; body: string }  // key = `${ideaId}:${idx}`

// 하루치 content("【후보 N: 제목】 ...")를 후보 단위로 파싱
function parseCandidates(ideaId: number, content: string): Candidate[] {
    const parts = content.split(/(?=【후보)/).map(s => s.trim()).filter(Boolean);
    return parts.map((p, i) => {
        const m = p.match(/【후보[^:：]*[:：]\s*([^】]+)】/);
        const title = (m ? m[1] : p.slice(0, 30)).trim();
        return { key: `${ideaId}:${i}`, title, body: p };
    });
}

export const AiIdeasPanel: React.FC = () => {
    const [ideas, setIdeas] = useState<Idea[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [checked, setChecked] = useState<Record<string, Candidate>>({});  // key→후보
    const [reqText, setReqText] = useState('');
    const [extra, setExtra] = useState('');  // 추가 요구(독립사이트로/페르소나 등)
    const [sending, setSending] = useState(false);
    const [sentMsg, setSentMsg] = useState('');
    const [userEdited, setUserEdited] = useState(false);  // 사용자가 직접 손대면 자동덮어쓰기 중단

    useEffect(() => {
        adminApi.getAiFeatureIdeas()
            .then(rows => { setIdeas(rows); if (rows.length) setOpenId(rows[0].id); })
            .catch(() => setError('불러오기 실패'));
    }, []);

    const checkedList = useMemo(() => Object.values(checked), [checked]);

    // 체크 변동 시 입력창 자동 구성(사용자가 직접 수정했으면 건드리지 않음)
    useEffect(() => {
        if (userEdited) return;
        if (checkedList.length === 0) { setReqText(''); return; }
        const titles = checkedList.map(c => `'${c.title}'`).join(', ');
        const tail = extra.trim() ? ` ${extra.trim()}` : ' 독립사이트(sites)로 만들어줘.';
        setReqText(`다음 AI 기능을 개발해줘: ${titles}.${tail}`);
    }, [checked, extra, userEdited]);

    const toggle = (c: Candidate) => {
        setUserEdited(false);
        setChecked(prev => {
            const next = { ...prev };
            if (next[c.key]) delete next[c.key]; else next[c.key] = c;
            return next;
        });
    };

    const send = async () => {
        const text = reqText.trim();
        if (!text) return;
        setSending(true); setSentMsg('');
        try {
            await adminApi.createDevRequest(text, 'ai-idea');
            setSentMsg('✅ Hermes에 전달했어요. 곧 텔레그램으로 계획·결재 요청이 옵니다.');
            setChecked({}); setReqText(''); setExtra(''); setUserEdited(false);
        } catch {
            setSentMsg('❌ 전달 실패. 다시 시도해 주세요.');
        } finally { setSending(false); }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                {/* ── 상단 고정: 개발 요청 ── */}
                <div className="sticky top-0 z-10 -mx-6 px-6 pt-1 pb-3 mb-4 bg-[#1a1d29]/95 backdrop-blur border-b border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon name="Lightbulb" size={16} className="text-amber-400" />
                        <h3 className="text-sm font-bold text-white">AI 기능 아이디어 → 개발 요청</h3>
                    </div>
                    <textarea
                        value={reqText}
                        onChange={e => { setReqText(e.target.value); setUserEdited(true); }}
                        placeholder="아래 날짜를 펼쳐 후보를 체크하면 여기에 자동으로 채워져요. 직접 수정도 가능합니다."
                        rows={2}
                        className="w-full text-sm rounded-lg px-3 py-2 bg-white/5 border border-white/15 text-gray-100 outline-none focus:border-amber-400/50 resize-none" />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <input
                            value={extra}
                            onChange={e => { setExtra(e.target.value); setUserEdited(false); }}
                            placeholder="추가 요구(예: 독립사이트로 / OO 페르소나에)"
                            className="flex-1 min-w-0 text-xs rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-gray-200 outline-none focus:border-amber-400/40" />
                        <button onClick={send} disabled={sending || !reqText.trim()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 disabled:opacity-40 shrink-0"
                            style={{ background: '#8E6FB7', color: '#fff' }}>
                            {sending ? '전달 중…' : '🚀 Hermes에 개발 요청'}
                        </button>
                    </div>
                    {checkedList.length > 0 && <div className="text-[11px] text-amber-300 mt-1.5">선택됨 {checkedList.length}개</div>}
                    {sentMsg && <div className="text-xs text-gray-300 mt-1.5">{sentMsg}</div>}
                </div>

                {error && <div className="text-xs text-red-400">{error}</div>}
                {ideas === null && !error && <div className="text-sm text-gray-500 py-8 text-center">불러오는 중…</div>}
                {ideas && ideas.length === 0 && <div className="text-sm text-gray-500 py-8 text-center">아직 수집된 아이디어가 없어요.</div>}

                {/* ── 일자별 후보 리스트(탐색기처럼) ── */}
                <div className="space-y-3">
                    {ideas && ideas.map(it => {
                        const cands = parseCandidates(it.id, it.content);
                        return (
                            <div key={it.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                <button onClick={() => setOpenId(openId === it.id ? null : it.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left">
                                    <span className="text-sm font-bold text-white">📅 {it.ideaDate} <span className="text-xs text-gray-400 font-normal">· 후보 {cands.length}개</span></span>
                                    <Icon name="ChevronDown" size={15} className={`text-gray-400 transition-transform ${openId === it.id ? '' : '-rotate-90'}`} />
                                </button>
                                {openId === it.id && (
                                    <div className="px-3 pb-3 space-y-1.5">
                                        {cands.map(c => {
                                            const on = !!checked[c.key];
                                            return (
                                                <label key={c.key}
                                                    className={`flex gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${on ? 'bg-amber-400/10 border border-amber-400/30' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}>
                                                    <input type="checkbox" checked={on} onChange={() => toggle(c)}
                                                        className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer" style={{ accentColor: '#8E6FB7' }} />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-white">{c.title}</div>
                                                        <div className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap leading-relaxed">{c.body.replace(/【후보[^】]*】\s*/, '')}</div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
