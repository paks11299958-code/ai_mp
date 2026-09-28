import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { EunbiEntry } from './EunbiEntry';

const noop = () => {};

const renderEntry = () => {
    const props = {
        guide: { title: '신은비', desc: '웹툰 은비', personaName: '신은비' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
    };
    const view = render(<EunbiEntry {...props} />);
    return { props, view };
};

describe('EunbiEntry', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.useRealTimers());

    it('AI 채팅과 이야기 시작하기(인라인·하단 고정)는 onStart를 인자 없이 부른다', () => {
        const { props } = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: 'AI 채팅' }));
        const ctas = screen.getAllByRole('button', { name: '은비와 이야기 시작하기 ♥', hidden: true });
        expect(ctas).toHaveLength(2);
        ctas.forEach(b => fireEvent.click(b));
        expect(props.onStart).toHaveBeenCalledTimes(3);
        props.onStart.mock.calls.forEach(call => expect(call).toEqual([]));
        expect(props.onFeature).not.toHaveBeenCalled();
    });

    it('헤어 체인지는 hair, 프로필 화보는 outfit 보드를 연다', () => {
        const { props } = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '헤어 체인지' }));
        fireEvent.click(screen.getByRole('button', { name: '프로필 화보' }));
        expect(props.onFeature.mock.calls).toEqual([['hair'], ['outfit']]);
        expect(props.onStart).not.toHaveBeenCalled();
        expect(screen.getByText('내 사진으로 새 헤어 미리보기')).toBeTruthy();
        expect(screen.getByText('내 얼굴로 실사·지브리 프사')).toBeTruthy();
    });

    it('준비 중 기능과 웹툰은 콜백 없이 토스트만 띄운다', () => {
        const { props } = renderEntry();
        const status = screen.getByRole('status');
        for (const name of [/^스토리 모드/, /^선물하기/, /^말투 변형/, /^이모티콘/]) {
            fireEvent.click(screen.getByRole('button', { name }));
            expect(status.textContent).toBe('곧 만나요! 준비 중이에요');
        }
        for (const name of [/^웹툰 보기/, /^웹툰 《은비》/, /^은비 웹툰/]) {
            fireEvent.click(screen.getByRole('button', { name }));
            expect(status.textContent).toContain('은비 웹툰 곧 연재');
        }
        expect(props.onStart).not.toHaveBeenCalled();
        expect(props.onFeature).not.toHaveBeenCalled();
    });

    it('닫기 버튼과 Escape가 각각 onClose를 호출한다', () => {
        const { props } = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('모든 버튼은 type=button이고 로그인·회원가입이 없다', () => {
        renderEntry();
        screen.getAllByRole('button', { hidden: true }).forEach(b => expect(b.getAttribute('type')).toBe('button'));
        expect(screen.queryByRole('button', { name: /로그인|회원가입/ })).toBeNull();
    });

    it('언마운트하면 Escape 리스너·말풍선 타이머가 해제된다', () => {
        vi.useFakeTimers();
        const { props, view } = renderEntry();
        view.unmount();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('말풍선 대사가 순환한다', () => {
        vi.useFakeTimers();
        renderEntry();
        expect(screen.getByText('안녕~ 난 은비야!')).toBeTruthy();
        act(() => { vi.advanceTimersByTime(2800 + 300); });
        expect(screen.getByText('오늘 하루 어땠어?')).toBeTruthy();
    });

    it('폰트 link는 여러 번 열어도 한 번만 삽입된다', () => {
        renderEntry().view.unmount();
        renderEntry();
        expect(document.querySelectorAll('link#eb-fonts')).toHaveLength(1);
    });
});

describe('PersonaEntrySheet 신은비 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };
    const isEunbi = () => !!screen.queryByRole('dialog', { name: '웹툰 은비 진입화면' });

    it('신은비면 웹툰 은비 진입화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '' }} {...base} />);
        expect(isEunbi()).toBe(true);
    });

    it('기능 링크(autoRunFeatureKey)로 오면 기본 시트를 유지한다', () => {
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '', autoRunFeatureKey: 'luxury' }} {...base} />);
        expect(isEunbi()).toBe(false);
        expect(screen.getByRole('dialog', { name: '신은비 소개' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /시작하기/ })).toBeTruthy();
    });

    it('다른 페르소나는 은비 화면이 아니다', () => {
        render(<PersonaEntrySheet guide={{ title: '박하진', desc: '' }} {...base} />);
        expect(isEunbi()).toBe(false);
    });
});
