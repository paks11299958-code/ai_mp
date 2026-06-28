import React, { useEffect, useRef, useState } from 'react';
import { marketingApi, MarketingRequestRow } from '../services/apiService';

// 사용자용 마케팅 콘텐츠 보드 — 개인 SNS 운영자가 주제를 넣으면 인스타 콘텐츠 초안을 받는다.
// 비동기: 요청(202) → 2분마다 워커가 처리 → 클라이언트가 폴링 → done/failed.
// 무료체험 1회 + 이후 포인트 차감(사장 설정 단가). 발행은 사용자가 직접.

interface Props {
    onClose: () => void;
    freeTrialUsed?: boolean;  // 이미 무료체험을 썼는지(있으면 차감 안내)
}

const PURPLE = '#8E6FB7';

// 입력 막막함 해소용 예시 — 칩 클릭 시 입력창에 그대로 채워진다(이후 수정 가능).
// "업종/대상 + 타깃 + 강조하고 싶은 점" 구조가 좋은 결과를 낸다는 걸 예시로 보여줌.
const TOPIC_SAMPLES = [
    '홍대 수제 마카롱 가게 신메뉴 출시, 20대 여성 타깃, 비주얼 강조',
    '1:1 헬스 PT 회원 모집, 30대 직장인, 첫 달 할인 이벤트',
    '내가 운영하는 네일샵 가을 신상 아트, 예약 유도',
    '온라인 스마트스토어 캠핑용품, 가성비와 후기 강조',
];

export const MarketingBoard: React.FC<Props> = ({ onClose, freeTrialUsed }) => {
    const [topic, setTopic] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reqId, setReqId] = useState<string | null>(null);
    const [row, setRow] = useState<MarketingRequestRow | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 폴링: reqId가 생기면 3초마다 상태 확인 → done/failed 되면 멈춤.
    useEffect(() => {
        if (!reqId) return;
        const tick = async () => {
            try {
                const r = await marketingApi.get(reqId);
                setRow(r);
                if (r.status === 'done' || r.status === 'failed') {
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            } catch { /* 일시 오류는 다음 폴링에서 재시도 */ }
        };
        tick();
        pollRef.current = setInterval(tick, 3000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [reqId]);

    const submit = async () => {
        const t = topic.trim();
        if (t.length < 2) { setError('무엇을 홍보할지 주제를 적어주세요.'); return; }
        setError(null); setSubmitting(true); setRow(null);
        try {
            const res = await marketingApi.request(t);
            setReqId(res.id);
        } catch (e: any) {
            if (e.code !== 'INSUFFICIENT_POINTS') setError(e.message || '요청에 실패했어요.');
            // 포인트 부족은 전역 충전모달이 뜨므로 별도 메시지 생략
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setReqId(null); setRow(null); setTopic(''); setError(null); setCopied(false);
    };

    const copy = async () => {
        if (!row?.result) return;
        try { await navigator.clipboard.writeText(row.result); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
    };

    const working = !!reqId && (!row || row.status === 'pending' || row.status === 'running');
    const done = row?.status === 'done';
    const failed = row?.status === 'failed';

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
                {/* 헤더 */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">✍️</span>
                        <h2 className="text-base font-bold" style={{ color: PURPLE }}>AI 마케팅 글쓰기</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* 입력 단계 */}
                    {!reqId && (
                        <>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                홍보하고 싶은 걸 적어주세요. 아린이가 <b>인스타그램</b> 콘텐츠 초안(후킹·캡션·해시태그·측정안)을 만들어 드려요.
                            </p>
                            <div className="rounded-xl bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-700">
                                {freeTrialUsed
                                    ? '이번 요청부터 포인트가 차감돼요.'
                                    : '🎁 첫 1회는 무료체험! 부담 없이 써보세요.'}
                            </div>

                            {/* 예시(샘플) — 막막할 때 칩을 눌러 채우고 자유롭게 고치세요 */}
                            <div className="space-y-1.5">
                                <p className="text-[11px] text-gray-500">💡 이렇게 적으면 좋아요 — <b>업종/상품 + 타깃 + 강조할 점</b>. 아래 예시를 눌러 채운 뒤 고쳐도 돼요.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {TOPIC_SAMPLES.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setTopic(s); setError(null); }}
                                            className="text-[11px] leading-snug text-left px-2.5 py-1.5 rounded-full border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <textarea
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                rows={3}
                                maxLength={200}
                                placeholder="예) 홍대 수제 마카롱 가게 신메뉴 출시, 20대 여성 타깃, 비주얼 강조"
                                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-purple-400 resize-none"
                                // 다크모드/OS 테마에서 글자색이 흐려져 안 보이는 문제 방지 — 색 인라인 고정
                                style={{ color: '#1f2937', backgroundColor: '#ffffff' }}
                            />
                            <div className="text-[11px] text-gray-400 text-right">{topic.length}/200</div>
                            {error && <div className="text-xs text-red-500">{error}</div>}
                            <button
                                onClick={submit}
                                disabled={submitting}
                                className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                                style={{ backgroundColor: PURPLE }}>
                                {submitting ? '요청 중…' : '✨ 콘텐츠 초안 만들기'}
                            </button>
                        </>
                    )}

                    {/* 작성 중(폴링) */}
                    {working && (
                        <div className="py-10 text-center space-y-3">
                            <div className="inline-block w-8 h-8 border-3 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                            <p className="text-sm font-medium text-gray-700">아린이가 글을 쓰고 있어요…</p>
                            <p className="text-xs text-gray-400">리서치부터 초안까지 약 1~2분 걸려요.<br/>이 화면을 닫아도 '내 요청'에서 다시 볼 수 있어요.</p>
                        </div>
                    )}

                    {/* 실패 */}
                    {failed && (
                        <div className="py-6 text-center space-y-3">
                            <p className="text-sm text-gray-700">{row?.failReason || '생성에 실패했어요.'}</p>
                            <p className="text-xs text-gray-400">차감된 포인트는 자동 환불됐어요.</p>
                            <button onClick={reset} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600">다시 시도</button>
                        </div>
                    )}

                    {/* 완료 */}
                    {done && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">주제: {row?.topic}</span>
                                <button onClick={copy} className="text-[11px] px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor: PURPLE }}>
                                    {copied ? '복사됨!' : '📋 복사'}
                                </button>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap text-gray-800 font-sans bg-gray-50 rounded-xl p-3 border border-gray-100" style={{ color: '#1f2937', backgroundColor: '#f9fafb' }}>{row?.result}</pre>
                            <div className="text-[11px] text-amber-600">⚠️ 발행 전 검토 필요 — 직접 확인 후 올려주세요.</div>
                            <button onClick={reset} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">다른 주제로 또 만들기</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
