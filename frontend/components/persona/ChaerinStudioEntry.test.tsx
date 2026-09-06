import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChaerinStudioEntry } from './ChaerinStudioEntry';
import { PersonaEntrySheet } from '../PersonaEntrySheet';

// 윤채린 AI 스튜디오 진입화면 (2026-09-06 신설).
//
// ★이 테스트가 지키는 계약:
//   1. 기능 버튼이 **App.tsx 가 아는 키**를 넘긴다 — 키가 틀리면 눌러도 아무 일이 없다.
//   2. 윤채린일 때만 이 화면이 뜬다 — 다른 페르소나의 기존 화면을 뺏으면 전면 장애다.
//   3. 채팅·닫기·초대가 각자 제 콜백을 부른다.

const noop = () => {};

const renderEntry = (over: Partial<React.ComponentProps<typeof ChaerinStudioEntry>> = {}) => {
    const props = {
        guide: { title: '윤채린', desc: '뷰티 컨설턴트', personaName: '윤채린' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
        ...over,
    };
    render(<ChaerinStudioEntry {...props as any} />);
    return props as any;
};

describe('ChaerinStudioEntry', () => {
    beforeEach(() => vi.clearAllMocks());

    it('촬영 메뉴 4종이 App.tsx 와 같은 기능키를 넘긴다', () => {
        const p = renderEntry();
        // ★키는 App.tsx FEATURE_ACTIONS·분기와 실측으로 맞춘 값이다.
        //   agetransform(461줄) · hair/outfit/lookalike(1745줄 분기).
        const cases: [string, string][] = [
            ['시간여행', 'agetransform'],
            ['헤어스타일', 'hair'],
            ['전통의상', 'outfit'],
            ['닮은꼴', 'lookalike'],
        ];
        for (const [label, key] of cases) {
            p.onFeature.mockClear();
            fireEvent.click(screen.getByText(label));
            expect(p.onFeature, `${label} → ${key}`).toHaveBeenCalledWith(key);
        }
    });

    it('AI 변신 카드도 기능으로 연결된다(빈 클릭이 아니다)', () => {
        const p = renderEntry();
        fireEvent.click(screen.getByText('헤어 체인지'));
        expect(p.onFeature).toHaveBeenCalledWith('hair');
    });

    it('상담 버튼은 채팅(onStart), 닫기·초대는 각자 콜백', () => {
        const p = renderEntry();
        fireEvent.click(screen.getByText('윤채린에게 물어보기'));
        expect(p.onStart).toHaveBeenCalled();
        expect(p.onFeature).not.toHaveBeenCalled();   // 상담은 기능 실행이 아니다

        fireEvent.click(screen.getByLabelText('닫기'));
        expect(p.onClose).toHaveBeenCalled();

        fireEvent.click(screen.getByText('친구 초대하고 포인트 받기'));
        expect(p.onInvite).toHaveBeenCalled();
    });

    it('예시 인물이 AI 가상 이미지임을 화면에 밝힌다', () => {
        renderEntry();
        expect(screen.getByText(/AI로 만든 가상 이미지/)).toBeTruthy();
    });
});

describe('PersonaEntrySheet 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };

    it('윤채린이면 AI 스튜디오 화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '윤채린', desc: '' }} {...base} />);
        expect(screen.getByText('CHAERIN AI STUDIO')).toBeTruthy();
    });

    it('★다른 페르소나의 기존 화면을 뺏지 않는다', () => {
        // 이게 깨지면 전면 장애다 — 접두사 매칭이 과하게 잡히는지 확인한다.
        render(<PersonaEntrySheet guide={{ title: '유나', desc: '타로' }} {...base} />);
        expect(screen.queryByText('CHAERIN AI STUDIO')).toBeNull();
    });
});
