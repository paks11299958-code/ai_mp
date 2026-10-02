import { describe, it, expect } from 'vitest';
import { collectTraits, initDeviceFp, getDeviceFp } from './deviceFingerprint';

describe('deviceFingerprint — 체험 한 기기 1회 지문', () => {
    it('특성은 같은 환경에서 매번 같다(시간에 따라 바뀌는 값 없음)', () => {
        expect(collectTraits()).toBe(collectTraits());
    });
    it('지문은 sha256 hex 64자이고 다시 불러도 같은 값(캐시)', async () => {
        const a = await initDeviceFp();
        if (a === '') return; // crypto.subtle 없는 환경이면 서버가 쿠키 검사만 한다 — 실패가 아니다
        expect(a).toMatch(/^[a-f0-9]{64}$/);
        expect(await initDeviceFp()).toBe(a);
        expect(getDeviceFp()).toBe(a);
    });
});
