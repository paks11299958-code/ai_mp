export const AVATAR_STATES = Object.freeze({
  IDLE: 'IDLE',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  FALLBACK: 'FALLBACK',
});

const STATE_SET = new Set(Object.values(AVATAR_STATES));

export function normalizeAvatarState(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return STATE_SET.has(normalized) ? normalized : null;
}

export function assetForState(state) {
  return state === AVATAR_STATES.SPEAKING
    ? '/seoa/avatar/speaking-poc.mp4'
    : '/seoa/avatar/idle.mp4';
}

export function createAvatarStateMachine({ video, root, status, onStateChange = () => {} }) {
  let currentState = null;

  async function setState(requestedState, reason = 'command') {
    const state = normalizeAvatarState(requestedState);
    if (!state) return false;

    const nextAsset = assetForState(state);
    const currentAsset = new URL(video.currentSrc || video.src, window.location.href).pathname;
    root.dataset.state = state.toLowerCase();
    status.textContent = state === AVATAR_STATES.THINKING
      ? '답변을 준비하고 있어요'
      : state === AVATAR_STATES.SPEAKING
        ? '서아가 답변하고 있어요'
        : state === AVATAR_STATES.FALLBACK
          ? '음성으로 계속 안내할게요'
          : '상담 준비가 되었어요';

    if (currentAsset !== nextAsset) {
      video.src = nextAsset;
      video.load();
    }
    video.playbackRate = state === AVATAR_STATES.THINKING ? 0.82 : 1;
    currentState = state;
    onStateChange({ state, reason });

    try {
      await video.play();
    } catch {
      if (state !== AVATAR_STATES.FALLBACK) return setState(AVATAR_STATES.FALLBACK, 'playback-error');
    }
    return true;
  }

  video.addEventListener('error', () => {
    if (currentState !== AVATAR_STATES.FALLBACK) setState(AVATAR_STATES.FALLBACK, 'media-error');
  });

  return { setState, getState: () => currentState };
}
