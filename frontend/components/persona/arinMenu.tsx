import React from 'react';
import { ARIN_ID } from '../../lib/entryChatThemes';
export const ARIN_GROUPS = [
    { label: '만들기', items: [{ key: 'marketing', label: '홍보글' }, { key: 'shorts-maker', label: '쇼츠' }] },
    { label: '팔기', items: [{ key: 'used', label: '판매글' }, { key: 'luxury', label: '명품확인' }] },
    { label: '찾기', items: [{ key: 'hotkeyword', label: '뜨는키워드' }, { key: 'reverse-prompt', label: '사진프롬프트' }] },
] as const;
/** 연속된 인사(role 'assistant')는 마지막 하나만 보여준다 — 화면 표시만, 저장 데이터는 그대로.
 *  ★10-03 서버 수정(인사 교체) 이전에 재방문마다 인사가 새로 쌓였다("다시 뵙게 되어 반갑네요" ×N).
 *  운영 DB 실측: role 'assistant' = 인사만(546건, 최장 211자), 실제 답변은 'model'. */
export const collapseGreetingRuns = <T extends { role: string }>(messages: T[]): T[] =>
    messages.filter((m, i) => !(m.role === 'assistant' && messages[i + 1]?.role === 'assistant'));

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
