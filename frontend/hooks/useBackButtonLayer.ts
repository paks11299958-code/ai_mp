import { useEffect, useRef } from 'react';

/**
 * 진입화면·전용 채팅이 떠 있는 동안 **폰 뒤로가기 = 그 화면의 Esc(한 단계 위로)** 로 만든다(2026-10-08 사장 지시).
 *
 * 전엔 이 레이어들이 방문 기록을 만들지 않아, 뒤로가기를 누르면 레이어가 닫히는 대신
 * 사이트를 떠나거나 직전 페이지(예: 공부 책상)로 넘어갔다.
 *
 * 방식: 레이어가 열리면 기록 한 칸(가드)을 쌓는다. 뒤로가기로 가드가 빠지면 Escape 를 보내
 *   각 화면이 이미 가진 "한 단계 위로" 처리(하위 화면→첫 화면→닫기, 분석·결제 중엔 머묾)를 그대로 쓴다.
 *   아직 열려 있으면 가드를 다시 쌓는다. ✕ 등으로 닫히면 남은 가드를 되감아 기록을 깨끗이 둔다.
 */
export const useBackButtonLayer = (active: boolean) => {
    const activeRef = useRef(active);
    activeRef.current = active;
    const pushed = useRef(false);
    const unwinding = useRef(false);

    const pushGuard = () => {
        try {
            window.history.pushState({ ...(window.history.state || {}), aiLayer: true }, '');
            pushed.current = true;
        } catch { /* 기록 조작이 막힌 환경 — 뒤로가기만 종전처럼 동작 */ }
    };

    useEffect(() => {
        if (active && !pushed.current && !unwinding.current) pushGuard();
        if (!active && pushed.current) {
            pushed.current = false;
            if ((window.history.state as { aiLayer?: boolean } | null)?.aiLayer) {
                unwinding.current = true;
                window.history.back();
            }
        }
    }, [active]);

    useEffect(() => {
        const onPop = () => {
            if (unwinding.current) {
                // 우리가 되감은 것 — 그 사이 다시 열렸으면 가드를 새로 쌓는다.
                unwinding.current = false;
                if (activeRef.current && !pushed.current) pushGuard();
                return;
            }
            if (!pushed.current) return;
            pushed.current = false;
            if (!activeRef.current) return;
            const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
            target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
            // 한 단계만 올라가 아직 열려 있으면 다음 뒤로가기를 위해 가드를 다시 쌓는다.
            // (곧 닫히면 위 effect 가 이 가드를 되감는다)
            window.setTimeout(() => { if (activeRef.current && !pushed.current && !unwinding.current) pushGuard(); }, 0);
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
};
