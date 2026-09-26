import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { guestRegister } = vi.hoisted(() => ({ guestRegister: vi.fn() }));
vi.mock('../services/apiService', () => ({ authApi: { guestRegister } }));

import { GuestTrialModal } from './GuestTrialModal';

const props = () => ({
    onSuccess: vi.fn(), onExpired: vi.fn(), onRegister: vi.fn(), onLogin: vi.fn(), onClose: vi.fn(),
});

describe('GuestTrialModal 체험 1회 제한', () => {
    beforeEach(() => vi.clearAllMocks());

    it('체험 이력이 있으면 포인트 지급 대신 만료 안내와 회원가입을 보여준다', () => {
        const p = props();
        render(<GuestTrialModal {...p} expired />);

        expect(screen.getByRole('heading', { name: '체험이 만료되었습니다' })).toBeTruthy();
        expect(screen.queryByText(/1,000P 무료 지급/)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '무료 회원가입' }));
        expect(p.onRegister).toHaveBeenCalledTimes(1);
        expect(guestRegister).not.toHaveBeenCalled();
    });

    it('서버가 이미 사용한 체험으로 거절하면 즉시 만료 안내로 전환한다', async () => {
        const p = props();
        guestRegister.mockRejectedValue({ body: { code: 'GUEST_TRIAL_USED' } });
        render(<GuestTrialModal {...p} />);

        fireEvent.click(screen.getByRole('button', { name: '1,000P 받고 바로 체험하기' }));
        expect(await screen.findByRole('heading', { name: '체험이 만료되었습니다' })).toBeTruthy();
        await waitFor(() => expect(p.onExpired).toHaveBeenCalledTimes(1));
        expect(p.onSuccess).not.toHaveBeenCalled();
    });
});
