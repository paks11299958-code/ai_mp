import React, { useId, useState } from 'react';
import { validBirth } from './useDogyeolBirthGate';
import type { SajuBirth } from './useSajuRunner';
import './dogyeolBirth.css';
type BirthFormProps = {
    initial: SajuBirth | null; saving: boolean; error: string;
    onSave: (b: SajuBirth) => void; onCancel: () => void;
    eyebrow?: string; title?: string; desc?: string; submitLabel?: string; note?: string; inputPrefix?: string;
};
export const DogyeolBirthForm = ({ initial, saving, error, onSave, onCancel,
    eyebrow = '풀이 전에 · 명부 기록', title = '명부를 적어 주세요',
    desc = '태어난 정보를 바탕으로 흐름을 살펴봅니다.', submitLabel = '저장하고 이어가기',
    note = '태어난 시를 모르시면 ‘모름’을 선택하세요.', inputPrefix = 'db'
}: BirthFormProps) => {
    const instance = useId();
    const prefix = `${inputPrefix}-${instance}`;
    const [value, setValue] = useState<SajuBirth>((initial && validBirth(initial) ? initial : null) || {name:'',year:'',month:'',day:'',time:'모름',lunar:false});
    const change = (key: keyof SajuBirth, v: string | boolean) => setValue(b => ({...b,[key]:v}));
    return <section className="db-form" role="dialog" aria-modal="true" aria-labelledby={`${prefix}-title`} onClick={e => e.stopPropagation()} onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
            if (e.key === 'Tab') {
                const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),button:not(:disabled)')];
                const first = nodes[0], last = nodes[nodes.length-1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
        }}>
        <p className="db-step">{eyebrow}</p><h2 id={`${prefix}-title`}>{title}</h2><p>{desc}</p>
        <form onSubmit={e => { e.preventDefault(); onSave(value); }} noValidate>
            <label>이름<input id={`${prefix}-name`} name={`${prefix}-name`} autoFocus value={value.name} disabled={saving} autoComplete="name" maxLength={30} onChange={e => change('name',e.target.value)}/></label>
            <fieldset disabled={saving}><legend>달력</legend><label><input type="radio" name={`${prefix}-calendar`} checked={!value.lunar} onChange={() => change('lunar',false)}/>양력</label><label><input type="radio" name={`${prefix}-calendar`} checked={!!value.lunar} onChange={() => change('lunar',true)}/>음력</label></fieldset>
            <div className="db-date">{(['year','month','day'] as const).map((k,i) => <label key={k}>{['태어난 해','태어난 달','태어난 날'][i]}<input id={`${prefix}-${k}`} name={`${prefix}-${k}`} inputMode="numeric" value={value[k]} disabled={saving} placeholder={['1990','1','1'][i]} maxLength={i?2:4} onChange={e => change(k,e.target.value)}/></label>)}</div>
            <label>태어난 시<select id={`${prefix}-time`} name={`${prefix}-time`} value={value.time} disabled={saving} onChange={e => change('time',e.target.value)}>{['모름','자시(子時)','축시(丑時)','인시(寅時)','묘시(卯時)','진시(辰時)','사시(巳時)','오시(午時)','미시(未時)','신시(申時)','유시(酉時)','술시(戌時)','해시(亥時)'].map(t => <option key={t}>{t}</option>)}</select></label>
            <p className="db-note">{note}</p>{error && <p className="db-error" role="alert">{error}</p>}
            <button className="db-save" disabled={saving}>{saving?'명부 저장 중…':submitLabel}</button><button type="button" className="db-cancel" disabled={saving} onClick={onCancel}>취소하고 돌아가기</button>
        </form>
    </section>;
};
