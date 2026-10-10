import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { EntryChatModalProps } from './EntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { collapseGreetingRuns } from '../../lib/greetingRuns';
import { HajinMenu } from './hajinMenu';
import './hajinShowroom.css';

const read = (key: string) => { try { return sessionStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { sessionStorage.setItem(key, value); } catch { /* storage unavailable */ } };

export const HajinEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({
    theme, messages, isTyping, balance, hideCost, onSend, onClose, onNeedCharge, onOpenFullChat, onFeature, opener, draftOwner,
}) => {
    const owner = `${draftOwner || 'anonymous'}:${theme.personaId}`;
    const draftKey = `hajin-draft:${owner}`;
    const [draft, setDraft] = useState(() => read(draftKey) || '');
    const [menuOpen, setMenuOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState('');
    const dialog = useRef<HTMLDivElement>(null), flow = useRef<HTMLDivElement>(null), menuToggle = useRef<HTMLButtonElement>(null);
    const busy = useRef(false), alive = useRef(true), actions = useRef({ onClose, menuOpen });
    actions.current = { onClose, menuOpen };
    const noConversation = !messages.some(message => message.role === 'user');

    useEffect(() => {
        alive.current = true;
        const previous = document.body.style.overflow;
        const entry = document.querySelector('.hj-entry');
        const wasInert = entry?.hasAttribute('inert');
        entry?.setAttribute('inert', '');
        document.body.style.overflow = 'hidden';
        dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (document.querySelector('[data-charge-layer]')) return;
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopImmediatePropagation();
                if (actions.current.menuOpen) {
                    setMenuOpen(false);
                    menuToggle.current?.focus();
                } else actions.current.onClose();
            }
            if (event.key !== 'Tab') return;
            const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),a[href]') || [])].filter(node => node.getClientRects().length > 0);
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            alive.current = false;
            window.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = previous;
            if (!wasInert) entry?.removeAttribute('inert');
            if (opener?.isConnected) opener.focus();
        };
    }, [opener]);

    useEffect(() => { flow.current?.scrollTo({ top: flow.current.scrollHeight, behavior: 'auto' }); }, [messages, isTyping, menuOpen]);

    const changeDraft = (value: string) => { setDraft(value); write(draftKey, value); };
    const submit = async () => {
        const text = draft.trim();
        if (!text || busy.current || isTyping) return;
        busy.current = true; setSending(true); setNotice('');
        try {
            const result = await onSend(text);
            if (result === 'sent') { write(draftKey, ''); if (alive.current) { setDraft(''); setMenuOpen(false); } }
            else if (result === 'insufficient' && alive.current) onNeedCharge();
        } catch {
            if (alive.current) setNotice('전송하지 못했어요. 입력한 내용은 보관했어요.');
        } finally {
            busy.current = false; if (alive.current) setSending(false);
        }
    };
    const portrait = theme.fallbackPortrait;
    const visibleMessages = collapseGreetingRuns(messages);

    return <div className="hj-chat-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="hj-chat" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="hj-chat-title">
            <header className="hj-chat-header">
                <button type="button" className="hj-icon-button" onClick={onClose} aria-label="박하진 진입화면으로 돌아가기">‹</button>
                <span className="hj-avatar">{portrait ? <img src={portrait} alt="" /> : '박'}</span>
                <strong id="hj-chat-title">박하진</strong>
                <button type="button" className="hj-icon-button" onClick={onClose} aria-label="박하진 진입화면으로 돌아가기">×</button>
            </header>
            <div className="hj-chat-flow" ref={flow}>
                {noConversation && visibleMessages.length === 0 && <div className="hj-greeting"><span className="hj-avatar">{portrait ? <img src={portrait} alt="" /> : '박'}</span><div>안녕하세요, 박하진입니다.<br /><b>가게 홈페이지</b>에서 무엇부터 해볼까요?</div></div>}
                {visibleMessages.length > 0 && <div className="hj-messages">{visibleMessages.map(message => message.role === 'user'
                    ? <p key={message.id} className="hj-bubble hj-user">{message.text}</p>
                    : <div key={message.id} className="hj-bubble hj-assistant hj-markdown"><ReactMarkdown components={{ img: () => null }}>{message.text}</ReactMarkdown>{message.isStreaming && <span aria-label="답변 중"> ▍</span>}</div>)}</div>}
                {isTyping && <p className="hj-status" role="status">하진이 입력 중…</p>}
                {notice && <p className="hj-status" role="alert">{notice}</p>}
            </div>
            <section className="hj-chat-menu">
                <button ref={menuToggle} type="button" className="hj-menu-toggle" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="hj-chat-menu">메뉴 {menuOpen ? '접기 ⌃' : '펼치기 ⌄'}</button>
                {menuOpen && <div id="hj-chat-menu"><HajinMenu compact isGuest={false} disabled={!onFeature || sending || isTyping} onFeature={key => { if (!onFeature) return; setMenuOpen(false); onFeature(key); }} /></div>}
            </section>
            <footer className="hj-composer">
                <div><textarea rows={1} value={draft} onChange={event => changeDraft(event.target.value)} disabled={sending} aria-label="박하진에게 메시지 보내기" placeholder="궁금한 점을 적어 주세요" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} /><button type="button" disabled={!draft.trim() || sending || isTyping} onClick={() => void submit()} aria-label="메시지 보내기">↑</button></div>
                <p>{!hideCost && <>대화 {CHAT_MESSAGE_COST}P · </>}보유 {balance.toLocaleString()}P</p>
                <button type="button" className="hj-full-chat" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button>
            </footer>
        </div>
    </div>;
};
