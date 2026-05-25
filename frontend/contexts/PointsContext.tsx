import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { pointApi } from '../services/pointService';

interface PointsContextValue {
    paidPoints: number;
    bonusPoints: number;
    totalPoints: number;
    showPointModal: boolean;
    showPointDashboard: boolean;
    levelUpInfo: { newStage: number; levelupBonus: number } | null;
    setShowPointModal: (v: boolean) => void;
    setShowPointDashboard: (v: boolean) => void;
    setPaidPoints: (v: number) => void;
    setBonusPoints: (v: number) => void;
    setLevelUpInfo: (v: { newStage: number; levelupBonus: number } | null) => void;
    refreshBalance: () => Promise<void>;
}

const PointsContext = createContext<PointsContextValue | null>(null);

export function PointsProvider({ children }: { children: ReactNode }) {
    const [paidPoints, setPaidPoints] = useState(0);
    const [bonusPoints, setBonusPoints] = useState(0);
    const [showPointModal, setShowPointModal] = useState(false);
    const [showPointDashboard, setShowPointDashboard] = useState(false);
    const [levelUpInfo, setLevelUpInfo] = useState<{ newStage: number; levelupBonus: number } | null>(null);

    const refreshBalance = useCallback(async () => {
        const d = await pointApi.getBalance();
        setPaidPoints(d.paidPoints);
        setBonusPoints(d.bonusPoints);
    }, []);

    return (
        <PointsContext.Provider value={{
            paidPoints,
            bonusPoints,
            totalPoints: paidPoints + bonusPoints,
            showPointModal,
            showPointDashboard,
            levelUpInfo,
            setShowPointModal,
            setShowPointDashboard,
            setPaidPoints,
            setBonusPoints,
            setLevelUpInfo,
            refreshBalance,
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
