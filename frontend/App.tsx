import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chat } from '@google/genai';
import { Message, Persona, PersonaImage, ChatSessionState, User } from './types';
import { getAIInstance, createChatSession, generateSummary, extractMemories } from './services/geminiService';
import { personaApi, personaImageApi, sessionApi, authApi, memoryApi } from './services/apiService';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { LandingPage } from './components/LandingPage';
import { MainPage } from './components/MainPage';
import { PersonaImageViewer } from './components/PersonaImageViewer';
import { Icon } from './components/Icons';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showMain, setShowMain] = useState(false);
    const [resetToken, setResetToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token');
    });

    const [personas, setPersonas] = useState<Persona[]>([]);
    const [isPersonasLoading, setIsPersonasLoading] = useState(true);
    const [activePersonaId, setActivePersonaId] = useState<string>('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(false);

    const [sessions, setSessions] = useState<Record<string, ChatSessionState>>({});
    const [personaImages, setPersonaImages] = useState<Record<string, PersonaImage[]>>({});

    const chatInstancesRef = useRef<Record<string, Chat>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 앱 시작 시 페르소나 로드 (공개) + 로그인 확인 동시 실행
    useEffect(() => {
        personaApi.getAll()
            .then(data => { setPersonas(data); if (data.length > 0) setActivePersonaId(data[0].id); })
            .catch(() => {})
            .finally(() => setIsPersonasLoading(false));

        const token = localStorage.getItem('token');
        if (!token) { setIsAuthChecking(false); return; }
        authApi.me()
            .then(({ user }) => { setUser(user); setShowMain(true); })
            .catch(() => localStorage.removeItem('token'))
            .finally(() => setIsAuthChecking(false));
    }, []);

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

    // 페르소나 선택 시 DB에서 이전 세션/메시지 로드 (최근 50개)
    const handleSelectPersona = useCallback(async (personaId: string) => {
        setActivePersonaId(personaId);
        const current = sessions[personaId];
        if (current?.dbSessionId || current?.messages.length > 0) return;

        try {
            // 이미지 로드 (아직 없을 경우)
            if (!personaImages[personaId]) {
                personaImageApi.getAll(personaId)
                    .then(imgs => setPersonaImages(prev => ({ ...prev, [personaId]: imgs })))
                    .catch(() => {});
            }

            const allSessions = await sessionApi.getAll();
            const existing = allSessions.find(s => s.personaId === personaId);
            if (existing) {
                const [result, summary] = await Promise.all([
                    sessionApi.getMessages(existing.id),
                    sessionApi.getSummary(existing.id).catch(() => null),
                ]);
                const messages = Array.isArray(result) ? result : result.messages;
                const hasMore = Array.isArray(result) ? false : result.hasMore;
                const mapped = (messages || []).map((m: any) => ({ ...m, id: String(m.id) }));
                const oldestMessageId = mapped.length > 0 ? Number(mapped[0].id) : undefined;
                setSessions(prev => ({
                    ...prev,
                    [personaId]: { messages: mapped, isTyping: false, dbSessionId: existing.id, hasMoreMessages: hasMore, oldestMessageId, summary },
                }));

                // 메시지 10개 이상인데 요약 없으면 백그라운드 생성
                if (mapped.length >= 10 && !summary) {
                    triggerSummaryUpdate(existing.id, mapped, personaId);
                }
            }
        } catch (error) {
            console.error('세션 로드 실패:', error);
        }
    }, [sessions]);

    // 이전 메시지 더 불러오기
    const handleLoadMoreMessages = useCallback(async () => {
        const session = sessions[activePersonaId];
        if (!session?.dbSessionId || !session?.hasMoreMessages) return;

        try {
            const result = await sessionApi.getMessages(session.dbSessionId, session.oldestMessageId);
            const older = Array.isArray(result) ? result : result.messages;
            const hasMore = Array.isArray(result) ? false : result.hasMore;
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

    // 백그라운드 요약 생성 (사용자 UX에 영향 없음)
    const triggerSummaryUpdate = useCallback(async (dbSessionId: number, messages: Message[], personaId: string) => {
        console.log(`[요약 시작] sessionId=${dbSessionId}, 메시지 수=${messages.length}`);
        setSessions(prev => ({ ...prev, [personaId]: { ...prev[personaId], isSummarizing: true } }));
        try {
            const summaryText = await generateSummary(messages);
            if (!summaryText) { console.warn('[요약 생성 실패] summaryText 없음'); return; }
            const saved = await sessionApi.saveSummary(dbSessionId, summaryText, messages.length);
            console.log('[요약 저장 완료]', saved.id);
            setSessions(prev => ({
                ...prev,
                [personaId]: { ...prev[personaId], summary: saved, isSummarizing: false },
            }));

            // 요약에서 개인 정보 추출 → UserMemory 저장
            extractMemories(summaryText, '').then(memories => {
                memories.forEach(content => memoryApi.save(content, '요약추출').catch(() => {}));
                if (memories.length > 0) console.log(`[기억 추출] 요약에서 ${memories.length}개 저장`);
            }).catch(() => {});
        } catch (error) {
            console.error('[요약 저장 실패]', error);
            setSessions(prev => ({ ...prev, [personaId]: { ...prev[personaId], isSummarizing: false } }));
        }
    }, []);

    const visiblePersonas = personas.filter(p => p.isVisible !== false);
    const activePersona = personas.find(p => p.id === activePersonaId) || visiblePersonas[0];
    const currentSession = sessions[activePersonaId] || { messages: [], isTyping: false };
    const activeImages = personaImages[activePersonaId] || [];

    const handleSwitchImage = (image: PersonaImage) => {
        setPersonaImages(prev => ({
            ...prev,
            [activePersonaId]: (prev[activePersonaId] || []).map(img => ({ ...img, isMain: img.id === image.id })),
        }));
        // 채팅 인스턴스 초기화 → 다음 메시지 시 새 이미지 설명으로 시스템 프롬프트 재생성
        delete chatInstancesRef.current[activePersonaId];
    };

    useEffect(() => {
        if (!isAdminMode) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentSession.messages, isAdminMode]);

    useEffect(() => {
        if (textareaRef.current && !isAdminMode) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [inputText, isAdminMode]);

    const handleAuthSuccess = (loggedInUser: User, token: string) => {
        localStorage.setItem('token', token);
        setShowAuthModal(false);
        setUser(loggedInUser);
        setShowMain(true);
    };

    const handleLogout = async () => {
        await authApi.logout();
        localStorage.removeItem('token');
        setUser(null);
        setShowMain(false);
        setShowAuthModal(false);
        setPersonas([]);
        setSessions({});
        setActivePersonaId('');
        chatInstancesRef.current = {};
    };

    const handleAdminLogin = () => {
        if (user?.role === 'ADMIN') {
            setIsAdminMode(true);
        } else {
            alert('관리자 권한이 없습니다.');
        }
    };

    const handleSendMessage = async () => {
        const text = inputText.trim();
        if (!text || currentSession.isTyping || !user) return;

        const ai = getAIInstance();
        if (!ai) {
            addMessageToSession(activePersonaId, {
                id: Date.now().toString(), role: 'model',
                text: '오류: AI 클라이언트가 초기화되지 않았습니다.',
                error: true,
            });
            return;
        }

        const userMsgId = Date.now().toString();
        addMessageToSession(activePersonaId, { id: userMsgId, role: 'user', text });
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setSessionTyping(activePersonaId, true);

        // DB 세션 생성 (없을 경우)
        let dbSessionId = currentSession.dbSessionId;
        if (!dbSessionId) {
            try {
                const newSession = await sessionApi.create(activePersonaId, text.slice(0, 30));
                dbSessionId = newSession.id;
                setSessions(prev => ({
                    ...prev,
                    [activePersonaId]: { ...prev[activePersonaId], dbSessionId },
                }));
            } catch (error) {
                console.error('세션 생성 실패:', error);
            }
        }

        // 유저 메시지 DB 저장
        if (dbSessionId) {
            sessionApi.saveMessage(dbSessionId, 'user', text).catch(console.error);
        }

        const modelMsgId = (Date.now() + 1).toString();
        addMessageToSession(activePersonaId, { id: modelMsgId, role: 'model', text: '', isStreaming: true });

        try {
            let chat = chatInstancesRef.current[activePersonaId];
            if (!chat) {
                const summaryText = currentSession.summary?.summary;
                const mainImage = activeImages.find(img => img.isMain);
                const imageContext = mainImage?.description
                    ? `\n\n--- 당신의 현재 모습 ---\n당신은 지금 이런 모습을 하고 있습니다: ${mainImage.description}\n사용자가 당신의 외모, 복장, 표정에 대해 언급하면 마치 실제로 그 모습인 것처럼 자연스럽게 반응하세요. "저는 AI라 외형이 없습니다"와 같은 말은 절대 하지 마세요. 당신은 이 모습으로 존재합니다.\n---`
                    : '';

                // 관련 기억 검색
                let memoryContext = '';
                try {
                    const memories = await memoryApi.search(text);
                    if (memories.length > 0) {
                        const memList = memories.map(m => `- ${m.content}`).join('\n');
                        memoryContext = `\n\n--- 사용자에 대해 알고 있는 정보 ---\n${memList}\n이 정보를 대화에 자연스럽게 녹여서 활용하세요. 직접적으로 "당신이 ~라고 알고 있어요"라고 말하지 말고, 맥락에 맞게 자연스럽게 반영하세요.\n---`;
                    }
                } catch {}

                const systemInstruction =
                    `${activePersona.systemInstruction}${imageContext}${memoryContext}` +
                    (summaryText ? `\n\n--- 이전 대화 요약 ---\n${summaryText}\n---` : '');
                chat = createChatSession(systemInstruction)!;
                chatInstancesRef.current[activePersonaId] = chat;
            }

            const responseStream = await chat.sendMessageStream({ message: text });
            let fullResponse = '';
            for await (const chunk of responseStream) {
                if (chunk.text) {
                    fullResponse += chunk.text;
                    updateMessageInSession(activePersonaId, modelMsgId, { text: fullResponse });
                }
            }
            updateMessageInSession(activePersonaId, modelMsgId, { isStreaming: false });

            // AI 응답 DB 저장
            if (dbSessionId && fullResponse) {
                sessionApi.saveMessage(dbSessionId, 'model', fullResponse).catch(console.error);
            }

            // 10개 배수 도달 시 백그라운드 요약 업데이트
            const allMessages = sessions[activePersonaId]?.messages || [];
            const totalCount = allMessages.length;
            const currentSummaryCount = sessions[activePersonaId]?.summary?.messageCount ?? 0;
            if (dbSessionId && totalCount >= 10 && totalCount % 10 === 0 && totalCount > currentSummaryCount) {
                triggerSummaryUpdate(dbSessionId, allMessages, activePersonaId);
            }

            // 백그라운드 기억 추출 + 저장
            if (fullResponse && user) {
                extractMemories(text, fullResponse).then(memories => {
                    memories.forEach(content => memoryApi.save(content).catch(() => {}));
                }).catch(() => {});
            }
        } catch (error: any) {
            updateMessageInSession(activePersonaId, modelMsgId, {
                text: `죄송합니다. 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
                isStreaming: false, error: true,
            });
        } finally {
            setSessionTyping(activePersonaId, false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const clearChat = () => {
        if (window.confirm(`${activePersona.name}와의 대화 기록을 지우시겠습니까?`)) {
            setSessions(prev => ({
                ...prev,
                [activePersonaId]: { messages: [], isTyping: false, hasMoreMessages: false, oldestMessageId: undefined },
            }));
            delete chatInstancesRef.current[activePersonaId];
        }
    };

    const handleSavePersona = async (updatedPersona: Persona): Promise<void> => {
        try {
            const exists = personas.some(p => p.id === updatedPersona.id);
            let saved: Persona;
            if (exists) {
                saved = await personaApi.update(updatedPersona.id, updatedPersona);
                setPersonas(prev => prev.map(p => p.id === saved.id ? saved : p));
                delete chatInstancesRef.current[saved.id];
            } else {
                saved = await personaApi.create(updatedPersona);
                setPersonas(prev => [...prev, saved].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
                setSessions(prev => ({ ...prev, [saved.id]: { messages: [], isTyping: false } }));
            }
        } catch (error: any) {
            alert(error.message || '저장에 실패했습니다.');
        }
    };

    const handleDeletePersona = async (id: string) => {
        try {
            await personaApi.delete(id);
            setPersonas(prev => prev.filter(p => p.id !== id));
            delete chatInstancesRef.current[id];
        } catch (error: any) {
            alert(error.message || '삭제에 실패했습니다.');
        }
    };

    const handleReorderPersona = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === personas.length - 1) return;

        const newPersonas = [...personas];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newPersonas[index], newPersonas[swapIndex]] = [newPersonas[swapIndex], newPersonas[index]];
        const updated = newPersonas.map((p, i) => ({ ...p, order: i }));
        setPersonas(updated);

        try {
            await Promise.all(updated.map(p => personaApi.update(p.id, { order: p.order })));
        } catch (error) {
            console.error('순서 저장 실패:', error);
        }
    };

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

    if (resetToken) {
        return (
            <>
                <LandingPage personas={visiblePersonas} isLoading={isPersonasLoading} onStart={() => {}} />
                <ResetPasswordModal
                    token={resetToken}
                    onClose={() => setResetToken(null)}
                />
            </>
        );
    }

    if (isAuthChecking) {
        return (
            <div className="flex h-full w-full bg-gray-950 items-center justify-center">
                <div className="text-center">
                    <Icon name="Bot" size={48} className="text-blue-500 animate-bounce mx-auto mb-4" />
                    <p className="text-gray-400">로딩 중...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <>
                <LandingPage personas={visiblePersonas} isLoading={isPersonasLoading} onStart={() => setShowAuthModal(true)} />
                {showAuthModal && (
                    <AuthModal
                        onSuccess={handleAuthSuccess}
                        onClose={() => setShowAuthModal(false)}
                        defaultMode="login"
                    />
                )}
            </>
        );
    }

    if (showMain) {
        return (
            <MainPage
                personas={visiblePersonas}
                isLoading={isPersonasLoading}
                user={user}
                onSelectPersona={(id) => { setShowMain(false); handleSelectPersona(id); }}
                onLogout={handleLogout}
                onAdminClick={() => { setShowMain(false); handleAdminLogin(); }}
            />
        );
    }

    return (
        <div className="flex h-screen w-full bg-gray-950">
            <Sidebar
                personas={visiblePersonas}
                activePersonaId={activePersonaId}
                onSelectPersona={handleSelectPersona}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                onAdminClick={handleAdminLogin}
                onReorder={handleReorderPersona}
                user={user}
                onLogout={handleLogout}
                onGoHome={() => setShowMain(true)}
            />

            {isAdminMode ? (
                <AdminPanel
                    personas={personas}
                    onSave={handleSavePersona}
                    onDelete={handleDeletePersona}
                    onClose={() => setIsAdminMode(false)}
                />
            ) : (
                <div className="flex-1 flex h-full relative min-w-0">
                    {(() => {
                        const mainImg = activeImages.find(img => img.isMain);
                        const displayUrl = mainImg?.imageUrl || activePersona?.imageUrl;
                        const displayDesc = mainImg?.description;
                        return displayUrl ? (
                            <div className="hidden md:flex w-1/3 border-r border-gray-800 bg-gray-900/30 p-8 flex-col items-center justify-center">
                                <div className="w-full max-h-[60%] flex items-center justify-center">
                                    <img
                                        src={displayUrl}
                                        alt={`${activePersona?.name} 프로필`}
                                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-all duration-300"
                                    />
                                </div>
                                <h3 className="mt-8 text-2xl font-bold text-gray-100 text-center">{activePersona?.name}</h3>
                                <p className="mt-3 text-base text-gray-400 text-center leading-relaxed">{activePersona?.description}</p>
                                {activeImages.length > 1 && (
                                    <div className="flex gap-2 mt-4 justify-center flex-wrap">
                                        {activeImages.map(img => (
                                            <button
                                                key={img.id}
                                                onClick={() => handleSwitchImage(img)}
                                                title={img.description || ''}
                                                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                                    img.isMain ? 'border-blue-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                                                }`}
                                            >
                                                <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null;
                    })()}

                    <div className={`flex flex-col h-full ${(activeImages.find(img => img.isMain)?.imageUrl || activePersona?.imageUrl) ? 'w-full md:w-2/3' : 'w-full'}`}>
                        <header className="h-16 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 z-10">
                            <div className="flex items-center">
                                <button
                                    className="md:hidden mr-3 text-gray-400 hover:text-white"
                                    onClick={() => setIsSidebarOpen(true)}
                                >
                                    <Icon name="Menu" size={24} />
                                </button>
                                {activePersona && (
                                    <>
                                        <div className={`p-1.5 rounded-md mr-3 bg-gradient-to-br ${activePersona.colorClass} text-white`}>
                                            <Icon name={activePersona.iconName} size={20} />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-gray-100">{activePersona.name}</h2>
                                            <p className="text-xs text-gray-400 hidden sm:block">{activePersona.description}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </header>

                        {activeImages.length > 0 && (
                            <PersonaImageViewer images={activeImages} onSelectMain={handleSwitchImage} />
                        )}

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                            {currentSession.messages.length === 0 && activePersona ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-80 px-4">
                                    {!activePersona.imageUrl && (
                                        <div className={`p-5 rounded-2xl mb-6 bg-gradient-to-br ${activePersona.colorClass} text-white shadow-lg`}>
                                            <Icon name={activePersona.iconName} size={56} />
                                        </div>
                                    )}
                                    <h3 className="text-2xl font-bold text-gray-100 mb-3">{activePersona.name}</h3>
                                    <p className="text-gray-400 max-w-md mb-6 text-lg">{activePersona.description}</p>
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 max-w-lg w-full text-sm text-gray-300 text-left">
                                        <p className="font-semibold text-gray-200 mb-2 flex items-center">
                                            <Icon name="Bot" size={16} className="mr-2" />
                                            적용된 시스템 프롬프트:
                                        </p>
                                        <p className="italic text-gray-400">"{activePersona.systemInstruction}"</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-4xl mx-auto">
                                    {currentSession.hasMoreMessages && (
                                        <div className="flex justify-center mb-4">
                                            <button
                                                onClick={handleLoadMoreMessages}
                                                className="text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-full transition-colors"
                                            >
                                                이전 대화 불러오기
                                            </button>
                                        </div>
                                    )}
                                    {currentSession.messages.map(msg => (
                                        <MessageBubble key={msg.id} message={msg} personaName={activePersona?.name || 'AI'} />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0">
                            <div className="max-w-4xl mx-auto relative flex items-end bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500 transition-all">
                                <textarea
                                    ref={textareaRef}
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={activePersona ? `${activePersona.name}에게 메시지 보내기...` : '메시지를 입력하세요...'}
                                    className="w-full max-h-[200px] bg-transparent text-gray-100 placeholder-gray-500 p-4 pr-12 resize-none focus:outline-none rounded-2xl"
                                    rows={1}
                                    disabled={!activePersona}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputText.trim() || currentSession.isTyping || !activePersona}
                                    className={`absolute right-2 bottom-2 p-2 rounded-xl transition-colors
                                        ${inputText.trim() && !currentSession.isTyping && activePersona
                                            ? `bg-gradient-to-r ${activePersona.colorClass} text-white shadow-lg`
                                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <Icon name="Send" size={18} />
                                </button>
                            </div>
                            <div className="text-center mt-2 text-[10px] text-gray-600">
                                AI는 실수를 할 수 있습니다. 중요한 정보는 확인해주세요.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
