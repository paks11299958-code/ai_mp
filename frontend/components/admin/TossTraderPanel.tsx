import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 토스 자동매매 봇 모니터 (읽기 전용).
// 봇은 서버1 pm2에서 상시 실행(DEBUG=드라이런). 이 화면은 상태/설정/로그를 보기만 한다.
// 주문 제어 버튼 없음(추후 별도 단계). 상태는 봇이 서버1 파일(status.json)에 기록한 것을 읽는다.

const won = (n: any) => (n == null ? '-' : Number(n).toLocaleString() + '원');

export const TossTraderPanel: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [orders, setOrders] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'log' | 'order'>('log');

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

            {/* 상태 카드 */}
            {st && (
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
                    <Card label="1회 주문상한">{won(st.maxOrderAmountKrw)} / {st.maxOrderQuantity}주</Card>
                    <Card label="일 손실한도">{won(st.dailyLossLimitKrw)}</Card>
                </div>
            )}

            {/* 신호 근거 */}
            {st?.signalReason && (
                <div className="text-xs text-gray-400 bg-gray-800/60 rounded px-3 py-2">
                    판단 근거: {st.signalReason}
                </div>
            )}

            {/* 로그 뷰어 */}
            <div>
                <div className="flex gap-2 mb-2">
                    <TabBtn on={tab === 'log'} onClick={() => setTab('log')}>실행 로그</TabBtn>
                    <TabBtn on={tab === 'order'} onClick={() => setTab('order')}>주문 로그</TabBtn>
                    <span className="ml-auto text-[10px] text-gray-500 self-center">15초마다 자동 새로고침</span>
                </div>
                <pre className="bg-black/60 rounded-lg p-3 text-[11px] leading-relaxed text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
                    {(tab === 'log' ? logs : orders).slice().reverse().join('\n') || '(로그 없음)'}
                </pre>
            </div>
        </div>
    );
};

const Card: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="bg-gray-800 rounded-lg px-3 py-2.5">
        <div className="text-[10px] text-gray-500 mb-1">{label}</div>
        <div className="text-sm">{children}</div>
    </div>
);

const TabBtn: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
    <button onClick={onClick}
        className={`text-xs px-3 py-1.5 rounded ${on ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
        {children}
    </button>
);
