import React, { useRef, useState } from 'react';
import { authApi } from '../services/apiService';
import { AuthFrame, AuthError, PasswordField } from './AuthUI';
interface ResetPasswordModalProps { token: string; onClose: () => void; }
export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ token, onClose }) => {
    const [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [done, setDone] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
    const busy=useRef(false);
    const finish=()=>{const params=new URLSearchParams(window.location.search);params.delete('token');window.history.replaceState({},'',window.location.pathname+(params.toString()?'?'+params.toString():''));onClose();};
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); if(busy.current)return; setError('');
        if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
        if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
        busy.current=true;setLoading(true);
        try { await authApi.resetPassword(token, password); setDone(true); } catch (err: any) { setError(err.message); } finally {busy.current=false;setLoading(false);}
    };
    return <AuthFrame><h1>{done ? '비밀번호를 변경했어요' : '새 비밀번호 설정'}</h1><p className="auth-subtitle">{done ? '새 비밀번호로 로그인해 주세요.' : 'AI 놀이터에서 사용할 새 비밀번호를 입력하세요.'}</p>{done ? <button className="auth-primary" type="button" onClick={finish}>로그인으로 돌아가기</button> : <form onSubmit={submit}><PasswordField label="새 비밀번호" value={password} onChange={setPassword} /><PasswordField label="새 비밀번호 확인" value={confirm} onChange={setConfirm} /><AuthError message={error} /><button className="auth-primary" type="submit" disabled={loading}>{loading ? '처리 중…' : '비밀번호 변경하기'}</button></form>}</AuthFrame>;
};
