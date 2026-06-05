import React, { useEffect } from 'react';
import { TodayNewsBoard } from './TodayNewsBoard';
import { InstallNewsButton } from './InstallNewsButton';

/**
 * /news 전용 진입 페이지 (홈화면 바로가기 아이콘 대상).
 * 회원 전용: 로그인 토큰이 있으면 오늘뉴스를 전체화면으로 바로 표시,
 * 없으면 로그인 안내 화면을 보여준다. AttendPage와 같은 "독립 진입" 패턴.
 */
export const NewsPage: React.FC = () => {
    const hasToken = !!localStorage.getItem('token');

    // 홈화면 추가 시 "오늘뉴스"로 잡히도록 제목/아이콘을 뉴스용으로 교체.
    // (iOS 사파리는 manifest 대신 apple-touch-icon/title을 보므로 동적으로 지정)
    useEffect(() => {
        const prevTitle = document.title;
        document.title = '오늘의 뉴스';
        const link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        const prevHref = link?.getAttribute('href') ?? null;
        if (link) link.setAttribute('href', '/news-192.png');
        return () => {
            document.title = prevTitle;
            if (link && prevHref) link.setAttribute('href', prevHref);
        };
    }, []);

    // 닫기/홈 이동 — 메인 앱 첫 화면으로
    const goHome = () => { window.location.href = '/'; };

    if (!hasToken) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '32px 24px', textAlign: 'center',
                    background: 'linear-gradient(160deg, #FBF8F3 0%, #F3ECF8 100%)',
                    fontFamily: '"Noto Serif KR", system-ui, sans-serif',
                }}
            >
                <div style={{ fontSize: 56, marginBottom: 16 }}>📰</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2D2438', marginBottom: 10 }}>오늘의 뉴스</h1>
                <p style={{ fontSize: 14, color: '#6B5F7A', lineHeight: 1.7, marginBottom: 28, maxWidth: 320 }}>
                    오늘의 뉴스는 로그인 후 보실 수 있어요.<br />로그인하면 매일 아침·저녁 최신 뉴스를 바로 확인할 수 있습니다.
                </p>
                <button
                    onClick={goHome}
                    style={{
                        padding: '13px 32px', borderRadius: 999, border: 'none',
                        background: 'linear-gradient(135deg, #8E6FB7, #6E5DA3)',
                        color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(142,111,183,0.35)',
                    }}
                >
                    로그인하고 보기 →
                </button>
                <div style={{ marginTop: 16 }}>
                    <InstallNewsButton />
                </div>
            </div>
        );
    }

    // 전용 페이지에선 TodayNewsBoard(모달)를 전체화면으로 꽉 채운다.
    // TodayNewsBoard 자체는 건드리지 않고(모달 동작 보존), 이 페이지 안에서만 스타일을 덮는다.
    return (
        <div className="news-fullpage" style={{ minHeight: '100vh', background: '#FBF8F3' }}>
            <style>{`
                /* 모달 오버레이 → 전체화면(여백·딤·블러 제거) */
                .news-fullpage > div[style*="position: fixed"] {
                    padding: 0 !important;
                    background: #FBF8F3 !important;
                    backdrop-filter: none !important;
                    align-items: stretch !important;
                }
                /* 카드 → 화면 꽉 채우기(둥근모서리·그림자 제거) */
                .news-fullpage > div[style*="position: fixed"] > div {
                    max-width: 100% !important;
                    max-height: 100% !important;
                    height: 100vh !important;
                    border-radius: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                }
            `}</style>
            <TodayNewsBoard onClose={goHome} />
            {/* 바탕화면에 추가 — 우하단 floating */}
            <div style={{ position: 'fixed', right: 16, bottom: 20, zIndex: 60 }}>
                <InstallNewsButton />
            </div>
        </div>
    );
};
