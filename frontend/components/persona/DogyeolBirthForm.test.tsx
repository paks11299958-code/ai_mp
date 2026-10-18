import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DogyeolBirthForm, BIRTH_TIMES, BIRTH_TIME_LABELS } from './DogyeolBirthForm';

describe('DogyeolBirthForm 태어난 시 표시', () => {
    it('선택지마다 시간대가 보이고 저장값은 간지 이름 그대로다', () => {
        const onSave = vi.fn();
        render(<DogyeolBirthForm initial={null} saving={false} error="" onSave={onSave} onCancel={() => {}} />);
        const select = screen.getByLabelText('태어난 시') as HTMLSelectElement;
        const options = [...select.options];
        expect(options).toHaveLength(13);
        expect(options.map(o => o.value)).toEqual([...BIRTH_TIMES]);
        expect(options.map(o => o.textContent)).toEqual([...BIRTH_TIME_LABELS]);
        expect(options[1].textContent).toContain('밤 11시~새벽 1시');
        expect(options[12].textContent).toContain('밤 9~11시');
        expect(options[0].textContent).toBe('모름');
        fireEvent.change(select, { target: { value: '해시(亥時)' } });
        fireEvent.change(screen.getByLabelText('이름'), { target: { value: '테스트' } });
        fireEvent.change(screen.getByLabelText('태어난 해'), { target: { value: '1990' } });
        fireEvent.change(screen.getByLabelText('태어난 달'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('태어난 날'), { target: { value: '2' } });
        fireEvent.click(screen.getByText('저장하고 이어가기'));
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0][0].time).toBe('해시(亥時)');
    });
    it('안내 문구에 자시 예시가 있다', () => {
        render(<DogyeolBirthForm initial={null} saving={false} error="" onSave={() => {}} onCancel={() => {}} />);
        expect(screen.getByText(/밤 11시 30분 출생 → 자시/)).toBeTruthy();
    });
});
