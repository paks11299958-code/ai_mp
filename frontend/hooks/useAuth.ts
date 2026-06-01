import { useState, useEffect } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';

/**
 * 인증/진입 상태 훅 (App.tsx #1 분해 — T4).
 *
 * 소유 범위:
 * - user/setUser (앱 전역에서 참조), isAuthChecking
 * - 진입 화면 플래그: showAuthModal / showAuthPage / showMain / showHero
 * - 카카오 신규가입 닉네임 모달: kakaoNicknameModal
 * - 카카오 OAuth 콜백 처리 effect (kakao_login/kakao_code/kakao_error)
 * - 토큰 기반 자동 로그인 확인 effect (authApi.me)
 * - handleAuthSuccess / handleLogout
 *
 * ⚠️ 동작 보존 주의(원본 App.tsx와 동일해야 함):
 * - 카카오 콜백 effect와 토큰 확인 effect는 둘 다 mount 1회([]) 실행.
 *   원본에서 토큰 확인은 personas/categories/settings 로드와 한 effect에
 *   묶여 있었으나, auth 부분만 별도 effect로 분리해도 deps가 동일([])이라
 *   타이밍 의미는 같다(나머지 로드는 본체에 그대로 남김).
 * - handleAdminLogin은 isAdminMode(본체 소유)에 의존하므로 본체에 남긴다.
 * - 포인트/birthInfo 등 user 파생 effect는 세션 관심사라 본체에 남긴다.
 */
export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [kakaoNicknameModal, setKakaoNicknameModal] = useState<{ token: string; defaultNickname: string } | null>(null);
    const [showAuthPage, setShowAuthPage] = useState(false);
    const [showMain, setShowMain] = useState(false);
    // 뉴UI: 로그인 후 히어로 페이지 표시 여부
    const [showHero, setShowHero] = useState(false);

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

    // 토큰 기반 자동 로그인 확인
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setIsAuthChecking(false); return; }
        authApi.me()
            .then(({ user }) => { setUser(user); setShowHero(true); })
            .catch(() => localStorage.removeItem('token'))
            .finally(() => setIsAuthChecking(false));
    }, []);

    const handleAuthSuccess = (_loggedInUser: User, token: string) => {
        localStorage.setItem('token', token);
        window.location.reload();
    };

    const handleLogout = async () => {
        await authApi.logout();
        localStorage.removeItem('token');
        window.location.reload();
    };

    return {
        user, setUser,
        isAuthChecking,
        showAuthModal, setShowAuthModal,
        kakaoNicknameModal, setKakaoNicknameModal,
        showAuthPage, setShowAuthPage,
        showMain, setShowMain,
        showHero, setShowHero,
        handleAuthSuccess,
        handleLogout,
    };
}
