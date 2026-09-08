// 이아린 진입화면 — CSS 순서 회귀.
//
// 🔴2026-09-08 사장 지적: "왜 닫기가 왼쪽에 있어?"
//   `.ap-close{position:absolute;right:14px}` 로 제대로 썼는데 화면에선 **왼쪽 밖**(x:-14)에 있었다.
//   범인은 `.ap-sheet>*{position:relative}` — 종이 질감 레이어(::before) 위로 내용을 올리려는
//   규칙인데, **특정도가 같고(둘 다 0,1,0) 뒤에 선언돼서** .ap-close 의 absolute 를 이겼다.
//   relative 에서 `right:14px` 는 "오른쪽 정렬"이 아니라 **왼쪽으로 14px 이동**이다.
//
// ★이 종류는 tsc·빌드·번들 grep 이 전부 통과한다 — 값이 틀린 게 아니라 **순서**가 문제라서다.
//   그래서 소스의 **선언 순서 자체**를 검사한다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, 'ArinPromoEntry.tsx'), 'utf8');

describe('★닫기 버튼은 오른쪽 위에 고정된다', () => {
    it('absolute + top/right 로 선언돼 있다', () => {
        expect(SRC).toMatch(/\.ap-close\{position:absolute;top:14px;right:14px/);
    });

    it('★★.ap-sheet>* 보다 **뒤에** 선언된다 — 앞에 두면 relative 에 져서 화면 밖으로 나간다', () => {
        const sheetAll = SRC.indexOf('.ap-sheet>*{position:relative');
        const close    = SRC.indexOf('.ap-close{position:absolute');
        expect(sheetAll).toBeGreaterThan(-1);
        expect(close).toBeGreaterThan(-1);
        expect(close).toBeGreaterThan(sheetAll);
    });

    it('.ap-close 규칙이 하나뿐이다 — 둘이면 어느 쪽이 이기는지 알 수 없다', () => {
        expect(SRC.match(/\.ap-close\{/g)?.length ?? 0).toBe(1);
    });

    it('닫는 길이 둘이다 — ✕와 Esc', () => {
        expect(SRC).toMatch(/aria-label="닫기"/);
        expect(SRC).toContain("e.key === 'Escape'");
    });
});
