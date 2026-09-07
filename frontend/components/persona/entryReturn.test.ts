import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

    it('서아 랜딩(뉴스)도 같은 규칙으로 되돌아온다', () => {
        // 2026-09-07: 09-06 배선을 윤채린 4종에만 걸어 **서아만 메인으로 떨어졌다**
        // (운영 실측: 뉴스 보드를 닫으면 랜딩이 아니라 메인이 나왔다).
        const guide = { title: '서아' };
        const c = makeCloser(guide);
        c.run();
        expect(c.setGuide).toHaveBeenCalledWith(guide);
    });
});

describe('랜딩에서 열리는 보드는 전부 복귀 배선이 걸려 있다', () => {
    // ★규칙만 흉내내는 테스트는 "배선을 빠뜨린 것"을 못 잡는다 —
    //   09-06 에 실제로 그렇게 서아가 누락됐고 테스트는 전부 통과했다.
    //   그래서 여기서는 **App.tsx 원문을 읽어** 실제 배선을 검사한다.
    // ★`import.meta.url` 은 vitest 변환 환경에서 file 스킴이 아닐 수 있다 → cwd 기준으로 읽는다
    //   (vitest 의 root 가 frontend/ 이므로 App.tsx 는 그 바로 아래에 있다).
    const src = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');

    /** 진입 랜딩(도결·서아·윤채린)에서 열 수 있는 보드들 */
    const BOARDS = [
        'AgeTransformBoard', 'HairStyleBoard', 'OutfitBoard',   // 윤채린
        'TodayNewsBoard',                                        // 서아
        // 이아린(2026-09-07) — 랜딩을 만들면서 함께 배선했다. 빠지면 서아와 똑같이
        // "보드를 닫으면 랜딩이 아니라 메인으로 떨어지는" 증상이 난다.
        'MarketingBoard', 'ShortsMakerBoard', 'UsedItemBoard', 'HotKeywordBoard',
    ];

    /** `<Board ... />` 한 덩어리를 통째로 뽑는다.
     *  ★HotKeywordBoard 처럼 **여러 줄에 걸쳐** 렌더되는 보드가 있어
     *    한 줄 단위로 보면 onClose 를 못 찾고 조용히 통과한다(실측). */
    const blocksOf = (board: string): string[] => {
        const out: string[] = [];
        let from = 0;
        for (;;) {
            const i = src.indexOf(`<${board}`, from);
            if (i < 0) break;
            const end = src.indexOf('/>', i);
            out.push(src.slice(i, end < 0 ? i + 400 : end + 2));
            from = i + 1;
        }
        return out;
    };

    for (const board of BOARDS) {
        it(`${board} 의 onClose 는 closeBoardAndReturn 을 거친다`, () => {
            const blocks = blocksOf(board);
            expect(blocks.length, `${board} 렌더 지점을 못 찾았다`).toBeGreaterThan(0);
            for (const b of blocks) {
                // ★main·chat 양쪽 return 에 렌더되므로 **모든 지점**이 걸려 있어야 한다.
                expect(b, `${board} 한 곳이 배선에서 빠졌다`).toContain('closeBoardAndReturn');
            }
        });
    }

    it('뉴스 보드는 main·chat 두 곳 모두에 배선돼 있다', () => {
        const hits = src.split('\n').filter(l => l.includes('<TodayNewsBoard') && l.includes('closeBoardAndReturn'));
        expect(hits).toHaveLength(2);
    });
});

describe('랜딩 루트의 배경 클릭이 위에 뜬 것까지 닫지 않는다', () => {
    // 2026-09-07 실측 사고(같은 뿌리, 두 화면):
    //   랜딩 루트에 onClick={onClose} 가 걸려 있고 자식 모달·보드는 stopPropagation 을 가진
    //   시트 **밖 형제**로 렌더된다 → 그 안의 버튼을 누르면 이벤트가 루트까지 올라가
    //   **랜딩이 통째로 닫히고 메인으로 떨어진다.**
    //   · 도결(SajuEntry)   — 궁합·관상·손금 모달에서 발생
    //   · 서아(SeoaNewsDeskEntry) — 뉴스룸 ✕ 에서 발생(Esc 는 이미 정상이었다)
    // ★"모달을 열어둔 채 배경 클릭을 무시한다"는 규칙을 **루트 한 곳**에서 지켜야 한다.
    const read = (f: string) => readFileSync(resolve(process.cwd(), 'components/persona/' + f), 'utf8');

    it('도결 랜딩 — 모달이 떠 있으면 onClose 를 부르지 않는다', () => {
        const s = read('SajuEntry.tsx');
        // 루트가 onClose 를 **무조건** 부르는 형태(onClick={onClose})면 사고 재발이다.
        expect(s).not.toMatch(/className="sj-root"\s+onClick=\{onClose\}/);
        expect(s).toMatch(/modalUp/);
    });

    it('서아 랜딩 — 뉴스룸이 떠 있으면 onClose 를 부르지 않는다', () => {
        const s = read('SeoaNewsDeskEntry.tsx');
        expect(s).not.toMatch(/sn-root[^\n]*\}\s+onClick=\{onClose\}/);
        // 배경 클릭 분기에 openCategory 조건이 들어가 있어야 한다.
        expect(s).toMatch(/onClick=\{\(\)\s*=>\s*\{\s*if\s*\(!openCategory\)\s*onClose\(\);\s*\}\}/);
    });

    it('서아 Esc 는 뉴스룸부터 닫는다 (기존 동작 보존)', () => {
        const s = read('SeoaNewsDeskEntry.tsx');
        expect(s).toMatch(/if\s*\(openCategory\)\s*setOpenCategory\(null\);\s*\n?\s*else\s+onClose\(\);/);
    });
});

