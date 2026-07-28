import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PointsProvider, usePoints } from './contexts/PointsContext';
import { AuthProvider } from './contexts/AuthContext';
import { usePayment } from './hooks/usePayment';
import { useBoardToggles } from './hooks/useBoardToggles';
import { useAnnouncements } from './hooks/useAnnouncements';
import { useAuth } from './hooks/useAuth';
import { useFavorites, useFavoritePersonas } from './hooks/useFavorites';
import { useQuickMenu } from './hooks/useQuickMenu';
import { usePersonaSession } from './hooks/usePersonaSession';
import { Coins } from 'lucide-react';
import { Persona, PersonaImage, TriggerVideo, SwingAnalysis, Category, User } from './types';
import { generateImageDescription } from './services/geminiService';
import { personaApi, personaImageApi, sessionApi, settingsApi, triggerVideoApi, swingAnalysisApi, categoryApi, userProfileApi, quickMenuApi, chatApi, authApi, heroCardApi, HeroCard } from './services/apiService';
import { pointApi } from './services/pointService';
import { captureRefFromUrl, setMyReferralCode } from './services/referral';
import { InviteFriendModal } from './components/InviteFriendModal';
import { getStage, STAGES } from './utils/level';
import { getPersonaFeatureKeys, FEATURE_BY_KEY } from './personaFeatures';
import { MessageBubble } from './components/MessageBubble';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { GuestUpgradeModal } from './components/GuestUpgradeModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { LandingPageNew } from './components/LandingPageNew';
import { MainPageNew, FEATURES_GRID } from './components/MainPageNew';
import { PersonaImageViewer } from './components/PersonaImageViewer';
import { BoardPanel } from './components/BoardPanel';
import { PartnerBoardPanel } from './components/PartnerBoardPanel';
import { UserProfileModal } from './components/UserProfileModal';
import { RewardAlertModal } from './components/RewardAlertModal';
import { StockAnalysisBoard } from './components/StockAnalysisBoard';
import { HotKeywordBoard } from './components/HotKeywordBoard';
import { ResearchBoard } from './components/ResearchBoard';
import { UsedItemBoard } from './components/UsedItemBoard';
import { LuxuryBoard } from './components/LuxuryBoard';
import { InsuranceBoard } from './components/InsuranceBoard';
import { MarketingBoard } from './components/MarketingBoard';
import { HomepageBoard } from './components/HomepageBoard';
import { ShortsMakerBoard } from './components/ShortsMakerBoard';
import { EbookBoard } from './components/EbookBoard';
import { HairStyleBoard } from './components/HairStyleBoard';
import { OutfitBoard } from './components/OutfitBoard';
import { AgeTransformBoard } from './components/AgeTransformBoard';
import { WebtoonEpisodeList } from './components/WebtoonEpisodeList';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { BirthInfoModal } from './components/BirthInfoModal';
import { PartnerInfoModal } from './components/PartnerInfoModal';
import { SubMenuModal, SubMenuConfig, SubMenuItem } from './components/SubMenuModal';
import { FaceReadingModal } from './components/FaceReadingModal';
import { TarotCardModal } from './components/TarotCardModal';
import { TarotReportView, TarotReportData } from './components/TarotReportView';
import { EmbedChat } from './components/EmbedChat';
import { ConsultPage } from './components/ConsultPage';
import { LearnPage } from './components/LearnPage';
import { LearnIndex } from './components/learn/LearnIndex';
import { LearnPage2 } from './components/learn/LearnPage2';
import { tarotApi } from './services/apiService';
import { FaceReadingResultCard } from './components/FaceReadingResultCard';
import { LookalikeModal } from './components/LookalikeModal';
import { LookalikeResultCard } from './components/LookalikeResultCard';
import { LookalikeResult } from './services/apiService';
import { PalmReadingModal } from './components/PalmReadingModal';
import { PalmReadingResultCard } from './components/PalmReadingResultCard';
import { QuickMenuResultCard } from './components/QuickMenuResultCard';
import { QuickMenuLoading } from './components/QuickMenuLoading';
import { ClubBoard } from './components/ClubBoard';

