import React, { useEffect, useRef } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';
import { ARIN_ID } from '../../lib/entryChatThemes';
import { ArinMenu, rememberReturn } from './arinMenu';
import './arinStudio.css';
interface Props { guide: PersonaEntryGuide; onClose: () => void; onStart: (featureKey?: string) => void; onFeature: (key: string) => void; onInvite: () => void; }
export const ArinPromoEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, onInvite }) => {
    const dialog = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.body.style.overflow, opener = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden'; dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (e: KeyboardEvent) => { if (document.querySelector('.arin-chat-overlay')) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab') { const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button') || [])]; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
        };
        window.addEventListener('keydown', onKey); return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); opener?.focus(); };
    }, [onClose]);
    const pick = (key: string) => { if (key === 'reverse-prompt') rememberReturn(guide.personaId || ARIN_ID); onFeature(key); };
    return <div className="arin-entry-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="arin-entry" ref={dialog} role="dialog" aria-modal="true" aria-label="이아린 소개">
            <header className="arin-brand"><span>ARIN<span>.</span></span><button type="button" className="arin-close" onClick={onClose} aria-label="닫기">×</button></header>
            <section className="arin-hero"><div><span className="arin-eyebrow">BEAUTY & CONTENT</span><h1>결과로 보여드려요.</h1><p>만들고, 팔고, 발견하는 즐거움.</p></div><img src="/arin/arin-bust.webp" alt="카페에서 콘텐츠를 만드는 아린" /></section>
            <div className="arin-entry-menu"><ArinMenu onFeature={pick} /></div>
            <footer className="arin-entry-footer"><button type="button" className="arin-primary" onClick={() => onStart()}>대화하기 <span aria-hidden="true">↗</span></button><p className="arin-cost">홍보글 첫 회 무료 · 대화 10P</p><button type="button" className="arin-invite" onClick={onInvite}>친구 초대하고 1,000P 받기</button></footer>
        </div>
    </div>;
};
