import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { EntryChatModalProps } from './EntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { ArinMenu } from './arinMenu';
import { collapseGreetingRuns } from '../../lib/greetingRuns';
import './arinStudio.css';
const read = (storage: 'localStorage' | 'sessionStorage', key: string) => { try { return window[storage].getItem(key); } catch { return null; } };
const write = (storage: 'localStorage' | 'sessionStorage', key: string, value: string) => { try { window[storage].setItem(key, value); } catch { /* private browsing must not block UI */ } };
export const ArinEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({ theme, messages, isTyping, balance, hideCost, onSend, onClose, onNeedCharge, onOpenFullChat, onFeature, opener, draftOwner }) => {
    const owner = `${draftOwner || 'anonymous'}:${theme.personaId}`;
    const menuKey = `arin-menu:${owner}`, draftKey = `arin-draft:${owner}`;
    const noConversation = !messages.some(m => m.role === 'user');
    const [menuOpen, setMenuOpen] = useState(() => { const saved = read('localStorage', menuKey); return saved === null ? noConversation : saved === 'open'; });
    const [draft, setDraft] = useState(() => read('sessionStorage', draftKey) || '');
    const [sending, setSending] = useState(false), [notice, setNotice] = useState('');
    const dialog = useRef<HTMLDivElement>(null), flow = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null);
    const busy = useRef(false), alive = useRef(true), actions = useRef({ onClose, menuOpen }); actions.current = { onClose, menuOpen };
    const setMenu = (open: boolean) => { setMenuOpen(open); write('localStorage', menuKey, open ? 'open' : 'closed'); };
    useEffect(() => {
        alive.current = true; const previous = document.body.style.overflow;
        const entry = document.querySelector('.arin-entry'); const wasInert = entry?.hasAttribute('inert'); entry?.setAttribute('inert', ''); document.body.style.overflow = 'hidden';
        const update = () => dialog.current?.style.setProperty('--arin-vvh', `${window.visualViewport?.height ?? window.innerHeight}px`); update(); window.visualViewport?.addEventListener('resize', update);
        dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (e: KeyboardEvent) => { if (document.querySelector('[data-charge-layer]')) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (actions.current.menuOpen) { setMenu(false); dialog.current?.querySelector<HTMLElement>('.arin-menu-toggle')?.focus(); } else actions.current.onClose(); }
            if (e.key !== 'Tab') return; const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,a[href]') || [])].filter(n => n.getClientRects().length > 0); const first = nodes[0], last = nodes[nodes.length - 1];
            if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
        }; window.addEventListener('keydown', onKey, true);
        return () => { alive.current = false; window.removeEventListener('keydown', onKey, true); window.visualViewport?.removeEventListener('resize', update); document.body.style.overflow = previous; if (!wasInert) entry?.removeAttribute('inert'); opener?.focus(); };
    }, [opener]);
    // Session history may arrive after the dialog mounts. Respect saved/user-chosen state.
    useEffect(() => { if (read('localStorage', menuKey) === null && !noConversation) setMenuOpen(false); }, [noConversation, menuKey]);
    useEffect(() => { flow.current?.scrollTo({ top: flow.current.scrollHeight, behavior: 'auto' }); }, [messages, isTyping, menuOpen]);
    const changeDraft = (text: string) => { setDraft(text); write('sessionStorage', draftKey, text); };
    const submit = async () => { const text = draft.trim(); if (!text || busy.current || isTyping) return; busy.current = true; setSending(true); setNotice('');
        try { const result = await onSend(text); if (result === 'sent') { if (read('sessionStorage', draftKey) === draft) write('sessionStorage', draftKey, ''); if (alive.current) { setDraft(''); setMenu(false); } } else if (result === 'insufficient') { if (alive.current) onNeedCharge(); } }
        catch { if (alive.current) setNotice('전송하지 못했어요. 입력한 내용은 보관했어요.'); }
        finally { busy.current = false; if (alive.current) setSending(false); }
    };
    const pick = (key: string) => { if (!onFeature || busy.current || isTyping) return; setMenu(false); onFeature(key); };
    return <div className="arin-chat-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="arin-chat" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="arin-chat-title">
        <aside className="arin-portrait"><img src={theme.fallbackPortrait} alt="아린" /><div><span className="arin-eyebrow">YOUR CREATIVE PARTNER</span><h2>이아린</h2><p>좋은 감각은, 좋은 대화에서.</p></div></aside>
        <section className="arin-chat-pane"><header className="arin-chat-header"><div><strong id="arin-chat-title">이아린</strong><span>뷰티 · 콘텐츠 파트너</span></div><button type="button" className="arin-close" onClick={onClose} aria-label="채팅 모달 닫기">×</button></header>
            <div className={`arin-flow${noConversation ? ' arin-welcome-flow' : ''}`} ref={flow}>
                {noConversation && <section className="arin-greeting"><div><img src={theme.fallbackPortrait} alt="아린의 첫 인사" /></div><p>어서 오세요. 아린이에요.<br />어떤 분위기를 원하세요?</p></section>}
                {messages.length > 0 && <div className="arin-messages">{collapseGreetingRuns(messages).map(m => m.role === 'user'
                    ? <p key={m.id} className="arin-bubble arin-user">{m.text}</p>
                    // ★아린 답변은 마크다운(**굵게**·목록)을 쓴다(운영 실측 11건 중 9건) — 원문 그대로 찍으면 ** 가 보인다. 이미지는 그리지 않는다.
                    : <div key={m.id} className="arin-bubble arin-assistant arin-md"><ReactMarkdown components={{ img: () => null }}>{m.text}</ReactMarkdown>{m.isStreaming && <span aria-label="답변 중"> ▍</span>}</div>)}</div>}
                {isTyping && <p className="arin-status" role="status">아린이 입력 중…</p>}{notice && <p className="arin-status" role="alert">{notice}</p>}
            </div>
            <section className="arin-menu-dock"><button type="button" className="arin-menu-toggle" onClick={() => setMenu(!menuOpen)} aria-expanded={menuOpen} aria-controls="arin-chat-menu">메뉴 {menuOpen ? '접기 ⌃' : '펼치기 ⌄'}</button>{menuOpen && <div id="arin-chat-menu"><ArinMenu compact onFeature={pick} disabled={!onFeature || sending || isTyping} /></div>}</section>
            <footer className="arin-composer"><div className="arin-input-wrap"><textarea ref={input} rows={1} value={draft} onChange={e => changeDraft(e.target.value)} disabled={sending} aria-label="이아린에게 메시지 보내기" placeholder="아린에게 이야기해 주세요" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }} /><button type="button" className="arin-send" disabled={!draft.trim() || sending || isTyping} onClick={() => void submit()} aria-label="메시지 보내기">↑</button></div><p className="arin-cost">{!hideCost && <>대화 {CHAT_MESSAGE_COST}P · </>}보유 {balance.toLocaleString()}P</p><button type="button" className="arin-full" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button></footer>
        </section>
    </div></div>;
};
