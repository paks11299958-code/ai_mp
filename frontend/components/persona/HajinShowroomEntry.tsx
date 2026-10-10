import React, { useEffect, useRef, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';
import { EscToClose } from '../EscToClose';
import { registerHajinEntryChatTheme } from '../../lib/entryChatThemes';
import { HajinMenu } from './hajinMenu';
import './hajinShowroom.css';

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (key: string) => void;
    isGuest?: boolean;
}

const SLIDES = [
    { name: '동네 카페', image: '/hajin/showroom/cafe.webp' },
    { name: '미용실', image: '/hajin/showroom/salon.webp' },
    { name: '공인중개사무소', image: '/hajin/showroom/realty.webp' },
] as const;

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const HajinShowroomEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, isGuest }) => {
    const dialog = useRef<HTMLDivElement>(null);
    const touchStart = useRef<number | null>(null);
    const [slide, setSlide] = useState(0);
    const [motionOff, setMotionOff] = useState(reduceMotion);

    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.current?.querySelector<HTMLElement>('button')?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (document.querySelector('.hj-chat-overlay')) return;
            if (event.key === 'ArrowLeft') setSlide(value => (value + SLIDES.length - 1) % SLIDES.length);
            if (event.key === 'ArrowRight') setSlide(value => (value + 1) % SLIDES.length);
            if (event.key !== 'Tab') return;
            const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || [])];
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); opener?.focus(); };
    }, [onClose]);

    useEffect(() => {
        const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const update = (event: MediaQueryListEvent) => setMotionOff(event.matches);
        query?.addEventListener?.('change', update);
        return () => query?.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
        if (motionOff) return;
        const id = window.setInterval(() => setSlide(value => (value + 1) % SLIDES.length), 4000);
        return () => window.clearInterval(id);
    }, [motionOff]);

    const openChat = () => {
        registerHajinEntryChatTheme(guide.personaId, guide.imageUrl);
        onStart();
    };
    const move = (amount: number) => setSlide(value => (value + amount + SLIDES.length) % SLIDES.length);
    const finishSwipe = (clientX: number) => {
        if (touchStart.current === null) return;
        const distance = clientX - touchStart.current;
        touchStart.current = null;
        if (Math.abs(distance) > 30) move(distance < 0 ? 1 : -1);
    };

    return <div className="hj-entry-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <EscToClose onClose={onClose} />
        <div className="hj-entry" ref={dialog} role="dialog" aria-modal="true" aria-label="박하진 완성작 쇼룸">
            <header className="hj-header">
                <span className="hj-avatar">{guide.imageUrl ? <img src={guide.imageUrl} alt="" /> : '박'}</span>
                <span className="hj-identity"><strong>박하진</strong><small>홈페이지 만드는 웹 파트너</small></span>
                <button type="button" className="hj-icon-button" onClick={onClose} aria-label="닫기">×</button>
            </header>
            <main className="hj-entry-body">
                <div className="hj-intro"><h1>가게를 화면으로.</h1><p>완성작을 먼저 넘겨 보세요</p></div>
                <section className="hj-showroom" aria-roledescription="carousel" aria-label="홈페이지 완성작 예시">
                    <button type="button" className="hj-motion" aria-pressed={motionOff} onClick={() => setMotionOff(value => !value)}>자동 넘김 {motionOff ? '꺼짐' : '켜짐'}</button>
                    <button type="button" className="hj-slide-button hj-prev" aria-label="이전 예시" onClick={() => move(-1)}>‹</button>
                    <div className="hj-phone" onPointerDown={event => { touchStart.current = event.clientX; }} onPointerUp={event => finishSwipe(event.clientX)}>
                        <div className="hj-phone-screen">
                            {SLIDES.map((item, index) => <article key={item.name} className={`hj-slide${index === slide ? ' active' : ''}`} aria-hidden={index !== slide}>
                                <span className="hj-example">[예시]</span><img src={item.image} alt={`${item.name} 홈페이지 예시 화면`} /><span className="hj-slide-label">{item.name}</span>
                            </article>)}
                        </div>
                    </div>
                    <button type="button" className="hj-slide-button hj-next" aria-label="다음 예시" onClick={() => move(1)}>›</button>
                    <div className="hj-dots" aria-label="예시 선택">{SLIDES.map((item, index) => <button key={item.name} type="button" className={index === slide ? 'active' : ''} aria-label={`${item.name} 예시`} onClick={() => setSlide(index)} />)}</div>
                    <p className="hj-sr-only" aria-live="polite">{SLIDES[slide].name} 예시 {slide + 1} / {SLIDES.length}</p>
                </section>
                <div className="hj-menu-heading"><strong>무엇을 도와드릴까요?</strong><span>그림 카드를 눌러 보세요</span></div>
                <HajinMenu onFeature={onFeature} isGuest={isGuest} />
                <button type="button" className="hj-primary" onClick={openChat}>하진에게 물어보기</button>
                <p className="hj-cost">대화 10P · 시안 속 자료는 예시입니다</p>
            </main>
        </div>
    </div>;
};
