// 인앱 포인트 알림(넛지) 3종 — 기준값·문구·노출기록을 이 파일 한 곳에서 관리한다.
//
//   A. low       : 잔액이 기준값 아래로 처음 떨어졌을 때 "곧 소진" 안내
//   B. (소진)    : 새 팝업을 만들지 않는다 — 기존 전역 402 → PointModal(회원) /
//                  GuestUpgradeModal(체험) 경로를 그대로 쓰고, 여기서는 문구만 보탠다.
//   C. milestone : 누적 대화 횟수가 기준(10·30·100회)에 닿았을 때 축하 + 유도
//
// ★전제(2026-07-08 사장 결정): **대화는 무료**다(차감 0, 하루 100회 한도만). 그래서
//   "대화 N회분"이라는 기준은 성립하지 않고, 포인트는 관상·타로·이미지 같은 스페셜 기능에서만
//   나간다. 기준값은 그 전제로 잡았다(아래 LOW_BALANCE_THRESHOLD 주석).
//
// ★노출 기록은 localStorage(기기·브라우저 단위)다 — 스키마 변경을 피하려는 선택.
//   다른 기기에서 접속하면 한 번 더 뜰 수 있다(의도된 한계).
//
// ★측정 수단 없음: 프론트 이벤트 트래킹(노출·클릭 로그)이 이 프로젝트엔 없다
//   (docs/admin-activity-data-sources.md "화면·메뉴 진입 경로 — 계측 없음"). 새로 만들지 않았다.

import type { User } from '../types';

/**
 * A. 소진 임박 기준(총 잔액 P, 미만일 때 임박).
 * 원래 기획은 "대화 약 3회분"이었다. 대화가 유료이던 시절 대화 1회 단가가 100P(1단계)였으므로
 * 3회분 = 300P. 지금은 스페셜 기능 1~2회 남짓한 양이다(가입 1,000P ≈ 기능 5회분, 2026-07-28 실측).
 * ★확정 전 임시값 — 사장 결정 대기.
 */
export const LOW_BALANCE_THRESHOLD = 300;

/**
 * A 재노출(재무장) 기준. 잔액이 이 값 이상으로 올라오면 "임박" 기록을 지워, 다시 기준 아래로
 * 떨어질 때 한 번 더 띄운다. 대표 사례 = **충전**(최소 패키지 5,000P).
 * 기준값(300P)과 같게 두지 않은 이유: 실패 환불·레벨업 보너스처럼 몇십~몇백 P가 오르내릴 때마다
 * 팝업이 반복되는 것을 막으려고 간격(히스테리시스)을 둔다.
 */
export const LOW_BALANCE_REARM = 1000;

/**
 * C. 누적 대화 횟수 기준(오름차순). 각 기준은 사용자별 1회만 뜨고 **재노출하지 않는다**.
 * 한 번에 여러 기준을 넘으면(예: 9→31) 가장 높은 것 하나만 띄우고 아래 기준은 본 것으로 처리.
 */
export const CHAT_MILESTONES = [10, 30, 100] as const;

// ── 대상 구분 ────────────────────────────────────────────────────────────────
// member: 정회원 → 충전 유도 / guest: 체험계정 → 회원가입 유도(충전 대신, 기존 guest 정책)
// admin : ADMIN·MANAGE → A·C 모두 띄우지 않음. 대화 차감·XP 적립이 서버에서 빠지는 계정이고,
//         운영자 테스트 중 팝업은 방해만 된다. B(402)는 기존 동작 그대로.
export type NudgeAudience = 'member' | 'guest' | 'admin';

export function nudgeAudienceOf(user: Pick<User, 'role' | 'provider'> | null | undefined): NudgeAudience | null {
    if (!user) return null;
    if (user.role === 'ADMIN' || user.role === 'MANAGE') return 'admin';
    // 체험 판별은 provider — role은 정식회원과 똑같이 'USER'다(App.tsx 체험 판별과 동일 기준).
    return user.provider === 'guest' ? 'guest' : 'member';
}

// ── 판정(순수 함수) ──────────────────────────────────────────────────────────

/** 이번 변화가 "기준값 아래로 떨어짐"인가. 이전 값이 없으면(첫 로드) 판정하지 않는다. */
export function crossedLowBalance(prev: number | null, next: number, threshold = LOW_BALANCE_THRESHOLD): boolean {
    return prev !== null && prev >= threshold && next < threshold;
}

/** prev → next 사이에 새로 닿은 기준 중 가장 높은 것. 없으면 null. 이전 값이 없으면 판정 안 함. */
export function crossedMilestone(prev: number | null, next: number, milestones: readonly number[] = CHAT_MILESTONES): number | null {
    if (prev === null || next <= prev) return null;
    let hit: number | null = null;
    for (const m of milestones) if (prev < m && next >= m) hit = m;
    return hit;
}

/**
 * 누적 대화 횟수(대리값) = 페르소나별 XP 합.
 * 서버가 회원 대화 1회마다 XP +1 을 적립한다(recordFreeChatActivity). 별도의 "누적 대화 수" 필드는
 * 없다. ★스타 후원도 XP를 올리므로 후원한 회원은 실제 대화 수보다 조금 크게 잡힌다.
 */
export function chatCountOf(personaXp: Record<string, number> | null | undefined): number {
    if (!personaXp) return 0;
    return Object.values(personaXp).reduce((s, v) => s + (Number(v) || 0), 0);
}

