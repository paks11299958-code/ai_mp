import { describe, expect, it } from 'vitest';
import { engineConfig, workflowForModel, Z_IMAGE_MODEL } from './aiStudioEngine';

describe('AI Studio generation engine routing', () => {
    it('Z-Image 선택을 검증된 워크플로와 렌더 값으로 고정한다', () => {
        expect(engineConfig('zimage_t2i')).toEqual({
            workflow: 'zimage_t2i',
            model: 'z_image_turbo',
            width: 832,
            height: 1216,
            steps: 9,
            cfg: 1,
            supportsImageInputs: false,
            supportsUpscale: false,
        });
    });

    it('SDXL은 기존 이미지 입력과 확대 경로를 유지한다', () => {
        const config = engineConfig('sdxl_t2i');
        expect(config.workflow).toBe('sdxl_t2i');
        expect(config.supportsImageInputs).toBe(true);
        expect(config.supportsUpscale).toBe(true);
    });

    it('같은 모델 목록에서 Z-Image 선택 여부로 워크플로를 결정한다', () => {
        expect(workflowForModel(Z_IMAGE_MODEL)).toBe('zimage_t2i');
        expect(workflowForModel('RealVisXL_V5.safetensors')).toBe('sdxl_t2i');
    });
});
