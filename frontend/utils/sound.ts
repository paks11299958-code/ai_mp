/**
 * UI 효과음 공통 유틸 (2026-07-29 신설, 사장 제안 — 타로 카드 셔플/뽑기 소리)
 *
 * ★한 곳에 모으는 이유: 볼륨·음소거 설정이 기능마다 흩어지면 "어떤 화면은 소리가 나고
 *   어떤 화면은 안 나는" 상태가 되고, 나중에 전역 음소거를 넣을 때 누락이 생긴다.
 *   새 효과음은 SOUNDS에 한 줄 추가하고 playSound(key)만 부르면 된다.
 *
 * 파일은 public/sounds/ (출처·라이선스는 그 폴더 CREDITS.md 참고, 전부 CC0).
 */

export type SoundKey = 'tarotShuffle' | 'tarotFlip' | 'tarotReveal';

const SOUNDS: Record<SoundKey, string> = {
    tarotShuffle: '/sounds/tarot-shuffle.mp3',
    tarotFlip: '/sounds/tarot-flip.mp3',
    tarotReveal: '/sounds/tarot-reveal.mp3',
};

const MUTE_KEY = 'ui_sound_muted';

/** 기본은 소리 켬(사장 결정 2026-07-29) — 첫 방문자가 바로 체감하게. 끄면 기기에 기억된다. */
export function isSoundMuted(): boolean {
    try {
        return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
        return false;   // 시크릿 모드 등 localStorage 차단 환경 — 소리는 나게 둔다
    }
}

export function setSoundMuted(muted: boolean): void {
    try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
        /* 저장 실패해도 이번 세션 재생 자체는 동작해야 하므로 무시 */
    }
}

// 같은 소리를 반복 재생할 때 매번 new Audio()를 만들면 GC 전까지 인스턴스가 쌓인다
// (TodayNewsBoard에서 같은 이유로 단일 엘리먼트 재사용 패턴을 쓴다). 키별로 하나만 캐시.
const cache = new Map<SoundKey, HTMLAudioElement>();

function getAudio(key: SoundKey): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;   // SSR 방어
    let a = cache.get(key);
    if (!a) {
        a = new Audio(SOUNDS[key]);
        a.preload = 'auto';
        cache.set(key, a);
    }
    return a;
}

/**
 * 효과음 재생. 음소거 상태면 아무 것도 하지 않는다.
 *
 * ★재생 실패를 삼키는 이유: 모바일 브라우저는 사용자 조작 전 재생을 차단하고(NotAllowedError),
 *   그 예외가 호출부로 올라가면 정작 중요한 카드 뽑기 로직이 멈춘다. 소리는 부가 요소이므로
 *   실패해도 본 기능은 그대로 진행돼야 한다.
 *   (타로는 "카드 섞기" 클릭이 첫 조작이라 실제로는 차단에 걸리지 않는다.)
 *
 * @param volume 0~1. 기본 0.3 — 놀라지 않을 만큼 작게 시작(사장 지시).
 */
export function playSound(key: SoundKey, volume = 0.3): void {
    if (isSoundMuted()) return;
    const a = getAudio(key);
    if (!a) return;
    try {
        a.currentTime = 0;   // 연속 호출(카드 3연속 뽑기) 시 앞부분부터 다시
        a.volume = Math.max(0, Math.min(1, volume));
        void a.play().catch(() => { /* 자동재생 차단 등 — 무시 */ });
    } catch {
        /* 재생 자체가 불가능한 환경 — 무시 */
    }
}
