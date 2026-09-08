// 유나 별자리 타로 진입화면 — **기능 실행 경로**와 라우팅 회귀.
//
// ★★이 화면이 다른 다섯 랜딩과 결정적으로 다른 점: 타로는 **보드형이 아니라 채팅형**이다.
//   타로 모달은 App.tsx 의 chat return 안에서만 렌더된다(2236줄). 그 앞 1724줄에
//   `if (screen === 'main')` 얼리리턴이 있어 **main 에서는 모달이 아예 없다**.
//   랜딩은 main 에서 열리므로:
//     · onFeature('tarot') → FEATURE_ACTIONS 를 부르지만 모달이 없어 **아무 일도 안 일어난다**
//     · onStart('tarot')   → goTo('chat') **후** 같은 핸들러를 불러 정상 동작한다
//   그리고 타로 과금은 **메시지당**이라(MenuLimit 등록 없음) 랜딩이 실행을 흉내내면
//   이중과금이 된다 — 도결에서 실제로 터졌던 사고다.
//
// ★이 종류는 tsc·빌드·번들 grep 이 전부 통과한다. "코드가 있다"와 "그 코드가 맞다"는 다르다.
//   그래서 **어느 콜백을 부르는지**를 소스에서 직접 검사한다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, 'YunaTarotEntry.tsx'), 'utf8');
const SHEET = readFileSync(resolve(__dirname, '../PersonaEntrySheet.tsx'), 'utf8');

describe('★★기능은 onStart 로만 부른다 (onFeature 면 main 에서 무반응)', () => {
    it('타로점·오늘의 카드 둘 다 onStart(key) 로 호출한다', () => {
        expect(SRC).toContain("onStart('tarot')");
        expect(SRC).toContain("onStart('tarot-daily')");
    });

    it('★★onFeature 를 호출하는 곳이 한 군데도 없다', () => {
        // 주석에는 등장한다(왜 쓰면 안 되는지 설명) — **코드 줄만** 검사한다.
        const codeLines = SRC.split('\n')
            .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
        const calls = codeLines.filter(l => /onFeature\s*\(/.test(l));
        expect(calls).toEqual([]);
    });

    it('과금을 직접 흉내내지 않는다 — activate/차감 호출이 없다', () => {
        expect(SRC).not.toMatch(/quick-menu-activate|deductPoints|pointsCost/);
    });
});

describe('히어로 카드는 실제 타로 덱과 어긋나지 않는다', () => {
    it('메이저 아르카나 번호·이름을 쓴다(모달과 같은 카드)', () => {
        for (const [no, kr] of [['XVII', '별'], ['XVIII', '달'], ['XIX', '태양']]) {
            expect(SRC).toContain(`no: '${no}'`);
            expect(SRC).toContain(`kr: '${kr}'`);
        }
    });

    it('자리는 과거·현재·미래 3장이다(3장 스프레드 표준)', () => {
        expect(SRC).toMatch(/POSITIONS\s*=\s*\['과거',\s*'현재',\s*'미래'\]/);
    });
});

describe('연출 — 사장님 지시 사항', () => {
    it('행성마다 공전 주기가 서로 다르다', () => {
        const ts = [...SRC.matchAll(/\bt:\s*([\d.]+)/g)].map(m => m[1]);
        expect(ts.length).toBeGreaterThanOrEqual(5);
        expect(new Set(ts).size).toBe(ts.length);   // 전부 달라야 한다
    });

    it('궤도는 비스듬한 타원 — rotateX 로 눕히고 rotateZ 로 기울인다', () => {
        expect(SRC).toMatch(/\.yt-solar\{[^}]*rotateX\(64deg\)\s*rotateZ\(-12deg\)/);
    });

    it('★카드는 180 을 지나 더 돌아 비스듬히 선다(정면이면 돈 게 안 보인다)', () => {
        expect(SRC).toMatch(/rotateY\(228deg\)/);
        expect(SRC).toMatch(/100%\{transform:rotateY\(212deg\)/);
    });

    it('★연기는 제거됐다(사장님 지시)', () => {
        expect(SRC).not.toMatch(/yt-smoke|연기가 피어|blur\(16px\)/);
    });

    it('이미지를 쓰지 않는다 — 전부 CSS/SVG', () => {
        expect(SRC).not.toMatch(/<img\b/);
    });
});

describe('라우팅 — 접두사 분기가 다른 페르소나를 가로채지 않는다', () => {
    it('PersonaEntrySheet 가 유나 접두사로 이 랜딩을 연다', () => {
        expect(SHEET).toMatch(/guide\.title\?\.startsWith\('유나'\)/);
        expect(SHEET).toContain('<YunaTarotEntry');
    });

    it("★'유나'로 시작하는 다른 페르소나가 없다 — 운영 페르소나 전체로 확인", () => {
        // 2026-09-09 운영 DB 실측 목록. '서아'와 '설아'처럼 한 글자 차이가 있어 접두사는 위험하다.
        const PERSONAS = ['서아', '설아', '유나', '지우', '강지훈', '박하진', '신은비',
                          '윤채린', '윤채원', '이아린', '정우진', '서윤박사', '향기(필명)',
                          'AI학습코칭', '도결(道潔)선생'];
        const hit = PERSONAS.filter(n => n.startsWith('유나'));
        expect(hit).toEqual(['유나']);
    });

    it('유나 분기는 윤채원 분기 **뒤에** 온다(기존 순서를 깨지 않았다)', () => {
        const chaewon = SHEET.indexOf("startsWith('윤채원')");
        const yuna = SHEET.indexOf("startsWith('유나')");
        expect(chaewon).toBeGreaterThan(-1);
        expect(yuna).toBeGreaterThan(chaewon);
    });
});
