import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { EntryChatModalProps } from './EntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';

import { collapseGreetingRuns } from '../../lib/greetingRuns';
import './seolaChat.css';
export const SEOLA_MENU = [{key:'swing',title:'내 스윙 점검',description:'영상·사진에서 고칠 한 가지를 찾아요'},{key:'golf-record',title:'지난 점검 기록',description:'설아가 짚어준 포인트를 다시 봐요'},{key:'golf-course',title:'오늘의 코스 찾기',description:'지역과 위치로 골프장을 찾아요'}];
const read = (storage: 'localStorage' | 'sessionStorage', key: string) => { try { return window[storage].getItem(key); } catch { return null; } };
const write = (storage: 'localStorage' | 'sessionStorage', key: string, value: string) => { try { window[storage].setItem(key, value); } catch { /* private browsing must not block UI */ } };
export const SeolaEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({ theme, messages, isTyping, balance, hideCost, onSend, onClose, onNeedCharge, onOpenFullChat, onFeature, opener, draftOwner }) => {
    const owner = `${draftOwner || 'anonymous'}:${theme.personaId}`;
    const menuKey = `seola-menu:${owner}`, draftKey = `seola-draft:${owner}`;
    const noConversation = !messages.some(m => m.role === 'user');
    const [menuOpen, setMenuOpen] = useState(() => { const saved = read('localStorage', menuKey); return saved === 'open'; });
    const [draft, setDraft] = useState(() => read('sessionStorage', draftKey) || '');
    const [sending, setSending] = useState(false), [notice, setNotice] = useState('');
    const dialog = useRef<HTMLDivElement>(null), flow = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null);
    const busy = useRef(false), alive = useRef(true), actions = useRef({ onClose, menuOpen }); actions.current = { onClose, menuOpen };
    const setMenu = (open: boolean) => { setMenuOpen(open); write('localStorage', menuKey, open ? 'open' : 'closed'); };
    useEffect(() => {
        alive.current = true; const previous = document.body.style.overflow;
        const entry = document.querySelector('.sg-root'); const wasInert = entry?.hasAttribute('inert'); entry?.setAttribute('inert', ''); document.body.style.overflow = 'hidden';
        const update = () => dialog.current?.style.setProperty('--seola-vvh', `${window.visualViewport?.height ?? window.innerHeight}px`); update(); window.visualViewport?.addEventListener('resize', update);
        dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (e: KeyboardEvent) => { if (document.querySelector('[data-charge-layer]')) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (actions.current.menuOpen) { setMenu(false); dialog.current?.querySelector<HTMLElement>('.seola-menu-toggle')?.focus(); } else actions.current.onClose(); }
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
    return <div className="seola-chat-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="seola-chat" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="seola-chat-title">
        <aside className="seola-portrait"><img src={theme.fallbackPortrait} alt="설아" /><div><span className="seola-eyebrow">DAWN TEE HOUSE</span><h2>설아</h2><p>오늘은 한 가지만, 함께 고쳐요.</p></div></aside>
        <section className="seola-chat-pane"><header className="seola-chat-header"><img className="seola-header-face" src={theme.fallbackPortrait} alt="설아 코치" /><div><strong id="seola-chat-title">설아</strong><span>설아의 새벽 티하우스</span></div><button type="button" className="seola-close" onClick={onClose} aria-label="채팅 모달 닫기">×</button></header>
            <div className={`seola-flow${noConversation ? ' seola-welcome-flow' : ''}`} ref={flow}>
                {noConversation && <section className="seola-greeting"><div><img src={theme.fallbackPortrait} alt="설아의 첫 인사" /></div><p>어서 오세요. 설아이에요.<br />오늘의 스윙은 어땠나요?</p></section>}
                {messages.length > 0 && <div className="seola-messages">{collapseGreetingRuns(messages).map(m => m.role === 'user'
                    ? <p key={m.id} className="seola-bubble seola-user">{m.text}</p>
                    // ★설아 답변은 마크다운(**굵게**·목록)을 쓴다(운영 실측 11건 중 9건) — 원문 그대로 찍으면 ** 가 보인다. 이미지는 그리지 않는다.
                    : <div key={m.id} className="seola-bubble seola-assistant seola-md"><ReactMarkdown components={{ img: () => null }}>{m.text}</ReactMarkdown>{m.isStreaming && <span aria-label="답변 중"> ▍</span>}</div>)}</div>}
                {isTyping && <p className="seola-status" role="status">설아이 입력 중…</p>}{notice && <p className="seola-status" role="alert">{notice}</p>}
            </div>
            <section className="seola-menu-dock"><button type="button" className="seola-menu-toggle" onClick={() => setMenu(!menuOpen)} aria-expanded={menuOpen} aria-controls="seola-chat-menu">설아에게 부탁하기 {menuOpen ? '접기 ⌃' : '펼치기 ⌄'}</button>{menuOpen && <div id="seola-chat-menu">{SEOLA_MENU.map(item => <button type="button" key={item.key} data-feature={item.key} disabled={!onFeature || sending || isTyping} onClick={() => pick(item.key)}><span><strong>{item.title}</strong><small>{item.description}</small></span><span aria-hidden="true">↗</span></button>)}</div>}</section>
            <footer className="seola-composer"><div className="seola-input-wrap"><textarea ref={input} rows={1} value={draft} onChange={e => changeDraft(e.target.value)} disabled={sending} aria-label="설아에게 메시지 보내기" placeholder="설아에게 이야기해 주세요" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }} /><button type="button" className="seola-send" disabled={!draft.trim() || sending || isTyping} onClick={() => void submit()} aria-label="메시지 보내기">↑</button></div><p className="seola-cost">{!hideCost && <>대화 {CHAT_MESSAGE_COST}P · </>}보유 {balance.toLocaleString()}P</p><button type="button" className="seola-full" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button></footer>
        </section>
    </div></div>;
};
