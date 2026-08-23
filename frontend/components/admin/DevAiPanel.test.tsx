import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/apiService', () => ({
    adminApi: {
        listDevProjects: vi.fn().mockResolvedValue({
            projects: [], concurrency: { running: 0, max: 1, canStart: true },
        }),
        listDevApprovals: vi.fn().mockResolvedValue({ approvals: [] }),
    },
}));

import { DevAiPanel } from './DevAiPanel';

describe('DevAiPanel ThreeUI 선택', () => {
    it('기본 비활성이고 직접 선택 시 5종과 강도를 키보드 버튼으로 제공한다', async () => {
        render(<DevAiPanel />);
        await waitFor(() => expect(screen.getByRole('button', { name: /새 프로젝트/ })).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: /새 프로젝트/ }));
        fireEvent.click(screen.getByRole('button', { name: /홈페이지 요구사항/ }));

        expect(screen.getByRole('button', { name: '사용 안 함' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: '직접 선택' }));

        expect(screen.getAllByRole('button', { name: /Particle Network|Woven Cloth|Condensation|Wireframe Forms|Orbital Sphere/ })).toHaveLength(5);
        expect(screen.getByRole('button', { name: '은은함' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: '강함' }));
        expect(screen.getByRole('button', { name: '강함' }).getAttribute('aria-pressed')).toBe('true');
    });
});
