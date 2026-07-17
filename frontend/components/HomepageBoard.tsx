import React, { useEffect, useRef, useState } from 'react';
import { homepageApi, HomepageRequestRow } from '../services/apiService';
import { buildFeatureShareLink, getMyReferralCode } from '../services/referral';

// 홈페이지 만들기 보드 — 신청서를 채우면 AI(박하진, 웹 전문가)가 홈페이지 시안을 만들어
// ①실제 링크(주인공) ②소스 zip(보조) 둘 다 제공. 결제 전 샘플 갤러리로 신뢰 형성.
// 비동기 큐: 신청(202, 1,000pt 선차감) → 서버2 워커가 생성·배포(2~5분) → 폴링 → done/failed(자동환불).
// 사장 확정(2026-07-17): 단가 1,000pt, 시안 링크가 주인공(위계 뒤집기 금지).

interface Props {
    onClose: () => void;
}

const INDIGO = '#5C6AC4';        // 박하진 팔레트(웹 전문가, from-indigo-500 to-violet-500 계열)

// 실배포 샘플(뼈대 단계에서 생성 엔진으로 실산출·검수 완료)
const SAMPLES = [
    { slug: 'sample-cafe',   label: '동네 카페',      mood: '따뜻한',      emoji: '☕' },
    { slug: 'sample-salon',  label: '미용실',         mood: '모던한',      emoji: '💇' },
    { slug: 'sample-realty', label: '공인중개사무소', mood: '신뢰감 있는', emoji: '🏢' },
].map(s => ({ ...s, url: `https://aichat.dbzone.kr/sites/homepage/${s.slug}/` }));

interface FormState {
    biz: string; name: string; tagline: string;
    detail: string; menu: string; address: string;
    hours: string; phone: string; mood: string;
}
const EMPTY_FORM: FormState = { biz: '', name: '', tagline: '', detail: '', menu: '', address: '', hours: '', phone: '', mood: '' };

const MOOD_CHIPS = ['따뜻한', '모던한', '고급스러운', '아기자기한', '신뢰감 있는', '활기찬'];

