import React from 'react';

export interface SubMenuItem {
    label: string;
    prompt: string;
    placeholder?: string;
    partnerModal?: boolean;
    twoPartnerModal?: boolean;  // 친구 둘 궁합 — 상대 2명 입력
}

export interface SubMenuConfig {
    dialog: string;
    items: SubMenuItem[];
}

interface Props {
    config: SubMenuConfig;
    onSelect: (item: SubMenuItem) => void;
    onClose: () => void;
}

export const SubMenuModal: React.FC<Props> = ({ config, onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-32"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}>
            <div
                className="rounded-2xl shadow-2xl w-full max-w-sm mx-4"
                style={{
                    background: 'linear-gradient(160deg,#0d0b08 0%,#1c1408 100%)',
                    border: '1px solid rgba(140,90,20,0.4)',
                }}
                onClick={e => e.stopPropagation()}>

                {/* 대사 */}
                <div className="px-5 pt-5 pb-3">
                    <p className="text-sm italic leading-relaxed" style={{ color: 'rgba(251,191,36,0.8)' }}>
                        "{config.dialog}"
                    </p>
                </div>

                {/* 선택지 */}
                <div className="px-4 pb-5 flex flex-col gap-2">
                    {config.items.map(item => (
                        <button
                            key={item.label}
                            onClick={() => onSelect(item)}
                            className="w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all"
                            style={{
                                background: 'rgba(120,70,10,0.3)',
                                color: '#fde68a',
                                border: '1px solid rgba(140,90,20,0.35)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(140,90,20,0.5)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(120,70,10,0.3)')}>
                            {item.label}
                        </button>
                    ))}
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl text-sm font-medium transition-all mt-1"
                        style={{
                            background: 'rgba(120,70,10,0.45)',
                            color: '#fde68a',
                            border: '1px solid rgba(140,90,20,0.5)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(140,90,20,0.65)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(120,70,10,0.45)')}>
                        닫기 ×
                    </button>
                </div>
            </div>
        </div>
    );
};
