import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, type InverseTraderSnapshot } from '../../services/apiService';
import { Icon } from '../Icons';

// 인버스 ETF 1호가 스캘핑 자동매매 — 한 탭에서 상태·호가·포지션·주문·체결·손익·설정을 전부 본다.
//
// ★이 화면이 다루는 매매는 전부 가상매매(SIMULATION)다. 증권사 주문 API 는 어느 경로로도
//   호출되지 않으며, 설정에서 실거래 모드로 바꾸는 입력 자체를 두지 않았다(서버도 400 으로 거부).
//
// ★엔진은 상시 데몬이 아니라 '틱' 호출로 진행한다(Vercel 서버리스에는 상주 프로세스가 없다).
//   그래서 화면에 수동 틱 버튼과 자동 틱 토글을 둔다. 자동 틱은 상태 폴링과 **같은 인터벌**
//   안에서 돌린다 — 인터벌을 두 개 만들면 재진입 사고가 난다(전자책 표지 중복생성 사고와 동일 유형).

const POLL_MS = 5000;

const won = (n: any) => (n == null || !Number.isFinite(Number(n)) ? '-' : Number(n).toLocaleString() + '원');
const qty = (n: any) => (n == null || !Number.isFinite(Number(n)) ? '-' : Number(n).toLocaleString() + '주');

// 손익 표기는 한국 관례 — 이익=빨강(▲) / 손실=파랑(▼).
const signWon = (n: any) => {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    const v = Math.round(Number(n));
    return (v > 0 ? '+' : '') + v.toLocaleString() + '원';
};
const pnlColor = (n: any) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v === 0) return 'text-gray-300';
    return v > 0 ? 'text-red-400' : 'text-blue-400';
};

const hhmmss = (iso: string | null | undefined) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    // 서버는 UTC 로 내려준다 → 화면은 KST.
    return d.toLocaleTimeString('ko-KR', { hour12: false, timeZone: 'Asia/Seoul' });
};

type SessionStatus = 'IDLE' | 'RUNNING' | 'FORCE_SETTLEMENT' | 'STOPPED' | 'EMERGENCY_STOP';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
    IDLE:             { label: '대기(IDLE)',            cls: 'bg-gray-600/20 text-gray-300 border-gray-500/40' },
    RUNNING:          { label: '실행중(RUNNING)',        cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
    FORCE_SETTLEMENT: { label: '강제정산중',              cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
    STOPPED:          { label: '중지(STOPPED)',          cls: 'bg-slate-600/25 text-slate-300 border-slate-500/40' },
    EMERGENCY_STOP:   { label: '긴급정지(EMERGENCY)',    cls: 'bg-red-500/15 text-red-300 border-red-500/40' },
};

const ORDER_STATUS_STYLE: Record<string, string> = {
    PENDING: 'text-yellow-300',
    PARTIAL: 'text-blue-300',
    FILLED: 'text-emerald-300',
    CANCELED: 'text-gray-500 line-through',
};

interface ConfigForm {
    symbol: string;
    symbolName: string;
    defaultQty: string;
    closeBufferMin: string;
    maxPositionQty: string;
    dailyLossLimit: string;
    stopLossPct: string;
    maxAddBuys: string;
    noAddBuyBelowPct: string;
}

const emptyForm: ConfigForm = {
    symbol: '', symbolName: '', defaultQty: '', closeBufferMin: '', maxPositionQty: '', dailyLossLimit: '',
    stopLossPct: '', maxAddBuys: '', noAddBuyBelowPct: '',
};

const Card: React.FC<{ title: string; icon: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, icon, children, right }) => (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                <Icon name={icon} size={15} className="text-blue-400" />
                {title}
            </h4>
            {right}
        </div>
        {children}
    </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div className="bg-gray-900/50 rounded-lg px-3 py-2">
        <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>
        <div className={`text-sm font-bold ${className ?? 'text-gray-100'}`}>{value}</div>
    </div>
);

