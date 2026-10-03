import { useDogyeolBirthGate, needsBirth } from './useDogyeolBirthGate';
import { DogyeolBirthForm } from './DogyeolBirthForm';
import ReactMarkdown from 'react-markdown';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EntryChatModalProps } from './EunbiEntryChatModal';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { usePoints } from '../../contexts/PointsContext';
import { usePersonaMenus, useSavedBirth, useSajuRunner, sheetMenuFor, inputKindFor, dreamPlaceholder, withPartner, withTwoPartners, type SajuBirth, type SajuInputKind } from './useSajuRunner';
import { FaceReadingModal } from '../FaceReadingModal';
import { PalmReadingModal } from '../PalmReadingModal';
import { FaceReadingResultCard } from '../FaceReadingResultCard';
import { PalmReadingResultCard } from '../PalmReadingResultCard';
import { PartnerInfoModal } from '../PartnerInfoModal';
import type { FaceReadingResult, PalmReadingResult } from '../../services/apiService';
import './dogyeolChat.css';

const ITEMS = [
    ['siwoon', '운세', 'fortune'], ['wealth', '재물', 'wealth'], ['yeonn', '인연', 'relationship'], ['rebirth', '전생', 'past-life'],
    ['dream', '해몽', 'dream'], ['gwansang', '관상', 'face'], ['palm', '손금', 'palm'], ['friendship', '우정', 'friendship'],
] as const;
const Icon = ({ name }: { name: string }) => <img src={`/dogyeol/icons/${name}.svg`} alt="" />;
const SendIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5L21 12L5 19L8 12Z"/><path d="M8 12H19"/></svg>;
const readDraft = (key: string) => { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } };
const writeDraft = (key: string, text: string) => { try { if (text) sessionStorage.setItem(key, text); else sessionStorage.removeItem(key); } catch { /* private browser storage may be unavailable */ } };

