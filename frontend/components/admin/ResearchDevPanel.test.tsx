import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchDevPanel } from './ResearchDevPanel';

const api = vi.hoisted(() => ({
    createDevProject: vi.fn().mockResolvedValue({project:{id:'p-v2'}}),
    startDevProject: vi.fn().mockResolvedValue({started:true,id:'p-v2',message:'시작됨'}),
}));
vi.mock('../../services/apiService', () => ({adminApi:api}));

describe('ResearchDevPanel', () => {
    beforeEach(()=>{vi.clearAllMocks(); vi.spyOn(window,'confirm').mockReturnValue(true);});
    it('작업 유형을 바꾸면 위험 기능 입력과 자동 리뷰 정책을 보여준다', () => {
        render(<ResearchDevPanel />);
        fireEvent.click(screen.getByRole('button', { name: /3\. 위험 기능/ }));
        expect(screen.getByLabelText(/위험 영역/)).toBeTruthy();
        expect(screen.getByText('Claude 검토 ON')).toBeTruthy();
        expect((screen.getByRole('button', { name: '2. 개발 시작' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('명세 저장 뒤에만 V2 개발 시작을 허용한다', async () => {
        render(<ResearchDevPanel />);
        fireEvent.change(screen.getByLabelText(/작업 제목/), { target: { value: '문구 변경' } });
        fireEvent.change(screen.getByLabelText(/대상 저장소·화면/), { target: { value: 'ai_mp 관리자' } });
        fireEvent.click(screen.getByRole('button', { name: /1\. 단순 문구/ }));
        fireEvent.change(screen.getByLabelText(/변경할 문구·관리 화면/), { target: { value: '운영 안내' } });
        fireEvent.change(screen.getByLabelText(/원하는 결과/), { target: { value: '새 문구 표시' } });
        fireEvent.click(screen.getByRole('button', { name: '1. 리서치 준비' }));
        await waitFor(()=>expect(api.createDevProject).toHaveBeenCalledTimes(1));
        const body=api.createDevProject.mock.calls[0][0];
        expect(JSON.parse(body.brief)).toEqual({hermesV2:true,workType:'simple'});
        expect(body.useReview).toBe(false);
        const start=screen.getByRole('button', { name: '2. 개발 시작' }) as HTMLButtonElement;
        expect(start.disabled).toBe(false);
        fireEvent.click(start);
        await waitFor(()=>expect(api.startDevProject).toHaveBeenCalledWith('p-v2'));
    });
});
