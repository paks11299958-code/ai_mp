export type AiStudioWorkflow = 'sdxl_t2i' | 'zimage_t2i';
export const Z_IMAGE_MODEL = 'z_image_turbo';

export const workflowForModel = (model: string): AiStudioWorkflow =>
    model === Z_IMAGE_MODEL ? 'zimage_t2i' : 'sdxl_t2i';

export const engineConfig = (workflow: AiStudioWorkflow) => workflow === 'zimage_t2i'
    ? {
        workflow,
        model: Z_IMAGE_MODEL,
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
