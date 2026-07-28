// 추천(레퍼럴) 프론트 유틸 — ?ref 코드 보관/조회.
// 공유 링크(?ref=코드)로 들어온 방문자가 나중에 가입할 때 그 코드를 가입 요청에 동봉한다.
// 보관처: localStorage(브라우저 닫았다 와도 유지). 가입 완료 후엔 호출부에서 clearStoredRef().

const KEY = 'referralCode';

/**
 * URL에 ?ref=코드가 있으면 localStorage에 보관하고 URL에서 제거한다(앱 부팅 시 1회).
 * 반환: 이번 진입이 추천 링크였는지(=방금 ref를 캡처했는지). true면 호출부에서 가입 안내 화면으로 유도.
 */
export function captureRefFromUrl(): boolean {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (!ref) return false;
        const code = ref.trim().toUpperCase().slice(0, 16);
        if (code) {
            localStorage.setItem(KEY, code);
            // 방문 서버 기록(측정 퍼널 시작점, 2026-07-07). 비로그인 OK,
            // 서버가 IP해시+일1회 dedupe. fire-and-forget — 실패해도 방문자 경험 무영향.
            try {
                fetch('/api/auth/referral/visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                }).catch(() => { /* 측정 실패 무시 */ });
            } catch { /* 무시 */ }
        }
        params.delete('ref');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        return !!code;
    } catch { return false; }
}

/** 보관된 추천코드(없으면 undefined). 가입 요청 body의 ref로 전달. */
export function getStoredRef(): string | undefined {
    try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; }
}

