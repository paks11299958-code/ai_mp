import React, { useEffect, useRef, useState } from 'react';
import { homepageApi, HomepageRequestRow } from '../services/apiService';
import { buildFeatureShareLink, getMyReferralCode } from '../services/referral';
import { HomepageEditPanel } from './HomepageEditPanel';

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
    hours: string; phone: string; kakao: string; mood: string; referenceUrl: string;
}
const EMPTY_FORM: FormState = { biz: '', name: '', tagline: '', detail: '', menu: '', address: '', hours: '', phone: '', kakao: '', mood: '', referenceUrl: '' };

// 상태 표시(리스트 화면).
const STATUS_LABEL: Record<string, string> = { pending: '대기 중', processing: '제작 중', done: '완성', failed: '실패' };

const MOOD_CHIPS = ['따뜻한', '모던한', '고급스러운', '아기자기한', '신뢰감 있는', '활기찬'];

// 예상 분 → 읽기 쉬운 표기(60분 미만=분, 이상=시간+분). 운영시간 밖 대기(수백 분)도 자연스럽게.
function fmtEta(min: number): string {
    if (min < 1) return '곧';
    if (min < 60) return `${min}분`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export const HomepageBoard: React.FC<Props> = ({ onClose }) => {
    const [step, setStep] = useState<'intro' | 'form' | 'waiting' | 'result' | 'list'>('intro');
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [reqId, setReqId] = useState<number | null>(null);
    const [row, setRow] = useState<HomepageRequestRow | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [shareMsg, setShareMsg] = useState<string | null>(null);
    const [lastDone, setLastDone] = useState<HomepageRequestRow | null>(null);
    const [mineList, setMineList] = useState<HomepageRequestRow[]>([]);
    const [editTarget, setEditTarget] = useState<HomepageRequestRow | null>(null);
    const [editPanelKey, setEditPanelKey] = useState(0);   // 적용 후 화면 통째로 재마운트용(아래 참조)
    // 샘플 갤러리 미리보기 — target="_blank"가 인앱 웹뷰(카카오톡 등)에서 새 탭이 아니라
    // 현재 화면을 그대로 대체해버려 "뒤로가기=앱 이탈"처럼 보이던 문제(2026-07-22 사장 지적).
    // 외부로 나가지 않고 앱 안 iframe 모달로 띄운다.
    const [previewSample, setPreviewSample] = useState<{ label: string; url: string } | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 열 때 내 신청 이력 확인 — 진행 중이면 대기 화면으로 복귀, 완성본 있으면 인트로에 노출.
    useEffect(() => {
        (async () => {
            try {
                const mine = await homepageApi.mine();
                setMineList(mine);
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

    if (editTarget) {
        // key로 통째 재마운트 — 적용 직후 화면을 새로 띄우면 이미 배포·캐시가 반영된 뒤라
        // 바로 정상으로 보인다는 걸 실사용으로 확인(2026-07-20, 재새로고침 타이밍 맞추기보다
        // 훨씬 확실함). onApplied가 이 재마운트를 트리거.
        return <HomepageEditPanel key={editPanelKey} request={editTarget} onClose={() => setEditTarget(null)}
                                   onApplied={() => setEditPanelKey(k => k + 1)} />;
    }

    return (
        <>
        {/* 샘플 미리보기 — 외부 탭으로 안 나가고 앱 안 iframe으로(인앱 웹뷰에서 target="_blank"가
            새 탭 대신 현재 화면을 대체해 "뒤로가기=앱 이탈"처럼 보이던 문제, 2026-07-22). */}
        {previewSample && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 bg-white shrink-0">
                    <span className="text-sm font-bold text-gray-800">{previewSample.label} 미리보기</span>
                    <button onClick={() => setPreviewSample(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">×</button>
                </div>
                <iframe src={previewSample.url} title={previewSample.label} className="flex-1 w-full bg-white border-0" />
            </div>
        )}
        {/* 모바일 하단 탭바(약 64px+safe-area, MainPageNew의 .mpn-tabbar)를 이 모달이 덮어써서
            시트 하단부(가격 안내 등)가 탭바 밑에 가려지던 문제 — 모바일에서만 그만큼 바닥 여백을 준다. */}
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4
                         pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-4">
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
                                        <button key={s.slug} type="button" onClick={() => setPreviewSample({ label: s.label, url: s.url })}
                                           className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-center hover:bg-indigo-50 transition-colors">
                                            <div className="text-2xl">{s.emoji}</div>
                                            <div className="text-[11px] font-semibold text-gray-700 mt-1">{s.label}</div>
                                            <div className="text-[10px] text-gray-400">{s.mood}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {lastDone?.url && (
                                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-2">
                                    <span>🔗 지난번에 만든 시안이 있어요</span>
                                    <button onClick={() => setStep('list')}
                                            className="shrink-0 font-semibold underline" style={{ color: INDIGO }}>보러 가기</button>
                                </div>
                            )}
                            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs" style={{ color: INDIGO }}>
                                💎 1회 3,000P — 리서치·기획·사진 생성까지 약 10~20분, 실패하면 자동 환불돼요.
                            </div>
                            <button onClick={() => setStep('form')}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                                    style={{ backgroundColor: INDIGO }}>
                                ✨ 내 홈페이지 만들기 시작
                            </button>
                        </>
                    )}

                    {/* [list] 내가 만든 홈페이지 목록 */}
                    {step === 'list' && (
                        <>
                            <button onClick={() => setStep('intro')} className="text-xs text-gray-400">← 뒤로</button>
                            <p className="text-sm font-semibold text-gray-800">내가 만든 홈페이지</p>
                            {mineList.length === 0 && (
                                <p className="text-xs text-gray-400 py-6 text-center">아직 만든 시안이 없어요.</p>
                            )}
                            <button onClick={() => setStep('form')}
                                    className="w-full py-2.5 rounded-xl border text-sm font-semibold"
                                    style={{ borderColor: INDIGO, color: INDIGO }}>
                                ✨ 새 홈페이지 만들기
                            </button>
                            <div className="space-y-2">
                                {mineList.map(r => {
                                    let bizName = '';
                                    try { bizName = r.formJson ? (JSON.parse(r.formJson).name || '') : ''; } catch { /* 무시 */ }
                                    return (
                                        <div key={r.id} className="rounded-xl border border-gray-100 px-3 py-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-800 truncate">{bizName || `홈페이지 #${r.id}`}</span>
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${r.status === 'done' ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                                                      style={r.status === 'done' ? { backgroundColor: INDIGO } : undefined}>
                                                    {STATUS_LABEL[r.status] || r.status}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleString('ko-KR')}</div>
                                            {r.status === 'done' && r.url && (
                                                <div className="flex items-center gap-3 pt-0.5">
                                                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                                                       className="text-xs font-semibold underline" style={{ color: INDIGO }}>🔗 보러 가기</a>
                                                    {r.zipUrl && (
                                                        <a href={r.zipUrl} download className="text-xs underline text-gray-400 hover:text-gray-600">📦 소스 받기</a>
                                                    )}
                                                    <button onClick={() => setEditTarget(r)}
                                                            className="text-xs font-semibold underline ml-auto" style={{ color: INDIGO }}>✏️ 수정</button>
                                                </div>
                                            )}
                                            {r.status === 'failed' && (
                                                <div className="text-[11px] text-gray-400">{r.errorMessage || '생성에 실패했어요.'}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
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
                                    <input value={form.kakao} onChange={set('kakao')} maxLength={120} className={inputCls} style={inputStyle}
                                           placeholder="카카오톡 채널 링크 (예: pf.kakao.com/_abc123)" />
                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                        💬 넣으면 홈페이지의 <b>문의하기 버튼</b>이 내 카카오톡 채팅으로 바로 연결돼요.
                                        링크는 <b>카카오톡 채널 관리자센터 → 채널 링크 복사</b>에서, 채널이 없다면{' '}
                                        <a href="https://center-pf.kakao.com" target="_blank" rel="noopener noreferrer" className="underline">여기서 무료 개설</a>할 수 있어요.
                                    </p>
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
                                <div>
                                    <input value={form.referenceUrl} onChange={set('referenceUrl')} maxLength={200} className={inputCls} style={inputStyle}
                                           placeholder="참고하고 싶은 사이트 URL (선택)" />
                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                        🔗 마음에 드는 사이트가 있으면 주소를 넣어주세요 — 색감·분위기만 참고하고 로고·사진·문구는 그대로 베끼지 않아요.
                                    </p>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400">
                                입력한 내용은 홈페이지에 <b>공개</b>돼요 — 공개해도 되는 정보만 적어주세요.
                            </p>
                            {error && <div className="text-xs text-red-500">{error}</div>}
                            <button onClick={submit} disabled={submitting}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                    style={{ backgroundColor: INDIGO }}>
                                {submitting ? '신청 중…' : '🏠 홈페이지 만들기 (3,000P)'}
                            </button>
                            <button onClick={() => setStep('intro')} className="w-full py-2 text-xs text-gray-400">← 샘플 다시 보기</button>
                        </>
                    )}

                    {/* [3] 생성 대기 — 순번·예상시간·운영시간 안내(서버가 폴링 응답에 얹어줌) */}
                    {step === 'waiting' && (
                        <div className="py-10 text-center space-y-3">
                            <div className="inline-block w-8 h-8 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                            {row?.status === 'processing' ? (
                                <p className="text-sm font-medium text-gray-700">박하진이 지금 홈페이지를 만들고 있어요…</p>
                            ) : (
                                <p className="text-sm font-medium text-gray-700">신청이 접수됐어요! 순서대로 만들어 드릴게요.</p>
                            )}

                            {/* 순번 + 예상시간 카드 */}
                            {(row?.queuePosition || row?.etaMinutes) && (
                                <div className="mx-auto max-w-xs bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3.5 space-y-1.5">
                                    {row?.status === 'processing' ? (
                                        <div className="text-sm font-bold text-indigo-700">🛠️ 제작 중 · 곧 완성돼요</div>
                                    ) : (
                                        <div className="text-sm font-bold text-indigo-700">
                                            {row?.queuePosition === 1 ? '🎫 바로 다음 차례예요' : `🎫 대기 순번 ${row?.queuePosition}번째`}
                                        </div>
                                    )}
                                    {row?.etaMinutes != null && (
                                        <div className="text-xs text-indigo-500">⏱️ 예상 완성까지 약 {fmtEta(row.etaMinutes)}</div>
                                    )}
                                </div>
                            )}

                            <p className="text-xs text-gray-400">업종 리서치 → 기획 → 사진 생성 → 제작 순으로 진행돼요.<br />이 화면을 닫아도 계속 만들어져요 — 다시 열면 결과를 볼 수 있어요.</p>
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
        </>
    );
};
