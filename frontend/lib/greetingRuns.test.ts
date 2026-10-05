import { describe, it, expect } from 'vitest';
import { collapseGreetingRuns } from './greetingRuns';

const m = (id: string, role: string) => ({ id, role, text: id });

describe('collapseGreetingRuns — 과거 누적 인사 접기(화면만)', () => {
    it('연속된 인사는 마지막 하나만 남긴다', () => {
        expect(collapseGreetingRuns([m('g1', 'assistant'), m('g2', 'assistant'), m('g3', 'assistant')]).map(x => x.id)).toEqual(['g3']);
    });
    it('대화 사이의 인사·실제 답변(model)·사용자 글은 건드리지 않는다', () => {
        const list = [m('g1', 'assistant'), m('u1', 'user'), m('a1', 'model'), m('a2', 'model'), m('g2', 'assistant'), m('u2', 'user')];
        expect(collapseGreetingRuns(list)).toEqual(list);
    });
    it('원본 배열을 바꾸지 않는다', () => {
        const list = [m('g1', 'assistant'), m('g2', 'assistant')];
        collapseGreetingRuns(list);
        expect(list).toHaveLength(2);
    });
});
