import React, { useEffect, useRef, useState } from 'react';
import { shortsMakerApi, UserShortsRow } from '../services/apiService';

// 이아린 — 쇼츠 만들기 보드. 이미지(최대 3장) + 신청서 → 서로 다른 후킹 앵글의 시나리오
// 5개를 만들어 보여주고, 회원이 고른 1개만 실제 TTS+영상으로 제작한다(homepage 만들기와
// 동일한 비동기 큐+포인트 선차감 패턴). 2단계 과금: ①리서치+시나리오5개 ②선택 후 영상 제작.
// 사장 확정(2026-07-22): 참고 쇼츠는 URL 직접 입력(자동 검색 X — 저작권/신뢰성 리스크 회피),
// TTS/자막은 마지막 단계에서 선택 언어(한/중/일/영/베)로.
// 사장 확정(2026-07-23): 이미지 1장→최대 3장. 실제 업로드 사진을 "참고자료"로 대본 생성에
// 함께 첨부(Vision) — AI가 어느 세그먼트에 어느 실사진이 맞는지 판단하고, 맞는 게 없는
// 세그먼트만 나노바나나로 재생성(shorts_maker_worker.build_final_script 참고).

interface Props {
    onClose: () => void;
}

const PINK = '#D85C95';   // 아린 팔레트
const MAX_IMAGES = 3;     // shared-api MAX_IMAGES와 동일(사장 확정 2026-07-23)

// 실제 매일 자동 생성되는 쇼츠 완성본 2편 — 신뢰 형성용 샘플(HomepageBoard 패턴과 동일 취지).
const SAMPLES = [
    { label: '헤어스타일 체험', emoji: '💇', url: 'https://youtube.com/shorts/znnbawP26zo' },
    { label: 'AI 프로필사진', emoji: '🖼️', url: 'https://youtube.com/shorts/UFdVxKrmF8E' },
];

const MOOD_CHIPS = ['재밌는', '감성적인', '신뢰감 있는', '트렌디한', '따뜻한', '임팩트있는'];
const LANGUAGES: { code: string; label: string }[] = [
    { code: 'ko', label: '한국어' }, { code: 'zh', label: '중국어' }, { code: 'ja', label: '일본어' },
    { code: 'en', label: '영어' }, { code: 'vi', label: '베트남어' },
];

const STATUS_LABEL: Record<string, string> = {
    pending: '시나리오 준비 중', processing_research: '시나리오 준비 중',
    scenarios_ready: '선택 대기', producing: '영상 제작 중', processing_produce: '영상 제작 중',
    done: '완성', failed: '실패',
};

// 영상 제작(producing) 단계 세부 진행상황 — shorts_maker_worker.py의 _set_progress가 기록하는
// 순서와 1:1 대응(script→images→tts→verify). 사장 피드백(2026-07-23): 스피너만 돌아서 답답함.
const PROGRESS_STEPS: { key: 'script' | 'images' | 'tts' | 'verify'; label: string }[] = [
    { key: 'script', label: '대본을 다듬고 있어요' },
    { key: 'images', label: '사진을 장면마다 새로 그리고 있어요' },
    { key: 'tts', label: '목소리를 입히고 영상을 합치고 있어요' },
    { key: 'verify', label: '완성본을 마지막으로 점검하고 있어요' },
];

// 시나리오 준비(waiting) 단계 세부 진행상황 — process_research가 기록하는 순서와 1:1 대응
// (research→scenarios). 사장 피드백(2026-07-23): 이 단계도 스피너만 돌아서 답답함.
const WAITING_STEPS: { key: 'research' | 'scenarios'; label: string }[] = [
    { key: 'research', label: '업종·트렌드를 조사하고 있어요' },
    { key: 'scenarios', label: '서로 다른 시나리오 5개를 쓰고 있어요' },
];

interface FormState {
    biz: string; strengths: string; target: string; mood: string;
    referenceUrl1: string; referenceUrl2: string; language: string; qrUrl: string;
}
const EMPTY_FORM: FormState = { biz: '', strengths: '', target: '', mood: '', referenceUrl1: '', referenceUrl2: '', language: 'ko', qrUrl: '' };

