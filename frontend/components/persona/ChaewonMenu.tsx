import React from 'react';

interface Props {
    onStock: () => void;
    onPicks: () => void;
    onChat: () => void;
    disabled?: boolean;
}

export const ChaewonMenu: React.FC<Props> = ({ onStock, onPicks, onChat, disabled }) => {
    const items = [
        { key: 'stock', title: '내 종목 분석', description: '궁금한 종목을 데이터로 살펴봐요', icon: '↗', action: onStock },
        { key: 'stock-picks', title: 'AI 관심 종목', description: '오늘 AI가 살펴본 종목을 읽어요', icon: '◎', action: onPicks },
        { key: 'chat', title: '채원과 대화', description: '시장과 보고서에 대해 물어보세요', icon: '…', action: onChat },
    ];
    return (
        <div className="cw-menu">
            {items.map(item => (
                <button type="button" className="cw-action" key={item.key} data-feature={item.key}
                    disabled={disabled} onClick={item.action}>
                    <span className="cw-symbol" aria-hidden="true">{item.icon}</span>
                    <span className="cw-action-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                    <span aria-hidden="true">→</span>
                </button>
            ))}
        </div>
    );
};
