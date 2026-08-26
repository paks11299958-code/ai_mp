// 도결(道潔) 선생 사주 랜딩 — 히어로 연출의 공용 상수·유틸.
//
// 이 파일은 화면(SajuEntry.tsx)이 아니라 **연출 재료**만 담는다.
// 톤 값과 이미지 경로를 한 곳에 모아둬야 캔버스(연기·안개)와 정적 대체 화면이
// 같은 색·같은 비율을 쓰게 된다.
//
// ★현재(묶음 A)는 애니메이션이 없다 — 화면은 tiger.png를 정적으로 띄운다.
//   캔버스 엔진(책 → 연기 → 안개 → 호랑이)은 묶음 B에서 이 파일에 붙인다.
//   아래 TIMELINE/IMAGES는 그 구현이 참조할 사양서(doc/features/persona_entry_saju.md) 값이다.

/** 사주 랜딩 색 토큰. 먹색 바탕 + 금박 + 주홍(병오년의 붉은 기운). */
export const SAJU_TONE = {
    /** 바탕 — 먹색 */
    inkDeep: '#0d0b0a',
    ink: '#14100e',
    /** 금박 */
    gold: '#c9a227',
    goldLight: '#e8cc6a',
    /** 포인트 — 주홍 */
    vermilion: '#b8352c',
    /** 글씨 */
    text: '#f0e9dc',
    textSub: '#a89a86',
    /** 선·테두리 */
    line: 'rgba(201,162,39,0.22)',
} as const;

/** public/ 아래 실제로 존재하는 히어로 소재. 1216×832 (3:2에 가깝다). */
export const SAJU_HERO_IMAGES = {
    /** 역술가의 오래된 책 — 향로 연기가 화면 중앙 상단에 이미 찍혀 있다. */
    book: '/saju/book.png',
    /** 한국 호랑이 — 좌우에 연기가 감돈다. */
    tiger: '/saju/tiger.png',
} as const;

/** 히어로 박스 가로/세로 비. 이미지 원본(1216×832)과 같게 잡아 잘림을 막는다. */
export const SAJU_HERO_ASPECT = '1216 / 832';

/**
 * 히어로 타임라인(초). 사양서의 구간을 그대로 옮겼다 — 묶음 B의 캔버스가 쓴다.
 *   0 ~ 1.5   책만. 향로 위 연기가 서서히 짙어진다
 *   1.5 ~ 3.5 연기가 위로 솟구쳐 책을 감싸고, 책은 페이드아웃
 *   3.5 ~ 5.5 안개가 가로로 깔리며 그 속에서 호랑이가 드러난다
 *   5.5 ~     호랑이 유지. 안개만 은은하게 흐른다
 */
export const SAJU_HERO_TIMELINE = {
    bookHoldEnd: 1.5,
    smokeRiseEnd: 3.5,
    fogRevealEnd: 5.5,
} as const;

/**
 * 모션 감소 설정 여부.
 * ★ SSR·테스트 환경에서 matchMedia가 없을 수 있어 반드시 존재 확인 후 호출한다
 *   (없는 걸 호출하면 화면이 통째로 죽는다).
 */
export const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};
