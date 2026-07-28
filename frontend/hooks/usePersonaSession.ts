import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, ChatSessionState, Persona, PersonaImage } from '../types';
import { sessionApi } from '../services/apiService';

/**
 * 페르소나별 채팅 세션 상태 + 세션 로드 핸들러 훅 (App.tsx #1 분해 — T6a/T6b).
 *
 * 소유 범위:
 * - sessions + 순수 뮤테이터(addMessageToSession/updateMessageInSession/setSessionTyping, deps [])
 * - 페르소나 목록 변경 시 세션 슬롯 동기화 effect (T6a)
 * - triggerSummaryUpdate / handleLoadMoreMessages / handleSelectPersona (T6b)
 *
 * 본체 잔류(의도):
 * - activePersonaId/setActivePersonaId는 persona 관심사 → 본체 소유, 인자 주입.
 * - handleSendMessage / triggerQuickMenu(최대 결합)는 T6c에서 처리. 현재는 본체가
 *   훅이 노출한 sessions/setSessions/헬퍼를 그대로 호출(동작 변경 0).
 * - handlePersonaClick/handleGuestPersonaClick(인트로 모달 오케스트레이션)는 본체 유지.
 *
 * deps: handleSelectPersona가 건드리는 타 관심사 setter/값을 주입받아 원본 동작을 보존.
 *   (quickMenu setInputPlaceholder/setActiveQuickMenu, 이미지 personaImages/refreshPersonaImages,
 *    본체 setFirstChatMap/setIsGreeting). effect deps도 원본 그대로 유지.
 */
interface PersonaSessionDeps {
    setInputPlaceholder: (v: string | null) => void;
    setActiveQuickMenu: (v: string | null) => void;
    personaImages: Record<string, PersonaImage[]>;
    refreshPersonaImages: (personaId: string) => void;
    setFirstChatMap: (m: Record<string, string>) => void;
    setIsGreeting: (v: boolean) => void;
}

