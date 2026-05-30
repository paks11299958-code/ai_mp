import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PointsProvider, usePoints } from './contexts/PointsContext';
import { Coins } from 'lucide-react';
import { Message, Persona, PersonaImage, ChatSessionState, User, TriggerVideo, SwingAnalysis, Announcement, Category } from './types';
import { generateImageDescription } from './services/geminiService';
import { personaApi, personaImageApi, sessionApi, authApi, settingsApi, triggerVideoApi, swingAnalysisApi, announcementApi, categoryApi, userProfileApi, quickMenuApi, chatApi } from './services/apiService';
import { pointApi } from './services/pointService';
import { getStage, STAGES } from './utils/level';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { LandingPageNew } from './components/LandingPageNew';
import { MainPageNew, FEATURES_GRID } from './components/MainPageNew';
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
import { SwingInputModal } from './components/SwingInputModal';
import { AnnouncementModal } from './components/AnnouncementModal';
import { ProductExtractDialog } from './components/ProductExtractDialog';
import { GolfReserveDialog } from './components/GolfReserveDialog';
import { Icon } from './components/Icons';
import { PointDisplay } from './components/PointDisplay';
import { PointModal } from './components/PointModal';
import { PointDashboard } from './components/PointDashboard';
import { StarButton, StarRain } from './components/StarBalloonButton';
import { BirthInfoModal, BirthInfo } from './components/BirthInfoModal';
import { PartnerInfoModal } from './components/PartnerInfoModal';
import { SubMenuModal, SubMenuConfig, SubMenuItem } from './components/SubMenuModal';
import { FaceReadingModal } from './components/FaceReadingModal';
import { FaceReadingResultCard } from './components/FaceReadingResultCard';
import { FaceReadingResult } from './services/apiService';
import { QuickMenuResultCard } from './components/QuickMenuResultCard';
import { ClubBoard } from './components/ClubBoard';
import KakaoNicknameModal from './components/KakaoNicknameModal';


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
    const [kakaoNicknameModal, setKakaoNicknameModal] = useState<{ token: string; defaultNickname: string } | null>(null);
    const [showAuthPage, setShowAuthPage] = useState(false);
    const [showMain, setShowMain] = useState(false);
    // 뉴UI: 로그인 후 히어로 페이지 표시 여부
    const [showHero, setShowHero] = useState(false);
    // 뉴UI: 페르소나 대기 페이지 초기 탭
    const [mainInitialTab, setMainInitialTab] = useState<'personas' | 'features'>('personas');
    // 뉴UI: 히어로→대기 페이지 포커스 대상
    const [mainFocusPersonaId, setMainFocusPersonaId] = useState<string | null>(null);
    const [mainFocusFeatureKey, setMainFocusFeatureKey] = useState<string | null>(null);
    const [resetToken, setResetToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token');
    });

    // 카카오 로그인 콜백 처리
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('kakao_login') === '1') {
            const kakaoCode = params.get('kakao_code');
            window.history.replaceState({}, '', window.location.pathname);
            if (kakaoCode) {
                fetch('/api/auth/kakao/exchange', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: kakaoCode }),
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.token) {
                            localStorage.setItem('token', data.token);
                            if (data.isNewUser) {
                                // 신규 가입: 닉네임 설정 모달 표시
                                setKakaoNicknameModal({ token: data.token, defaultNickname: data.kakaoNickname || '' });
                            } else {
                                window.location.reload();
                            }
                        }
                    })
                    .catch(() => alert('카카오 로그인에 실패했습니다.'));
            } else {
                window.location.reload();
            }
        }
        if (params.get('kakao_error') === '1') {
            window.history.replaceState({}, '', window.location.pathname);
            alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
        }
    }, []);

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

    const [categories, setCategories] = useState<Category[]>([]);
    const [headerImageModal, setHeaderImageModal] = useState(false);
    const [sessions, setSessions] = useState<Record<string, ChatSessionState>>({});
    const [personaImages, setPersonaImages] = useState<Record<string, PersonaImage[]>>({});
    const [triggerVideos, setTriggerVideos] = useState<Record<string, TriggerVideo[]>>({});
    const [triggerVideoPopup, setTriggerVideoPopup] = useState<TriggerVideo | null>(null);
    const [introVideoModal, setIntroVideoModal] = useState<{ personaId: string; type: 'video' | 'image'; url: string; guestMode?: boolean } | null>(null);
    const [starVideoModal, setStarVideoModal] = useState<{ url: string; personaId: string; amount: number } | null>(null);
    const [starRain, setStarRain] = useState<{ count: number; duration: number; key: number } | null>(null);
    const [memoryEnabled, setMemoryEnabled] = useState<Record<string, boolean>>(() => {
        try { return JSON.parse(localStorage.getItem('memoryEnabled') || '{}'); } catch { return {}; }
    });

    const [swingUploading, setSwingUploading] = useState(false);
    const [swingStep, setSwingStep] = useState<'idle' | 'uploading' | 'analyzing' | 'saving'>('idle');
    const [swingResult, setSwingResult] = useState<{ id: number; analysis: SwingAnalysis; createdAt: string } | null>(null);
    const [showSwingBoard, setShowSwingBoard] = useState(false);
    const [showSwingInput, setShowSwingInput] = useState(false);
    const [showMathTutor, setShowMathTutor] = useState(false);
    const [showClubBoard, setShowClubBoard] = useState(false);

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
        categoryApi.getAll().then(setCategories).catch(() => {});

        settingsApi.get()
            .then(s => {
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
            .then(({ user }) => { setUser(user); setShowHero(true); })
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
            return next;
        });
    };

    const handleSwitchImage = (image: PersonaImage) => {
        setPersonaImages(prev => ({
            ...prev,
            [activePersonaId]: (prev[activePersonaId] || []).map(img => ({ ...img, isMain: img.id === image.id })),
        }));
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
        window.location.reload();
    };

    const handleAdminLogin = () => {
        if (user?.role === 'ADMIN') {
            setIsAdminMode(true);
        } else {
            alert('관리자 권한이 없습니다.');
        }
    };

    const handleSwingSubmit = async ({ title, gender, skillLevel, file }: { title: string; gender: string; skillLevel: string; file: File }) => {
        if (!activePersonaId || !user) return;
        setShowSwingInput(false);
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
            const result = await swingAnalysisApi.analyze(publicUrl, activePersonaId, file.type, file.name, title, gender, skillLevel);
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

    const handleSwingVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = '';
    };

    const handleSendMessage = async () => {
        const text = inputText.trim();
        if (!text || currentSession.isTyping || !user) return;

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

        let fullResponse = '';
        try {
            await chatApi.stream(
                {
                    personaId: activePersonaId,
                    text,
                    sessionId: dbSessionId ?? undefined,
                    memoryEnabled: isMemoryOn(activePersonaId),
                    birthInfo: birthInfo ?? null,
                },
                (chunk) => {
                    fullResponse += chunk;
                    updateMessageInSession(activePersonaId, modelMsgId, { text: fullResponse });
                },
                (finalText) => {
                    fullResponse = finalText;
                    updateMessageInSession(activePersonaId, modelMsgId, { text: fullResponse, isStreaming: false });
                    setSessionTyping(activePersonaId, false);

                    // AI 응답 DB 저장
                    if (dbSessionId && fullResponse) {
                        sessionApi.saveMessage(dbSessionId, 'model', fullResponse).catch(console.error);
                    }

                    // 10개 배수 도달 시 백그라운드 요약
                    const allMessages = sessions[activePersonaId]?.messages || [];
                    const totalCount = allMessages.length;
                    const currentSummaryCount = sessions[activePersonaId]?.summary?.messageCount ?? 0;
                    if (dbSessionId && totalCount >= 10 && totalCount % 10 === 0 && totalCount > currentSummaryCount) {
                        setTimeout(() => triggerSummaryUpdate(dbSessionId!, allMessages, activePersonaId), 5000);
                    }

                    // 백그라운드 기억 추출
                    if (fullResponse && user && dbSessionId) {
                        setTimeout(() => {
                            sessionApi.extractMemories(dbSessionId!, text, fullResponse).catch(() => {});
                        }, 10000);
                    }
                },
                (errMsg) => {
                    updateMessageInSession(activePersonaId, modelMsgId, {
                        text: `죄송합니다. 오류가 발생했습니다: ${errMsg}`,
                        isStreaming: false, error: true,
                    });
                    setSessionTyping(activePersonaId, false);
                },
            );
        } catch (error: any) {
            updateMessageInSession(activePersonaId, modelMsgId, {
                text: `죄송합니다. 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
                isStreaming: false, error: true,
            });
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
        }
    };

    const handleSavePersona = async (updatedPersona: Persona): Promise<void> => {
        try {
            const exists = personas.some(p => p.id === updatedPersona.id);
            let saved: Persona;
            if (exists) {
                saved = await personaApi.update(updatedPersona.id, updatedPersona);
                setPersonas(prev => prev.map(p => p.id === saved.id ? saved : p));
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
                <LandingPageNew
                    personas={visiblePersonas}
                    isLoading={isPersonasLoading}
                    onStart={() => {}}
                    onLoginClick={() => {}}
                    categories={categories}
                />
                <ResetPasswordModal
                    token={resetToken}
                    onClose={() => setResetToken(null)}
                />
                {kakaoNicknameModal && (
                    <KakaoNicknameModal
                        defaultNickname={kakaoNicknameModal.defaultNickname}
                        token={kakaoNicknameModal.token}
                        onComplete={() => {
                            setKakaoNicknameModal(null);
                            window.location.reload();
                        }}
                    />
                )}
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
        // Feature 키 → 기능 오픈 핸들러 (뉴페이지용)
        const handleNewPageFeatureClick = (key: string) => {
            setShowAuthModal(true); // 비로그인 → 로그인 모달
        };

        return (
            <>
                <LandingPageNew
                    personas={visiblePersonas}
                    isLoading={isPersonasLoading}
                    onStart={() => setShowAuthPage(true)}
                    onLoginClick={() => setShowAuthModal(true)}
                    onPersonaClick={handleGuestPersonaClick}
                    onAnnouncementClick={() => setShowAnnouncementModal(true)}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    onPartnerBoardClick={() => setShowPartnerBoard(true)}
                    onFeatureClick={handleNewPageFeatureClick}
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
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
                        <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                            {introVideoModal.type === 'video' ? (
                                <video
                                    src={introVideoModal.url}
                                    autoPlay
                                    className="w-full object-cover"
                                    style={{ maxHeight: '65vh' }}
                                    onError={() => {
                                        const persona = personas.find(p => p.id === introVideoModal.personaId);
                                        if (persona?.imageUrl) {
                                            setIntroVideoModal(prev => prev ? { ...prev, type: 'image', url: persona.imageUrl! } : null);
                                        }
                                    }}
                                />
                            ) : (
                                <img src={introVideoModal.url} alt="프로필" className="w-full object-cover" style={{ maxHeight: '65vh' }} />
                            )}
                            <div className="flex gap-3 justify-center px-5 py-4" style={{ background: 'rgba(15,10,25,0.95)' }}>
                                <button
                                    onClick={() => { setIntroVideoModal(null); setShowAuthPage(true); }}
                                    className="flex-1 min-h-[44px] py-2.5 text-white font-semibold rounded-xl transition-all hover:scale-105"
                                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
                                >
                                    입장
                                </button>
                                <button
                                    onClick={() => setIntroVideoModal(null)}
                                    className="flex-1 min-h-[44px] py-2.5 text-gray-300 font-semibold rounded-xl transition-all hover:text-white"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </>
        );
    }

    if (user && showHero) {
        return (
            <>
                <LandingPageNew
                    personas={visiblePersonas}
                    isLoading={isPersonasLoading}
                    onStart={() => { setShowHero(false); setMainInitialTab('personas'); setShowMain(true); }}
                    onLoginClick={() => { setShowHero(false); setMainInitialTab('personas'); setShowMain(true); }}
                    onPersonaClick={(id) => { setMainFocusPersonaId(id); setMainFocusFeatureKey(null); setShowHero(false); setMainInitialTab('personas'); setShowMain(true); }}
                    onAnnouncementClick={() => setShowAnnouncementModal(true)}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    onPartnerBoardClick={() => setShowPartnerBoard(true)}
                    onFeatureClick={(key) => { setMainFocusFeatureKey(key); setMainFocusPersonaId(null); setShowHero(false); setMainInitialTab('features'); setShowMain(true); }}
                    categories={categories}
                    user={user}
                    onGoToChat={() => { setShowHero(false); setMainInitialTab('personas'); setShowMain(true); }}
                    onLogout={handleLogout}
                    onAdminClick={() => { setShowHero(false); handleAdminLogin(); }}
                    onPersonaListClick={() => { setShowHero(false); setMainInitialTab('personas'); setShowMain(true); }}
                    onFeatureListClick={() => { setShowHero(false); setMainInitialTab('features'); setShowMain(true); }}
                />
                {showAnnouncementModal && (
                    <AnnouncementModal
                        announcements={announcements}
                        readIds={readAnnouncementIds}
                        onRead={handleReadAnnouncements}
                        onClose={() => setShowAnnouncementModal(false)}
                    />
                )}
            </>
        );
    }

    if (showMain) {
        return (
            <>
                <MainPageNew
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
                    categories={categories}
                    onGoHome={() => { setShowMain(false); setShowHero(true); }}
                    initialTab={mainInitialTab}
                    initialFocusPersonaId={mainFocusPersonaId}
                    initialFocusFeatureKey={mainFocusFeatureKey}
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
                    <UserProfileModal user={user} onClose={() => setShowUserProfile(false)} onUserUpdate={updated => setUser(prev => prev ? { ...prev, ...updated } : prev)} />
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
                {showClubBoard && (
                    <ClubBoard onClose={() => setShowClubBoard(false)} />
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
        <>
        <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Cinzel:wght@400;500;600&display=swap');

                /* ── 사이드바 뉴테마 ── */
                .new-ui-sidebar {
                    background: rgba(255,255,255,0.6) !important;
                    backdrop-filter: blur(12px) !important;
                    border-right: 1px solid #F0E9DE !important;
                }
                .new-ui-sidebar * { color: #2D2438; }

                /* ── 채팅 배경 ── */
                .new-ui-chat-main {
                    background: transparent !important;
                }

                /* ── 메시지 버블 ── */
                .new-ui-bubble-ai {
                    background: rgba(255,255,255,0.85) !important;
                    border: 1px solid #EAE2D3 !important;
                    color: #2D2438 !important;
                    border-radius: 18px !important;
                    box-shadow: 0 4px 14px -6px rgba(60,40,90,0.1) !important;
                }
                .new-ui-bubble-user {
                    background: linear-gradient(135deg, #8E6FB7, #B49AC9) !important;
                    color: #ffffff !important;
                    border-radius: 18px !important;
                    box-shadow: 0 8px 20px -8px rgba(142,111,183,0.5) !important;
                }

                /* ── 입력창 ── */
                .new-ui-input-area {
                    background: rgba(255,255,255,0.8) !important;
                    border-top: 1px solid #F0E9DE !important;
                    backdrop-filter: blur(10px) !important;
                }
                .new-ui-textarea {
                    background: #FFFFFF !important;
                    color: #2D2438 !important;
                    border: 1px solid #EAE2D3 !important;
                    border-radius: 14px !important;
                }
                .new-ui-textarea::placeholder { color: #9089A1 !important; }
                .new-ui-textarea:focus {
                    border-color: #8E6FB7 !important;
                    box-shadow: 0 0 0 3px rgba(142,111,183,0.12) !important;
                    outline: none !important;
                }

                /* ── 채팅 헤더 ── */
                .new-ui-chat-header {
                    background: rgba(255,255,255,0.75) !important;
                    backdrop-filter: blur(10px) !important;
                    border-bottom: 1px solid #F0E9DE !important;
                    color: #2D2438 !important;
                }
                .new-ui-chat-header * { color: #2D2438; }
            `}</style>
        <div className="flex h-screen w-full"
            style={{
                background: `
                    radial-gradient(ellipse 50% 30% at 0% 0%, #F5E6F7 0%, transparent 60%),
                    radial-gradient(ellipse 50% 30% at 100% 100%, #FCEADD 0%, transparent 60%),
                    #FBF8F3
                `,
                fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif",
            }}
        >
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
                onGoHome={() => { setShowMain(false); setShowHero(true); }}
                onProfileClick={() => setShowUserProfile(true)}
                newUi={true}
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
                <UserProfileModal user={user} onClose={() => setShowUserProfile(false)} onUserUpdate={updated => setUser(prev => prev ? { ...prev, ...updated } : prev)} />
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
            {showClubBoard && (
                <ClubBoard onClose={() => setShowClubBoard(false)} />
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

            {/* 별풍선 레인 — 전체 화면 */}
            {starRain && (
                <StarRain
                    key={starRain.key}
                    count={starRain.count}
                    duration={starRain.duration}
                    onDone={() => setStarRain(null)}
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

            {showSwingInput && (
                <SwingInputModal
                    onClose={() => setShowSwingInput(false)}
                    onSubmit={handleSwingSubmit}
                    isUploading={swingUploading}
                />
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
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
                    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                        {introVideoModal.type === 'video' ? (
                            <video
                                src={introVideoModal.url}
                                autoPlay
                                className="w-full object-cover"
                                style={{ maxHeight: '65vh' }}
                                onError={() => {
                                    const persona = personas.find(p => p.id === introVideoModal.personaId);
                                    if (persona?.imageUrl) {
                                        setIntroVideoModal(prev => prev ? { ...prev, type: 'image', url: persona.imageUrl! } : null);
                                    }
                                }}
                            />
                        ) : (
                            <img src={introVideoModal.url} alt="프로필" className="w-full object-cover" style={{ maxHeight: '65vh' }} />
                        )}
                        <div className="flex gap-3 justify-center px-5 py-4" style={{ background: 'rgba(15,10,25,0.95)' }}>
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
                            className="flex-1 min-h-[44px] py-2.5 text-white font-semibold rounded-xl transition-all hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
                        >
                            입장
                        </button>
                        <button
                            onClick={() => {
                                setIntroVideoModal(null);
                                if (!introVideoModal.guestMode) setShowMain(true);
                            }}
                            className="flex-1 min-h-[44px] py-2.5 text-gray-300 font-semibold rounded-xl transition-all hover:text-white"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                        >
                            취소
                        </button>
                        </div>
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
                            <div className="hidden md:flex w-1/3 p-8 flex-col items-center justify-center border-r border-[#F0E9DE] bg-transparent">
                                <div className="w-full max-h-[60%] flex items-center justify-center">
                                    <img
                                        src={displayUrl}
                                        alt={`${activePersona?.name} 프로필`}
                                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-all duration-300"
                                    />
                                </div>
                                <h3 className="mt-8 text-2xl font-bold text-center text-[#2D2438]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{activePersona?.name}</h3>
                                <p className="mt-3 text-base text-center leading-relaxed text-[#6B5F7A]">{activePersona?.description}</p>
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
                        <header className="h-16 flex items-center justify-between px-4 shrink-0 z-10 border-b border-[#F0E9DE] bg-white/75 backdrop-blur-sm">
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
                                            <h2 className="font-bold text-sm leading-tight flex items-center gap-2 text-[#2D2438]">
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
                                {/* 기능 썸네일 (히어로에서 기능카드 클릭 시 표시) */}
                                {mainFocusFeatureKey && (() => {
                                    const feat = FEATURES_GRID.find(f => f.key === mainFocusFeatureKey);
                                    if (!feat) return null;
                                    return (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '4px 10px 4px 6px',
                                            background: `linear-gradient(135deg, ${feat.palette.bg} 0%, #FBF8F3 100%)`,
                                            border: `1.5px solid ${feat.palette.accent}55`,
                                            borderRadius: 20,
                                            boxShadow: `0 0 0 2px ${feat.palette.accent}22`,
                                        }}>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: '50%',
                                                background: `${feat.palette.accent}22`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <svg width={16} height={16} viewBox="0 0 96 96" fill="none">
                                                    {feat.icon === 'shield'    && <><path d="M48 14 L74 24 V46 Q74 68 48 78 Q22 68 22 46 V24 Z" fill={feat.palette.accent} opacity="0.9"/><path d="M36 46 L44 54 L62 36" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>}
                                                    {feat.icon === 'newspaper' && <><rect x="14" y="18" width="54" height="62" rx="5" fill={feat.palette.accent} opacity="0.9"/><rect x="22" y="28" width="24" height="18" rx="3" fill="#fff" opacity="0.7"/><line x1="22" y1="54" x2="60" y2="54" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/><line x1="22" y1="62" x2="52" y2="62" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/></>}
                                                    {feat.icon === 'chart'     && <><rect x="14" y="64" width="14" height="18" rx="3" fill={feat.palette.accent} opacity="0.5"/><rect x="34" y="48" width="14" height="34" rx="3" fill={feat.palette.accent} opacity="0.7"/><rect x="54" y="30" width="14" height="52" rx="3" fill={feat.palette.accent} opacity="0.9"/><path d="M14 62 Q34 40 54 28 L68 20" stroke={feat.palette.accent} strokeWidth="2.5" fill="none" strokeLinecap="round"/></>}
                                                    {feat.icon === 'golf'      && <><line x1="48" y1="20" x2="48" y2="80" stroke={feat.palette.accent} strokeWidth="3" strokeLinecap="round"/><path d="M48 20 Q62 28 60 38 Q58 46 48 44 Z" fill={feat.palette.accent} opacity="0.9"/></>}
                                                    {feat.icon === 'face'      && <><ellipse cx="48" cy="44" rx="28" ry="32" fill={feat.palette.accent} opacity="0.9"/><circle cx="38" cy="40" r="4" fill="#fff" opacity="0.9"/><circle cx="58" cy="40" r="4" fill="#fff" opacity="0.9"/><path d="M36 56 Q48 64 60 56" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/></>}
                                                    {feat.icon === 'shopping'  && <><path d="M28 36 L20 76 L76 76 L68 36 Z" fill={feat.palette.accent} opacity="0.9"/><path d="M34 36 Q34 22 48 22 Q62 22 62 36" stroke={feat.palette.accent} strokeWidth="3" fill="none" strokeLinecap="round"/></>}
                                                    {feat.icon === 'sparkles'  && <><path d="M48 14 L52 40 L78 44 L52 48 L48 74 L44 48 L18 44 L44 40 Z" fill={feat.palette.accent} opacity="0.9"/></>}
                                                    {feat.icon === 'book'      && <><path d="M14 22 Q30 18 48 22 L48 76 Q30 72 14 76 Z" fill={feat.palette.accent} opacity="0.9"/><path d="M82 22 Q66 18 48 22 L48 76 Q66 72 82 76 Z" fill={feat.palette.accent} opacity="0.65"/></>}
                                                    {feat.icon === 'people'    && <><circle cx="34" cy="30" r="13" fill={feat.palette.accent} opacity="0.9"/><path d="M14 76 Q14 54 34 54 Q54 54 54 76 Z" fill={feat.palette.accent} opacity="0.9"/><circle cx="64" cy="36" r="11" fill={feat.palette.accent} opacity="0.6"/><path d="M46 78 Q46 60 64 60 Q82 60 82 78 Z" fill={feat.palette.accent} opacity="0.6"/></>}
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: feat.palette.accent }}>{feat.name}</span>
                                        </div>
                                    );
                                })()}
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

                        {activeImages.length > 0 && (() => {
                            const featureCards: { icon: string; label: string; onClick: () => void; color?: string; bgColor?: string; borderColor?: string }[] = [];
                            if (user) {
                                if (activePersona?.name === '서아')
                                    featureCards.push({ icon: 'Newspaper', label: '오늘뉴스', onClick: () => setShowTodayNews(true), borderColor: '#9AAFCB', bgColor: '#E8EEF7', color: '#5C7BA8' });
                                if (activePersona?.name === '윤채원') {
                                    featureCards.push({ icon: 'TrendingUp', label: '주식 분석', onClick: () => setShowStockAnalysis(true), borderColor: '#9EC4A0', bgColor: '#EAF5EB', color: '#2E6B32' });
                                    featureCards.push({ icon: 'ShoppingBag', label: '핫쇼핑키워드', onClick: () => setShowHotKeyword(true), borderColor: '#E2C9A0', bgColor: '#FEF6E8', color: '#8B6020' });
                                }
                                if (activePersona?.name === '이아린') {
                                    featureCards.push({ icon: 'ShoppingBag', label: '중고 판매', onClick: () => setShowUsedItem(true), borderColor: '#E2C9A0', bgColor: '#FEF6E8', color: '#8B6020' });
                                    featureCards.push({ icon: 'ShoppingBag', label: '핫쇼핑키워드', onClick: () => setShowHotKeyword(true), borderColor: '#E2C9A0', bgColor: '#FEF6E8', color: '#8B6020' });
                                }
                                if (activePersona?.name === '신은비')
                                    featureCards.push({ icon: 'Shield', label: '명품 검증', onClick: () => setShowLuxuryBoard(true), borderColor: '#B49AC9', bgColor: '#F5E6F7', color: '#7A5FA0' });
                                if (activePersona?.name === '지우') {
                                    featureCards.push({ icon: 'BookOpen', label: 'AI쌤', onClick: () => setShowMathTutor(true), borderColor: '#FFB3D1', bgColor: 'rgba(255,107,157,0.12)', color: '#FF6B9D' });
                                    featureCards.push({ icon: 'Handshake', label: '모임(출첵)', onClick: () => setShowClubBoard(true), borderColor: '#FFB3D1', bgColor: 'rgba(255,107,157,0.12)', color: '#FF6B9D' });
                                }
                                if (isGolfPersona) {
                                    featureCards.push({ icon: 'Activity', label: '스윙 분석', onClick: () => setShowSwingInput(true), borderColor: '#F5A623', bgColor: 'rgba(245,166,35,0.12)', color: '#C47D0A' });
                                    featureCards.push({ icon: 'Clock', label: '스윙 기록', onClick: () => setShowSwingBoard(true), borderColor: '#F5A623', bgColor: 'rgba(245,166,35,0.12)', color: '#C47D0A' });
                                }
                            }
                            return <PersonaImageViewer images={activeImages} onSelectMain={handleSwitchImage} userXp={user?.personaXp?.[activePersonaId] ?? 0} newUi={true} featureCards={featureCards} />;
                        })()}

                        {/* 트리거 키워드 버튼 */}
                        {(triggerVideos[activePersonaId]?.length ?? 0) > 0 && (
                            <div className="px-4 py-2 shrink-0 border-b border-[#F0E9DE] bg-white/60 backdrop-blur-sm">
                                <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
                                    <Icon name="Play" size={11} className="text-purple-400 shrink-0" />
                                    {triggerVideos[activePersonaId]?.map(tv => {
                                        const firstKw = tv.keywords.split(',').map(k => k.trim()).find(k => k) || '';
                                        const label = tv.tag || firstKw;
                                        return (
                                            <button
                                                key={tv.id}
                                                onClick={() => setTriggerVideoPopup(tv)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap border-[#B49AC9] bg-[#F5E6F7] text-[#8E6FB7] hover:bg-[#E5D5F2]"
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth"
                            style={chatBgSelected ? {
                                backgroundImage: `linear-gradient(rgba(251,248,243,0.55), rgba(251,248,243,0.55)), url(${chatBgSelected})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            } : { background: 'transparent' }}
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
                                        <MessageBubble key={msg.id} message={msg} personaName={activePersona?.name || 'AI'} personaImageUrl={activePersona?.imageUrl} newUi={true} />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        <div className="p-4 shrink-0 border-t border-[#F0E9DE] bg-white/75 backdrop-blur-sm">
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
                                const glassBtn = 'text-xs px-3.5 py-1.5 rounded-full transition-all duration-150 active:scale-95';
                                const glassBtnStyle: React.CSSProperties = {
                                    background: '#FFFFFF',
                                    border: '1px solid #EAE2D3',
                                    color: '#6B5F7A',
                                };
                                const glassBtnHoverStyle: React.CSSProperties = {
                                    background: '#F5E6F7',
                                    border: '1px solid #B49AC9',
                                    color: '#8E6FB7',
                                };
                                const featuredBtnStyle: React.CSSProperties = {
                                    background: '#FFFFFF',
                                    border: '1px solid #EAE2D3',
                                    borderLeft: '2px solid #8E6FB7',
                                    color: '#6B5F7A',
                                };
                                const featuredBtnHoverStyle: React.CSSProperties = {
                                    background: '#F5E6F7',
                                    border: '1px solid #B49AC9',
                                    borderLeft: '2px solid #8E6FB7',
                                    color: '#8E6FB7',
                                };
                                const featuredBtnActiveStyle: React.CSSProperties = {
                                    background: '#FFF3D6',
                                    border: '1px solid #E8C56A',
                                    borderLeft: '2px solid #B89232',
                                    color: '#B89232',
                                };
                                const featuredBtnSelectedStyle: React.CSSProperties = {
                                    background: '#FFF3D6',
                                    border: '1px solid #E8C56A',
                                    borderLeft: '2px solid #B89232',
                                    color: '#B89232',
                                };
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

                            <div className="max-w-4xl mx-auto relative flex items-end rounded-2xl transition-all bg-white border border-[#EAE2D3] focus-within:border-[#8E6FB7] focus-within:ring-1 focus-within:ring-[#8E6FB7]/20">
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
                                    className="w-full max-h-[200px] bg-transparent p-4 pr-12 resize-none focus:outline-none rounded-2xl text-[#2D2438] placeholder-[#9089A1]"
                                    rows={1}
                                    disabled={!activePersona}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputText.trim() || currentSession.isTyping || !activePersona}
                                    className={`absolute right-2 bottom-2 p-2 rounded-xl transition-colors ${inputText.trim() && !currentSession.isTyping && activePersona ? 'text-white shadow-lg' : 'text-[#9089A1] cursor-not-allowed'}`}
                                    style={inputText.trim() && !currentSession.isTyping && activePersona ? {
                                        background: 'linear-gradient(135deg, #8E6FB7, #E48BB0)',
                                        boxShadow: '0 6px 16px -6px rgba(142,111,183,0.55)',
                                    } : {}}
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
                                        onRainStart={(rain) => setStarRain(rain)}
                                        onRainDone={() => { setStarRain(null); starThanksPromiseRef.current = null; }}
                                    />
                                )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        {kakaoNicknameModal && (
            <KakaoNicknameModal
                defaultNickname={kakaoNicknameModal.defaultNickname}
                token={kakaoNicknameModal.token}
                onComplete={() => {
                    setKakaoNicknameModal(null);
                    window.location.reload();
                }}
            />
        )}
        </>
    );
};

const App: React.FC = () => (
    <PointsProvider>
        <AppContent />
    </PointsProvider>
);

export default App;
