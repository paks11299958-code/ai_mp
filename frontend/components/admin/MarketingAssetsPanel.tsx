import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/apiService';

// 이아린(마케팅) 산출물 조회 — /marketing 으로 생성된 리서치+초안을 목록·상세로 본다.
// 재발행 없음: 조회 + 복사(클립보드)까지. 실제 발행은 사람이 직접.
interface AssetRow { id: string; topic: string; channel: string; sourcesCount: number; createdAt: string }
interface AssetDetail extends AssetRow { report: string; draft: string; filePath: string | null }

const CHANNEL_LABEL: Record<string, string> = { thread: '스레드', instagram: '인스타', blog: '블로그' };
const CHANNEL_COLOR: Record<string, string> = {
    thread: 'bg-white/10 text-gray-200',
    instagram: 'bg-pink-500/20 text-pink-300',
    blog: 'bg-green-500/20 text-green-300',
};

export const MarketingAssetsPanel: React.FC = () => {
    const [rows, setRows] = useState<AssetRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [detail, setDetail] = useState<AssetDetail | null>(null);
    const [copied, setCopied] = useState<string>('');

    useEffect(() => {
        adminApi.getMarketingAssets()
            .then(setRows)
            .catch(() => setError('마케팅 자산을 불러오지 못했습니다.'));
    }, []);

    const openDetail = (id: string) => {
        setOpenId(id); setDetail(null);
        adminApi.getMarketingAsset(id).then(setDetail).catch(() => setError('상세를 불러오지 못했습니다.'));
    };

    const copy = async (text: string, what: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(what); setTimeout(() => setCopied(''), 1500);
        } catch { /* 클립보드 미지원 시 무시 */ }
    };

    if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;
    if (!rows) return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
    if (rows.length === 0) return (
        <div className="p-6 text-sm text-gray-400">
            아직 마케팅 자산이 없습니다. 텔레그램에서 <code className="px-1 bg-white/10 rounded text-gray-200">/marketing 주제</code> 로 생성하면 여기에 쌓입니다.
        </div>
    );

    return (
        <div className="flex gap-4 p-2" style={{ minHeight: 400 }}>
            {/* 목록 */}
            <div className="w-72 shrink-0 border-r border-white/10 pr-3 overflow-y-auto" style={{ maxHeight: 600 }}>
                <div className="text-xs text-gray-400 mb-2">총 {rows.length}건 (최근순)</div>
                {rows.map(r => (
                    <button
                        key={r.id}
                        onClick={() => openDetail(r.id)}
                        className={`w-full text-left p-2.5 mb-1.5 rounded-lg border transition
                            ${openId === r.id ? 'border-purple-400/60 bg-purple-500/15' : 'border-white/10 hover:bg-white/5'}`}
                    >
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CHANNEL_COLOR[r.channel] || 'bg-white/10 text-gray-200'}`}>
                                {CHANNEL_LABEL[r.channel] || r.channel}
                            </span>
                            <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs font-medium text-gray-100 line-clamp-2">{r.topic}</div>
                    </button>
                ))}
            </div>

            {/* 상세 */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 600 }}>
                {!openId && <div className="text-sm text-gray-400 p-4">왼쪽에서 항목을 선택하세요.</div>}
                {openId && !detail && <div className="text-sm text-gray-400 p-4">불러오는 중...</div>}
                {detail && (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CHANNEL_COLOR[detail.channel] || 'bg-white/10 text-gray-200'}`}>
                                    {CHANNEL_LABEL[detail.channel] || detail.channel}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                    {new Date(detail.createdAt).toLocaleString()} · 리서치 소스 {detail.sourcesCount}개
                                </span>
                            </div>
                            <h3 className="text-base font-bold text-white">{detail.topic}</h3>
                        </div>

                        {/* 콘텐츠 초안 */}
                        <section className="border border-white/10 rounded-lg">
                            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
                                <span className="text-xs font-semibold text-gray-200">✍️ 콘텐츠 초안</span>
                                <button
                                    onClick={() => copy(detail.draft, 'draft')}
                                    className="text-[11px] px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
                                >
                                    {copied === 'draft' ? '복사됨!' : '📋 초안 복사'}
                                </button>
                            </div>
                            <pre className="p-3 text-xs whitespace-pre-wrap text-gray-100 font-sans">{detail.draft || '(없음)'}</pre>
                        </section>

                        {/* 리서치 */}
                        <section className="border border-white/10 rounded-lg">
                            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
                                <span className="text-xs font-semibold text-gray-200">🔎 리서치 결과</span>
                                <button
                                    onClick={() => copy(detail.report, 'report')}
                                    className="text-[11px] px-2 py-1 rounded bg-white/10 text-gray-200 hover:bg-white/20"
                                >
                                    {copied === 'report' ? '복사됨!' : '📋 리서치 복사'}
                                </button>
                            </div>
                            <pre className="p-3 text-xs whitespace-pre-wrap text-gray-300 font-sans">{detail.report || '(없음)'}</pre>
                        </section>

                        <div className="text-[11px] text-amber-400">⚠️ 발행 전 검토 필요 — 실제 게시는 직접 확인 후 올려주세요.</div>
                    </div>
                )}
            </div>
        </div>
    );
};
