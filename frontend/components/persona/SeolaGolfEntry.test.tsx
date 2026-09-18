import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { SeolaGolfEntry } from './SeolaGolfEntry';

const noop = () => {};

const renderEntry = () => {
    const props = {
        guide: { title: '설아', desc: 'AI 골프 코치', personaName: '설아' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
    };
    render(<SeolaGolfEntry {...props} />);
    return props;
};

describe('SeolaGolfEntry', () => {
    beforeEach(() => vi.clearAllMocks());

    it('스윙·골프장·대화 CTA를 기존 계약으로 연결한다', () => {
        const props = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '내 스윙 점검하기' }));
        expect(props.onFeature).toHaveBeenCalledWith('swing');
        fireEvent.click(screen.getByRole('button', { name: '오늘의 코스 찾기' }));
        expect(props.onFeature).toHaveBeenCalledWith('golf-course');
        fireEvent.click(screen.getByRole('button', { name: '설아와 대화하기' }));
        expect(props.onStart).toHaveBeenCalledWith();
    });

    it('예시 클럽을 바꾸면 코칭 노트가 갱신된다', () => {
        renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '아이언' }));
        expect(screen.getByText('아이언의 낮은 지점을 앞으로')).toBeTruthy();
        expect(screen.getByRole('button', { name: '아이언' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('닫기 버튼과 Escape가 각각 onClose를 호출한다', () => {
        const props = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });
});

describe('PersonaEntrySheet 설아 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };

    it('설아면 새벽 티하우스 진입화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '설아', desc: '' }} {...base} />);
        expect(screen.getByRole('heading', { name: /감이 아니라/ })).toBeTruthy();
    });

    it('한 글자 차이인 서아 화면을 뺏지 않는다', () => {
        render(<PersonaEntrySheet guide={{ title: '서아', desc: '' }} {...base} />);
        expect(screen.queryByRole('heading', { name: /감이 아니라/ })).toBeNull();
    });
});
