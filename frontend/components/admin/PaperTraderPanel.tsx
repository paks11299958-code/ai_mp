import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 가상매매(페이퍼 봇) 성과 전용 패널 — 2026-08-05 사장 지시로 신설.
//
// 왜 실봇 탭과 분리했나:
//   실봇 탭(TossTraderPanel)은 '지금 무엇을 하고 있나'(발굴·선택·모니터링·로그)가 중심이라
//   성과가 묻힌다. 페이퍼 봇은 반대로 **결과를 보려고 돌리는 것**이다 — 실돈을 걸기 전에
//   "이 설정이면 얼마 벌었을까"를 보는 게 존재 이유라, 수익·투자결과가 첫 화면이어야 한다.
//
// ★체결 0건이 '정상'일 수 있다는 점을 화면이 설명해야 한다(실측: 7/15 기동~8/5 0건).
//   점수가 진입임계에 못 미치면 봇은 아무것도 안 산다. 그때 빈 표만 보여주면
//   "고장난 건가"로 읽힌다 — 감시 종목의 현재 점수와 임계를 나란히 보여줘 구분시킨다.

const won = (n: any) => (n == null ? '-' : Number(n).toLocaleString('ko-KR') + '원');

// 한국 주식 관례: 이익=빨강(▲) / 손실=파랑(▼). (서구식과 반대 — 토스·증권사 앱과 동일)
const signWon = (n: any) => {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    const v = Number(n);
    return (v > 0 ? '+' : '') + v.toLocaleString('ko-KR') + '원';
};
const signPct = (n: any, digits = 2) => {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    const v = Number(n);
    return (v > 0 ? '+' : '') + v.toFixed(digits) + '%';
};
const pnlColor = (n: any) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v === 0) return 'text-gray-300';
    return v > 0 ? 'text-red-400' : 'text-blue-400';
};
const pnlArrow = (n: any) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v === 0) return '';
    return v > 0 ? '▲' : '▼';
};

const kst = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
};

type Perf = Awaited<ReturnType<typeof adminApi.getTossPaperPerformance>>;

