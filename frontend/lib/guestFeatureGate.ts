// 비로그인 방문자가 진입화면에서 기능을 눌렀을 때 "유료/무료" 안내를 가르는 표(2026-09-28).
//
// ★왜 프런트 상수인가: 비로그인은 `/api/points/menu-prices` 가 401 이라 가격을 받을 수 없다.
//   그래서 **무료 키만** 허용목록으로 두고, 나머지는 전부 유료로 본다(모르면 유료 쪽이 안전 —
//   "무료"라고 했다가 가입 후 포인트가 빠지면 거짓말이 된다).
// ★출처(2026-09-28 운영 DB `MenuLimit` role=USER 실측): webtoon 0, lookalike 0.
//   `golf-course` 는 가격 행이 없는 무료 기능이다(2026-09-08 무료 배포).
//   ★추측으로 늘리지 말 것 — 새로 넣으려면 MenuLimit 을 다시 실측하고 날짜를 적는다.
export const GUEST_FREE_FEATURE_KEYS: readonly string[] = ['webtoon', 'lookalike', 'golf-course'];

export type GuestNotice = 'paid' | 'free' | 'chat' | 'invite';

export const isGuestFreeFeature = (key: string): boolean => GUEST_FREE_FEATURE_KEYS.includes(key);

/** 기능 키 → 안내 종류. 허용목록에 없으면 유료. */
export const guestNoticeForFeature = (key: string): 'paid' | 'free' =>
    isGuestFreeFeature(key) ? 'free' : 'paid';
