import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ChaewonDeskEntry } from './ChaewonDeskEntry';

const scroll = vi.fn();
const props = { guide: { title: '윤채원', desc: '' }, onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn() };
beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = scroll;
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ markets: [], fx: null, candles: [], picks: [], available: false }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('채원 1안 진입', () => {
    it('전광판 → 메뉴 → 정보, 뉴스 → 관심 종목 → 가상매매 순서다', async () => {
        const { container } = render(<ChaewonDeskEntry {...props} />);
        await screen.findByText('오늘의 기록이 아직 없습니다.');
        const before = (a: string, b: string) => expect(container.querySelector(a)!.compareDocumentPosition(container.querySelector(b)!))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        before('.cd-board', '.cd-actions'); before('.cd-actions', '.cd-divider'); before('.cd-divider', '.cd-information');
        const info = [...container.querySelectorAll('.cd-sec')].map(node => node.textContent);
        expect(info[0]).toContain('증권 탑뉴스'); expect(info[1]).toContain('AI 관심 종목'); expect(info[2]).toContain('가상매매 성적');
    });
    it('세 메뉴는 분석·스크롤·대화 콜백에 연결되고 정보와 다른 클래스다', () => {
        const { container } = render(<ChaewonDeskEntry {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /내 종목 분석/ }));
        expect(props.onFeature).toHaveBeenCalledWith('stock');
        fireEvent.click(screen.getByRole('button', { name: /AI 관심 종목/ })); expect(scroll).toHaveBeenCalled();
        expect(container.querySelector('.cd-picks')).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: /채원과 대화/ })); expect(props.onStart).toHaveBeenCalledWith();
        expect(container.querySelectorAll('.cw-action')).toHaveLength(3);
        expect(container.querySelector('.cd-sec')!.classList.contains('cw-action')).toBe(false);
    });
    it('없는 데이터에 수치나 캔들을 만들지 않고 면책을 유지한다', async () => {
        const { container } = render(<ChaewonDeskEntry {...props} />);
        await screen.findByText('가상매매 기록이 아직 없습니다.');
        expect(container.querySelectorAll('.cd-cd')).toHaveLength(0);
        expect(container.querySelectorAll('.cd-rv')).toHaveLength(0);
        expect(screen.getByText('투자 권유가 아닙니다.')).toBeInTheDocument();
    });
    it('채팅에서 관심 종목을 지정하면 해당 섹션으로 이동한다', () => {
        render(<ChaewonDeskEntry {...props} guide={{ ...props.guide, chaewonSection: 'picks' }} />);
        expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    });
    it('뉴스 탭 전환은 추가 API 호출을 만들지 않는다', async () => {
        render(<ChaewonDeskEntry {...props} />);
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
        fireEvent.click(screen.getAllByRole('tab')[1]); expect(fetch).toHaveBeenCalledTimes(5);
    });
});
