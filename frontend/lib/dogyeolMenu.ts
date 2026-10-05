/** Display-only metadata. DB labels and execution remain in useSajuRunner. */
export const DOGYEOL_MENU = {
    siwoon: { name: '운세', description: '오늘·이달·올해의 운', image: '/dogyeol/menu/siwoon.webp' },
    wealth: { name: '재물·사업', description: '돈과 사업의 흐름', image: '/dogyeol/menu/wealth.webp' },
    yeonn: { name: '연애·궁합', description: '연애운과 둘의 궁합', image: '/dogyeol/menu/yeonn.webp' },
    friendship: { name: '친구 궁합', description: '친구 사이 잘 맞는지', image: '/dogyeol/menu/friendship.webp' },
    dream: { name: '꿈해몽', description: '꾼 꿈의 의미 풀이', image: '/dogyeol/menu/dream.webp' },
    rebirth: { name: '전생', description: '전생의 삶과 내 기질', image: '/dogyeol/menu/rebirth.webp' },
    gwansang: { name: '관상', description: '얼굴 사진으로 보는 운', image: '/dogyeol/menu/gwansang.webp' },
    palm: { name: '손금', description: '손바닥 선과 내 운', image: '/dogyeol/menu/palm.webp' },
} as const;
export const DOGYEOL_MENU_GROUPS = [
    { title: '운세', keys: ['siwoon', 'wealth'] },
    { title: '인연', keys: ['yeonn', 'friendship'] },
    { title: '꿈·전생', keys: ['dream', 'rebirth'] },
    { title: '얼굴·손', keys: ['gwansang', 'palm'] },
] as const;
export const DOGYEOL_MENU_KEYS = DOGYEOL_MENU_GROUPS.flatMap(group => [...group.keys]);
