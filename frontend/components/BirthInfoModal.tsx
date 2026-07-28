import React, { useState, useEffect, useRef } from 'react';

export interface BirthInfo {
    name: string;
    year: string;
    month: string;
    day: string;
    time: string;
    lunar: boolean;
}

interface Props {
    initialData?: Partial<BirthInfo>;
    onComplete: (info: BirthInfo) => void;
    onClose: () => void;
}

const YEARS = Array.from({ length: 80 }, (_, i) => String(1945 + i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const TIMES = ['모름','자시(子時)','축시(丑時)','인시(寅時)','묘시(卯時)','진시(辰時)','사시(巳時)','오시(午時)','미시(未時)','신시(申時)','유시(酉時)','술시(戌時)','해시(亥時)'];
const TIME_LABELS = ['모름','자시(子時) 23~01시','축시(丑時) 01~03시','인시(寅時) 03~05시','묘시(卯時) 05~07시','진시(辰時) 07~09시','사시(巳時) 09~11시','오시(午時) 11~13시','미시(未時) 13~15시','신시(申時) 15~17시','유시(酉時) 17~19시','술시(戌時) 19~21시','해시(亥時) 21~23시'];

const selectStyle: React.CSSProperties = {
    background: 'rgba(20,14,6,0.95)',
    border: '1px solid rgba(107,79,160,0.28)',
    color: '#3F3350',
    borderRadius: '8px',
    padding: '10px 10px',
    fontSize: '1rem',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
    appearance: 'auto',
};

type Step = 'name' | 'birth' | 'time' | 'complete';

const DIALOGS: Record<Step, string> = {
    name: '자네의 성함을 이 명부에 적어주게나.',
    birth: '태어난 해, 달, 날을 알려주게나.',
    time: '태어난 시(時)를 알 수 있겠는가?',
    complete: '명부에 기록이 완료되었네.',
};

export const BirthInfoModal: React.FC<Props> = ({ initialData, onComplete, onClose }) => {
    const [step, setStep] = useState<Step>('name');
    const [name, setName] = useState(initialData?.name || '');
    const [year, setYear] = useState(initialData?.year || '1990');
    const [month, setMonth] = useState(initialData?.month || '1');
    const [day, setDay] = useState(initialData?.day || '1');
    const [time, setTime] = useState(initialData?.time || '모름');
    const [lunar, setLunar] = useState(initialData?.lunar ?? false);
    const [showStamp, setShowStamp] = useState(false);
    const [showHandle, setShowHandle] = useState(false);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        return () => { timersRef.current.forEach(clearTimeout); };
    }, []);

    const handleComplete = () => {
        setStep('complete');
        timersRef.current = [
            setTimeout(() => setShowHandle(true), 80),
            setTimeout(() => setShowStamp(true), 480),
            setTimeout(() => onComplete({ name, year, month, day, time, lunar }), 2000),
        ];
    };

    const labelStyle: React.CSSProperties = { color: '#92713a', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: 4 };
    const btnNext: React.CSSProperties = { background: 'rgba(107,79,160,0.10)', color: '#6B4FA0', border: '1px solid rgba(107,79,160,0.22)', borderRadius: 12, padding: '8px 20px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' };
    const btnPrev: React.CSSProperties = { color: '#6b7280', background: 'none', border: 'none', padding: '8px 16px', fontSize: '0.875rem', cursor: 'pointer' };

    return (
        <>
            <style>{`
                @keyframes handle-slam {
                    0%   { transform: translateY(-160px); opacity: 0; }
                    8%   { opacity: 1; }
                    44%  { transform: translateY(-52px); }
                    56%  { transform: translateY(-50px); }
                    88%  { transform: translateY(-160px); opacity: 1; }
                    100% { transform: translateY(-160px); opacity: 0; }
                }
                .handle-anim { animation: handle-slam 1.5s cubic-bezier(0.4,0,0.2,1) forwards; }
                @keyframes impression-appear {
                    0%   { transform: scaleY(0.12) scaleX(1.5); opacity: 0.6; filter: blur(4px); }
                    28%  { transform: scaleY(1.1) scaleX(0.94); opacity: 1; filter: blur(0); }
                    55%  { transform: scaleY(0.97) scaleX(1.02); }
                    100% { transform: scale(1); }
                }
                .impression-anim { animation: impression-appear 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
                @keyframes ring-expand {
                    0%   { transform: scale(0.95); opacity: 0.7; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                .ring-anim { animation: ring-expand 0.6s ease-out forwards; }
                .birth-select:focus { border-color: rgba(180,130,50,0.8) !important; }
                .birth-select option { background: #F5F0FB; color: #3F3350; }
            `}</style>

            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ width: 340, background: 'linear-gradient(170deg,#FFFFFF 0%,#F5F0FB 100%)', border: '1px solid rgba(107,79,160,0.22)' }}>

                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(107,79,160,0.16)' }}>
                        <span className="text-sm tracking-widest font-medium" style={{ color: '#b07d3a' }}>🏮 명부 기록</span>
                        {step !== 'complete' && (
                            <button onClick={onClose}
                                className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                                style={{ background: 'rgba(75,85,99,0.4)', color: '#d1d5db', border: '1px solid rgba(107,114,128,0.5)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,114,128,0.5)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(75,85,99,0.4)')}>
                                나중에
                            </button>
                        )}
                    </div>

                    {/* 대사 */}
                    <div className="px-6 pt-4 pb-2">
                        <p className="text-sm italic leading-relaxed" style={{ color: 'rgba(107,79,160,0.85)' }}>{DIALOGS[step]}</p>
                        {/* 왜 묻는지 먼저 알려준다(2026-07-28) — 공유 링크로 처음 온 사람에게 이유 없이
                            이름·생년월일을 요구하면 개인정보 요구로 느껴져 그 자리에서 이탈한다.
                            첫 화면에만 노출(이후 단계는 맥락이 이미 잡혀 있음). */}
                        {step === 'name' && (
                            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: 'rgba(107,79,160,0.60)' }}>
                                사주로 흐름을 읽으려면 태어난 정보가 필요하다네.<br />
                                한 번만 적어두면 다음부터는 묻지 않겠네.
                            </p>
                        )}
                    </div>

                    {/* 콘텐츠 */}
                    <div className="px-6 pb-6" style={{ minHeight: 200 }}>

                        {step === 'name' && (
                            <div className="flex flex-col gap-6 mt-4">
                                <input
                                    autoFocus
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && setStep('birth')}
                                    placeholder="성함을 입력하세요"
                                    className="w-full bg-transparent text-lg text-center py-2 focus:outline-none"
                                    style={{ borderBottom: '1px solid rgba(107,79,160,0.35)', color: '#3F3350', caretColor: '#6B4FA0' }}
                                />
                                <button onClick={() => setStep('birth')} className="self-end" style={btnNext}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.14)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.10)')}>
                                    다음 →
                                </button>
                            </div>
                        )}

                        {step === 'birth' && (
                            <div className="flex flex-col gap-5 mt-3">
                                {/* 양력/음력 */}
                                <div className="flex justify-center">
                                    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(107,79,160,0.22)' }}>
                                        {(['양력', '음력'] as const).map(label => (
                                            <button key={label} onClick={() => setLunar(label === '음력')}
                                                className="px-5 py-1.5 text-xs font-medium transition-colors"
                                                style={{
                                                    background: (label === '음력') === lunar ? 'rgba(107,79,160,0.14)' : 'transparent',
                                                    color: (label === '음력') === lunar ? '#6B4FA0' : '#6b7280',
                                                }}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 연/월/일 select */}
                                <div className="flex gap-3 justify-center">
                                    <div className="flex flex-col items-center">
                                        <span style={labelStyle}>연(年)</span>
                                        <select className="birth-select" value={year} onChange={e => setYear(e.target.value)}
                                            style={{ ...selectStyle, width: 100 }}>
                                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span style={labelStyle}>월(月)</span>
                                        <select className="birth-select" value={month} onChange={e => setMonth(e.target.value)}
                                            style={{ ...selectStyle, width: 72 }}>
                                            {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span style={labelStyle}>일(日)</span>
                                        <select className="birth-select" value={day} onChange={e => setDay(e.target.value)}
                                            style={{ ...selectStyle, width: 72 }}>
                                            {DAYS.map(d => <option key={d} value={d}>{d}일</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-between mt-1">
                                    <button onClick={() => setStep('name')} style={btnPrev}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                                        ← 이전
                                    </button>
                                    <button onClick={() => setStep('time')} style={btnNext}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.14)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.10)')}>
                                        다음 →
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'time' && (
                            <div className="flex flex-col gap-5 mt-3">
                                <div className="flex flex-col items-center">
                                    <span style={labelStyle}>시(時)</span>
                                    <select className="birth-select" value={time} onChange={e => setTime(e.target.value)}
                                        style={{ ...selectStyle, width: '100%' }}>
                                        {TIMES.map((t, i) => (
                                            <option key={t} value={t}>{TIME_LABELS[i]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <button onClick={() => setStep('birth')} style={btnPrev}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                                        ← 이전
                                    </button>
                                    <button onClick={handleComplete}
                                        style={{ background: 'rgba(100,20,10,0.55)', color: '#fca5a5', border: '1px solid rgba(180,50,30,0.4)', borderRadius: 12, padding: '8px 20px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(140,30,15,0.7)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(100,20,10,0.55)')}>
                                        기록 완료
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'complete' && (
                            <div className="relative flex flex-col items-center justify-center mt-2" style={{ minHeight: 190 }}>
                                {showHandle && (
                                    <div className="handle-anim" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -36, width: 72, zIndex: 20 }}>
                                        <div style={{ width: 72, height: 22, borderRadius: '5px 5px 2px 2px', background: 'linear-gradient(to bottom, #92400e, #78350f)', boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,200,100,0.2)' }} />
                                        <div style={{ width: 52, height: 14, margin: '0 auto', borderRadius: '0 0 3px 3px', background: 'linear-gradient(to bottom, #7c1d1d, #991b1b)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
                                    </div>
                                )}
                                {showStamp && (
                                    <div className="flex flex-col items-center gap-3 mt-6">
                                        <div style={{ position: 'relative' }}>
                                            <div className="ring-anim" style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(200,0,0,0.5)', pointerEvents: 'none' }} />
                                            <div className="impression-anim flex items-center justify-center rounded-full"
                                                style={{ width: 96, height: 96, border: '3px solid #cc2222', boxShadow: '0 0 20px rgba(200,0,0,0.4)', color: '#cc2222' }}>
                                                <span className="text-2xl font-bold tracking-widest" style={{ fontFamily: 'serif' }}>記錄</span>
                                            </div>
                                        </div>
                                        <p className="text-sm tracking-wider" style={{ color: 'rgba(107,79,160,0.80)' }}>명부에 기록되었습니다.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
