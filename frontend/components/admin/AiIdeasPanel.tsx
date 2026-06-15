import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// AI 기능 스카우트 일자별 아이디어 조회 탭.
// 매일 07시 ai_feature_scout.py가 DB(AiFeatureIdea)에 저장한 내용을 최근순으로 본다.
interface Idea { id: number; ideaDate: string; content: string; createdAt: string }

export const AiIdeasPanel: React.FC = () => {
    const [ideas, setIdeas] = useState<Idea[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [reqText, setReqText] = useState<Record<number, string>>({});  // 카드별 개발요청 입력
    const [sending, setSending] = useState<number | null>(null);
    const [sentMsg, setSentMsg] = useState<Record<number, string>>({});

    const sendDevRequest = async (ideaId: number) => {
        const text = (reqText[ideaId] || '').trim();
        if (!text) return;
        setSending(ideaId);
        try {
            await adminApi.createDevRequest(text, `ai-idea:${ideaId}`);
            setSentMsg(prev => ({ ...prev, [ideaId]: '✅ Hermes에 전달했어요. 곧 텔레그램으로 계획·결재 요청이 옵니다.' }));
            setReqText(prev => ({ ...prev, [ideaId]: '' }));
        } catch {
            setSentMsg(prev => ({ ...prev, [ideaId]: '❌ 전달 실패. 다시 시도해 주세요.' }));
        } finally {
            setSending(null);
        }
    };

    useEffect(() => {
        adminApi.getAiFeatureIdeas()
            .then(rows => {
                setIdeas(rows);
                if (rows.length) setOpenId(rows[0].id); // 최신 1건 펼침
            })
            .catch(() => setError('불러오기 실패'));
    }, []);

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center gap-2">
                    <Icon name="Lightbulb" size={16} className="text-amber-400" />
                    <h3 className="text-sm font-bold text-white">AI 기능 아이디어 (매일 07시 자동 수집)</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                    AI 기능 스카우트가 매일 한국 사용자 수요 기반 신규 기능 후보를 리서치해 텔레그램으로 보고하고, 여기 일자별로 쌓입니다.
                </p>

                {error && <div className="text-xs text-red-400">{error}</div>}
                {ideas === null && !error && <div className="text-sm text-gray-500 py-8 text-center">불러오는 중…</div>}
                {ideas && ideas.length === 0 && <div className="text-sm text-gray-500 py-8 text-center">아직 수집된 아이디어가 없어요.</div>}

                {ideas && ideas.map(it => (
                    <div key={it.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <button onClick={() => setOpenId(openId === it.id ? null : it.id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left">
                            <span className="text-sm font-bold text-white">📅 {it.ideaDate}</span>
                            <Icon name="ChevronDown" size={15} className={`text-gray-400 transition-transform ${openId === it.id ? '' : '-rotate-90'}`} />
                        </button>
                        {openId === it.id && (
                            <div className="px-4 pb-4 pt-1">
                                <div className="text-sm text-gray-200 leading-relaxed ai-idea-md">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.content}</ReactMarkdown>
                                </div>
                                {/* 개발 요청 — Hermes 위임 */}
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <label className="block text-xs font-semibold text-amber-300 mb-1.5">🚀 이 아이디어로 개발 요청</label>
                                    <textarea
                                        value={reqText[it.id] || ''}
                                        onChange={e => setReqText(prev => ({ ...prev, [it.id]: e.target.value }))}
                                        placeholder="예: 위 후보 중 '냉장고 파먹기 레시피'를 독립사이트(sites)로 만들어줘. 재료 입력하면 레시피 추천."
                                        rows={2}
                                        className="w-full text-sm rounded-lg px-3 py-2 bg-white/5 border border-white/15 text-gray-100 outline-none focus:border-amber-400/50 resize-none" />
                                    <div className="flex items-center gap-2 mt-2">
                                        <button onClick={() => sendDevRequest(it.id)} disabled={sending === it.id || !(reqText[it.id] || '').trim()}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 disabled:opacity-40"
                                            style={{ background: '#8E6FB7', color: '#fff' }}>
                                            {sending === it.id ? '전달 중…' : '🚀 Hermes에 개발 요청'}
                                        </button>
                                        {sentMsg[it.id] && <span className="text-xs text-gray-300">{sentMsg[it.id]}</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
