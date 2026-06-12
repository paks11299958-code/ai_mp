import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// 웹툰 컷 뷰어 — 풀스크린, 컷을 좌우로 넘긴다(전자책식). ←→ 버튼 + 모바일 스와이프 + 진행바.
interface Props {
    cuts: string[];          // 컷 이미지 URL 배열
    title?: string;          // 회차 제목(상단 표시)
    startIndex?: number;     // 시작 컷
    onClose: () => void;
}

export const WebtoonViewer: React.FC<Props> = ({ cuts, title, startIndex = 0, onClose }) => {
    const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, cuts.length - 1)));
    const total = cuts.length;
    const touchX = useRef<number | null>(null);

    // 컷별 가로:세로 비율(width/height) 캐시. 로드되면 채워진다.
    const [ratios, setRatios] = useState<Record<number, number>>({});
    const onImgLoad = (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        if (img.naturalWidth && img.naturalHeight) {
            setRatios(prev => prev[i] ? prev : { ...prev, [i]: img.naturalWidth / img.naturalHeight });
        }
    };
    // 컷 영역(뷰포트) 비율 — 컷이 이보다 넓적하면 폭 맞춤, 좁고 길면 높이 맞춤(=화면 꽉 채움).
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [boxRatio, setBoxRatio] = useState(0.62); // 모바일 세로 기본값
    useEffect(() => {
        const measure = () => {
            const el = boxRef.current;
            if (el && el.clientHeight) setBoxRatio(el.clientWidth / el.clientHeight);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);
    // 현재 컷을 어떻게 맞출지: 비율 알기 전엔 폭 맞춤. 알면 가로형/약가로=폭 꽉, 세로형=높이.
    const fitStyle = (i: number): React.CSSProperties => {
        const r = ratios[i];
        if (!r) return { maxWidth: '100%', height: 'auto' };
        // 아주 긴 컷(스크롤 웹툰)은 폭 맞춤 + 세로 스크롤로 읽게.
        if (r < boxRatio * 0.5) return { width: '100%', height: 'auto' };
        // 가로형 + 약간 가로(화면비의 0.85배 이상)면 폭을 꽉 채움 → 데스크탑에서 화면 가득.
        if (r >= boxRatio * 0.85) return { width: '100%', height: 'auto', maxHeight: '100%' };
        // 그보다 세로면 높이 맞춤(모바일 세로 컷은 꽉 참).
        return { height: '100%', width: 'auto', maxWidth: '100%' };
    };
    // 화면보다 세로로 '훨씬' 긴 컷(긴 스크롤 웹툰)은 위 정렬+스크롤. 그 외 중앙.
    const isLong = (i: number) => { const r = ratios[i]; return !!r && r < boxRatio * 0.5; };

    const go = useCallback((dir: -1 | 1) => {
        setIdx(prev => {
            const next = prev + dir;
            if (next < 0 || next >= total) return prev;
            return next;
        });
    }, [total]);

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

    // 모바일 스와이프
    const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); // 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전
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
            <div ref={boxRef} className="flex-1 relative overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                {/* 현재 컷 — 비율 따라 폭/높이 자동맞춤. 화면보다 길면 스크롤 가능. */}
                <div className={`absolute inset-0 overflow-y-auto flex justify-center p-2 ${isLong(idx) ? 'items-start' : 'items-center'}`}>
                    <img src={cuts[idx]} alt={`컷 ${idx + 1}`} draggable={false} onLoad={onImgLoad(idx)}
                        style={{ ...fitStyle(idx), objectFit: 'contain', flexShrink: 0 }} />
                </div>

                {/* 좌우 넘김 버튼 (데스크탑 위주, 모바일은 스와이프) */}
                {!atFirst && (
                    <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                        style={{ width: 42, height: 42, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        <ChevronLeft size={26} style={{ color: '#fff' }} />
                    </button>
                )}
                {!atLast && (
                    <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                        style={{ width: 42, height: 42, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)' }}>
                        <ChevronRight size={26} style={{ color: '#fff' }} />
                    </button>
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
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>← → 또는 좌우로 밀어서 넘기기</span>
            </div>
        </div>
    );
};
