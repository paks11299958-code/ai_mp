import { useState, useEffect } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';

/**
 * 진입 화면 상태. 4개 boolean(showAuthPage/showMain/showHero + default chat)을
 * 단일 상태로 통합 — 한 번에 하나의 화면만 활성이므로 누락/이중 화면이 구조적으로 불가능.
 * - 'guest'    : 비로그인 랜딩
 * - 'authPage' : 회원가입 전체화면(비로그인)
 * - 'hero'     : 로그인 후 랜딩(Hero)
 * - 'main'     : 페르소나/기능 둘러보기(MainPageNew)
 * - 'chat'     : 채팅 화면(default)
 */
export type Screen = 'guest' | 'authPage' | 'hero' | 'main' | 'chat';

/**
 * 인증/진입 상태 훅 (App.tsx #1 분해 — T4, ① reload 제거 리팩토링).
 *
 * 소유 범위:
 * - user/setUser (앱 전역에서 참조), isAuthChecking
 * - 진입 화면 단일 상태: screen + goTo() (이전 showAuthPage/showMain/showHero 통합)
 * - 카카오 신규가입 닉네임 모달: kakaoNicknameModal
 * - 카카오 OAuth 콜백 처리 effect (kakao_login/kakao_code/kakao_error)
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
    const [kakaoNicknameModal, setKakaoNicknameModal] = useState<{ token: string; defaultNickname: string } | null>(null);
    const [screen, setScreen] = useState<Screen>('guest');

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
                            localStorage.setItem('token', data.token);
                            if (data.isNewUser) {
                                // 신규 가입: 닉네임 설정 모달 표시 (완료 시 본체에서 me() 재조회 → hero)
                                setKakaoNicknameModal({ token: data.token, defaultNickname: data.kakaoNickname || '' });
                            } else {
                                // 기존 회원: 토큰으로 즉시 me() 조회 후 hero 진입 (reload 대신)
                                authApi.me()
                                    .then(({ user }) => { setUser(user); goTo('hero'); })
                                    .catch(() => localStorage.removeItem('token'));
                            }
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
            .then(({ user }) => { setUser(user); goTo('hero'); })
            .catch(() => localStorage.removeItem('token'))
            .finally(() => setIsAuthChecking(false));
    }, []);

    // 이메일 로그인 성공 → reload 대신 상태 전환. user는 me() 응답을 그대로 신뢰.
    const handleAuthSuccess = (loggedInUser: User, token: string) => {
        localStorage.setItem('token', token);
        setUser(loggedInUser);
        goTo('hero');
    };

    // 토큰/user 제거 + guest 화면. (세션/포인트 등 본체 상태 리셋은 App의 handleLogout에서 조립)
    const resetAuth = () => {
        localStorage.removeItem('token');
        setUser(null);
        setShowAuthModal(false);
        setKakaoNicknameModal(null);
        goTo('guest');
    };

    return {
        user, setUser,
        isAuthChecking,
        showAuthModal, setShowAuthModal,
        kakaoNicknameModal, setKakaoNicknameModal,
        screen, goTo,
        handleAuthSuccess,
        resetAuth,
    };
}