describe('전용 랜딩 분기 — PersonaEntrySheet 한 곳에서만 갈린다', () => {
    // ★App.tsx 를 고치면 전 화면 백지 사고가 재발한다(2026-07-29 TDZ).
    //   그래서 랜딩 분기는 **PersonaEntrySheet 안에서만** 한다 — 이 규약을 고정한다.
    const sheet = readFileSync(resolve(process.cwd(), 'components/PersonaEntrySheet.tsx'), 'utf8');

    const CASES: [string, string][] = [
        ['도결',   'SajuEntry'],
        ['서아',   'SeoaNewsDeskEntry'],
        ['윤채린', 'ChaerinStudioEntry'],
        ['이아린', 'ArinPromoEntry'],       // 2026-09-07 추가
    ];

    for (const [name, comp] of CASES) {
        it(`${name} → ${comp}`, () => {
            expect(sheet).toContain(`startsWith('${name}')`);
            expect(sheet).toContain(`<${comp}`);
            expect(sheet, `${comp} import 가 빠졌다`).toMatch(new RegExp(`import\\s*\\{\\s*${comp}\\s*\\}`));
        });
    }

    it('분기는 훅보다 위의 조기 return 이라 훅 순서를 깨지 않는다', () => {
        // 이 컴포넌트에는 훅이 없어야 한다 — 있으면 조기 return 이 훅 개수를 바꿔 React #310.
        expect(sheet).not.toMatch(/\buseState\(|\buseEffect\(|\buseRef\(|\buseCallback\(/);
    });
});

describe('페이지 이동형 기능도 랜딩으로 돌아온다', () => {
    // 2026-09-07 사장 지적: 아린 랜딩에서 '이미지 → 프롬프트'로 가면 돌아올 수 없었다.
    // ★그 기능은 보드가 아니라 **최상위 얼리리턴 라우트**(/reverse-prompt)라 앱 전체를
    //   갈아치운다 — closeBoardAndReturn 이 통하지 않는 유일한 경로다.
    //   그래서 sessionStorage 에 돌아올 자리를 남기고 저쪽 헤더가 그걸 쓴다.
    //   ★양쪽 키가 어긋나면 **에러 없이** 그냥 메인으로 떨어진다 → 짝을 테스트로 고정한다.
    const KEY = 'rp:backTo';
    const arin = readFileSync(resolve(process.cwd(), 'components/persona/ArinPromoEntry.tsx'), 'utf8');
    const rp   = readFileSync(resolve(process.cwd(), 'components/reverse-prompt/ReversePromptMain.tsx'), 'utf8');

    it('아린 랜딩은 나가기 전에 돌아올 자리를 남긴다', () => {
        expect(arin).toContain(`sessionStorage.setItem('${KEY}'`);
        // 저장 호출이 onFeature 보다 **먼저** 있어야 한다(이동 후엔 이 코드가 안 돈다).
        expect(arin).toMatch(/rememberReturn\(personaId\);\s*onFeature\('reverse-prompt'\)/);
    });

    it('★복귀 URL 은 personaId 로 직접 만든다 (location.search 를 쓰면 안 된다)', () => {
        // 2026-09-07 실측 함정: App.tsx 가 딥링크를 소비하며 `?p=` 를 URL 에서 지운다
        // (history.replaceState). 그래서 랜딩이 열린 시점의 search 는 비어 있고,
        // 그대로 저장하면 **메인으로 돌아간다**(운영에서 실제로 그랬다).
        expect(arin).toMatch(/\/\?p=\$\{encodeURIComponent\(personaId\)\}/);
        expect(arin, 'location.search 로 복귀 URL 을 만들면 안 된다')
            .not.toMatch(/setItem\('rp:backTo',\s*window\.location\.pathname\s*\+\s*window\.location\.search/);
        // App.tsx 쪽에 그 삭제 코드가 실제로 있는지도 확인 — 없어지면 이 대비가 무의미해진다
        const app = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');
        expect(app).toContain("params.delete('p')");
    });

    it('리버스 프롬프트 화면은 그 값을 읽어 뒤로가기에 쓴다', () => {
        expect(rp).toContain(`'${KEY}'`);
        expect(rp).toMatch(/backTo=\{backTo\}/);
    });

    it('★외부 URL 은 무시한다 (열린 리다이렉트 방지)', () => {
        // readBackTo 의 검증식을 그대로 옮겨 시험한다.
        const ok = (v: string) => /^\/(?!\/)/.test(v);
        expect(ok('/?p=abc')).toBe(true);
        expect(ok('/reverse-prompt')).toBe(true);
        expect(ok('//evil.com')).toBe(false);      // 프로토콜 상대 URL
        expect(ok('https://evil.com')).toBe(false);
        expect(ok('javascript:alert(1)')).toBe(false);
        // 소스에도 같은 가드가 실제로 있어야 한다
        expect(rp).toMatch(/\/\^\\\/\(\?!\\\/\)\//);
    });
});