export const InverseTraderPanel: React.FC = () => {
    const [data, setData] = useState<InverseTraderSnapshot | null>(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');           // 진행 중인 동작 이름(버튼 중복 클릭 방지)
    const [msg, setMsg] = useState('');
    const [autoTick, setAutoTick] = useState(false);
    const [form, setForm] = useState<ConfigForm>(emptyForm);
    const [formDirty, setFormDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    // ★폴링 재진입 방지 — 이전 요청이 안 끝났으면 이번 주기는 건너뛴다.
    const inFlight = useRef(false);
    // ★언마운트 후 setState 방지(인터벌 정리와 별개로 진행 중이던 요청이 늦게 돌아올 수 있다).
    const alive = useRef(true);
    const autoTickRef = useRef(false);
    useEffect(() => { autoTickRef.current = autoTick; }, [autoTick]);
    // 편집 중 여부는 ref 로도 들고 있는다 — 폴링 콜백은 state 를 최신으로 못 읽는다.
    const formDirtyRef = useRef(false);
    const markDirty = (v: boolean) => { formDirtyRef.current = v; setFormDirty(v); };

    const applySnapshot = useCallback((d: InverseTraderSnapshot) => {
        if (!alive.current) return;
        setData(d);
        setErr('');
        // 설정 폼은 사용자가 편집 중이면 덮어쓰지 않는다(폴링이 입력을 지우면 안 된다).
        if (!formDirtyRef.current && d.config) {
            setForm({
                symbol: d.config.symbol ?? '',
                symbolName: d.config.symbolName ?? '',
                defaultQty: String(d.config.defaultQty ?? ''),
                closeBufferMin: String(d.config.closeBufferMin ?? ''),
                maxPositionQty: String(d.config.maxPositionQty ?? ''),
                dailyLossLimit: String(d.config.dailyLossLimit ?? ''),
                stopLossPct: String(d.config.stopLossPct ?? ''),
                maxAddBuys: String(d.config.maxAddBuys ?? ''),
                noAddBuyBelowPct: String(d.config.noAddBuyBelowPct ?? ''),
            });
        }
    }, []);

    /** 상태 1회 조회. autoTick 이 켜져 있고 세션이 살아있으면 틱을 1회 진행한 결과로 갱신한다. */
    const poll = useCallback(async () => {
        if (inFlight.current) return;          // ★재진입 방지
        inFlight.current = true;
        try {
            const shouldTick = autoTickRef.current;
            const d = shouldTick
                ? await adminApi.tickInverseSession(1)
                : await adminApi.getInverseStatus();
            applySnapshot(d);
        } catch (e: any) {
            if (alive.current) setErr(e?.message || '상태 조회에 실패했습니다.');
        } finally {
            inFlight.current = false;
            if (alive.current) setLoading(false);
        }
    }, [applySnapshot]);

    useEffect(() => {
        alive.current = true;
        void poll();
        const timer = setInterval(() => { void poll(); }, POLL_MS);
        return () => {
            alive.current = false;
            clearInterval(timer);   // ★언마운트 시 인터벌 정리 필수
        };
    }, [poll]);

    /** 시작/중지/긴급정지/틱/정산 공통 실행기. 진행 중에는 같은 버튼을 다시 못 누른다. */
    const run = async (name: string, fn: () => Promise<InverseTraderSnapshot>, confirmText?: string) => {
        if (busy) return;
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(name);
        setMsg('');
        try {
            const d = await fn();
            applySnapshot(d);
            setMsg(`${name} 완료`);
        } catch (e: any) {
            setErr(e?.message || `${name} 실패`);
        } finally {
            if (alive.current) setBusy('');
        }
    };

    const saveConfig = async () => {
        if (saving) return;
        setSaving(true);
        setMsg('');
        try {
            await adminApi.saveInverseConfig({
                symbol: form.symbol.trim(),
                symbolName: form.symbolName.trim(),
                defaultQty: Number(form.defaultQty),
                closeBufferMin: Number(form.closeBufferMin),
                maxPositionQty: Number(form.maxPositionQty),
                dailyLossLimit: Number(form.dailyLossLimit),
                stopLossPct: Number(form.stopLossPct),
                maxAddBuys: Number(form.maxAddBuys),
                noAddBuyBelowPct: Number(form.noAddBuyBelowPct),
            });
            markDirty(false);
            setMsg('설정을 저장했습니다.');
            await poll();
        } catch (e: any) {
            setErr(e?.message || '설정 저장에 실패했습니다.');
        } finally {
            if (alive.current) setSaving(false);
        }
    };

    const setField = (k: keyof ConfigForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        markDirty(true);
        setForm(f => ({ ...f, [k]: e.target.value }));
    };

    const status = (data?.session?.status ?? 'IDLE') as SessionStatus;
    const badge = STATUS_STYLE[status] ?? STATUS_STYLE.IDLE;
    const isLive = !!data?.session?.isLive;
    const pos = data?.position;
    const q = data?.quote;

    if (loading && !data) {
        return <div className="p-6 text-gray-400 text-sm">인버스 자동매매 상태를 불러오는 중…</div>;
    }

    return (
        <div className="space-y-4">
            {/* ── 강제정산 실패 경고 ─────────────────────────────── */}
            {data?.today?.settlementFailed && (
                <div className="bg-red-600/20 border-2 border-red-500 rounded-xl p-4 flex items-start gap-3">
                    <Icon name="AlertTriangle" size={22} className="text-red-300 shrink-0 mt-0.5" />
                    <div>
                        <div className="text-red-200 font-bold text-sm">★당일 강제정산 실패 — 포지션이 남아 있습니다</div>
                        <div className="text-red-300/90 text-xs mt-1 leading-relaxed">
                            {data.today.warning || `마감 후 잔여수량 ${data.today.closingQty}주`}
                        </div>
                        <div className="text-red-300/70 text-[11px] mt-1">
                            잔여 포지션은 자동으로 사라지지 않습니다. 아래 '지금 정산'으로 다시 청산하세요.
                        </div>
                    </div>
                </div>
            )}

            {/* ── 상단: 상태 배지 + 조작 버튼 ────────────────────── */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${badge.cls}`}>
                        {badge.label}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg border border-purple-500/40 bg-purple-500/15 text-purple-200 text-xs font-bold">
                        🧪 가상매매 전용(SIMULATION) — 증권사 주문 없음
                    </span>
                    {data?.engine?.inSettlementWindow && (
                        <span className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-200 text-xs font-bold">
                            마감버퍼 구간 — 신규 매수 차단
                        </span>
                    )}
                    <span className="text-[11px] text-gray-500 ml-auto">
                        {data?.config?.symbolName} ({data?.config?.symbol}) · 틱 {data?.engine?.tickCount ?? 0}회 · 최근 {hhmmss(data?.engine?.lastTickAt)}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => run('시작', () => adminApi.startInverseSession())}
                        disabled={!!busy || isLive}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors flex items-center gap-1.5"
                    >
                        <Icon name="Play" size={14} /> 시작
                    </button>
                    <button
                        onClick={() => run('중지', () => adminApi.stopInverseSession('어드민 화면에서 중지'))}
                        disabled={!!busy || !isLive}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors flex items-center gap-1.5"
                    >
                        <Icon name="X" size={14} /> 중지
                    </button>
                    <button
                        onClick={() => run('긴급정지', () => adminApi.emergencyStopInverse('어드민 화면에서 긴급정지'),
                            '긴급정지하면 미체결 주문을 전부 취소하고 신규 주문을 중단합니다.\n보유 포지션은 자동으로 청산되지 않습니다. 진행할까요?')}
                        disabled={!!busy || !data?.session}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors flex items-center gap-1.5"
                    >
                        <Icon name="AlertTriangle" size={14} /> 긴급정지
                    </button>

                    <div className="w-px h-6 bg-gray-700 mx-1" />

                    <button
                        onClick={() => run('틱 진행', () => adminApi.tickInverseSession(1))}
                        disabled={!!busy || !isLive}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors flex items-center gap-1.5"
                    >
                        <Icon name="Zap" size={14} /> 틱 1회
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer select-none">
                        <input type="checkbox" checked={autoTick} onChange={e => setAutoTick(e.target.checked)} className="accent-blue-500" />
                        자동 틱({POLL_MS / 1000}초)
                    </label>
                    <button
                        onClick={() => run('강제정산', () => adminApi.settleInverseNow(),
                            '지금 강제정산합니다. 미체결을 모두 취소하고 보유수량을 전량 청산합니다. 진행할까요?')}
                        disabled={!!busy || !data?.session}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors flex items-center gap-1.5"
                    >
                        <Icon name="Clock" size={14} /> 지금 정산
                    </button>
                </div>

                {busy && <div className="text-xs text-blue-300 mt-2">{busy} 처리 중…</div>}
                {msg && <div className="text-xs text-emerald-300 mt-2">{msg}</div>}
                {err && <div className="text-xs text-red-400 mt-2">{err}</div>}
                {data?.session?.lastError && (
                    <div className="text-[11px] text-amber-300/90 mt-2 break-all">최근 오류/메모: {data.session.lastError}</div>
                )}
            </div>

            {/* ── ① 현재가·호가 / ② 포지션·손익 ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card
                    title="① 현재가 · 1호가"
                    icon="TrendingUp"
                    right={<span className="text-[10px] text-gray-500">{q?.source || '시세 없음'}</span>}
                >
                    <div className="grid grid-cols-3 gap-2">
                        <Stat label="현재가" value={won(q?.lastPrice)} />
                        <Stat label="매수 1호가" value={<span className="text-red-400">{won(q?.bidPrice)}</span>} />
                        <Stat label="매도 1호가" value={<span className="text-blue-400">{won(q?.askPrice)}</span>} />
                        <Stat label="갱신" value={<span className="text-gray-400">{hhmmss(q?.ts)}</span>} />
                        <Stat label="매수호가 잔량" value={<span className="text-gray-300">{qty(q?.bidQty)}</span>} />
                        <Stat label="매도호가 잔량" value={<span className="text-gray-300">{qty(q?.askQty)}</span>} />
                    </div>
                </Card>

                <Card title="② 포지션 · 손익" icon="Coins">
                    <div className="grid grid-cols-3 gap-2">
                        <Stat label="보유수량" value={qty(pos?.qty)} />
                        <Stat label="평균단가" value={won(pos?.avgPrice)} />
                        <Stat label="합계손익" value={<span className={pnlColor(pos?.totalPnl)}>{signWon(pos?.totalPnl)}</span>} />
                        <Stat label="실현손익" value={<span className={pnlColor(pos?.realizedPnl)}>{signWon(pos?.realizedPnl)}</span>} />
                        <Stat label="평가손익" value={<span className={pnlColor(pos?.unrealizedPnl)}>{signWon(pos?.unrealizedPnl)}</span>} />
                        <Stat
                            label="오늘 체결"
                            value={<span className="text-gray-300">{data?.today?.stat?.fillCount ?? 0}건</span>}
                        />
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2">
                        오늘 강제정산: {data?.today?.forceSettled === null || data?.today?.forceSettled === undefined
                            ? '아직 없음'
                            : data.today.forceSettled
                                ? '성공(잔여 0주)'
                                : `실패(잔여 ${data.today.closingQty}주)`}
                    </div>
                </Card>
            </div>

            {/* ── ③ 주문목록 / ④ 체결내역 ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card
                    title="③ 주문목록"
                    icon="BookOpen"
                    right={<span className="text-[10px] text-gray-500">{data?.orders?.length ?? 0}건</span>}
                >
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="text-gray-500 sticky top-0 bg-gray-800">
                                <tr className="text-left">
                                    <th className="py-1.5 pr-2 font-medium">시각</th>
                                    <th className="py-1.5 pr-2 font-medium">구분</th>
                                    <th className="py-1.5 pr-2 font-medium text-right">지정가</th>
                                    <th className="py-1.5 pr-2 font-medium text-right">주문/체결/잔량</th>
                                    <th className="py-1.5 font-medium">상태</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300">
                                {(data?.orders ?? []).map(o => (
                                    <tr key={o.id} className="border-t border-gray-700/60">
                                        <td className="py-1.5 pr-2 text-gray-500">{hhmmss(o.createdAt)}</td>
                                        <td className={`py-1.5 pr-2 font-bold ${o.side === 'BUY' ? 'text-red-400' : 'text-blue-400'}`}>
                                            {o.side === 'BUY' ? '매수' : '매도'}
                                        </td>
                                        <td className="py-1.5 pr-2 text-right">{Number(o.limitPrice).toLocaleString()}</td>
                                        <td className="py-1.5 pr-2 text-right tabular-nums">
                                            {o.orderQty.toLocaleString()} / {o.filledQty.toLocaleString()} / {o.remainingQty.toLocaleString()}
                                        </td>
                                        <td className={`py-1.5 font-medium ${ORDER_STATUS_STYLE[o.status] ?? 'text-gray-400'}`}>{o.status}</td>
                                    </tr>
                                ))}
                                {(data?.orders ?? []).length === 0 && (
                                    <tr><td colSpan={5} className="py-4 text-center text-gray-600">주문이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card
                    title="④ 체결내역"
                    icon="Activity"
                    right={<span className="text-[10px] text-gray-500">{data?.fills?.length ?? 0}건</span>}
                >
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="text-gray-500 sticky top-0 bg-gray-800">
                                <tr className="text-left">
                                    <th className="py-1.5 pr-2 font-medium">시각</th>
                                    <th className="py-1.5 pr-2 font-medium">구분</th>
                                    <th className="py-1.5 pr-2 font-medium text-right">체결가</th>
                                    <th className="py-1.5 pr-2 font-medium text-right">수량</th>
                                    <th className="py-1.5 font-medium text-right">주문</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300">
                                {(data?.fills ?? []).map(f => (
                                    <tr key={f.id} className="border-t border-gray-700/60">
                                        <td className="py-1.5 pr-2 text-gray-500">{hhmmss(f.filledAt)}</td>
                                        <td className={`py-1.5 pr-2 font-bold ${f.side === 'BUY' ? 'text-red-400' : 'text-blue-400'}`}>
                                            {f.side === 'BUY' ? '매수' : '매도'}
                                        </td>
                                        <td className="py-1.5 pr-2 text-right">{Number(f.fillPrice).toLocaleString()}</td>
                                        <td className="py-1.5 pr-2 text-right tabular-nums">{f.fillQty.toLocaleString()}</td>
                                        <td className="py-1.5 text-right text-gray-500">#{f.orderId}</td>
                                    </tr>
                                ))}
                                {(data?.fills ?? []).length === 0 && (
                                    <tr><td colSpan={5} className="py-4 text-center text-gray-600">체결이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* ── ⑤ 설정 ─────────────────────────────────────────── */}
            <Card
                title="⑤ 설정"
                icon="Settings"
                right={
                    <span className="text-[10px] text-gray-500">
                        매매 모드 {data?.tradingMode ?? 'SIMULATION'} (변경 불가)
                    </span>
                }
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <label className="block">
                        <span className="text-[11px] text-gray-500">종목코드</span>
                        <input value={form.symbol} onChange={setField('symbol')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">종목명</span>
                        <input value={form.symbolName} onChange={setField('symbolName')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">기본 주문수량(주)</span>
                        <input type="number" min={1} value={form.defaultQty} onChange={setField('defaultQty')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">마감버퍼(분) — 15:30 기준</span>
                        <input type="number" min={1} max={180} value={form.closeBufferMin} onChange={setField('closeBufferMin')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">최대 보유수량(주)</span>
                        <input type="number" min={1} value={form.maxPositionQty} onChange={setField('maxPositionQty')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">일일 최대손실(원, 양수)</span>
                        <input type="number" min={0} value={form.dailyLossLimit} onChange={setField('dailyLossLimit')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">손절 하락률(%, 0=사용안함)</span>
                        <input type="number" min={0} step="0.1" value={form.stopLossPct} onChange={setField('stopLossPct')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">최대 추가매수 횟수(0=무제한)</span>
                        <input type="number" min={0} value={form.maxAddBuys} onChange={setField('maxAddBuys')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                        <span className="text-[11px] text-gray-500">물타기 중단 하락률(%, 0=사용안함)</span>
                        <input type="number" min={0} step="0.1" value={form.noAddBuyBelowPct} onChange={setField('noAddBuyBelowPct')}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 outline-none" />
                    </label>
                </div>
                <div className="flex items-center gap-3 mt-3">
                    <button
                        onClick={saveConfig}
                        disabled={saving || !formDirty}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
                    >
                        {saving ? '저장 중…' : '설정 저장'}
                    </button>
                    {formDirty && <span className="text-[11px] text-amber-300">저장하지 않은 변경이 있습니다.</span>}
                    <span className="text-[11px] text-gray-500 ml-auto">
                        기본 주문수량은 최대 보유수량을 넘을 수 없습니다.
                    </span>
                </div>
            </Card>

            {/* ── 엔진 로그(참고) ─────────────────────────────────── */}
            {(data?.engine?.logs?.length ?? 0) > 0 && (
                <Card title="엔진 로그(최근 50줄)" icon="Server">
                    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-all max-h-56 overflow-y-auto leading-relaxed">
                        {data!.engine.logs.join('\n')}
                    </pre>
                </Card>
            )}
        </div>
    );
};
