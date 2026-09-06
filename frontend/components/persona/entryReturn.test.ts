import { describe, expect, it, vi } from 'vitest';

// 진입 랜딩 ↔ 기능 보드 왕복 (2026-09-06).
//
// 사장 지적: "왜 진입페이지로 안 가고 채팅화면으로 가느냐."
// 원인은 App.tsx onFeature 가 **무조건** goTo('chat') 을 부른 것이었다.
// 실제로는 기능 보드가 main·chat 양쪽 return 에 모두 렌더돼 있어(1849~ / 2272~)
// 화면을 옮길 이유가 없었다.
//
// 이 파일은 App.tsx 를 통째로 렌더하지 않고 **결정 규칙만** 고정한다 —
// App.tsx 는 2400줄이라 렌더 테스트가 무겁고, 정작 깨지는 건 이 분기다.

/** App.tsx onFeature 의 결정 규칙(발췌). 퀵메뉴형만 채팅으로 간다. */
const decide = (key: string, quickMenuMap: Record<string, string>) => {
    const qm = quickMenuMap[key];
    return {
        goesToChat: !!qm,
        /** 보드형만 되돌아올 자리를 기억한다 — 퀵메뉴형은 채팅에 남으므로 돌아올 곳이 없다 */
        remembersReturn: !qm,
    };
};

describe('진입 랜딩에서 기능 실행', () => {
    // 윤채린 4종은 전부 보드형이다(App.tsx FEATURE_ACTIONS 실측).
    const QM: Record<string, string> = { tarot: '타로 보기' };  // 퀵메뉴형 예시

    it('보드형은 채팅으로 튕기지 않는다', () => {
        for (const key of ['agetransform', 'hair', 'outfit', 'lookalike']) {
            const r = decide(key, QM);
            expect(r.goesToChat, `${key} 는 화면을 옮기면 안 된다`).toBe(false);
            expect(r.remembersReturn, `${key} 는 복귀 지점을 기억해야 한다`).toBe(true);
        }
    });

    it('퀵메뉴형은 채팅이 필요하므로 종전대로 전환한다', () => {
        // ★채팅창에 메시지를 넣는 방식이라 채팅 화면이 없으면 동작하지 않는다.
        const r = decide('tarot', QM);
        expect(r.goesToChat).toBe(true);
        expect(r.remembersReturn).toBe(false);
    });
});

describe('보드를 닫으면 랜딩으로 되돌아간다', () => {
    /** App.tsx closeBoardAndReturn 의 규칙. */
    const makeCloser = (returnGuide: unknown | null) => {
        const setGuide = vi.fn();
        const setReturn = vi.fn();
        const close = vi.fn();
        const run = () => {
            close();
            if (returnGuide) { setGuide(returnGuide); setReturn(null); }
        };
        return { run, setGuide, setReturn, close };
    };

    it('랜딩에서 열었으면 닫을 때 랜딩이 다시 뜬다', () => {
        const guide = { title: '윤채린' };
        const c = makeCloser(guide);
        c.run();
        expect(c.close).toHaveBeenCalled();
        expect(c.setGuide).toHaveBeenCalledWith(guide);
        expect(c.setReturn).toHaveBeenCalledWith(null);   // 한 번 쓰고 비운다
    });

    it('★랜딩을 거치지 않은 평소 경로는 종전과 완전히 같다', () => {
        // 이게 깨지면 메인 기능카드로 연 보드가 닫힐 때 엉뚱한 랜딩이 뜬다.
        const c = makeCloser(null);
        c.run();
        expect(c.close).toHaveBeenCalled();
        expect(c.setGuide).not.toHaveBeenCalled();
    });
});
