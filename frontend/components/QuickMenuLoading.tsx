import React, { useEffect, useState } from 'react';

/**
 * 도결 선생 퀵메뉴 로딩 오버레이.
 * 검은 화면 + 단순 스피너 → 명리학 감정서 컨셉(중앙 한지 카드 + 회전 팔괘 링 + 주제별 단계 멘트).
 * 결과 카드(QuickMenuResultCard)와 톤을 통일한다.
 */

// 주제(메뉴 라벨)별 로딩 단계 멘트. 2초마다 순환한다.
// 라벨에 포함된 키워드로 매칭 → 새 메뉴가 늘어도 기본 멘트로 안전 동작.
const PHRASE_SETS: { match: string; phrases: string[] }[] = [
    { match: '전생', phrases: ['전생의 기억을 더듬는 중', '오래된 인연의 실타래를 푸는 중', '지난 생의 업(業)을 읽는 중', '전생의 이야기를 엮는 중'] },
    { match: '관상', phrases: ['얼굴의 기운을 살피는 중', '이목구비의 결을 읽는 중', '관상에 깃든 운을 짚는 중', '풀이를 정리하는 중'] },
    { match: '꿈', phrases: ['어젯밤 꿈을 더듬는 중', '꿈에 깃든 조짐을 읽는 중', '길흉을 가늠하는 중', '해몽을 정리하는 중'] },
    { match: '시운', phrases: ['명부를 펼치는 중', '때의 기운을 짚는 중', '운의 물길을 읽는 중', '점괘를 정리하는 중'] },
    { match: '재물', phrases: ['곳간의 기운을 살피는 중', '재물의 흐름을 짚는 중', '성취의 때를 가늠하는 중', '풀이를 정리하는 중'] },
    { match: '인연', phrases: ['인연의 결을 더듬는 중', '연분의 실을 살피는 중', '두 기운의 만남을 읽는 중', '풀이를 정리하는 중'] },
];
const DEFAULT_PHRASES = ['명부를 펼치는 중', '사주를 짚는 중', '기운을 읽는 중', '점괘를 정리하는 중'];

function phrasesFor(title: string): string[] {
    const hit = PHRASE_SETS.find(s => title.includes(s.match));
    return hit ? hit.phrases : DEFAULT_PHRASES;
}

// 주역 8괘 — 회전 링에 배치
const TRIGRAMS = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];

export const QuickMenuLoading: React.FC<{ title?: string }> = ({ title = '' }) => {
    const phrases = phrasesFor(title);
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % phrases.length), 2000);
        return () => clearInterval(t);
    }, [phrases.length]);

    return (
        <div className="fixed inset-0 z-[78] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <style>{`
                @keyframes qmSpin { to { transform: rotate(360deg); } }
                @keyframes qmSpinR { to { transform: rotate(-360deg); } }
                @keyframes qmGlow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
                @keyframes qmFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div
                style={{
                    width: '100%',
                    maxWidth: 320,
                    background: 'rgba(18,10,3,0.97)',
                    border: '1px solid rgba(139,94,60,0.45)',
                    borderRadius: 14,
                    padding: '40px 28px 34px',
                    textAlign: 'center',
                    fontFamily: '"Noto Serif KR", Georgia, serif',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                    animation: 'qmFadeUp .4s ease-out',
                }}
            >
                {/* 회전 팔괘 링 */}
                <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto 24px' }}>
                    {/* 바깥 괘 링 (시계방향) */}
                    <div style={{ position: 'absolute', inset: 0, animation: 'qmSpin 14s linear infinite' }}>
                        {TRIGRAMS.map((g, i) => {
                            const ang = (i / TRIGRAMS.length) * 2 * Math.PI - Math.PI / 2;
                            const r = 56;
                            return (
                                <span key={i} style={{
                                    position: 'absolute', left: '50%', top: '50%',
                                    transform: `translate(-50%,-50%) translate(${Math.cos(ang) * r}px, ${Math.sin(ang) * r}px)`,
                                    fontSize: 18, color: '#c8943c',
                                    animation: 'qmGlow 2.4s ease-in-out infinite',
                                    animationDelay: `${i * 0.18}s`,
                                }}>{g}</span>
                            );
                        })}
                    </div>
                    {/* 안쪽 금빛 원호 (반시계, 스피너 역할) */}
                    <div style={{
                        position: 'absolute', inset: 30,
                        borderRadius: '50%',
                        border: '2px solid rgba(200,148,60,0.18)',
                        borderTopColor: '#e8b75a',
                        animation: 'qmSpinR 1.4s linear infinite',
                    }} />
                    {/* 중앙 태극 점 */}
                    <div style={{
                        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                        fontSize: 24, color: '#fde68a',
                        animation: 'qmGlow 2.4s ease-in-out infinite',
                    }}>☯</div>
                </div>

                {/* 단계 멘트 */}
                <p key={idx} style={{
                    fontSize: 15, color: '#fde68a', letterSpacing: '0.04em', fontWeight: 600,
                    fontFamily: '"Nanum Myeongjo", serif',
                    animation: 'qmFadeUp .5s ease-out',
                }}>
                    {phrases[idx]}<span style={{ color: '#b89060' }}>…</span>
                </p>
                <p style={{ fontSize: 11, color: '#8a6a3c', marginTop: 8, letterSpacing: '0.1em' }}>
                    잠시만 기다려 주십시오
                </p>
            </div>
        </div>
    );
};
