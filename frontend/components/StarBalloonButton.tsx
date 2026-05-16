import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { pointApi } from '../services/pointService';

const STAR_OPTIONS = [
    { amount: 1,   label: '⭐ ×1',   points: 10,   duration: 3000, count: 15  },
    { amount: 5,   label: '⭐ ×5',   points: 50,   duration: 5000, count: 30  },
    { amount: 10,  label: '⭐ ×10',  points: 100,  duration: 7000, count: 60  },
    { amount: 100, label: '⭐ ×100', points: 1000, duration: 10000, count: 150 },
];

interface StarParticle {
    id: number;
    x: number;
    delay: number;
    size: number;
    speed: number;
}

interface StarRainProps {
    count: number;
    duration: number;
    onDone: () => void;
}

const StarRain: React.FC<StarRainProps> = ({ count, duration, onDone }) => {
    const [particles] = useState<StarParticle[]>(() =>
        Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * (duration * 0.6),
            size: 14 + Math.random() * 22,
            speed: 1.5 + Math.random() * 2,
        }))
    );

    useEffect(() => {
        const t = setTimeout(onDone, duration);
        return () => clearTimeout(t);
    }, [duration, onDone]);

    return (
        <div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden">
            {particles.map(p => (
                <span
                    key={p.id}
                    style={{
                        position: 'absolute',
                        left: `${p.x}%`,
                        top: '-40px',
                        fontSize: `${p.size}px`,
                        animationName: 'starFall',
                        animationDuration: `${p.speed}s`,
                        animationDelay: `${p.delay}ms`,
                        animationTimingFunction: 'linear',
                        animationFillMode: 'forwards',
                    }}
                >
                    ⭐
                </span>
            ))}
            <style>{`
                @keyframes starFall {
                    0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(110vh) rotate(360deg); opacity: 0.6; }
                }
            `}</style>
        </div>
    );
};

interface StarResult {
    newBalance: number;
    xp: number;
    leveledUp: boolean;
    newStage: number;
    levelupBonus: number;
    personaId: string;
}

interface StarButtonProps {
    personaId: string;
    personaName: string;
    userPoints: number;
    onSent: (result: StarResult) => void;
    onBalloonStart?: (amount: number) => void;
    onRainDone?: () => void;
}

export const StarButton: React.FC<StarButtonProps> = ({ personaId, personaName, userPoints, onSent, onBalloonStart, onRainDone }) => {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [rain, setRain] = useState<{ count: number; duration: number } | null>(null);
    const [rainKey, setRainKey] = useState(0);

    const send = async (opt: typeof STAR_OPTIONS[0]) => {
        if (userPoints < opt.points) { alert('포인트가 부족합니다.'); return; }
        setOpen(false);
        setRainKey(k => k + 1);
        setRain({ count: opt.count, duration: opt.duration });
        onBalloonStart?.(opt.amount); // 애니메이션 시작과 동시에 Gemini 호출 트리거
        setSending(true);
        try {
            const result = await pointApi.sendStar(personaId, opt.amount);
            onSent({ ...result, personaId });
        } catch {
            setRain(null);
            alert('스타 전송에 실패했습니다.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="relative">
            {rain && (
                <StarRain
                    key={rainKey}
                    count={rain.count}
                    duration={rain.duration}
                    onDone={() => { setRain(null); onRainDone?.(); }}
                />
            )}
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-yellow-400 hover:bg-yellow-400/10 transition-colors text-sm"
                title={`${personaName}에게 스타 보내기`}
            >
                <Star size={16} fill="currentColor" />
                <span className="text-xs hidden sm:inline">스타</span>
            </button>
            {open && (
                <div className="absolute bottom-10 right-0 bg-gray-900 border border-gray-700 rounded-2xl p-3 shadow-2xl z-40 w-48">
                    <p className="text-xs text-gray-400 mb-2">{personaName}에게 스타 보내기</p>
                    {STAR_OPTIONS.map(opt => (
                        <button
                            key={opt.amount}
                            onClick={() => send(opt)}
                            disabled={sending || userPoints < opt.points}
                            className="w-full flex justify-between items-center px-3 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 text-sm transition-colors"
                        >
                            <span className="text-white">{opt.label}</span>
                            <span className="text-yellow-400 text-xs">{opt.points}pt</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