// ── 노출 기록(localStorage) ──────────────────────────────────────────────────
// 키: aimp_nudge_<userId>_<low|chat_10|chat_30|...>. 사생활 모드 등으로 저장소가 막히면
// "본 적 없음"으로 간주한다(그 세션에서 한 번 더 뜰 수 있을 뿐, 화면은 깨지지 않는다).
const key = (userId: number, id: string) => `aimp_nudge_${userId}_${id}`;

export function nudgeSeen(userId: number, id: string): boolean {
    try { return localStorage.getItem(key(userId, id)) === '1'; } catch { return false; }
}
export function markNudgeSeen(userId: number, id: string): void {
    try { localStorage.setItem(key(userId, id), '1'); } catch { /* 저장소 막힘 — 무시 */ }
}
export function clearNudgeSeen(userId: number, id: string): void {
    try { localStorage.removeItem(key(userId, id)); } catch { /* 무시 */ }
}

// ── B 보조: 포인트 부족으로 못 보낸 채팅 입력 보존 ───────────────────────────────
// 충전(Toss)은 결제창 → successUrl 로 **페이지를 통째로 다시 연다**. 입력창 state 만으로는
// 충전 후 돌아왔을 때 쓰던 글이 사라지므로, 못 보낸 글을 저장해 두고 같은 페르소나 채팅에
// 들어오면 입력창에 되돌려 놓는다(자동 전송은 하지 않는다 — 사용자가 확인 후 다시 보낸다).
const DRAFT_KEY = 'aimp_unsent_chat_draft';
const DRAFT_TTL_MS = 24 * 3600 * 1000;

export function saveUnsentDraft(personaId: string, text: string): void {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ personaId, text, ts: Date.now() })); } catch { /* 무시 */ }
}
/** 같은 페르소나의 보존된 글을 꺼내고 지운다. 없거나 만료면 null. */
export function takeUnsentDraft(personaId: string): string | null {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || Date.now() - Number(d.ts) > DRAFT_TTL_MS) { localStorage.removeItem(DRAFT_KEY); return null; }
        if (d.personaId !== personaId || typeof d.text !== 'string') return null;
        localStorage.removeItem(DRAFT_KEY);
        return d.text;
    } catch { return null; }
}

// ── 문구 ─────────────────────────────────────────────────────────────────────
// 원칙(company-wiki 03-운영로그 2026-08-07 카피 서치): 죄책감·압박형이 아니라
// "하던 걸 끊기지 않게 해 준다"는 톤. ★첫 충전 혜택 문구는 넣지 않았다 — 첫 충전 전용 혜택이
// 실제로 없다(PointModal의 10%/20%는 패키지 크기별 보너스로, 이미 모달에 표시된다).
export interface NudgeCopy { title: string; body: string; primary: string; secondary: string }

export type NudgeKind = 'low' | 'milestone';

export function nudgeCopy(kind: NudgeKind, audience: Exclude<NudgeAudience, 'admin'>, v: { balance?: number; count?: number }): NudgeCopy {
    const bal = (v.balance ?? 0).toLocaleString();
    if (kind === 'low') {
        return audience === 'guest' ? {
            title: '체험 포인트가 얼마 남지 않았어요',
            body: `남은 포인트 ${bal}P\n가입하면 지금 계정과 대화를 그대로 이어서 쓸 수 있어요.`,
            primary: '회원가입하기',
            secondary: '나중에',
        } : {
            title: '포인트가 얼마 남지 않았어요',
            body: `남은 포인트 ${bal}P\n미리 채워 두면 쓰던 기능이 중간에 멈추지 않아요.`,
            primary: '충전하기',
            secondary: '나중에',
        };
    }
    const n = v.count ?? 0;
    return audience === 'guest' ? {
        title: `벌써 ${n}번째 대화예요! 🎉`,
        body: '마음에 드셨다면 가입해 두세요.\n지금까지 나눈 대화와 친밀도가 그대로 남아요.',
        primary: '회원가입하기',
        secondary: '계속 대화하기',
    } : {
        title: `벌써 ${n}번째 대화예요! 🎉`,
        body: '대화는 계속 무료예요.\n포인트로 관상·타로·이미지 같은 스페셜 기능도 즐겨 보세요.',
        primary: '포인트 충전하기',
        secondary: '계속 대화하기',
    };
}

/** 체험계정이 넛지에서 '회원가입하기'를 눌러 GuestUpgradeModal 이 열릴 때의 머리 문구. */
export const GUEST_UPGRADE_HEADLINE: Record<NudgeKind, { title: string; body: string }> = {
    low: { title: '가입하고 계속 이용하세요', body: '체험 포인트가 얼마 남지 않았어요.\n지금까지 대화는 그대로 유지돼요.' },
    milestone: { title: '가입하고 계속 이용하세요', body: '가입해도 지금 계정과 대화는\n그대로 유지돼요.' },
};

/** B(소진) 때 PointModal 사유 상자 아래에 붙이는 한 줄 — 작업을 끊지 않는다는 안내. */
// ★"하던 작업이 그대로 있다"고 쓰지 않았다 — 결제창은 페이지를 다시 열기 때문에, 채팅 입력은
//   보존하지만(saveUnsentDraft) 기능 보드의 입력(사진·폼)은 충전 후 돌아오면 사라진다. 사실만 쓴다.
export const INSUFFICIENT_REASSURE = '포인트는 차감되지 않았어요. 충전 후 바로 이어서 이용할 수 있어요.';
