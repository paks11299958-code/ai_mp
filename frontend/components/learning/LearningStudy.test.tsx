import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LearningLanding } from './LearningLanding';
import { LearningDashboard } from './LearningDashboard';
import { StudyDeskMotion } from './StudyDeskMotion';
import { learningMenuHref, type TodayResponse } from './learningModel';
const auth = vi.hoisted(() => ({ value: 'ok' }));
vi.mock('../learn/LearnKit', () => ({ useLearnAuth: () => auth.value, goLoginTo: vi.fn() }));
const today: TodayResponse = {
    streak: 3, goal: { id: 'goal', title: '컴퓨터 활용 능력', progressPercent: 35 }, reviewDueCount: 4,
    todayTask: { id: 'task', completedAt: null, score: null, module: { id: 'mod', title: '셀 참조', weekNo: 2, orderNo: 3, status: 'ready' } },
};
let response: TodayResponse;
beforeEach(() => {
    response = structuredClone(today); auth.value = 'ok'; localStorage.setItem('token', 'mock');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('curriculum')
        ? { goal: response.goal, weeks: [{ weekNo: 1, modules: [{ id: '1', completed: true }, { id: '2', completed: false }] }] } : response })));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
describe('approved learning study design', () => {
    it('shows an actual ongoing goal and checklist; keeps all six route contracts', async () => {
        render(<LearningLanding />); await screen.findByRole('heading', { name: today.goal!.title });
        expect(screen.getByRole('region', { name: '오늘 할 일' })).toHaveTextContent('오늘 복습 4개');
        const links = screen.getByRole('navigation', { name: '학습 메뉴' }).querySelectorAll('a');
        expect(links).toHaveLength(6);
        links.forEach((link, i) => expect(link).toHaveAttribute('href', learningMenuHref(i, today)));
        expect(screen.getByText('3일 연속 · 오늘의 과제 배정')).toBeInTheDocument();
    });
    it('guest can still begin a goal without fetching protected learning data', async () => {
        auth.value = 'guest'; render(<LearningLanding />);
        expect(await screen.findByRole('link', { name: '새 학습 시작' })).toHaveAttribute('href', '/learning/onboarding');
        expect(fetch).not.toHaveBeenCalled();
        expect(screen.getByText('목표부터, 차근차근 시작해요')).toBeInTheDocument();
    });
    it('first authenticated user has no invented progress or caption numbers', async () => {
        response = { goal: null, streak: 0, todayTask: null, reviewDueCount: 0 };
        const { container } = render(<LearningLanding />); await screen.findByText('목표부터 가볍게 정해볼까요?');
        expect(container.querySelector('figcaption')!.textContent).not.toMatch(/\d/);
        expect(screen.queryByRole('progressbar')).toBeNull();
    });
    it('completed checklist uses completedAt and preserves a zero score', async () => {
        response.todayTask!.completedAt = '2026-10-07'; response.todayTask!.score = 0;
        render(<LearningDashboard />); expect(await screen.findByText(/점수 0점/)).toBeInTheDocument();
        expect(screen.getByText('오늘 완료')).toBeInTheDocument();
    });
    it('dashboard derives week completion from curriculum and never adds unavailable metrics', async () => {
        const { container } = render(<LearningDashboard />); await screen.findByText('1/2개 완료');
        expect(container.textContent).not.toMatch(/신규 필요|최근 퀴즈|이번 주 학습일|전체 오답 대기/);
        expect(screen.getByRole('progressbar', { name: '1주차 진도' })).toHaveAttribute('aria-valuenow', '1');
    });
    it('keeps the report fallback within dashboard and explains it', async () => {
        window.history.pushState({}, '', '/learning/dashboard?report=unavailable');
        render(<LearningDashboard />); expect(screen.getByText('아직 연결된 주간 리포트가 없어요.')).toBeInTheDocument();
    });
    it('motion is inline, pause is explicit, and absent data produces no fabricated caption', () => {
        const { container } = render(<StudyDeskMotion />); expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('svg')).not.toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '모션 정지' }));
        expect(container.querySelector('figure')).toHaveAttribute('data-paused', 'true');
        expect(container.querySelector('figcaption')!.textContent).not.toMatch(/\d/);
    });
});
