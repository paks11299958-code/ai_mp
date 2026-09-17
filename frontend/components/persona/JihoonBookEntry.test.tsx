import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { JihoonBookEntry } from './JihoonBookEntry';

const noop = () => {};

const renderEntry = () => {
    const props = {
        guide: { title: '강지훈', desc: 'AI 작가', personaName: '강지훈' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
    };
    render(<JihoonBookEntry {...props} />);
    return props;
};

describe('JihoonBookEntry', () => {
    beforeEach(() => vi.clearAllMocks());

    it('전자책과 채팅 CTA를 기존 계약으로 연결한다', () => {
        const props = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '내 책 구상하기' }));
        expect(props.onFeature).toHaveBeenCalledWith('ebook');
        expect(props.onStart).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: '강지훈과 대화하기' }));
        expect(props.onStart).toHaveBeenCalledWith();
    });

    it('예시 주제를 바꾸면 목차 미리보기가 갱신된다', () => {
        renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '나의 두 번째 직업' }));
        expect(screen.getByText('마흔, 다시 이름표를 씁니다')).toBeTruthy();
        expect(screen.getByRole('button', { name: '나의 두 번째 직업' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('닫기 버튼과 Escape가 각각 onClose를 호출한다', () => {
        const props = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });
});

describe('PersonaEntrySheet 강지훈 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };

    it('강지훈이면 별빛 책방 진입화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '강지훈', desc: '' }} {...base} />);
        expect(screen.getByRole('heading', { name: /당신의 이야기가/ })).toBeTruthy();
    });

    it('다른 페르소나의 기존 화면을 뺏지 않는다', () => {
        render(<PersonaEntrySheet guide={{ title: '박하진', desc: '' }} {...base} />);
        expect(screen.queryByRole('heading', { name: /당신의 이야기가/ })).toBeNull();
    });
});
