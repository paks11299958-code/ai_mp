import React, { useEffect, useState } from 'react';
import { X, TrendingUp, BarChart2, Loader } from 'lucide-react';
import { stockAnalysisApi } from '../services/apiService';
import { T, AiOpinionCard, ReportRenderer, SourceLinks } from './StockAnalysisBoard';

// 🔗 주식 정밀분석 공개 공유 뷰(?stock=shareId) — 비로그인도 열람 가능(바이럴 유입).
// 타로 공유(?tr=)와 동일 원칙: 옵트인 발급, 공개 응답엔 사용자 정보 미포함.

interface SharedStock {
    stockName: string;
    analysisReport: string | null;
    claudeReport: string | null;
    gptReport: string | null;
    sourceLinks: string | null;
    yahooSymbol: string | null;
    chartImageUrl: string | null;
    updatedAt: string;
}

export const StockPublicShareView: React.FC<{ shareId: string; onClose: () => void }> = ({ shareId, onClose }) => {
    const [data, setData] = useState<SharedStock | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        stockAnalysisApi.getShared(shareId)
            .then(r => setData(r))
            .catch(() => setFailed(true))
            .finally(() => setLoading(false));
    }, [shareId]);

    const krxSymbol = data?.yahooSymbol ? `KRX:${data.yahooSymbol.replace(/\.(KS|KQ)$/i, '')}` : null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px] md:pt-[84px] md:px-6 md:pb-6" style={{ background: 'rgba(45,37,32,0.55)', fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}>
            <div className="w-full max-w-3xl h-[calc(100vh-60px)] md:h-auto md:max-h-[calc(100vh-108px)] rounded-t-[20px] md:rounded-[20px] flex flex-col overflow-hidden" style={{ background: T.bg, border: `1px solid ${T.border}`, boxShadow: '0 24px 60px rgba(45,37,32,0.2)' }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <TrendingUp size={16} style={{ color: T.gold, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: '"Nanum Myeongjo", serif' }}>
                            공유된 주식 정밀분석
                        </span>
                    </div>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: T.inkMute, cursor: 'pointer' }}>
                        <X size={17} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: T.inkMute, gap: 8, fontSize: 13 }}>
                            <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> 불러오는 중...
                        </div>
                    )}
                    {!loading && (failed || !data) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: T.inkMute, gap: 8 }}>
                            <p style={{ fontSize: 12 }}>존재하지 않거나 비공개로 전환된 보고서입니다.</p>
                        </div>
                    )}
                    {!loading && data && (
                        <div>
                            <div style={{ margin: '14px 20px 0', background: 'linear-gradient(135deg, #ffffff 0%, #f7f3fb 100%)', border: `1px solid ${T.gold}55`, borderRadius: 14, padding: '16px', boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)' }}>
                                <h3 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: '0 0 4px', lineHeight: 1.2, fontFamily: '"Nanum Myeongjo", serif' }}>{data.stockName}</h3>
                                <p style={{ fontSize: 11, color: T.inkMute, margin: '0 0 12px' }}>
                                    정밀 투자 분석 보고서 &nbsp;·&nbsp; {new Date(data.updatedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                <div style={{ background: T.surface, borderRadius: 8, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                                    <BarChart2 size={11} style={{ color: T.inkMute }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em' }}>데이터 소스</span>
                                    <span style={{ fontSize: 10, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>DART 공시</span>
                                    <span style={{ fontSize: 10, color: T.accent, background: T.accentSoft, border: `1px solid ${T.accent}40`, padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>AI 분석</span>
                                    {krxSymbol && <span style={{ fontSize: 10, color: T.inkMute, fontFamily: 'monospace' }}>{krxSymbol}</span>}
                                </div>
                            </div>

                            <AiOpinionCard geminiReport={data.analysisReport} claudeReport={data.claudeReport} gptReport={data.gptReport} />

                            <div style={{ padding: '16px 20px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                {data.analysisReport
                                    ? <ReportRenderer content={data.analysisReport} />
                                    : <p style={{ fontSize: 12, color: T.inkMute, padding: '16px 0' }}>보고서 내용이 없습니다.</p>
                                }
                            </div>

                            <SourceLinks raw={data.sourceLinks} />
                        </div>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
