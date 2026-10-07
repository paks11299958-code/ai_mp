import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { EntryChatModalProps } from './EntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { CHARGE_LAYER_Z } from '../../lib/chargeLayer';
import { collapseGreetingRuns } from '../../lib/greetingRuns';
import { ChaerinMenu } from './chaerinMenu';
import './chaerinBeauty.css';

const readDraft = (key: string) => {
    try {
        return sessionStorage.getItem(key) || '';
    } catch {
        return '';
    }
};
const saveDraft = (key: string, text: string) => {
    try {
        sessionStorage.setItem(key, text);
    } catch {
        /* Private mode still permits local input. */
    }
};

export const ChaerinEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({
    theme,
    messages,
    isTyping,
    balance,
    hideCost,
    onSend,
    onClose,
    onNeedCharge,
    onOpenFullChat,
    onFeature,
    opener,
    draftOwner,
}) => {
    const draftKey = `chaerin-draft:${draftOwner || 'anonymous'}:${theme.personaId}`;
    const [draft, setDraft] = useState(() => readDraft(draftKey));
    const [menuOpen, setMenuOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState('');
    const [insufficient, setInsufficient] = useState(false);
    const [estimatePrice, setEstimatePrice] = useState('확인 중');
    const dialog = useRef<HTMLDivElement>(null);
    const flow = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const busy = useRef(false);
    const alive = useRef(true);
    const actions = useRef({ onClose, menuOpen });
    actions.current = { onClose, menuOpen };
    const noConversation = !messages.some((message) => message.role === 'user');

    useEffect(() => {
        let current = true;
        let token = '';
        try {
            token = localStorage.getItem('token') || '';
        } catch {
            /* No stored auth. */
        }
        fetch('/api/points/menu-prices', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error('prices'))))
            .then((data) => {
                if (!current) return;
                const cost = data?.prices?.['beauty-estimate'];
                setEstimatePrice(
                    typeof cost === 'number' && Number.isFinite(cost)
                        ? cost > 0
                            ? `${cost.toLocaleString()}P`
                            : '무료'
                        : '준비 중',
                );
            })
            .catch(() => {
                if (current) setEstimatePrice('확인 중');
            });
        return () => {
            current = false;
        };
    }, []);

    useEffect(() => {
        alive.current = true;
        const entry = document.querySelector('.cc-root');
        const previousInert = entry?.hasAttribute('inert');
        entry?.setAttribute('inert', '');
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const updateHeight = () =>
            dialog.current?.style.setProperty('--cb-vvh', `${window.visualViewport?.height ?? window.innerHeight}px`);
        updateHeight();
        window.visualViewport?.addEventListener('resize', updateHeight);
        dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (document.querySelector(`[data-charge-layer], [class~="z-[${CHARGE_LAYER_Z}]"]`)) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (actions.current.menuOpen) {
                    setMenuOpen(false);
                    dialog.current?.querySelector<HTMLElement>('.cb-menu-toggle')?.focus();
                } else actions.current.onClose();
                return;
            }
            if (event.key !== 'Tab') return;
            const nodes = [
                ...(dialog.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled),textarea:not(:disabled),a[href]',
                ) || []),
            ].filter((node) => node.getClientRects().length > 0);
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const outside = !dialog.current?.contains(document.activeElement);
            if (event.shiftKey && (document.activeElement === first || outside)) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || outside)) {
                event.preventDefault();
                first?.focus();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            alive.current = false;
            window.removeEventListener('keydown', onKey, true);
            window.visualViewport?.removeEventListener('resize', updateHeight);
            document.body.style.overflow = previousOverflow;
            if (!previousInert) entry?.removeAttribute('inert');
            if (opener?.isConnected) opener.focus();
        };
    }, [opener]);

    useEffect(() => {
        if (menuOpen && menu.current) {
            flow.current?.scrollTo({ top: menu.current.offsetTop, behavior: 'auto' });
        } else flow.current?.scrollTo({ top: flow.current.scrollHeight, behavior: 'auto' });
    }, [messages, isTyping, menuOpen, insufficient, notice]);

    const changeDraft = (text: string) => {
        setDraft(text);
        saveDraft(draftKey, text);
    };
    const submit = async () => {
        const text = draft.trim();
        if (!text || busy.current || isTyping) return;
        busy.current = true;
        setSending(true);
        setNotice('');
        setInsufficient(false);
        try {
            const result = await onSend(text);
            if (result === 'sent') {
                if (readDraft(draftKey) === draft) saveDraft(draftKey, '');
                if (alive.current) {
                    setDraft('');
                    setMenuOpen(false);
                }
            } else if (result === 'insufficient') {
                if (alive.current) setInsufficient(true);
            } else if (alive.current) setNotice('지금은 보낼 수 없어. 잠시 후 다시 이야기해줘.');
        } catch {
            if (alive.current) setNotice('전송하지 못했어. 입력한 내용은 그대로 보관했어.');
        } finally {
            busy.current = false;
            if (alive.current) setSending(false);
        }
    };
    const pick = (key: string) => {
        if (!onFeature || busy.current || isTyping) return;
        setMenuOpen(false);
        onFeature(key);
    };

    return (
        <div
            className="cb-chat-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="cb-chat" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cb-chat-title">
                <aside className="cb-chat-portrait">
                    <img src={theme.fallbackPortrait} alt="니트 차림의 윤채린" />
                    <h2>편하게, 너답게.</h2>
                    <p>피부 고민부터 새로운 내 모습까지.</p>
                    <small>AI 뷰티 컨설턴트 · 의료인 아님</small>
                </aside>
                <section className="cb-chat-pane">
                    <header className="cb-chat-header">
                        <img src={theme.fallbackPortrait} alt="" />
                        <div>
                            <strong id="cb-chat-title">윤채린</strong>
                            <small>AI 뷰티 컨설턴트 · 의료인 아님</small>
                        </div>
                        <button type="button" className="cb-close" onClick={onClose} aria-label="채팅 모달 닫기">
                            ×
                        </button>
                    </header>
                    <div className="cb-chat-flow" ref={flow}>
                        <p className="cb-chat-date">오늘 · 편하게 시작해요</p>
                        {noConversation && (
                            <section className="cb-welcome">
                                <h2>피부 고민, 나한테 다 말해봐.</h2>
                                {messages.length === 0 && <p>요즘 가장 신경 쓰이는 게 뭐야?</p>}
                                <div className="cb-suggestions">
                                    {['요즘 피부가 당겨', '쓰는 성분 같이 봐줘'].map((text) => (
                                        <button
                                            type="button"
                                            key={text}
                                            onClick={() => changeDraft(text)}
                                            disabled={sending}
                                        >
                                            {text}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        {collapseGreetingRuns(messages).map((message) => (
                            <article
                                key={message.id}
                                className={`cb-message${message.role === 'user' ? ' cb-user' : ''}`}
                                aria-label={message.role === 'user' ? '내 메시지' : undefined}
                            >
                                {message.role !== 'user' && <small>채린</small>}
                                {message.role === 'user' ? (
                                    <p>{message.text}</p>
                                ) : (
                                    <div className="cb-markdown">
                                        <ReactMarkdown components={{ img: () => null }}>{message.text}</ReactMarkdown>
                                        {message.isStreaming && <span aria-label="답변 중"> ▍</span>}
                                    </div>
                                )}
                            </article>
                        ))}
                        {isTyping && (
                            <p className="cb-notice" role="status">
                                채린이 입력 중…
                            </p>
                        )}
                        {notice && (
                            <p className="cb-notice" role="alert">
                                {notice}
                            </p>
                        )}
                        {menuOpen && (
                            <div className="cb-chat-menu" id="cb-chat-menu" ref={menu}>
                                <p>궁금한 것부터 골라봐. 대화는 쓰던 말 그대로 이어갈 수 있어.</p>
                                <ChaerinMenu
                                    estimatePrice={estimatePrice}
                                    onEstimate={() => pick('beauty-estimate')}
                                    onTable={() => pick('beauty-table')}
                                    onFeature={pick}
                                    disabled={!onFeature || sending || isTyping}
                                />
                            </div>
                        )}
                        {insufficient && (
                            <section className="cb-insufficient" role="alert">
                                <h2>잠깐, 포인트가 부족해.</h2>
                                <p>대화에는 {CHAT_MESSAGE_COST}P가 필요해. 쓰던 말은 그대로 보관했어.</p>
                                <div>
                                    <button type="button" onClick={onNeedCharge}>
                                        포인트 충전하기
                                    </button>
                                    <button type="button" onClick={() => setInsufficient(false)}>
                                        계속 작성하기
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>
                    <footer className="cb-composer">
                        <div className="cb-composer-meta">
                            <button
                                type="button"
                                className="cb-menu-toggle"
                                onClick={() => setMenuOpen(!menuOpen)}
                                aria-expanded={menuOpen}
                                aria-controls="cb-chat-menu"
                            >
                                기능 메뉴 {menuOpen ? '접기 −' : '펼치기 +'}
                            </button>
                            <small>
                                {!hideCost && <>대화 {CHAT_MESSAGE_COST}P · </>}보유 {balance.toLocaleString()}P
                            </small>
                        </div>
                        <div className="cb-input-row">
                            <textarea
                                rows={2}
                                value={draft}
                                onChange={(event) => changeDraft(event.target.value)}
                                disabled={sending}
                                aria-label="윤채린에게 메시지 보내기"
                                placeholder="오늘 피부는 어때?"
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                        event.preventDefault();
                                        void submit();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="cb-send"
                                disabled={!draft.trim() || sending || isTyping}
                                onClick={() => void submit()}
                                aria-label="메시지 보내기"
                            >
                                ↑
                            </button>
                        </div>
                        <button type="button" className="cb-full-chat" onClick={onOpenFullChat}>
                            전체 채팅 화면으로 →
                        </button>
                        <p className="cb-legal">견적은 공개 가격 참고 범위이며 진단·처방이 아니에요.</p>
                    </footer>
                </section>
            </div>
        </div>
    );
};
