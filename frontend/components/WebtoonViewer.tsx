import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// 웹툰 컷 뷰어 — 풀스크린, 컷을 좌우로 넘긴다(전자책식). ←→ 버튼 + 모바일 스와이프 + 진행바.
interface Props {
    cuts: string[];          // 컷 이미지 URL 배열
    title?: string;          // 회차 제목(상단 표시)
    startIndex?: number;     // 시작 컷
    onClose: () => void;
}

const MAX_SCALE = 4;

export const WebtoonViewer: React.FC<Props> = ({ cuts, title, startIndex = 0, onClose }) => {
    const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, cuts.length - 1)));
    const total = cuts.length;
    const touchX = useRef<number | null>(null);

    // 줌/패닝 상태 — Ctrl+휠로 확대, 확대 시 드래그로 이동, 더블클릭으로 리셋.
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const stageRef = useRef<HTMLDivElement | null>(null);
    const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const resetZoom = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

    const go = useCallback((dir: -1 | 1) => {
        setIdx(prev => {
            const next = prev + dir;
            if (next < 0 || next >= total) return prev;
            return next;
        });
    }, [total]);

    // 컷이 바뀌면 줌 리셋
    useEffect(() => { resetZoom(); }, [idx, resetZoom]);

    // Ctrl+휠 줌(커서 위치 기준). React onWheel은 passive라 막을 수 없어 직접 등록.
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;          // Ctrl 눌렀을 때만 줌(아니면 기본 동작)
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cx = e.clientX - rect.left - rect.width / 2;   // 중심 기준 커서 좌표
            const cy = e.clientY - rect.top - rect.height / 2;
            setScale(prevS => {
                const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
                const next = Math.min(MAX_SCALE, Math.max(1, prevS * factor));
                if (next === 1) { setOffset({ x: 0, y: 0 }); return 1; }
                // 커서 위치가 고정돼 보이도록 offset 보정
                setOffset(prevO => ({
                    x: cx - (cx - prevO.x) * (next / prevS),
                    y: cy - (cy - prevO.y) * (next / prevS),
                }));
                return next;
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // 확대 상태에서 마우스 드래그로 이동(패닝)
    const onMouseDown = (e: React.MouseEvent) => {
        if (scale <= 1) return;
        dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging.current) return;
        setOffset({ x: dragging.current.ox + (e.clientX - dragging.current.x), y: dragging.current.oy + (e.clientY - dragging.current.y) });
    };
    const endDrag = () => { dragging.current = null; };

    // 키보드 ←→, Esc
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go, onClose]);

    // 모바일 스와이프 (확대 중엔 넘김 비활성 — 확대 상태에선 더블탭/더블클릭으로 먼저 원위치)
    const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (scale === 1 && Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); // 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전
        touchX.current = null;
    };

    if (total === 0) {
        return (
            <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
                <p style={{ color: '#fff' }}>아직 등록된 컷이 없어요.</p>
            </div>
        );
    }

    const atFirst = idx === 0;
    const atLast = idx === total - 1;

    return (
        <div className="fixed inset-0 z-[90] flex flex-col select-none" style={{ background: 'rgba(0,0,0,0.95)' }}>
            {/* 상단 바: 제목 + 진행 + 닫기 */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <span className="text-sm font-bold truncate" style={{ color: '#fff', flex: 1 }}>{title || '웹툰'}</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: '#fff', background: 'rgba(255,255,255,0.18)' }}>{idx + 1} / {total}</span>
                <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)' }}>
                    <X size={18} style={{ color: '#fff' }} />
                </button>
            </div>

            {/* 진행바 */}
            <div className="shrink-0 h-1" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-full transition-all" style={{ width: `${((idx + 1) / total) * 100}%`, background: '#8E6FB7' }} />
            </div>

            {/* 컷 영역 */}
            <div ref={stageRef} className="flex-1 relative overflow-hidden"
                onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}
                onDoubleClick={resetZoom}
                style={{ cursor: scale > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'default' }}>
                {/* 현재 컷 — 스크롤 없이 한 화면에 통째로(contain). Ctrl+휠로 확대(scale/offset 적용). */}
                <div className="absolute inset-0 flex items-center justify-center p-2"
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: dragging.current ? 'none' : 'transform 0.12s', willChange: 'transform' }}>
                    <img src={cuts[idx]} alt={`컷 ${idx + 1}`} draggable={false}
                        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', flexShrink: 0 }} />
                </div>

                {/* 좌우 넘김 버튼 (확대 중엔 숨김 — 패닝과 충돌 방지) */}
                {scale === 1 && !atFirst && (
                    <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                        style={{ width: 42, height: 42, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        <ChevronLeft size={26} style={{ color: '#fff' }} />
                    </button>
                )}
                {scale === 1 && !atLast && (
                    <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                        style={{ width: 42, height: 42, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        <ChevronRight size={26} style={{ color: '#fff' }} />
                    </button>
                )}

                {/* 확대 중 안내 */}
                {scale > 1 && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1 rounded-full" style={{ color: '#fff', background: 'rgba(0,0,0,0.6)' }}>
                        {Math.round(scale * 100)}% · 드래그로 이동 · 더블클릭으로 원래대로
                    </div>
                )}

                {/* 마지막 컷이면 안내 */}
                {atLast && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full" style={{ color: '#fff', background: 'rgba(142,111,183,0.85)' }}>
                        마지막 컷이에요 · 다음 화를 기다려주세요 ✨
                    </div>
                )}
            </div>

            {/* 하단 힌트 (모바일) */}
            <div className="shrink-0 text-center py-2" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>← → 또는 좌우로 밀어서 넘기기 · Ctrl+마우스휠로 확대</span>
            </div>
        </div>
    );
};
