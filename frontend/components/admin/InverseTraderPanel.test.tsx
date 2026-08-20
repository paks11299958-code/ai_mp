/**
 * 인버스 자동매매 어드민 탭 — 렌더 + 폴링 안전성 검증.
 *
 * 왜 필요한가: 빌드(타입체크)는 TDZ·훅 순서·인터벌 누수를 잡지 못한다. 과거에 setInterval
 * 재진입을 막지 않아 같은 작업이 중복 실행된 사고가 있었으므로, 화면이 실제로 마운트되고
 * ① 재진입이 차단되는지 ② 언마운트 시 인터벌이 정리되는지를 렌더 테스트로 확인한다.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const getInverseStatus = vi.fn();
const tickInverseSession = vi.fn();

vi.mock('../../services/apiService', () => ({
    adminApi: {
        getInverseStatus: (...a: any[]) => getInverseStatus(...a),
        tickInverseSession: (...a: any[]) => tickInverseSession(...a),
        startInverseSession: vi.fn(),
        stopInverseSession: vi.fn(),
        emergencyStopInverse: vi.fn(),
        settleInverseNow: vi.fn(),
        saveInverseConfig: vi.fn(),
    },
}));

import { InverseTraderPanel } from './InverseTraderPanel';

function snapshot(overrides: any = {}) {
    return {
        ok: true,
        tradingMode: 'SIMULATION',
        config: {
            symbol: '252670', symbolName: 'KODEX 200선물인버스2X', defaultQty: 100,
            closeBufferMin: 10, maxPositionQty: 1000, dailyLossLimit: 500000,
            tradingMode: 'SIMULATION', enabled: true,
        },
        session: { id: 's1', status: 'RUNNING', startedAt: null, endedAt: null, lastError: null, isLive: true },
        engine: {
            hasRuntime: true, tickCount: 3, lastTickAt: null, intervalMs: 0,
            settlementRunning: false, settlementDone: false, inSettlementWindow: false,
            kstMinutes: 600, marketCloseMinutes: 930, logs: [],
        },
        quote: { symbol: '252670', bidPrice: 5000, bidQty: 300, askPrice: 5005, askQty: 400, lastPrice: 5000, ts: new Date().toISOString(), source: '가상 호가 생성기(SIMULATED)' },
        position: { symbol: '252670', qty: 100, avgPrice: 4995, realizedPnl: 2500, unrealizedPnl: -500, totalPnl: 2000 },
        orders: [{ id: 1, side: 'BUY', limitPrice: 4995, orderQty: 100, filledQty: 30, remainingQty: 70, status: 'PARTIAL', parentOrderId: null, createdAt: new Date().toISOString() }],
        fills: [{ id: 1, orderId: 1, side: 'BUY', fillPrice: 4995, fillQty: 30, filledAt: new Date().toISOString() }],
        today: { stat: null, forceSettled: null, closingQty: 0, settlementFailed: false, warning: null },
        ...overrides,
    };
}

describe('InverseTraderPanel', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        getInverseStatus.mockReset();
        tickInverseSession.mockReset();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('상태를 받아 배지·호가·포지션·주문·체결을 렌더한다', async () => {
        getInverseStatus.mockResolvedValue(snapshot());
        await act(async () => { render(<InverseTraderPanel />); });

        expect(screen.getByText(/실행중\(RUNNING\)/)).toBeTruthy();
        // ★가상매매 전용 배지는 반드시 보여야 한다(실거래로 오인 방지)
        expect(screen.getByText(/가상매매 전용\(SIMULATION\)/)).toBeTruthy();
        expect(screen.getByText('① 현재가 · 1호가')).toBeTruthy();
        expect(screen.getByText('② 포지션 · 손익')).toBeTruthy();
        expect(screen.getByText('③ 주문목록')).toBeTruthy();
        expect(screen.getByText('④ 체결내역')).toBeTruthy();
        expect(screen.getByText('⑤ 설정')).toBeTruthy();
        expect(screen.getByText('PARTIAL')).toBeTruthy();
    });

    it('강제정산 실패 시 상단 경고 배너를 띄운다', async () => {
        getInverseStatus.mockResolvedValue(snapshot({
            today: { stat: null, forceSettled: false, closingQty: 70, settlementFailed: true, warning: '★당일 강제정산 실패 — 잔여수량 70주가 남아 있습니다.' },
        }));
        await act(async () => { render(<InverseTraderPanel />); });
        expect(screen.getByText(/강제정산 실패 — 포지션이 남아 있습니다/)).toBeTruthy();
        expect(screen.getByText(/잔여수량 70주/)).toBeTruthy();
    });

    it('앞선 폴링이 끝나지 않으면 다음 주기를 건너뛴다(재진입 방지)', async () => {
        let release: (v: any) => void = () => {};
        getInverseStatus.mockImplementation(() => new Promise(res => { release = res; }));

        await act(async () => { render(<InverseTraderPanel />); });
        expect(getInverseStatus).toHaveBeenCalledTimes(1);   // 최초 1회

        // 응답이 오지 않은 채로 인터벌이 세 번 더 돌아도 추가 호출이 없어야 한다.
        await act(async () => { vi.advanceTimersByTime(5000 * 3); });
        expect(getInverseStatus).toHaveBeenCalledTimes(1);

        await act(async () => { release(snapshot()); });
        await act(async () => { vi.advanceTimersByTime(5000); });
        expect(getInverseStatus).toHaveBeenCalledTimes(2);   // 잠금이 풀린 뒤에야 다음 호출
    });

    it('언마운트하면 인터벌이 정리되어 더 이상 호출하지 않는다', async () => {
        getInverseStatus.mockResolvedValue(snapshot());
        let unmount!: () => void;
        await act(async () => { unmount = render(<InverseTraderPanel />).unmount; });
        expect(getInverseStatus).toHaveBeenCalledTimes(1);

        act(() => { unmount(); });
        await act(async () => { vi.advanceTimersByTime(5000 * 5); });
        expect(getInverseStatus).toHaveBeenCalledTimes(1);
    });
});
