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
    personaName?: string;   // 헤더에 "누가 말하는지" 표시(없으면 헤더 생략)
    accent?: string;        // 페르소나 palette.accent (없으면 기본 보라)
    bg?: string;            // 페르소나 palette.bg
}

interface Props {
    config: SubMenuConfig;
    onSelect: (item: SubMenuItem) => void;
    onClose: () => void;
}

// 라벨 앞에 이미 이모지가 있으면 그걸 쓰고, 없으면 기본 아이콘
const leadingEmoji = (s: string) => {
    const m = s.match(/^(\p{Extended_Pictographic}️?)\s*/u);
    return m ? { icon: m[1], text: s.slice(m[0].length) } : { icon: '·', text: s };
};

/**
 * 페르소나 하위 메뉴 선택 모달.
 *
 * ★2026-07-29 전면 재디자인(사장 지적: "색상이 칙칙하고 전체적으로 안 어울린다"):
 *  - 종전 배경이 `#0d0b08`(거의 검정)이라 **밝은 아이보리(#FBF8F3) 사이트 위에서
 *    검은 상자가 튀어나온 것처럼** 보였다. 원인은 테두리가 아니라 **명도 대비**.
 *  - 색을 새로 만들지 않고 **페르소나 palette(카드 색)를 그대로 받아써** 카드→채팅→
 *    모달이 한 줄기로 이어지게 한다(도결선생=연보라 #EEE5F8 / accent #6B4FA0).
 *  - 버튼 높이 56→44px, 아이콘+오른쪽 › 로 "누를 것"임을 명확히, 배경 blur로 부유감.
 *  - ★닫기는 우상단 ✕ + 하단 버튼 **둘 다** 둔다. 이 모달은 화면 하단에 뜨는데
 *    우상단만 두면 모바일에서 엄지가 왕복해야 한다.
 */
export const SubMenuModal: React.FC<Props> = ({ config, onSelect, onClose }) => {
    const accent = config.accent || '#6B4FA0';
    const surface = config.bg ? `${config.bg}` : '#F5F0FB';

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-32"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div
                className="rounded-[18px] shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
                style={{
                    background: `linear-gradient(170deg, #FFFFFF 0%, ${surface} 100%)`,
                    border: `1px solid ${accent}33`,
                }}
                onClick={e => e.stopPropagation()}>

                {/* 헤더 — 누가 말하는지 + 우상단 닫기 */}
                {config.personaName && (
                    <div className="flex items-center justify-between pl-5 pr-3 pt-4 pb-2">
                        <p className="text-xs font-semibold tracking-wide" style={{ color: accent }}>
                            {config.personaName}
                        </p>
                        <button onClick={onClose} aria-label="닫기"
                            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
                            style={{ color: `${accent}99` }}
                            onMouseEnter={e => (e.currentTarget.style.background = `${accent}14`)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            ✕
                        </button>
                    </div>
                )}

                {/* 대사 — 위 여백을 넉넉히(종전엔 위에 딱 붙어 답답했다) */}
                <div className={`px-5 ${config.personaName ? 'pt-1' : 'pt-6'} pb-4`}>
                    <p className="text-[13px] italic leading-relaxed" style={{ color: `${accent}D9` }}>
                        “{config.dialog}”
                    </p>
                </div>

                <div style={{ height: 1, background: `${accent}1F` }} />

                {/* 선택지 — 44px 높이, 아이콘 + 오른쪽 › */}
                <div className="px-3 py-2">
                    {config.items.map(item => {
                        const { icon, text } = leadingEmoji(item.label);
                        return (
                            <button
                                key={item.label}
                                onClick={() => onSelect(item)}
                                className="w-full h-11 px-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors"
                                style={{ color: '#3F3350', background: 'transparent' }}
                                onMouseEnter={e => (e.currentTarget.style.background = `${accent}14`)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span className="text-base w-5 text-center shrink-0">{icon}</span>
                                <span className="flex-1 text-left">{text}</span>
                                <span className="text-base shrink-0" style={{ color: `${accent}80` }}>›</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ height: 1, background: `${accent}1F` }} />

                {/* 하단 닫기 — 모바일 엄지 위치. 우상단 ✕와 병행 */}
                <button
                    onClick={onClose}
                    className="w-full py-3 text-[13px] font-medium transition-colors"
                    style={{ color: `${accent}B3`, background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${accent}0F`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    닫기
                </button>
            </div>
        </div>
    );
};
