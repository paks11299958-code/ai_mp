// 🎨 AI 스튜디오 스타일 프리셋 — 2026-08-05 신설
//
// ★왜 필요한가: 같은 GPU·같은 모델인데도 결과 차이가 크게 났다. 차이를 만든 건
//   ①어떤 모델을 골랐는지 ②프롬프트에 어떤 촬영 용어가 들어갔는지 ③가로세로 비율,
//   이 셋이었다. 영문 촬영 용어를 매번 기억해서 타이핑하게 만들면 품질이 사람 컨디션을
//   타므로, 검증된 조합을 프리셋으로 굳혀 둔다.
//
// 사용법: 프리셋을 고르면 프롬프트 뼈대(scaffold)와 모델·크기·스텝이 폼에 채워진다.
//   사장이 `subject`(무엇을 찍을지)만 한글/영문으로 바꿔 넣으면 된다.
//
// ★모델 선택 기준(실측):
//   - RealVisXL_V5      : 인물 얼굴·피부 표현이 가장 자연스러움 → 프로필·인물 화보
//   - JuggernautXL_v9   : 인물 외 사물·공간·조명 표현이 강함 → 제품·인테리어·풍경
//   - sd_xl_base_1.0    : 기본 모델. 특화 없음 → 일러스트·범용
//
// ★서버에 해당 모델이 없으면 폼은 목록의 첫 모델로 자동 대체된다(AiStudioPanel 참조).

export interface StylePreset {
    key: string;
    label: string;
    icon: string;
    /** 한 줄 설명 — 어떤 용도인지 */
    hint: string;
    /** 파일명. 서버 모델 목록에 없으면 무시된다 */
    model: string;
    /** `{subject}` 자리에 사장이 쓴 내용이 들어간다 */
    scaffold: string;
    /** 프리셋 특화 네거티브. 비우면 워커 기본값(손·얼굴 왜곡 방지)이 쓰인다 */
    negative?: string;
    width: number;
    height: number;
    steps: number;
    /** 폼 placeholder 로 보여줄 예시 */
    example: string;
}

// 인물 계열에서 공통으로 빠지기 쉬운 실패(잘린 머리·손 왜곡 등)를 막는 네거티브.
// ★워커 기본 네거티브에 이미 손·얼굴 왜곡은 들어 있으므로 여기선 **구도 실패**를 추가한다.
const PORTRAIT_NEG =
    'cropped head, cropped face, out of frame, plastic skin, oversaturated, ' +
    'cartoon, anime, 3d render, cgi, doll-like, airbrushed, nsfw';

const PRODUCT_NEG =
    'cluttered background, distracting objects, harsh shadows, dust, fingerprints, ' +
    'cartoon, illustration, low resolution, jpeg artifacts';

