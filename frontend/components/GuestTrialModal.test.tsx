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

describe('GuestTrialModal 진입화면 안내(notice)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('notice 가 없으면 종전처럼 z-60 이고 회원가입 버튼·안내 배너가 없다(회귀)', () => {
        const { container } = render(<GuestTrialModal {...props()} />);
        expect(container.firstElementChild?.className).toContain('z-[60]');
        expect(screen.queryByTestId('guest-notice')).toBeNull();
        expect(screen.queryByRole('button', { name: '무료 회원가입' })).toBeNull();
        expect(screen.getByRole('heading', { name: 'AI 놀이터 체험하기' })).toBeTruthy();
    });

    it('paid: 유료 안내 + 기능명 + 회원가입 버튼(onRegister), 진입화면(z-85)보다 위', () => {
        const p = props();
        const { container } = render(<GuestTrialModal {...p} notice="paid" feature={{ name: '헤어 체인지' }} />);
        expect(container.firstElementChild?.className).toContain('z-[95]');
        expect(screen.getByText('💎 유료 서비스예요')).toBeTruthy();
        expect(screen.getByText(/헤어 체인지는 포인트로 이용하는 기능이에요/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '무료 회원가입' }));
        expect(p.onRegister).toHaveBeenCalledTimes(1);
        // 체험·로그인 경로도 유지
        expect(screen.getByRole('button', { name: '1,000P 받고 바로 체험하기' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '이미 회원이신가요? 로그인' })).toBeTruthy();
    });

    it('free: 무료 안내 + 회원가입 버튼', () => {
        const p = props();
        render(<GuestTrialModal {...p} notice="free" feature={{ name: '닮은꼴 찾기' }} />);
        expect(screen.getByText('✨ 무료로 이용할 수 있어요')).toBeTruthy();
        expect(screen.queryByText('💎 유료 서비스예요')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '무료 회원가입' }));
        expect(p.onRegister).toHaveBeenCalledTimes(1);
    });

    it('chat: 페르소나 이름과 조사를 넣는다(은비와 / 도결 선생과)', () => {
        const { unmount } = render(<GuestTrialModal {...props()} notice="chat" personaName="신은비" />);
        expect(screen.getByText('💬 신은비와의 대화는 무료예요')).toBeTruthy();
        expect(screen.getByRole('heading', { name: '신은비와 대화하기' })).toBeTruthy();
        unmount();
        render(<GuestTrialModal {...props()} notice="chat" personaName="도결 선생" />);
        expect(screen.getByText('💬 도결 선생과의 대화는 무료예요')).toBeTruthy();
    });

    it('notice + 체험 만료면 회원가입 버튼이 주 버튼 하나만 나온다', () => {
        const p = props();
        render(<GuestTrialModal {...p} notice="paid" expired />);
        expect(screen.getAllByRole('button', { name: '무료 회원가입' })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: '무료 회원가입' }));
        expect(p.onRegister).toHaveBeenCalledTimes(1);
    });
});
