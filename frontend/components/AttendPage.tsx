import React, { useState, useEffect, useRef } from 'react';
import { Loader, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';

// ── 타입 ─────────────────────────────────────────────────

interface SheetInfo {
    sheetId: string;
    title: string;
    clubName: string;
    region?: string;
    createdAt: string;
}

type Step = 'loading' | 'phone' | 'nickname' | 'done' | 'already' | 'error';

// ── 유틸 ─────────────────────────────────────────────────

// 같은 폰에서 재방문 시 전화번호를 자동입력하기 위한 로컬 저장 키
const SAVED_PHONE_KEY = 'attend_phone';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류가 발생했습니다.' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}

// ── 메인 ─────────────────────────────────────────────────

export const AttendPage: React.FC<{ sheetUuid: string }> = ({ sheetUuid }) => {
    const [step, setStep]           = useState<Step>('loading');
    const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);
    const [phone, setPhone]         = useState('');
    const [nickname, setNickname]   = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [doneNickname, setDoneNickname] = useState('');
    const [attendedAt, setAttendedAt]     = useState('');
    const [alreadyAt, setAlreadyAt]       = useState('');
    const [phoneAutofilled, setPhoneAutofilled] = useState(false);
    const phoneRef    = useRef<HTMLInputElement>(null);
    const nicknameRef = useRef<HTMLInputElement>(null);

    // 출석부 정보 로드 + 저장된 전화번호 자동입력
    useEffect(() => {
        try {
            const saved = localStorage.getItem(SAVED_PHONE_KEY);
            if (saved) { setPhone(saved); setPhoneAutofilled(true); }
        } catch { /* 시크릿모드 등 localStorage 불가 — 무시 */ }
        apiFetch<SheetInfo>(`/api/attendance/${sheetUuid}`)
            .then(data => { setSheetInfo(data); setStep('phone'); })
            .catch(e  => { setError(e.message); setStep('error'); });
    }, [sheetUuid]);

    // 저장된 번호 지우고 직접 입력
    const clearSavedPhone = () => {
        try { localStorage.removeItem(SAVED_PHONE_KEY); } catch { /* 무시 */ }
        setPhone(''); setPhoneAutofilled(false); setError('');
        setTimeout(() => phoneRef.current?.focus(), 50);
    };

    // 출석 성공 시 전화번호 저장 (다음 재방문 자동입력)
    const savePhone = (p: string) => {
        try { localStorage.setItem(SAVED_PHONE_KEY, p); } catch { /* 무시 */ }
    };

    useEffect(() => {
        if (step === 'phone')    setTimeout(() => phoneRef.current?.focus(), 100);
        if (step === 'nickname') setTimeout(() => nicknameRef.current?.focus(), 100);
    }, [step]);

    // 연락처 제출
    const handlePhoneSubmit = async () => {
        const cleaned = phone.replace(/-/g, '').trim();
        if (!/^\d{10,11}$/.test(cleaned)) {
            setError('올바른 연락처를 입력해주세요. (숫자 10~11자리)');
            return;
        }
        setLoading(true); setError('');
        try {
            const res = await apiFetch<any>(`/api/attendance/${sheetUuid}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: cleaned }),
            });

            if (res.status === 'existing' && res.attended) {
                savePhone(cleaned);
                setDoneNickname(res.nickname);
                setAttendedAt(res.attendedAt);
                setStep('done');
            } else if (res.status === 'existing' && res.alreadyAttended) {
                savePhone(cleaned);
                setDoneNickname(res.nickname);
                setAlreadyAt(res.attendedAt);
                setStep('already');
            } else if (res.status === 'new_required') {
                setStep('nickname');
            }
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    };

    // 이름 + 출석 제출
    const handleNicknameSubmit = async () => {
        if (!nickname.trim()) { setError('이름(별명)을 입력해주세요.'); return; }
        setLoading(true); setError('');
        try {
            const cleaned = phone.replace(/-/g, '').trim();
            const res = await apiFetch<any>(`/api/attendance/${sheetUuid}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: cleaned, nickname: nickname.trim() }),
            });
            if (res.status === 'new' && res.attended) {
                savePhone(cleaned);
                setDoneNickname(res.member.nickname);
                setAttendedAt(res.attendedAt);
                setStep('done');
            }
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    };

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // ── 렌더링 ───────────────────────────────────────────

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10"
            style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%)' }}>

            {/* 로고 영역 */}
            <div className="mb-8 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl"
                    style={{ background: 'rgba(255,107,157,0.15)', border: '1px solid rgba(255,107,157,0.3)' }}>
                    🤝
                </div>
                {sheetInfo && (
                    <>
                        <p className="text-white/50 text-sm mb-1">{sheetInfo.clubName}{sheetInfo.region ? ` · ${sheetInfo.region}` : ''}</p>
                        <h1 className="text-white text-xl font-bold">{sheetInfo.title}</h1>
                    </>
                )}
                {step === 'loading' && <p className="text-white/40 text-sm mt-2">출석부 정보를 불러오는 중...</p>}
            </div>

            {/* 카드 */}
            <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>

                {/* 로딩 */}
                {step === 'loading' && (
                    <div className="flex justify-center py-6">
                        <Loader size={28} className="text-pink-400 animate-spin" />
                    </div>
                )}

                {/* 연락처 입력 */}
                {step === 'phone' && (
                    <>
                        <div>
                            <p className="text-white/70 text-sm font-medium mb-1">연락처 입력</p>
                            <p className="text-white/40 text-xs mb-4">
                                {phoneAutofilled
                                    ? '저장된 번호로 바로 출석할 수 있어요.'
                                    : '출석 확인을 위해 연락처를 입력해주세요.'}
                            </p>
                            <input
                                ref={phoneRef}
                                type="tel"
                                inputMode="numeric"
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setPhoneAutofilled(false); }}
                                placeholder="01012345678"
                                maxLength={13}
                                onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
                                className="w-full rounded-xl px-4 py-3 text-white text-base font-medium placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
                            />
                            {phoneAutofilled && (
                                <button onClick={clearSavedPhone}
                                    className="mt-2 text-xs text-white/40 hover:text-white/70 underline underline-offset-2">
                                    다른 번호로 출석하기
                                </button>
                            )}
                        </div>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <button
                            onClick={handlePhoneSubmit}
                            disabled={loading}
                            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C84B8F)', color: '#fff' }}
                        >
                            {loading ? <Loader size={16} className="animate-spin" /> : '출석 확인'}
                        </button>
                    </>
                )}

                {/* 이름 입력 (신규 회원) */}
                {step === 'nickname' && (
                    <>
                        <div className="flex items-center gap-2 mb-1">
                            <UserPlus size={18} className="text-pink-400" />
                            <p className="text-white/80 text-sm font-medium">처음 오셨네요! 이름을 알려주세요.</p>
                        </div>
                        <p className="text-white/40 text-xs mb-3">입력하신 이름으로 모임 회원으로 등록됩니다.</p>
                        <input
                            ref={nicknameRef}
                            type="text"
                            value={nickname}
                            onChange={e => setNickname(e.target.value)}
                            placeholder="예: 홍길동"
                            maxLength={20}
                            onKeyDown={e => e.key === 'Enter' && handleNicknameSubmit()}
                            className="w-full rounded-xl px-4 py-3 text-white text-base font-medium placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
                        />
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <button
                            onClick={handleNicknameSubmit}
                            disabled={loading}
                            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #FF6B9D, #C84B8F)', color: '#fff' }}
                        >
                            {loading ? <Loader size={16} className="animate-spin" /> : '가입하고 출석하기'}
                        </button>
                        <button
                            onClick={() => { setStep('phone'); setError(''); }}
                            className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
                        >
                            연락처 다시 입력
                        </button>
                    </>
                )}

                {/* 출석 완료 */}
                {step === 'done' && (
                    <div className="text-center py-4 space-y-3">
                        <CheckCircle size={52} className="mx-auto text-green-400" />
                        <div>
                            <p className="text-white text-lg font-bold">{doneNickname}님, 출석 완료!</p>
                            <p className="text-white/40 text-sm mt-1">{formatTime(attendedAt)}</p>
                        </div>
                        <div className="mt-4 p-3 rounded-xl text-xs text-white/40"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {sheetInfo?.clubName} 출석이 기록되었습니다 ✓
                        </div>
                    </div>
                )}

                {/* 이미 출석 */}
                {step === 'already' && (
                    <div className="text-center py-4 space-y-3">
                        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl"
                            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                            ✓
                        </div>
                        <div>
                            <p className="text-white text-lg font-bold">{doneNickname}님</p>
                            <p className="text-yellow-400 text-sm font-medium mt-1">이미 출석하셨습니다</p>
                            <p className="text-white/30 text-xs mt-1">{formatTime(alreadyAt)}</p>
                        </div>
                    </div>
                )}

                {/* 오류 */}
                {step === 'error' && (
                    <div className="text-center py-4 space-y-3">
                        <AlertCircle size={44} className="mx-auto text-red-400" />
                        <p className="text-white/60 text-sm">{error || '유효하지 않은 QR 코드입니다.'}</p>
                    </div>
                )}
            </div>

            <p className="mt-8 text-white/20 text-xs">aichat.dbzone.kr</p>
        </div>
    );
};
