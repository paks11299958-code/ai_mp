import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 페르소나별 담당 기능 — 소유가 어긋나면 조용히 엉뚱한 사람에게 붙는다 (2026-09-07)
//
// 배경(사장 지적): "윤채린에 있는 핫쇼핑 키워드는 이아린에 있어야 하는 거 아닌가?"
//   실제로는 윤채린이 아니라 **윤채원**(주식 애널리스트)이었고, `hotkeyword` 가
//   윤채원·이아린 **양쪽에 중복** 등록돼 있었다.
//   핫 키워드는 `naverShoppingCategory`(네이버 **쇼핑**) 기반이라 주식과 무관하고,
//   메인 카드(FEATURES_GRID)의 담당도 이미 이아린이었다 → 윤채원에서 제거.
//
// ★★이 파일은 **코드 폴백**만 검사한다. 정본은 DB `Persona.features` 이므로
//   한쪽만 고치면 어긋난다(메모리 project_user_marketing_service 의 함정).
//   DB 는 테스트에서 볼 수 없으니, **어긋남을 줄이도록 코드 쪽 규칙을 고정**한다.

const src = readFileSync(resolve(process.cwd(), 'personaFeatures.ts'), 'utf8');
const grid = readFileSync(resolve(process.cwd(), 'components/MainPageNew.tsx'), 'utf8');

/** NAME_FALLBACK 에서 페르소나 한 명의 기능 목록을 뽑는다. */
const featuresOf = (name: string): string[] => {
    const m = src.match(new RegExp(`'${name}':\\s*\\[([^\\]]*)\\]`));
    expect(m, `${name} 항목을 못 찾았다`).toBeTruthy();
    return (m![1].match(/'([^']+)'/g) ?? []).map(s => s.replace(/'/g, ''));
};

describe('핫 키워드는 이아린 담당이다', () => {
    it('윤채원(주식 애널리스트)은 핫 키워드를 갖지 않는다', () => {
        // 네이버 쇼핑 트렌드라 주식 분석과 무관하다.
        expect(featuresOf('윤채원')).not.toContain('hotkeyword');
        expect(featuresOf('윤채원')).toContain('stock');
    });

    it('이아린이 핫 키워드를 갖는다', () => {
        expect(featuresOf('이아린')).toContain('hotkeyword');
    });

    it('메인 카드(FEATURES_GRID)의 담당과 일치한다', () => {
        // ★카드 담당과 채팅 기능 목록이 어긋나면 "카드는 아린인데 채팅은 채원"이 된다.
        // ★`[^}]*` 로는 못 찾는다 — 카드 정의 안에 palette: { … } 가 있어 중간에 끊긴다.
        const line = grid.split('\n').find(l => l.includes("key: 'hotkeyword'"));
        expect(line, 'FEATURES_GRID 에서 hotkeyword 카드를 못 찾았다').toBeTruthy();
        const card = line!.match(/personaName:\s*'([^']+)'/);
        expect(card, 'FEATURES_GRID 에서 hotkeyword 카드를 못 찾았다').toBeTruthy();
        expect(card![1]).toBe('이아린');
    });
});

describe('기능 소유는 한 사람뿐이다', () => {
    // 중복 소유는 "누가 담당인지" 화면마다 달라지는 원인이 된다.
    // ★의도적 공유가 필요해지면 이 목록에 예외를 명시할 것 — 조용히 늘어나면 안 된다.
    const SHARED_OK: string[] = [];

    it('두 페르소나가 같은 기능을 갖지 않는다', () => {
        const block = src.slice(src.indexOf('NAME_FALLBACK'), src.indexOf('};', src.indexOf('NAME_FALLBACK')));
        const owners = new Map<string, string[]>();
        for (const line of block.split('\n')) {
            const m = line.match(/'([^']+)':\s*\[([^\]]*)\]/);
            if (!m) continue;
            for (const f of (m[2].match(/'([^']+)'/g) ?? []).map(s => s.replace(/'/g, ''))) {
                owners.set(f, [...(owners.get(f) ?? []), m[1]]);
            }
        }
        const dup = [...owners.entries()]
            .filter(([f, who]) => who.length > 1 && !SHARED_OK.includes(f))
            .map(([f, who]) => `${f} → ${who.join(', ')}`);
        expect(dup, `기능이 여러 페르소나에 중복 등록됐다:\n${dup.join('\n')}`).toEqual([]);
    });
});