export const DogyeolEntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = ({ theme, messages, isTyping, balance, hideCost, onSend, onClose, onNeedCharge, onOpenFullChat, opener, draftOwner }) => {
    const points = usePoints();
    const { menus, useBirthInfo } = usePersonaMenus(theme.displayName, theme.personaId);
    const birthGate = useDogyeolBirthGate();
    const { birth } = birthGate;
    const draftKey = `dogyeol-draft:${draftOwner || 'anonymous'}:${theme.personaId}`;
    const [draft, setDraft] = useState(() => readDraft(draftKey));
    const [dream, setDream] = useState('');
    const [inputKind, setInputKind] = useState<SajuInputKind | null>(null);
    const [menuOpen, setMenuOpen] = useState(messages.length <= 1);
    const [activeKey, setActiveKey] = useState('');
    const [notice, setNotice] = useState<'insufficient' | 'error' | null>(null);
    const [sending, setSending] = useState(false);
    const sendingRef = useRef(false);
    const [partnerFor, setPartnerFor] = useState<{label: string; prompt: string} | null>(null);
    const [twoFor, setTwoFor] = useState<{label: string; prompt: string} | null>(null);
    const [twoStep, setTwoStep] = useState(0);
    const [firstFriend, setFirstFriend] = useState<SajuBirth | null>(null);
    const [faceResult, setFaceResult] = useState<FaceReadingResult | null>(null);
    const [palmResult, setPalmResult] = useState<{result: PalmReadingResult; imageUrl: string | null; hand: 'left' | 'right'} | null>(null);
    const updatePoints = (paid: number, bonus: number) => { points.setPaidPoints(paid); points.setBonusPoints(bonus); };
    const runner = useSajuRunner(theme.personaId, birth, { onPaid: updatePoints, onInsufficient: () => { setNotice('insufficient'); setMenuOpen(false); } });
    const wasNested = useRef(false);
    const chargeForwarded = useRef(false);
    const dialog = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const flow = useRef<HTMLDivElement>(null);
    const birthActions = useRef(birthGate); birthActions.current = birthGate;
    const actions = useRef({onClose, inputKind, partnerFor, twoStep, faceResult, palmResult});
    actions.current = {onClose, inputKind, partnerFor, twoStep, faceResult, palmResult};
    const nested = birthGate.open || inputKind === 'face' || inputKind === 'palm' || !!partnerFor || twoStep > 0 || !!faceResult || !!palmResult;
    // 사진·상대 정보 창이 떠도 도결 머리말(초상·이름)은 보이게 — 실제 머리말 높이만큼 창을 내린다.
    // 머리말은 화면 폭(초상 28vw)과 대화 여부(dg-compact)에 따라 높이가 달라 CSS 고정값으로는 어긋난다.
    useLayoutEffect(() => {
        if (!nested) return;
        const header = dialog.current?.querySelector<HTMLElement>('.dg-header');
        if (header) dialog.current?.style.setProperty('--dg-head', `${header.offsetHeight}px`);
    }, [nested]);
    const pending = runner.loading || isTyping || sending;
    const currentItem = ITEMS.find(i => i[0] === activeKey);
    const cost = points.priceOf('quick-menu');
    useEffect(() => { setDraft(readDraft(draftKey)); }, [draftKey]);
    const changeDraft = (text: string) => { setDraft(text); writeDraft(draftKey, text); };
    const closeInput = () => { setInputKind(null); setPartnerFor(null); setTwoStep(0); setTwoFor(null); setFirstFriend(null); setFaceResult(null); setPalmResult(null); };

    useEffect(() => {
        const previous = document.body.style.overflow;
        const entries = [...document.querySelectorAll<HTMLElement>('.sj-root,.eb-root')];
        const inert = entries.map(e => e.hasAttribute('inert'));
        entries.forEach(e => e.setAttribute('inert', '')); document.body.style.overflow = 'hidden';
        const update = () => dialog.current?.style.setProperty('--dg-vvh', `${window.visualViewport?.height ?? window.innerHeight}px`);
        update(); window.visualViewport?.addEventListener('resize', update);
        const timer = window.setTimeout(() => input.current?.focus(), 40);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopImmediatePropagation();
                const a = actions.current;
                if (birthActions.current.open) birthActions.current.cancel(); else if (a.inputKind || a.partnerFor || a.twoStep || a.faceResult || a.palmResult) closeInput(); else a.onClose();
            }
            if (e.key !== 'Tab') return;
            const host = dialog.current?.querySelector('.dg-child') || dialog.current;
            const nodes = [...(host?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]') || [])].filter(n => n.getClientRects().length > 0);
            if (!nodes.length) return;
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (e.shiftKey && (document.activeElement === first || !host?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (document.activeElement === last || !host?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
            clearTimeout(timer); window.removeEventListener('keydown', onKey, true); window.visualViewport?.removeEventListener('resize', update);
            document.body.style.overflow = previous;
            entries.forEach((e, i) => { if (!inert[i]) e.removeAttribute('inert'); }); opener?.focus();
        };
    }, [opener]);
    useEffect(() => {
        const host = flow.current;
        const target = host?.querySelector<HTMLElement>(notice || runner.error ? '.dg-notice' : runner.result ? '.dg-result' : '.dg-input-panel');
        if (host && target) host.scrollTo({top: target.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop - 20});
        else if (runner.picking || inputKind) host?.scrollTo({top: 0});
        else flow.current?.scrollTo({ top: flow.current.scrollHeight, behavior: 'auto' });
    }, [messages, runner.result, runner.picking, inputKind, notice, runner.error, isTyping]);
    useEffect(() => {
        if (!nested) {
            if (wasNested.current) dialog.current?.querySelector<HTMLElement>('.dg-menutoggle')?.focus();
            wasNested.current = false; return;
        }
        wasNested.current = true;
        const timer = window.setTimeout(() => dialog.current?.querySelector<HTMLElement>('.dg-child button,.dg-child textarea')?.focus(), 40);
        return () => clearTimeout(timer);
    }, [nested, twoStep]);

    useEffect(() => { if (inputKind === 'dream') dialog.current?.querySelector<HTMLTextAreaElement>('#dg-dream')?.focus(); }, [inputKind]);

    // Existing photo modals raise the shared charge modal at z70. Close the entry layers
    // through the existing callback so that charge UI cannot be hidden behind this z90 shell.
    useEffect(() => {
        if (!points.showPointModal) chargeForwarded.current = false;
        if (nested && points.showPointModal && !chargeForwarded.current) {
            chargeForwarded.current = true; onNeedCharge();
        }
    }, [nested, points.showPointModal, onNeedCharge]);

    const mayRun = () => {
        if (pending) return false;
        if (!hideCost && cost !== null && balance < cost) { setMenuOpen(false); setNotice('insufficient'); return false; }
        setNotice(null); return true;
    };
    const chooseMenu = (key: string) => {
        if (pending) return;
        setActiveKey(key); setMenuOpen(false); closeInput(); runner.reset(); setNotice(null);
        const kind = inputKindFor(menus, key);
        if (kind) { setInputKind(kind); return; }
        const menu = sheetMenuFor(menus, key);
        if (!menu) { setNotice('error'); return; }
        if (menu.subMenu || mayRun()) birthGate.requireBirth(needsBirth(key, menu, useBirthInfo), saved => runner.select(menu, saved));
    };
    const submit = async () => {
        const text = draft.trim();
        if (!text || pending || sendingRef.current || inputKind || runner.picking) return;
        if (!hideCost && balance < CHAT_MESSAGE_COST) { setMenuOpen(false); setNotice('insufficient'); return; }
        sendingRef.current = true; setSending(true); setMenuOpen(false); setNotice(null);
        try {
            const result = await onSend(text);
            if (result === 'sent') changeDraft('');
            else { setMenuOpen(false); setNotice(result === 'insufficient' ? 'insufficient' : 'error'); }
        } catch { setNotice('error'); }
        finally { sendingRef.current = false; setSending(false); }
    };
    const letter = (content: React.ReactNode, result = false) => <article className={`dg-letter${result ? ' dg-result' : ''}`}>
        <div className="dg-author"><span className="dg-mini"><img src={theme.fallbackPortrait} alt="" /></span>도결 선생의 글</div>{content}
    </article>;
    const pendingLetter = letter(<><div className="dg-motion" aria-hidden="true"><div className="dg-ink"/><svg viewBox="0 0 180 70"><path className="dg-brush" d="M12 44C42 38 67 24 102 26C132 27 147 24 166 17"/><path className="dg-tip" d="M46 19L34 41L30 48L36 44L51 22Z"/></svg></div><h2 className="dg-writing">풀이를 준비하고 있습니다</h2><p className="dg-note">생각을 한 자 한 자 정리하며<br/>이야기를 살펴보고 있습니다.</p><p className="dg-note" role="status">완성되면 바로 보여드리겠습니다</p></>);
    const emptyGreeting = messages.length === 0 && !pending && !runner.result && !runner.picking && !inputKind && !notice && !runner.error;
    const generalDisabled = pending || !!inputKind || !!runner.picking || nested;

    return <div className="dg-overlay" onMouseDown={e => { if (e.target === e.currentTarget && window.matchMedia('(min-width:768px)').matches && !nested) onClose(); }}>
        <div className="dg-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dg-title">
            <div className={`dg-shell${menuOpen && emptyGreeting ? '' : ' dg-compact'}`} inert={nested ? true : undefined}>
                <header className="dg-header">
                    <div className="dg-portrait"><img src={theme.fallbackPortrait} alt="남색 한복을 입은 도결 선생"/><svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M60 4C87 1 113 26 116 53C123 89 91 119 57 115C24 119 0 88 5 55C1 25 29 1 59 5" stroke="currentColor" strokeWidth="2.4"/><path d="M21 18C4 35 2 67 14 87M100 22C114 38 118 65 108 87M34 112C55 120 82 113 94 103" stroke="currentColor" opacity=".5"/></svg></div>
                    <div className="dg-identity"><p className="dg-caption">{theme.headerCaption}</p><h1 id="dg-title">{theme.displayName}</h1><p className="dg-intro">마음을 들여다보는<br/>차분한 대화의 시간</p></div>
                    <button className="dg-close" onClick={onClose} aria-label="채팅 모달 닫기">×</button>
                </header>
                <div className="dg-flow" ref={flow}>
                    {emptyGreeting && <><p className="dg-time">오늘, 도결 선생과 나누는 이야기</p>{letter(<><p>어서 오세요.<br/>마음에 남은 이야기가 있으신가요?</p><p>급히 답을 찾기보다,<br/>차분히 함께 살펴보겠습니다.</p><p className="dg-note">궁금한 주제를 골라 주세요</p></>)}</>}
                    {messages.map(m => m.role === 'user' ? <div className="dg-user" key={m.id}>{m.text}</div> : <React.Fragment key={m.id}>{letter(<p>{m.text}{m.isStreaming && <span aria-hidden="true">▍</span>}</p>)}</React.Fragment>)}
                    {runner.picking && letter(<><h2>{runner.picking.label}</h2>{runner.picking.subMenu?.dialog && <p>{runner.picking.subMenu.dialog}</p>}<div className="dg-picks">{runner.picking.subMenu?.items?.map(it => <button key={it.label} className="dg-secondary" disabled={pending} onClick={() => {
                        if ((it.partnerModal || it.twoPartnerModal) && !mayRun()) return;
                        if (it.twoPartnerModal) { setTwoFor(it); setFirstFriend(null); setTwoStep(1); }
                        else if (it.partnerModal) setPartnerFor(it);
                        else if (mayRun()) runner.pick(it.label, it.prompt);
                    }}>{it.label}{it.twoPartnerModal ? ' · 두 사람 정보' : it.partnerModal ? ' · 상대 정보' : ''}</button>)}</div><button className="dg-text" onClick={runner.reset}>선택 닫기</button></>)}
                    {inputKind === 'dream' && <div className="dg-input-panel">{letter(<><h2>꿈 이야기를 들려주세요</h2><p className="dg-note">꿈에서 본 장면과 그때의 마음을 기억나는 만큼 적어 주세요.</p><label className="dg-label" htmlFor="dg-dream">꿈 내용을 적어 주세요</label><textarea id="dg-dream" className="dg-dream" value={dream} placeholder={dreamPlaceholder(menus)} onChange={e => setDream(e.target.value)} /><p className="dg-note">{hideCost ? '한 번 보내면 한 번의 풀이를 받습니다.' : `풀이 비용 ${cost === null ? '확인 중' : `${cost}P`} · 한 번 보내면 한 번의 풀이를 받습니다.`}</p><button className="dg-primary" disabled={!dream.trim() || pending} onClick={() => {
                        if (!mayRun()) return;
                        const m = menus.find(x => x.placeholder && inputKindFor([x], 'dream') === 'dream');
                        runner.run(m?.label || '🌙 해몽', `${m?.prompt ? m.prompt + '\n\n' : ''}${dream.trim()}`); setInputKind(null);
                    }}>꿈 풀이 받기</button><button className="dg-text" onClick={() => setInputKind(null)}>입력 닫기</button></>)}</div>}
                    {(runner.loading || isTyping || sending) && pendingLetter}
                    {runner.result && letter(<><p className="dg-note">{currentItem?.[1]} · 도결 선생의 글</p><h2>{runner.result.title.replace(/^[^가-힣A-Za-z0-9]+/, '')}</h2><div className="dg-result-body"><ReactMarkdown components={{img: () => null}}>{runner.result.body}</ReactMarkdown></div><div className="dg-signature"><small>차분한 마음으로</small><span>도결</span></div><button className="dg-text" onClick={runner.reset}>풀이 닫기</button></>, true)}
                    {(notice || runner.error) && <div className="dg-notice">{letter(<div role="alert"><h2>{notice === 'insufficient' ? '포인트가 부족합니다' : '잠시 연결이 끊겼습니다'}</h2><p className="dg-note">{notice === 'insufficient' ? '쓰신 글은 그대로 두었습니다. 충전 후 이어서 보내실 수 있습니다.' : runner.error || '내용을 다시 확인한 뒤 잠시 후 시도해 주세요.'}</p>{notice === 'insufficient' ? <><p className="dg-note">현재 잔액 {balance.toLocaleString()}P</p><button className="dg-primary" onClick={onNeedCharge}>포인트 충전하기</button></> : <button className="dg-secondary" onClick={() => { setNotice(null); runner.reset(); }}>안내 닫기</button>}</div>)}</div>}
                </div>
                <section className="dg-menu" aria-label="상담 주제">
                    {menuOpen ? <><div className="dg-menuheading"><span>무엇을 살펴볼까요</span><button className="dg-text" onClick={() => setMenuOpen(false)}>메뉴 접기</button></div><div className="dg-grid">{ITEMS.map(([key, label, icon]) => <button className="dg-menuitem" key={key} onClick={() => chooseMenu(key)} disabled={pending} aria-pressed={activeKey === key}><Icon name={icon}/><span>{label}</span></button>)}</div></> : <button className="dg-menutoggle" onClick={() => setMenuOpen(true)}><span>{currentItem && <Icon name={currentItem[2]}/>} {currentItem?.[1] || '상담 주제'}{pending ? ' 풀이 중' : ''}</span><span>메뉴 펼치기 ＋</span></button>}
                </section>
                <footer className="dg-compose"><div className="dg-inputrow"><button className="dg-attachment" disabled={pending} onClick={() => { setMenuOpen(true); input.current?.blur(); }} aria-label="사진 상담 메뉴 열기"><Icon name="palm"/></button><textarea ref={input} value={draft} rows={1} disabled={generalDisabled} aria-label="도결 선생에게 질문" placeholder={generalDisabled ? '풀이 후 이어서 물어보세요' : '궁금한 점을 적어 주세요'} onChange={e => { changeDraft(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 110)}px`; }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}/><button className="dg-send" aria-label="메시지 보내기" disabled={generalDisabled || !draft.trim()} onClick={() => void submit()}><SendIcon/></button></div><p className="dg-cost">{!hideCost && <>메시지당 <b>{CHAT_MESSAGE_COST}P</b> · </>}잔액 {balance.toLocaleString()}P</p><button className="dg-full" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button></footer>
            </div>
            <div className="dg-live" aria-live="polite">{!pending ? runner.result?.body || messages.filter(m => m.role !== 'user' && !m.isStreaming).slice(-1)[0]?.text : ''}</div>
            {nested && <div className="dg-child" role="dialog" aria-modal="true" aria-label="도결 상담 입력" onMouseDown={e => e.stopPropagation()}>
                {birthGate.open && <DogyeolBirthForm initial={birth} saving={birthGate.saving} error={birthGate.error} onSave={birthGate.save} onCancel={birthGate.cancel}/>}
                {(inputKind === 'face' || inputKind === 'palm') && <p className="dg-photo-guide">밝은 곳에서 {inputKind === 'face' ? '얼굴 전체' : '손바닥 전체'}가 또렷하게 나오도록 찍어 주세요.</p>}
                {inputKind === 'face' && <FaceReadingModal personaId={theme.personaId} onPointsUpdated={updatePoints} onResult={r => { setFaceResult(r); setInputKind(null); }} onClose={() => setInputKind(null)}/>}
                {inputKind === 'palm' && <PalmReadingModal personaId={theme.personaId} onPointsUpdated={updatePoints} onResult={(result, imageUrl, hand) => { setPalmResult({result, imageUrl, hand}); setInputKind(null); }} onClose={() => setInputKind(null)}/>}
                {faceResult && <FaceReadingResultCard result={faceResult} personaName={theme.displayName} bgUrl="/dogyeol/hanji-background.webp" onClose={() => setFaceResult(null)}/>}
                {palmResult && <PalmReadingResultCard {...palmResult} personaName={theme.displayName} onClose={() => setPalmResult(null)}/>}
                {partnerFor && <PartnerInfoModal onClose={() => setPartnerFor(null)} onComplete={p => { if (mayRun()) { runner.run(partnerFor.label, withPartner(partnerFor.prompt, p)); setPartnerFor(null); } }}/>}
                {twoFor && twoStep > 0 && <PartnerInfoModal key={twoStep} title={twoStep === 1 ? '첫 번째 친구 정보' : '두 번째 친구 정보'} onClose={() => { setTwoFor(null); setTwoStep(0); setFirstFriend(null); }} onComplete={p => {
                    if (twoStep === 1) { setFirstFriend(p); setTwoStep(2); }
                    else if (firstFriend && mayRun()) { runner.run(twoFor.label, withTwoPartners(twoFor.prompt, firstFriend, p)); setTwoStep(0); setTwoFor(null); setFirstFriend(null); }
                }}/>}
            </div>}
        </div>
    </div>;
};
