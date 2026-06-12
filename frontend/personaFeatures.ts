// 페르소나 기능 레지스트리 — 단일 출처(single source of truth).
//
// 기존엔 채팅 화면에서 `activePersona.name === '윤채원'` 식으로 페르소나 이름에
// 기능 버튼을 하드코딩했다. 이름은 표시용 라벨이라 바뀌면 기능이 조용히 사라지고,
// 새 페르소나에 기능을 붙이려면 코드를 고쳐야 했다.
//
// 이제 페르소나 데이터의 `features`(키 배열)로 기능을 결정한다.
// - features가 채워진 페르소나: 그 키 목록대로 기능 노출 (어드민에서 관리)
// - features가 비어있는(레거시) 페르소나: NAME_FALLBACK으로 기존 동작 보존
//
// onClick(보드 열기)은 App 상태 setter에 묶이므로 여기 두지 않고, App에서 키별로 바인딩한다.

import { Persona } from './types';

export type FeatureKey =
    | 'news'
    | 'stock'
    | 'hotkeyword'
    | 'used'
    | 'luxury'
    | 'mathtutor'
    | 'club'
    | 'golf-swing'
    | 'golf-record'
    | 'ebook'
    | 'webtoon';

export interface FeatureMeta {
    key: FeatureKey;
    label: string;
    icon: string;        // Icons.tsx 이름
    color: string;       // 텍스트/아이콘 색
    bgColor: string;
    borderColor: string;
}

// 표시 순서 = 이 배열 순서. 어드민 체크박스도 이 순서로 렌더.
export const FEATURE_REGISTRY: FeatureMeta[] = [
    { key: 'news',        label: '오늘뉴스',     icon: 'Newspaper',   color: '#5C7BA8', bgColor: '#E8EEF7',                  borderColor: '#9AAFCB' },
    { key: 'stock',       label: '주식 분석',    icon: 'TrendingUp',  color: '#2E6B32', bgColor: '#EAF5EB',                  borderColor: '#9EC4A0' },
    { key: 'hotkeyword',  label: '핫쇼핑키워드', icon: 'ShoppingBag', color: '#8B6020', bgColor: '#FEF6E8',                  borderColor: '#E2C9A0' },
    { key: 'used',        label: '중고 판매',    icon: 'ShoppingBag', color: '#8B6020', bgColor: '#FEF6E8',                  borderColor: '#E2C9A0' },
    { key: 'luxury',      label: '명품 검증',    icon: 'Shield',      color: '#7A5FA0', bgColor: '#F5E6F7',                  borderColor: '#B49AC9' },
    { key: 'mathtutor',   label: 'AI쌤',         icon: 'BookOpen',    color: '#FF6B9D', bgColor: 'rgba(255,107,157,0.12)',   borderColor: '#FFB3D1' },
    { key: 'club',        label: '모임(출첵)',   icon: 'Handshake',   color: '#FF6B9D', bgColor: 'rgba(255,107,157,0.12)',   borderColor: '#FFB3D1' },
    { key: 'golf-swing',  label: '스윙 분석',    icon: 'Activity',    color: '#C47D0A', bgColor: 'rgba(245,166,35,0.12)',    borderColor: '#F5A623' },
    { key: 'golf-record', label: '스윙 기록',    icon: 'Clock',       color: '#C47D0A', bgColor: 'rgba(245,166,35,0.12)',    borderColor: '#F5A623' },
    { key: 'ebook',       label: '전자책 만들기', icon: 'BookOpen',   color: '#8E6FB7', bgColor: '#F5E6F7',                  borderColor: '#B49AC9' },
    { key: 'webtoon',     label: '웹툰 보기',     icon: 'BookOpen',   color: '#8E6FB7', bgColor: '#F0E9F7',                  borderColor: '#C4B0DC' },
];

export const FEATURE_BY_KEY: Record<string, FeatureMeta> =
    Object.fromEntries(FEATURE_REGISTRY.map(f => [f.key, f]));

// 레거시 폴백: features 미설정 페르소나의 이름 → 기능 키 목록 (기존 동작 보존).
const NAME_FALLBACK: Record<string, FeatureKey[]> = {
    '서아':   ['news'],
    '윤채원': ['stock', 'hotkeyword'],
    '이아린': ['used', 'hotkeyword'],
    '신은비': ['luxury'],
    '지우':   ['mathtutor', 'club'],
    '강지훈': ['ebook'],
    '향기(필명)': ['webtoon'],
};

function isGolf(persona: Persona): boolean {
    return !!(persona.jobTitle?.includes('골프') || persona.name?.includes('골프'));
}

/**
 * 페르소나의 활성 기능 키 목록을 반환.
 * - features(JSON 배열 문자열)가 있으면 그것을 신뢰
 * - 없으면 이름 기반 폴백 + 골프 판별(레거시 동작 보존)
 */
export function getPersonaFeatureKeys(persona: Persona | undefined | null): FeatureKey[] {
    if (!persona) return [];
    // 1) features 우선
    if (persona.features) {
        try {
            const parsed = JSON.parse(persona.features);
            if (Array.isArray(parsed)) {
                const keys = parsed.filter((k): k is string => typeof k === 'string');
                if (keys.length > 0) return keys.filter((k): k is FeatureKey => k in FEATURE_BY_KEY);
            }
        } catch { /* 파싱 실패 시 폴백 */ }
    }
    // 2) 레거시 폴백 (이름 + 골프)
    const fromName = NAME_FALLBACK[persona.name] ?? [];
    const golf: FeatureKey[] = isGolf(persona) ? ['golf-swing', 'golf-record'] : [];
    return [...fromName, ...golf];
}
