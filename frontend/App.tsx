import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PointsProvider, usePoints } from './contexts/PointsContext';
import { Coins } from 'lucide-react';
import { Chat } from '@google/genai';
import { Message, Persona, PersonaImage, ChatSessionState, User, TriggerVideo, SwingAnalysis, Announcement, Category } from './types';
import { getAIInstance, createChatSession } from './services/geminiService';
import { personaApi, personaImageApi, sessionApi, authApi, memoryApi, settingsApi, knowledgeApi, triggerVideoApi, swingAnalysisApi, announcementApi, categoryApi, userProfileApi, quickMenuApi, stockReportApi } from './services/apiService';
import { pointApi } from './services/pointService';
import { getStage, STAGES } from './utils/level';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { LandingPage } from './components/LandingPage';
import { Theme } from './components/themes';
import { MainPage } from './components/MainPage';
import { PersonaImageViewer } from './components/PersonaImageViewer';
import { BoardPanel } from './components/BoardPanel';
import { PartnerBoardPanel } from './components/PartnerBoardPanel';
import { UserProfileModal } from './components/UserProfileModal';
import { StockAnalysisBoard } from './components/StockAnalysisBoard';
import { HotKeywordBoard } from './components/HotKeywordBoard';
import { ResearchBoard } from './components/ResearchBoard';
import { UsedItemBoard } from './components/UsedItemBoard';
import { LuxuryBoard } from './components/LuxuryBoard';
import { MathTutorBoard } from './components/MathTutorBoard';
import { TodayNewsBoard } from './components/TodayNewsBoard';
import { SwingAnalysisBoard } from './components/SwingAnalysisBoard';
import { AnnouncementModal } from './components/AnnouncementModal';
import { ProductExtractDialog } from './components/ProductExtractDialog';
import { GolfReserveDialog } from './components/GolfReserveDialog';
import { Icon } from './components/Icons';
import { PointDisplay } from './components/PointDisplay';
import { PointModal } from './components/PointModal';
import { PointDashboard } from './components/PointDashboard';
import { StarButton } from './components/StarBalloonButton';
import { BirthInfoModal, BirthInfo } from './components/BirthInfoModal';
import { PartnerInfoModal } from './components/PartnerInfoModal';
import { SubMenuModal, SubMenuConfig, SubMenuItem } from './components/SubMenuModal';
import { FaceReadingModal } from './components/FaceReadingModal';
import { FaceReadingResultCard } from './components/FaceReadingResultCard';
import { FaceReadingResult } from './services/apiService';
import { QuickMenuResultCard } from './components/QuickMenuResultCard';


