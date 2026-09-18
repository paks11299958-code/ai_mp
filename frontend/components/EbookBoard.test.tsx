import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    list: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
}));

vi.mock('../services/apiService', () => ({ ebookApi: api }));
vi.mock('./HelpButton', () => ({ HelpButton: () => <button type="button">도움말</button> }));

import { EbookBoard } from './EbookBoard';

const books = [
    {
        id: 11,
        topic: '작은 가게 이야기',
        title: '별빛 아래, 작은 가게를 엽니다',
        status: 'draft',
        createdAt: '2026-09-17T00:00:00.000Z',
        updatedAt: '2026-09-17T00:00:00.000Z',
        chapters: [{ no: 1, title: '문을 열기 전', summary: '', sourceStatus: 'done', contentMd: '본문' }],
    },
];

describe('EbookBoard 작업실 모달', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.list.mockResolvedValue(books);
        api.get.mockResolvedValue(books[0]);
    });

    it('메인 진입 화면과 이어지는 모달 안에서 순차 제작 흐름과 내 책을 보여준다', async () => {
        render(<EbookBoard onClose={vi.fn()} />);

        expect(screen.getByRole('dialog', { name: '강지훈의 전자책 작업실' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: '한 권씩, 차근차근 완성해요' })).toBeTruthy();
        expect(screen.getByText('01')).toBeTruthy();
        expect(screen.getByText('02')).toBeTruthy();
        expect(screen.getByText('03')).toBeTruthy();

        expect(await screen.findByRole('button', { name: /^별빛 아래, 작은 가게를 엽니다,/ })).toBeTruthy();
        expect(screen.getByText('3단계 · 초안 완성')).toBeTruthy();
        expect(screen.getByRole('button', { name: '새 책 시작하기' })).toBeTruthy();
    });

    it('책 카드를 누르면 저장된 진행 상태의 다음 단계로 바로 이어간다', async () => {
        render(<EbookBoard onClose={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: /^별빛 아래, 작은 가게를 엽니다,/ }));
        await waitFor(() => expect(api.get).toHaveBeenCalledWith(11));
        expect(await screen.findByText('본문')).toBeTruthy();
    });
});