// 퀵메뉴 분석 실패 시 사용자에게 보여줄 안내. 백엔드의 한글 메시지는 그대로 쓰되,
// 날것의 에러(영문/JSON, 쿼터 초과 등)는 친절한 문구로 치환한다.
function quickMenuErrorMessage(e: any): string {
    const raw = String(e?.message ?? '');
    if (/429|RESOURCE_EXHAUSTED|exhausted|이용자가 많/i.test(raw)) {
        return '지금 이용자가 많아요. 잠시 후 다시 시도해 주세요. 🙏\n(포인트는 차감되지 않았습니다)';
    }
    // 한글이 포함된 안내성 메시지는 그대로 신뢰, 아니면 일반 문구로.
    if (/[가-힣]/.test(raw) && !raw.includes('{') && raw.length < 120) return raw;
    return '분석에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

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

    const {
        user, setUser,
        isAuthChecking,
        showAuthModal, setShowAuthModal,
        screen, goTo,
        handleAuthSuccess,
        resetAuth,
    } = useAuth();
    // 온보딩 알럿: 가입 환영 / 미션 달성 축하 / 레퍼럴 체험계정 환영 (한 모달로 공용)
    const [rewardAlert, setRewardAlert] = useState<{ kind: 'welcome' | 'mission' | 'guestWelcome'; amount: number } | null>(null);
    const handleMissionAwarded = useCallback((amount: number) => {
        setRewardAlert({ kind: 'mission', amount });
        // 잔액 즉시 갱신
        pointApi.getBalance().then(d => { setUserPaidPoints(d.paidPoints); setUserBonusPoints(d.bonusPoints); }).catch(() => {});
    }, [setUserPaidPoints, setUserBonusPoints]);

    // 로그인/가입 성공 — 신규 가입이면 환영 알럿(가입 보너스 1,000P = 백엔드 SIGNUP_BONUS와 동일) 표시
    const handleAuthSuccessWithWelcome = useCallback((u: User, token: string, isNewUser?: boolean) => {
        handleAuthSuccess(u, token);
        setShowAuthModal(false); // 로그인 모달 닫기(딥링크 진입 시 모달 잔존 방지)
        if (isNewUser) setRewardAlert({ kind: 'welcome', amount: 1000 });
        // 공유 딥링크(?p / ?f) 대기 중이면 user 변경 감지 useEffect가 해당 화면으로 진입시킨다.
    }, [handleAuthSuccess, setShowAuthModal]);

    // 레퍼럴 링크(?ref) 방문자 자동 체험계정 로그인 성공 — 환영 알럿만 문구가 다름(가입 보너스 아님).
    const handleGuestAuthSuccess = useCallback((u: User, token: string) => {
        handleAuthSuccess(u, token);
        setShowAuthModal(false);
        // 지급액은 서버(GUEST_SIGNUP_BONUS)가 정한다 — 하드코딩하면 서버 정책 변경 시 화면만 거짓말한다.
        setRewardAlert({ kind: 'guestWelcome', amount: u.bonusPoints ?? 0 });
    }, [handleAuthSuccess, setShowAuthModal]);

    // 게스트(레퍼럴) 자동등록 진행 상태 — 선언은 여기, useEffect는 arrivedViaReferral 선언 뒤(아래)에 둔다
    // (arrivedViaReferral useState보다 먼저 참조하면 TDZ 에러).
    // 'idle'→'loading'→'done'|'failed'. failed면 기존처럼 가입폼으로 폴백.
    const [guestRegisterState, setGuestRegisterState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');

    // 학습자료(/learn) 게이트에서 온 로그인 복귀 — 이메일/카카오/모달 등 모든 로그인 경로 공통.
    // 게이트가 sessionStorage에 복귀 경로를 심고 ?login=1로 보냄 → 로그인 확정 시 원래 페이지로.
    useEffect(() => {
        if (!user) return;
        const rt = sessionStorage.getItem('afterAuthRedirect');
        if (rt && rt.startsWith('/')) {
            sessionStorage.removeItem('afterAuthRedirect');
            window.location.href = rt;
        }
    }, [user]);

    const { isFavorite, toggleFavorite, favorites } = useFavorites(!!user, handleMissionAwarded);
    const { isFavorite: isFavoritePersona, toggleFavorite: toggleFavoritePersona, favorites: favoritePersonaIds } = useFavoritePersonas(!!user, handleMissionAwarded);
    const { paymentSuccess } = usePayment(user, setUserPaidPoints, setUserBonusPoints);
    // 뉴UI: 페르소나 대기 페이지 초기 탭
    const [mainInitialTab, setMainInitialTab] = useState<'personas' | 'features'>('personas');
    // 뉴UI: 히어로→대기 페이지 포커스 대상
    const [mainFocusPersonaId, setMainFocusPersonaId] = useState<string | null>(null);
    const [mainFocusFeatureKey, setMainFocusFeatureKey] = useState<string | null>(null);
    const [resetToken, setResetToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token');
    });
    // 공유 딥링크: ?p=<personaId> (페르소나 채팅) / ?f=<featureKey> (기능 보드).
    // 공유 링크로 들어온 사람을 해당 페르소나/기능으로 바로 안내한다(바이럴 유입).
    // URL은 즉시 정리(공유링크 흔적/새로고침 시 재진입 방지)하고 값만 보관 → 아래 useEffect에서 처리.
    // 추천(바이럴) 링크로 막 들어왔는지(?ref 캡처). true면 비회원에게 곧장 가입 안내 화면 + 환영 혜택 배너.
    // ※ pendingDeepLink 초기화보다 먼저 실행돼야 하므로(ref 제거가 선행) 이 useState를 위에 둔다.
    const [arrivedViaReferral, setArrivedViaReferral] = useState<boolean>(() => captureRefFromUrl());

    // 레퍼럴 링크(?ref)로 막 들어온 비회원 → 가입폼 대신 임시계정 자동생성+로그인(2026-07-21).
    // failed면 렌더 쪽에서 기존처럼 가입폼으로 폴백.
    useEffect(() => {
        if (!arrivedViaReferral || user || guestRegisterState !== 'idle') return;
        setGuestRegisterState('loading');
        authApi.guestRegister()
            .then(({ user: u, token }) => {
                handleGuestAuthSuccess(u, token);
                setGuestRegisterState('done');
            })
            .catch(() => setGuestRegisterState('failed'));
    }, [arrivedViaReferral, user, guestRegisterState, handleGuestAuthSuccess]);

    const [pendingDeepLink, setPendingDeepLink] = useState<{ kind: 'persona'; id: string } | { kind: 'feature'; key: string } | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const p = params.get('p');
        const f = params.get('f');
        if (p || f) {
            params.delete('p');
            params.delete('f');
            const qs = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        }
        if (p) return { kind: 'persona', id: p };
        if (f) return { kind: 'feature', key: f };
        return null;
    });

    // 🔮 타로 보고서 공개 공유(?tr=shareId) — 비로그인도 열람 가능(바이럴 유입).
    const [publicTarotShareId] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const tr = params.get('tr');
        if (tr) {
            params.delete('tr');
            const qs = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        }
        return tr;
    });
    const [publicTarotData, setPublicTarotData] = useState<TarotReportData | null>(null);
    useEffect(() => {
        if (!publicTarotShareId) return;
        tarotApi.getShared(publicTarotShareId)
            .then(r => setPublicTarotData({
                question: r.question,
                cards: JSON.parse(r.cardsJson),
                interpretations: JSON.parse(r.interpretationsJson),
                createdAt: r.createdAt,
            }))
            .catch(() => { /* 만료/비공개 링크 — 조용히 무시 */ });
    }, [publicTarotShareId]);

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
    const [inputText, setInputText] = useState('');
    const [isAdminMode, setIsAdminMode] = useState(false);
    const {
        showBoard, setShowBoard,
        showPartnerBoard, setShowPartnerBoard,
        showUserProfile, setShowUserProfile,
        showStockAnalysis, setShowStockAnalysis,
        showHotKeyword, setShowHotKeyword,
        showResearch, setShowResearch,
        showProductExtract, setShowProductExtract,
        showGolfReserve, setShowGolfReserve,
        showUsedItem, setShowUsedItem,
        showLuxuryBoard, setShowLuxuryBoard,
        showInsuranceBoard, setShowInsuranceBoard,
        showTodayNews, setShowTodayNews,
        showSwingBoard, setShowSwingBoard,
        showSwingInput, setShowSwingInput,
        showMathTutor, setShowMathTutor,
        showClubBoard, setShowClubBoard,
        showMarketingBoard, setShowMarketingBoard,
        showHomepageBoard, setShowHomepageBoard,
        showShortsMakerBoard, setShowShortsMakerBoard,
    } = useBoardToggles();
    const [comingSoonMsg, setComingSoonMsg] = useState('');
    const [shareToast, setShareToast] = useState('');  // 공유 링크 복사/공유 완료 안내
    const [referralCode, setReferralCode] = useState<string | null>(null);  // 내 추천코드(공유링크에 ?ref 부착용)
    const [showInviteModal, setShowInviteModal] = useState(false);  // 친구 초대 화면
    const [firstChatMap, setFirstChatMap] = useState<Record<string, string>>({});

    const [categories, setCategories] = useState<Category[]>([]);
    const [heroCards, setHeroCards] = useState<HeroCard[]>([]);
    // 어드민 지정 메인 카드 순서(AppConfig: 콤마구분 키). 빈 배열이면 MainPageNew가 기본/자동 정렬.
    const [spotlightOrder, setSpotlightOrder] = useState<string[]>([]);
    const [newFeaturesOrder, setNewFeaturesOrder] = useState<string[]>([]);
    const [headerImageModal, setHeaderImageModal] = useState(false);
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

    // 퀵메뉴 / 생년월일 폼 상태 (useQuickMenu로 이동 — 상태만)
    const {
        birthInfo, setBirthInfo,
        showBirthModal, setShowBirthModal,
        pendingQuickMenu, setPendingQuickMenu,
        quickMenuResult, setQuickMenuResult,
        quickMenuLoading, setQuickMenuLoading,
        inputPlaceholder, setInputPlaceholder,
        activeQuickMenu, setActiveQuickMenu,
        showPartnerModal, setShowPartnerModal,
        pendingPartnerMenu, setPendingPartnerMenu,
        twoPartnerStep, setTwoPartnerStep,
        firstPartner, setFirstPartner,
        pendingTwoPartnerMenu, setPendingTwoPartnerMenu,
        showFaceModal, setShowFaceModal,
        faceReadingResult, setFaceReadingResult,
        showPalmModal, setShowPalmModal,
        palmReadingResult, setPalmReadingResult,
        subMenuConfig, setSubMenuConfig,
        birthModalSkippedRef,
    } = useQuickMenu(user, activePersonaId, personas);
    const subMenuResultCardRef = useRef(false);
    const [isGreeting, setIsGreeting] = useState(false);
    const [chatBgSelected, setChatBgSelected] = useState<string | null>(null);
    const chatBgPersonaRef = useRef<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const swingVideoRef = useRef<HTMLInputElement>(null);
    const headerMenuRef = useRef<HTMLDivElement>(null);
    const starThanksPromiseRef = useRef<{ promise: Promise<{ message: { text: string }; sessionId: string }>; personaId: string } | null>(null);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    // 전자책 만들기 보드(강지훈 퀵메뉴 ebookModal) — 훅은 조건부 return보다 위에 있어야 함
    const [showEbookBoard, setShowEbookBoard] = useState(false);
    const [showHairBoard, setShowHairBoard] = useState(false);
    const [showOutfitBoard, setShowOutfitBoard] = useState(false);
    const [showLookalikeModal, setShowLookalikeModal] = useState(false);
    const [lookalikeResult, setLookalikeResult] = useState<LookalikeResult | null>(null);
    const [showAgeBoard, setShowAgeBoard] = useState(false);
    const [showWebtoon, setShowWebtoon] = useState(false);

    // 전용 보드가 없고 페르소나 채팅의 퀵메뉴(quickMenuJson)로 실행되는 기능들.
    // 공유 딥링크(?f=dream 등)로 오면 채팅만 열리고 "그래서 뭘 하라는 거지?"가 되므로,
    // 도착 후 해당 퀵메뉴를 자동으로 눌러준다(2026-07-28). 값 = quickMenuJson의 label과 정확히 일치.
    // 공유 링크로 도착했을 때 띄울 사용법 안내(기능별). 없으면 안내 없이 조용히 진행.
    const FEATURE_DEEPLINK_GUIDE: Record<string, { title: string; desc: string }> = {
        dream: { title: '🌙 꿈해몽', desc: '어젯밤 꾸신 꿈을 아래 입력창에 적어주시면 도결 선생이 그 뜻을 풀어드려요.' },
        gwansang: { title: '🔮 관상학', desc: '얼굴 사진을 올리시면 도결 선생이 관상과 성격·운세를 풀어드려요.' },
        palm: { title: '🖐 손금 보기', desc: '손바닥 사진을 올리시면 도결 선생이 생명선·감정선·재물운을 읽어드려요.' },
        siwoon: { title: '📅 시운의 흐름', desc: '오늘·이달·올해 중 보고 싶은 흐름을 고르시면 도결 선생이 풀어드려요.' },
        wealth: { title: '💰 성취와 재물', desc: '재물 흐름과 사업운 중 궁금한 쪽을 고르시면 도결 선생이 짚어드려요.' },
        yeonn: { title: '❤️ 인연의 결', desc: '연애운과 궁합 중 보고 싶은 것을 고르시면 도결 선생이 읽어드려요.' },
        rebirth: { title: '🕉️ 전생 이야기', desc: '도결 선생이 당신의 전생과 그것이 남긴 기질을 이야기처럼 들려드려요.' },
        friendship: { title: '🤝 우정 궁합', desc: '나와 친구, 또는 친구 둘 사이의 우정을 도결 선생이 헤아려드려요.' },
    };

    const FEATURE_QUICK_MENU_LABEL: Record<string, string> = {
        dream: '🌙 해몽',
        gwansang: '🔮 관상',
        siwoon: '📅 운세',
        wealth: '💰 재물',
        yeonn: '❤️ 인연',
        rebirth: '🕉️ 전생',
        palm: '🖐 손금',
        friendship: '🤝 우정',
    };
    // 딥링크로 도착해 아직 실행되지 않은 퀵메뉴 라벨(페르소나 채팅 진입 후 처리).
    const [pendingQuickMenuLabel, setPendingQuickMenuLabel] = useState<string | null>(null);
    // 공유 링크로 들어와 퀵메뉴가 자동 실행됐을 때 띄우는 안내(2026-07-28 사장 지시).
    // 처음 온 사람은 입력창 placeholder만으론 "여기에 뭘 쓰라는 건지" 모른다 —
    // 무엇을 하는 화면이고 어떻게 쓰는지 한 번 알려준 뒤 닫는다.
    const [deepLinkGuide, setDeepLinkGuide] = useState<{ title: string; desc: string } | null>(null);

    // 기능 키 → 전용 보드 열기. 공유 딥링크(?f) 처리와 hero 즐겨찾기/채팅 기능카드(FEATURE_ACTIONS)가
    // 공유하는 단일 출처(webtoon은 페르소나 활성화가 선행돼야 해서 호출처에서 별도 처리).
    const featureBoardOpeners: Record<string, () => void> = {
        news: () => setShowTodayNews(true),
        stock: () => setShowStockAnalysis(true),
        hotkeyword: () => setShowHotKeyword(true),
        used: () => setShowUsedItem(true),
        luxury: () => setShowLuxuryBoard(true),
        insurance: () => setShowInsuranceBoard(true),
        mathtutor: () => setShowMathTutor(true),
        club: () => setShowClubBoard(true),
        // golf-swing/golf-record는 설아 채팅 내 기능 버튼 키(personaFeatures.ts).
        // swing은 메인 기능카드(FEATURES_GRID)의 키 — 공유 딥링크(?f=swing)가 이 키로 들어온다.
        swing: () => setShowSwingInput(true),
        'golf-swing': () => setShowSwingInput(true),
        'golf-record': () => setShowSwingBoard(true),
        ebook: () => setShowEbookBoard(true),
        hair: () => setShowHairBoard(true),
        outfit: () => setShowOutfitBoard(true),
        lookalike: () => setShowLookalikeModal(true),
        agetransform: () => setShowAgeBoard(true),
        marketing: () => setShowMarketingBoard(true),
        homepage: () => setShowHomepageBoard(true),
        'shorts-maker': () => setShowShortsMakerBoard(true),
        learn: () => { window.location.href = '/learn'; }, // 박하진 학습자료 — 시리즈 목록(1편·2편 선택). 얼리리턴 라우트
    };

    // 공지사항
    const {
        announcements,
        readAnnouncementIds,
        showAnnouncementModal,
        setShowAnnouncementModal,
        handleReadAnnouncements,
        unreadAnnouncementCount,
    } = useAnnouncements();

    const refreshPersonaImages = useCallback((personaId: string) => {
        personaImageApi.getAll(personaId)
            .then(imgs => setPersonaImages(prev => ({ ...prev, [personaId]: imgs })))
            .catch(() => {});
    }, []);

    const {
        sessions,
        setSessions,
        addMessageToSession,
        updateMessageInSession,
        setSessionTyping,
        triggerSummaryUpdate,
        handleSelectPersona,
        handleLoadMoreMessages,
    } = usePersonaSession(personas, activePersonaId, setActivePersonaId, {
        setInputPlaceholder, setActiveQuickMenu, personaImages, refreshPersonaImages, setFirstChatMap, setIsGreeting,
    });

    // 앱 시작 시 페르소나/설정 로드 (공개). 로그인 확인은 useAuth로 이동.
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
        heroCardApi.list().then(setHeroCards).catch(() => {});

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
                // 메인 카드 순서(어드민 지정). 콤마구분 문자열 → 키 배열.
                if (s.spotlightOrder) setSpotlightOrder(s.spotlightOrder.split(',').map(k => k.trim()).filter(Boolean));
                if (s.newFeaturesOrder) setNewFeaturesOrder(s.newFeaturesOrder.split(',').map(k => k.trim()).filter(Boolean));
                localStorage.setItem('settings_cache', JSON.stringify({ data: s, ts: Date.now() }));
            })
            .catch(() => {});
    }, []);

    // 어드민 로그인 시 페르소나 전체 목록 재로드 (adminOnly/숨김 페르소나 포함)
    // 최초 mount의 getAll()은 토큰 자동로그인 이전에 실행돼 adminOnly:false만 받아오므로,
    // 어드민이 되면 전체를 다시 받아야 강지훈 등 숨김 페르소나가 어드민 화면에 보인다.
    useEffect(() => {
        if (user?.role !== 'ADMIN') return;
        personaApi.getAll()
            .then(data => {
                setPersonas(data);
                localStorage.setItem('personas_cache', JSON.stringify({ data, ts: Date.now() }));
            })
            .catch(() => {});
    }, [user?.role]);

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

    // 로그인 후 내 추천코드 로드(공유링크 ?ref 부착 + 친구초대 화면용). 실패해도 공유는 ref 없이 동작.
    useEffect(() => {
        if (!user) { setReferralCode(null); setMyReferralCode(null); return; }
        authApi.referral().then(r => { setReferralCode(r.code); setMyReferralCode(r.code); }).catch(() => {});
    }, [user?.id]);


    // 공유 딥링크(?p / ?f) 처리 — personas 로드 후 1회.
    // ★바이럴 방향: 비회원에게 가입을 강요하지 않는다.
    //   - 로그인 상태: 해당 페르소나 채팅 / 기능 보드를 바로 연다.
    //   - 비로그인: 페르소나는 인트로(소개)를 보여주고, 기능은 대기페이지에서 그 기능을 포커스해
    //     소개를 보게 한다. 가입은 사용자가 "입장/시작"을 누를 때 자연스럽게 유도된다.
    useEffect(() => {
        if (!pendingDeepLink || isPersonasLoading || !personas.length) return;

        if (pendingDeepLink.kind === 'persona') {
            const target = personas.find(p => p.id === pendingDeepLink.id && p.isVisible !== false);
            if (!target) { setPendingDeepLink(null); return; } // 없는/숨김 페르소나 → 무시
            if (user) {
                setActivePersonaId(target.id);
                rememberLastPersona(target.id);
                goTo('chat');
            } else {
                handleGuestPersonaClick(target.id); // 가입 강요 X → 인트로(소개) 노출
            }
            setPendingDeepLink(null);
            return;
        }

        // 기능 딥링크(?f=key)
        const key = pendingDeepLink.key;
        const known = FEATURES_GRID.some(g => g.key === key) || !!FEATURE_BY_KEY[key];
        if (!known) { setPendingDeepLink(null); return; } // 모르는 기능 키 → 무시
        if (user) {
            // 로그인: 전용 보드가 있으면 보드를 열고(featureBoardOpeners), 그 외(운세 등)는
            // 해당 페르소나 채팅으로 이동. (hero 렌더의 onFeatureSelect와 동일한 분기)
            if (key === 'webtoon') {
                const wp = personas.find(p => p.name === FEATURES_GRID.find(g => g.key === 'webtoon')?.personaName);
                if (wp) { setActivePersonaId(wp.id); setShowWebtoon(true); }
            } else if (key === 'tarot') {
                // 타로는 유나 채팅 컨텍스트 위에서 카드 모달을 띄운다(웹툰과 동일 패턴).
                const tp = personas.find(p => p.name === FEATURES_GRID.find(g => g.key === 'tarot')?.personaName);
                if (tp) { goTo('chat'); handlePersonaClick(tp.id); }
                setTarotModalMode('full');
            } else {
                const opener = featureBoardOpeners[key];
                if (opener) {
                    opener();
                } else {
                    const grid = FEATURES_GRID.find(g => g.key === key);
                    const persona = grid?.personaName ? personas.find(p => p.name === grid.personaName) : undefined;
                    if (persona) {
                        goTo('chat');
                        handlePersonaClick(persona.id);
                        // 전용 보드가 없는 기능(꿈해몽·관상·운세 등)은 채팅만 열면 뭘 하라는 건지 알 수 없다.
                        // 해당 퀵메뉴를 예약해 두면 아래 useEffect가 채팅 진입 후 자동 실행한다.
                        const qm = FEATURE_QUICK_MENU_LABEL[key];
                        if (qm) {
                            setPendingQuickMenuLabel(qm);
                            // 처음 온 사람은 입력창 placeholder만으론 뭘 하라는 건지 모른다 → 사용법 안내.
                            const g = FEATURE_DEEPLINK_GUIDE[key];
                            if (g) setDeepLinkGuide(g);
                        }
                    }
                }
            }
            rememberLastFeature(key);
        } else {
            // 비로그인: 대기페이지에서 해당 기능을 포커스(소개 노출). 가입 강요 X.
            setMainFocusFeatureKey(key);
            setMainFocusPersonaId(null);
            setMainInitialTab('features');
            goTo('main');
        }
        setPendingDeepLink(null);
    }, [pendingDeepLink, isPersonasLoading, personas, user]);

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

    // handleSelectPersona는 usePersonaSession(T6b)으로 이동.

    // 인트로 영상/이미지 확인 후 채팅 진입 (없으면 바로 진입)
    // 로그아웃: reload() 대신 명시적 전체 리셋.
    // reload가 암묵적으로 초기화하던 유저 종속 상태(세션/포인트/어드민/이미지/기억)를
    // 직접 비워 이전 유저 잔존을 차단한다. (① reload 제거 리팩토링)
    const handleLogout = useCallback(async () => {
        try { await authApi.logout(); } catch {}
        // 유저 종속 상태 리셋
        setSessions({});
        setUserPaidPoints(0);
        setUserBonusPoints(0);
        setIsAdminMode(false);
        setPersonaImages({});
        setTriggerVideos({});
        setMemoryEnabled({});
        setActiveQuickMenu(null);
        setShowHeaderMenu(false);
        // token/user 제거 + guest 화면 (마지막에 호출해 화면 전환을 한 번에)
        resetAuth();
    }, [resetAuth, setSessions, setUserPaidPoints, setUserBonusPoints]);

    // 최근 대화한 페르소나 ID 목록(최근순, 최대 5). Hero "이어서 대화" 배너 + MainPageNew "최근 대화" 줄용.
    // localStorage 'recentPersonaIds'에 영속, 화면 갱신 위해 state로도 보유.
    const [recentPersonaIds, setRecentPersonaIds] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem('recentPersonaIds');
            if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string'); }
            // 레거시 단일 키 마이그레이션
            const legacy = localStorage.getItem('lastPersonaId');
            return legacy ? [legacy] : [];
        } catch { return []; }
    });

    // 실제 대화 진입 시 호출 — 해당 페르소나를 최근 목록 맨 앞으로(중복 제거, 최대 5).
    const rememberLastPersona = useCallback((personaId: string) => {
        setRecentPersonaIds(prev => {
            const next = [personaId, ...prev.filter(id => id !== personaId)].slice(0, 5);
            try { localStorage.setItem('recentPersonaIds', JSON.stringify(next)); localStorage.setItem('lastPersonaId', personaId); } catch {}
            return next;
        });
    }, []);

    // 보험분석 결과 → 김지훈에게 상담: 분석 컨텍스트를 김지훈 세션에 숨은(model) 메시지로 저장하면
    // chat-stream이 history(최근 30개)에 포함시켜 AI가 참고함. 화면엔 인사말만 노출.
    const KIMJIHOON_PERSONA_ID = 'cmqcbkt4y0000rpbefrh2z8rb';
    const handleInsuranceConsult = async (title: string, context: string) => {
        const pid = KIMJIHOON_PERSONA_ID;
        setShowInsuranceBoard(false);
        setActivePersonaId(pid);
        rememberLastPersona(pid);
        goTo('chat');
        try {
            // 김지훈 DB 세션 보장
            let dbSessionId = sessions[pid]?.dbSessionId;
            if (!dbSessionId) {
                const ns = await sessionApi.create(pid, `보험상담: ${title}`.slice(0, 30));
                dbSessionId = ns.id;
                setSessions(prev => ({ ...prev, [pid]: { ...(prev[pid] || { messages: [], isTyping: false }), dbSessionId } }));
            }
            // 분석 컨텍스트 = model 메시지(포인트 차감 없음, AI history에만 반영)
            if (dbSessionId) await sessionApi.saveMessage(dbSessionId, 'model', context);
        } catch (e) {
            console.error('보험 상담 컨텍스트 저장 실패:', e);
        }
        // 화면용 인사말
        addMessageToSession(pid, {
            id: `ins-${Date.now()}`,
            role: 'model',
            text: `'${title}' 보험 분석 내용을 확인했어요. 중복 보장이나 절감 방안, 해지·유지 고민까지 편하게 물어보세요. 어떤 점이 가장 궁금하세요?`,
        });
    };

    // 최근 사용 기능(featureKey) — 페르소나와 동일 패턴, localStorage 영속, 최대 5.
    const [recentFeatureKeys, setRecentFeatureKeys] = useState<string[]>(() => {
        try { const raw = localStorage.getItem('recentFeatureKeys'); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string'); } } catch {}
        return [];
    });
    const rememberLastFeature = useCallback((featureKey: string) => {
        setRecentFeatureKeys(prev => {
            const next = [featureKey, ...prev.filter(k => k !== featureKey)].slice(0, 5);
            try { localStorage.setItem('recentFeatureKeys', JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);

    const handlePersonaClick = useCallback((personaId: string) => {
        const persona = personas.find(p => p.id === personaId);
        if (persona?.introVideoUrl) {
            setIntroVideoModal({ personaId, type: 'video', url: persona.introVideoUrl });
            handleSelectPersona(personaId, { prefetchOnly: true }); // 인트로 보는 동안 인사말 미리 준비
        } else if (persona?.imageUrl) {
            setIntroVideoModal({ personaId, type: 'image', url: persona.imageUrl });
            handleSelectPersona(personaId, { prefetchOnly: true }); // 인트로 보는 동안 인사말 미리 준비
        } else {
            rememberLastPersona(personaId);
            handleSelectPersona(personaId);
        }
    }, [personas, handleSelectPersona, rememberLastPersona]);

    // 비회원이 페르소나 클릭 → 인트로 표시, 입장 시 회원가입 유도
    const handleGuestPersonaClick = useCallback((personaId: string) => {
        const persona = personas.find(p => p.id === personaId);
        if (persona?.introVideoUrl) {
            setIntroVideoModal({ personaId, type: 'video', url: persona.introVideoUrl, guestMode: true });
        } else if (persona?.imageUrl) {
            setIntroVideoModal({ personaId, type: 'image', url: persona.imageUrl, guestMode: true });
        } else {
            goTo('authPage');
        }
    }, [personas, goTo]);

    // 공유: 딥링크 URL을 만들어 네이티브 공유(모바일) → 실패/미지원 시 클립보드 복사로 폴백.
    // kind/value = 'p'(페르소나) / 'f'(기능). 결과 토스트로 안내.
    const shareDeepLink = useCallback(async (param: 'p' | 'f', value: string, title: string) => {
        // 추천코드가 있으면 공유 링크에 ?ref 부착 → 타고 가입 시 추천인 자동 기록(바이럴+보상).
        const refQs = referralCode ? `&ref=${encodeURIComponent(referralCode)}` : '';
        const url = `${window.location.origin}/?${param}=${encodeURIComponent(value)}${refQs}`;
        // 받는 사람이 무엇을 보게 될지 제목에서 드러나야 링크를 누른다(2026-07-28).
        // 기능은 기능명, 페르소나는 "OO와 대화하기"로 구분.
        const shareText = param === 'f' ? `${title} · AI 페르소나 채팅` : `${title}와 대화하기 · AI 페르소나 채팅`;
        try {
            if (navigator.share) {
                await navigator.share({ title: shareText, url });
                return; // 네이티브 공유 시트 (취소해도 throw → 아래 복사 폴백 안 탐)
            }
        } catch {
            // 사용자가 공유 시트를 닫았을 수 있음 → 복사 폴백은 생략(중복 안내 방지)
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            setShareToast('공유 링크가 복사되었습니다');
        } catch {
            setShareToast(url); // 클립보드도 막힌 환경 → URL 노출
        }
        setTimeout(() => setShareToast(''), 2500);
    }, [referralCode]);

    // handleLoadMoreMessages / triggerSummaryUpdate는 usePersonaSession(T6b)으로 이동.

    // 퀵메뉴 결과 카드 생성(전생·궁합 등) — 프롬프트로 AI 생성 후 QuickMenuResultCard 띄움.
    const runQuickMenuCard = useCallback((label: string, fullPrompt: string) => {
        setActiveQuickMenu(label);
        setQuickMenuLoading(true);
        quickMenuApi.generate(activePersonaId, fullPrompt)
            .then(({ result, paidBalance, bonusBalance }) => {
                setUserPaidPoints(paidBalance);
                setUserBonusPoints(bonusBalance);
                setQuickMenuResult({ title: label, result });
            })
            .catch(e => alert(quickMenuErrorMessage(e)))
            .finally(() => setQuickMenuLoading(false));
    }, [activePersonaId]);

    const handleSubItem = useCallback((item: SubMenuItem) => {
        setSubMenuConfig(null);
        if (item.partnerModal) {
            setPendingPartnerMenu({ label: item.label, prompt: item.prompt ?? '' });
            setShowPartnerModal(true);
            return;
        }
        if (item.twoPartnerModal) {
            // 친구 둘 궁합 — 친구1부터 입력. onComplete에서 친구2로 이어진다.
            setPendingTwoPartnerMenu({ label: item.label, prompt: item.prompt ?? '' });
            setFirstPartner(null);
            setTwoPartnerStep(1);
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

    // 📱모바일 실측 뷰포트 높이(--app-vh): dvh를 오구현한 브라우저(네이버 등)에서
    //   주소창이 나타나며 상단 헤더를 가리는 문제 대응 — 주소창 상태가 바뀔 때마다
    //   window.innerHeight 를 CSS 변수로 반영해 채팅 레이아웃이 항상 '보이는 영역'에 맞게.
    useEffect(() => {
        const setVh = () => document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`);
        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
        window.visualViewport?.addEventListener('resize', setVh);
        return () => {
            window.removeEventListener('resize', setVh);
            window.removeEventListener('orientationchange', setVh);
            window.visualViewport?.removeEventListener('resize', setVh);
        };
    }, []);

    // 🔮 타로 뽑기 모달(유나): 카드 선택마다 채팅 자동 전송(스트림 경로=지식창고 주입)
    const [tarotModalMode, setTarotModalMode] = useState<null | 'full' | 'daily'>(null);
    const [tarotReport, setTarotReport] = useState<{ id?: string; data: TarotReportData } | null>(null);
    const tarotAutoSendRef = useRef(false);

    // 풀 리딩 종료 후: 세션 메시지에서 종합 해석(요청 마커 다음 model 응답) 1건을 찾아 보고서 저장.
    // (2026-07-21: 카드별 개별 해석 요청을 없애 종합 1건만 존재 — TarotCardModal 참고)
    const makeTarotReport = (drawn: { card: { kr: string; en: string; no: string; sym: string }; reversed: boolean; position: string }[]) => {
        const msgs = (sessions[activePersonaId]?.messages ?? []);
        const idx = msgs.findIndex(x => x.role === 'user' && x.text.includes('[타로 리딩 종합]'));
        const reply = idx >= 0 ? msgs.slice(idx + 1).find(x => x.role === 'model' && x.text && !x.isStreaming) : undefined;
        if (!reply) {
            alert('유나의 해석이 아직 도착하지 않았어요. 답변이 끝난 뒤 다시 눌러 주세요.');
            return;
        }
        const interpretations = [{ position: '종합', text: reply.text }];
        const cards = drawn.map(d => ({ position: d.position, kr: d.card.kr, en: d.card.en, no: d.card.no, sym: d.card.sym, reversed: d.reversed }));
        const data: TarotReportData = { question: null, cards, interpretations, createdAt: new Date().toISOString() };
        tarotApi.save({ question: null, cards, interpretations })
            .then(r => setTarotReport({ id: r.id, data }))
            .catch(() => setTarotReport({ data }));  // 저장 실패 시에도 보고서는 표시(공유만 불가)
    };
    useEffect(() => {
        if (tarotAutoSendRef.current && inputText.trim()) {
            tarotAutoSendRef.current = false;
            handleSendMessage();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputText]);

    const isAdmin = user?.role === 'ADMIN';
    // #4: 자식(MainPageNew/LandingPageNew)에 prop drilling 대신 Context로 공급.
    // onAdminClick은 화면별 전환 부수효과가 달라 prop 유지(AuthContext 미포함).
    const authCtxValue = { user, isAdmin, onLogout: handleLogout };
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
        if (isAdminMode) return;
        // ★scrollIntoView는 body 등 조상 전부를 스크롤시켜 모바일에서 상단 헤더가
        //   화면 밖으로 밀려났음(2026-07-06 수정) → 메시지 컨테이너(첫 스크롤 가능한
        //   조상)만 스크롤한다.
        const end = messagesEndRef.current;
        if (!end) return;
        let sc: HTMLElement | null = end.parentElement;
        while (sc && sc.scrollHeight <= sc.clientHeight + 1) sc = sc.parentElement;
        if (sc && sc !== document.body && sc !== document.documentElement) {
            sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
        }
    }, [currentSession.messages, isAdminMode]);

    // 포인트 부족(402) 전역 처리: 어느 기능에서든 충전 모달을 띄운다.
    useEffect(() => {
        const onInsufficient = () => setShowPointModal(true);
        window.addEventListener('insufficient-points', onInsufficient);
        return () => window.removeEventListener('insufficient-points', onInsufficient);
    }, [setShowPointModal]);

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

    const handleAdminLogin = () => {
        if (user?.role === 'ADMIN') {
            setIsAdminMode(true);
            goTo('chat'); // AdminPanel은 'chat' 화면 내부에서 isAdminMode로 렌더됨
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
                if (e.code === 'DAILY_CHAT_LIMIT') {
                    // 대화 무료화(2026-07-08) 하루 한도 도달 — 충전 모달 대신 안내만
                    addMessageToSession(activePersonaId, {
                        id: (Date.now() + 2).toString(), role: 'model',
                        text: e.message || '오늘의 무료 대화를 모두 사용했어요. 내일 다시 만나요!',
                    });
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

    // 공유 딥링크로 도착해 예약된 퀵메뉴 자동 실행(꿈해몽·관상·운세 등).
    // ★이 훅은 반드시 아래 조기 return(resetToken/isAuthChecking/screen==='authPage'/'main')
    //   보다 **위**에 있어야 한다 — 아래에 두면 로그인·화면 상태에 따라 훅 개수가 달라져
    //   React #310(Rendered fewer hooks than expected)로 앱 전체가 백지가 된다(2026-07-28 실사고).
    // handleQuickMenuSelect는 아래에 선언된 함수 선언식이 아니라 const라 여기서 못 부른다
    //   → 실행은 ref에 담아 우회(아래에서 채움).
    const quickMenuRunnerRef = useRef<((menu: QuickMenuItem, useBirthInfo: boolean) => void) | null>(null);
    useEffect(() => {
        if (!pendingQuickMenuLabel || screen !== 'chat') return;
        const json = personas.find(p => p.id === activePersonaId)?.quickMenuJson;
        if (!json || !quickMenuRunnerRef.current) return;
        let cfg: { menus?: QuickMenuItem[]; useBirthInfo?: boolean };
        try { cfg = JSON.parse(json); } catch { setPendingQuickMenuLabel(null); return; }
        const menu = cfg.menus?.find(m => m.label === pendingQuickMenuLabel);
        setPendingQuickMenuLabel(null);
        if (menu) quickMenuRunnerRef.current(menu, !!cfg.useBirthInfo);
    }, [pendingQuickMenuLabel, screen, activePersonaId, personas]);

    if (resetToken) {
        return (
            <>
                <LandingPageNew
                    personas={visiblePersonas}
                    heroCards={heroCards}
                    spotlightOrder={spotlightOrder}
                    newFeaturesOrder={newFeaturesOrder}
                    isLoading={isPersonasLoading}
                    onStart={() => {}}
                    onLoginClick={() => {}}
                    categories={categories}
                />
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

    // 로그인 전용 화면 — 로그인/비로그인 무관하게 screen==='authPage'면 항상 노출
    // (탑메뉴 로그인 토글 → goTo('authPage'). 상태 불일치로 안 뜨던 문제 방지차 최상위로).
    if (screen === 'authPage') {
        return (
            <AuthModal
                onSuccess={handleAuthSuccessWithWelcome}
                onBack={() => goTo('main')}
                defaultMode="login"
                fullScreen
            />
        );
    }

    // 즐겨찾기로 담을 수 있는 기능 = 모든 기능 카드. (비회원 카드 ☆도 같은 키 사용 → 위로 끌어올림, TDZ 방지)
    const FAVORITABLE_KEYS = FEATURES_GRID.map(f => f.key);

    if (!user) {
        // 바이럴 링크(?ref)로 막 들어온 비회원 → 임시계정 자동생성+로그인 중(2026-07-21).
        // 위 useEffect가 guest-register를 호출하는 동안 짧게 로딩만 노출 — 성공하면 user가 채워져
        // 이 블록을 아예 벗어나고, 실패(failed)하면 기존처럼 가입폼으로 폴백(탈출구 유지).
        if (arrivedViaReferral && guestRegisterState !== 'failed') {
            return (
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF8F3' }}>
                    <div style={{ fontSize: 13, color: '#8A7F96' }}>체험 준비 중…</div>
                </div>
            );
        }
        if (arrivedViaReferral && guestRegisterState === 'failed') {
            return (
                <AuthModal
                    onSuccess={handleAuthSuccessWithWelcome}
                    onBack={() => setArrivedViaReferral(false)}
                    defaultMode="register"
                    fullScreen
                    referralBanner
                />
            );
        }
        // 비로그인 'AI 둘러보기' — MainPageNew를 그대로 렌더하되 인증 필요 액션은 로그인 모달로 분기.
        // 페르소나/기능 카드, 카테고리, 검색 등 정적 정보 영역은 그대로 사용 가능.
        if (screen === 'main') {
            const requireLogin = () => setShowAuthModal(true);
            return (
                <>
                    <AuthProvider value={authCtxValue}>
                        <MainPageNew
                            personas={visiblePersonas}
                            heroCards={heroCards}
                            spotlightOrder={spotlightOrder}
                            newFeaturesOrder={newFeaturesOrder}
                    spotlightOrder={spotlightOrder}
                    newFeaturesOrder={newFeaturesOrder}
                            isLoading={isPersonasLoading}
                            onSelectPersona={requireLogin}
                            onFeatureSelect={() => requireLogin()}
                            onAdminClick={() => {}}
                            onAnnouncementClick={() => setShowAnnouncementModal(true)}
                            unreadAnnouncementCount={unreadAnnouncementCount}
                            onProfileClick={requireLogin}
                            onLoginClick={() => goTo('authPage')}
                            onChargeClick={() => setShowPointModal(true)}
                            categories={categories}
                            onGoHome={() => { window.location.href = '/'; }}
                            initialTab={mainInitialTab}
                            initialFocusPersonaId={mainFocusPersonaId}
                            initialFocusFeatureKey={mainFocusFeatureKey}
                            recentPersonas={[]}
                            isFavorite={() => false}
                            onToggleFavorite={requireLogin}
                            favoritableKeys={FAVORITABLE_KEYS}
                            isFavoritePersona={() => false}
                            onToggleFavoritePersona={requireLogin}
                            onShareFeature={(key, label) => shareDeepLink('f', key, label)}
                        />
                    </AuthProvider>
                    {publicTarotData && (
                    <TarotReportView
                        data={publicTarotData}
                        mode="public"
                        onCta={() => setPublicTarotData(null)}
                        onClose={() => setPublicTarotData(null)}
                    />
                )}
                {shareToast && (
                        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-[#2D2438] border border-[#8E6FB7]/40 rounded-xl shadow-xl flex items-center gap-2 text-sm text-white">
                            <span className="text-[#C4A9E0]">🔗</span>
                            {shareToast}
                        </div>
                    )}
                    {showAuthModal && (
                        <AuthModal
                            onSuccess={handleAuthSuccessWithWelcome}
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
                </>
            );
        }
    }

    // 보드를 바로 여는 기능은 FEATURE_ACTIONS로, 그 외(운세 등)는 해당 페르소나 채팅으로 보낸다.
    // (FAVORITABLE_KEYS는 비회원 블록보다 위로 끌어올림 — 위 정의 참고)
    // 기능 키 → 보드 열기 핸들러 (Hero 즐겨찾기 칩 + 채팅 기능카드 공용).
    // 보드 오프너는 featureBoardOpeners 단일출처를 재사용, webtoon만 별도(페르소나 컨텍스트 필요).
    const FEATURE_ACTIONS: Record<string, () => void> = {
        ...featureBoardOpeners,
        webtoon: () => setShowWebtoon(true),
        tarot: () => setTarotModalMode('full'),        // 유나 타로 뽑기(3장 리딩)
        'tarot-daily': () => setTarotModalMode('daily'), // 오늘의 카드 — 같은 셔플·플립 의식으로 1장(성의)
    };

    // 닮은꼴 모달에 넘길 윤채린 personaId. 메인 카드에서 열면 activePersona가 아직
    // 윤채린이 아닐 수 있어(setState 비동기), personas에서 직접 찾아 폴백.
    const lookalikePersonaId = (activePersona?.name === '윤채린' ? activePersona.id : undefined)
        ?? personas.find(p => p.name === '윤채린')?.id
        ?? activePersona?.id ?? '';

    // 퀵메뉴(quickMenuJson) 메뉴 클릭 처리 — 상단 기능아이콘/하단 칩 공용.
    // (예전엔 하단 IIFE 안에만 있었으나 상단에서도 쓰려고 컴포넌트 레벨로 승격)
    type QuickMenuItem = { label: string; prompt?: string; placeholder?: string; partnerModal?: boolean; faceModal?: boolean; palmModal?: boolean; ebookModal?: boolean; tarotModal?: boolean; resultCard?: boolean; subMenu?: SubMenuConfig };
    const handleQuickMenuSelect = (menu: QuickMenuItem, useBirthInfo: boolean) => {
        if (menu.subMenu) {
            subMenuResultCardRef.current = menu.resultCard ?? false;
            setSubMenuConfig(menu.subMenu);
            return;
        }
        if (menu.faceModal) { setShowFaceModal(true); return; }
        if (menu.palmModal) { setShowPalmModal(true); return; }
        if (menu.tarotModal) { setShowTarotModal(true); return; }
        if (menu.ebookModal) { setShowEbookBoard(true); return; }
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
                .catch(e => {
                    // 포인트 부족(402)은 apiService의 insufficient-points 이벤트가 이미
                    // setShowPointModal(true)를 호출한다(게스트면 정식전환, 정회원이면 충전 모달) —
                    // 여기서 또 alert를 띄우면 날것의 에러코드(INSUFFICIENT_POINTS)가 그대로 노출된다.
                    if (e.code === 'INSUFFICIENT_POINTS') return;
                    alert(e.message || '포인트 차감에 실패했습니다.');
                });
            return;
        }
        if (menu.resultCard) {
            if (useBirthInfo && !birthInfo) {
                setPendingQuickMenu({ label: menu.label, prompt: menu.prompt ?? '', resultCard: true });
                setShowBirthModal(true);
                return;
            }
            let fullPrompt = menu.prompt ?? '';
            if (useBirthInfo && birthInfo) {
                const t = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                const cal = birthInfo.lunar ? '음력' : '양력';
                fullPrompt += `\n\n사용자 정보 — 이름: ${birthInfo.name}, 생년월일: ${cal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${t}`;
            }
            setActiveQuickMenu(menu.label);
            setQuickMenuLoading(true);
            quickMenuApi.generate(activePersonaId, fullPrompt)
                .then(({ result, paidBalance, bonusBalance }) => {
                    setUserPaidPoints(paidBalance);
                    setUserBonusPoints(bonusBalance);
                    setQuickMenuResult({ title: menu.label, result });
                })
                .catch(e => alert(quickMenuErrorMessage(e)))
                .finally(() => setQuickMenuLoading(false));
            return;
        }
        if (useBirthInfo) {
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
    // 위 딥링크 useEffect가 호출할 수 있도록 최신 핸들러를 ref에 담아둔다
    // (훅은 조기 return보다 위에 있어야 하는데 이 함수는 아래에 선언되므로).
    quickMenuRunnerRef.current = handleQuickMenuSelect;

    if (screen === 'main') {
        // 최근 대화 페르소나(보이는 것만, 최근순). "최근 대화" 줄 + 개인화 인사용.
        const recentPersonas = recentPersonaIds
            .map(id => visiblePersonas.find(p => p.id === id))
            .filter((p): p is Persona => !!p);
        return (
            <>
                {rewardAlert && (
                    <RewardAlertModal kind={rewardAlert.kind} amount={rewardAlert.amount} username={user?.username} onClose={() => setRewardAlert(null)} />
                )}
                <AuthProvider value={authCtxValue}>
                <MainPageNew
                    personas={visiblePersonas}
                    heroCards={heroCards}
                    spotlightOrder={spotlightOrder}
                    newFeaturesOrder={newFeaturesOrder}
                    isLoading={isPersonasLoading}
                    onSelectPersona={(id) => { goTo('chat'); handlePersonaClick(id); }}
                    onAdminClick={() => handleAdminLogin()}
                    onAnnouncementClick={() => setShowAnnouncementModal(true)}
                    unreadAnnouncementCount={unreadAnnouncementCount}
                    onProfileClick={() => setShowUserProfile(true)}
                    onLoginClick={() => goTo('authPage')}
                    onChargeClick={() => setShowPointModal(true)}
                    categories={categories}
                    onGoHome={() => { window.location.href = '/'; }}
                    initialTab={mainInitialTab}
                    initialFocusPersonaId={mainFocusPersonaId}
                    initialFocusFeatureKey={mainFocusFeatureKey}
                    recentPersonas={recentPersonas}
                    recentFeatureKeys={recentFeatureKeys}
                    onFeatureSelect={(personaName, featureKey) => {
                        if (featureKey) rememberLastFeature(featureKey);
                        // 웹툰은 activePersona(향기) 컨텍스트가 있어야 뷰어가 뜨므로 먼저 페르소나 활성화.
                        if (featureKey === 'webtoon') {
                            const wp = personas.find(p => p.name === personaName);
                            if (wp) { setActivePersonaId(wp.id); setShowWebtoon(true); }
                            return;
                        }
                        // 타로는 유나 채팅 화면 위 모달 + 카드마다 채팅 전송 → 페르소나 활성화+채팅 진입 선행.
                        if (featureKey === 'tarot') {
                            const tp = personas.find(p => p.name === personaName);
                            if (tp) { goTo('chat'); handlePersonaClick(tp.id); setTarotModalMode('full'); }
                            return;
                        }
                        // 닮은꼴·헤어·프로필사진은 윤채린 컨텍스트(systemInstruction)가 필요 → 페르소나 먼저 활성화 후 보드.
                        if (featureKey === 'lookalike' || featureKey === 'hair' || featureKey === 'outfit') {
                            const fp = personas.find(p => p.name === personaName);
                            if (fp) setActivePersonaId(fp.id);
                            FEATURE_ACTIONS[featureKey]?.();
                            return;
                        }
                        // 전용 보드가 있는 기능(전자책·보험·뉴스 등)은 보드를 바로 연다.
                        if (featureKey && FEATURE_ACTIONS[featureKey]) { FEATURE_ACTIONS[featureKey](); return; }
                        // 그 외(운세 계열 등)는 해당 페르소나 채팅으로 이동.
                        const persona = personas.find(p => p.name === personaName);
                        if (persona) { goTo('chat'); handlePersonaClick(persona.id); }
                    }}
                    isFavorite={isFavorite}
                    onToggleFavorite={toggleFavorite}
                    favoritableKeys={FAVORITABLE_KEYS}
                    isFavoritePersona={isFavoritePersona}
                    onToggleFavoritePersona={toggleFavoritePersona}
                    onShareFeature={(key, label) => shareDeepLink('f', key, label)}
                />
                </AuthProvider>
                {publicTarotData && (
                    <TarotReportView
                        data={publicTarotData}
                        mode="public"
                        onCta={() => setPublicTarotData(null)}
                        onClose={() => setPublicTarotData(null)}
                    />
                )}
                {shareToast && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-[#2D2438] border border-[#8E6FB7]/40 rounded-xl shadow-xl flex items-center gap-2 text-sm text-white">
                        <span className="text-[#C4A9E0]">🔗</span>
                        {shareToast}
                    </div>
                )}
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
                    <UserProfileModal user={user} onClose={() => setShowUserProfile(false)} onUserUpdate={updated => setUser(prev => prev ? { ...prev, ...updated } : prev)} onAccountDeleted={() => { setShowUserProfile(false); handleLogout(); }} onInviteClick={() => { setShowUserProfile(false); setShowInviteModal(true); }} />
                )}
                {showPointModal && (
                    user?.provider === 'guest' ? (
                        <GuestUpgradeModal
                            onSuccess={(u, token) => { handleAuthSuccess(u, token); setShowPointModal(false); }}
                            onClose={() => setShowPointModal(false)}
                        />
                    ) : (
                        <PointModal currentPoints={userPaidPoints + userBonusPoints} userId={user?.id ?? 0} onClose={() => setShowPointModal(false)}
                            onInviteClick={() => { setShowPointModal(false); setShowInviteModal(true); }} />
                    )
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
                {showInsuranceBoard && (
                    <InsuranceBoard onClose={() => setShowInsuranceBoard(false)} onConsult={handleInsuranceConsult} />
                )}
                {showMarketingBoard && (
                    <MarketingBoard onClose={() => setShowMarketingBoard(false)} />
                )}
                {showHomepageBoard && (
                    <HomepageBoard onClose={() => setShowHomepageBoard(false)} />
                )}
                {showShortsMakerBoard && (
                    <ShortsMakerBoard onClose={() => setShowShortsMakerBoard(false)} />
                )}
                {showEbookBoard && (
                    <ErrorBoundary label="전자책 화면 오류" onClose={() => setShowEbookBoard(false)}>
                        <EbookBoard onClose={() => setShowEbookBoard(false)} />
                    </ErrorBoundary>
                )}
                {showWebtoon && activePersona && (
                    <ErrorBoundary label="웹툰 화면 오류" onClose={() => setShowWebtoon(false)}>
                        <WebtoonEpisodeList personaId={activePersona.id} personaName={activePersona.name} onClose={() => setShowWebtoon(false)} />
                    </ErrorBoundary>
                )}
                {showHairBoard && (
                    <ErrorBoundary label="헤어스타일 화면 오류" onClose={() => setShowHairBoard(false)}>
                        <HairStyleBoard personaId={activePersona?.id} onClose={() => setShowHairBoard(false)} />
                    </ErrorBoundary>
                )}
                {showOutfitBoard && (
                    <ErrorBoundary label="프로필 사진 화면 오류" onClose={() => setShowOutfitBoard(false)}>
                        <OutfitBoard personaId={activePersona?.id} onClose={() => setShowOutfitBoard(false)} />
                    </ErrorBoundary>
                )}
                {/* 닮은 연예인 찾기 (윤채린) — 메인 화면 블록에서도 렌더돼야 카드 클릭 시 모달이 뜸 */}
                {showLookalikeModal && (
                    <LookalikeModal
                        personaId={lookalikePersonaId}
                        onResult={r => setLookalikeResult(r)}
                        onPointsUpdated={(paid, bonus) => { setUserPaidPoints(paid); setUserBonusPoints(bonus); }}
                        onClose={() => setShowLookalikeModal(false)}
                    />
                )}
                {lookalikeResult && (
                    <LookalikeResultCard
                        result={lookalikeResult}
                        personaName="윤채린"
                        onClose={() => setLookalikeResult(null)}
                    />
                )}
                {showAgeBoard && (
                    <ErrorBoundary label="나이 변환 화면 오류" onClose={() => setShowAgeBoard(false)}>
                        <AgeTransformBoard personaId={activePersona?.id} onClose={() => setShowAgeBoard(false)} />
                    </ErrorBoundary>
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
                {publicTarotData && (
                    <TarotReportView
                        data={publicTarotData}
                        mode="public"
                        onCta={() => setPublicTarotData(null)}
                        onClose={() => setPublicTarotData(null)}
                    />
                )}
                {shareToast && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#2D2438] border border-[#8E6FB7]/40 rounded-xl shadow-xl flex items-center gap-2 text-sm text-white">
                        <span className="text-[#C4A9E0]">🔗</span>
                        {shareToast}
                    </div>
                )}
                {showInviteModal && <InviteFriendModal onClose={() => setShowInviteModal(false)} personas={visiblePersonas.map(p => ({ id: p.id, name: p.name }))} />}
            </>
        );
    }

    return (
        <>
        {rewardAlert && (
            <RewardAlertModal kind={rewardAlert.kind} amount={rewardAlert.amount} onClose={() => setRewardAlert(null)} />
        )}
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
        <div className="flex h-screen-dvh w-full"
            style={{
                background: `
                    radial-gradient(ellipse 50% 30% at 0% 0%, #F5E6F7 0%, transparent 60%),
                    radial-gradient(ellipse 50% 30% at 100% 100%, #FCEADD 0%, transparent 60%),
                    #FBF8F3
                `,
                fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif",
            }}
        >
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
                <UserProfileModal user={user} onClose={() => setShowUserProfile(false)} onUserUpdate={updated => setUser(prev => prev ? { ...prev, ...updated } : prev)} onAccountDeleted={() => { setShowUserProfile(false); handleLogout(); }} onInviteClick={() => { setShowUserProfile(false); setShowInviteModal(true); }} />
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
            {showInsuranceBoard && (
                <InsuranceBoard onClose={() => setShowInsuranceBoard(false)} onConsult={handleInsuranceConsult} />
            )}
            {showMarketingBoard && (
                <MarketingBoard onClose={() => setShowMarketingBoard(false)} />
            )}
            {showHomepageBoard && (
                <HomepageBoard onClose={() => setShowHomepageBoard(false)} />
            )}
            {showShortsMakerBoard && (
                <ShortsMakerBoard onClose={() => setShowShortsMakerBoard(false)} />
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
                                setActiveQuickMenu(label); // 로딩 멘트 주제 매칭용
                                setQuickMenuLoading(true);
                                quickMenuApi.generate(activePersonaId, prompt)
                                    .then(({ result, paidBalance, bonusBalance }) => {
                                        setUserPaidPoints(paidBalance);
                                        setUserBonusPoints(bonusBalance);
                                        setQuickMenuResult({ title: label, result });
                                    })
                                    .catch(e => alert(quickMenuErrorMessage(e)))
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
                        if (isResultCard && !item.partnerModal && !item.twoPartnerModal && !item.placeholder) {
                            let fullPrompt = item.prompt ?? '';
                            if (birthInfo) {
                                const t = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                                const cal = birthInfo.lunar ? '음력' : '양력';
                                fullPrompt += `\n\n사용자 정보 — 이름: ${birthInfo.name}, 생년월일: ${cal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${t}`;
                            }
                            setActiveQuickMenu(item.label); // 로딩 멘트 주제 매칭용
                            setQuickMenuLoading(true);
                            quickMenuApi.generate(activePersonaId, fullPrompt)
                                .then(({ result, paidBalance, bonusBalance }) => {
                                    setUserPaidPoints(paidBalance);
                                    setUserBonusPoints(bonusBalance);
                                    setQuickMenuResult({ title: item.label, result });
                                })
                                .catch(e => alert(quickMenuErrorMessage(e)))
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
                        // 내 생일(있으면) + 상대 정보 합쳐 결과 카드로 생성
                        let composed = `상대방: ${partner.name}, ${cal} ${partner.year}년 ${partner.month}월 ${partner.day}일${t}. ${pendingPartnerMenu.prompt}`;
                        if (birthInfo) {
                            const mt = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                            const mcal = birthInfo.lunar ? '음력' : '양력';
                            composed += `\n\n나(사용자) 정보 — 이름: ${birthInfo.name}, 생년월일: ${mcal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${mt}`;
                        }
                        const label = pendingPartnerMenu.label;
                        setPendingPartnerMenu(null);
                        runQuickMenuCard(label, composed);
                    }}
                    onClose={() => { setShowPartnerModal(false); setPendingPartnerMenu(null); }}
                />
            )}

            {/* 친구 둘 궁합 — PartnerInfoModal을 친구1→친구2 2번. */}
            {twoPartnerStep > 0 && (
                <PartnerInfoModal
                    key={twoPartnerStep}  // step 바뀌면 입력 초기화
                    title={twoPartnerStep === 1 ? '🤝 첫 번째 친구 정보' : '🤝 두 번째 친구 정보'}
                    onComplete={info => {
                        if (twoPartnerStep === 1) {
                            // 친구1 저장 후 친구2 입력으로
                            setFirstPartner(info);
                            setTwoPartnerStep(2);
                            return;
                        }
                        // 친구2까지 받음 → 프롬프트 합성
                        const fmt = (p: typeof info) => {
                            const t = p.time && p.time !== '모름' ? ` ${p.time}생` : '';
                            const cal = p.lunar ? '음력' : '양력';
                            return `${p.name}(${cal} ${p.year}년 ${p.month}월 ${p.day}일${t})`;
                        };
                        const f1 = firstPartner ? fmt(firstPartner) : '';
                        const f2 = fmt(info);
                        const menu = pendingTwoPartnerMenu;
                        const composed = `친구1: ${f1}, 친구2: ${f2}. ${menu?.prompt ?? ''}`;
                        setTwoPartnerStep(0); setFirstPartner(null); setPendingTwoPartnerMenu(null);
                        runQuickMenuCard(menu?.label ?? '친구 둘 궁합', composed);
                    }}
                    onClose={() => { setTwoPartnerStep(0); setFirstPartner(null); setPendingTwoPartnerMenu(null); }}
                />
            )}

            {/* 관상 분석 업로드 모달 */}
            {/* 🔮 타로 뽑기 — 최소화 칩 상태 유지 위해 완료/닫기 전 언마운트 금지 */}
            {tarotModalMode && (
                <TarotCardModal
                    mode={tarotModalMode}
                    isTyping={currentSession.isTyping}
                    onSend={msg => { tarotAutoSendRef.current = true; setInputText(msg); }}
                    onClose={() => setTarotModalMode(null)}
                    onMakeReport={makeTarotReport}
                />
            )}
            {tarotReport && (
                <TarotReportView
                    data={tarotReport.data}
                    mode="owner"
                    onShare={async () => {
                        if (!tarotReport.id) throw new Error('저장 실패로 공유 불가');
                        const { shareId } = await tarotApi.share(tarotReport.id);
                        const refQs = referralCode ? `&ref=${encodeURIComponent(referralCode)}` : '';
                        return `${window.location.origin}/?tr=${shareId}${refQs}`;
                    }}
                    onClose={() => setTarotReport(null)}
                />
            )}

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

            {/* 손금 분석 업로드 모달 */}
            {showPalmModal && (
                <PalmReadingModal
                    personaId={activePersonaId}
                    onResult={(result, imageUrl, hand) => { setPalmReadingResult({ result, imageUrl, hand }); }}
                    onPointsUpdated={(paid, bonus) => { setUserPaidPoints(paid); setUserBonusPoints(bonus); }}
                    onClose={() => setShowPalmModal(false)}
                />
            )}

            {/* 손금 분석 결과 카드 (전생처럼 봉인→클릭 플립, 맨 위에 올린 사진) */}
            {palmReadingResult && (
                <PalmReadingResultCard
                    result={palmReadingResult.result}
                    imageUrl={palmReadingResult.imageUrl}
                    hand={palmReadingResult.hand}
                    personaName={activePersona?.name ?? ''}
                    onClose={() => setPalmReadingResult(null)}
                />
            )}

            {/* 전자책 만들기 보드 (강지훈) */}
            {showEbookBoard && (
                <ErrorBoundary label="전자책 화면 오류" onClose={() => setShowEbookBoard(false)}>
                    <EbookBoard onClose={() => setShowEbookBoard(false)} />
                </ErrorBoundary>
            )}

            {/* 웹툰 회차 목록 + 뷰어 (향기) */}
            {showWebtoon && activePersona && (
                <ErrorBoundary label="웹툰 화면 오류" onClose={() => setShowWebtoon(false)}>
                    <WebtoonEpisodeList personaId={activePersona.id} personaName={activePersona.name} onClose={() => setShowWebtoon(false)} />
                </ErrorBoundary>
            )}

            {/* 헤어스타일 진단 (윤채린) */}
            {showHairBoard && (
                <ErrorBoundary label="헤어스타일 화면 오류" onClose={() => setShowHairBoard(false)}>
                    <HairStyleBoard personaId={activePersona?.id} onClose={() => setShowHairBoard(false)} />
                </ErrorBoundary>
            )}
            {showOutfitBoard && (
                <ErrorBoundary label="프로필 사진 화면 오류" onClose={() => setShowOutfitBoard(false)}>
                    <OutfitBoard personaId={activePersona?.id} onClose={() => setShowOutfitBoard(false)} />
                </ErrorBoundary>
            )}
            {/* 닮은 연예인 찾기 (윤채린) */}
            {showLookalikeModal && (
                <LookalikeModal
                    personaId={lookalikePersonaId}
                    onResult={r => setLookalikeResult(r)}
                    onPointsUpdated={(paid, bonus) => { setUserPaidPoints(paid); setUserBonusPoints(bonus); }}
                    onClose={() => setShowLookalikeModal(false)}
                />
            )}
            {lookalikeResult && (
                <LookalikeResultCard
                    result={lookalikeResult}
                    personaName={activePersona?.name ?? '윤채린'}
                    onClose={() => setLookalikeResult(null)}
                />
            )}
            {showAgeBoard && (
                <ErrorBoundary label="나이 변환 화면 오류" onClose={() => setShowAgeBoard(false)}>
                    <AgeTransformBoard personaId={activePersona?.id} onClose={() => setShowAgeBoard(false)} />
                </ErrorBoundary>
            )}

            {/* 퀵메뉴 결과 카드 */}
            {quickMenuResult && (
                <QuickMenuResultCard
                    title={quickMenuResult.title}
                    result={quickMenuResult.result}
                    personaName={activePersona?.name ?? ''}
                    bgUrl={activePersona?.faceReadingBgUrl}
                    onClose={() => { setQuickMenuResult(null); setActiveQuickMenu(null); }}
                />
            )}

            {/* 퀵메뉴 로딩 오버레이 — 명리학 감정서 컨셉(팔괘 링 + 주제별 멘트) */}
            {/* 공유 링크로 들어와 기능이 자동 실행됐을 때의 사용법 안내(2026-07-28).
                친구 링크를 타고 처음 온 사람은 채팅창만 보고 "뭘 하라는 거지?" 하고 나간다. */}
            {deepLinkGuide && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center p-4"
                     style={{ background: 'rgba(20,12,30,0.55)', backdropFilter: 'blur(3px)' }}
                     onClick={() => setDeepLinkGuide(null)}>
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-2xl overflow-hidden text-center"
                         style={{ background: '#FFFCF8', boxShadow: '0 24px 64px -12px rgba(80,50,110,0.4)' }}>
                        <div className="px-6 pt-6 pb-5">
                            <h3 className="text-[17px] font-extrabold" style={{ color: '#2D2017' }}>{deepLinkGuide.title}</h3>
                            <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: '#6B5F78' }}>
                                {deepLinkGuide.desc}
                            </p>
                            <button
                                onClick={() => setDeepLinkGuide(null)}
                                className="mt-5 w-full py-3 rounded-full text-[14px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #8E6FB7, #E48BB0)', border: 'none' }}
                            >
                                시작하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {quickMenuLoading && <QuickMenuLoading title={activeQuickMenu ?? ''} />}

            {/* 포인트 모달 — 임시(게스트) 계정이면 충전 대신 정식 전환을 유도 */}
            {showPointModal && (
                user?.provider === 'guest' ? (
                    <GuestUpgradeModal
                        onSuccess={(u, token) => { handleAuthSuccess(u, token); setShowPointModal(false); }}
                        onClose={() => setShowPointModal(false)}
                    />
                ) : (
                    <PointModal currentPoints={userPaidPoints + userBonusPoints} userId={user?.id ?? 0} onClose={() => setShowPointModal(false)} />
                )
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
                                className="w-full object-contain"
                                style={{ maxHeight: '70vh', background: '#0f0a19' }}
                                onError={() => {
                                    const persona = personas.find(p => p.id === introVideoModal.personaId);
                                    if (persona?.imageUrl) {
                                        setIntroVideoModal(prev => prev ? { ...prev, type: 'image', url: persona.imageUrl! } : null);
                                    }
                                }}
                            />
                        ) : (
                            <img src={introVideoModal.url} alt="프로필" className="w-full object-contain" style={{ maxHeight: '70vh', background: '#0f0a19' }} />
                        )}
                        <div className="flex gap-3 justify-center px-5 py-4" style={{ background: 'rgba(15,10,25,0.95)' }}>
                        <button
                            onClick={() => {
                                const id = introVideoModal.personaId;
                                const isGuest = introVideoModal.guestMode;
                                setIntroVideoModal(null);
                                if (isGuest) {
                                    goTo('authPage');
                                } else {
                                    rememberLastPersona(id);
                                    goTo('chat');
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
                                if (!introVideoModal.guestMode) goTo('main');
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
                    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                        <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(15,10,25,0.95)' }}>
                            <span className="text-sm font-medium text-white">{triggerVideoPopup.title || '영상'}</span>
                            <button
                                onClick={() => setTriggerVideoPopup(null)}
                                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            >
                                <Icon name="X" size={20} />
                            </button>
                        </div>
                        <video
                            src={triggerVideoPopup.videoUrl}
                            controls
                            autoPlay
                            className="w-full object-cover"
                            style={{ maxHeight: '65vh' }}
                            onEnded={() => setTriggerVideoPopup(null)}
                        />
                    </div>
                </div>
            )}

            {showBoard ? (
                <BoardPanel user={user} personaId={activePersonaId} onClose={() => setShowBoard(false)} />
            ) : isAdminMode ? (
                <ErrorBoundary label="관리자 화면 오류" onClose={() => setIsAdminMode(false)}>
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
                </ErrorBoundary>
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
                                {/* 첫 화면(=페르소나·기능 둘러보기). 단일화 이후 홈/둘러보기가 같은 main이라 버튼 하나로 통합. */}
                                <button
                                    className="flex items-center gap-1.5 mr-2 rounded-full px-3 py-1.5 text-[#8E6FB7] hover:bg-[#EAD5F2] transition-colors"
                                    style={{ background: '#F5E6F7', border: '1px solid #E4D3EC' }}
                                    onClick={() => { setMainInitialTab('personas'); goTo('main'); }}
                                    title="첫 화면 · 페르소나·기능 둘러보기"
                                >
                                    <Icon name="Home" size={17} />
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
                                        className={`p-2 rounded-xl border border-transparent transition-all ${showHeaderMenu ? 'bg-[#F0E9DE] text-[#2D2438]' : 'bg-transparent text-gray-500 hover:bg-[#F5EFE6] hover:text-[#2D2438]'}`}
                                        title="메뉴"
                                    >
                                        <Icon name="MoreVertical" size={16} />
                                    </button>
                                    {showHeaderMenu && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#F0E9DE] rounded-xl shadow-[0_8px_32px_-8px_rgba(80,50,110,0.18)] z-50 overflow-hidden">
                                            {/* 페르소나 목록 (= 첫 화면. 단일화로 '첫 화면' 항목 중복 제거, 헤더 홈 버튼이 대신함) */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); setMainInitialTab('personas'); goTo('main'); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#5C5468] hover:bg-[#F5EFE6] hover:text-[#2D2438] transition-colors"
                                            >
                                                <Icon name="Users" size={15} className="text-[#8E6FB7]" />
                                                페르소나 목록
                                            </button>
                                            {/* 친구 초대 (강조) */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); setShowInviteModal(true); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors border-t border-[#F0E9DE]"
                                                style={{ color: '#6B4F92', background: 'linear-gradient(90deg, #F7F2FA 0%, #FFFCF8 100%)' }}
                                            >
                                                <span className="text-base leading-none">🎁</span>
                                                친구 초대 +1000P
                                            </button>
                                            {/* 내 정보 */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); setShowUserProfile(true); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#5C5468] hover:bg-[#F5EFE6] hover:text-[#2D2438] transition-colors border-t border-[#F0E9DE]"
                                            >
                                                <Icon name="UserCircle" size={15} className="text-[#8E6FB7]" />
                                                내 정보
                                            </button>
                                            {/* 건의 게시판 */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); setShowBoard(true); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#5C5468] hover:bg-[#F5EFE6] hover:text-[#2D2438] transition-colors"
                                            >
                                                <Icon name="MessageSquare" size={15} className="text-[#8E6FB7]" />
                                                건의 게시판
                                            </button>
                                            {/* 페르소나 공유하기 (?p 딥링크) */}
                                            {activePersona && (
                                                <button
                                                    onClick={() => { setShowHeaderMenu(false); shareDeepLink('p', activePersona.id, activePersona.name); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#5C5468] hover:bg-[#F5EFE6] hover:text-[#2D2438] transition-colors border-t border-[#F0E9DE]"
                                                >
                                                    <Icon name="Share2" size={15} className="text-[#8E6FB7]" />
                                                    이 페르소나 공유하기
                                                </button>
                                            )}
                                            {/* 기억 공유 */}
                                            {activePersona && (
                                                <button
                                                    onClick={() => { setShowHeaderMenu(false); handleToggleMemory(activePersonaId); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#F5EFE6] transition-colors border-t border-[#F0E9DE]"
                                                >
                                                    <Icon name="Brain" size={15} className={isMemoryOn(activePersonaId) ? 'text-[#8E6FB7]' : 'text-gray-400'} />
                                                    <span className={isMemoryOn(activePersonaId) ? 'text-[#8E6FB7]' : 'text-[#5C5468]'}>기억 공유</span>
                                                    <span className={`ml-auto w-1.5 h-1.5 rounded-full ${isMemoryOn(activePersonaId) ? 'bg-[#8E6FB7]' : 'bg-gray-300'}`} />
                                                </button>
                                            )}
                                            {/* 로그아웃 */}
                                            <button
                                                onClick={() => { setShowHeaderMenu(false); handleLogout(); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#C0505A] hover:bg-[#FBEDED] transition-colors border-t border-[#F0E9DE]"
                                            >
                                                <Icon name="LogOut" size={15} className="text-[#C0505A]" />
                                                로그아웃
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        {/* 최근 페르소나 빠른 전환 칩 (현재 페르소나 제외, 사이드바 대체) */}
                        {(() => {
                            const recentOthers = recentPersonaIds
                                .filter(id => id !== activePersonaId)
                                .map(id => visiblePersonas.find(p => p.id === id))
                                .filter((p): p is NonNullable<typeof p> => !!p)
                                .slice(0, 8);
                            if (recentOthers.length === 0) return null;
                            return (
                                <div className="shrink-0 border-b border-[#F0E9DE] bg-white/55 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                        {recentOthers.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handlePersonaClick(p.id)}
                                                className="flex items-center gap-1.5 shrink-0 pl-1 pr-2.5 py-1 rounded-full transition-colors hover:bg-[#EAD5F2]"
                                                style={{ background: '#F5E6F7', border: '1px solid #E4D3EC', color: '#8E6FB7' }}
                                                title={`${p.name}와 대화`}
                                            >
                                                {p.imageUrl ? (
                                                    <img src={p.imageUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <span className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white bg-gradient-to-br ${p.colorClass}`}>
                                                        <Icon name={p.iconName} size={12} />
                                                    </span>
                                                )}
                                                <span className="text-xs font-medium text-[#2D2438] whitespace-nowrap">{p.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {(() => {
                            // 기능 키 → 보드 열기 핸들러는 본체 FEATURE_ACTIONS 재사용(메타는 FEATURE_REGISTRY 단일출처)
                            const standardCards = user
                                ? getPersonaFeatureKeys(activePersona).map(key => {
                                    const meta = FEATURE_BY_KEY[key];
                                    return { icon: meta.icon, label: meta.label, onClick: FEATURE_ACTIONS[key] ?? (() => {}), color: meta.color, bgColor: meta.bgColor, borderColor: meta.borderColor };
                                })
                                : [];
                            // 도결처럼 quickMenuJson을 쓰는 페르소나: 퀵메뉴는 텍스트 칩으로(메뉴 많음).
                            // 표준 기능(서아·윤채원 등 1~2개)은 기존 아이콘 카드 유지.
                            const quickMenuChips = (() => {
                                if (!user || !activePersona?.quickMenuJson) return [];
                                let cfg: { menus?: QuickMenuItem[]; useBirthInfo?: boolean } = {};
                                try { cfg = JSON.parse(activePersona.quickMenuJson); } catch { return []; }
                                if (!cfg.menus?.length) return [];
                                return cfg.menus.map(menu => ({
                                    label: menu.label, // 이모지 포함 원본 라벨
                                    onClick: () => handleQuickMenuSelect(menu, !!cfg.useBirthInfo),
                                }));
                            })();
                            if (activeImages.length > 0) {
                                return <PersonaImageViewer images={activeImages} onSelectMain={handleSwitchImage} userXp={user?.personaXp?.[activePersonaId] ?? 0} newUi={true} featureCards={standardCards} featureChips={quickMenuChips} />;
                            }
                            // ★갤러리 사진이 없는 페르소나(유나 등)도 퀵메뉴·기능 카드는 보여야 함
                            //   (종전엔 사진 있는 페르소나만 렌더돼 퀵메뉴가 숨는 커플링 버그, 2026-07-06)
                            if (standardCards.length === 0 && quickMenuChips.length === 0) return null;
                            return (
                                <div className="px-4 py-2.5 shrink-0 border-b border-[#F0E9DE] bg-white/60 backdrop-blur-sm">
                                    <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
                                        {standardCards.map((c, i) => (
                                            <button key={`f${i}`} onClick={c.onClick}
                                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap"
                                                style={{ color: c.color, background: c.bgColor, borderColor: c.borderColor }}>
                                                <Icon name={c.icon} size={13} />{c.label}
                                            </button>
                                        ))}
                                        {quickMenuChips.map((c, i) => (
                                            <button key={`q${i}`} onClick={c.onClick}
                                                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#B49AC9] bg-[#F5E6F7] text-[#8E6FB7] hover:bg-[#E5D5F2] transition-colors whitespace-nowrap">
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
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
                                    <h3 className="text-2xl font-bold text-[#2D2438] mb-3">{activePersona.name}</h3>
                                    <p className="text-[#5C5468] max-w-md mb-6 text-lg">{activePersona.description}</p>
                                </div>
                            ) : (
                                <div className="max-w-4xl mx-auto">
                                    {currentSession.hasMoreMessages && (
                                        <div className="flex justify-center mb-4">
                                            <button
                                                onClick={handleLoadMoreMessages}
                                                className="text-sm text-[#5C5468] hover:text-[#2D2438] bg-white/70 hover:bg-white border border-[#F0E9DE] px-4 py-2 rounded-full transition-colors"
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
                            {/* 퀵메뉴 버튼 (하단) — 이미지가 있으면 상단 기능카드로 표시되므로 하단은 폴백(이미지 없을 때만) */}
                            {activeImages.length === 0 && (() => {
                                if (!activePersona?.quickMenuJson) return null;
                                let config: { menus?: { label: string; prompt?: string; featured?: boolean; placeholder?: string; partnerModal?: boolean; faceModal?: boolean; palmModal?: boolean; resultCard?: boolean; subMenu?: SubMenuConfig }[]; useBirthInfo?: boolean } = {};
                                try { config = JSON.parse(activePersona.quickMenuJson); } catch { return null; }
                                if (!config.menus?.length) return null;
                                // 컴포넌트 레벨 핸들러 재사용(상단 아이콘과 동일 동작). config.useBirthInfo 전달.
                                const handleMenuSelect = (menu: QuickMenuItem) => handleQuickMenuSelect(menu, !!config.useBirthInfo);
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
                                                className="text-xs px-3 py-1.5 rounded-full cursor-pointer focus:outline-none transition-all"
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
            {showInviteModal && <InviteFriendModal onClose={() => setShowInviteModal(false)} currentPersonaName={activePersona?.name} personas={visiblePersonas.map(p => ({ id: p.id, name: p.name }))} />}
        </div>
        </>
    );
};

// 🔌 임베드 위젯 모드(?embed=<personaId|이름>): 외부 사이트 iframe 전용 슬림 채팅.
// AppContent(훅 수십 개) 진입 전에 분기해 훅 순서·무게 문제를 피한다.
const EMBED_KEY = new URLSearchParams(window.location.search).get('embed');

// 🤖 AI상담 봇 페이지(/consult/{slug}): 발급 링크 전용 전체화면(아바타+마스터 Typebot)
const CONSULT_SLUG = window.location.pathname.match(/^\/consult\/([a-z0-9-]{3,40})\/?$/)?.[1] ?? null;

// 📚 학습자료 — 강의장 QR/주소 직접 접속용 전체화면(비회원은 각 페이지가 가입 유도).
// /learn=시리즈 목록 · /learn/homepage=1편(기존 주소 유지: QR·기능카드·박하진 채팅이 전부 이걸 가리킴)
// · /learn/homepage/2=2편(1편 합격자만). 정적 시안(/learn/designs/*.html)은 파일시스템 우선이라 안 걸림.
// ★ 뒤 슬래시만 제거(빈 문자열로 만들지 말 것) — '/'→'' 후 '|| /learn'이 붙으면
//   메인 페이지가 학습자료로 둔갑한다(2026-07-17 실장애). 루트는 정규식이 안 걸리게 원형 유지.
const LEARN_PATH = window.location.pathname.replace(/(.)\/+$/, '$1');
const IS_LEARN_INDEX = /^\/learn$/.test(LEARN_PATH);
const IS_LEARN_1 = /^\/learn\/homepage$/.test(LEARN_PATH);
const IS_LEARN_2 = /^\/learn\/homepage\/2$/.test(LEARN_PATH);

const App: React.FC = () => (
    EMBED_KEY ? <EmbedChat personaKey={EMBED_KEY} /> :
    CONSULT_SLUG ? <ConsultPage slug={CONSULT_SLUG} /> :
    IS_LEARN_INDEX ? <LearnIndex /> :
    IS_LEARN_1 ? <LearnPage /> :
    IS_LEARN_2 ? <LearnPage2 /> :
    <PointsProvider>
        <AppContent />
    </PointsProvider>
);

export default App;
