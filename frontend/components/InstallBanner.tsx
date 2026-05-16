import React, { useEffect, useState } from 'react';
import { X, ExternalLink, PlusSquare } from 'lucide-react';

const UA = navigator.userAgent;
const isAndroid = /Android/i.test(UA);
const isKakao = /KAKAOTALK/i.test(UA);
const isNaver = /NAVER(APP)?/i.test(UA);
const isInApp = isKakao || isNaver;
const isIOS = /iPhone|iPad|iPod/i.test(UA);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

const DISMISSED_KEY = 'pwa-banner-dismissed';

export const InstallBanner: React.FC = () => {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isStandalone) return;
        if (sessionStorage.getItem(DISMISSED_KEY)) return;

        if (isInApp) {
            setVisible(true);
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
            setVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const dismiss = () => {
        sessionStorage.setItem(DISMISSED_KEY, '1');
        setVisible(false);
    };

    const openInChrome = () => {
        const url = window.location.href;
        if (isAndroid) {
            window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        } else {
            window.open(url, '_blank');
        }
    };

    const install = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-gray-700 bg-gray-900/95 backdrop-blur-md">
                <div className="flex-1 min-w-0">
                    {isInApp ? (
                        <p className="text-sm font-semibold text-white">Chrome에서 홈 화면에 추가할 수 있어요</p>
                    ) : (
                        <p className="text-sm font-semibold text-white">홈 화면에 추가</p>
                    )}
                </div>
                <button
                    onClick={isInApp ? openInChrome : install}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                    {isInApp ? <><ExternalLink size={13} />Chrome으로 열기</> : <><PlusSquare size={13} />추가</>}
                </button>
                <button onClick={dismiss} className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
