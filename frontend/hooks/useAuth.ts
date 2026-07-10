import { useState, useEffect } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';

/**
 * 진입 화면 상태. 한 번에 하나의 화면만 활성이므로 누락/이중 화면이 구조적으로 불가능.
 * (단일화: 옛 'guest'/'hero' 랜딩을 없애고 모든 진입을 'main'으로 일원화)
 * - 'authPage' : 회원가입 전체화면(비로그인)
 * - 'main'     : 첫 화면 = 페르소나/기능 둘러보기(MainPageNew)
 * - 'chat'     : 채팅 화면
 */
export type Screen = 'authPage' | 'main' | 'chat';

/**
 * 인증/진입 상태 훅 (App.tsx #1 분해 — T4, ① reload 제거 리팩토링).
 *
 * 소유 범위:
 * - user/setUser (앱 전역에서 참조), isAuthChecking
 * - 진입 화면 단일 상태: screen + goTo() (authPage/main/chat — 옛 guest/hero 통합 후)
 * - 카카오 OAuth 콜백 처리 effect (kakao_login/kakao_code/kakao_error)
 *   — 신규/기존 구분 없이 즉시 로그인(서버가 유효 JWT 발급, 닉네임 모달 제거됨)
 * - 토큰 기반 자동 로그인 확인 effect (authApi.me)
 * - handleAuthSuccess (로그인 성공 → 상태 전환, reload 없음)
 *
 * ⚠️ reload 제거(① 리팩토링): 로그인/로그아웃/카카오 모두 window.location.reload()를
 *   상태 전환으로 교체. 로그아웃 시 user 외 세션/포인트/어드민 등 본체 상태 리셋이
 *   필요하므로, 로그아웃 자체는 App 본체에서 onResetAll 콜백과 함께 조립한다
 *   (이 훅은 user/screen/token만 책임). → resetAuth() 제공.
 */
export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    // 통합 메인: 옛 guest/hero 화면을 없애고 모든 진입을 main(MainPageNew)으로 일원화.
    // ?login=1 (학습자료 게이트 등 외부 페이지의 로그인 유도) → 비로그인일 때만 로그인 화면으로 직행.
    const [screen, setScreen] = useState<Screen>(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('login') === '1') {
            params.delete('login');
            const qs = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
            if (!localStorage.getItem('token')) return 'authPage';
        }
        return 'main';
    });

    const goTo = (next: Screen) => setScreen(next);

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
                            // 신규/기존 구분 없이 즉시 로그인 — 서버가 이미 유효 JWT를 발급함.
                            // 신규 가입자도 카카오 닉네임을 그대로 사용하고 바로 hero 진입(닉네임 변경은 '내 정보'에서).
                            localStorage.setItem('token', data.token);
                            authApi.me()
                                .then(({ user }) => { setUser(user); goTo('main'); })
                                .catch(() => localStorage.removeItem('token'));
                        }
                    })
                    .catch(() => alert('카카오 로그인에 실패했습니다.'));
            }
        }
        if (params.get('kakao_error') === '1') {
            window.history.replaceState({}, '', window.location.pathname);
            alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
        }
    }, []);

    // 토큰 기반 자동 로그인 확인
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setIsAuthChecking(false); return; }
        authApi.me()
            .then(({ user }) => { setUser(user); goTo('main'); })
            .catch(() => localStorage.removeItem('token'))
            .finally(() => setIsAuthChecking(false));
    }, []);

    // 이메일 로그인 성공 → reload 대신 상태 전환. user는 me() 응답을 그대로 신뢰.
    const handleAuthSuccess = (loggedInUser: User, token: string) => {
        localStorage.setItem('token', token);
        setUser(loggedInUser);
        goTo('main');
    };

    // 토큰/user 제거 + guest 화면. (세션/포인트 등 본체 상태 리셋은 App의 handleLogout에서 조립)
    const resetAuth = () => {
        localStorage.removeItem('token');
        setUser(null);
        setShowAuthModal(false);
        goTo('main');
    };

    return {
        user, setUser,
        isAuthChecking,
        showAuthModal, setShowAuthModal,
        screen, goTo,
        handleAuthSuccess,
        resetAuth,
    };
}
