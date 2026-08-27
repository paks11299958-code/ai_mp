import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResearchDevPanel } from './ResearchDevPanel';

describe('ResearchDevPanel', () => {
    it('작업 유형을 바꾸면 위험 기능 입력과 자동 리뷰 정책을 보여준다', () => {
        render(<ResearchDevPanel />);
        fireEvent.click(screen.getByRole('button', { name: /3\. 위험 기능/ }));
        expect(screen.getByLabelText(/위험 영역/)).toBeTruthy();
        expect(screen.getByText('Claude 검토 ON')).toBeTruthy();
        expect((screen.getByRole('button', { name: '2. 개발 시작' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('A묶음에서는 입력 준비 후에도 AI 호출 없이 개발 시작을 잠근다', () => {
        render(<ResearchDevPanel />);
        fireEvent.change(screen.getByLabelText(/작업 제목/), { target: { value: '문구 변경' } });
        fireEvent.change(screen.getByLabelText(/대상 저장소·화면/), { target: { value: 'ai_mp 관리자' } });
        fireEvent.click(screen.getByRole('button', { name: /1\. 단순 문구/ }));
        fireEvent.change(screen.getByLabelText(/변경할 문구·관리 화면/), { target: { value: '운영 안내' } });
        fireEvent.change(screen.getByLabelText(/원하는 결과/), { target: { value: '새 문구 표시' } });
        fireEvent.click(screen.getByRole('button', { name: '1. 리서치 시작' }));
        expect(screen.getByRole('status').textContent).toContain('AI를 호출하지 않으며');
        expect((screen.getByRole('button', { name: '2. 개발 시작' }) as HTMLButtonElement).disabled).toBe(true);
    });
});
