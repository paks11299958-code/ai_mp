import React, { useRef, useState } from 'react';
import { authApi } from '../services/apiService';
import { ConsentFields, emptyConsent, hasRequiredConsent } from './ConsentFields';
import { AuthError } from './AuthUI';
export function KakaoConsentSheet({ onConfirmed, onLogout }: { onConfirmed: () => void; onLogout: () => void }) {
    const [value, setValue] = useState(emptyConsent), [loading, setLoading] = useState(false), [error, setError] = useState('');const busy=useRef(false);
    const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy.current||!hasRequiredConsent(value))return;busy.current=true;setLoading(true);setError('');try{const result=await authApi.consent(value);if(!result.recorded)throw new Error('동의 기록을 저장하지 못했습니다. 다시 시도해주세요.');onConfirmed();}catch(e:any){setError(e.message||'동의 기록을 저장하지 못했습니다. 다시 시도해주세요.');}finally{busy.current=false;setLoading(false);}};
    return <div className="auth-v2 auth-overlay auth-consent-sheet" role="dialog" aria-modal="true" aria-label="카카오 가입 필수 동의"><div className="auth-content"><section className="auth-card"><p className="auth-brand">AI 놀이터</p><h1>마지막으로 동의해 주세요</h1><p className="auth-subtitle">카카오로 처음 가입하셨나요? 필수 항목을 확인하면 AI 놀이터를 시작할 수 있어요.</p><form onSubmit={submit}><ConsentFields value={value} onChange={setValue} kakao /><AuthError message={error} /><button className="auth-primary" type="submit" disabled={loading||!hasRequiredConsent(value)}>{loading?'저장 중…':'동의하고 시작하기'}</button></form><button type="button" className="auth-link" disabled={loading} onClick={onLogout}>로그아웃하고 돌아가기</button></section></div></div>;
}
