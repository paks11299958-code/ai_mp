import React, { useEffect, useState } from 'react';

/**
 * "바탕화면에 추가" 버튼.
 * - 안드로이드(크롬 등): beforeinstallprompt를 잡아 클릭 시 설치 팝업 표시.
 *   이벤트는 페이지 로드 직후 1회만 발생하므로 index.tsx에서 전역(window.__deferredInstallPrompt)으로
 *   미리 잡아두고, 여기서는 그 보관본을 우선 사용한다(서아 채팅 등 늦게 열려도 놓치지 않음).
 * - 아이폰(사파리): 정책상 코드 설치 불가 → 추가할 주소 + 직접 추가하는 방법 안내.
 * - 이미 설치되어 standalone으로 실행 중이면 버튼을 숨긴다.
 */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const NEWS_URL = 'aichat.dbzone.kr/news';
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

export const InstallNewsButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const [, force] = useState(0);
    const [showGuide, setShowGuide] = useState(false);
    const [copied, setCopied] = useState(false);
    const [hidden, setHidden] = useState(isStandalone());

    useEffect(() => {
        const onAvailable = () => force(n => n + 1); // 전역 이벤트 도착 시 리렌더
        const onInstalled = () => setHidden(true);
        window.addEventListener('pwa-install-available', onAvailable);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('pwa-install-available', onAvailable);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    if (hidden) return null;

    const getDeferred = (): BIPEvent | null => (window as any).__deferredInstallPrompt ?? null;

    const handleClick = async () => {
        const deferred = getDeferred();
        if (deferred) {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            (window as any).__deferredInstallPrompt = null;
            if (choice.outcome === 'accepted') setHidden(true);
            return;
        }
        // 설치 이벤트가 없으면(iOS, 또는 이미 설치/미충족) 안내
        setShowGuide(true);
    };

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText('https://' + NEWS_URL);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard 권한 없으면 무시 */ }
    };

    return (
        <>
            <button
                onClick={handleClick}
                title="바탕화면에 추가"
                style={compact ? {
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '4px 9px', borderRadius: 999,
                    border: '1px solid #B49AC9', background: '#F5E6F7', color: '#6E5DA3',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                } : {
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 999,
                    border: '1px solid #B49AC9', background: '#F5E6F7', color: '#6E5DA3',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
            >
                <span style={{ fontSize: compact ? 12 : 15 }}>📲</span>{compact ? '추가' : ' 바탕화면에 추가'}
            </button>

            {showGuide && (
                <div
                    onClick={() => setShowGuide(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(45,37,32,0.6)', padding: 24,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: 18, padding: '26px 22px', maxWidth: 360, width: '100%',
                            textAlign: 'center', fontFamily: '"Noto Serif KR", system-ui, sans-serif',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#2D2438', marginBottom: 6 }}>
                            오늘뉴스 바로가기 만들기
                        </h3>

                        {/* 추가할 주소 + 복사 */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                            background: '#F5E6F7', border: '1px solid #E0D2EC', borderRadius: 10,
                            padding: '9px 12px', margin: '14px 0 18px',
                        }}>
                            <span style={{ fontSize: 13, color: '#6E5DA3', fontWeight: 700, wordBreak: 'break-all', textAlign: 'left' }}>
                                {NEWS_URL}
                            </span>
                            <button
                                onClick={copyUrl}
                                style={{
                                    flexShrink: 0, padding: '6px 12px', borderRadius: 8, border: 'none',
                                    background: copied ? '#6E5DA3' : '#8E6FB7', color: '#fff',
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                }}
                            >
                                {copied ? '복사됨 ✓' : '주소 복사'}
                            </button>
                        </div>

                        {isIOS() ? (
                            <ol style={{ textAlign: 'left', fontSize: 14, color: '#5B5169', lineHeight: 1.9, paddingLeft: 18 }}>
                                <li>위 주소를 <b>사파리</b>에서 열어요</li>
                                <li>화면 아래 <b>공유 버튼</b>(⬆️)을 눌러요</li>
                                <li><b>"홈 화면에 추가"</b>를 선택해요</li>
                                <li>오른쪽 위 <b>"추가"</b>를 누르면 끝!</li>
                            </ol>
                        ) : (
                            <ol style={{ textAlign: 'left', fontSize: 14, color: '#5B5169', lineHeight: 1.9, paddingLeft: 18 }}>
                                <li>위 주소를 <b>크롬</b>에서 열어요</li>
                                <li>오른쪽 위 <b>메뉴(⋮)</b>를 눌러요</li>
                                <li><b>"홈 화면에 추가"</b>를 선택해요</li>
                                <li><b>"추가"</b>를 누르면 끝!</li>
                            </ol>
                        )}
                        <button
                            onClick={() => setShowGuide(false)}
                            style={{
                                marginTop: 20, padding: '11px 28px', borderRadius: 999, border: 'none',
                                background: 'linear-gradient(135deg, #8E6FB7, #6E5DA3)', color: '#fff',
                                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
