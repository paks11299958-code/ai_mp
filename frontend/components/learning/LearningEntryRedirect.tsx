import React, { useEffect } from 'react';

/**
 * AI 학습코칭 페르소나 카드 → 전용 진입 화면(/learning)으로 보낸다 (2026-10-07 사장 지적).
 * 진입 화면은 App 얼리리턴 독립 라우트라 시트 안에 그릴 수 없다 — 기능 카드와 같은 경로로 맞춘다.
 * location.assign 이라 뒤로가기를 누르면 메인으로 돌아온다. 공부 책상의 ✕ 는 learningNav 로 기록을 되감는다.
 */
export const LearningEntryRedirect: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    useEffect(() => { window.location.assign('/learning'); }, []);
    // 공부 책상에서 뒤로 왔는데 브라우저가 이 메인 화면을 그대로 되살리면(bfcache) "가는 중…" 가림막이
    // 남아 메인을 덮는다 — 되살아난 순간 시트를 닫는다(2026-10-08).
    useEffect(() => {
        const onShow = (e: PageTransitionEvent) => { if (e.persisted) onClose?.(); };
        window.addEventListener('pageshow', onShow);
        return () => window.removeEventListener('pageshow', onShow);
    }, [onClose]);
    return (
        <div role="status" aria-live="polite"
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#f5efe6', display: 'grid', placeItems: 'center',
                color: '#2b5948', fontSize: 15, fontWeight: 600 }}>
            공부 책상으로 가는 중…
        </div>
    );
};
