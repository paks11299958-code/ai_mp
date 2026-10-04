// 충전 창이 다른 창 뒤에 숨지 않는지 (2026-10-04 사장 제보 "충전화면이 모달화면 뒤에 뜬다").
//
// 원인: apiService 가 402 를 받으면 전역 'insufficient-points' 이벤트로 충전 창(PointModal z-70)을 연다.
//   그런데 그 순간 열려 있는 진입화면(85)·진입 채팅(90~100)·기능 보드(90~95)·즐겨찾기(101)를
//   닫지 않으므로, 충전 창이 그 **뒤에** 깔렸다(운영 재현: 화면 중앙 클릭이 진입화면 글자에 닿음).
// 이 테스트는 "충전 창 층 > 402 를 일으킬 수 있는 화면들의 최대 층" 을 소스에서 직접 읽어 확인한다.
// 새 진입화면·보드가 더 높은 z-index 를 쓰면 여기서 실패한다 → 충전 창을 함께 올릴 것.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const dir = __dirname;
const read = (f: string) => readFileSync(join(dir, f), 'utf8');

/** 소스에서 z 값(tailwind z-[N]·z-N, style zIndex: N, CSS z-index:N)을 모두 뽑는다. */
const zValues = (src: string): number[] => {
    const out: number[] = [];
    for (const m of src.matchAll(/\bz-\[(\d+)\]|\bz-(\d+)\b|zIndex:\s*(\d+)|z-index:\s*(\d+)/g)) {
        out.push(Number(m[1] ?? m[2] ?? m[3] ?? m[4]));
    }
    return out;
};

const chargeZ = (f: string) => {
    const m = read(f).match(/className="fixed inset-0[^"]*\bz-\[(\d+)\]/);
    expect(m, `${f} 의 바깥 오버레이 z-[N] 을 찾지 못함`).toBeTruthy();
    return Number(m![1]);
};

// 402 가 날 때 열려 있을 수 있는 화면들
const layerFiles = [
    ...readdirSync(join(dir, 'persona')).filter(f => /\.(tsx|css)$/.test(f) && !f.includes('.test.')).map(f => `persona/${f}`),
    ...readdirSync(dir).filter(f => /Board\.tsx$/.test(f)),
    'PersonaEntrySheet.tsx', 'GuestTrialModal.tsx', 'MainPageNew.tsx',
];

describe('충전 창 층(z-index)', () => {
    it('PointModal 과 체험계정용 GuestUpgradeModal 이 같은 층이다', () => {
        expect(chargeZ('GuestUpgradeModal.tsx')).toBe(chargeZ('PointModal.tsx'));
    });

    it('402 를 일으킬 수 있는 화면들보다 위에 뜬다', () => {
        const charge = chargeZ('PointModal.tsx');
        const offenders = layerFiles.flatMap(f => zValues(read(f)).filter(z => z >= charge).map(z => `${f}: ${z}`));
        expect(offenders).toEqual([]);
    });
});