/** 가입 완료 후 보관된 코드 제거(중복 적용 방지). */
export function clearStoredRef(): void {
    try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/** 내 추천 링크 생성. 공유/복사용. */
export function buildReferralLink(code: string): string {
    return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}

// ── 내 추천코드 캐시 ─────────────────────────────────────────────
// App이 로그인 시 GET /referral로 받아 보관. 공개값(공유링크에 그대로 노출)이라 localStorage 보관 OK.
// 결과 카드 공유 버튼 등 App 밖 컴포넌트가 ref를 붙일 때 참조.
const MY_CODE_KEY = 'myReferralCode';
export function setMyReferralCode(code: string | null): void {
    try { if (code) localStorage.setItem(MY_CODE_KEY, code); else localStorage.removeItem(MY_CODE_KEY); } catch { /* 무시 */ }
}
export function getMyReferralCode(): string | undefined {
    try { return localStorage.getItem(MY_CODE_KEY) || undefined; } catch { return undefined; }
}

// 공유 제목용 기능 라벨. 받는 사람이 "무엇을 보게 될지" 알아야 링크를 누른다
// (기존엔 무엇을 공유하든 'AI 페르소나 채팅' 고정이라 클릭 동기가 없었음, 2026-07-28).
// MainPageNew의 FEATURES_GRID를 import하면 순환 참조가 되므로 키→라벨만 여기 둔다.
// 새 기능 카드 추가 시 이 맵에도 한 줄 넣어주면 공유 문구가 기능명으로 나간다.
const FEATURE_SHARE_LABELS: Record<string, string> = {
    news: '오늘 뉴스', stock: '주식 분석', swing: '스윙 분석', luxury: '명품 감정',
    insurance: '보험 컨설팅', used: '중고 판매', hotkeyword: '핫 키워드',
    mathtutor: 'AI 수학 튜터', club: '모임 출첵', siwoon: '시운의 흐름',
    wealth: '성취와 재물', yeonn: '인연의 결', dream: '꿈해몽', gwansang: '관상학',
    ebook: '전자책 만들기', webtoon: '웹툰 보기', hair: '헤어스타일',
    outfit: '프로필 사진', lookalike: '연예인 매칭', marketing: 'AI 마케팅 글쓰기',
    agetransform: '시간여행', tarot: '타로점', homepage: '홈페이지 만들기',
    'shorts-maker': '쇼츠 만들기', learn: '학습자료',
    rebirth: '전생 이야기', palm: '손금 보기', friendship: '우정 궁합',
};

/** 공유 시트에 뜰 제목. 모르는 키는 서비스명으로 폴백. */
export function featureShareTitle(featureKey: string): string {
    const label = FEATURE_SHARE_LABELS[featureKey];
    return label ? `${label} · AI 페르소나 채팅` : 'AI 페르소나 채팅';
}

/** 기능 딥링크(+내 추천코드) 생성. 결과물 공유의 도착지. */
export function buildFeatureShareLink(featureKey: string): string {
    const ref = getMyReferralCode();
    const refQs = ref ? `&ref=${encodeURIComponent(ref)}` : '';
    return `${window.location.origin}/?f=${encodeURIComponent(featureKey)}${refQs}`;
}

// ── 친구 초대 링크: 목적지 선택 ────────────────────────────────────────────────
// 기존 초대 링크는 `?ref=코드`뿐이라 받는 사람이 **아무 맥락 없이 메인**에 떨어졌다
// (2026-07-28 사장 지적). 뿌니(최다 초대자)가 데려온 게스트 10명 중 8명이 1P도 안 쓴 것과
// 무관하지 않다 — 뭘 보라고 온 건지 알 수 없으니까.
// 이제 초대자가 "무엇을 소개할지" 고르면 그 목적지로 바로 도착하고, 공유 문구도 함께 바뀐다.
export type InviteTarget =
    | { kind: 'home' }                                  // 서비스 전체(기존 동작)
    | { kind: 'feature'; key: string; label: string; personaName?: string }
    | { kind: 'persona'; id: string; name: string };

/** 선택한 목적지 + 내 추천코드로 초대 링크를 만든다. */
export function buildInviteLink(code: string, target: InviteTarget): string {
    const origin = window.location.origin;
    const ref = `ref=${encodeURIComponent(code)}`;
    if (target.kind === 'feature') return `${origin}/?f=${encodeURIComponent(target.key)}&${ref}`;
    if (target.kind === 'persona') return `${origin}/?p=${encodeURIComponent(target.id)}&${ref}`;
    return `${origin}/?${ref}`;
}

/** 목적지에 맞는 공유 문구(제목/본문). 링크만 바뀌고 문구가 고정이면 클릭 동기가 안 생긴다. */
export function buildInviteMessage(target: InviteTarget): { title: string; text: string } {
    if (target.kind === 'feature') {
        return {
            title: `${target.label} · AI 놀이터`,
            text: `${target.label}${target.personaName ? ` (${target.personaName})` : ''} 같이 해보자! 가입하면 둘 다 1000P 🎁`,
        };
    }
    if (target.kind === 'persona') {
        return {
            title: `${target.name}와 대화하기 · AI 놀이터`,
            text: `${target.name}와 이야기해 보자! 가입하면 둘 다 1000P 🎁`,
        };
    }
    return {
        title: 'AI 놀이터 초대',
        text: '나랑 같이 AI로 미래 얼굴·헤어·관상 해보자! 가입하고 둘 다 1000P 받기 🎁',
    };
}

/**
 * 결과 이미지 + 딥링크를 함께 공유(순간 진입점의 핵심).
 * 모바일: navigator.share로 이미지 파일까지 첨부(결과물이 곧 광고) → 미지원/실패 시 링크만.
 * 데스크탑/폴백: 링크 클립보드 복사.
 * 반환: 사용자에게 보일 짧은 안내 문구('' = 네이티브 시트가 떠서 안내 불필요).
 */
export async function shareResultImage(imageUrl: string, featureKey: string, caption: string): Promise<string> {
    const link = buildFeatureShareLink(featureKey);
    // 링크에 내 추천코드가 붙는 공유라면 보상 안내 1줄 동봉(초대 동기 부여, 2026-07-07 바이럴 P2)
    const refHint = getMyReferralCode() ? '\n🎁 친구가 이 링크로 가입하면 두 분 다 +1000P!' : '';
    const shareData: ShareData = { title: featureShareTitle(featureKey), text: `${caption}${refHint}\n${link}` };

    // 1) 이미지 파일까지 첨부 시도(모바일 네이티브 공유). canShare(files)로 가능 여부 확인.
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `result.${(blob.type.split('/')[1] || 'jpg')}`, { type: blob.type || 'image/jpeg' });
        const withFile: ShareData = { ...shareData, files: [file] };
        if (navigator.canShare && navigator.canShare(withFile) && navigator.share) {
            await navigator.share(withFile);
            return '';
        }
    } catch { /* 이미지 fetch/공유 실패 → 아래 링크 공유로 폴백 */ }

    // 2) 링크만 네이티브 공유
    try {
        if (navigator.share) { await navigator.share({ title: shareData.title, text: caption, url: link }); return ''; }
    } catch { return ''; } // 사용자가 시트 닫음 → 추가 안내 없음

    // 3) 클립보드 복사 폴백 (+추천 보상 안내 1줄)
    try {
        await navigator.clipboard.writeText(link);
        return getMyReferralCode()
            ? '공유 링크가 복사되었습니다 · 친구가 가입하면 두 분 다 +1000P 🎁'
            : '공유 링크가 복사되었습니다';
    }
    catch { return link; }
}

// 마케팅 채널 코드(유튜브 쇼츠 QR 등) — 회원 추천코드가 아니라 유입 소스 표시.
// 가입 배너 문구 분기("친구가 초대" vs "환영") + 백엔드 채널 가입 측정과 짝(2026-07-14).
// 새 채널 추가 시 여기와 shared-api lib/referral.ts CHANNEL_CODES 둘 다 갱신.
export const CHANNEL_CODES = ['YOUTUBE', 'SHORTS', 'INSTA', 'INSTAGRAM', 'THREADS', 'BLOG', 'NAVER'];

/** 보관된 ref가 마케팅 채널 코드인지(친구 추천코드가 아닌지). */
export function isChannelRef(code?: string): boolean {
    return !!code && CHANNEL_CODES.includes(code.trim().toUpperCase());
}
