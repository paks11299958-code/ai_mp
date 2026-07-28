import { useState, useEffect, useRef } from 'react';
import { userProfileApi, FaceReadingResult, PalmReadingResult } from '../services/apiService';
import { BirthInfo } from '../components/BirthInfoModal';
import { SubMenuConfig } from '../components/SubMenuModal';
import { Persona, User } from '../types';

/**
 * 퀵메뉴/생년월일/관상/서브메뉴 표시 상태 훅 (App.tsx #1 분해 — T5, 상태만 추출).
 *
 * 소유 범위(순수 상태 + 로드 effect):
 * - birthInfo, isBirthInfoLoaded, showBirthModal
 * - pendingQuickMenu, quickMenuResult, quickMenuLoading
 * - inputPlaceholder, activeQuickMenu
 * - showPartnerModal, pendingPartnerMenu
 * - showFaceModal, faceReadingResult, subMenuConfig
 * - birthModalSkippedRef (자동 모달 1회 스킵 추적 — 본체 onClose도 사용하므로 노출)
 * - 로그인 후 birthInfo 로드 effect / 채팅 진입 시 자동 생년월일 모달 effect
 *
 * ⚠️ 의도적으로 본체에 남긴 것(세션/입력 결합 — T6 영역):
 * - triggerQuickMenu(sessions 의존), handleSubItem(inputText/textareaRef 의존)
 * - BirthInfoModal/SubMenuModal/PartnerInfoModal/FaceReadingModal의 onComplete/onSelect
 *   핸들러(quickMenuApi 호출 + setInputText + 포인트 setter + setSessions 등)
 *   → 본체에서 아래 상태 setter들을 그대로 호출. 동작 변경 없음.
 *
 * effect 의존성(user/activePersonaId/personas)은 인자로 주입받아 원본 deps를 그대로 보존.
 */
/**
 * @param suppressAutoBirthModal 공유 딥링크(?f=·?p=)로 도착했을 때 true.
 *   도결 선생처럼 useBirthInfo인 페르소나는 채팅 진입만으로 명부(생년월일) 모달이 자동으로
 *   뜨는데, 친구 링크를 타고 "꿈해몽 해봐"를 보고 온 사람에게 이름·생년월일부터 물으면
 *   목적지에 닿기 전에 이탈한다. 해몽처럼 명부가 필요 없는 기능도 있으므로, 딥링크 진입
 *   시엔 자동 노출을 막고 정말 필요한 메뉴(운세·재물 등 resultCard)에서만 뜨게 한다.
 */
export function useQuickMenu(user: User | null, activePersonaId: string, personas: Persona[], suppressAutoBirthModal = false) {
    const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(null);
    const [showBirthModal, setShowBirthModal] = useState(false);
    const [pendingQuickMenu, setPendingQuickMenu] = useState<{ label: string; prompt: string; resultCard?: boolean } | null>(null);
    const [quickMenuResult, setQuickMenuResult] = useState<{ title: string; result: string } | null>(null);
    const [quickMenuLoading, setQuickMenuLoading] = useState(false);
    const [inputPlaceholder, setInputPlaceholder] = useState<string | null>(null);
    const [activeQuickMenu, setActiveQuickMenu] = useState<string | null>(null);
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [pendingPartnerMenu, setPendingPartnerMenu] = useState<{ label: string; prompt: string } | null>(null);
    // 친구 둘 궁합 — PartnerInfoModal을 친구1→친구2 2번 띄운다. step 1=친구1, 2=친구2.
    const [twoPartnerStep, setTwoPartnerStep] = useState<0 | 1 | 2>(0);
    const [firstPartner, setFirstPartner] = useState<BirthInfo | null>(null);
    const [pendingTwoPartnerMenu, setPendingTwoPartnerMenu] = useState<{ label: string; prompt: string } | null>(null);
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [faceReadingResult, setFaceReadingResult] = useState<FaceReadingResult | null>(null);
    const [showPalmModal, setShowPalmModal] = useState(false);
    const [palmReadingResult, setPalmReadingResult] = useState<{ result: PalmReadingResult; imageUrl: string | null; hand: 'left' | 'right' } | null>(null);
    const [subMenuConfig, setSubMenuConfig] = useState<SubMenuConfig | null>(null);
    const [isBirthInfoLoaded, setIsBirthInfoLoaded] = useState(false);
    const birthModalSkippedRef = useRef<Set<string>>(new Set());

    // 로그인 후 birth info 로드
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
        if (suppressAutoBirthModal) return; // 딥링크 진입 — 목적지 먼저, 명부는 필요할 때만
        if (!activePersonaId || !isBirthInfoLoaded || birthInfo) return;
        if (birthModalSkippedRef.current.has(activePersonaId)) return;
        const persona = personas.find(p => p.id === activePersonaId);
        if (!persona?.quickMenuJson) return;
        try {
            const config = JSON.parse(persona.quickMenuJson);
            if (config.useBirthInfo) setShowBirthModal(true);
        } catch {}
    }, [activePersonaId, isBirthInfoLoaded, birthInfo, personas, suppressAutoBirthModal]);

    return {
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
    };
}
