import React, { useEffect, useState } from 'react';

// 🤖 AI상담 봇 페이지 (/consult/{slug}) — "AI상담 봇 만들기"로 발급된 링크가 여는 화면.
// 사용자가 자기 홈페이지 메뉴에 이 링크를 붙이면, 방문자에게 아바타 + 마스터
// Typebot(consult-master, 멀티테넌트 prefill)이 뜬다. EmbedChat처럼 AppContent
// 진입 전 얼리리턴으로 렌더되므로 앱 훅·컨텍스트에 의존하지 않는다.

const TYPEBOT_URL = 'https://bot.dbzone.kr/consult-master';
const DEFAULT_GREETING = '무엇을 도와드릴까요? 문의를 남겨주시면 담당자에게 바로 전달됩니다.';

interface BotPublicConfig {
    slug: string;
    companyName: string;
    greeting?: string | null;
    showAvatar: boolean;
    themeColor?: string | null;
}

export const ConsultPage: React.FC<{ slug: string }> = ({ slug }) => {
    const [bot, setBot] = useState<BotPublicConfig | null>(null);
    const [error, setError] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        fetch(`/api/consult-bots/${encodeURIComponent(slug)}`)
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(setBot)
            .catch(() => setError('상담 페이지를 찾을 수 없습니다. 주소를 확인해 주세요.'));
        const onResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [slug]);

    useEffect(() => {
        if (bot?.companyName) document.title = `${bot.companyName} AI 상담`;
    }, [bot]);

    const frame: React.CSSProperties = {
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        height: '100vh', maxHeight: '100dvh', background: '#020617',
        fontFamily: 'Pretendard, sans-serif',
    };

    if (error || !bot) {
        return (
            <div style={{ ...frame, alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: error ? '#f87171' : '#94a3b8', fontSize: 14, padding: 24, textAlign: 'center' }}>
                    {error || '불러오는 중...'}
                </p>
            </div>
        );
    }

    // ★멀티테넌트 핵심: 마스터 봇 1개에 URL 쿼리로 테넌트 변수 주입
    const params = new URLSearchParams({
        tenantSlug: bot.slug,
        companyName: bot.companyName,
        greeting: bot.greeting || DEFAULT_GREETING,
    });

    return (
        <div style={frame}>
            {bot.showAvatar && (
                <div style={{ flex: isMobile ? '0 0 30%' : '0 0 38%', minHeight: 0 }}>
                    <iframe src="/consult-avatar.html" title={`${bot.companyName} 상담 캐릭터`}
                        style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
                </div>
            )}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, background: '#fff' }}>
                <iframe src={`${TYPEBOT_URL}?${params.toString()}`} title={`${bot.companyName} AI 상담`}
                    style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
            </div>
        </div>
    );
};
