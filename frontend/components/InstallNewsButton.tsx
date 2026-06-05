import React, { useEffect, useState } from 'react';

/**
 * "바탕화면에 추가" 버튼.
 * - 안드로이드(크롬 등): beforeinstallprompt를 잡아두었다가 클릭 시 설치 팝업 표시.
 * - 아이폰(사파리): 정책상 코드로 설치 불가 → 직접 추가하는 방법 안내 팝업.
 * - 이미 설치되어 standalone으로 실행 중이면 버튼을 숨긴다.
 */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

export const InstallNewsButton: React.FC = () => {
    const [deferred, setDeferred] = useState<BIPEvent | null>(null);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [hidden, setHidden] = useState(isStandalone());

    useEffect(() => {
        const onBIP = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BIPEvent);
        };
        const onInstalled = () => setHidden(true);
        window.addEventListener('beforeinstallprompt', onBIP);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onBIP);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    if (hidden) return null;

    const handleClick = async () => {
        if (deferred) {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === 'accepted') setHidden(true);
            setDeferred(null);
            return;
        }
        // 설치 이벤트가 없으면(주로 iOS, 또는 이미 설치) 안내
        setShowIosGuide(true);
    };

    return (
        <>
            <button
                onClick={handleClick}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 999,
                    border: '1px solid #B49AC9', background: '#F5E6F7', color: '#6E5DA3',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
            >
                <span style={{ fontSize: 15 }}>📲</span> 바탕화면에 추가
            </button>

            {showIosGuide && (
                <div
                    onClick={() => setShowIosGuide(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(45,37,32,0.6)', padding: 24,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: 18, padding: '26px 22px', maxWidth: 340,
                            textAlign: 'center', fontFamily: '"Noto Serif KR", system-ui, sans-serif',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#2D2438', marginBottom: 14 }}>
                            바탕화면에 추가하는 법
                        </h3>
                        {isIOS() ? (
                            <ol style={{ textAlign: 'left', fontSize: 14, color: '#5B5169', lineHeight: 1.9, paddingLeft: 4, listStylePosition: 'inside' }}>
                                <li>화면 아래 <b>공유 버튼</b>(⬆️)을 누르세요</li>
                                <li><b>"홈 화면에 추가"</b>를 선택하세요</li>
                                <li>오른쪽 위 <b>"추가"</b>를 누르면 끝!</li>
                            </ol>
                        ) : (
                            <ol style={{ textAlign: 'left', fontSize: 14, color: '#5B5169', lineHeight: 1.9, paddingLeft: 4, listStylePosition: 'inside' }}>
                                <li>오른쪽 위 <b>메뉴(⋮)</b>를 누르세요</li>
                                <li><b>"홈 화면에 추가"</b>를 선택하세요</li>
                                <li><b>"추가"</b>를 누르면 끝!</li>
                            </ol>
                        )}
                        <button
                            onClick={() => setShowIosGuide(false)}
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
