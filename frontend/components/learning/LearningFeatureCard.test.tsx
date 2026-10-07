import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MainPageNew } from '../MainPageNew';
import { LearningFeatureCard } from './LearningFeatureCard';
vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user: null }) }));
vi.mock('../../contexts/PointsContext', () => ({ usePoints: () => ({ paidPoints: 100, bonusPoints: 0 }) }));
afterEach(cleanup);
describe('learning feature id 30', () => {
    it('both actual MainPageNew renderers keep the learning-coach execution key', () => {
        const select = vi.fn();
        const { container } = render(<MainPageNew personas={[]} isLoading={false} onSelectPersona={vi.fn()}
            onAdminClick={vi.fn()} onFeatureSelect={select} initialTab="features" spotlightOrder={['learning-coach']} />);
        const cards = container.querySelectorAll('[data-learning-card]');
        expect([...cards].map(card => card.getAttribute('data-learning-card')).sort()).toEqual(['feature', 'home']);
        cards.forEach(card => fireEvent.click(card));
        expect(select.mock.calls).toEqual([['AI 학습코칭', 'learning-coach'], ['AI 학습코칭', 'learning-coach']]);
    });
    it('keyboard, share and favorite are independent of card selection', () => {
        const select = vi.fn(), share = vi.fn(), favorite = vi.fn();
        const { getByLabelText, container } = render(<LearningFeatureCard onSelect={select} onShare={share} onFavorite={favorite} favorite />);
        fireEvent.click(getByLabelText('학습코칭 공유')); fireEvent.click(getByLabelText('학습코칭 즐겨찾기'));
        expect(select).not.toHaveBeenCalled(); expect(share).toHaveBeenCalledOnce(); expect(favorite).toHaveBeenCalledOnce();
        fireEvent.keyDown(container.firstChild!, { key: 'Enter' }); expect(select).toHaveBeenCalledOnce();
    });
});
