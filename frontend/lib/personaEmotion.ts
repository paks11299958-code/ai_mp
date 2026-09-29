// 채팅 감정 사진(2026-09-29 사장 요청 "채팅 내용에 따라 채팅 사진이 자동으로 바뀌게").
// 카테고리별 사진을 미리 만들어 두고(public/<persona>/emo/*.jpg), 답장이 끝나면 서버
// POST /api/persona-emotion 이 고른 카테고리의 사진으로 바꿔 끼운다. 인사말은 AI 판정 없이 'greeting'.
// ★카테고리 목록은 서버 shared-api lib/personaEmotion.ts 가 정본 — 바꾸면 양쪽을 같이 바꾼다.
// ★새 페르소나에 붙이려면 EMOTION_IMAGES 에 사진만 추가하면 된다(없는 카테고리는 기본 사진 유지).

export const EMOTIONS = ['greeting', 'happy', 'shy', 'love', 'sad', 'surprised', 'pout', 'cheer', 'thinking', 'sleepy'] as const;
export type Emotion = typeof EMOTIONS[number];

export const EUNBI_ID = 'cmoogeutq000004ifpx8r9xv2';

const eunbi = (e: Emotion) => `/eunbi/emo/${e}.jpg`;
export const EMOTION_IMAGES: Record<string, Partial<Record<Emotion, string>>> = {
    [EUNBI_ID]: Object.fromEntries(EMOTIONS.map(e => [e, eunbi(e)])) as Record<Emotion, string>,
};

export function isEmotion(v: unknown): v is Emotion {
    return typeof v === 'string' && (EMOTIONS as readonly string[]).includes(v);
}

export function hasEmotionImages(personaId: string): boolean {
    return !!EMOTION_IMAGES[personaId];
}

/** 이 페르소나·감정의 사진. 없으면 undefined(= 기본 메인 사진을 그대로 쓴다). */
export function emotionImageFor(personaId: string, emotion: Emotion | undefined): string | undefined {
    if (!emotion) return undefined;
    return EMOTION_IMAGES[personaId]?.[emotion];
}

/** 인사말 판정 — 서버 greet 가 저장하는 역할은 'assistant'(일반 답장은 'model'). */
export function isGreetingMessage(m: { role: string } | undefined): boolean {
    return !!m && m.role === 'assistant';
}

/** 답장 감정 판정. 실패는 전부 null(사진을 바꾸지 않을 뿐, 대화엔 영향 없음). */
export async function classifyReplyEmotion(userText: string, replyText: string): Promise<Emotion | null> {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/persona-emotion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ userText: userText.slice(0, 600), replyText: replyText.slice(0, 600) }),
        });
        if (!res.ok) return null;
        const d = await res.json();
        return isEmotion(d?.emotion) ? d.emotion : null;
    } catch {
        return null;
    }
}

const preloaded = new Set<string>();
/** 채팅에 들어오면 사진을 미리 받아 둔다 — 바뀌는 순간 빈 칸·깜빡임이 없게. */
export function preloadEmotionImages(personaId: string): void {
    const set = EMOTION_IMAGES[personaId];
    if (!set || preloaded.has(personaId) || typeof Image === 'undefined') return;
    preloaded.add(personaId);
    for (const url of Object.values(set)) { if (url) { const im = new Image(); im.src = url; } }
}
