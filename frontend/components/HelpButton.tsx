import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import type { GuideStep } from './GuideCard';

// 공용 도움말 버튼 — 기능 보드 헤더에 넣는 앰버 '? 도움말' 버튼 + 사용법 모달.
// 인라인 GuideCard 대신 헤더에 꽂아 화면을 가볍게 유지한다(보드별 재사용).
interface HelpButtonProps {
    title?: string;       // 모달 제목 (예: "주식 분석 사용법")
    steps: GuideStep[];   // 진행 단계
    tip?: string;         // 하단 팁 한 줄(선택)
    accent?: string;      // 단계 번호 배지 색(기본 퍼플). 버튼은 앰버(기본) 또는 흰색.
    variant?: 'amber' | 'white';  // 컬러 헤더 위에선 'white'
}

export const HelpButton: React.FC<HelpButtonProps> = ({ title = '사용법', steps, tip, accent = '#8E6FB7', variant = 'amber' }) => {
    const [open, setOpen] = useState(false);
    const btnCls = variant === 'white'
        ? 'text-white/85 hover:text-white hover:bg-white/20'
        : 'text-[#D9920A] hover:bg-[#FEF3C7]';
    return (
        <>
            <button onClick={() => setOpen(true)} title="사용법"
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors shrink-0 ${btnCls}`}>
                <HelpCircle size={17} />
                <span className="hidden md:inline text-xs font-semibold">도움말</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 bg-black/50"
                    onClick={() => setOpen(false)}>
                    <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <HelpCircle size={18} style={{ color: accent }} />
                                <span className="text-base font-bold text-[#2D2438]">{title}</span>
                            </div>
                            <button onClick={() => setOpen(false)} className="p-1 text-[#9089A1] hover:text-[#2D2438]">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-3.5">
                            {steps.map((s, i) => (
                                <div key={i} className="flex gap-3">
                                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: accent }}>{i + 1}</span>
                                    <div>
                                        <div className="text-sm font-bold text-[#2D2438]">{s.title}</div>
                                        <div className="text-xs text-[#6B5F56] mt-0.5 leading-relaxed">{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {tip && (
                            <div className="mt-4 pt-3 border-t border-[#F0E9DE] text-xs text-[#9089A1] leading-relaxed">
                                💡 {tip}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
