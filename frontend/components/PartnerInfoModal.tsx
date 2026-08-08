import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BirthInfo } from './BirthInfoModal';

interface Props {
    onComplete: (info: BirthInfo) => void;
    onClose: () => void;
    title?: string;  // 헤더 문구(기본: 궁합 상대방 정보). 친구 둘 궁합 등에서 커스터마이즈.
}

const ITEM_H = 44;
const PAD = 2;

const YEARS = Array.from({ length: 80 }, (_, i) => String(1945 + i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const TIMES = ['모름','자시(子時)','축시(丑時)','인시(寅時)','묘시(卯時)','진시(辰時)','사시(巳時)','오시(午時)','미시(未時)','신시(申時)','유시(酉時)','술시(戌時)','해시(亥時)'];
const TIME_LABELS = ['모름','자시(子時) 23~01시','축시(丑時) 01~03시','인시(寅時) 03~05시','묘시(卯時) 05~07시','진시(辰時) 07~09시','사시(巳時) 09~11시','오시(午時) 11~13시','미시(未時) 13~15시','신시(申時) 15~17시','유시(酉時) 17~19시','술시(戌時) 19~21시','해시(亥時) 21~23시'];

const WheelPicker: React.FC<{
    items: string[];
    value: string;
    onChange: (v: string) => void;
    label?: string;
    width?: number;
    displayItems?: string[];
}> = ({ items, value, onChange, label, width = 100, displayItems }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    const scrollToIdx = useCallback((idx: number, behavior: ScrollBehavior = 'smooth') => {
        scrollRef.current?.scrollTo({ top: idx * ITEM_H, behavior });
    }, []);

    useEffect(() => {
        const idx = items.indexOf(value);
        if (idx >= 0) setTimeout(() => scrollToIdx(idx, 'instant'), 0);
    }, []);

    const handleScroll = () => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            if (!scrollRef.current) return;
            const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
            const clamped = Math.max(0, Math.min(items.length - 1, idx));
            if (items[clamped] !== value) onChange(items[clamped]);
            scrollToIdx(clamped);
        }, 120);
    };

    const containerH = ITEM_H * (PAD * 2 + 1);

    return (
        <div className="flex flex-col items-center gap-1">
            {label && <span className="text-xs tracking-wider" style={{ color: '#92713a' }}>{label}</span>}
            <div className="relative rounded-lg overflow-hidden" style={{ height: containerH, width }}>
                {/* ★2026-08-08: 휠 위아래 '안개'가 검정(rgba(13,11,8,0.98))이었다. 모달 본체는
                    흰색 계열(linear-gradient(170deg,#FFFFFF,#F5F0FB))이라 밝은 바탕 위에 검은
                    띠가 덮여 **선택 항목 앞뒤 연도가 통째로 묻혔다**. 안개의 목적은 '가장자리를
                    배경색으로 페이드아웃'시키는 것이므로 배경과 같은 흰색이어야 한다.
                    (생년월일 모달의 어두운 select와 같은 뿌리의 다크 테마 잔재) */}
                <div className="absolute inset-x-0 top-0 z-10 pointer-events-none"
                    style={{ height: ITEM_H * PAD, background: 'linear-gradient(to bottom, rgba(255,255,255,0.98), transparent)' }} />
                <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
                    style={{ height: ITEM_H * PAD, background: 'linear-gradient(to top, rgba(255,255,255,0.98), transparent)' }} />
                <div className="absolute inset-x-2 z-10 pointer-events-none"
                    style={{ top: ITEM_H * PAD, height: ITEM_H, borderTop: '1px solid rgba(180,130,50,0.35)', borderBottom: '1px solid rgba(180,130,50,0.35)' }} />
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-scroll"
                    style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' } as React.CSSProperties}
                    onScroll={handleScroll}
                >
                    <div style={{ height: ITEM_H * PAD }} />
                    {items.map((item, i) => (
                        <div
                            key={item}
                            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
                            className="flex items-center justify-center cursor-pointer select-none transition-all duration-100"
                            onClick={() => { onChange(item); scrollToIdx(i); }}
                        >
                            <span style={{
                                color: item === value ? '#6B4FA0' : '#4b5563',
                                fontSize: item === value ? '1rem' : '0.85rem',
                                fontWeight: item === value ? 700 : 400,
                                transition: 'all 0.1s',
                            }}>
                                {displayItems ? displayItems[i] : item}
                            </span>
                        </div>
                    ))}
                    <div style={{ height: ITEM_H * PAD }} />
                </div>
            </div>
        </div>
    );
};

type Step = 'name' | 'birth' | 'time';

