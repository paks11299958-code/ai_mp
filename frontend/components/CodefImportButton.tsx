import React, { useState } from 'react';
import { X, Loader, ShieldCheck, AlertCircle, RefreshCw, Download } from 'lucide-react';

// 내보험 가져오기 (Codef credit4u) — insure4에서 이식, ai_mp 톤으로 재작성.
// 조회 결과 텍스트를 .txt File로 만들어 onImported로 넘김(보험분석 업로드에 자동 첨부).
interface Props {
    onImported: (file: File) => void;
}

type Step = 'idle' | 'modal' | 'loading' | '2way' | 'success' | 'error';

interface TwoWayInfo {
    jobIndex: number; threadIndex: number; jti: string; twoWayTimestamp: number;
    credit4uId?: string; credit4uPw?: string; phoneNo?: string; telecom?: string; isRegister?: boolean;
}

const TELECOM_OPTIONS = [
    { value: '0', label: 'SKT' }, { value: '1', label: 'KT' }, { value: '2', label: 'LG U+' },
    { value: '3', label: '알뜰폰(SKT)' }, { value: '4', label: '알뜰폰(KT)' }, { value: '5', label: '알뜰폰(LG U+)' },
];

const API = (p: string) => `/api/insurance-codef${p}`;

export const CodefImportButton: React.FC<Props> = ({ onImported }) => {
    const [step, setStep] = useState<Step>('idle');
    const [form, setForm] = useState({ name: '', front: '', back: '', phoneNo: '', telecom: '0' });
    const [smsCode, setSmsCode] = useState('');
    const [twoWayInfo, setTwoWayInfo] = useState<TwoWayInfo | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isTimeout, setIsTimeout] = useState(false);

    const reset = () => {
        setStep('idle'); setForm({ name: '', front: '', back: '', phoneNo: '', telecom: '0' });
        setSmsCode(''); setTwoWayInfo(null); setErrorMsg(''); setIsTimeout(false);
    };

    const deliver = (data: any) => {
        const blob = new Blob([data.text], { type: 'text/plain;charset=utf-8' });
        onImported(new File([blob], data.fileName, { type: 'text/plain' }));
        setStep('success');
        setTimeout(reset, 2000);
    };

    // 1차 요청
    const handleImport = async () => {
        if (!form.name.trim()) { setErrorMsg('이름을 입력해 주세요.'); return; }
        if (form.front.length !== 6) { setErrorMsg('주민등록번호 앞 6자리를 확인해 주세요.'); return; }
        if (form.back.length !== 7) { setErrorMsg('주민등록번호 뒤 7자리를 확인해 주세요.'); return; }
        if (!form.phoneNo.trim()) { setErrorMsg('휴대폰 번호를 입력해 주세요.'); return; }
        setStep('loading'); setErrorMsg('');
        try {
            const res = await fetch(API('/import'), {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: form.name, ssnFront: form.front, ssnBack: form.back, phoneNo: form.phoneNo.replace(/-/g, ''), telecom: form.telecom }),
            });
            const data = await res.json();
            if (data.requiresTwoWay) { setTwoWayInfo({ ...data.twoWayInfo, isRegister: data.isRegister }); setSmsCode(''); setErrorMsg(''); setStep('2way'); return; }
            if (!res.ok) throw new Error(data.error || '보험 조회에 실패했습니다.');
            deliver(data);
        } catch (e: any) {
            setErrorMsg(e.message || '오류가 발생했습니다.'); setStep('error');
        }
    };

    // 2차 요청 (SMS)
    const handleTwoWay = async () => {
        if (!smsCode.trim()) { setErrorMsg('SMS 인증번호를 입력해 주세요.'); return; }
        if (!twoWayInfo) return;
        setStep('loading'); setErrorMsg('');
        try {
            const res = await fetch(API('/import'), {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: form.name, ssnFront: form.front, ssnBack: form.back, twoWayData: { ...twoWayInfo, smsAuthNo: smsCode.trim() } }),
            });
            const data = await res.json();
            if (data.requiresTwoWay) { setTwoWayInfo({ ...data.twoWayInfo, isRegister: data.isRegister }); setSmsCode(''); setStep('2way'); return; }
            if (!res.ok) { setIsTimeout(!!data.timeout); throw new Error(data.error || '인증에 실패했습니다.'); }
            deliver(data);
        } catch (e: any) {
            setErrorMsg(e.message || '오류가 발생했습니다.'); setStep('error');
        }
    };

    const modalOpen = ['modal', 'loading', '2way', 'error'].includes(step);
    const input = 'w-full min-w-0 border border-[#EAE2D3] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#8E6FB7] bg-white text-[#2D2438]';
    const label = 'block text-xs font-semibold text-[#6B5F56] mb-1.5';

    return (
        <>
            {/* 트리거 버튼 — 열 때 폼 초기화(이전 입력 잔존 방지) */}
            <button type="button" onClick={() => { setForm({ name: '', front: '', back: '', phoneNo: '', telecom: '0' }); setSmsCode(''); setTwoWayInfo(null); setErrorMsg(''); setIsTimeout(false); setStep('modal'); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all"
                style={{ background: '#fff', color: '#7A5FA0', border: '1.5px solid #B49AC9' }}>
                <Download size={15} /> 내보험 가져오기 (자동 조회)
            </button>
            {step === 'success' && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 justify-center">
                    <ShieldCheck size={13} /> 보험 내역을 가져와 첨부했어요!
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center px-4 bg-black/50"
                    onClick={() => step !== 'loading' && reset()}>
                    <div className="w-full sm:max-w-sm bg-[#FBF8F3] rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        {/* 헤더 */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="text-[#8E6FB7]" />
                                <div>
                                    <div className="text-base font-bold text-[#2D2438]">내보험 가져오기</div>
                                    <div className="text-[11px] text-[#9089A1]">코드에프 연동</div>
                                </div>
                            </div>
                            <button onClick={reset} disabled={step === 'loading'} className="p-1 text-[#9089A1] hover:text-[#2D2438] disabled:opacity-40"><X size={18} /></button>
                        </div>

                        {/* 로딩 */}
                        {step === 'loading' && (
                            <div className="py-10 flex flex-col items-center gap-3 text-sm text-[#6B5F56]">
                                <Loader size={28} className="animate-spin text-[#8E6FB7]" />
                                조회 중이에요… 잠시만요
                            </div>
                        )}

                        {/* SMS 타임아웃 */}
                        {step !== 'loading' && isTimeout && (
                            <div className="space-y-3">
                                <div className="rounded-xl px-4 py-4 text-sm text-center leading-relaxed" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#B45309' }}>
                                    ⏱ SMS 인증 시간이 초과되었습니다.<br /><span className="text-xs">SMS 수신 후 빠르게 입력해 주세요.</span>
                                </div>
                                <button onClick={() => { setTwoWayInfo(null); setSmsCode(''); setErrorMsg(''); setIsTimeout(false); setStep('modal'); }}
                                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm" style={{ background: '#8E6FB7', color: '#fff' }}>
                                    <RefreshCw size={15} /> 처음부터 다시 시도
                                </button>
                            </div>
                        )}

                        {/* SMS 인증 단계 */}
                        {step !== 'loading' && !isTimeout && (step === '2way' || (step === 'error' && twoWayInfo)) && (
                            <div className="space-y-3">
                                <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(142,111,183,0.07)', border: '1px solid rgba(142,111,183,0.2)', color: '#7A5FA0' }}>
                                    📱 입력하신 휴대폰으로 SMS 인증번호가 발송되었습니다. 받으신 번호를 입력해 주세요.
                                </div>
                                <div>
                                    <label className={label}>SMS 인증번호 <span className="text-red-500">*</span></label>
                                    <input type="text" maxLength={8} placeholder="인증번호 입력" value={smsCode} autoFocus
                                        onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))}
                                        className={`${input} text-center tracking-[0.2em] text-lg`} />
                                </div>
                                {errorMsg && <div className="flex items-start gap-1.5 text-xs text-red-500"><AlertCircle size={13} className="shrink-0 mt-0.5" />{errorMsg}</div>}
                                <button onClick={handleTwoWay} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm" style={{ background: '#8E6FB7', color: '#fff' }}>
                                    <ShieldCheck size={15} /> 인증 완료
                                </button>
                                <button onClick={() => { setTwoWayInfo(null); setStep('modal'); setErrorMsg(''); }} className="w-full text-xs text-[#9089A1] py-1">← 처음부터 다시 입력</button>
                            </div>
                        )}

                        {/* 기본 입력 폼 */}
                        {step !== 'loading' && !isTimeout && !(step === '2way' || (step === 'error' && twoWayInfo)) && (
                            <div className="space-y-3">
                                <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(142,111,183,0.07)', border: '1px solid rgba(142,111,183,0.2)', color: '#7A5FA0' }}>
                                    🔒 주민등록번호는 RSA 암호화 후 조회에만 쓰이며 서버에 저장되지 않아요. SMS 인증 후 보험 계약정보를 가져옵니다.
                                </div>
                                <div>
                                    <label className={label}>이름 <span className="text-red-500">*</span></label>
                                    <input type="text" placeholder="홍길동" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={input} />
                                </div>
                                <div>
                                    <label className={label}>주민등록번호 <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" inputMode="numeric" maxLength={6} placeholder="앞 6자리"
                                            value={form.front} onChange={e => setForm(p => ({ ...p, front: e.target.value.replace(/\D/g, '') }))}
                                            className={`${input} flex-1`} />
                                        <span className="text-[#9089A1] shrink-0">-</span>
                                        <input type="password" inputMode="numeric" maxLength={7} placeholder="뒤 7자리"
                                            value={form.back} onChange={e => setForm(p => ({ ...p, back: e.target.value.replace(/\D/g, '') }))}
                                            className={`${input} flex-1`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={label}>통신사 <span className="text-red-500">*</span></label>
                                    <select value={form.telecom} onChange={e => setForm(p => ({ ...p, telecom: e.target.value }))} className={input}>
                                        {TELECOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={label}>휴대폰 번호 <span className="text-red-500">*</span></label>
                                    <input type="tel" inputMode="numeric" placeholder="01012345678" value={form.phoneNo}
                                        onChange={e => setForm(p => ({ ...p, phoneNo: e.target.value.replace(/[^0-9]/g, '') }))} className={input} />
                                </div>
                                {errorMsg && <div className="flex items-start gap-1.5 text-xs text-red-500"><AlertCircle size={13} className="shrink-0 mt-0.5" />{errorMsg}</div>}
                                <button onClick={handleImport} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm" style={{ background: '#8E6FB7', color: '#fff', boxShadow: '0 3px 12px -4px rgba(142,111,183,0.6)' }}>
                                    <Download size={15} /> 조회 후 자동 첨부
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
