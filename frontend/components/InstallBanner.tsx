import React, { useEffect, useState } from 'react';
import { X, ExternalLink, PlusSquare, Share } from 'lucide-react';

// 홈 화면 추가(PWA 설치) 안내 — 상시 플로팅 버튼(2026-07-20 사장 지시).
// "카카오·네이버·크롬 등 브라우저마다 방법이 다 달라서 힘들다" → 기기·브라우저를 자동 감지해
// 맞는 안내를 보여준다. 브라우저 정책상 웹사이트가 바탕화면에 바로가기를 직접 만들 수는
// 없음(보안 제약, 어느 브라우저도 허용 안 함) — 실질적으로 가장 가까운 답은 PWA 설치 유도.

const UA = navigator.userAgent;
const isAndroid = /Android/i.test(UA);
const isKakao = /KAKAOTALK/i.test(UA);
const isNaver = /NAVER(APP)?/i.test(UA);
const isInApp = isKakao || isNaver;
const isIOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/i.test(UA) && (navigator as any).maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true; // iOS Safari 홈화면 실행 여부
const isEdge = /Edg\//i.test(UA);
const isFirefox = /Firefox/i.test(UA);
const isDesktopChrome = !isEdge && !isFirefox && /Chrome\//i.test(UA); // Edge도 Chrome UA를 포함해 순서 중요

type Guide = 'android-native' | 'ios-safari' | 'inapp' | 'desktop' | null;

function detectGuide(hasNativePrompt: boolean): Guide {
    if (isInApp) return 'inapp';                              // 카카오·네이버 인앱 — 외부 브라우저 유도부터
    if (isIOS) return 'ios-safari';                            // 아이폰 — 자동 프롬프트 불가, 텍스트 안내만 가능
    if (isAndroid && hasNativePrompt) return 'android-native';  // 안드로이드 크롬 — 네이티브 설치 프롬프트
    if (!isAndroid && !isIOS) return 'desktop';                 // PC 크롬/엣지 등 — 주소창 설치 아이콘 안내
    return null;
}