const DIALOGS: Record<Step, string> = {
    name: '상대방의 성함을 알려주게나.',
    birth: '상대방이 태어난 해, 달, 날을 알려주게나.',
    time: '상대방의 태어난 시(時)를 알 수 있겠는가?',
};

export const PartnerInfoModal: React.FC<Props> = ({ onComplete, onClose, title }) => {
    const [step, setStep] = useState<Step>('name');
    const [name, setName] = useState('');
    const [year, setYear] = useState('1990');
    const [month, setMonth] = useState('1');
    const [day, setDay] = useState('1');
    const [time, setTime] = useState('모름');
    const [lunar, setLunar] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{
                width: 360,
                background: 'linear-gradient(170deg,#FFFFFF 0%,#F5F0FB 100%)',
                border: '1px solid rgba(107,79,160,0.22)',
            }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4"
                    style={{ borderBottom: '1px solid rgba(107,79,160,0.16)' }}>
                    <span className="text-sm tracking-widest font-medium" style={{ color: '#b07d3a' }}>{title ?? '💑 궁합 상대방 정보'}</span>
                    <button onClick={onClose}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                        /* 취소 버튼도 같은 다크 잔재 — 밝은 모달에서 대비 부족(2026-08-08) */
                        style={{ background: '#FFFFFF', color: '#6b5f70', border: '1px solid rgba(107,79,160,0.28)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(107,79,160,0.08)'; e.currentTarget.style.color = '#3F3350'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#6b5f70'; }}>
                        취소
                    </button>
                </div>

                {/* 대사 */}
                <div className="px-6 pt-4 pb-2">
                    <p className="text-sm italic leading-relaxed" style={{ color: 'rgba(107,79,160,0.85)' }}>{DIALOGS[step]}</p>
                </div>

                {/* 콘텐츠 */}
                <div className="px-6 pb-6" style={{ minHeight: 180 }}>
                    {step === 'name' && (
                        <div className="flex flex-col gap-6 mt-4">
                            <input
                                autoFocus
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && setStep('birth')}
                                placeholder="상대방 성함을 입력하세요"
                                className="w-full bg-transparent text-lg text-center py-2 focus:outline-none"
                                style={{ borderBottom: '1px solid rgba(107,79,160,0.35)', color: '#3F3350', caretColor: '#6B4FA0' }}
                            />
                            <button onClick={() => setStep('birth')}
                                className="self-end px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                                style={{ background: 'rgba(107,79,160,0.10)', color: '#6B4FA0', border: '1px solid rgba(107,79,160,0.22)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.14)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.10)')}>
                                다음 →
                            </button>
                        </div>
                    )}

                    {step === 'birth' && (
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex justify-center mb-1">
                                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(107,79,160,0.22)' }}>
                                    {(['양력', '음력'] as const).map(label => (
                                        <button key={label}
                                            onClick={() => setLunar(label === '음력')}
                                            className="px-4 py-1 text-xs font-medium transition-colors"
                                            style={{
                                                background: (label === '음력') === lunar ? 'rgba(107,79,160,0.14)' : 'transparent',
                                                color: (label === '음력') === lunar ? '#6B4FA0' : '#6b7280',
                                            }}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-center gap-3">
                                <WheelPicker items={YEARS} value={year} onChange={setYear} label="연(年)" width={108} />
                                <WheelPicker items={MONTHS} value={month} onChange={setMonth} label="월(月)" width={72} />
                                <WheelPicker items={DAYS} value={day} onChange={setDay} label="일(日)" width={72} />
                            </div>
                            <div className="flex justify-between mt-1">
                                <button onClick={() => setStep('name')} className="px-4 py-2 text-sm transition-colors" style={{ color: '#6b7280' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                                    ← 이전
                                </button>
                                <button onClick={() => setStep('time')}
                                    className="px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                                    style={{ background: 'rgba(107,79,160,0.10)', color: '#6B4FA0', border: '1px solid rgba(107,79,160,0.22)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.14)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.10)')}>
                                    다음 →
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'time' && (
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex justify-center">
                                <WheelPicker items={TIMES} value={time} onChange={setTime} label="시(時)" width={220} displayItems={TIME_LABELS} />
                            </div>
                            <div className="flex justify-between mt-1">
                                <button onClick={() => setStep('birth')} className="px-4 py-2 text-sm transition-colors" style={{ color: '#6b7280' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                                    ← 이전
                                </button>
                                <button onClick={() => onComplete({ name, year, month, day, time, lunar })}
                                    className="px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                                    style={{ background: 'rgba(107,79,160,0.10)', color: '#6B4FA0', border: '1px solid rgba(107,79,160,0.22)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.14)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(107,79,160,0.10)')}>
                                    확인
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
