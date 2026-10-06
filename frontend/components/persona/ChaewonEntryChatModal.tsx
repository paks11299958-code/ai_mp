import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { EntryChatModalProps } from './EntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { collapseGreetingRuns } from '../../lib/greetingRuns';
import { ChaewonMenu } from './ChaewonMenu';
import './chaewonDesk.css';

const readDraft = (key: string) => {
    try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
};
const saveDraft = (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch { /* Private browsing still permits conversation. */ }
};

export const ChaewonEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({
    theme, messages, isTyping, balance, hideCost, onSend, onClose, onNeedCharge, onOpenFullChat,
    onFeature, opener, draftOwner,
}) => {
    const draftKey = `chaewon-draft:${draftOwner || 'anonymous'}:${theme.personaId}`;
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
        const entry = document.querySelector('.cd-root');
        const wasInert = entry?.hasAttribute('inert');
        entry?.setAttribute('inert', '');
        document.body.style.overflow = 'hidden';
        const update = () => dialog.current?.style.setProperty('--cw-vvh', `${window.visualViewport?.height ?? innerHeight}px`);
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
                    dialog.current?.querySelector<HTMLElement>('.cw-menu-toggle')?.focus();
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
    const pick = (key: string) => {
        if (!onFeature || busy.current || isTyping) return;
        setMenuOpen(false); onFeature(key);
    };
    const visibleMessages = collapseGreetingRuns(messages);
    return (
        <div className="cw-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="cw-chat" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cw-chat-title">
                <header className="cw-header">
                    <div className="cw-avatar" aria-hidden="true">CW</div>
                    <div className="cw-heading"><strong id="cw-chat-title">윤채원</strong><small>수석 애널리스트 · 데이터로 읽는 시장</small></div>
                    <button type="button" className="cw-menu-toggle" aria-expanded={menuOpen} aria-controls="cw-chat-menu"
                        onClick={() => setMenuOpen(!menuOpen)}>메뉴 {menuOpen ? '⌃' : '⌄'}</button>
                    <button type="button" className="cw-close" onClick={onClose} aria-label="채팅 모달 닫기">×</button>
                </header>
                <div className="cw-flow" ref={flow}>
                    {menuOpen && <section className="cw-chat-menu" id="cw-chat-menu" aria-label="채원에게 부탁하기">
                        <ChaewonMenu onStock={() => pick('stock')} onPicks={() => pick('stock-picks')}
                            onChat={() => setMenuOpen(false)} disabled={sending || isTyping || !onFeature} />
                    </section>}
                    <div className="cw-thread">
                        <div className="cw-caption">ANALYST DESK · 시장을 함께 읽어요</div>
                        {visibleMessages.length === 0 && <p className="cw-notice">궁금한 종목이나 보고서 내용을 물어보세요.</p>}
                        {visibleMessages.map(message => (
                            <div key={message.id} className={`cw-message${message.role === 'user' ? ' cw-user' : ''}`}>
                                <div className="cw-label">{message.role === 'user' ? '나' : '윤채원 · 애널리스트'}</div>
                                <div className="cw-body">
                                    {message.role === 'user' ? message.text : <ReactMarkdown remarkPlugins={[remarkGfm]}
                                        components={{ img: () => null }}>{message.text}</ReactMarkdown>}
                                    {message.isStreaming && <span aria-label="답변 중"> ▍</span>}
                                </div>
                            </div>
                        ))}
                        {isTyping && <p className="cw-notice" role="status">채원이 자료를 살펴보고 있어요…</p>}
                        {notice && <p className="cw-notice" role="alert">{notice}</p>}
                        {insufficient && <div className="cw-insufficient" role="alert">
                            <p>포인트가 부족해요. 입력한 내용은 보관했어요.</p>
                            <button type="button" onClick={onNeedCharge}>포인트 충전하기</button>
                        </div>}
                    </div>
                </div>
                <footer className="cw-composer">
                    <div className="cw-cost">{!hideCost && <>대화 {CHAT_MESSAGE_COST}P · </>}보유 {balance.toLocaleString()}P</div>
                    <p className="cw-disclaimer">투자 권유가 아닙니다. 최종 투자 판단과 책임은 이용자 본인에게 있습니다.</p>
                    <div className="cw-input-row">
                        <textarea rows={1} value={draft} disabled={sending} onChange={event => changeDraft(event.target.value)}
                            aria-label="채원에게 메시지 보내기" placeholder="채원에게 물어보세요"
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault(); void submit();
                                }
                            }} />
                        <button type="button" className="cw-send" aria-label="메시지 보내기"
                            disabled={!draft.trim() || sending || isTyping} onClick={() => void submit()}>↑</button>
                    </div>
                    <button type="button" className="cw-full" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button>
                </footer>
            </div>
        </div>
    );
};
