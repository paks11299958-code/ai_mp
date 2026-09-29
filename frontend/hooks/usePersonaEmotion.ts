import { useCallback, useEffect, useRef, useState } from 'react';
import { Emotion, classifyReplyEmotion, emotionImageFor, hasEmotionImages, isGreetingMessage, preloadEmotionImages } from '../lib/personaEmotion';

/**
 * 채팅 감정 사진 상태. 페르소나별로 현재 감정을 기억하고, 그 사진 URL 을 돌려준다.
 * - 새 인사말(role 'assistant')이 마지막 메시지가 되면 'greeting'(AI 호출 없음).
 * - 답장이 끝나면 호출부가 onReplyDone(userText, reply)를 부른다 → 서버 판정 → 사진 교체.
 *   ★판정이 끝나기 전에 다른 페르소나로 옮겼으면 **원래 페르소나**에 기록한다(화면을 엉뚱하게 바꾸지 않음).
 * - 사진 없는 페르소나는 아무것도 하지 않는다(판정 API 도 부르지 않음 = 비용 0).
 */
export function usePersonaEmotion(activePersonaId: string, lastMessage: { id: string; role: string } | undefined) {
    const [emotions, setEmotions] = useState<Record<string, Emotion>>({});
    const seenGreeting = useRef<Record<string, string>>({});

    useEffect(() => { if (activePersonaId) preloadEmotionImages(activePersonaId); }, [activePersonaId]);

    useEffect(() => {
        if (!activePersonaId || !hasEmotionImages(activePersonaId)) return;
        if (!isGreetingMessage(lastMessage) || !lastMessage) return;
        if (seenGreeting.current[activePersonaId] === lastMessage.id) return;
        seenGreeting.current[activePersonaId] = lastMessage.id;
        setEmotions(prev => ({ ...prev, [activePersonaId]: 'greeting' }));
    }, [activePersonaId, lastMessage?.id, lastMessage?.role]);

    const onReplyDone = useCallback((personaId: string, userText: string, reply: string) => {
        if (!hasEmotionImages(personaId) || !reply.trim()) return;
        classifyReplyEmotion(userText, reply).then(emotion => {
            if (emotion) setEmotions(prev => ({ ...prev, [personaId]: emotion }));
        });
    }, []);

    /** 사용자가 갤러리에서 사진을 직접 고르면 감정 사진을 걷어 그 선택을 보여준다. */
    const clearEmotion = useCallback((personaId: string) => {
        setEmotions(prev => { if (!prev[personaId]) return prev; const n = { ...prev }; delete n[personaId]; return n; });
    }, []);

    return {
        emotion: emotions[activePersonaId] as Emotion | undefined,
        emotionImageUrl: emotionImageFor(activePersonaId, emotions[activePersonaId]),
        onReplyDone,
        clearEmotion,
    };
}
