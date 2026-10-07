import React, { useEffect, useRef, useState } from 'react';
import './lampGlow.css';

/**
 * AI 학습코칭 페르소나 카드 그림(밤 서재) 위 스탠드 불빛 층 (2026-10-07 사장 승인).
 * 처음 한 번 "틱틱" 켜지고 이후 5초 간격으로 은은하게 숨쉰다 — 계속 깜빡이지 않는다.
 * 그림 파일은 그대로 두고 screen 혼합으로 빛만 더한다. 화면 밖이면 멈추고,
 * 움직임 줄이기 설정이면 켜진 채 정지한다(CSS).
 */
export const LampGlow: React.FC = () => {
    const ref = useRef<HTMLSpanElement>(null);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const cls = visible ? 'lamp-glow' : 'lamp-glow is-paused';
    return (
        <>
            <span ref={ref} className={cls} aria-hidden="true" />
            <span className={`${cls} lamp-glow-bulb`} aria-hidden="true" />
        </>
    );
};
