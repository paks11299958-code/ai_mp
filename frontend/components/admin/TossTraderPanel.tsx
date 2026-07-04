import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 토스 자동매매 봇 모니터 (읽기 전용).
// 봇은 서버1 pm2에서 상시 실행(DEBUG=드라이런). 이 화면은 상태/설정/로그를 보기만 한다.
// 3탭: 모니터링 / 로그 / 설정(현재 읽기 전용, 3-B 웹 봇제어에서 편집 가능으로 진화).
// 상태는 봇이 서버1 파일(status.json)에 기록한 것을 읽는다.

const won = (n: any) => (n == null ? '-' : Number(n).toLocaleString() + '원');
const pct = (n: any) => (n == null ? '-' : Number(n) + '%');

type View = 'monitor' | 'score' | 'log' | 'settings';

export const TossTraderPanel: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [orders, setOrders] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<View>('monitor');       // 최상위 탭
    const [logTab, setLogTab] = useState<'log' | 'order'>('log'); // 로그 서브탭
    const [expanded, setExpanded] = useState(false);         // 로그 전체화면 모달

    const load = useCallback(async () => {
        try {
            const [s, l, o] = await Promise.all([
                adminApi.getTossStatus(),
                adminApi.getTossLogs(120),
                adminApi.getTossOrders(80),
            ]);
            setData(s);
            setLogs(l.lines || []);
            setOrders(o.lines || []);
            setError(null);
        } catch {
            setError('불러오기 실패 (봇 미기동이거나 서버 오류)');
        }
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 15000); // 15초 자동 새로고침
        return () => clearInterval(t);
    }, [load]);

    const st = data?.status;
    const alive = data?.available && st?.alive;
    const stale = data?.staleSeconds != null && data.staleSeconds > 180; // 3분↑ 미갱신
    const halted = st?.halted;

    // 서버가 최신순(앞=최신)으로 주므로 그대로 join하면 최신이 맨 위.
    const logText = (logTab === 'log' ? logs : orders).join('\n') || '(로그 없음)';

    // ESC로 모달 닫기
    useEffect(() => {
        if (!expanded) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [expanded]);

    return (
        <div className="p-4 space-y-4 text-gray-200">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Icon name="TrendingUp" className="w-5 h-5 text-blue-400" />
                    토스 자동매매 봇
                </h3>
                <button onClick={load} className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
                    새로고침
                </button>
            </div>

            {/* 안전 안내 */}
            <div className="text-xs bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-200">
                읽기 전용 모니터입니다. 봇은 서버1에서 상시 실행되며, 현재 <b>DEBUG(드라이런)</b> 모드에서는 실제 주문이 나가지 않습니다.
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}
            {data && !data.available && (
                <div className="text-sm text-gray-400">상태 파일 없음: {data.reason || '봇이 아직 상태를 기록하지 않음'}</div>
            )}

            {/* 최상위 탭 */}
            <div className="flex gap-1 border-b border-gray-700">
                <ViewTab on={view === 'monitor'} onClick={() => setView('monitor')} icon="Activity">모니터링</ViewTab>
                <ViewTab on={view === 'score'} onClick={() => setView('score')} icon="BarChart2">평가</ViewTab>
                <ViewTab on={view === 'log'} onClick={() => setView('log')} icon="Server">로그</ViewTab>
                <ViewTab on={view === 'settings'} onClick={() => setView('settings')} icon="Settings">설정</ViewTab>
            </div>

            {/* ── 모니터링 탭 ── */}
            {view === 'monitor' && st && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card label="상태">
                            <span className={`font-bold ${alive && !stale ? 'text-green-400' : 'text-red-400'}`}>
                                {alive ? (stale ? '⚠️ 응답없음' : '🟢 작동중') : '🔴 중지'}
                            </span>
                            {stale && <div className="text-[10px] text-red-300 mt-0.5">{data.staleSeconds}s 미갱신</div>}
                        </Card>
                        <Card label="모드">
                            <span className={st.mode === 'LIVE' ? 'text-red-400 font-bold' : 'text-blue-300 font-bold'}>
                                {st.mode === 'LIVE' ? '🔴 실거래' : '🟢 드라이런'}
                            </span>
                        </Card>
                        <Card label={`현재가 (${st.symbolName ? `${st.symbolName} ${st.symbol}` : st.symbol || '-'})`}>{won(st.lastPrice)}</Card>
                        <Card label="최근 신호">
                            <span className={
                                st.lastSignal === 'BUY' ? 'text-green-400 font-bold'
                                : st.lastSignal === 'SELL' ? 'text-red-400 font-bold' : 'text-gray-300'
                            }>{st.lastSignal || '-'}</span>
                        </Card>
                        {st.score != null && (
                            <Card label={`매수 점수 (임계 ${st.buyThreshold ?? 80})`}>
                                <div className="flex items-baseline gap-1">
                                    <span className={`font-bold text-lg ${Number(st.score) >= Number(st.buyThreshold ?? 80) ? 'text-green-400' : 'text-gray-200'}`}
                                        style={{ fontVariantNumeric: 'tabular-nums' }}>{st.score}</span>
                                    <span className="text-[11px] text-gray-500">/ {st.buyThreshold ?? 80}</span>
                                </div>
                                <div className="mt-1 h-1.5 rounded bg-gray-700 overflow-hidden">
                                    <div className={Number(st.score) >= Number(st.buyThreshold ?? 80) ? 'bg-green-500 h-full' : 'bg-blue-500/70 h-full'}
                                        style={{ width: `${Math.min(100, (Number(st.score) / Number(st.buyThreshold ?? 80)) * 100)}%` }} />
                                </div>
                            </Card>
                        )}
                        {st.strategy && (
                            <Card label="전략">
                                <span className="text-blue-300 font-medium">
                                    {st.strategy === 'ScoreTrend' ? '점수형 추세추종' : st.strategy}
                                </span>
                            </Card>
                        )}
                        <Card label="보유">
                            {st.avgPrice
                                ? <span className="text-gray-200">평단 {won(st.avgPrice)}</span>
                                : <span className="text-gray-500">미보유</span>}
                        </Card>
                        <Card label="써킷브레이커">
                            <span className={halted ? 'text-red-400 font-bold' : 'text-green-400'}>
                                {halted ? '🛑 정지됨' : '정상'}
                            </span>
                            {halted && st.haltReason && <div className="text-[10px] text-red-300 mt-0.5">{st.haltReason}</div>}
                        </Card>
                        <Card label="실현손익">
                            <span className={Number(st.realizedPnl) < 0 ? 'text-red-400' : 'text-gray-200'}>
                                {won(st.realizedPnl)}
                            </span>
                        </Card>
                        <Card label="연속 손절">
                            <span className={Number(st.consecutiveLosses) > 0 ? 'text-amber-300' : 'text-gray-300'}>
                                {st.consecutiveLosses ?? 0}회
                            </span>
                        </Card>
                    </div>

                    {/* 신호 근거 */}
                    {st.signalReason && (
                        <div className="text-xs text-gray-400 bg-gray-800/60 rounded px-3 py-2">
                            판단 근거: {st.signalReason}
                        </div>
                    )}
                </div>
            )}

            {/* ── 평가 탭 (조건별 점수) ── */}
            {view === 'score' && st && (
                <div className="space-y-3">
                    {/* 총점 요약 */}
                    <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-4">
                        <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">이번 매수 점수</div>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-2xl font-bold ${Number(st.score) >= Number(st.buyThreshold ?? 80) ? 'text-green-400' : 'text-gray-100'}`}
                                    style={{ fontVariantNumeric: 'tabular-nums' }}>{st.score ?? '-'}</span>
                                <span className="text-sm text-gray-500">/ {st.buyThreshold ?? 80} 임계</span>
                            </div>
                        </div>
                        <div className="flex-1 h-2 rounded bg-gray-700 overflow-hidden">
                            <div className={Number(st.score) >= Number(st.buyThreshold ?? 80) ? 'bg-green-500 h-full' : 'bg-blue-500/70 h-full'}
                                style={{ width: `${Math.min(100, (Number(st.score ?? 0) / Number(st.buyThreshold ?? 80)) * 100)}%` }} />
                        </div>
                        <div className={`text-sm font-medium ${st.lastSignal === 'BUY' ? 'text-green-400' : 'text-gray-400'}`}>
                            {st.lastSignal === 'BUY' ? '매수 진입' : '진입 보류'}
                        </div>
                    </div>

                    {/* 조건별 표 */}
                    {st.scoreDetail && Object.keys(st.scoreDetail).length > 0 ? (
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[10px] text-gray-500 border-b border-gray-700 bg-gray-800/80">
                                <span>평가 조건 / 기준</span>
                                <span className="text-right">현재값</span>
                                <span className="text-right w-20">획득 / 배점</span>
                            </div>
                            <div className="divide-y divide-gray-700/60">
                                {Object.entries<any>(st.scoreDetail).map(([key, v]) => (
                                    <div key={key} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5 items-center">
                                        <div>
                                            <div className="text-sm text-gray-100 flex items-center gap-1.5">
                                                <span className={v.ok ? 'text-green-400' : 'text-gray-600'}>{v.ok ? '✓' : '✗'}</span>
                                                {v.label || key}
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-0.5">{v.crit}</div>
                                        </div>
                                        <div className="text-[11px] text-gray-400 text-right max-w-[160px] truncate" title={v.val}>{v.val}</div>
                                        <div className="text-right w-20" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            <span className={v.ok ? 'text-green-400 font-medium' : 'text-gray-500'}>+{v.pts}</span>
                                            <span className="text-[11px] text-gray-600"> / {v.max}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-6 text-center">
                            {st.avgPrice
                                ? '보유 중 — 청산 판단 모드입니다(손절/익절/추세이탈). 매수 점수 평가는 미보유 시 표시됩니다.'
                                : '평가 데이터가 아직 없습니다. 봇이 다음 주기에 기록합니다.'}
                        </div>
                    )}
                    <div className="text-[11px] text-gray-500 px-1">
                        조건별 배점은 봇 전략(<code className="text-gray-400">ScoreTrendStrategy</code>)에 정의돼 있습니다. 웹에서 배점을 조절하는 기능은 추후(봇 원격제어) 추가 예정입니다.
                    </div>
                </div>
            )}

            {/* ── 로그 탭 ── */}
            {view === 'log' && (
                <div>
                    <div className="flex gap-2 mb-2 items-center">
                        <TabBtn on={logTab === 'log'} onClick={() => setLogTab('log')}>실행 로그</TabBtn>
                        <TabBtn on={logTab === 'order'} onClick={() => setLogTab('order')}>주문 로그</TabBtn>
                        <button onClick={() => setExpanded(true)}
                            className="ml-auto text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
                            ⛶ 크게 보기
                        </button>
                        <span className="text-[10px] text-gray-500 self-center">15초 자동갱신</span>
                    </div>
                    <pre className="bg-black/60 rounded-lg p-3 text-[11px] leading-relaxed text-gray-300 overflow-auto min-h-[24rem] max-h-[70vh] whitespace-pre-wrap resize-y">
                        {logText}
                    </pre>
                </div>
            )}

            {/* ── 설정 탭 (현재 읽기 전용) ── */}
            {view === 'settings' && st && (
                <div className="space-y-3">
                    <div className="text-xs bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                        현재 봇 설정값입니다(읽기 전용). 변경은 서버1 <code className="text-gray-300">ecosystem.config.js</code> 수정 후 재시작으로 반영되며,
                        웹에서 직접 바꾸는 기능은 추후(봇 원격제어) 추가 예정입니다.
                    </div>
                    <SettingsSection title="종목 · 전략">
                        <Row label="대상 종목">{st.symbolName ? `${st.symbolName} (${st.symbol})` : st.symbol || '-'}</Row>
                        <Row label="시장 프록시">{st.marketSymbol ? `KODEX200 (${st.marketSymbol})` : '미사용'}</Row>
                        <Row label="전략">{st.strategy === 'ScoreTrend' ? '점수형 추세추종' : (st.strategy || '-')}</Row>
                        <Row label="매수 임계 점수">{st.buyThreshold ?? '-'}점 이상</Row>
                        <Row label="모드">{st.mode === 'LIVE' ? '🔴 실거래' : '🟢 드라이런(DEBUG)'}</Row>
                    </SettingsSection>
                    <SettingsSection title="주문 상한 · 리스크">
                        <Row label="1회 주문 상한">{won(st.maxOrderAmountKrw)} / {st.maxOrderQuantity}주</Row>
                        <Row label="일 손실 한도(금액)">{won(st.dailyLossLimitKrw)}</Row>
                        <Row label="일 손실 한도(%)">{pct(st.dailyLossLimitPct)}</Row>
                        <Row label="연속 손절 차단">{st.maxConsecutiveLosses ?? '-'}회</Row>
                        <Row label="변동성 필터">일일 변동 {pct(st.maxDailyMovePct)} 이상 진입 거부</Row>
                    </SettingsSection>
                    <SettingsSection title="운영">
                        <Row label="루프 간격">{st.loopIntervalSeconds ?? '-'}초</Row>
                        <Row label="캔들 조회 수">{st.candleCount ?? '-'}봉</Row>
                    </SettingsSection>
                </div>
            )}

            {/* 로그 전체화면 모달 */}
            {expanded && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col p-2 sm:p-4"
                    onClick={() => setExpanded(false)}>
                    <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden max-w-6xl w-full mx-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
                            <Icon name="TrendingUp" className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-bold text-gray-100">토스 자동매매 로그</span>
                            <TabBtn on={logTab === 'log'} onClick={() => setLogTab('log')}>실행 로그</TabBtn>
                            <TabBtn on={logTab === 'order'} onClick={() => setLogTab('order')}>주문 로그</TabBtn>
                            <span className="text-[10px] text-gray-500 hidden sm:inline">15초 자동갱신 · ESC로 닫기</span>
                            <button onClick={() => setExpanded(false)}
                                className="ml-auto text-gray-300 hover:text-white text-lg leading-none px-2"
                                aria-label="닫기">✕</button>
                        </div>
                        <pre className="flex-1 bg-black/70 p-3 text-[11px] sm:text-xs leading-relaxed text-gray-200 overflow-auto whitespace-pre-wrap">
                            {logText}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

const Card: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="bg-gray-800 rounded-lg px-3 py-2.5">
        <div className="text-[10px] text-gray-500 mb-1">{label}</div>
        <div className="text-sm">{children}</div>
    </div>
);

const ViewTab: React.FC<{ on: boolean; onClick: () => void; icon: string; children: React.ReactNode }> = ({ on, onClick, icon, children }) => (
    <button onClick={onClick}
        className={`text-sm px-4 py-2 -mb-px border-b-2 flex items-center gap-1.5 ${on ? 'border-blue-400 text-blue-300 font-medium' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
        <Icon name={icon} className="w-4 h-4" />{children}
    </button>
);

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="text-[11px] font-medium text-gray-400 px-3 py-2 border-b border-gray-700 bg-gray-800/80">{title}</div>
        <div className="divide-y divide-gray-700/60">{children}</div>
    </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-100">{children}</span>
    </div>
);

const TabBtn: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
    <button onClick={onClick}
        className={`text-xs px-3 py-1.5 rounded ${on ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
        {children}
    </button>
);