const AppContent: React.FC = () => {
    const {
        paidPoints: userPaidPoints,
        bonusPoints: userBonusPoints,
        showPointModal, setShowPointModal,
        showPointDashboard, setShowPointDashboard,
        levelUpInfo, setLevelUpInfo,
        setPaidPoints: setUserPaidPoints,
        setBonusPoints: setUserBonusPoints,
    } = usePoints();

    const [user, setUser] = useState<User | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showAuthPage, setShowAuthPage] = useState(false);
    const [showMain, setShowMain] = useState(false);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ui_theme') as Theme) || 'lavender');
    const handleThemeChange = (t: Theme) => { setTheme(t); localStorage.setItem('ui_theme', t); };
    const [resetToken, setResetToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token');
    });

    const [pendingPayment] = useState<{ paymentKey: string; orderId: string; amount: number } | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentKey = params.get('paymentKey');
        const orderId = params.get('orderId');
        const amount = params.get('amount');
        if (paymentKey && orderId && amount) {
            window.history.replaceState({}, '', window.location.pathname);
            return { paymentKey, orderId, amount: Number(amount) };
        }
        return null;
    });
    const [paymentSuccess, setPaymentSuccess] = useState<{ points: number } | null>(null);
    const paymentProcessedRef = useRef(false);

    const [personas, setPersonas] = useState<Persona[]>(() => {
        try {
            const cached = localStorage.getItem('personas_cache');
            if (cached) {
                const { data } = JSON.parse(cached);
                if (Array.isArray(data) && data.length > 0) return data;
            }
        } catch {}
        return [];
    });
    const [isPersonasLoading, setIsPersonasLoading] = useState<boolean>(() => {
        try {
            const cached = localStorage.getItem('personas_cache');
            if (cached) {
                const { data } = JSON.parse(cached);
                if (Array.isArray(data) && data.length > 0) return false;
            }
        } catch {}
        return true;
    });
    const [activePersonaId, setActivePersonaId] = useState<string>(() => {
        try {
            const cached = localStorage.getItem('personas_cache');
            if (cached) {
                const { data } = JSON.parse(cached);
                if (Array.isArray(data) && data.length > 0) {
                    const first = data.find((p: any) => p.isVisible !== false);
                    return first?.id || '';
                }
            }
        } catch {}
        return '';
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showBoard, setShowBoard] = useState(false);
    const [showPartnerBoard, setShowPartnerBoard] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [showStockAnalysis, setShowStockAnalysis] = useState(false);
    const [showHotKeyword, setShowHotKeyword] = useState(false);
    const [showResearch, setShowResearch] = useState(false);
    const [showProductExtract, setShowProductExtract] = useState(false);
    const [showGolfReserve, setShowGolfReserve] = useState(false);
    const [comingSoonMsg, setComingSoonMsg] = useState('');
    const [showUsedItem, setShowUsedItem] = useState(false);
    const [showLuxuryBoard, setShowLuxuryBoard] = useState(false);
    const [showTodayNews, setShowTodayNews] = useState(false);
    const [firstChatMap, setFirstChatMap] = useState<Record<string, string>>({});

    const [commonInstruction, setCommonInstruction] = useState('');
    const [heroImageUrl, setHeroImageUrl] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [headerImageModal, setHeaderImageModal] = useState(false);
    const [sessions, setSessions] = useState<Record<string, ChatSessionState>>({});
    const [personaImages, setPersonaImages] = useState<Record<string, PersonaImage[]>>({});
    const [triggerVideos, setTriggerVideos] = useState<Record<string, TriggerVideo[]>>({});
    const [triggerVideoPopup, setTriggerVideoPopup] = useState<TriggerVideo | null>(null);
    const [introVideoModal, setIntroVideoModal] = useState<{ personaId: string; type: 'video' | 'image'; url: string; guestMode?: boolean } | null>(null);
    const [starVideoModal, setStarVideoModal] = useState<{ url: string; personaId: string; amount: number } | null>(null);
    const [memoryEnabled, setMemoryEnabled] = useState<Record<string, boolean>>(() => {
        try { return JSON.parse(localStorage.getItem('memoryEnabled') || '{}'); } catch { return {}; }
    });

    const [swingUploading, setSwingUploading] = useState(false);
    const [swingStep, setSwingStep] = useState<'idle' | 'uploading' | 'analyzing' | 'saving'>('idle');
    const [swingResult, setSwingResult] = useState<{ id: number; analysis: SwingAnalysis; createdAt: string } | null>(null);
    const [showSwingBoard, setShowSwingBoard] = useState(false);
    const [showMathTutor, setShowMathTutor] = useState(false);

    // 퀵메뉴 / 생년월일 폼 상태
    const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(null);
    const [showBirthModal, setShowBirthModal] = useState(false);
    const [pendingQuickMenu, setPendingQuickMenu] = useState<{ label: string; prompt: string; resultCard?: boolean } | null>(null);
    const [quickMenuResult, setQuickMenuResult] = useState<{ title: string; result: string } | null>(null);
    const [quickMenuLoading, setQuickMenuLoading] = useState(false);
    const [inputPlaceholder, setInputPlaceholder] = useState<string | null>(null);
    const [activeQuickMenu, setActiveQuickMenu] = useState<string | null>(null);
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [pendingPartnerMenu, setPendingPartnerMenu] = useState<{ label: string; prompt: string } | null>(null);
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [faceReadingResult, setFaceReadingResult] = useState<FaceReadingResult | null>(null);
    const [subMenuConfig, setSubMenuConfig] = useState<SubMenuConfig | null>(null);
    const subMenuResultCardRef = useRef(false);
    const birthModalSkippedRef = useRef<Set<string>>(new Set());
    const [isGreeting, setIsGreeting] = useState(false);
    const [chatBgSelected, setChatBgSelected] = useState<string | null>(null);
    const chatBgPersonaRef = useRef<string | null>(null);

    const chatInstancesRef = useRef<Record<string, Chat>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const swingVideoRef = useRef<HTMLInputElement>(null);
    const headerMenuRef = useRef<HTMLDivElement>(null);
    const starThanksPromiseRef = useRef<{ promise: Promise<{ message: { text: string }; sessionId: string }>; personaId: string } | null>(null);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);

    // 공지사항
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<number>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem('readAnnouncements') || '[]')); } catch { return new Set(); }
    });

    useEffect(() => {
        announcementApi.getAll().then(list => {
            setAnnouncements(list);
            // 새 공지 있으면 자동 팝업
            const unread = list.filter(a => !readAnnouncementIds.has(a.id));
            if (unread.length > 0) setShowAnnouncementModal(true);
        }).catch(() => {});
    }, []);

    const handleReadAnnouncements = (ids: number[]) => {
        setReadAnnouncementIds(prev => {
            const next = new Set([...prev, ...ids]);
            localStorage.setItem('readAnnouncements', JSON.stringify([...next]));
            return next;
        });
    };

    const unreadAnnouncementCount = announcements.filter(a => !readAnnouncementIds.has(a.id)).length;

    const refreshPersonaImages = useCallback((personaId: string) => {
        personaImageApi.getAll(personaId)
            .then(imgs => setPersonaImages(prev => ({ ...prev, [personaId]: imgs })))
            .catch(() => {});
    }, []);

    // 앱 시작 시 페르소나 로드 (공개) + 로그인 확인 동시 실행
    useEffect(() => {
        // 항상 최신 데이터로 백그라운드 갱신 (초기값은 useState lazy init에서 캐시로 처리)
        personaApi.getAll()
            .then(data => {
                setPersonas(data);
                const first = data.find(p => p.isVisible !== false);
                if (first) setActivePersonaId(first.id);
                localStorage.setItem('personas_cache', JSON.stringify({ data, ts: Date.now() }));
            })
            .catch(() => {})
            .finally(() => setIsPersonasLoading(false));

        // 설정 캐시 즉시 표시 (나이 무관)
        try {
            const cachedSettings = localStorage.getItem('settings_cache');
            if (cachedSettings) {
                const { data } = JSON.parse(cachedSettings);
                setCommonInstruction(data.commonInstruction || '');
            }
        } catch {}

        categoryApi.getAll().then(setCategories).catch(() => {});

        settingsApi.get()
            .then(s => {
                setCommonInstruction(s.commonInstruction || '');
                setHeroImageUrl(s.heroImageUrl || '');
                // 서버에 저장된 기억 공유 설정 복원 (localStorage보다 우선)
                if (s.memory_enabled) {
                    try {
                        const parsed = JSON.parse(s.memory_enabled);
                        setMemoryEnabled(parsed);
                        localStorage.setItem('memoryEnabled', s.memory_enabled);
                    } catch {}
                }
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

    // 로그인 후 birth info 로드
    const [isBirthInfoLoaded, setIsBirthInfoLoaded] = useState(false);
    useEffect(() => {
        if (!user) return;
        userProfileApi.getBirthInfo().then(({ birthInfoJson }) => {
            if (birthInfoJson) {
                try { setBirthInfo(JSON.parse(birthInfoJson)); } catch {}
            }
        }).catch(() => {}).finally(() => setIsBirthInfoLoaded(true));
    }, [user?.id]);

    // 채팅 진입 시 birth info 없으면 자동 모달
    useEffect(() => {
        if (!activePersonaId || !isBirthInfoLoaded || birthInfo) return;
        if (birthModalSkippedRef.current.has(activePersonaId)) return;
        const persona = personas.find(p => p.id === activePersonaId);
        if (!persona?.quickMenuJson) return;
        try {
            const config = JSON.parse(persona.quickMenuJson);
            if (config.useBirthInfo) setShowBirthModal(true);
        } catch {}
    }, [activePersonaId, isBirthInfoLoaded, birthInfo, personas]);

    // 로그인 후 포인트 잔액 로드
    useEffect(() => {
        if (!user) return;
        if (user.paidPoints !== undefined) {
            setUserPaidPoints(user.paidPoints);
            setUserBonusPoints(user.bonusPoints);
        } else {
            pointApi.getBalance().then(d => { setUserPaidPoints(d.paidPoints); setUserBonusPoints(d.bonusPoints); }).catch(() => {});
        }
    }, [user?.id]);

    // 결제 리다이렉트 처리
    useEffect(() => {
        if (!user || !pendingPayment || paymentProcessedRef.current) return;
        paymentProcessedRef.current = true;
        pointApi.confirmPayment(pendingPayment.paymentKey, pendingPayment.orderId, pendingPayment.amount)
            .then(result => {
                setUserPaidPoints(result.newPaidBalance);
                setUserBonusPoints(result.newBonusBalance);
                setPaymentSuccess({ points: result.points });
                setTimeout(() => setPaymentSuccess(null), 4000);
            })
            .catch(e => console.error('[payment confirm]', e));
    }, [user?.id]); // eslint-disable-line

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

    // 채팅 배경 랜덤 선택 (페르소나 전환 or 페르소나 데이터 최초 로드 시)
    useEffect(() => {
        if (!activePersonaId || !personas.length) return;
        if (chatBgPersonaRef.current === activePersonaId) return; // 이미 선택됨
        const persona = personas.find(p => p.id === activePersonaId);
        chatBgPersonaRef.current = activePersonaId;
        if (!persona?.chatBgUrl) { setChatBgSelected(null); return; }
        try {
            const urls: string[] = persona.chatBgUrl.startsWith('[') ? JSON.parse(persona.chatBgUrl) : [persona.chatBgUrl];
            setChatBgSelected(urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : null);
        } catch { setChatBgSelected(persona.chatBgUrl); }
    }, [activePersonaId, personas]);

    // 페르소나 선택 시 DB에서 이전 세션/메시지 로드 (최근 50개)
    const handleSelectPersona = useCallback(async (personaId: string, { prefetchOnly = false } = {}) => {
        if (!prefetchOnly) { setActivePersonaId(personaId); setInputPlaceholder(null); setActiveQuickMenu(null); }
        const current = sessions[personaId];
        if (current?.dbSessionId || current?.messages.length > 0) return;

        try {
            // 이미지 로드 (아직 없을 경우)
            if (!personaImages[personaId]) {
                refreshPersonaImages(personaId);
            }


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
        }
    }, [sessions]);

    // 인트로 영상/이미지 확인 후 채팅 진입 (없으면 바로 진입)
    const handlePersonaClick = useCallback((personaId: string) => {
        setIsSidebarCollapsed(true);
        const persona = personas.find(p => p.id === personaId);
        if (persona?.introVideoUrl) {
            setIntroVideoModal({ personaId, type: 'video', url: persona.introVideoUrl });
            handleSelectPersona(personaId, { prefetchOnly: true }); // 인트로 보는 동안 인사말 미리 준비
        } else if (persona?.imageUrl) {
            setIntroVideoModal({ personaId, type: 'image', url: persona.imageUrl });
            handleSelectPersona(personaId, { prefetchOnly: true }); // 인트로 보는 동안 인사말 미리 준비
        } else {
            handleSelectPersona(personaId);
        }
    }, [personas, handleSelectPersona]);

    // 비회원이 페르소나 클릭 → 인트로 표시, 입장 시 회원가입 유도
    const handleGuestPersonaClick = useCallback((personaId: string) => {
        const persona = personas.find(p => p.id === personaId);
        if (persona?.introVideoUrl) {
            setIntroVideoModal({ personaId, type: 'video', url: persona.introVideoUrl, guestMode: true });
        } else if (persona?.imageUrl) {
            setIntroVideoModal({ personaId, type: 'image', url: persona.imageUrl, guestMode: true });
        } else {
            setShowAuthPage(true);
        }
    }, [personas]);

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

    const triggerQuickMenu = useCallback((menu: { label: string; prompt: string }) => {
        if (!activePersonaId) return;
        const dbSessionId = sessions[activePersonaId]?.dbSessionId;
        if (!dbSessionId) return;
        setSessions(prev => ({ ...prev, [activePersonaId]: { ...prev[activePersonaId], isTyping: true } }));
        sessionApi.quickTrigger(dbSessionId, menu.label, menu.prompt)
            .then(msg => {
                setSessions(prev => ({
                    ...prev,
                    [activePersonaId]: {
                        ...prev[activePersonaId],
                        isTyping: false,
                        messages: [...prev[activePersonaId].messages, { ...msg, id: String(msg.id) }],
                    },
                }));
            })
            .catch(() => {
                setSessions(prev => ({ ...prev, [activePersonaId]: { ...prev[activePersonaId], isTyping: false } }));
            });
    }, [activePersonaId, sessions]);

    const handleSubItem = useCallback((item: SubMenuItem) => {
        setSubMenuConfig(null);
        if (item.partnerModal) {
            setPendingPartnerMenu({ label: item.label, prompt: item.prompt ?? '' });
            setShowPartnerModal(true);
            return;
        }
        if (item.placeholder) {
            setInputText('');
            setInputPlaceholder(item.placeholder);
            setTimeout(() => textareaRef.current?.focus(), 0);
            return;
        }
        setInputText(item.prompt ?? '');
        setTimeout(() => textareaRef.current?.focus(), 0);
    }, []);

    const isAdmin = user?.role === 'ADMIN';
    const visiblePersonas = isAdmin
        ? personas
        : personas.filter(p => p.isVisible !== false);
    const activePersona = personas.find(p => p.id === activePersonaId) || visiblePersonas[0];
    const currentSession = sessions[activePersonaId] || { messages: [], isTyping: false };
    const activeImages = personaImages[activePersonaId] || [];
    const isGolfPersona = !!(activePersona?.jobTitle?.includes('골프') || activePersona?.name?.includes('골프'));

    // undefined(미설정) = ON 기본값, false만 OFF
    const isMemoryOn = (personaId: string) => memoryEnabled[personaId] === true;

    const handleToggleMemory = (personaId: string) => {
        setMemoryEnabled(prev => {
            const next = { ...prev, [personaId]: !isMemoryOn(personaId) };
            const json = JSON.stringify(next);
            localStorage.setItem('memoryEnabled', json);
            settingsApi.update({ memory_enabled: json }).catch(() => {});
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

    useEffect(() => {
        if (!showHeaderMenu) return;
        const handler = (e: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
                setShowHeaderMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showHeaderMenu]);

    const handleAuthSuccess = (_loggedInUser: User, token: string) => {
        localStorage.setItem('token', token);
        window.location.reload();
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

    const handleSwingVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activePersonaId || !user) return;
        e.target.value = '';
        setSwingUploading(true);
        setSwingStep('uploading');
        const pendingMsgId = Date.now().toString();
        addMessageToSession(activePersonaId, {
            id: pendingMsgId, role: 'model',
            text: '스윙 영상을 분석 중입니다... 잠시 기다려 주세요. (약 20~40초 소요)',
            isStreaming: true,
        });
        try {
            const { signedUrl, publicUrl } = await swingAnalysisApi.getSignedUrl(file.type, file.name);
            await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
            setSwingStep('analyzing');
            const result = await swingAnalysisApi.analyze(publicUrl, activePersonaId, file.type, file.name);
            setSwingStep('saving');
            updateMessageInSession(activePersonaId, pendingMsgId, {
                text: `스윙 분석 완료! 종합 점수: **${result.analysis.overallScore}점**\n${result.analysis.overallComment}`,
                isStreaming: false,
            });
            setSwingResult(result);
            setShowSwingBoard(true);
        } catch (error: any) {
            updateMessageInSession(activePersonaId, pendingMsgId, {
                text: `스윙 분석 실패: ${error.message}`,
                isStreaming: false, error: true,
            });
        } finally {
            setSwingUploading(false);
            setSwingStep('idle');
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
        setInputPlaceholder(null);
        setActiveQuickMenu(null);
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

        // 유저 메시지 DB 저장 + 포인트 차감 + XP 적립 (blocking: 포인트 부족 시 AI 호출 차단)
        if (dbSessionId) {
            try {
                const res = await sessionApi.saveMessage(dbSessionId, 'user', text);
                if (res.points) {
                    setUserPaidPoints(res.points.paidBalance);
                    setUserBonusPoints(res.points.bonusBalance);
                    if (res.points.leveledUp && res.points.levelupBonus > 0) {
                        setLevelUpInfo({ newStage: res.points.newStage, levelupBonus: res.points.levelupBonus });
                        setTimeout(() => setLevelUpInfo(null), 3000);
                    }
                }
                if (res.xp !== undefined && res.personaId) {
                    setUser(prev => {
                        if (!prev) return prev;
                        const prevXp = prev.personaXp[res.personaId!] ?? 0;
                        if (getStage(prevXp).stage !== getStage(res.xp!).stage) {
                            delete chatInstancesRef.current[res.personaId!];
                        }
                        return {
                            ...prev,
                            personaXp: { ...prev.personaXp, [res.personaId!]: res.xp! },
                        };
                    });
                }
            } catch (e: any) {
                if (e.code === 'INSUFFICIENT_POINTS') {
                    setShowPointModal(true);
                    setSessionTyping(activePersonaId, false);
                    return;
                }
                console.error('메시지 저장 실패:', e);
            }
        }

        const modelMsgId = (Date.now() + 1).toString();
        addMessageToSession(activePersonaId, { id: modelMsgId, role: 'model', text: '', isStreaming: true });

        try {
            const YUNCHAEWON_ID = 'cmois970w0000xsvie6aag2f5';
            // 매 메시지마다 지식 + 기억 검색 (동적 RAG)
            const [knowledgeResults, memories, stockReportChunks] = await Promise.all([
                knowledgeApi.search(activePersonaId, text).catch(() => []),
                isMemoryOn(activePersonaId) ? memoryApi.search(text).catch(() => []) : Promise.resolve([]),
                activePersonaId === YUNCHAEWON_ID ? stockReportApi.search(text).catch(() => []) : Promise.resolve([]),
            ]);

            // SDK 내부 history가 너무 커지면 Vertex AI 요청이 느려짐 → 30메시지마다 리셋
            const sentMsgCount = (sessions[activePersonaId]?.messages || [])
                .filter(m => !m.isStreaming && !m.error).length;
            if (sentMsgCount > 0 && sentMsgCount % 30 === 0) {
                delete chatInstancesRef.current[activePersonaId];
            }

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

                let birthContext = '';
                try {
                    const qc = activePersona.quickMenuJson ? JSON.parse(activePersona.quickMenuJson) : {};
                    if (qc.useBirthInfo && birthInfo) {
                        const t = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                        const cal = birthInfo.lunar ? '음력' : '양력';
                        birthContext = `\n\n--- 사용자 정보 ---\n이름: ${birthInfo.name}\n생년월일: ${cal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${t}\n---`;
                    }
                } catch {}

                const kstNow = new Date().toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric', month: 'long', day: 'numeric',
                    weekday: 'long', hour: '2-digit', minute: '2-digit',
                });
                const userXpForLevel = user?.personaXp?.[activePersonaId] ?? 0;
                const userStageForLevel = getStage(userXpForLevel);
                const relationDepth: Record<number, string> = {
                    1: '처음 만난 사이. 설레지만 어색하고 조심스럽습니다.',
                    2: '조금씩 알아가는 사이. 대화가 점점 편안해지고 있습니다.',
                    3: '친해지고 있는 사이. 편안하고 자연스러운 대화가 가능합니다.',
                    4: '많이 친숙한 사이. 솔직한 속마음도 편하게 나눌 수 있습니다.',
                    5: '매우 친밀한 사이. 깊은 감정과 속마음을 자연스럽게 나눕니다.',
                    6: '세상에서 가장 특별한 사이. 누구보다 서로를 잘 아는 깊고 진한 관계입니다.',
                };
                const levelContext = `\n\n[사용자와의 관계] ${userStageForLevel.stage}단계 · ${userStageForLevel.name} — ${relationDepth[userStageForLevel.stage] ?? ''} 이 관계 깊이에 맞게 말투와 친밀도를 자연스럽게 조절하세요.`;
                const systemInstruction =
                    `${commonInstruction ? commonInstruction + '\n\n' : ''}${activePersona.systemInstruction}${imageContext}${mediaContext}${birthContext}` +
                    (summaryText ? `\n\n--- 이전 대화 요약 ---\n${summaryText}\n---` : '') +
                    `\n\n현재 날짜/시각: ${kstNow} (한국 표준시)` +
                    levelContext +
                    `\n\n[자가 검증] 답변을 출력하기 전, 작성한 내용이 ① 이 캐릭터의 말투·감성에 맞는지, ② 대화 맥락과 무관한 단어나 표현이 섞이지 않았는지 스스로 확인한다. 어긋난 부분이 있으면 수정한 최종 답변만 출력한다.`;
                chat = createChatSession(systemInstruction)!;
                chatInstancesRef.current[activePersonaId] = chat;
            }

            // 현재 한국 시간을 user 메시지 앞에 한 줄로 주입
            const kstTime = new Date().toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
                weekday: 'short', hour: '2-digit', minute: '2-digit',
            });

            // 매 메시지마다 관련 지식/기억을 메시지 앞에 동적 주입
            let contextPrefix = '';
            if (knowledgeResults.length > 0) {
                const kList = knowledgeResults.map(k => k.content).join('\n\n');
                contextPrefix += `--- 참고 지식 (자연스럽게 활용, 출처 언급 금지) ---\n${kList}\n---\n\n`;
            }
            if (memories.length > 0) {
                const memList = memories.map(m => `- ${m.content}`).join('\n');
                contextPrefix += `--- 이 사용자 정보 (대화에 자연스럽게 반영. 사용자가 직접 묻는다면 알고 있음을 인정할 것) ---\n${memList}\n---\n\n`;
            }
            if (stockReportChunks.length > 0) {
                const rList = stockReportChunks.map(c => `[${c.stockName}(${c.ticker}) ${c.reportDate}]\n${c.content}`).join('\n\n');
                contextPrefix += `--- 보유 종목 분석 리포트 (사용자가 저장한 주식 보고서, 관련 질문에 자연스럽게 활용) ---\n${rList}\n---\n\n`;
            }
            const messageWithTime = `${contextPrefix}[${kstTime}] ${text}`;

            const responseStream = await chat.sendMessageStream({ message: messageWithTime });
            let fullResponse = '';
            // 90초 타임아웃: Vertex AI가 응답 없으면 isTyping stuck 방지
            const streamTimeout = setTimeout(() => {
                delete chatInstancesRef.current[activePersonaId];
            }, 90_000);
            try {
                for await (const chunk of responseStream) {
                    if (chunk.text) {
                        fullResponse += chunk.text;
                        updateMessageInSession(activePersonaId, modelMsgId, { text: fullResponse });
                    }
                }
            } finally {
                clearTimeout(streamTimeout);
            }
            updateMessageInSession(activePersonaId, modelMsgId, { isStreaming: false });

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
                <LandingPage personas={visiblePersonas} isLoading={isPersonasLoading} onStart={() => {}} theme={theme} onThemeChange={handleThemeChange} heroImageUrl={heroImageUrl} categories={categories} />
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
        if (showAuthPage) {
            return (
                <AuthModal
                    onSuccess={handleAuthSuccess}
                    onBack={() => setShowAuthPage(false)}
                    defaultMode="register"
                    fullScreen
                />
            );
        }
        return (
            <>
                <LandingPage
                    personas={visiblePersonas}
                    isLoading={isPersonasLoading}
                    onStart={() => setShowAuthPage(true)}
                    onLoginClick={() => setShowAuthModal(true)}
                    onPersonaClick={handleGuestPersonaClick}
                    onAnnouncementClick={() => setShowAnnouncementModal(true)}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    theme={theme}
                    onThemeChange={handleThemeChange}
                    heroImageUrl={heroImageUrl}
                    categories={categories}
                />
                {showAuthModal && (
                    <AuthModal
                        onSuccess={handleAuthSuccess}
                        onClose={() => setShowAuthModal(false)}
                        defaultMode="login"
                        personas={personas}
                    />
                )}
                {showAnnouncementModal && (
                    <AnnouncementModal
                        announcements={announcements}
                        readIds={readAnnouncementIds}
                        onRead={handleReadAnnouncements}
                        onClose={() => setShowAnnouncementModal(false)}
                    />
                )}
                {showPartnerBoard && user && (
                    <PartnerBoardPanel user={user} onClose={() => setShowPartnerBoard(false)} />
                )}
                {introVideoModal && (
                    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
                        <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                            {introVideoModal.type === 'video' ? (
                                <video
                                    src={introVideoModal.url}
                                    autoPlay
                                    className="max-w-full max-h-full object-contain"
                                    onError={() => {
                                        const persona = personas.find(p => p.id === introVideoModal.personaId);
                                        if (persona?.imageUrl) {
                                            setIntroVideoModal(prev => prev ? { ...prev, type: 'image', url: persona.imageUrl! } : null);
                                        }
                                    }}
                                />
                            ) : (
                                <img src={introVideoModal.url} alt="프로필" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                        <div className="flex-shrink-0 flex gap-3 justify-center px-6 py-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}>
                            <button
                                onClick={() => { setIntroVideoModal(null); setShowAuthPage(true); }}
                                className="min-h-[44px] px-8 py-2.5 text-white font-semibold rounded-xl transition-all hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
                            >
                                입장
                            </button>
                            <button
                                onClick={() => setIntroVideoModal(null)}
                                className="min-h-[44px] px-8 py-2.5 text-gray-300 font-semibold rounded-xl transition-all hover:text-white"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )}

            </>
        );
    }

    if (showMain) {
        return (
            <>
                <MainPage
                    personas={visiblePersonas}
                    isLoading={isPersonasLoading}
                    user={user}
                    onSelectPersona={(id) => { setShowMain(false); handlePersonaClick(id); }}
                    onLogout={handleLogout}
                    onAdminClick={() => { setShowMain(false); handleAdminLogin(); }}
                    onAnnouncementClick={() => setShowAnnouncementModal(true)}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    onPartnerBoardClick={() => setShowPartnerBoard(true)}
                    onProfileClick={() => setShowUserProfile(true)}
                    theme={theme}
                    onThemeChange={handleThemeChange}
                    heroImageUrl={heroImageUrl}
                    categories={categories}
                />
                {showAnnouncementModal && (
                    <AnnouncementModal
                        announcements={announcements}
                        readIds={readAnnouncementIds}
                        onRead={handleReadAnnouncements}
                        onClose={() => setShowAnnouncementModal(false)}
                    />
                )}
                {showPartnerBoard && (
                    <PartnerBoardPanel user={user} onClose={() => setShowPartnerBoard(false)} />
                )}
                {showUserProfile && (
                    <UserProfileModal user={user} onClose={() => setShowUserProfile(false)} />
                )}
                {showStockAnalysis && (
                    <StockAnalysisBoard onClose={() => setShowStockAnalysis(false)} onConsult={(pid, stockName) => { setActivePersonaId(pid); addMessageToSession(pid, { id: `learn-${Date.now()}`, role: 'model', text: `${stockName} 학습이 완료되었습니다. 이제 ${stockName}에 대해 보고서 내용을 바탕으로 상담드릴 수 있습니다. 궁금한 점을 물어보세요!` }); }} />
                )}
                {showHotKeyword && (
                    <HotKeywordBoard
                        onClose={() => setShowHotKeyword(false)}
                        userEmail={user?.email}
                        userPhone={user?.phone}
                    />
                )}
                {showResearch && (
                    <ResearchBoard onClose={() => setShowResearch(false)} user={user} />
                )}
                {showUsedItem && (
                    <UsedItemBoard onClose={() => setShowUsedItem(false)} />
                )}
                {showLuxuryBoard && (
                    <LuxuryBoard onClose={() => setShowLuxuryBoard(false)} />
                )}
                {showTodayNews && (
                    <TodayNewsBoard onClose={() => setShowTodayNews(false)} />
                )}
                {showMathTutor && (
                    <MathTutorBoard onClose={() => setShowMathTutor(false)} />
                )}
                {showProductExtract && (
                    <ProductExtractDialog
                        onClose={() => setShowProductExtract(false)}
                        userEmail={user?.email}
                    />
                )}
                {showGolfReserve && (
                    <GolfReserveDialog onClose={() => setShowGolfReserve(false)} />
                )}
                {comingSoonMsg && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl shadow-xl flex items-center gap-2 text-sm text-white">
                        <span className="text-yellow-400">🚧</span>
                        {comingSoonMsg}
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="flex h-screen w-full bg-gray-950">
            <Sidebar
                personas={visiblePersonas}
                activePersonaId={activePersonaId}
                onSelectPersona={handlePersonaClick}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(v => !v)}
                onAdminClick={handleAdminLogin}
                onAnnouncementClick={() => setShowAnnouncementModal(true)}
                unreadAnnouncementCount={unreadAnnouncementCount}
                onReorder={handleReorderPersona}
                user={user}
                onLogout={handleLogout}
                onGoHome={() => setShowMain(true)}
                onProfileClick={() => setShowUserProfile(true)}
            />

            {showAnnouncementModal && (
                <AnnouncementModal
                    announcements={announcements}
                    readIds={readAnnouncementIds}
                    onRead={handleReadAnnouncements}
                    onClose={() => setShowAnnouncementModal(false)}
                />
            )}
            {showPartnerBoard && (
                <PartnerBoardPanel user={user} onClose={() => setShowPartnerBoard(false)} />
            )}
            {showUserProfile && (
                <UserProfileModal user={user} onClose={() => setShowUserProfile(false)} />
            )}
            {showStockAnalysis && (
                <StockAnalysisBoard onClose={() => setShowStockAnalysis(false)} onConsult={(pid, stockName) => { setActivePersonaId(pid); addMessageToSession(pid, { id: `learn-${Date.now()}`, role: 'model', text: `${stockName} 학습이 완료되었습니다. 이제 ${stockName}에 대해 보고서 내용을 바탕으로 상담드릴 수 있습니다. 궁금한 점을 물어보세요!` }); }} />
            )}
            {showHotKeyword && (
                <HotKeywordBoard
                    onClose={() => setShowHotKeyword(false)}
                    userEmail={user?.email}
                    userPhone={user?.phone}
                />
            )}
            {showUsedItem && (
                <UsedItemBoard onClose={() => setShowUsedItem(false)} />
            )}
            {showLuxuryBoard && (
                <LuxuryBoard onClose={() => setShowLuxuryBoard(false)} />
            )}
            {showTodayNews && (
                <TodayNewsBoard onClose={() => setShowTodayNews(false)} />
            )}
            {showResearch && (
                <ResearchBoard onClose={() => setShowResearch(false)} user={user} />
            )}
            {showMathTutor && (
                <MathTutorBoard onClose={() => setShowMathTutor(false)} />
            )}
            {showProductExtract && (
                <ProductExtractDialog
                    onClose={() => setShowProductExtract(false)}
                    userEmail={user?.email}
                />
            )}
            {showGolfReserve && (
                <GolfReserveDialog onClose={() => setShowGolfReserve(false)} />
            )}

            {/* 생년월일 명부 모달 */}
            {showBirthModal && (
                <BirthInfoModal
                    initialData={birthInfo ?? undefined}
                    onComplete={info => {
                        setBirthInfo(info);
                        userProfileApi.saveBirthInfo(JSON.stringify(info)).catch(() => {});
                        setShowBirthModal(false);
                        delete chatInstancesRef.current[activePersonaId];
                        if (pendingQuickMenu) {
                            if (pendingQuickMenu.resultCard && activePersonaId) {
                                const { label, prompt } = pendingQuickMenu;
                                setPendingQuickMenu(null);
                                setQuickMenuLoading(true);
                                quickMenuApi.generate(activePersonaId, prompt)
                                    .then(({ result, paidBalance, bonusBalance }) => {
                                        setUserPaidPoints(paidBalance);
                                        setUserBonusPoints(bonusBalance);
                                        setQuickMenuResult({ title: label, result });
                                    })
                                    .catch(e => alert(e.message || '분석에 실패했습니다.'))
                                    .finally(() => setQuickMenuLoading(false));
                            } else {
                                setInputText(pendingQuickMenu.prompt);
                                setPendingQuickMenu(null);
                                setTimeout(() => textareaRef.current?.focus(), 0);
                            }
                        }
                    }}
                    onClose={() => {
                        setShowBirthModal(false);
                        setPendingQuickMenu(null);
                        if (activePersonaId) birthModalSkippedRef.current.add(activePersonaId);
                    }}
                />
            )}

            {/* 서브메뉴 모달 */}
            {subMenuConfig && (
                <SubMenuModal
                    config={subMenuConfig}
                    onSelect={(item: SubMenuItem) => {
                        const isResultCard = subMenuResultCardRef.current;
                        subMenuResultCardRef.current = false;
                        setSubMenuConfig(null);
                        if (isResultCard && !item.partnerModal && !item.placeholder) {
                            let fullPrompt = item.prompt ?? '';
                            if (birthInfo) {
                                const t = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                                const cal = birthInfo.lunar ? '음력' : '양력';
                                fullPrompt += `\n\n사용자 정보 — 이름: ${birthInfo.name}, 생년월일: ${cal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${t}`;
                            }
                            setQuickMenuLoading(true);
                            quickMenuApi.generate(activePersonaId, fullPrompt)
                                .then(({ result, paidBalance, bonusBalance }) => {
                                    setUserPaidPoints(paidBalance);
                                    setUserBonusPoints(bonusBalance);
                                    setQuickMenuResult({ title: item.label, result });
                                })
                                .catch(e => alert(e.message || '분석에 실패했습니다.'))
                                .finally(() => setQuickMenuLoading(false));
                        } else {
                            handleSubItem(item);
                        }
                    }}
                    onClose={() => { subMenuResultCardRef.current = false; setSubMenuConfig(null); }}
                />
            )}

            {/* 궁합 상대방 정보 모달 */}
            {showPartnerModal && (
                <PartnerInfoModal
                    onComplete={partner => {
                        setShowPartnerModal(false);
                        if (!pendingPartnerMenu) return;
                        const t = partner.time && partner.time !== '모름' ? ` ${partner.time}생` : '';
                        const cal = partner.lunar ? '음력' : '양력';
                        const composed = `상대방: ${partner.name}, ${cal} ${partner.year}년 ${partner.month}월 ${partner.day}일${t}. ${pendingPartnerMenu.prompt}`;
                        setPendingPartnerMenu(null);
                        setInputText(composed);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    onClose={() => { setShowPartnerModal(false); setPendingPartnerMenu(null); }}
                />
            )}

            {/* 관상 분석 업로드 모달 */}
            {showFaceModal && (
                <FaceReadingModal
                    personaId={activePersonaId}
                    onResult={result => { setFaceReadingResult(result); }}
                    onPointsUpdated={(paid, bonus) => { setUserPaidPoints(paid); setUserBonusPoints(bonus); }}
                    onClose={() => setShowFaceModal(false)}
                />
            )}

            {/* 관상 분석 결과 카드 */}
            {faceReadingResult && (
                <FaceReadingResultCard
                    result={faceReadingResult}
                    personaName={activePersona?.name ?? ''}
                    bgUrl={activePersona?.faceReadingBgUrl}
                    onClose={() => setFaceReadingResult(null)}
                />
            )}

            {/* 퀵메뉴 결과 카드 */}
            {quickMenuResult && (
                <QuickMenuResultCard
                    title={quickMenuResult.title}
                    result={quickMenuResult.result}
                    personaName={activePersona?.name ?? ''}
                    bgUrl={activePersona?.faceReadingBgUrl}
                    onClose={() => setQuickMenuResult(null)}
                />
            )}

            {/* 퀵메뉴 로딩 오버레이 */}
            {quickMenuLoading && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-amber-200 text-sm" style={{ fontFamily: '"Noto Serif KR", serif' }}>감정 중...</p>
                    </div>
                </div>
            )}

            {/* 포인트 모달 */}
            {showPointModal && (
                <PointModal currentPoints={userPaidPoints + userBonusPoints} userId={user?.id ?? 0} onClose={() => setShowPointModal(false)} />
            )}

            {/* 포인트 대시보드 */}
            {showPointDashboard && (
                <PointDashboard
                    onClose={() => setShowPointDashboard(false)}
                    onCharge={() => { setShowPointDashboard(false); setShowPointModal(true); }}
                    onBalanceRefresh={(paid, bonus) => { setUserPaidPoints(paid); setUserBonusPoints(bonus); }}
                />
            )}

            {/* 별스타 감사 영상 오버레이 */}
            {starVideoModal && (
                <div className="fixed inset-0 z-[80] bg-black flex flex-col">
                    <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                        <video
                            src={starVideoModal.url}
                            autoPlay
                            disablePictureInPicture
                            controlsList="nodownload nofullscreen noremoteplayback"
                            onContextMenu={e => e.preventDefault()}
                            className="max-w-full max-h-full object-contain select-none"
                            onEnded={() => setStarVideoModal(null)}
                            onError={() => setStarVideoModal(null)}
                        />
                    </div>
                    <div className="flex-shrink-0 flex items-center justify-between px-6 py-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
                        <p className="text-yellow-400 text-sm font-semibold">⭐ ×{starVideoModal.amount}</p>
                        <button
                            onClick={() => setStarVideoModal(null)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-white text-sm transition-colors"
                        >
                            건너뛰기
                        </button>
                    </div>
                </div>
            )}

            {/* 레벨업 토스트 */}
            {levelUpInfo && (
                <div
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none"
                >
                    <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white font-bold px-6 py-3 rounded-full shadow-2xl text-sm">
                        🎉 {levelUpInfo.newStage}Lv 달성! +{levelUpInfo.levelupBonus}pt 보너스 획득!
                    </div>
                </div>
            )}

            {/* 결제 성공 토스트 */}
            {paymentSuccess && (
                <div className="fixed top-5 right-5 z-[100] bg-gray-900 border border-green-600 rounded-xl px-4 py-3 flex items-center gap-2 shadow-2xl">
                    <Icon name="CheckCircle" size={16} className="text-green-400" />
                    <span className="text-white text-sm font-semibold">{paymentSuccess.points.toLocaleString()}pt 충전 완료!</span>
                </div>
            )}

            {showSwingBoard && (
                <SwingAnalysisBoard
                    onClose={() => { setShowSwingBoard(false); setSwingResult(null); }}
                    personaId={activePersonaId}
                    initialResult={swingResult}
                />
            )}

            {/* 스윙 분석 진행 상태 카드 */}
            {swingStep !== 'idle' && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] w-72 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 pointer-events-none">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-white">스윙 분석</span>
                        <span className="ml-auto text-[10px] text-gray-500">
                            {swingStep === 'uploading' ? '1/3' : swingStep === 'analyzing' ? '2/3' : '3/3'}
                        </span>
                    </div>
                    {/* 단계 목록 */}
                    {([
                        { key: 'uploading', label: '영상 업로드 중' },
                        { key: 'analyzing', label: 'AI 스윙 분석 중' },
                        { key: 'saving', label: '결과 저장 중' },
                    ] as const).map(({ key, label }, idx) => {
                        const stepOrder = { uploading: 0, analyzing: 1, saving: 2 };
                        const current = stepOrder[swingStep];
                        const mine = idx;
                        const done = mine < current;
                        const active = mine === current;
                        return (
                            <div key={key} className="flex items-center gap-2.5 py-1.5">
                                {done ? (
                                    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                                    </span>
                                ) : active ? (
                                    <span className="w-5 h-5 rounded-full border-2 border-green-400 border-t-transparent animate-spin shrink-0" />
                                ) : (
                                    <span className="w-5 h-5 rounded-full border border-gray-600 shrink-0" />
                                )}
                                <span className={`text-xs ${done ? 'text-green-400' : active ? 'text-white' : 'text-gray-600'}`}>{label}</span>
                            </div>
                        );
                    })}
                    {/* 진행 바 */}
                    <div className="mt-3 w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                            style={{
                                width: swingStep === 'uploading' ? '20%'
                                    : swingStep === 'analyzing' ? '88%'
                                    : '100%',
                                transition: swingStep === 'analyzing'
                                    ? 'width 32s ease-out'
                                    : 'width 0.4s ease',
                            }}
                        />
                    </div>
                    {swingStep === 'analyzing' && (
                        <p className="mt-2 text-[10px] text-gray-500 text-center">Gemini AI가 영상을 분석하고 있어요 (20~40초)</p>
                    )}
                </div>
            )}

            {/* 인트로 영상/이미지 모달 */}
            {introVideoModal && (
                <div className="fixed inset-0 z-[70] bg-black flex flex-col">
                    <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                        {introVideoModal.type === 'video' ? (
                            <video
                                src={introVideoModal.url}
                                autoPlay
                                className="max-w-full max-h-full object-contain"
                                onError={() => {
                                    const persona = personas.find(p => p.id === introVideoModal.personaId);
                                    if (persona?.imageUrl) {
                                        setIntroVideoModal(prev => prev ? { ...prev, type: 'image', url: persona.imageUrl! } : null);
                                    }
                                }}
                            />
                        ) : (
                            <img src={introVideoModal.url} alt="프로필" className="max-w-full max-h-full object-contain" />
                        )}
                    </div>
                    <div className="flex-shrink-0 flex gap-3 justify-center px-6 py-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}>
                        <button
                            onClick={() => {
                                const id = introVideoModal.personaId;
                                const isGuest = introVideoModal.guestMode;
                                setIntroVideoModal(null);
                                if (isGuest) {
                                    setShowAuthPage(true);
                                } else {
                                    setShowMain(false);
                                    handleSelectPersona(id);
                                }
                            }}
                            className="min-h-[44px] px-8 py-2.5 text-white font-semibold rounded-xl transition-all hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
                        >
                            입장
                        </button>
                        <button
                            onClick={() => {
                                setIntroVideoModal(null);
                                if (!introVideoModal.guestMode) setShowMain(true);
                            }}
                            className="min-h-[44px] px-8 py-2.5 text-gray-300 font-semibold rounded-xl transition-all hover:text-white"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}

            {/* 트리거 영상 팝업 */}
            {triggerVideoPopup && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col">
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
                        <span className="text-sm font-medium text-white">{triggerVideoPopup.title || '영상'}</span>
                        <button
                            onClick={() => setTriggerVideoPopup(null)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                            <Icon name="X" size={22} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                        <video
                            src={triggerVideoPopup.videoUrl}
                            controls
                            autoPlay
                            className="max-w-full max-h-full object-contain"
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
                    user={user}
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
                                    className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl cursor-pointer"
                                    onClick={() => setHeaderImageModal(false)}
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
                                    className="md:hidden mr-2 flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                                    onClick={() => setShowMain(true)}
                                >
                                    <Icon name="ChevronLeft" size={22} />
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
                                        <div style={{ letterSpacing: '-0.02em' }}>
                                            <h2 className="font-bold text-white text-sm leading-tight flex items-center gap-2">
                                                {activePersona.name}
                                                {activePersona.name === '신은비' && firstChatMap[activePersonaId] && (() => {
                                                    const days = Math.floor((Date.now() - new Date(firstChatMap[activePersonaId]).getTime()) / (1000 * 60 * 60 * 24));
                                                    return days >= 1 ? (
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
                                                            ✦ D+{days}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </h2>
                                            {activePersona.description && (
                                                <p className="text-[11px] hidden sm:flex items-center gap-1 mt-0.5" style={{ color: '#888' }}>
                                                    <span className="text-gray-600 font-light select-none">—</span>
                                                    {activePersona.description}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {user && (() => {
                                    const stage = getStage(user.personaXp?.[activePersonaId] ?? 0);
                                    return (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-violet-700 to-purple-500 border border-violet-500/30 shadow-[0_0_8px_rgba(139,92,246,0.6)]" style={{ letterSpacing: '-0.02em' }}>
                                            <span className="text-[10px] font-bold text-white drop-shadow">{stage.stage}Lv</span>
                                            <span className="text-[10px] text-white/80 hidden sm:inline">{stage.name}</span>
                                        </div>
                                    );
                                })()}
                                {/* ⋮ 드롭다운 메뉴 */}
                                <div ref={headerMenuRef} className="relative">
                                    <button
                                        onClick={() => setShowHeaderMenu(v => !v)}
                                        className={`p-2 rounded-xl border border-transparent transition-all ${showHeaderMenu ? 'bg-gray-700/60 text-white' : 'bg-transparent text-gray-500 hover:bg-gray-700/40 hover:text-gray-200'}`}
                                        title="메뉴"
                                    >
                                        <Icon name="MoreVertical" size={16} />
                                    </button>
                                    {showHeaderMenu && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                                            {/* 게시판 */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); setShowBoard(true); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                                            >
                                                <Icon name="MessageSquare" size={15} className="text-gray-400" />
                                                게시판
                                            </button>
                                            {/* 제휴 게시판 */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); setShowPartnerBoard(true); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                                            >
                                                <Icon name="Handshake" size={15} className="text-gray-400" />
                                                제휴 게시판
                                            </button>
{/* 기억 공유 바로 위 — 골프 관련 버튼은 상단 바로 이동됨 */}
                                            {/* 기억 공유 */}
                                            {activePersona && (
                                                <button
                                                    onClick={() => { setShowHeaderMenu(false); handleToggleMemory(activePersonaId); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-800 transition-colors border-t border-gray-800"
                                                >
                                                    <Icon name="Brain" size={15} className={isMemoryOn(activePersonaId) ? 'text-blue-400' : 'text-gray-500'} />
                                                    <span className={isMemoryOn(activePersonaId) ? 'text-blue-400' : 'text-gray-400'}>기억 공유</span>
                                                    <span className={`ml-auto w-1.5 h-1.5 rounded-full ${isMemoryOn(activePersonaId) ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        {activeImages.length > 0 && (
                            <PersonaImageViewer images={activeImages} onSelectMain={handleSwitchImage} userXp={user?.personaXp?.[activePersonaId] ?? 0} />
                        )}

                        {/* 트리거 키워드 안내 */}
                        {((triggerVideos[activePersonaId]?.length ?? 0) > 0 || activePersona?.name === '서아' || activePersona?.name === '윤채원' || activePersona?.name === '신은비' || activePersona?.name === '왕주식' || activePersona?.name === '지우' || activePersona?.name === '이아린' || isGolfPersona) && (
                            <div className="border-b border-gray-800 bg-gray-900/60 px-4 py-2 shrink-0">
                                <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Icon name="Play" size={11} className="text-purple-400 shrink-0" />
                                        {triggerVideos[activePersonaId]?.map(tv => {
                                            const firstKw = tv.keywords.split(',').map(k => k.trim()).find(k => k) || '';
                                            const label = tv.tag || firstKw;
                                            return (
                                                <button
                                                    key={tv.id}
                                                    onClick={() => setTriggerVideoPopup(tv)}
                                                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-purple-700/60 bg-purple-900/20 text-purple-300 hover:bg-purple-800/40 hover:text-purple-100 transition-colors whitespace-nowrap"
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {isGolfPersona && user && (
                                            <>
                                                <button
                                                    onClick={() => swingVideoRef.current?.click()}
                                                    disabled={swingUploading || currentSession.isTyping}
                                                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-orange-700/60 bg-orange-900/20 text-orange-300 hover:bg-orange-800/40 hover:text-orange-100 transition-colors whitespace-nowrap flex items-center gap-1 disabled:opacity-40"
                                                >
                                                    <Icon name="Upload" size={10} />
                                                    스윙 분석
                                                </button>
                                                <button
                                                    onClick={() => { setSwingResult(null); setShowSwingBoard(true); }}
                                                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-orange-700/60 bg-orange-900/20 text-orange-300 hover:bg-orange-800/40 hover:text-orange-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                                >
                                                    <Icon name="Play" size={10} />
                                                    스윙 기록
                                                </button>
                                            </>
                                        )}
                                        {activePersona?.name === '윤채원' && user && (
                                            <button
                                                onClick={() => setShowStockAnalysis(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-green-700/60 bg-green-900/20 text-green-300 hover:bg-green-800/40 hover:text-green-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="TrendingUp" size={10} />
                                                주식 분석
                                            </button>
                                        )}
                                        {activePersona?.name === '이아린' && user && (
                                            <button
                                                onClick={() => setShowUsedItem(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-orange-700/60 bg-orange-900/20 text-orange-300 hover:bg-orange-800/40 hover:text-orange-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="ShoppingBag" size={10} />
                                                중고 판매
                                            </button>
                                        )}
                                        {(activePersona?.name === '왕주식' || activePersona?.name === '이아린') && user && (
                                            <button
                                                onClick={() => setShowHotKeyword(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-orange-700/60 bg-orange-900/20 text-orange-300 hover:bg-orange-800/40 hover:text-orange-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="ShoppingBag" size={10} />
                                                핫쇼핑키워드
                                            </button>
                                        )}
                                        {activePersona?.name === '왕주식' && user && (
                                            <button
                                                onClick={() => setShowResearch(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-blue-700/60 bg-blue-900/20 text-blue-300 hover:bg-blue-800/40 hover:text-blue-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="BookOpen" size={10} />
                                                딥 리서치
                                            </button>
                                        )}
                                        {activePersona?.name === '왕주식' && user && (
                                            <button
                                                onClick={() => setShowProductExtract(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-emerald-700/60 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-800/40 hover:text-emerald-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="Package" size={10} />
                                                제품추출
                                            </button>
                                        )}
                                        {activePersona?.name === '신은비' && user && (
                                            <button
                                                onClick={() => setShowLuxuryBoard(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-purple-700/60 bg-purple-900/20 text-purple-300 hover:bg-purple-800/40 hover:text-purple-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="Shield" size={10} />
                                                명품 검증
                                            </button>
                                        )}
                                        {activePersona?.name === '서아' && user && (
                                            <button
                                                onClick={() => setShowTodayNews(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-sky-700/60 bg-sky-900/20 text-sky-300 hover:bg-sky-800/40 hover:text-sky-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                            >
                                                <Icon name="Newspaper" size={10} />
                                                오늘뉴스
                                            </button>
                                        )}
                                        {activePersona?.name === '지우' && user && (
                                            <button
                                                onClick={() => setShowMathTutor(true)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap flex items-center gap-1 transition-colors"
                                                style={{ borderColor: '#FFB3D1', background: 'rgba(255,107,157,0.15)', color: '#FF6B9D' }}
                                            >
                                                📚 AI쌤
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth"
                            style={chatBgSelected ? {
                                backgroundImage: `linear-gradient(rgba(10,11,15,0.65), rgba(10,11,15,0.65)), url(${chatBgSelected})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            } : undefined}
                        >
                            {currentSession.messages.length === 0 && isGreeting && (
                                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-60">
                                    <span className="w-6 h-6 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                                    <span className="text-sm text-gray-400">인사말을 준비하고 있습니다...</span>
                                </div>
                            )}
                            {currentSession.messages.length === 0 && !isGreeting && activePersona ? (
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
                                        <MessageBubble key={msg.id} message={msg} personaName={activePersona?.name || 'AI'} personaImageUrl={activePersona?.imageUrl} />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0">
                            {/* 퀵메뉴 버튼 */}
                            {(() => {
                                if (!activePersona?.quickMenuJson) return null;
                                let config: { menus?: { label: string; prompt?: string; featured?: boolean; placeholder?: string; partnerModal?: boolean; faceModal?: boolean; resultCard?: boolean; subMenu?: SubMenuConfig }[]; useBirthInfo?: boolean } = {};
                                try { config = JSON.parse(activePersona.quickMenuJson); } catch { return null; }
                                if (!config.menus?.length) return null;
                                const handleMenuSelect = (menu: { label: string; prompt?: string; placeholder?: string; partnerModal?: boolean; faceModal?: boolean; resultCard?: boolean; subMenu?: SubMenuConfig }) => {
                                    if (menu.subMenu) {
                                        subMenuResultCardRef.current = menu.resultCard ?? false;
                                        setSubMenuConfig(menu.subMenu);
                                        return;
                                    }
                                    if (menu.faceModal) {
                                        setShowFaceModal(true);
                                        return;
                                    }
                                    if (menu.partnerModal) {
                                        setPendingPartnerMenu({ label: menu.label, prompt: menu.prompt ?? '' });
                                        setShowPartnerModal(true);
                                        return;
                                    }
                                    if (menu.placeholder) {
                                        quickMenuApi.activate(50, '꿈해몽')
                                            .then(({ paidBalance, bonusBalance }) => {
                                                setUserPaidPoints(paidBalance);
                                                setUserBonusPoints(bonusBalance);
                                                setInputText('');
                                                setInputPlaceholder(menu.placeholder!);
                                                setActiveQuickMenu(menu.label);
                                                setTimeout(() => textareaRef.current?.focus(), 0);
                                            })
                                            .catch(e => alert(e.message || '포인트 차감에 실패했습니다.'));
                                        return;
                                    }
                                    if (menu.resultCard) {
                                        if (config.useBirthInfo && !birthInfo) {
                                            setPendingQuickMenu({ label: menu.label, prompt: menu.prompt ?? '', resultCard: true });
                                            setShowBirthModal(true);
                                            return;
                                        }
                                        let fullPrompt = menu.prompt ?? '';
                                        if (config.useBirthInfo && birthInfo) {
                                            const t = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                                            const cal = birthInfo.lunar ? '음력' : '양력';
                                            fullPrompt += `\n\n사용자 정보 — 이름: ${birthInfo.name}, 생년월일: ${cal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${t}`;
                                        }
                                        setQuickMenuLoading(true);
                                        quickMenuApi.generate(activePersonaId, fullPrompt)
                                            .then(({ result, paidBalance, bonusBalance }) => {
                                                setUserPaidPoints(paidBalance);
                                                setUserBonusPoints(bonusBalance);
                                                setQuickMenuResult({ title: menu.label, result });
                                            })
                                            .catch(e => alert(e.message || '분석에 실패했습니다.'))
                                            .finally(() => setQuickMenuLoading(false));
                                        return;
                                    }
                                    if (config.useBirthInfo) {
                                        if (birthInfo) {
                                            setInputText(menu.prompt ?? '');
                                            setTimeout(() => textareaRef.current?.focus(), 0);
                                        } else {
                                            setPendingQuickMenu({ label: menu.label, prompt: menu.prompt ?? '' });
                                            setShowBirthModal(true);
                                        }
                                    } else {
                                        setInputText(menu.prompt ?? '');
                                        textareaRef.current?.focus();
                                    }
                                };
                                const featuredMenus = config.menus.filter(m => m.featured);
                                const dropdownMenus = config.menus.filter(m => !m.featured);
                                const glassBtn = 'text-xs px-3.5 py-1.5 rounded-full text-gray-200 transition-all duration-150 hover:text-white active:scale-95';
                                const glassBtnStyle = {
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.13)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                } as React.CSSProperties;
                                const glassBtnHoverStyle = {
                                    background: 'rgba(255,255,255,0.14)',
                                    border: '1px solid rgba(255,255,255,0.22)',
                                } as React.CSSProperties;
                                const featuredBtnStyle = {
                                    ...glassBtnStyle,
                                    borderLeft: '2px solid rgba(167,139,250,0.7)',
                                } as React.CSSProperties;
                                const featuredBtnHoverStyle = {
                                    ...glassBtnHoverStyle,
                                    borderLeft: '2px solid rgba(167,139,250,1)',
                                } as React.CSSProperties;
                                const featuredBtnActiveStyle = {
                                    ...glassBtnHoverStyle,
                                    borderLeft: '2px solid rgba(251,191,36,1)',
                                    boxShadow: '0 0 10px rgba(251,191,36,0.3)',
                                } as React.CSSProperties;
                                const featuredBtnSelectedStyle = {
                                    background: 'rgba(251,191,36,0.15)',
                                    border: '1px solid rgba(251,191,36,0.5)',
                                    borderLeft: '2px solid rgba(251,191,36,1)',
                                    color: '#fbbf24',
                                    boxShadow: '0 0 10px rgba(251,191,36,0.2)',
                                } as React.CSSProperties;
                                const stripEmoji = (label: string) => label.replace(/^\p{Emoji}\s*/u, '');
                                return (
                                    <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 flex-wrap">
                                        {dropdownMenus.length > 0 && (
                                            <select
                                                defaultValue=""
                                                onChange={e => {
                                                    const menu = dropdownMenus.find(m => m.label === e.target.value);
                                                    if (menu) handleMenuSelect(menu);
                                                    e.target.value = '';
                                                }}
                                                className="text-xs px-3 py-1.5 rounded-full text-gray-200 cursor-pointer focus:outline-none transition-all"
                                                style={{ ...glassBtnStyle, minWidth: 120 }}
                                            >
                                                <option value="" disabled>주제 선택</option>
                                                {dropdownMenus.map(menu => (
                                                    <option key={menu.label} value={menu.label}>{stripEmoji(menu.label)}</option>
                                                ))}
                                            </select>
                                        )}
                                        {featuredMenus.map(menu => {
                                            const isSelected = activeQuickMenu === menu.label;
                                            const baseStyle = isSelected ? featuredBtnSelectedStyle : featuredBtnStyle;
                                            return (
                                                <button key={menu.label}
                                                    onClick={() => handleMenuSelect(menu)}
                                                    className={`${glassBtn}${isSelected ? ' !text-yellow-400' : ''}`}
                                                    style={baseStyle}
                                                    onMouseEnter={e => Object.assign(e.currentTarget.style, isSelected ? featuredBtnSelectedStyle : featuredBtnHoverStyle)}
                                                    onMouseLeave={e => Object.assign(e.currentTarget.style, baseStyle)}
                                                    onMouseDown={e => Object.assign(e.currentTarget.style, featuredBtnActiveStyle)}
                                                    onMouseUp={e => Object.assign(e.currentTarget.style, isSelected ? featuredBtnSelectedStyle : featuredBtnHoverStyle)}
                                                    onTouchStart={e => Object.assign(e.currentTarget.style, featuredBtnActiveStyle)}
                                                    onTouchEnd={e => Object.assign(e.currentTarget.style, baseStyle)}>
                                                    {stripEmoji(menu.label)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            <div className="max-w-4xl mx-auto relative flex items-end bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500 transition-all">
                                {isGolfPersona && user && (
                                    <input
                                        ref={swingVideoRef}
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={handleSwingVideoSelect}
                                    />
                                )}
                                <textarea
                                    ref={textareaRef}
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={inputPlaceholder ?? (activePersona ? `${activePersona.name}에게 메시지 보내기...` : '메시지를 입력하세요...')}
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
                            <div className="flex items-center justify-between mt-2">
                                <div className="text-[10px] text-gray-600">
                                    AI는 실수를 할 수 있습니다. 중요한 정보는 확인해주세요.
                                </div>
                                <div className="flex items-center gap-2">
                                {user && (
                                    <button
                                        onClick={() => setShowPointDashboard(true)}
                                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                                        style={{ letterSpacing: '-0.02em' }}
                                    >
                                        <Coins size={11} className="text-yellow-600" />
                                        <span style={{ color: '#c9a84c' }}>{userPaidPoints.toLocaleString()}</span>
                                        <span className="text-gray-700">/</span>
                                        <span style={{ color: '#a07c30' }}>{userBonusPoints.toLocaleString()}</span>
                                    </button>
                                )}
                                {user && activePersona && (
                                    <StarButton
                                        personaId={activePersona.id}
                                        personaName={activePersona.name}
                                        userPoints={userPaidPoints + userBonusPoints}
                                        onBalloonStart={(amount) => {
                                            // Gemini 응답 즉시 메시지 추가 (애니메이션 종료 대기 없음)
                                            sessionApi.starThanks(activePersona.id, amount).then(r => {
                                                addMessageToSession(activePersona.id, { id: `bt-${Date.now()}`, role: 'assistant', text: r.message.text });
                                                setSessions(prev => ({ ...prev, [activePersona.id]: { ...prev[activePersona.id], dbSessionId: prev[activePersona.id]?.dbSessionId ?? r.sessionId } }));
                                            }).catch(() => {});
                                        }}
                                        onSent={(result) => {
                                            pointApi.getBalance().then(d => { setUserPaidPoints(d.paidPoints); setUserBonusPoints(d.bonusPoints); }).catch(() => {});
                                            setUser(prev => {
                                                if (!prev) return prev;
                                                const prevXp = prev.personaXp[result.personaId] ?? 0;
                                                if (getStage(prevXp).stage !== getStage(result.xp).stage) {
                                                    delete chatInstancesRef.current[result.personaId];
                                                }
                                                return { ...prev, personaXp: { ...prev.personaXp, [result.personaId]: result.xp } };
                                            });
                                            if (result.leveledUp && result.levelupBonus > 0) {
                                                setLevelUpInfo({ newStage: result.newStage, levelupBonus: result.levelupBonus });
                                                setTimeout(() => setLevelUpInfo(null), 3000);
                                            }
                                            const amount = result.balloon.amount;
                                            const starVideoUrl = activePersona?.starVideoUrl;
                                            if (amount >= 100 && starVideoUrl) {
                                                setStarVideoModal({ url: starVideoUrl, personaId: result.personaId, amount });
                                            }
                                        }}
                                        onRainDone={() => { starThanksPromiseRef.current = null; }}
                                    />
                                )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => (
    <PointsProvider>
        <AppContent />
    </PointsProvider>
);

export default App;
