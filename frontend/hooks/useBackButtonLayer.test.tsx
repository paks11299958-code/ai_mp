import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import { useBackButtonLayer } from './useBackButtonLayer';

// 2026-10-08: 진입화면이 기록을 안 만들어 폰 뒤로가기가 시트를 닫지 않고 사이트를 떠났다.
const pop = () => act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });

let setOpen: (v: boolean) => void = () => {};
const Layer: React.FC<{ onEsc: () => void }> = ({ onEsc }) => {
    const [open, _setOpen] = useState(true);
    setOpen = _setOpen;
    useBackButtonLayer(open);
    useEffect(() => {
        const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onEsc(); };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onEsc]);
    return null;
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('useBackButtonLayer', () => {
    it('열리면 가드 한 칸을 쌓고, 뒤로가기는 Esc 로 바뀐다', () => {
        const push = vi.spyOn(window.history, 'pushState');
        const onEsc = vi.fn(() => setOpen(false));
        render(<Layer onEsc={onEsc} />);
        expect(push).toHaveBeenCalledTimes(1);
        pop();
        expect(onEsc).toHaveBeenCalledTimes(1);
    });

    it('Esc 로 한 단계만 올라가 아직 열려 있으면 가드를 다시 쌓는다', () => {
        vi.useFakeTimers();
        const push = vi.spyOn(window.history, 'pushState');
        render(<Layer onEsc={() => { /* 하위 화면 → 첫 화면, 시트는 그대로 */ }} />);
        pop();
        act(() => { vi.runAllTimers(); });
        expect(push).toHaveBeenCalledTimes(2);
    });

    it('✕ 로 닫히면 남은 가드를 되감는다', () => {
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        render(<Layer onEsc={() => {}} />);
        act(() => setOpen(false));
        expect(back).toHaveBeenCalledTimes(1);
    });
});