export const HomepageBoard: React.FC<Props> = ({ onClose }) => {
    const [step, setStep] = useState<'intro' | 'form' | 'waiting' | 'result'>('intro');
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [reqId, setReqId] = useState<number | null>(null);
    const [row, setRow] = useState<HomepageRequestRow | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [shareMsg, setShareMsg] = useState<string | null>(null);
    const [lastDone, setLastDone] = useState<HomepageRequestRow | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 열 때 내 신청 이력 확인 — 진행 중이면 대기 화면으로 복귀, 완성본 있으면 인트로에 노출.
    useEffect(() => {
        (async () => {
            try {
                const mine = await homepageApi.mine();
                const busy = mine.find(r => r.status === 'pending' || r.status === 'processing');
                if (busy) { setReqId(busy.id); setRow(busy); setStep('waiting'); return; }
                const done = mine.find(r => r.status === 'done');
                if (done) setLastDone(done);
            } catch { /* 비로그인/일시 오류 — 인트로 그대로 */ }
        })();
    }, []);

    // 대기 폴링: 5초마다(생성 2~5분) — done/failed면 결과 화면으로.
    useEffect(() => {
        if (step !== 'waiting' || !reqId) return;
        const tick = async () => {
            try {
                const r = await homepageApi.get(reqId);
                setRow(r);
                if (r.status === 'done' || r.status === 'failed') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setStep('result');
                }
            } catch { /* 일시 오류는 다음 폴링에서 재시도 */ }
        };
        tick();
        pollRef.current = setInterval(tick, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [step, reqId]);

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const submit = async () => {
        if (form.biz.trim().length < 2) { setError('업종을 입력해 주세요. (예: 카페, 미용실)'); return; }
        if (form.name.trim().length < 2) { setError('상호명을 입력해 주세요.'); return; }
        if (form.tagline.trim().length < 2) { setError('가게를 소개하는 한 줄을 입력해 주세요.'); return; }
        setError(null); setSubmitting(true);
        try {
            const body: Record<string, string> = {};
            (Object.keys(form) as (keyof FormState)[]).forEach(k => { const v = form[k].trim(); if (v) body[k] = v; });
            const res = await homepageApi.create(body);
            setReqId(res.id); setRow(null); setStep('waiting');
        } catch (e: any) {
            // 포인트 부족(402)은 전역 충전모달이 뜸 — 그 외만 메시지 표시
            if (e.code !== 'INSUFFICIENT_POINTS') setError(e.message || '신청에 실패했어요.');
        } finally {
            setSubmitting(false);
        }
    };

    // 공유: 시안 URL(주인공) + 내 추천코드 딥링크 — navigator.share → 클립보드 폴백.
    const share = async (siteUrl: string) => {
        const appLink = buildFeatureShareLink('homepage');
        const refHint = getMyReferralCode() ? '\n🎁 이 링크로 가입하면 두 분 다 +1000P!' : '';
        const text = `AI로 만든 우리 가게 홈페이지예요 🏠\n${siteUrl}\n\n나도 만들어보기 → ${appLink}${refHint}`;
        try {
            if (navigator.share) { await navigator.share({ title: 'AI 홈페이지 시안', text }); return; }
        } catch { return; /* 사용자가 시트 닫음 */ }
        try {
            await navigator.clipboard.writeText(text);
            setShareMsg('공유 문구가 복사되었습니다 📋');
            setTimeout(() => setShareMsg(null), 2000);
        } catch { /* 무시 */ }
    };

    const reset = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setReqId(null); setRow(null); setForm(EMPTY_FORM); setError(null); setStep('form');
    };

    const inputCls = 'w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-indigo-400';
    // 다크모드/OS 테마에서 입력 글자 흐려짐 방지 — 색 인라인 고정(전역 규칙)
    const inputStyle: React.CSSProperties = { color: '#1f2937', backgroundColor: '#ffffff' };

    const done = row?.status === 'done';

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
                {/* 헤더 */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🏠</span>
                        <h2 className="text-base font-bold" style={{ color: INDIGO }}>홈페이지 만들기</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* [1] 인트로: 샘플 갤러리 + 시작 CTA */}
                    {step === 'intro' && (
                        <>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                신청서만 채우면 웹 전문가 <b>박하진</b>이 <b>우리 가게 홈페이지 시안</b>을 만들어 <b>실제 링크</b>로 드려요.
                                링크는 바로 공유할 수 있고, 소스코드(zip)도 함께 드려요.
                            </p>
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-gray-700">👀 이런 홈페이지가 나와요 — 눌러서 구경해 보세요</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {SAMPLES.map(s => (
                                        <a key={s.slug} href={s.url} target="_blank" rel="noopener noreferrer"
                                           className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-center hover:bg-indigo-50 transition-colors">
                                            <div className="text-2xl">{s.emoji}</div>
                                            <div className="text-[11px] font-semibold text-gray-700 mt-1">{s.label}</div>
                                            <div className="text-[10px] text-gray-400">{s.mood}</div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                            {lastDone?.url && (
                                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-2">
                                    <span>🔗 지난번에 만든 시안이 있어요</span>
                                    <a href={lastDone.url} target="_blank" rel="noopener noreferrer"
                                       className="shrink-0 font-semibold underline" style={{ color: INDIGO }}>보러 가기</a>
                                </div>
                            )}
                            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs" style={{ color: INDIGO }}>
                                💎 1회 1,000P — 완성까지 약 2~5분, 실패하면 자동 환불돼요.
                            </div>
                            <button onClick={() => setStep('form')}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                                    style={{ backgroundColor: INDIGO }}>
                                ✨ 내 홈페이지 만들기 시작
                            </button>
                        </>
                    )}

                    {/* [2] 신청서 폼 */}
                    {step === 'form' && (
                        <>
                            <p className="text-xs text-gray-500">
                                <b>업종·상호·한 줄 소개</b>만 필수예요. 나머지는 적은 만큼 홈페이지에 들어가고, 비우면 그 부분은 생략돼요.
                                <br />⚠️ 적지 않은 전화번호·주소·가격은 AI가 지어내지 않아요.
                            </p>
                            <div className="space-y-2.5">
                                <input value={form.biz} onChange={set('biz')} maxLength={40} className={inputCls} style={inputStyle}
                                       placeholder="업종 * (예: 카페, 미용실, 공인중개사)" />
                                <input value={form.name} onChange={set('name')} maxLength={40} className={inputCls} style={inputStyle}
                                       placeholder="상호명 * (예: 볕들카페)" />
                                <input value={form.tagline} onChange={set('tagline')} maxLength={80} className={inputCls} style={inputStyle}
                                       placeholder="한 줄 소개 * (예: 골목 안 직접 로스팅하는 작은 카페)" />
                                <textarea value={form.detail} onChange={set('detail')} rows={3} maxLength={600} className={`${inputCls} resize-none`} style={inputStyle}
                                          placeholder="상세 소개 (우리 가게 이야기, 자랑거리, 손님에게 하고 싶은 말)" />
                                <textarea value={form.menu} onChange={set('menu')} rows={3} maxLength={600} className={`${inputCls} resize-none`} style={inputStyle}
                                          placeholder={'메뉴/서비스와 가격 (한 줄에 하나씩)\n예) 아메리카노 4,500원\n     카페라떼 5,000원'} />
                                <input value={form.address} onChange={set('address')} maxLength={120} className={inputCls} style={inputStyle}
                                       placeholder="주소 (예: 서울 마포구 ○○길 12)" />
                                <div className="grid grid-cols-2 gap-2">
                                    <input value={form.hours} onChange={set('hours')} maxLength={120} className={inputCls} style={inputStyle}
                                           placeholder="영업시간" />
                                    <input value={form.phone} onChange={set('phone')} maxLength={30} className={inputCls} style={inputStyle}
                                           placeholder="전화번호" />
                                </div>
                                <div>
                                    <input value={form.mood} onChange={set('mood')} maxLength={60} className={inputCls} style={inputStyle}
                                           placeholder="원하는 분위기 (아래에서 골라도 돼요)" />
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {MOOD_CHIPS.map(m => (
                                            <button key={m} type="button" onClick={() => setForm(f => ({ ...f, mood: m }))}
                                                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${form.mood === m ? 'text-white' : 'text-gray-500 bg-white border-gray-200'}`}
                                                    style={form.mood === m ? { backgroundColor: INDIGO, borderColor: INDIGO } : undefined}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400">
                                입력한 내용은 홈페이지에 <b>공개</b>돼요 — 공개해도 되는 정보만 적어주세요.
                            </p>
                            {error && <div className="text-xs text-red-500">{error}</div>}
                            <button onClick={submit} disabled={submitting}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                    style={{ backgroundColor: INDIGO }}>
                                {submitting ? '신청 중…' : '🏠 홈페이지 만들기 (1,000P)'}
                            </button>
                            <button onClick={() => setStep('intro')} className="w-full py-2 text-xs text-gray-400">← 샘플 다시 보기</button>
                        </>
                    )}

                    {/* [3] 생성 대기 */}
                    {step === 'waiting' && (
                        <div className="py-10 text-center space-y-3">
                            <div className="inline-block w-8 h-8 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="text-sm font-medium text-gray-700">박하진이 홈페이지를 만들고 있어요…</p>
                            <p className="text-xs text-gray-400">디자인부터 배포까지 약 2~5분 걸려요.<br />이 화면을 닫아도 완성돼요 — 다시 열면 결과를 볼 수 있어요.</p>
                        </div>
                    )}

                    {/* [4] 결과 — 링크(주인공) 크게 + zip(보조) 작게 + 공유 */}
                    {step === 'result' && done && row?.url && (
                        <div className="space-y-3 text-center py-2">
                            <div className="text-3xl">🎉</div>
                            <p className="text-sm font-semibold text-gray-800">홈페이지 시안이 완성됐어요!</p>
                            <a href={row.url} target="_blank" rel="noopener noreferrer"
                               className="block w-full py-4 rounded-xl text-white font-bold text-base shadow-md"
                               style={{ backgroundColor: INDIGO }}>
                                🔗 내 홈페이지 시안 보기
                            </a>
                            <button onClick={() => share(row.url!)}
                                    className="w-full py-2.5 rounded-xl border text-sm font-semibold"
                                    style={{ borderColor: INDIGO, color: INDIGO }}>
                                📣 친구·단골에게 공유하기
                            </button>
                            {shareMsg && <div className="text-xs" style={{ color: INDIGO }}>{shareMsg}</div>}
                            <div className="flex items-center justify-center gap-3 text-[11px] text-gray-400 pt-1">
                                {row.zipUrl && (
                                    <a href={row.zipUrl} className="underline hover:text-gray-600" download>
                                        📦 소스코드 받기(개발자 전달용)
                                    </a>
                                )}
                                <button onClick={reset} className="underline hover:text-gray-600">다른 홈페이지 만들기</button>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                                링크는 계속 열려 있어요. 수정하고 싶은 부분이 있으면 소스코드를 개발자(또는 박하진 채팅)에게 전달해 보세요.
                            </p>
                        </div>
                    )}

                    {/* [4-실패] */}
                    {step === 'result' && !done && (
                        <div className="py-6 text-center space-y-3">
                            <p className="text-sm text-gray-700">{row?.errorMessage || '생성에 실패했어요.'}</p>
                            <p className="text-xs text-gray-400">차감된 포인트는 자동 환불됐어요.</p>
                            <button onClick={reset} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">다시 시도</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
