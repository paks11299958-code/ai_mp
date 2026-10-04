// 충전 창은 무조건 가장 위 (2026-10-04 사장 지시 — 헤어스타일 화면에서 충전 창이 뒤에 깔림).
//
// 원인: apiService 가 402 를 받으면 전역 'insufficient-points' 이벤트로 충전 창(PointModal)을 연다.
//   그 순간 열린 진입화면·채팅·보드(헤어 z-70 등)를 닫지 않는데, 충전 창도 z-70 이었고 App.tsx 에서
//   보드보다 **앞에** 그려져 같은 층이면 보드가 위로 왔다. → lib/chargeLayer.ts(body portal + z-9000).
// 이 테스트는 ①두 충전 창이 portal·같은 층을 쓰는지 ②앱의 어떤 화면도 그 층 이상을 쓰지 않는지
//   (의도적 최상단 알림 9999 제외) 소스에서 직접 확인한다. 새 화면이 9000 이상을 쓰면 여기서 실패한다.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { CHARGE_LAYER_Z } from '../lib/chargeLayer';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : walk(p);
    return /\.(tsx|css)$/.test(n) && !/\.test\./.test(n) ? [relative(root, p)] : [];
});

const zValues = (src: string): number[] =>
    [...src.matchAll(/\bz-\[(\d+)\]|\bz-(\d+)\b|zIndex:\s*(\d+)|z-index:\s*(\d+)/g)]
        .map(m => Number(m[1] ?? m[2] ?? m[3] ?? m[4]));

const CHARGE_FILES = ['components/PointModal.tsx', 'components/GuestUpgradeModal.tsx'];
// 의도적으로 충전 창보다 위에 두는 최상단 알림(충전 창이 열리면 숨거나, 충전 경로와 겹치지 않는다)
const TOPMOST_ALLOWED = new Set([9999]);

describe('충전 창 층', () => {
    it.each(CHARGE_FILES)('%s — body portal + CHARGE_LAYER_Z', f => {
        const src = read(f);
        expect(src).toContain('return toChargeLayer(');
        const m = src.match(/className="fixed inset-0[^"]*\bz-\[(\d+)\]/);
        expect(Number(m?.[1])).toBe(CHARGE_LAYER_Z);
    });

    it('앱의 어떤 화면도 충전 창 층 이상을 쓰지 않는다(9999 최상단 알림 제외)', () => {
        const files = [...walk(join(root, 'components')), 'App.tsx'].filter(f => !CHARGE_FILES.includes(f));
        const offenders = files.flatMap(f => zValues(read(f))
            .filter(z => z >= CHARGE_LAYER_Z && !TOPMOST_ALLOWED.has(z)).map(z => `${f}: ${z}`));
        expect(offenders).toEqual([]);
    });
});
