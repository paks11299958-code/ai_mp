import React from 'react';
import { ARIN_ID } from '../../lib/entryChatThemes';
export const ARIN_GROUPS = [
    { label: '만들기', items: [{ key: 'marketing', label: '홍보글' }, { key: 'shorts-maker', label: '쇼츠' }] },
    { label: '팔기', items: [{ key: 'used', label: '판매글' }, { key: 'luxury', label: '명품확인' }] },
    { label: '찾기', items: [{ key: 'hotkeyword', label: '뜨는키워드' }, { key: 'reverse-prompt', label: '사진프롬프트' }] },
] as const;
export const rememberReturn = (personaId: string = ARIN_ID) => {
    const back = `/?p=${encodeURIComponent(personaId)}`;
    try { sessionStorage.setItem('rp:backTo', back); } catch { /* storage blocked: preserve navigation */ }
};
export const ArinMenu: React.FC<{ onFeature: (key: string) => void; disabled?: boolean; compact?: boolean }> = ({ onFeature, disabled, compact }) => <div className={`arin-groups${compact ? ' arin-compact' : ''}`}>
    {ARIN_GROUPS.map(group => <section className="arin-group" key={group.label}><h3>{group.label}</h3><div className="arin-pair">
        {group.items.map(item => <button type="button" className="arin-tile" key={item.key} data-feature={item.key} aria-label={item.label} onClick={() => onFeature(item.key)} disabled={disabled}>
            <span className="arin-thumb"><img src={`/arin/menu/${item.key}.webp`} alt="" width="400" height="400" />{!compact && item.key === 'used' && <span className="arin-example-price">35,000원</span>}</span><span className="arin-label">{item.label}</span>
        </button>)}
    </div></section>)}
</div>;