export const PaperTraderPanel: React.FC = () => {
    const [perf, setPerf] = useState<Perf | null>(null);
    const [orders, setOrders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setErr(null);
            const [p, o] = await Promise.all([
                adminApi.getTossPaperPerformance(),
                adminApi.getTossPaperOrders(60).catch(() => ({ lines: [] as string[] })),
            ]);
            setPerf(p);
            setOrders(o.lines ?? []);
        } catch (e: any) {
            setErr(e?.message ?? '조회 실패');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        // 장중엔 값이 계속 바뀌므로 주기 갱신(60초 — 봇 루프와 같은 주기라 더 짧게 볼 이유가 없다)
        const t = setInterval(load, 60_000);
        return () => clearInterval(t);
    }, [load]);

    if (loading) {
        return <div className="p-6 text-gray-400 text-sm">가상매매 성과 불러오는 중…</div>;
    }
    if (err) {
        return (
            <div className="p-6">
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
                    조회 실패: {err}
                    <button onClick={load} className="ml-3 px-2 py-1 bg-red-800/50 rounded text-xs">다시 시도</button>
                </div>
            </div>
        );
    }
    if (!perf?.available) {
        return (
            <div className="p-6 text-gray-400 text-sm">
                페이퍼 봇 상태를 읽을 수 없습니다. {perf?.reason ?? ''}
            </div>
        );
    }

    const stale = (perf.staleSeconds ?? 0) > 300;   // 5분 넘게 갱신 없으면 멈춤 의심

    return (
        <div className="p-4 sm:p-6 space-y-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Icon name="Activity" size={18} className="text-purple-400" />
                    <h2 className="text-lg font-bold text-gray-100">가상매매 성과</h2>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-purple-900/50 text-purple-300 border border-purple-700">
                        PAPER · 실주문 없음
                    </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>갱신 {kst(perf.updatedAt)}</span>
                    <button onClick={load} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
                        새로고침
                    </button>
                </div>
            </div>

            {/* 봇이 멈춘 것처럼 보이는 경우 먼저 경고 — 성과 숫자보다 이게 우선이다 */}
            {(stale || perf.halted || perf.alive === false) && (
                <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 text-amber-200 text-sm">
                    {perf.halted
                        ? <>🛑 <b>정지 상태</b> — {perf.haltReason || '사유 미기재'}</>
                        : stale
                            ? <>⚠️ 상태 파일이 {Math.floor((perf.staleSeconds ?? 0) / 60)}분째 갱신되지 않았습니다(봇 멈춤 의심).</>
                            : <>⚠️ 봇이 실행 중이 아닙니다.</>}
                </div>
            )}

            {/* 핵심 지표 4장 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card label="평가 자산" value={won(perf.equityKrw)}
                      sub={`초기자본 ${won(perf.initialCapitalKrw)}`} />
                <Card label="총 수익률"
                      value={<span className={pnlColor(perf.returnPct)}>
                          {pnlArrow(perf.returnPct)} {signPct(perf.returnPct)}
                      </span>}
                      sub="초기자본 대비" />
                <Card label="실현손익(누적)"
                      value={<span className={pnlColor(perf.realizedPnlTotalKrw)}>
                          {signWon(perf.realizedPnlTotalKrw)}
                      </span>}
                      sub={`오늘 ${signWon(perf.realizedPnlTodayKrw)}`} />
                <Card label="미실현손익"
                      value={<span className={pnlColor(perf.unrealizedPnlKrw)}>
                          {signWon(perf.unrealizedPnlKrw)}
                      </span>}
                      sub={`보유 ${perf.heldSymbols?.length ?? 0}종목`} />
            </div>

            {/* ★거래가 아직 없을 때 — 빈 표 대신 '왜 없는지'를 설명한다 */}
            {!perf.hasTrades && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <Icon name="AlertCircle" size={16} className="text-blue-400 mt-0.5 shrink-0" />
                        <div className="text-sm text-gray-300 space-y-2">
                            <p className="font-bold text-gray-100">아직 체결된 거래가 없습니다 — 고장이 아닙니다.</p>
                            <p className="text-gray-400 leading-relaxed">
                                봇은 종목 점수가 <b className="text-gray-200">진입임계 {perf.buyThreshold}점</b> 이상일 때만 매수합니다.
                                아래 감시 종목의 현재 점수가 임계에 못 미치면 하루 종일 관망합니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 감시 종목 — 점수 대 임계를 나란히(왜 사고/안 사는지가 여기서 읽힌다) */}
            <section>
                <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-1.5">
                    <Icon name="Eye" size={14} /> 감시 종목
                    <span className="text-xs font-normal text-gray-500">
                        (진입임계 {perf.buyThreshold}점 · 선택 {kst(perf.selectionUpdatedAt)})
                    </span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                                <th className="py-2 pr-3">종목</th>
                                <th className="py-2 pr-3">현재가</th>
                                <th className="py-2 pr-3">점수</th>
                                <th className="py-2 pr-3">상태</th>
                                <th className="py-2">판단 근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(perf.watch ?? []).length === 0 && (
                                <tr><td colSpan={5} className="py-4 text-gray-500 text-center">감시 중인 종목이 없습니다.</td></tr>
                            )}
                            {(perf.watch ?? []).map((w) => {
                                const th = perf.buyThreshold ?? 0;
                                const reached = w.score != null && w.score >= th;
                                return (
                                    <tr key={w.symbol} className="border-b border-gray-800 align-top">
                                        <td className="py-2 pr-3">
                                            <div className="font-bold text-gray-100">{w.name}</div>
                                            <div className="text-xs text-gray-500">{w.symbol}</div>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-300">{won(w.lastPrice)}</td>
                                        <td className="py-2 pr-3">
                                            <span className={`font-bold ${reached ? 'text-red-400' : 'text-gray-400'}`}>
                                                {w.score ?? '-'}
                                            </span>
                                            <span className="text-gray-600"> / {th}</span>
                                        </td>
                                        <td className="py-2 pr-3">
                                            {w.held
                                                ? <span className="px-1.5 py-0.5 text-[11px] rounded bg-red-900/40 text-red-300">보유</span>
                                                : <span className="px-1.5 py-0.5 text-[11px] rounded bg-gray-800 text-gray-400">미보유</span>}
                                        </td>
                                        <td className="py-2 text-xs text-gray-400 leading-relaxed">{w.reason || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 일별 실현손익 */}
            <section>
                <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-1.5">
                    <Icon name="BarChart2" size={14} /> 일별 실현손익
                </h3>
                {(perf.daily ?? []).length === 0 ? (
                    <p className="text-sm text-gray-500">실현된 손익이 아직 없습니다.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[320px]">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                                    <th className="py-2 pr-3">날짜</th>
                                    <th className="py-2">실현손익</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(perf.daily ?? []).map((d) => (
                                    <tr key={d.date} className="border-b border-gray-800">
                                        <td className="py-2 pr-3 text-gray-300">{d.date}</td>
                                        <td className={`py-2 font-bold ${pnlColor(d.pnl)}`}>
                                            {pnlArrow(d.pnl)} {signWon(d.pnl)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* 체결·주문 이력 */}
            <section>
                <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-1.5">
                    <Icon name="GitCommit" size={14} /> 주문 이력
                    <span className="text-xs font-normal text-gray-500">
                        (체결 {perf.filledCount ?? 0}건)
                    </span>
                </h3>
                {orders.length === 0 ? (
                    <p className="text-sm text-gray-500">주문 기록이 없습니다.</p>
                ) : (
                    <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-400
                                    overflow-x-auto max-h-72 whitespace-pre-wrap break-all">
                        {orders.join('\n')}
                    </pre>
                )}
            </section>

            {/* 설명 — 이 탭이 무엇인지 */}
            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-800 pt-3">
                가상매매(PAPER) 봇은 실봇과 <b>같은 코드·같은 전략</b>으로 돌지만 실제 주문을 내지 않습니다.
                실돈을 걸기 전에 설정(특히 진입임계)이 어떤 결과를 내는지 관찰하는 용도입니다.
                파일은 <code className="text-gray-500">*_paper.json</code> 으로 실봇과 완전히 격리됩니다.
            </p>
        </div>
    );
};

const Card: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-lg font-bold text-gray-100">{value}</div>
        {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
);
