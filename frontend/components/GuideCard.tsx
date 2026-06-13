import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

// 공용 사용법 가이드 카드 — 기능 화면 상단에 붙여 "이렇게 진행돼요" 단계를 보여준다.
// 접이식(기본 펼침). localStorage로 닫힘 상태 기억(기능별 storageKey). 모든 기능에서 재사용.
export interface GuideStep {
    title: string;        // 단계 제목 (예: "목차 만들기")
    desc: string;         // 한 줄 설명
    emoji?: string;       // 단계 아이콘(선택)
}
interface GuideCardProps {
    title?: string;       // 카드 제목 (기본 "사용법")
    steps: GuideStep[];   // 진행 단계
    tip?: string;         // 하단 팁 한 줄(선택)
    storageKey: string;   // 닫힘 상태 기억 키(기능별 고유, 예: "guide_ebook")
    accent?: string;      // 포인트 색(기본 퍼플)
}

export const GuideCard: React.FC<GuideCardProps> = ({ title = '사용법', steps, tip, storageKey, accent = '#8E6FB7' }) => {
    const [open, setOpen] = useState<boolean>(() => {
        try { return localStorage.getItem(storageKey) !== 'closed'; } catch { return true; }
    });
    const toggle = () => {
        setOpen(prev => {
            const next = !prev;
            try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch { }
            return next;
        });
    };
    const soft = accent + '14';
    const border = accent + '33';

    return (
        <div className="rounded-2xl mb-4" style={{ background: soft, border: `1px solid ${border}` }}>
            {/* 헤더 — 클릭 시 접기/펼치기. 닫혀있을 땐 '사용법 보기'로 안내(? 버튼 역할, 공간 최소). */}
            <button onClick={toggle} className="w-full flex items-center gap-2 px-4 py-2.5" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <HelpCircle size={16} style={{ color: accent }} strokeWidth={2.4} />
                <span className="text-sm font-bold" style={{ color: accent }}>
                    📖 {open ? title : `${title} 보기`}
                </span>
                <span className="ml-auto flex items-center gap-1" style={{ color: accent }}>
                    {!open && <span className="text-[11px] font-medium" style={{ opacity: 0.75 }}>펼치기</span>}
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
            </button>

            {/* 단계 목록 */}
            {open && (
                <div className="px-4 pb-3.5">
                    <div className="flex flex-col gap-2.5">
                        {steps.map((s, i) => (
                            <div key={i} className="flex gap-2.5 items-start">
                                <span className="shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-bold"
                                    style={{ width: 20, height: 20, background: accent, color: '#fff', marginTop: 1 }}>{i + 1}</span>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold leading-snug" style={{ color: '#2D2438' }}>
                                        {s.emoji ? s.emoji + ' ' : ''}{s.title}
                                    </p>
                                    <p className="text-[11.5px] leading-relaxed" style={{ color: '#6B5F56' }}>{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {tip && (
                        <p className="text-[11px] mt-3 pt-2.5" style={{ color: '#9089A1', borderTop: `1px dashed ${border}` }}>💡 {tip}</p>
                    )}
                </div>
            )}
        </div>
    );
};
