import { describe, expect, it } from 'vitest';
import { assetForState, AVATAR_STATES, normalizeAvatarState } from '../../public/avatar-state-machine.js';

describe('상담 아바타 상태 계약', () => {
    it('허용 상태를 대소문자와 공백에 안전하게 정규화한다', () => {
        expect(normalizeAvatarState(' thinking ')).toBe(AVATAR_STATES.THINKING);
        expect(normalizeAvatarState('SPEAKING')).toBe(AVATAR_STATES.SPEAKING);
    });

    it('알 수 없는 상태는 거부한다', () => {
        expect(normalizeAvatarState('LOADING')).toBeNull();
        expect(normalizeAvatarState(null)).toBeNull();
    });

    it('말하기만 립싱크 영상을 쓰고 나머지는 안정적인 idle로 폴백한다', () => {
        expect(assetForState(AVATAR_STATES.SPEAKING)).toBe('/seoa/avatar/speaking-poc.mp4');
        expect(assetForState(AVATAR_STATES.IDLE)).toBe('/seoa/avatar/idle.mp4');
        expect(assetForState(AVATAR_STATES.THINKING)).toBe('/seoa/avatar/idle.mp4');
        expect(assetForState(AVATAR_STATES.FALLBACK)).toBe('/seoa/avatar/idle.mp4');
    });
});
