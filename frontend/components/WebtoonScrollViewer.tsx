import React from 'react';
import { X } from 'lucide-react';
import { getWatermarkText } from '../services/watermark';

// 웹툰 세로 스크롤 뷰어 — 컷을 위→아래로 이어붙여 죽 스크롤(네이버웹툰식).
// 각 컷은 화면 폭에 꽉 차게(width:100%). PC에선 컨테이너 maxWidth로 과대 방지.
// ★이미지 보호: 우클릭/길게누르기/드래그/선택 차단 + 반투명 워터마크(유출 추적) + 저작권 경고.
//   완벽 차단은 불가능(스크린샷 등) — 캐주얼 저장 차단 + 추적·억지가 목적.
interface Props {
    cuts: string[];
    title?: string;
    onClose: () => void;
}

// 이미지 보호 핸들러(우클릭/드래그 방지). 길게누르기·선택은 style로 차단.
const blockContextMenu = (e: React.MouseEvent) => e.preventDefault();
const blockDrag = (e: React.DragEvent) => e.preventDefault();

export const WebtoonScrollViewer: React.FC<Props> = ({ cuts, title, onClose }) => {
    const watermark = getWatermarkText();
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}
                onContextMenu={blockContextMenu}>
                <div className="mx-auto" style={{ maxWidth: 720 }}>
                    {cuts.map((url, i) => (
                        // 컷 + 워터마크를 같은 박스에 겹쳐 렌더(워터마크가 이미지와 함께 캡처되도록)
                        <div key={i} style={{ position: 'relative', display: 'block' }}>
                            <img src={url} alt={`컷 ${i + 1}`} loading="lazy" draggable={false}
                                onContextMenu={blockContextMenu} onDragStart={blockDrag}
                                style={{
                                    display: 'block', width: '100%', height: 'auto',
                                    userSelect: 'none', WebkitUserSelect: 'none',
                                    WebkitTouchCallout: 'none', pointerEvents: 'none',
                                }} />
                            {/* 반투명 워터마크(유출 추적용) — 컷마다 우하단에 은은하게 */}
                            <span style={{
                                position: 'absolute', right: 8, bottom: 8, pointerEvents: 'none',
                                fontSize: 10, color: 'rgba(255,255,255,0.28)',
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)', letterSpacing: '0.02em',
                                fontWeight: 600, userSelect: 'none',
                            }}>{watermark}</span>
                        </div>
                    ))}
                    {/* 저작권 경고 */}
                    <div className="text-center px-6 py-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        <p className="text-xs">마지막 컷이에요 · 다음 화를 기다려주세요 ✨</p>
                        <p className="mt-4 text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            ⚠️ 본 콘텐츠는 저작권법의 보호를 받습니다.<br />
                            무단 복제·캡처·배포 시 민·형사상 책임을 질 수 있으며,<br />
                            각 컷에는 이용자 식별 정보가 표시되어 있습니다.
                        </p>
                        <button onClick={onClose} className="mt-4 text-xs font-bold rounded-full px-4 py-2" style={{ color: '#fff', background: 'rgba(142,111,183,0.85)' }}>
                            목록으로
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