export const InstallBanner: React.FC = () => {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (isStandalone) return;
        const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    if (isStandalone) return null; // 이미 홈 화면으로 실행 중이면 안내 불필요

    const guide = detectGuide(!!installPrompt);

    const openInExternalBrowser = () => {
        const url = window.location.href;
        if (isAndroid) {
            // 카카오·네이버 인앱 → 크롬으로 강제 이동(intent URL)
            window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        } else {
            window.open(url, '_blank');
        }
    };

    const installNative = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        setInstallPrompt(null);
        setOpen(false);
    };

    return (
        <>
            {/* 상시 플로팅 버튼 — 필요할 때 언제든 다시 누를 수 있게(일회성 배너 아님) */}
            <button
                onClick={() => setOpen(true)}
                aria-label="홈 화면에 추가"
                title="홈 화면에 추가"
                className="fixed z-40 flex items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95"
                style={{
                    right: 16, bottom: 84, width: 48, height: 48,
                    background: 'linear-gradient(135deg, #8E6FB7, #C77DBE)',
                }}
            >
                <PlusSquare size={20} color="#fff" />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
                    <div
                        className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                            <h3 className="text-sm font-bold text-white">홈 화면에 추가</h3>
                            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-5 py-5 space-y-4 text-sm text-gray-200">
                            {guide === 'inapp' && (
                                <>
                                    <p className="leading-relaxed">
                                        {isKakao ? '카카오톡' : '네이버'} 브라우저에서는 바로 추가할 수 없어요.
                                        먼저 <b className="text-white">외부 브라우저(크롬 등)</b>로 열어주세요.
                                    </p>
                                    <button
                                        onClick={openInExternalBrowser}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm"
                                        style={{ background: 'linear-gradient(135deg, #8E6FB7, #C77DBE)' }}
                                    >
                                        <ExternalLink size={16} />외부 브라우저로 열기
                                    </button>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        (수동으로 하시려면) 오른쪽 위 <b>⋮</b> 또는 <b>공유</b> 아이콘 → <b>다른 브라우저로 열기</b>
                                    </p>
                                </>
                            )}

                            {guide === 'ios-safari' && (
                                <>
                                    <p className="leading-relaxed">iOS는 아래 순서로 직접 추가해 주셔야 해요.</p>
                                    <ol className="space-y-2.5 text-sm">
                                        <li className="flex items-start gap-2.5">
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">1</span>
                                            <span>화면 아래(또는 위) <Share size={14} className="inline mx-0.5 -mt-0.5" /> <b className="text-white">공유</b> 버튼을 눌러주세요</span>
                                        </li>
                                        <li className="flex items-start gap-2.5">
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">2</span>
                                            <span>목록에서 <b className="text-white">홈 화면에 추가</b>를 선택하세요</span>
                                        </li>
                                        <li className="flex items-start gap-2.5">
                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">3</span>
                                            <span>오른쪽 위 <b className="text-white">추가</b>를 누르면 끝!</span>
                                        </li>
                                    </ol>
                                    <p className="text-xs text-gray-500">※ 반드시 Safari(사파리)에서 열어야 이 버튼이 보여요.</p>
                                </>
                            )}

                            {guide === 'android-native' && (
                                <>
                                    <p className="leading-relaxed">버튼 한 번으로 바로 추가할 수 있어요.</p>
                                    <button
                                        onClick={installNative}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm"
                                        style={{ background: 'linear-gradient(135deg, #8E6FB7, #C77DBE)' }}
                                    >
                                        <PlusSquare size={16} />홈 화면에 추가
                                    </button>
                                </>
                            )}

                            {(guide === 'desktop' || guide === null) && (
                                <>
                                    <p className="leading-relaxed">
                                        {isFirefox
                                            ? <>파이어폭스는 <b className="text-white">앱 설치 기능이 없어요.</b> 대신 이 페이지를 <b className="text-white">즐겨찾기(북마크)</b>에 추가해 주세요(Ctrl+D).</>
                                            : <>주소창 오른쪽의 <b className="text-white">설치 아이콘</b>을 누르면 바로 추가돼요.</>
                                        }
                                    </p>

                                    {!isFirefox && (
                                        <>
                                            {/* 실제 브라우저 주소창을 흉내낸 미니 일러스트 — 아이콘 위치를 그림으로 정확히 지목 */}
                                            <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-3">
                                                <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2 border border-gray-700">
                                                    <span className="text-[10px] text-gray-600 flex-shrink-0">🔒</span>
                                                    <span className="flex-1 text-[11px] text-gray-500 truncate">aichat.dbzone.kr</span>
                                                    <span
                                                        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full ring-2 ring-purple-400 animate-pulse"
                                                        style={{ background: 'rgba(196,132,252,0.15)' }}
                                                    >
                                                        {isEdge ? (
                                                            <span className="text-[13px]">🖥️</span>
                                                        ) : (
                                                            <span className="text-white text-[14px] leading-none font-bold">⊕</span>
                                                        )}
                                                    </span>
                                                    <span className="text-gray-600 text-[13px] flex-shrink-0">⋮</span>
                                                </div>
                                                <p className="text-[11px] text-center text-purple-300 mt-2 font-semibold">
                                                    ↑ 동그라미 친 아이콘이에요
                                                </p>
                                            </div>

                                            <p className="text-xs text-gray-500 leading-relaxed">
                                                아이콘이 안 보이면 오른쪽 위 <b>⋮ 메뉴</b> →{' '}
                                                {isEdge ? <><b>앱</b> → <b>이 사이트를 앱으로 설치</b></> : <><b>도구 더보기</b> → <b>{isDesktopChrome ? '앱 설치' : '홈 화면에 추가'}</b></>}
                                                를 찾아주세요.
                                            </p>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
