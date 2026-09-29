import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../services/apiService', () => ({ personaVideoApi: { getAll: vi.fn(async () => []) } }));
import { PersonaImageViewer } from './PersonaImageViewer';

const imgs: any[] = [
    { id: 1, personaId: 'p', imageUrl: '/main.jpg', description: '메인', isMain: true, order: 0, requiredLevel: 1 },
    { id: 2, personaId: 'p', imageUrl: '/second.jpg', description: '두번째', isMain: false, order: 1, requiredLevel: 1 },
];

describe('PersonaImageViewer 감정 사진(mainOverrideUrl)', () => {
    it('없으면 종전 그대로 — 메인 칸은 원본', () => {
        render(<PersonaImageViewer images={imgs} onSelectMain={vi.fn()} userXp={0} newUi />);
        expect(screen.getByAltText('메인').getAttribute('src')).toBe('/main.jpg');
    });

    it('있으면 메인 칸만 감정 사진, 다른 칸은 원본', () => {
        render(<PersonaImageViewer images={imgs} onSelectMain={vi.fn()} userXp={0} newUi mainOverrideUrl="/eunbi/emo/happy.jpg" />);
        expect(screen.getByAltText('메인').getAttribute('src')).toBe('/eunbi/emo/happy.jpg');
        expect(screen.getByAltText('두번째').getAttribute('src')).toBe('/second.jpg');
    });

    it('감정 사진 메인 칸을 누르면 지금 표정을 크게 — 메인 교체(onSelectMain) 안 함', () => {
        const onSelect = vi.fn();
        render(<PersonaImageViewer images={imgs} onSelectMain={onSelect} userXp={0} newUi mainOverrideUrl="/eunbi/emo/happy.jpg" />);
        fireEvent.click(screen.getByAltText('메인'));
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getAllByAltText('메인').map(e => e.getAttribute('src'))).toEqual(['/eunbi/emo/happy.jpg', '/eunbi/emo/happy.jpg']);
    });

    it('다른 사진을 누르면 종전처럼 메인 교체', () => {
        const onSelect = vi.fn();
        render(<PersonaImageViewer images={imgs} onSelectMain={onSelect} userXp={0} newUi mainOverrideUrl="/eunbi/emo/happy.jpg" />);
        fireEvent.click(screen.getByAltText('두번째'));
        expect(onSelect).toHaveBeenCalledWith(imgs[1]);
    });
});
