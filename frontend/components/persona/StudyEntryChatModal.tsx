import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { EntryChatModalProps } from './EntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { collapseGreetingRuns } from '../../lib/greetingRuns';
import { LearningMenu } from '../learning/LearningParts';
import { StudyDeskMotion } from '../learning/StudyDeskMotion';
import type { TodayResponse } from '../learning/learningModel';
import { useLearningRead } from '../learning/useLearningRead';
import './studyChat.css';

const readDraft = (key: string) => {
    try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
};
const saveDraft = (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch { /* Private browsing still permits conversation. */ }
};

export const StudyEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({
    theme, messages, isTyping, balance, hideCost, onSend, onClose: closeChat, onNeedCharge, onOpenFullChat,
    opener, draftOwner,
}) => {
    // 코치 채팅은 /learning 에서 들어온다 — 닫으면 메인이 아니라 공부 책상(진입 화면)으로 돌려보낸다(2026-10-07 사장 승인).
    const onClose = () => { closeChat(); window.location.assign('/learning'); };
    const { data } = useLearningRead<TodayResponse>('/api/aimp/learning/today', !!localStorage.getItem('token'));
    const draftKey = `study-draft:${draftOwner || 'anonymous'}:${theme.personaId}`;
    const [draft, setDraft] = useState(() => readDraft(draftKey));
    const [menuOpen, setMenuOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState('');
    const [insufficient, setInsufficient] = useState(false);
    const dialog = useRef<HTMLDivElement>(null);
    const flow = useRef<HTMLDivElement>(null);
    const busy = useRef(false);
    const alive = useRef(true);
    const actions = useRef({ onClose, menuOpen });
    actions.current = { onClose, menuOpen };

    useEffect(() => {
        alive.current = true;
        const previousOverflow = document.body.style.overflow;
        const entry = document.querySelector('.lc-root');
        const wasInert = entry?.hasAttribute('inert');
        entry?.setAttribute('inert', '');
        document.body.style.overflow = 'hidden';
        const update = () => dialog.current?.style.setProperty('--sc-vvh', `${window.visualViewport?.height ?? innerHeight}px`);
        update();
        window.visualViewport?.addEventListener('resize', update);
        dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (event: KeyboardEvent) => {
            if ([...document.querySelectorAll('.fixed.inset-0')].some(node => getComputedStyle(node).zIndex === '9000')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (actions.current.menuOpen) {
                    setMenuOpen(false);
                    dialog.current?.querySelector<HTMLElement>('.sc-menu-toggle')?.focus();
                } else actions.current.onClose();
            }
            if (event.key !== 'Tab') return;
            const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,a[href]') || [])]
                .filter(node => node.getClientRects().length > 0);
            const first = nodes[0], last = nodes[nodes.length - 1];
            const outside = !dialog.current?.contains(document.activeElement);
            if (event.shiftKey && (document.activeElement === first || outside)) {
                event.preventDefault(); last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || outside)) {
                event.preventDefault(); first?.focus();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            alive.current = false;
            window.removeEventListener('keydown', onKey, true);
            window.visualViewport?.removeEventListener('resize', update);
            document.body.style.overflow = previousOverflow;
            if (!wasInert) entry?.removeAttribute('inert');
            opener?.focus();
        };
    }, [opener]);
    useEffect(() => { flow.current?.scrollTo({ top: flow.current.scrollHeight, behavior: 'auto' }); }, [messages, isTyping]);
    const changeDraft = (value: string) => { setDraft(value); saveDraft(draftKey, value); };
    const submit = async () => {
        const text = draft.trim();
        if (!text || busy.current || isTyping) return;
        busy.current = true; setSending(true); setNotice(''); setInsufficient(false);
        try {
            const result = await onSend(text);
            if (result === 'sent') {
                if (readDraft(draftKey) === draft) saveDraft(draftKey, '');
                if (alive.current) { setDraft(''); setMenuOpen(false); }
            } else if (result === 'insufficient' && alive.current) setInsufficient(true);
        } catch {
            if (alive.current) setNotice('전송하지 못했어요. 입력한 내용은 보관했어요.');
        } finally {
            busy.current = false;
            if (alive.current) setSending(false);
        }
    };
    const visibleMessages = collapseGreetingRuns(messages);
    return (
        <div className="sc-overlay lc-theme" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="sc-study-aside"><StudyDeskMotion data={data} /><h2>공부가 막히면,<br />잠깐 이야기해요.</h2>
                <p>어디서 막혔는지 함께 살펴볼게요.</p></div>
            <div className="sc-chat" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="sc-chat-title">
                <header className="sc-header">
                    <img className="sc-avatar" src="/learning/menu/5.webp" alt="" />
                    <div className="sc-heading"><strong id="sc-chat-title">AI 학습코칭</strong><small>오늘도, 한 가지씩 함께</small></div>
                    <button type="button" className="sc-menu-toggle" aria-expanded={menuOpen} aria-controls="sc-chat-menu"
                        onClick={() => setMenuOpen(!menuOpen)}>메뉴 {menuOpen ? '⌃' : '⌄'}</button>
                    <button type="button" className="sc-close" onClick={onClose} aria-label="채팅 모달 닫기">×</button>
                </header>
                <div className="sc-flow" ref={flow}>
                    {menuOpen && <section className="sc-chat-menu" id="sc-chat-menu" aria-label="학습 메뉴">
                        <LearningMenu data={data} onCoach={() => setMenuOpen(false)} disabled={sending || isTyping} />
                    </section>}
                    <div className="sc-thread">
                        <div className="sc-caption">YOUR DAILY STUDY · 작은 목표부터</div>
                        {visibleMessages.length === 0 && <p className="sc-notice">안녕하세요. 오늘 공부에서 막힌 부분이 있나요? 목표부터 함께 정리해도 좋아요.</p>}
                        {visibleMessages.map(message => (
                            <div key={message.id} className={`sc-message${message.role === 'user' ? ' sc-user' : ''}`}>
                                <div className="sc-label">{message.role === 'user' ? '나' : '학습코치'}</div>
                                <div className="sc-body">
                                    {message.role === 'user' ? message.text : <ReactMarkdown remarkPlugins={[remarkGfm]}
                                        components={{ img: () => null }}>{message.text}</ReactMarkdown>}
                                    {message.isStreaming && <span aria-label="답변 중"> ▍</span>}
                                </div>
                            </div>
                        ))}
                        {isTyping && <p className="sc-notice" role="status">코치가 답변을 준비하고 있어요…</p>}
                        {notice && <p className="sc-notice" role="alert">{notice}</p>}
                        {insufficient && <div className="sc-insufficient" role="alert">
                            <p>포인트가 부족해요. 입력한 내용은 보관했어요.</p>
                            <button type="button" onClick={onNeedCharge}>포인트 충전하기</button>
                        </div>}
                    </div>
                </div>
                <footer className="sc-composer">
                    <div className="sc-cost">{!hideCost && <>대화 {CHAT_MESSAGE_COST}P · </>}보유 {balance.toLocaleString()}P</div>

                    <div className="sc-input-row">
                        <textarea rows={2} value={draft} disabled={sending} onChange={event => changeDraft(event.target.value)}
                            aria-label="코치에게 보낼 내용" placeholder="막힌 부분을 편하게 적어주세요"
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault(); void submit();
                                }
                            }} />
                        <button type="button" className="sc-send" aria-label="메시지 보내기"
                            disabled={!draft.trim() || sending || isTyping} onClick={() => void submit()}>↑</button>
                    </div>
                    <a className="sc-study-link" href="/learning">내 공부로 돌아가기</a>
                    <button type="button" className="sc-full" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button>
                </footer>
            </div>
        </div>
    );
};
