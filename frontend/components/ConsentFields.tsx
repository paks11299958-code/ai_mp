import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TermsModal } from './TermsModal';
import type { ConsentInput } from '../types';
import './auth-v2.css';
export const emptyConsent = (): ConsentInput => ({ terms: false, privacy: false, age14: false });
export const hasRequiredConsent = (consent: ConsentInput) => consent.terms && consent.privacy && consent.age14;
const rows = [{ kind: 'terms', label: '이용약관' }, { kind: 'privacy', label: '개인정보 수집·이용' }, { kind: 'age14', label: '만 14세 이상' }] as const;
export function ConsentFields({ value, onChange, contactLabel = '선택한 이메일 또는 휴대전화번호', kakao = false }: { value: ConsentInput; onChange: (value: ConsentInput) => void; contactLabel?: string; kakao?: boolean }) {
    const [detail, setDetail] = useState<'terms' | 'privacy' | null>(null);
    const opener = useRef<HTMLButtonElement | null>(null);
    const close = () => { setDetail(null); requestAnimationFrame(() => opener.current?.focus()); };
    const copy = <><p>목적: 회원 식별·인증 및 서비스 제공</p><p>항목: {kakao ? '카카오 고유 ID, 카카오 닉네임, 카카오 계정 이메일(제공된 경우)' : `닉네임, 비밀번호, ${contactLabel}`}</p><p>보유·이용 기간: 회원 탈퇴 시까지(법정 보존분 제외)</p><p>동의를 거부할 수 있으나 회원가입이 제한됩니다.</p></>;
    return <><div className="auth-consent">
        <div className="auth-check auth-all"><label><input type="checkbox" checked={hasRequiredConsent(value)} onChange={e => onChange({ terms: e.target.checked, privacy: e.target.checked, age14: e.target.checked })} /><span>필수 항목에 모두 동의</span></label></div>
        {rows.map(({ kind, label }) => <div className="auth-check" key={kind}><label><input type="checkbox" checked={value[kind]} onChange={e => onChange({ ...value, [kind]: e.target.checked })} /><span>[필수] {label}</span></label>{kind !== 'age14' && <button type="button" className="auth-link" aria-label={`${label} 보기`} onClick={e => { opener.current = e.currentTarget; setDetail(kind); }}>보기</button>}</div>)}
        <div className="auth-privacy-copy">{copy}</div>
    </div>
    {detail === 'terms' && createPortal(<TermsModal onClose={close} />, document.body)}
    {detail === 'privacy' && <div className="auth-v2 auth-overlay auth-privacy-overlay" role="dialog" aria-modal="true" aria-label="개인정보 수집·이용 동의" onKeyDown={e => { if (e.key === 'Escape') close(); }}><div className="auth-content"><section className="auth-card"><h1>개인정보 수집·이용 동의</h1><div className="auth-privacy-copy">{copy}</div><button className="auth-primary" type="button" autoFocus onClick={close}>내용 확인하고 돌아가기</button></section></div></div>}
    </>;
}
