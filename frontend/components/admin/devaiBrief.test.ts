import { describe, expect, it } from 'vitest';
import { hasAnyBrief, parseBrief, stringifyBrief } from './devaiBrief';

describe('개발AI ThreeUI 요구사항 계약', () => {
    it('기본값은 ThreeUI를 저장하지 않는다', () => {
        expect(JSON.parse(stringifyBrief({}))).toEqual({});
        expect(hasAnyBrief({})).toBe(false);
    });

    it('자동 추천은 강도만 저장하고 홈페이지 요구사항으로 판정한다', () => {
        const saved = JSON.parse(stringifyBrief({
            threeuiMode: 'auto', threeuiEffectId: 'condensation', threeuiIntensity: 'strong',
        }));
        expect(saved).toEqual({ threeuiMode: 'auto', threeuiIntensity: 'strong' });
        expect(hasAnyBrief(saved)).toBe(true);
    });

    it('직접 선택은 허용된 5개 ID만 복원한다', () => {
        const valid = parseBrief(JSON.stringify({
            bizName: '볕들카페', threeuiMode: 'manual',
            threeuiEffectId: 'condensation', threeuiIntensity: 'soft',
        }));
        expect(valid.threeuiEffectId).toBe('condensation');

        const invalid = parseBrief(JSON.stringify({
            threeuiMode: 'manual', threeuiEffectId: '../../script', threeuiIntensity: 'strong',
        }));
        expect(invalid.threeuiMode).toBe('manual');
        expect(invalid.threeuiEffectId).toBeUndefined();
    });

    it('알 수 없는 모드는 ThreeUI 비활성으로 정규화한다', () => {
        expect(parseBrief('{"threeuiMode":"forced","threeuiIntensity":"strong"}')).toEqual({});
    });
});
