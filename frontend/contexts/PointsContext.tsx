import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { pointApi } from '../services/pointService';

interface PointsContextValue {
    paidPoints: number;
    bonusPoints: number;
    totalPoints: number;
    menuPrices: Record<string, number>;
    showPointModal: boolean;
    showPointDashboard: boolean;
    levelUpInfo: { newStage: number; levelupBonus: number } | null;
    setShowPointModal: (v: boolean) => void;
    setShowPointDashboard: (v: boolean) => void;
    setPaidPoints: (v: number) => void;
    setBonusPoints: (v: number) => void;
    setLevelUpInfo: (v: { newStage: number; levelupBonus: number } | null) => void;
    refreshBalance: () => Promise<void>;
    priceOf: (feature: string) => number | null;
    // 잔액이 단가보다 적으면 충전 모달을 띄우고 false 반환(실행 차단). 충분하면 true.
    requirePoints: (feature: string) => boolean;
}

const PointsContext = createContext<PointsContextValue | null>(null);

export function PointsProvider({ children }: { children: ReactNode }) {
    const [paidPoints, setPaidPoints] = useState(0);
    const [bonusPoints, setBonusPoints] = useState(0);
    const [menuPrices, setMenuPrices] = useState<Record<string, number>>({});
    const [showPointModal, setShowPointModal] = useState(false);
    const [showPointDashboard, setShowPointDashboard] = useState(false);
    const [levelUpInfo, setLevelUpInfo] = useState<{ newStage: number; levelupBonus: number } | null>(null);

    const refreshBalance = useCallback(async () => {
        const d = await pointApi.getBalance();
        setPaidPoints(d.paidPoints);
        setBonusPoints(d.bonusPoints);
    }, []);

    // 기능별 단가 1회 로드(어드민에서 바뀔 수 있으나 세션 중엔 거의 불변, 가벼운 캐시)
    useEffect(() => {
        pointApi.getMenuPrices().then(d => setMenuPrices(d.prices || {})).catch(() => {});
    }, []);

    const priceOf = useCallback(
        (feature: string): number | null => (feature in menuPrices ? menuPrices[feature] : null),
        [menuPrices],
    );

    const requirePoints = useCallback((feature: string): boolean => {
        const cost = menuPrices[feature];
        // 단가 정보가 아직 없으면(로딩 실패 등) 막지 않음 — 서버의 402 사후 처리에 위임
        if (cost === undefined) return true;
        if (paidPoints + bonusPoints < cost) {
            setShowPointModal(true);
            return false;
        }
        return true;
    }, [menuPrices, paidPoints, bonusPoints]);

    return (
        <PointsContext.Provider value={{
            paidPoints,
            bonusPoints,
            totalPoints: paidPoints + bonusPoints,
            menuPrices,
            showPointModal,
            showPointDashboard,
            levelUpInfo,
            setShowPointModal,
            setShowPointDashboard,
            setPaidPoints,
            setBonusPoints,
            setLevelUpInfo,
            refreshBalance,
            priceOf,
            requirePoints,
        }}>
            {children}
        </PointsContext.Provider>
    );
}

export function usePoints(): PointsContextValue {
    const ctx = useContext(PointsContext);
    if (!ctx) throw new Error('usePoints must be used within PointsProvider');
    return ctx;
}