export function usePersonaSession(
    personas: Persona[],
    activePersonaId: string,
    setActivePersonaId: (id: string) => void,
    deps: PersonaSessionDeps,
) {
    const { setInputPlaceholder, setActiveQuickMenu, personaImages, refreshPersonaImages, setFirstChatMap, setIsGreeting } = deps;
    const [sessions, setSessions] = useState<Record<string, ChatSessionState>>({});
    // 세션 로드가 진행 중인 personaId — sessions(비동기 state)만으론 못 막는 중복 생성 방어.
    const loadingRef = useRef<Set<string>>(new Set());

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

    // 백그라운드 요약 생성 (사용자 UX에 영향 없음)
    const triggerSummaryUpdate = useCallback(async (dbSessionId: number, messages: Message[], personaId: string) => {
        console.log(`[요약 시작] sessionId=${dbSessionId}, 메시지 수=${messages.length}`);
        setSessions(prev => ({ ...prev, [personaId]: { ...prev[personaId], isSummarizing: true } }));
        try {
            // 백엔드에서 요약 생성 + 기억 추출까지 처리
            const saved = await sessionApi.summarize(dbSessionId);
            if (!saved) { console.warn('[요약 생성 실패]'); return; }
            console.log('[요약 저장 완료]', saved.id);
            setSessions(prev => ({
                ...prev,
                [personaId]: { ...prev[personaId], summary: saved, isSummarizing: false },
            }));
        } catch (error) {
            console.error('[요약 저장 실패]', error);
            setSessions(prev => ({ ...prev, [personaId]: { ...prev[personaId], isSummarizing: false } }));
        }
    }, []);

    const handleSelectPersona = useCallback(async (personaId: string, { prefetchOnly = false } = {}) => {
        if (!prefetchOnly) { setActivePersonaId(personaId); setInputPlaceholder(null); setActiveQuickMenu(null); }
        // ★이미지 로드는 세션 유무보다 먼저 한다(2026-07-28): 아래 early return이 이미지 로드보다
        // 위에 있으면, 이미 대화 이력이 있는 페르소나로 진입할 때 프로필 이미지가 영영 안 뜬다.
        if (!personaImages[personaId]) {
            refreshPersonaImages(personaId);
        }

        const current = sessions[personaId];
        if (current?.dbSessionId || current?.messages.length > 0) return;

        // ★중복 세션 생성 방지(2026-07-28): sessions는 비동기 상태라, 프리페치 직후 곧바로
        // 같은 페르소나로 다시 호출되면(딥링크: prefetchOnly → handlePersonaClick) 위 검사가
        // 아직 갱신 전 값을 보고 통과해 sessionApi.create가 두 번 돈다 = 빈 세션 하나가 남고
        // 인사말도 두 번 생성돼 비용이 샌다. ref로 '진행 중'을 즉시 표시해 막는다.
        if (loadingRef.current.has(personaId)) return;
        loadingRef.current.add(personaId);

        try {


            const { sessions: allSessions, firstChatMap: fcMap } = await sessionApi.getAll();
            setFirstChatMap(fcMap);
            const existing = allSessions.find(s => s.personaId === personaId);
            if (existing) {
                const [result, summary] = await Promise.all([
                    sessionApi.getMessages(existing.id),
                    sessionApi.getSummary(existing.id).catch(() => null),
                ]);
                const messages = result.messages;
                const hasMore = result.hasMore;
                const mapped = (messages || []).map((m: any) => ({ ...m, id: String(m.id) }));
                const oldestMessageId = mapped.length > 0 ? Number(mapped[0].id) : undefined;
                setSessions(prev => ({
                    ...prev,
                    [personaId]: { messages: mapped, isTyping: false, dbSessionId: existing.id, hasMoreMessages: hasMore, oldestMessageId, summary },
                }));

                // AI 자동 인사 (첫 방문 or 2시간 이상 경과 시)
                if (mapped.length === 0) setIsGreeting(true);
                sessionApi.greet(existing.id).then(greetMsg => {
                    if ((greetMsg as any).skipped) return;
                    setSessions(prev => ({
                        ...prev,
                        [personaId]: { ...prev[personaId], messages: [...prev[personaId].messages, { ...greetMsg, id: String(greetMsg.id) }] },
                    }));
                }).catch(() => {}).finally(() => setIsGreeting(false));

                // 메시지 10개 이상인데 요약 없으면 백그라운드 생성
                if (mapped.length >= 10 && !summary) {
                    triggerSummaryUpdate(existing.id, mapped, personaId);
                }
            } else {
                // 세션 자체가 없는 첫 진입: 세션 생성 후 greet
                const newSession = await sessionApi.create(personaId);
                setSessions(prev => ({
                    ...prev,
                    [personaId]: { messages: [], isTyping: false, dbSessionId: newSession.id, hasMoreMessages: false },
                }));
                setIsGreeting(true);
                sessionApi.greet(newSession.id).then(greetMsg => {
                    setSessions(prev => ({
                        ...prev,
                        [personaId]: { ...prev[personaId], messages: [{ ...greetMsg, id: String(greetMsg.id) }] },
                    }));
                }).catch(() => {}).finally(() => setIsGreeting(false));
            }
        } catch (error) {
            console.error('세션 로드 실패:', error);
        } finally {
            loadingRef.current.delete(personaId);
        }
    }, [sessions]);

    // 이전 메시지 더 불러오기
    const handleLoadMoreMessages = useCallback(async () => {
        const session = sessions[activePersonaId];
        if (!session?.dbSessionId || !session?.hasMoreMessages) return;

        try {
            const result = await sessionApi.getMessages(session.dbSessionId, session.oldestMessageId);
            const older = result.messages;
            const hasMore = result.hasMore;
            const mapped = (older || []).map((m: any) => ({ ...m, id: String(m.id) }));
            const oldestMessageId = mapped.length > 0 ? Number(mapped[0].id) : session.oldestMessageId;
            setSessions(prev => ({
                ...prev,
                [activePersonaId]: {
                    ...prev[activePersonaId],
                    messages: [...mapped, ...prev[activePersonaId].messages],
                    hasMoreMessages: hasMore,
                    oldestMessageId,
                },
            }));
        } catch (error) {
            console.error('이전 메시지 로드 실패:', error);
        }
    }, [sessions, activePersonaId]);

    return {
        sessions,
        setSessions,
        addMessageToSession,
        updateMessageInSession,
        setSessionTyping,
        triggerSummaryUpdate,
        handleSelectPersona,
        handleLoadMoreMessages,
    };
}
