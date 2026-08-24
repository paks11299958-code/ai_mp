export type AiStudioWorkflow = 'sdxl_t2i' | 'zimage_t2i';

export const engineConfig = (workflow: AiStudioWorkflow) => workflow === 'zimage_t2i'
    ? {
        workflow,
        model: 'z_image_turbo',
        width: 832,
        height: 1216,
        steps: 9,
        cfg: 1,
        supportsImageInputs: false,
        supportsUpscale: false,
    } as const
    : {
        workflow,
        model: undefined,
        width: 832,
        height: 1216,
        steps: 30,
        cfg: undefined,
        supportsImageInputs: true,
        supportsUpscale: true,
    } as const;