export const ShortsMakerBoard: React.FC<Props> = ({ onClose }) => {
    const [step, setStep] = useState<'intro' | 'form' | 'waiting' | 'scenarios' | 'producing' | 'result' | 'list'>('intro');
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [reqId, setReqId] = useState<number | null>(null);
    const [row, setRow] = useState<UserShortsRow | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [mineList, setMineList] = useState<UserShortsRow[]>([]);
    const [previewSample, setPreviewSample] = useState<{ label: string; url: string } | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        shortsMakerApi.mine().then(setMineList).catch(() => {});
    }, []);

    // 폴링: pending(시나리오 대기)이면 scenarios_ready까지, producing이면 done/failed까지.
    useEffect(() => {
        if ((step !== 'waiting' && step !== 'producing') || !reqId) return;
        const tick = async () => {
            try {
                const r = await shortsMakerApi.get(reqId);
                setRow(r);
                if (r.status === 'scenarios_ready') { if (pollRef.current) clearInterval(pollRef.current); setStep('scenarios'); }
                else if (r.status === 'done' || r.status === 'failed') { if (pollRef.current) clearInterval(pollRef.current); setStep('result'); }
            } catch { /* 일시 오류는 다음 폴링에서 재시도 */ }
        };
        tick();
        pollRef.current = setInterval(tick, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [step, reqId]);

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files || []);
        if (picked.length === 0) return;
        const room = MAX_IMAGES - imageFiles.length;
        if (room <= 0) { setError(`이미지는 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.`); return; }
        const toAdd = picked.slice(0, room);
        if (toAdd.some(f => f.size > 6 * 1024 * 1024)) { setError('이미지는 장당 6MB 이내로 올려주세요.'); return; }
        setImageFiles(prev => [...prev, ...toAdd]);
        setImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
        setError(null);
        e.target.value = '';   // 같은 파일 재선택 가능하게
    };

    const removeImage = (idx: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const submit = async () => {
        if (imageFiles.length === 0) { setError('이미지를 1장 이상 올려 주세요.'); return; }
        if (form.biz.trim().length < 2) { setError('업종/상품명을 입력해 주세요.'); return; }
        if (form.strengths.trim().length < 2) { setError('핵심 장점을 입력해 주세요.'); return; }
        if (form.target.trim().length < 2) { setError('타겟 고객을 입력해 주세요.'); return; }
        setError(null); setSubmitting(true);
        try {
            const toB64 = (f: File) => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(f);
            });
            const images = await Promise.all(imageFiles.map(toB64));
            const body: Record<string, string> = {};
            (Object.keys(form) as (keyof FormState)[]).forEach(k => { const v = form[k].trim(); if (v) body[k] = v; });
            const res = await shortsMakerApi.create(body, images);
            setReqId(res.id); setRow(null); setStep('waiting');
        } catch (e: any) {
            if (e.code !== 'INSUFFICIENT_POINTS') setError(e.message || '신청에 실패했어요.');
        } finally {
            setSubmitting(false);
        }
    };

    const selectScenario = async (idx: number) => {
        if (!reqId) return;
        setSubmitting(true); setError(null);
        try {
            await shortsMakerApi.select(reqId, idx);
            setStep('producing');
        } catch (e: any) {
            if (e.code !== 'INSUFFICIENT_POINTS') setError(e.message || '선택에 실패했어요.');
        } finally {
            setSubmitting(false);
        }
    };

    const remove = async (id: number) => {
        if (!confirm('이 쇼츠를 삭제할까요?')) return;
        try {
            await shortsMakerApi.delete(id);
            setMineList(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert('삭제 실패: ' + e.message);
        }
    };

    const reset = () => {
        setForm(EMPTY_FORM); setImageFiles([]); setImagePreviews([]);
        setReqId(null); setRow(null); setError(null); setStep('intro');
        shortsMakerApi.mine().then(setMineList).catch(() => {});
    };

    const done = row?.status === 'done';

    return (
        <>
        {/* 샘플/완성 쇼츠 미리보기 — 유튜브 임베드(아직 완성 전 자기 영상은 자체 스트리밍). */}
        {previewSample && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 bg-white shrink-0">
                    <span className="text-sm font-bold text-gray-800">{previewSample.label}</span>
                    <button onClick={() => setPreviewSample(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">×</button>
                </div>
                <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
                    {/* 9:16 종횡비 고정 wrapper — 유튜브 iframe이 부모(flex-1, PC에서 뷰포트
                        전체 높이)를 100% 채우면 16:9 기준 임베드가 세로형 영상을 레터박스/
                        크롭해 보여주는 문제가 있었음(사장 실사용 피드백: "100%라서 잘림").
                        h-full 기준으로 9:16 비율을 유지하며 폭이 넘치면 max-w-full로 축소. */}
                    <div className="h-full max-h-full aspect-[9/16] max-w-full">
                        {previewSample.url.startsWith('http') && previewSample.url.includes('youtube.com') ? (
                            <iframe
                                src={previewSample.url.replace('youtube.com/shorts/', 'youtube.com/embed/')}
                                title={previewSample.label} className="w-full h-full border-0"
                                allow="autoplay; encrypted-media" allowFullScreen
                            />
                        ) : (
                            <video src={previewSample.url} controls autoPlay className="w-full h-full" />
                        )}
                    </div>
                </div>
            </div>
        )}
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4
                         pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🎬</span>
                        <h2 className="text-base font-bold" style={{ color: PINK }}>쇼츠 만들기</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* [intro] */}
                    {step === 'intro' && (
                        <>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                이미지 1장이면 마케팅 담당 <b>아린</b>이 <b>쇼츠 시나리오 5개</b>를 만들어 드려요.
                                마음에 드는 걸 고르면 실제 영상으로 완성해 드립니다.
                            </p>
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-gray-700">👀 이런 쇼츠가 나와요 — 눌러서 구경해 보세요</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {SAMPLES.map(s => (
                                        <button key={s.label} type="button" onClick={() => setPreviewSample(s)}
                                           className="rounded-xl border border-pink-100 bg-pink-50/50 p-3 text-center hover:bg-pink-50 transition-colors">
                                            <div className="text-2xl">{s.emoji}</div>
                                            <div className="text-[11px] font-semibold text-gray-700 mt-1">{s.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {mineList.length > 0 && (
                                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-2">
                                    <span>🎞️ 내가 만든 쇼츠가 있어요</span>
                                    <button onClick={() => setStep('list')}
                                            className="shrink-0 font-semibold underline" style={{ color: PINK }}>보러 가기</button>
                                </div>
                            )}
                            <div className="rounded-xl bg-pink-50 border border-pink-100 px-3 py-2 text-xs" style={{ color: PINK }}>
                                💎 시나리오 5개 300P → 마음에 드는 것 선택 시 영상 제작 1,500P. 실패하면 자동 환불돼요.
                            </div>
                            <button onClick={() => setStep('form')}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                                    style={{ backgroundColor: PINK }}>
                                ✨ 내 쇼츠 만들기 시작
                            </button>
                        </>
                    )}

                    {/* [list] 내가 만든 쇼츠 목록 */}
                    {step === 'list' && (
                        <>
                            <button onClick={() => setStep('intro')} className="text-xs text-gray-400">← 뒤로</button>
                            <p className="text-sm font-semibold text-gray-800">내가 만든 쇼츠</p>
                            {mineList.length === 0 && (
                                <p className="text-xs text-gray-400 py-6 text-center">아직 만든 쇼츠가 없어요.</p>
                            )}
                            <button onClick={() => setStep('form')}
                                    className="w-full py-2.5 rounded-xl border text-sm font-semibold"
                                    style={{ borderColor: PINK, color: PINK }}>
                                ✨ 새 쇼츠 만들기
                            </button>
                            <div className="space-y-2">
                                {mineList.map(r => {
                                    let bizName = '';
                                    try { bizName = r.formJson ? (JSON.parse(r.formJson).biz || '') : ''; } catch { /* 무시 */ }
                                    return (
                                        <div key={r.id} className="rounded-xl border border-gray-100 px-3 py-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-800 truncate">{bizName || `쇼츠 #${r.id}`}</span>
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${r.status === 'done' ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                                                      style={r.status === 'done' ? { backgroundColor: PINK } : undefined}>
                                                    {STATUS_LABEL[r.status] || r.status}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleString('ko-KR')}</div>
                                            {r.status === 'done' && r.hasVideo && (
                                                <div className="flex items-center gap-3 pt-0.5">
                                                    <button onClick={() => setPreviewSample({ label: bizName || `쇼츠 #${r.id}`, url: shortsMakerApi.videoUrl(r.id) })}
                                                            className="text-xs font-semibold underline" style={{ color: PINK }}>▶️ 보기</button>
                                                    <a href={shortsMakerApi.videoUrl(r.id)} download className="text-xs underline text-gray-400 hover:text-gray-600">📦 다운로드</a>
                                                    <button onClick={() => remove(r.id)}
                                                            className="text-xs underline text-gray-400 hover:text-red-500 ml-auto">🗑️ 삭제</button>
                                                </div>
                                            )}
                                            {r.status !== 'done' && (
                                                <button onClick={() => remove(r.id)}
                                                        className="text-xs underline text-gray-400 hover:text-red-500">🗑️ 삭제</button>
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

                    {/* [form] 신청서 */}
                    {step === 'form' && (
                        <>
                            <button onClick={() => setStep('intro')} className="text-xs text-gray-400">← 뒤로</button>
                            <p className="text-xs text-gray-500">
                                <b>업종/상품명·핵심 장점·타겟 고객</b>은 필수예요. 여기 적지 않은 효과·수치는 AI가 지어내지 않아요.
                            </p>
                            <div>
                                <label className="text-xs font-semibold text-gray-700 block mb-1">
                                    얼굴/제품 이미지 * <span className="font-normal text-gray-400">(최대 {MAX_IMAGES}장 — 실제 사진을 참고해 대본에 맞게 활용해요)</span>
                                </label>
                                {imagePreviews.length > 0 && (
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {imagePreviews.map((src, i) => (
                                            <div key={i} className="relative">
                                                <img src={src} alt={`업로드 ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                                                <button onClick={() => removeImage(i)} type="button"
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs leading-none flex items-center justify-center">×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {imageFiles.length < MAX_IMAGES && (
                                    <div onClick={() => fileRef.current?.click()}
                                         className="border-2 border-dashed border-pink-200 rounded-xl p-4 text-center cursor-pointer hover:bg-pink-50/50 transition-colors">
                                        <div className="text-gray-400 text-xs py-4">📷 눌러서 이미지를 올려주세요 ({imageFiles.length}/{MAX_IMAGES})</div>
                                    </div>
                                )}
                                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                            </div>
                            <input value={form.biz} onChange={set('biz')} placeholder="업종/상품명 * (예: 동네 베이커리, 수제 핸드크림)"
                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            <textarea value={form.strengths} onChange={set('strengths')} rows={2}
                                      placeholder="핵심 장점 * (예: 매일 새벽 직접 굽는 빵, 무방부제, 당일배송)"
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y" />
                            <input value={form.target} onChange={set('target')} placeholder="타겟 고객 * (예: 30대 자취 직장인)"
                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-gray-700">원하는 톤/무드</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {MOOD_CHIPS.map(m => (
                                        <button key={m} type="button"
                                                onClick={() => setForm(f => ({ ...f, mood: f.mood === m ? '' : m }))}
                                                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                                                style={form.mood === m ? { backgroundColor: PINK, color: '#fff', borderColor: PINK } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-gray-700">내레이션·자막 언어</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {LANGUAGES.map(l => (
                                        <button key={l.code} type="button"
                                                onClick={() => setForm(f => ({ ...f, language: l.code }))}
                                                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                                                style={form.language === l.code ? { backgroundColor: PINK, color: '#fff', borderColor: PINK } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input value={form.referenceUrl1} onChange={set('referenceUrl1')} placeholder="참고 쇼츠 URL 1 (선택)"
                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            <input value={form.referenceUrl2} onChange={set('referenceUrl2')} placeholder="참고 쇼츠 URL 2 (선택)"
                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            <div>
                                <input value={form.qrUrl} onChange={set('qrUrl')} placeholder="QR로 연결할 주소 (선택, 예: 스마트스토어·카카오채널)"
                                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                <p className="text-[11px] text-gray-400 mt-1">영상 마지막 2~3초에 QR코드로 보여드려요. 비워두면 QR 없이 완성돼요.</p>
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <button onClick={submit} disabled={submitting}
                                    className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
                                    style={{ backgroundColor: PINK }}>
                                {submitting ? '신청 중...' : '💎 300P — 시나리오 5개 받기'}
                            </button>
                        </>
                    )}

                    {/* [waiting] 시나리오 생성 대기 */}
                    {step === 'waiting' && (() => {
                        const curIdx = WAITING_STEPS.findIndex(s => s.key === row?.progressStep);
                        return (
                            <div className="py-6 space-y-4">
                                <p className="text-sm text-gray-700 text-center font-semibold">아린이 업종을 분석하고 시나리오 5개를 준비하고 있어요</p>
                                <div className="space-y-2.5 max-w-xs mx-auto">
                                    {WAITING_STEPS.map((s, i) => {
                                        const isDone = curIdx >= 0 && i < curIdx;
                                        const isCurrent = i === curIdx;
                                        return (
                                            <div key={s.key} className="flex items-center gap-2">
                                                {isDone ? (
                                                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-white text-[10px] rounded-full" style={{ backgroundColor: PINK }}>✓</span>
                                                ) : isCurrent ? (
                                                    <span className="w-4 h-4 shrink-0 animate-spin border-2 border-t-transparent rounded-full" style={{ borderColor: PINK, borderTopColor: 'transparent' }} />
                                                ) : (
                                                    <span className="w-4 h-4 shrink-0" />
                                                )}
                                                <span className={`text-xs ${isCurrent ? 'text-gray-800 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
                                                    {s.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 text-center">보통 30초~1분 정도 걸려요.</p>
                                <p className="text-xs text-gray-400 text-center">창을 닫아도 계속 만들어지고 있어요. 나중에 "내가 만든 쇼츠"에서 확인하세요.</p>
                            </div>
                        );
                    })()}

                    {/* [scenarios] 시나리오 5개 중 선택 */}
                    {step === 'scenarios' && row && (
                        <>
                            <p className="text-sm font-semibold text-gray-800">마음에 드는 시나리오를 골라주세요</p>
                            <div className="space-y-2">
                                {row.scenarios.map((s, i) => (
                                    <button key={i} onClick={() => selectScenario(i)} disabled={submitting}
                                            className="w-full text-left rounded-xl border border-gray-200 hover:border-pink-300 p-3 space-y-1 transition-colors disabled:opacity-60">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#FDE6F0', color: PINK }}>{s.angle}</span>
                                            <span className="text-sm font-semibold text-gray-800">{s.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 italic">"{s.hook}"</p>
                                        <p className="text-xs text-gray-400">{s.summary}</p>
                                    </button>
                                ))}
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <p className="text-[11px] text-gray-400 text-center">선택 시 영상 제작 1,500P가 추가로 차감돼요.</p>
                        </>
                    )}

                    {/* [producing] 영상 제작 대기 — 실제 서버 진행 단계(row.progressStep)를
                        체크리스트로 표시(사장 피드백 2026-07-23: 스피너만 돌아 답답함). */}
                    {step === 'producing' && (() => {
                        const curIdx = PROGRESS_STEPS.findIndex(s => s.key === row?.progressStep);
                        return (
                            <div className="py-6 space-y-4">
                                <p className="text-sm text-gray-700 text-center font-semibold">선택하신 시나리오로 영상을 만들고 있어요</p>
                                <div className="space-y-2.5 max-w-xs mx-auto">
                                    {PROGRESS_STEPS.map((s, i) => {
                                        const isDone = curIdx >= 0 && i < curIdx;
                                        const isCurrent = i === curIdx;
                                        const showCount = isCurrent && s.key === 'images' && row?.progressTotal;
                                        return (
                                            <div key={s.key} className="flex items-center gap-2">
                                                {isDone ? (
                                                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-white text-[10px] rounded-full" style={{ backgroundColor: PINK }}>✓</span>
                                                ) : isCurrent ? (
                                                    <span className="w-4 h-4 shrink-0 animate-spin border-2 border-t-transparent rounded-full" style={{ borderColor: PINK, borderTopColor: 'transparent' }} />
                                                ) : (
                                                    <span className="w-4 h-4 shrink-0" />
                                                )}
                                                <span className={`text-xs ${isCurrent ? 'text-gray-800 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
                                                    {s.label}{showCount ? ` (${row!.progressDone}/${row!.progressTotal})` : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 text-center">사진을 장면마다 새로 그려서 보통 3~5분 정도 걸려요.</p>
                                <p className="text-xs text-gray-400 text-center">창을 닫아도 계속 만들어지고 있어요. 나중에 "내가 만든 쇼츠"에서 확인하세요.</p>
                            </div>
                        );
                    })()}

                    {/* [result-완성] */}
                    {step === 'result' && done && row && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-800 text-center">🎉 쇼츠가 완성됐어요!</p>
                            <video src={shortsMakerApi.videoUrl(row.id)} controls className="w-full rounded-xl bg-black" style={{ aspectRatio: '9/16', maxHeight: 480 }} />
                            <div className="flex items-center justify-center gap-4 text-xs">
                                <a href={shortsMakerApi.videoUrl(row.id)} download className="underline font-semibold" style={{ color: PINK }}>📦 다운로드</a>
                                <button onClick={reset} className="underline text-gray-500">다른 쇼츠 만들기</button>
                            </div>
                        </div>
                    )}

                    {/* [result-실패] */}
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
