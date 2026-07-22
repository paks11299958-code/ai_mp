import { useState } from 'react';

/**
 * 기능 보드/다이얼로그 표시 토글 모음 훅 (App.tsx #1 분해 — T2).
 *
 * App.tsx에 흩어져 있던 15개의 자족적 show* boolean을 한 곳으로 모은다.
 * 각 토글은 서로 독립적이고 부수효과가 없어 단순 useState 묶음으로 충분하다.
 * 호출부 호환을 위해 기존과 동일한 이름의 값/세터를 그대로 반환한다
 * (본체에서 구조분해하면 기존 코드 변경 0).
 *
 * 범위 제외(다른 단계 소관):
 * - 인증 진입: showAuthModal/showAuthPage/showMain/showHero → T4 useAuth
 * - 퀵메뉴 모달: showBirthModal/showPartnerModal/showFaceModal → T5 useQuickMenu
 * - 공지: showAnnouncementModal → T3 useAnnouncements
 * - showHeaderMenu 등 UI 잡상태는 본체 유지
 */
export function useBoardToggles() {
    const [showBoard, setShowBoard] = useState(false);
    const [showPartnerBoard, setShowPartnerBoard] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [showStockAnalysis, setShowStockAnalysis] = useState(false);
    const [showHotKeyword, setShowHotKeyword] = useState(false);
    const [showResearch, setShowResearch] = useState(false);
    const [showProductExtract, setShowProductExtract] = useState(false);
    const [showGolfReserve, setShowGolfReserve] = useState(false);
    const [showUsedItem, setShowUsedItem] = useState(false);
    const [showLuxuryBoard, setShowLuxuryBoard] = useState(false);
    const [showInsuranceBoard, setShowInsuranceBoard] = useState(false);
    const [showTodayNews, setShowTodayNews] = useState(false);
    const [showSwingBoard, setShowSwingBoard] = useState(false);
    const [showSwingInput, setShowSwingInput] = useState(false);
    const [showMathTutor, setShowMathTutor] = useState(false);
    const [showClubBoard, setShowClubBoard] = useState(false);
    const [showMarketingBoard, setShowMarketingBoard] = useState(false);
    const [showHomepageBoard, setShowHomepageBoard] = useState(false);
    const [showShortsMakerBoard, setShowShortsMakerBoard] = useState(false);

    return {
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
    };
}
