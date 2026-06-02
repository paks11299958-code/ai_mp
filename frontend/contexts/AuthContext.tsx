import React, { createContext, useContext, ReactNode } from 'react';
import { User } from '../types';

/**
 * 인증 정보 소비용 Context (#4 prop drilling 제거).
 *
 * 배경: #1에서 useAuth 훅이 user/로그인/로그아웃을 이미 분리했으나, 자식
 * 컴포넌트(MainPageNew→ChatRail, Sidebar, LandingPageNew)에는 여전히 user/
 * onLogout/onAdminClick을 prop으로 내려보내고 있었음(App→MainPage→ChatRail 2단계
 * 드릴). 이를 Context로 대체해 중간 전달을 없앤다.
 *
 * 설계: 본 Context는 **상태를 소유하지 않는다**. App(AppContent)이 useAuth로 이미
 * 보유한 값을 Provider value로 게시(publish)하기만 한다. 진입 라우팅 플래그
 * (showHero/showMain 등 App 렌더 로직 결합)는 App에 그대로 남는다.
 *
 * ⚠️ onAdminClick은 의도적으로 제외한다: 렌더 분기마다 화면 전환 부수효과가 달라서
 * (Hero에서 클릭 → setShowHero(false)+adminLogin / Main에서 → setShowMain(false)+
 * adminLogin / 채팅뷰 → adminLogin) 단일 Context 값으로 묶으면 화면별 동작이 깨진다.
 * 따라서 onAdminClick은 prop으로 유지. 균일한 user/isAdmin/onLogout만 노출한다.
 */
interface AuthContextValue {
    user: User | null;
    isAdmin: boolean;
    onLogout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
}
