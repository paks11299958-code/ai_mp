import React from 'react';
import { X } from 'lucide-react';

// 웹툰 세로 스크롤 뷰어 — 컷을 위→아래로 이어붙여 죽 스크롤(네이버웹툰식).
// 각 컷은 화면 폭에 꽉 차게(width:100%). PC에선 컨테이너 maxWidth로 과대 방지.
interface Props {
    cuts: string[];
    title?: string;
    onClose: () => void;
}

export const WebtoonScrollViewer: React.FC<Props> = ({ cuts, title, onClose }) => {
    return (
        <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: '#000' }}>
            {/* 상단 바 */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(0,0,0,0.85)' }}>
                <span className="text-sm font-bold truncate" style={{ color: '#fff', flex: 1 }}>{title || '웹툰'}</span>
                <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)' }}>
                    <X size={18} style={{ color: '#fff' }} />
                </button>
            </div>

            {/* 세로 스크롤 본문 — 컷을 폭 꽉 채워 연속으로 */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="mx-auto" style={{ maxWidth: 720 }}>
                    {cuts.map((url, i) => (
                        <img key={i} src={url} alt={`컷 ${i + 1}`} loading="lazy" draggable={false}
                            style={{ display: 'block', width: '100%', height: 'auto' }} />
                    ))}
                    <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        <p className="text-xs">마지막 컷이에요 · 다음 화를 기다려주세요 ✨</p>
                        <button onClick={onClose} className="mt-3 text-xs font-bold rounded-full px-4 py-2" style={{ color: '#fff', background: 'rgba(142,111,183,0.85)' }}>
                            목록으로
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