export const STYLE_PRESETS: StylePreset[] = [
    {
        key: 'profile',
        label: '프로필 사진',
        icon: '👔',
        hint: '이력서·회사 소개용 상반신. 배경 정리된 스튜디오 톤',
        model: 'RealVisXL_V5.safetensors',
        scaffold:
            'Professional corporate headshot portrait of {subject}, ' +
            'upper body, facing camera, confident friendly expression, ' +
            'clean neutral studio background, soft key light with subtle rim light, ' +
            'sharp focus on eyes, realistic skin texture with natural pores, ' +
            '85mm lens, f/2.8, shallow depth of field, ' +
            'professional photography, ultra realistic, masterpiece, best quality, 8K',
        negative: PORTRAIT_NEG,
        width: 832, height: 1216, steps: 35,
        example: 'a Korean man in his 40s wearing a navy suit',
    },
    {
        key: 'fashion',
        label: '패션 화보',
        icon: '🧥',
        hint: '전신 착장 컷. 잡지 화보 톤의 조명과 포즈',
        model: 'RealVisXL_V5.safetensors',
        scaffold:
            'Full body editorial fashion photograph of {subject}, ' +
            'head to toe in frame, natural graceful posture, looking toward camera, ' +
            'cinematic directional lighting, realistic fabric texture and drape, ' +
            'shallow depth of field with soft bokeh background, ' +
            'high-end magazine editorial photography, 85mm lens, ' +
            'ultra realistic, masterpiece, best quality, 8K',
        negative: `${PORTRAIT_NEG}, cropped legs, cropped feet`,
        width: 832, height: 1216, steps: 35,
        example: 'a Korean woman wearing a beige trench coat on a city street in autumn',
    },
    {
        key: 'product',
        label: '제품 컷',
        icon: '📦',
        hint: '쇼핑몰 상세페이지용. 배경 깔끔하고 질감 살아있는 컷',
        model: 'JuggernautXL_v9.safetensors',
        scaffold:
            'Professional product photograph of {subject}, ' +
            'centered composition on a clean seamless background, ' +
            'soft diffused studio lighting with gentle reflections, ' +
            'crisp material texture, subtle contact shadow, ' +
            'commercial advertising photography, macro detail, ' +
            'ultra sharp, high resolution, masterpiece, best quality, 8K',
        negative: PRODUCT_NEG,
        width: 1024, height: 1024, steps: 35,
        example: 'a matte black stainless steel tumbler with a wooden lid',
    },
    {
        key: 'interior',
        label: '인테리어·공간',
        icon: '🛋',
        hint: '매장·집 공간 컷. 자연광과 원근이 살아있는 넓은 화면',
        model: 'JuggernautXL_v9.safetensors',
        scaffold:
            'Architectural interior photograph of {subject}, ' +
            'wide angle view with balanced one-point perspective, ' +
            'warm natural daylight through large windows, soft ambient fill, ' +
            'realistic material textures on wood, fabric and stone, ' +
            'magazine interior design photography, 24mm lens, ' +
            'ultra realistic, high dynamic range, masterpiece, best quality, 8K',
        negative: 'distorted perspective, tilted horizon, fisheye, cluttered, cartoon, low quality',
        width: 1216, height: 832, steps: 35,
        example: 'a modern Scandinavian living room with a linen sofa and indoor plants',
    },
    {
        key: 'food',
        label: '음식 사진',
        icon: '🍽',
        hint: '메뉴판·배달앱용. 음식이 먹음직스럽게 보이는 조명',
        model: 'JuggernautXL_v9.safetensors',
        scaffold:
            'Appetizing food photograph of {subject}, ' +
            'served on a beautiful plate, 45 degree angle view, ' +
            'warm soft window light from the side, glistening fresh textures, ' +
            'shallow depth of field, tasteful props and linen, ' +
            'professional culinary photography, ' +
            'ultra realistic, mouth-watering, masterpiece, best quality, 8K',
        negative: `${PRODUCT_NEG}, unappetizing, burnt, messy plating`,
        width: 1024, height: 1024, steps: 35,
        example: 'a bowl of Korean beef bulgogi with rice and side dishes',
    },
    {
        key: 'thumbnail',
        label: '콘텐츠 썸네일',
        icon: '🖼',
        hint: '블로그·유튜브 배경용 가로 이미지. 글자 얹을 여백 확보',
        model: 'JuggernautXL_v9.safetensors',
        scaffold:
            'Eye-catching wide banner image of {subject}, ' +
            'clean uncluttered composition with generous empty space for text overlay, ' +
            'vivid but harmonious colors, cinematic lighting, ' +
            'modern digital content thumbnail, high contrast focal point, ' +
            'ultra sharp, high resolution, masterpiece, best quality, 8K',
        // ★썸네일은 나중에 글자를 얹으므로, 이미지 안에 글자가 생기면 안 된다
        negative: 'text, letters, words, typography, watermark, logo, cluttered, busy background, low quality',
        width: 1216, height: 832, steps: 30,
        example: 'a bright modern desk with a laptop and coffee, viewed from above',
    },
    {
        key: 'illust',
        label: '일러스트',
        icon: '🎨',
        hint: '실사 아닌 삽화풍. 카드뉴스·설명 그림에 적합',
        model: 'sd_xl_base_1.0.safetensors',
        scaffold:
            'Clean modern flat illustration of {subject}, ' +
            'simple shapes, harmonious limited color palette, soft gradients, ' +
            'minimal background, friendly approachable style, ' +
            'vector art style, editorial illustration, high quality',
        negative: 'photorealistic, photograph, 3d render, text, watermark, cluttered, ugly, low quality',
        width: 1024, height: 1024, steps: 28,
        example: 'a person working happily at a desk with plants around',
    },
];

/** 프리셋 + 사장이 쓴 내용 → 최종 프롬프트 */
export function buildPrompt(preset: StylePreset, subject: string): string {
    const s = subject.trim();
    // ★비어 있으면 `{subject}` 가 그대로 프롬프트에 들어가 이상한 그림이 나온다.
    //   예시로 대체해 최소한 말이 되는 결과가 나오게 한다.
    return preset.scaffold.replace('{subject}', s || preset.example);
}
