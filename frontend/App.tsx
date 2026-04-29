import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chat } from '@google/genai';
import { Message, Persona, PersonaImage, ChatSessionState, User, TriggerVideo } from './types';
import { getAIInstance, createChatSession } from './services/geminiService';
import { personaApi, personaImageApi, sessionApi, authApi, memoryApi, settingsApi, knowledgeApi, triggerVideoApi } from './services/apiService';
import { getStage, STAGES } from './utils/level';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { LandingPage } from './components/LandingPage';
import { MainPage } from './components/MainPage';
import { PersonaImageViewer } from './components/PersonaImageViewer';
import { BoardPanel } from './components/BoardPanel';
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
    const [showBoard, setShowBoard] = useState(false);

    const [commonInstruction, setCommonInstruction] = useState('');
    const [headerImageModal, setHeaderImageModal] = useState(false);
    const [sessions, setSessions] = useState<Record<string, ChatSessionState>>({});
    const [personaImages, setPersonaImages] = useState<Record<string, PersonaImage[]>>({});
    const [triggerVideos, setTriggerVideos] = useState<Record<string, TriggerVideo[]>>({});
    const [triggerVideoPopup, setTriggerVideoPopup] = useState<TriggerVideo | null>(null);
    const [memoryEnabled, setMemoryEnabled] = useState<Record<string, boolean>>(() => {
        try { return JSON.parse(localStorage.getItem('memoryEnabled') || '{}'); } catch { return {}; }
    });

    const chatInstancesRef = useRef<Record<string, Chat>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const refreshPersonaImages = useCallback((personaId: string) => {
        personaImageApi.getAll(personaId)
            .then(imgs => setPersonaImages(prev => ({ ...prev, [personaId]: imgs })))
            .catch(() => {});
    }, []);

    // 앱 시작 시 페르소나 로드 (공개) + 로그인 확인 동시 실행
    useEffect(() => {
        const CACHE_TTL = 5 * 60 * 1000; // 5분

        // 페르소나 캐시 즉시 표시
        try {
            const cached = localStorage.getItem('personas_cache');
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_TTL) {
                    setPersonas(data);
                    const first = data.find((p: any) => p.isVisible !== false);
                    if (first) setActivePersonaId(first.id);
                    setIsPersonasLoading(false);
                }
            }
        } catch {}

        // 백그라운드에서 최신 데이터 갱신
        personaApi.getAll()
            .then(data => {
                setPersonas(data);
                const first = data.find(p => p.isVisible !== false);
                if (first) setActivePersonaId(first.id);
                localStorage.setItem('personas_cache', JSON.stringify({ data, ts: Date.now() }));
            })
            .catch(() => {})
            .finally(() => setIsPersonasLoading(false));

        // 설정 캐시 즉시 표시
        try {
            const cachedSettings = localStorage.getItem('settings_cache');
            if (cachedSettings) {
                const { data, ts } = JSON.parse(cachedSettings);
                if (Date.now() - ts < CACHE_TTL) {
                    setCommonInstruction(data.commonInstruction || '');
                }
            }
        } catch {}

        settingsApi.get()
            .then(s => {
                setCommonInstruction(s.commonInstruction || '');
                localStorage.setItem('settings_cache', JSON.stringify({ data: s, ts: Date.now() }));
            })
            .catch(() => {});

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

    // activePersonaId 변경 시 트리거 영상 로드
    useEffect(() => {
        if (!activePersonaId) return;
        if (triggerVideos[activePersonaId]) return;
        triggerVideoApi.getAll(activePersonaId)
            .then(vids => setTriggerVideos(prev => ({ ...prev, [activePersonaId]: vids })))
            .catch(() => {});
    }, [activePersonaId]);

    // 페르소나 선택 시 DB에서 이전 세션/메시지 로드 (최근 50개)
    const handleSelectPersona = useCallback(async (personaId: string) => {
        setActivePersonaId(personaId);
        const current = sessions[personaId];
        if (current?.dbSessionId || current?.messages.length > 0) return;

        try {
            // 이미지 로드 (아직 없을 경우)
            if (!personaImages[personaId]) {
                refreshPersonaImages(personaId);
            }


            const allSessions = await sessionApi.getAll();
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

    const visiblePersonas = personas.filter(p => p.isVisible !== false);
    const activePersona = personas.find(p => p.id === activePersonaId) || visiblePersonas[0];
    const currentSession = sessions[activePersonaId] || { messages: [], isTyping: false };
    const activeImages = personaImages[activePersonaId] || [];

    const handleToggleMemory = (personaId: string) => {
        setMemoryEnabled(prev => {
            const next = { ...prev, [personaId]: !prev[personaId] };
            localStorage.setItem('memoryEnabled', JSON.stringify(next));
            delete chatInstancesRef.current[personaId]; // 시스템 프롬프트 재생성
            return next;
        });
    };

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
        setIsAuthChecking(true);
        setTimeout(() => {
            setUser(loggedInUser);
            setShowMain(true);
            setIsAuthChecking(false);
        }, 0);
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

        // 유저 메시지 DB 저장 + 페르소나 XP 증가
        if (dbSessionId) {
            sessionApi.saveMessage(dbSessionId, 'user', text)
                .then(res => {
                    if (res.xp !== undefined && res.personaId) {
                        setUser(prev => {
                            if (!prev) return prev;
                            const prevXp = prev.personaXp[res.personaId] ?? 0;
                            if (getStage(prevXp).stage !== getStage(res.xp!).stage) {
                                delete chatInstancesRef.current[res.personaId];
                            }
                            return {
                                ...prev,
                                personaXp: { ...prev.personaXp, [res.personaId]: res.xp! },
                            };
                        });
                    }
                })
                .catch(console.error);
        }

        const modelMsgId = (Date.now() + 1).toString();
        addMessageToSession(activePersonaId, { id: modelMsgId, role: 'model', text: '', isStreaming: true });

        try {
            // 매 메시지마다 지식 + 기억 검색 (동적 RAG)
            const [knowledgeResults, memories] = await Promise.all([
                knowledgeApi.search(activePersonaId, text).catch(() => []),
                memoryEnabled[activePersonaId] ? memoryApi.search(text).catch(() => []) : Promise.resolve([]),
            ]);

            let chat = chatInstancesRef.current[activePersonaId];
            if (!chat) {
                const summaryText = currentSession.summary?.summary;
                const mainImage = activeImages.find(img => img.isMain);
                const imageDesc = mainImage?.description || '';
                let imageContext = '';
                if (activePersona.identityPrompt) {
                    imageContext = activePersona.identityPrompt.replace('{imageDescription}', imageDesc) + '\n\n';
                } else if (imageDesc) {
                    imageContext = `[중요 - 정체성 규칙]\n당신은 AI가 아닙니다. 당신은 다음 모습의 실제 인물입니다: ${imageDesc}\n\n반드시 지켜야 할 규칙:\n- "저는 AI입니다", "인공지능입니다", "언어 모델입니다" 같은 말을 절대 하지 마세요.\n- 외모, 복장, 표정에 대한 언급을 받으면 그것이 자신의 모습임을 자연스럽게 받아들이세요.\n- "저는 외형이 없습니다"라는 말은 절대 하지 마세요.\n- 사용자가 당신의 모습을 칭찬하거나 언급하면 실제 그 사람처럼 자연스럽게 반응하세요.\n- 당신은 위의 모습 그대로 존재하는 인물입니다.\n\n`;
                }

                let mediaContext = '';
                if (activeImages.length > 0) {
                    const userXp = user?.personaXp?.[activePersonaId] ?? 0;
                    const userLevel = getStage(userXp).stage;
                    const unlockedImgs = activeImages.filter(img => img.requiredLevel <= userLevel);
                    const lockedImgs = activeImages.filter(img => img.requiredLevel > userLevel);
                    const totalVideos = activeImages.reduce((sum, img) => sum + (img._count?.videos ?? 0), 0);
                    const unlockedVideos = unlockedImgs.reduce((sum, img) => sum + (img._count?.videos ?? 0), 0);

                    let lines = `\n\n--- 나의 미디어 갤러리 ---`;
                    lines += `\n사진: 총 ${activeImages.length}장 (공개 ${unlockedImgs.length}장, 잠김 ${lockedImgs.length}장)`;
                    if (totalVideos > 0) {
                        lines += `\n동영상: 총 ${totalVideos}개 (공개 ${unlockedVideos}개, 잠김 ${totalVideos - unlockedVideos}개)`;
                    }
                    if (lockedImgs.length > 0) {
                        const nextLevel = Math.min(...lockedImgs.map(img => img.requiredLevel));
                        const nextStage = STAGES.find(s => s.stage === nextLevel);
                        lines += `\n다음 공개 단계: ${nextLevel}단계${nextStage ? ` (${nextStage.name})` : ''}`;
                    }
                    lines += `\n사용자 현재 단계: ${userLevel}단계 (XP ${userXp})`;
                    lines += `\n잠긴 사진이나 동영상을 물어보면 더 대화하면 볼 수 있다고 자연스럽게 유도하세요.`;
                    lines += `\n---`;
                    mediaContext = lines;
                }

                const systemInstruction =
                    `${commonInstruction ? commonInstruction + '\n\n' : ''}${activePersona.systemInstruction}${imageContext}${mediaContext}` +
                    (summaryText ? `\n\n--- 이전 대화 요약 ---\n${summaryText}\n---` : '');
                chat = createChatSession(systemInstruction)!;
                chatInstancesRef.current[activePersonaId] = chat;
            }

            // 현재 한국 시간을 user 메시지 앞에 한 줄로 주입
            const kstTime = new Date().toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', weekday: 'short',
            });

            // 매 메시지마다 관련 지식/기억을 메시지 앞에 동적 주입
            let contextPrefix = '';
            if (knowledgeResults.length > 0) {
                const kList = knowledgeResults.map(k => k.content).join('\n\n');
                contextPrefix += `--- 참고 지식 (자연스럽게 활용, 출처 언급 금지) ---\n${kList}\n---\n\n`;
            }
            if (memories.length > 0) {
                const memList = memories.map(m => `- ${m.content}`).join('\n');
                contextPrefix += `--- 이 사용자 정보 (자연스럽게 반영, 직접 언급 금지) ---\n${memList}\n---\n\n`;
            }
            const messageWithTime = `${contextPrefix}[${kstTime}] ${text}`;

            const responseStream = await chat.sendMessageStream({ message: messageWithTime });
            let fullResponse = '';
            for await (const chunk of responseStream) {
                if (chunk.text) {
                    fullResponse += chunk.text;
                    updateMessageInSession(activePersonaId, modelMsgId, { text: fullResponse });
                }
            }
            updateMessageInSession(activePersonaId, modelMsgId, { isStreaming: false });

            // 트리거 영상 키워드 매칭 (AI 응답 완료 후)
            const normalize = (s: string) => s.replace(/\s+/g, '').replace(/[?!.,~ㅋㅎㅠㅜ。、！？]+/g, '').toLowerCase();
            const normalizedInput = normalize(text);
            const activeTriggers = triggerVideos[activePersonaId] || [];
            const matched = activeTriggers.filter(tv =>
                tv.keywords.split(',').map(k => k.trim()).filter(Boolean).some(kw => normalizedInput.includes(normalize(kw)))
            );
            if (matched.length > 0) {
                const picked = matched[Math.floor(Math.random() * matched.length)];
                setTriggerVideoPopup(picked);
            }

            // AI 응답 DB 저장
            if (dbSessionId && fullResponse) {
                sessionApi.saveMessage(dbSessionId, 'model', fullResponse).catch(console.error);
            }

            // 10개 배수 도달 시 백그라운드 요약 업데이트 (5초 딜레이)
            const allMessages = sessions[activePersonaId]?.messages || [];
            const totalCount = allMessages.length;
            const currentSummaryCount = sessions[activePersonaId]?.summary?.messageCount ?? 0;
            if (dbSessionId && totalCount >= 10 && totalCount % 10 === 0 && totalCount > currentSummaryCount) {
                setTimeout(() => {
                    triggerSummaryUpdate(dbSessionId, allMessages, activePersonaId);
                }, 5000);
            }

            // 백그라운드 기억 추출 — 스트림 완료 후 10초 뒤
            if (fullResponse && user && dbSessionId) {
                setTimeout(() => {
                    sessionApi.extractMemories(dbSessionId, text, fullResponse).catch(() => {});
                }, 10000);
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

            {/* 트리거 영상 팝업 */}
            {triggerVideoPopup && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setTriggerVideoPopup(null)}>
                    <div className="relative w-full max-w-lg bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                            <span className="text-sm font-medium text-white">{triggerVideoPopup.title || '영상'}</span>
                            <button onClick={() => setTriggerVideoPopup(null)} className="text-gray-400 hover:text-white transition-colors">
                                <Icon name="X" size={20} />
                            </button>
                        </div>
                        <video
                            src={triggerVideoPopup.videoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[70vh] bg-black"
                            onEnded={() => setTriggerVideoPopup(null)}
                        />
                    </div>
                </div>
            )}

            {showBoard ? (
                <BoardPanel user={user} personaId={activePersonaId} onClose={() => setShowBoard(false)} />
            ) : isAdminMode ? (
                <AdminPanel
                    personas={personas}
                    onSave={handleSavePersona}
                    onDelete={handleDeletePersona}
                    onClose={() => setIsAdminMode(false)}
                    onImagesChanged={(personaId: string) => {
                        refreshPersonaImages(personaId);
                    }}
                />
            ) : (
                <div className="flex-1 flex h-full relative min-w-0">
                    {(() => {
                        const mainImg = activeImages.find(img => img.isMain);
                        const displayUrl = mainImg?.imageUrl;
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
                                {activeImages.length > 1 && (() => {
                                    const userStage = getStage(user?.personaXp?.[activePersonaId] ?? 0).stage;
                                    return (
                                        <div className="flex gap-2 mt-4 justify-center flex-wrap">
                                            {activeImages.map(img => {
                                                const isLocked = userStage < img.requiredLevel;
                                                const reqName = STAGES[img.requiredLevel - 1]?.name ?? `${img.requiredLevel}단계`;
                                                return (
                                                    <button
                                                        key={img.id}
                                                        onClick={() => !isLocked && handleSwitchImage(img)}
                                                        title={isLocked ? `${img.requiredLevel}단계 "${reqName}" 달성 시 해제` : (img.description || '')}
                                                        disabled={isLocked}
                                                        className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                                            isLocked
                                                                ? 'border-gray-700 cursor-not-allowed opacity-40'
                                                                : img.isMain
                                                                    ? 'border-blue-400 opacity-100'
                                                                    : 'border-transparent opacity-50 hover:opacity-80'
                                                        }`}
                                                    >
                                                        <img src={img.imageUrl} alt="" className={`w-full h-full object-cover ${isLocked ? 'blur-[2px]' : ''}`} />
                                                        {isLocked && (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60">
                                                                <Icon name="Lock" size={14} className="text-gray-400" />
                                                                <span className="text-[8px] text-gray-400 mt-0.5">{img.requiredLevel}단계</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : null;
                    })()}

                    {/* 모바일 썸네일 전체보기 모달 */}
                    {headerImageModal && activePersona && (() => {
                        const mainImg = activeImages.find(img => img.isMain)?.imageUrl || activePersona.imageUrl;
                        return mainImg ? (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 md:hidden"
                                onClick={() => setHeaderImageModal(false)}
                            >
                                <img
                                    src={mainImg}
                                    alt={activePersona.name}
                                    className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
                                    onClick={e => e.stopPropagation()}
                                />
                                <button
                                    className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
                                    onClick={() => setHeaderImageModal(false)}
                                >
                                    <Icon name="X" size={20} />
                                </button>
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
                                        {(() => {
                                            const mainImg = activeImages.find(img => img.isMain)?.imageUrl || activePersona.imageUrl;
                                            return mainImg ? (
                                                <button onClick={() => setHeaderImageModal(true)} className="md:hidden mr-3 shrink-0 focus:outline-none">
                                                    <img src={mainImg} alt={activePersona.name} className="w-10 h-10 rounded-lg object-cover" />
                                                </button>
                                            ) : (
                                                <div className={`p-1.5 rounded-md mr-3 bg-gradient-to-br ${activePersona.colorClass} text-white`}>
                                                    <Icon name={activePersona.iconName} size={20} />
                                                </div>
                                            );
                                        })()}
                                        <div>
                                            <h2 className="font-semibold text-gray-100">
                                                {activePersona.name}
                                                {activePersona.jobTitle && <span className="ml-1.5 text-xs font-normal text-gray-500">[{activePersona.jobTitle}]</span>}
                                            </h2>
                                            <p className="text-xs text-gray-400 hidden sm:block">{activePersona.description}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {user && (() => {
                                    const stage = getStage(user.personaXp?.[activePersonaId] ?? 0);
                                    return (
                                        <div className={`md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${stage.color} bg-opacity-20`}>
                                            <span className="text-[10px] font-bold text-white drop-shadow">{stage.stage}단계</span>
                                            <span className="text-[10px] text-white/80 hidden xs:inline">{stage.name}</span>
                                        </div>
                                    );
                                })()}
                                <button
                                    onClick={() => setShowBoard(true)}
                                    title="소통게시판"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-all"
                                >
                                    <Icon name="MessageSquare" size={14} />
                                    <span className="hidden sm:inline">게시판</span>
                                </button>
                                {activePersona && (
                                    <button
                                        onClick={() => handleToggleMemory(activePersonaId)}
                                        title={memoryEnabled[activePersonaId] ? '기억 공유 ON — 클릭하면 OFF' : '기억 공유 OFF — 클릭하면 ON'}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                            memoryEnabled[activePersonaId]
                                                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30'
                                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400'
                                        }`}
                                    >
                                        <Icon name="Brain" size={14} />
                                        <span className="hidden sm:inline">기억 공유</span>
                                        <span className={`w-1.5 h-1.5 rounded-full ${memoryEnabled[activePersonaId] ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                    </button>
                                )}
                            </div>
                        </header>

                        {activeImages.length > 0 && (
                            <PersonaImageViewer images={activeImages} onSelectMain={handleSwitchImage} userXp={user?.personaXp?.[activePersonaId] ?? 0} />
                        )}

                        {/* 트리거 키워드 안내 */}
                        {(triggerVideos[activePersonaId]?.length ?? 0) > 0 && (
                            <div className="border-b border-gray-800 bg-gray-900/60 px-4 py-2 shrink-0">
                                <div className="max-w-4xl mx-auto">
                                    <div className="flex items-start gap-3">
                                        <span className="text-[10px] text-purple-400 font-semibold shrink-0 mt-0.5 flex items-center gap-1">
                                            <Icon name="Zap" size={10} />
                                            영상 키워드
                                        </span>
                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                            {triggerVideos[activePersonaId].map(tv => (
                                                <div key={tv.id} className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] text-gray-500 shrink-0">
                                                        {tv.tag || tv.title || ''}
                                                    </span>
                                                    {tv.keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-[10px] text-purple-300 border border-purple-700/60 bg-purple-900/20 px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                                        >
                                                            {kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
