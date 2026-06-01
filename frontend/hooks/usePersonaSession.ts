import { useState, useEffect, useCallback } from 'react';
import { Message, ChatSessionState, Persona } from '../types';

/**
 * 페르소나별 채팅 세션 상태 훅 (App.tsx #1 분해 — T6a, 순수 코어).
 *
 * 소유 범위(이 단계 = 순수 세션 상태 + 무의존 뮤테이터):
 * - sessions: Record<personaId, ChatSessionState>
 * - addMessageToSession / updateMessageInSession / setSessionTyping (모두 deps [], 외부 의존 0)
 * - 페르소나 목록 변경 시 세션 슬롯 동기화 effect
 *
 * 본체 잔류(의도):
 * - activePersonaId/setActivePersonaId는 persona 관심사 → 본체 소유. 동기화 effect가
 *   activePersonaId 없는 페르소나면 첫 페르소나로 보정하므로 인자로 주입받는다.
 * - handleSelectPersona / handleLoadMoreMessages / triggerSummaryUpdate / handleSendMessage 등
 *   핸들러는 다음 단계(T6b/T6c)에서 이동. 현재는 본체가 아래 sessions/setSessions/헬퍼를
 *   그대로 사용한다(동작 변경 0).
 *
 * effect 의존성(personas/activePersonaId)은 인자 주입으로 원본 deps를 그대로 보존.
 */
export function usePersonaSession(
    personas: Persona[],
    activePersonaId: string,
    setActivePersonaId: (id: string) => void,
) {
    const [sessions, setSessions] = useState<Record<string, ChatSessionState>>({});

    // 페르소나 목록 변경 시 세션 상태 동기화
    useEffect(() => {
        setSessions(prev => {
            const newSessions = { ...prev };
            personas.forEach(p => {
                if (!newSessions[p.id]) {
                    newSessions[p.id] = { messages: [], isTyping: false };
                }
            });
            return newSessions;
        });
        if (personas.length > 0 && !personas.find(p => p.id === activePersonaId)) {
            setActivePersonaId(personas[0].id);
        }
    }, [personas, activePersonaId]);

    const addMessageToSession = useCallback((personaId: string, message: Message) => {
        setSessions(prev => ({
            ...prev,
            [personaId]: {
                ...prev[personaId],
                messages: [...(prev[personaId]?.messages || []), message],
            },
        }));
    }, []);

    const updateMessageInSession = useCallback((personaId: string, messageId: string, updates: Partial<Message>) => {
        setSessions(prev => ({
            ...prev,
            [personaId]: {
                ...prev[personaId],
                messages: prev[personaId].messages.map(msg =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                ),
            },
        }));
    }, []);

    const setSessionTyping = useCallback((personaId: string, isTyping: boolean) => {
        setSessions(prev => ({
            ...prev,
            [personaId]: { ...prev[personaId], isTyping },
        }));
    }, []);

    return {
        sessions,
        setSessions,
        addMessageToSession,
        updateMessageInSession,
        setSessionTyping,
    };
}
