import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 토스 자동매매 봇 어드민.
// 봇은 서버1 pm2에서 상시 실행. 상태는 봇이 서버1 파일(status.json)에 기록한 것을 읽는다.
// 워크플로우 6탭: 발굴(찾기) → 선택(확정+종목별 점수 설정+직접추가) → 모니터링(실행 현황·
//   일손실 여유) → 평가(점수 근거) → 로그(레벨 필터) → 설정(읽기 전용).
// 쓰기 채널은 selection.json(종목 선택·halt·종목별 params)·custom_symbols.json 뿐.
// ★모드(DEBUG/LIVE) 전환은 안전상 웹에서 불가 — 서버1 ecosystem.config.js 에서만.

const won = (n: any) => (n == null ? '-' : Number(n).toLocaleString() + '원');
const pct = (n: any) => (n == null ? '-' : Number(n) + '%');

// 봇 로그 표시 시각 = 한국시간(KST).
// 2026-07-09부터 봇 logger.py 가 KST 로 직접 찍고 라인에 " KST" 표기를 붙인다.
//  - "KST" 표기가 있으면 이미 한국시간 → 그대로 둔다(이중변환 방지).
//  - 표기가 없으면 옛 UTC 로그 → 기존처럼 +9h 변환(하위호환, 로테이션 후엔 사라짐).
const pad2 = (n: number) => String(n).padStart(2, '0');
const toKstLine = (line: string) => {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:,\d+)? KST\b/.test(line)) return line;
    return line.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:,\d+)?/, (m, d, t) => {
        const utc = new Date(`${d}T${t}Z`);
        if (isNaN(utc.getTime())) return m;
        const k = new Date(utc.getTime() + 9 * 3600 * 1000);
        return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())} ${pad2(k.getUTCHours())}:${pad2(k.getUTCMinutes())}:${pad2(k.getUTCSeconds())} KST`;
    });
};

// 모바일은 오버레이 스크롤바가 기본 숨김이라 로그 위치를 알 수 없음 → 항상 보이게 강제.
const LOG_SCROLL_CSS = `
.toss-log-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: #6b7280 rgba(255,255,255,0.08); }
.toss-log-scroll::-webkit-scrollbar { -webkit-appearance: none; width: 8px; height: 8px; }
.toss-log-scroll::-webkit-scrollbar-thumb { background: #6b7280; border-radius: 4px; }
.toss-log-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.08); border-radius: 4px; }
`;

// 워크플로우 순서: 발굴(찾기) → 선택(확정·설정) → 모니터링(실행 현황) → 평가(점수 근거) → 로그 → 설정
type View = 'scan' | 'select' | 'monitor' | 'score' | 'log' | 'settings';
type LogFilter = 'all' | 'info' | 'order' | 'error';

export const TossTraderPanel: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [scanData, setScanData] = useState<any>(null);      // 발굴 스캔 결과
    const [logs, setLogs] = useState<string[]>([]);
    const [orders, setOrders] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<View>('scan');          // 최상위 탭 — 발굴부터 시작
    const [logTab, setLogTab] = useState<'log' | 'order'>('log'); // 로그 서브탭(실행/주문)
    const [logFilter, setLogFilter] = useState<LogFilter>('all'); // 로그 레벨 필터
    const [expanded, setExpanded] = useState(false);         // 로그 전체화면 모달
    const [openSymbol, setOpenSymbol] = useState<string | null>(null); // 발굴 표 상세 펼침
    // 종목 통합 분석(봇 점수 + 채원 펀더멘털) 보고서 모달
    const [analyzeOpen, setAnalyzeOpen] = useState(false);
    const [analyzeSym, setAnalyzeSym] = useState<string | null>(null);   // 분석 중인 종목
    const [analyzeReport, setAnalyzeReport] = useState<string | null>(null);
    const [analyzeStatus, setAnalyzeStatus] = useState<string>('');      // '', 'loading', 'done', 'error'
    const [analyzeMsg, setAnalyzeMsg] = useState<string>('');
    // ⑤ Phase 2 — 종목 선택(selection.json). checked=null 이면 아직 서버값 미반영
    const [selection, setSelection] = useState<any>(null);
    const [checked, setChecked] = useState<string[] | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    // 사장 직접 추가 종목(유니버스 밖) — custom_symbols.json
    const [custom, setCustom] = useState<{ symbols: Record<string, string>; max: number } | null>(null);
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [customMsg, setCustomMsg] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [s, l, o, sc, sel, cu] = await Promise.all([
                adminApi.getTossStatus(),
                adminApi.getTossLogs(120),
                adminApi.getTossOrders(80),
                adminApi.getTossScan().catch(() => null), // 스캔 결과 실패해도 나머진 표시
                adminApi.getTossSelection().catch(() => null),
                adminApi.getTossCustomSymbols().catch(() => null),
            ]);
            setData(s);
            setLogs(l.lines || []);
            setOrders(o.lines || []);
            setScanData(sc);
            setSelection(sel);
            setCustom(cu);
            setError(null);
        } catch {
            setError('불러오기 실패 (봇 미기동이거나 서버 오류)');
        }
    }, []);

    const savedSymbols: string[] = selection?.selection?.symbols || [];
    const maxSelect: number = selection?.max ?? 5;
    const haltActive: boolean = !!selection?.selection?.halt;
    const effChecked = checked ?? savedSymbols;           // 편집 전엔 서버 저장값 표시
    const dirty = checked != null && JSON.stringify([...checked].sort()) !== JSON.stringify([...savedSymbols].sort());

    // ── 종목별 점수 설정(params) — 매수 임계·손절%·익절%를 종목마다 개별 지정 ──
    // 서버 저장값(소수: 0.03=3%). 편집분은 editParams 에 문자열로 담아 입력 자유도 확보.
    const savedParams: Record<string, any> = selection?.selection?.params || {};
    const bounds: Record<string, [number, number]> = selection?.paramBounds || {
        buyThreshold: [1, 100], stopLossPct: [0, 0.5], takeProfitPct: [0, 0.5],
    };
    const defaultThreshold: number = Number(scanData?.scan?.buyThreshold ?? data?.status?.buyThreshold ?? 80);
    const [editParams, setEditParams] = useState<Record<string, Record<string, string>>>({});
    const [paramsOpen, setParamsOpen] = useState(false);

    const toggleSymbol = (sym: string) => {
        const base = checked ?? savedSymbols;
        const next = base.includes(sym) ? base.filter(s => s !== sym)
            : base.length >= maxSelect ? base : [...base, sym];
        setChecked(next);
        setSaveMsg(null);
    };

    // 종목·항목의 현재 표시값(편집 중이면 편집값, 아니면 저장값, 없으면 기본값).
    // 화면 단위는 %(사람이 읽기 쉽게), 저장은 소수 — buyThreshold 만 정수 그대로.
    const paramDisplay = (sym: string, key: string): string => {
        const e = editParams[sym]?.[key];
        if (e !== undefined) return e;
        const saved = savedParams[sym]?.[key];
        if (saved !== undefined) {
            return key === 'buyThreshold' ? String(saved) : String(+(saved * 100).toFixed(2));
        }
        // 저장값 없음 = 기본값(표시용)
        if (key === 'buyThreshold') return String(defaultThreshold);
        return key === 'stopLossPct' ? '3' : '8'; // 전략 기본 3%/8%
    };
    const setParam = (sym: string, key: string, val: string) => {
        setEditParams(p => ({ ...p, [sym]: { ...(p[sym] || {}), [key]: val } }));
        setSaveMsg(null);
    };
    const paramsDirty = Object.keys(editParams).length > 0;

    // 편집분(%표시)을 저장 단위(소수)로 환산 + 범위 클램프. 잘못된 입력은 그 항목 제외.
    const buildParamsPayload = (): Record<string, Record<string, number>> => {
        const out: Record<string, Record<string, number>> = {};
        for (const sym of effChecked) {
            const merged: Record<string, number> = {};
            for (const key of ['buyThreshold', 'stopLossPct', 'takeProfitPct']) {
                const raw = paramDisplay(sym, key);
                const num = Number(raw);
                if (!Number.isFinite(num)) continue;
                const val = key === 'buyThreshold' ? Math.round(num) : +(num / 100).toFixed(4);
                const [lo, hi] = bounds[key] || [0, 1e9];
                if (val < lo || val > hi) continue;
                merged[key] = val;
            }
            if (Object.keys(merged).length) out[sym] = merged;
        }
        return out;
    };

    const saveSelection = async () => {
        // 선택(symbols)과 점수설정(params)을 함께 저장 — 한 번의 저장으로 봇에 반영.
        setSaving(true);
        try {
            const payload: any = { symbols: effChecked, params: buildParamsPayload() };
            await adminApi.saveTossSelection(payload);
            setChecked(null);
            setEditParams({});
            setSaveMsg('저장됨 — 봇이 60초 내 반영합니다');
            await load();
        } catch (e: any) {
            setSaveMsg(`저장 실패: ${e?.message || '오류'}`);
        } finally {
            setSaving(false);
        }
    };

    // 종목 통합 분석 — 봇 추세 점수 + 채원 펀더멘털을 합친 보고서. 비동기(등록→워커 처리→폴링).
    const runAnalyze = async (sym: string, name: string) => {
        setAnalyzeOpen(true);
        setAnalyzeSym(sym);
        setAnalyzeReport(null);
        setAnalyzeStatus('loading');
        setAnalyzeMsg(`${name}(${sym}) 분석 요청 중… (봇 점수 + 재무·수급·뉴스 종합, 20~40초 소요)`);
        try {
            const { id } = await adminApi.requestTossAnalyze({ symbol: sym });
            // 최대 ~90초 폴링(3초 간격). 워커가 크론으로 도므로 처리까지 시간차 있음.
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 3000));
                const t = await adminApi.getTossAnalyze(id);
                if (t.status === 'completed' && t.analysisReport) {
                    setAnalyzeReport(t.analysisReport);
                    setAnalyzeStatus('done');
                    setAnalyzeMsg('');
                    return;
                }
                if (t.status === 'failed') {
                    setAnalyzeStatus('error');
                    setAnalyzeMsg(`분석 실패: ${t.errorMessage || '워커 오류'}`);
                    return;
                }
                setAnalyzeMsg(`${name}(${sym}) 분석 중… (${(i + 1) * 3}초 경과, 보고서 생성에 시간이 걸립니다)`);
            }
            setAnalyzeStatus('error');
            setAnalyzeMsg('시간이 초과됐습니다. 잠시 후 다시 시도하거나, 채원(주식 분석)에서 결과를 확인하세요.');
        } catch (e: any) {
            setAnalyzeStatus('error');
            setAnalyzeMsg(`분석 요청 오류: ${e?.message || '오류'}`);
        }
    };

    const addCustomSymbol = async () => {
        const symbol = newCode.trim();
        const name = newName.trim();
        if (!/^\d{6}$/.test(symbol)) { setCustomMsg('종목코드는 6자리 숫자'); return; }
        if (!name) { setCustomMsg('종목명을 입력하세요'); return; }
        setSaving(true);
        try {
            await adminApi.saveTossCustomSymbols({ add: { symbol, name } });
            setNewCode(''); setNewName('');
            setCustomMsg(`${name}(${symbol}) 추가됨 — 선택하면 봇이 60초 내 반영, 점수는 다음 스캔(16시)부터`);
            await load();
        } catch (e: any) {
            setCustomMsg(`추가 실패: ${e?.message || '오류'}`);
        } finally {
            setSaving(false);
        }
    };

    const removeCustomSymbol = async (symbol: string, name: string) => {
        if (!window.confirm(`직접 추가 종목 ${name}(${symbol})을 삭제할까요? 선택돼 있으면 선택도 해제해야 합니다.`)) return;
        setSaving(true);
        try {
            await adminApi.saveTossCustomSymbols({ remove: symbol });
            await load();
        } catch (e: any) {
            setCustomMsg(`삭제 실패: ${e?.message || '오류'}`);
        } finally {
            setSaving(false);
        }
    };

    const setHalt = async (halt: boolean) => {
        const ask = halt
            ? '🔴 긴급정지: 봇이 미체결을 전량 취소하고 신규 주문을 중단합니다. 실행할까요?'
            : '정지 해제 플래그를 저장합니다. 봇 재개는 서버1에서 pm2 restart 후에만 됩니다. 진행할까요?';
        if (!window.confirm(ask)) return;
        setSaving(true);
        try {
            await adminApi.saveTossSelection({ halt });
            await load();
        } catch (e: any) {
            setSaveMsg(`처리 실패: ${e?.message || '오류'}`);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 15000); // 15초 자동 새로고침
        return () => clearInterval(t);
    }, [load]);

    const st = data?.status;
    const alive = data?.available && st?.alive;
    const stale = data?.staleSeconds != null && data.staleSeconds > 180; // 3분↑ 미갱신
    const halted = st?.halted;

    // 서버가 최신순(앞=최신)으로 주므로 그대로 join하면 최신이 맨 위. 표시 시각은 KST 변환.
    // 레벨 필터: 정보=INFO, 에러=WARNING/ERROR/CRITICAL, 주문=주문·체결·매수/매도 키워드.
    const matchesLogFilter = (line: string): boolean => {
        if (logFilter === 'all') return true;
        if (logFilter === 'error') return /\[(WARNING|ERROR|CRITICAL)\]|거부|실패|정지|HALT|🛑|🔴/.test(line);
        if (logFilter === 'order') return /주문|체결|매수|매도|BUY|SELL|청산|취소/.test(line);
        return /\[INFO\]/.test(line) && !/\[(WARNING|ERROR|CRITICAL)\]/.test(line); // info
    };
    const rawLines = (logTab === 'log' ? logs : orders);
    const shownLines = rawLines.filter(matchesLogFilter);
    const logText = shownLines.map(toKstLine).join('\n')
        || (rawLines.length ? '(이 필터에 해당하는 로그 없음)' : '(로그 없음)');

    // ESC로 모달 닫기
    useEffect(() => {
        if (!expanded) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [expanded]);

    return (
        <div className="p-4 space-y-4 text-gray-200">
            <style>{LOG_SCROLL_CSS}</style>
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Icon name="TrendingUp" className="w-5 h-5 text-blue-400" />
                    토스 자동매매 봇
                </h3>
                <div className="flex items-center gap-2">
                    {haltActive ? (
                        <button onClick={() => setHalt(false)} disabled={saving}
                            className="text-xs px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white font-medium disabled:opacity-50">
                            정지 해제 플래그
                        </button>
                    ) : (
                        <button onClick={() => setHalt(true)} disabled={saving}
                            className="text-xs px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white font-bold disabled:opacity-50">
                            🔴 긴급정지
                        </button>
                    )}
                    <button onClick={load} className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
                        새로고침
                    </button>
                </div>
            </div>

            {/* 🔴 웹 긴급정지 상태 배너 */}
            {(haltActive || st?.webHalt) && (
                <div className="text-xs bg-red-900/40 border border-red-700/60 rounded-lg px-3 py-2 text-red-200">
                    🔴 <b>웹 긴급정지 {haltActive ? '활성' : '플래그는 해제됨(봇은 아직 정지 유지)'}</b> — 봇이 신규 주문을 중단하고 미체결을 취소했습니다.
                    재개 절차: 정지 해제 플래그 저장 → 서버1에서 <code className="text-red-100">pm2 restart toss-trader</code> (수동 재시작 원칙).
                </div>
            )}

            {/* 안전 안내 — 실제 모드 반영 */}
            {st?.mode === 'LIVE' ? (
                <div className="text-xs bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-200">
                    🔴 <b>실거래(LIVE)</b> 모드 — 실제 주문이 나갑니다. 종목 선택·점수 설정 변경은 다음 장중부터 실매매에 반영됩니다.
                    모드 전환은 안전상 서버1에서만 가능합니다(웹에서는 긴급정지만).
                </div>
            ) : (
                <div className="text-xs bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-200">
                    🟢 <b>드라이런(DEBUG)</b> 모드 — 실제 주문이 나가지 않습니다. 봇은 서버1에서 상시 실행됩니다.
                </div>
            )}

            {error && <div className="text-sm text-red-400">{error}</div>}
            {data && !data.available && (
                <div className="text-sm text-gray-400">상태 파일 없음: {data.reason || '봇이 아직 상태를 기록하지 않음'}</div>
            )}

            {/* 최상위 탭 — 모바일에선 라벨이 세로로 꺾이지 않게 가로 스크롤 */}
            <div className="flex gap-1 border-b border-gray-700 overflow-x-auto toss-log-scroll">
                <ViewTab on={view === 'scan'} onClick={() => setView('scan')} icon="Search">발굴</ViewTab>
                <ViewTab on={view === 'select'} onClick={() => setView('select')} icon="CheckCircle">
                    선택{effChecked.length > 0 && <span className="ml-1 text-[10px] bg-blue-600/70 text-white rounded px-1">{effChecked.length}</span>}
                </ViewTab>
                <ViewTab on={view === 'monitor'} onClick={() => setView('monitor')} icon="Activity">모니터링</ViewTab>
                <ViewTab on={view === 'score'} onClick={() => setView('score')} icon="BarChart2">평가</ViewTab>
                <ViewTab on={view === 'log'} onClick={() => setView('log')} icon="Server">로그</ViewTab>
                <ViewTab on={view === 'settings'} onClick={() => setView('settings')} icon="Settings">설정</ViewTab>
            </div>

            {/* ── 모니터링 탭 ── */}
            {view === 'monitor' && st && (() => {
                // 일손실 한도까지 남은 여유 — 실거래에서 "봇이 언제 스스로 멈추나"의 핵심 지표.
                // 오늘 실현손익이 음수일 때 그 손실이 한도(금액)에 얼마나 근접했는지 게이지로.
                const limit = Number(st.dailyLossLimitKrw) || 0;
                const realized = Number(st.realizedPnl) || 0;
                const lossSoFar = realized < 0 ? -realized : 0;   // 오늘 난 손실(양수)
                const usedPct = limit > 0 ? Math.min(100, (lossSoFar / limit) * 100) : 0;
                const remain = Math.max(0, limit - lossSoFar);
                const danger = usedPct >= 80;
                const warn = usedPct >= 50 && usedPct < 80;
                return (
                <div className="space-y-4">
                    {/* 🛡 일손실 한도 여유 — 최상단 대시보드 */}
                    {limit > 0 && (
                        <div className={`rounded-lg px-4 py-3 border ${danger ? 'bg-red-900/30 border-red-600/50' : warn ? 'bg-amber-900/25 border-amber-600/40' : 'bg-gray-800 border-gray-700'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">🛡 오늘 일손실 한도까지 남은 여유</span>
                                <span className={`text-sm font-bold ${danger ? 'text-red-300' : warn ? 'text-amber-300' : 'text-green-400'}`}>
                                    {won(remain)} 남음
                                </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-gray-700 overflow-hidden">
                                <div className={`h-full rounded-full ${danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-green-500/70'}`}
                                    style={{ width: `${usedPct}%` }} />
                            </div>
                            <div className="flex items-center justify-between mt-1.5 text-[11px]">
                                <span className="text-gray-500">오늘 손실 {won(lossSoFar)} / 한도 {won(limit)}</span>
                                <span className={danger ? 'text-red-300 font-medium' : 'text-gray-500'}>
                                    {danger ? '⚠️ 한도 임박 — 도달 시 봇 자동 정지' : `한도의 ${usedPct.toFixed(0)}% 사용`}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 총자산 · 미실현 요약 (equity v2) */}
                    {st.equityKrw != null && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Card label="총자산 (평가액)"><span className="text-gray-100 font-bold">{won(st.equityKrw)}</span></Card>
                            <Card label="오늘 실현손익">
                                <span className={realized < 0 ? 'text-red-400 font-bold' : realized > 0 ? 'text-green-400 font-bold' : 'text-gray-300'}>
                                    {realized > 0 ? '+' : ''}{won(realized)}
                                </span>
                            </Card>
                            <Card label="갱신">
                                <span className={stale ? 'text-red-300' : 'text-gray-400'} style={{ fontSize: '0.8rem' }}>
                                    {data.staleSeconds != null ? `${data.staleSeconds}s 전` : '-'}
                                </span>
                            </Card>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card label="상태">
                            <span className={`font-bold ${alive && !stale ? 'text-green-400' : 'text-red-400'}`}>
                                {alive ? (stale ? '⚠️ 응답없음' : '🟢 작동중') : '🔴 중지'}
                            </span>
                            {stale && <div className="text-[10px] text-red-300 mt-0.5">{data.staleSeconds}s 미갱신</div>}
                            {alive && !stale && st.marketOpen === false && (
                                <div className="text-[10px] text-blue-300 mt-0.5">🌙 장외 대기(평일 09:00~15:30 외)</div>
                            )}
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

                    {/* 감시 종목 목록 (⑤ Phase 2/3 — 선택∪보유 종목별 스냅샷) */}
                    {Array.isArray(st.symbols) && st.symbols.length > 0 && (
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="text-[11px] font-medium text-gray-400 px-3 py-2 border-b border-gray-700 bg-gray-800/80">
                                감시 종목 {st.symbols.length}개
                                {Array.isArray(st.selectedSymbols) && <span className="text-gray-500"> · 웹 선택 {st.selectedSymbols.length}개 · 동시보유 한도 {st.maxPositions ?? '-'}</span>}
                            </div>
                            <div className="divide-y divide-gray-700/60">
                                {st.symbols.map((s: any) => (
                                    <div key={s.symbol} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center text-sm">
                                        <span className="text-gray-200">
                                            {s.symbolName || s.symbol} <span className="text-[10px] text-gray-500">{s.symbol}</span>
                                            {s.avgPrice ? <span className="ml-1.5 text-[10px] text-amber-300">보유 평단 {won(s.avgPrice)}</span> : null}
                                        </span>
                                        <span className="text-right text-[12px] text-gray-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{won(s.lastPrice)}</span>
                                        <span className="text-right w-14 font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            <span className={Number(s.score) >= Number(st.buyThreshold ?? 80) ? 'text-green-400' : 'text-gray-400'}>{s.score ?? '-'}</span>
                                            <span className="text-[10px] text-gray-600">점</span>
                                        </span>
                                        <span className={`text-right w-12 text-xs font-medium ${s.lastSignal === 'BUY' ? 'text-green-400' : s.lastSignal === 'SELL' ? 'text-red-400' : 'text-gray-400'}`}>
                                            {s.lastSignal}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                );
            })()}

            {/* ── 발굴 탭 (스캐너 결과: 추천 카드 + 점수순 전체 표) ── */}
            {view === 'scan' && (() => {
                const scan = scanData?.scan;
                if (!scan) {
                    return (
                        <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-6 text-center">
                            {scanData?.reason || '스캔 결과가 아직 없습니다. 봇이 장 마감 후(KST 16시) 하루 1회 스캔합니다.'}
                        </div>
                    );
                }
                const recs: any[] = scan.recommendations || [];
                const rows: any[] = scan.candidates || [];
                const th = Number(scan.threshold ?? 60);
                const buyTh = Number(scan.buyThreshold ?? 80);
                const hits = rows.filter(r => Number(r.score) >= th).length;
                return (
                    <div className="space-y-4">
                        {/* 스캔 요약 */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 px-1">
                            <span>스캔일 <b className="text-gray-300">{scan.scanDate}</b></span>
                            <span>유니버스 {scan.universeSize}종목 중 {scan.scannedCount}종목 산출</span>
                            <span>발굴 {th}점↑ <b className="text-gray-300">{hits}개</b> · 진입 {buyTh}점</span>
                            <span>시장(KODEX200) {scan.marketUp == null ? '판단불가' : scan.marketUp ? '📈 상승' : '📉 하락/횡보'}</span>
                            {(scan.errors?.length ?? 0) > 0 && <span className="text-amber-400">조회실패 {scan.errors.length}종목</span>}
                        </div>

                        {/* ⭐ 추천 카드 (규칙 기반 1~2개) — 카드에서 바로 선택 가능 */}
                        {recs.length > 0 ? (
                            <div className="grid md:grid-cols-2 gap-3">
                                {recs.map((r, i) => (
                                    <div key={r.symbol} className="bg-gradient-to-br from-amber-900/25 to-gray-800 border border-amber-600/40 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-amber-300 text-sm font-bold">⭐ 오늘의 추천 {i + 1}</span>
                                            <span className="ml-auto text-xl font-bold text-amber-200" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.score}점</span>
                                        </div>
                                        <div className="text-base font-bold text-gray-100 mt-1 flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 accent-amber-400"
                                                    checked={effChecked.includes(r.symbol)}
                                                    onChange={() => toggleSymbol(r.symbol)} />
                                                {r.name} <span className="text-xs text-gray-500 font-normal">({r.symbol})</span>
                                            </label>
                                        </div>
                                        <div className="text-xs text-gray-300 mt-2 leading-relaxed">{r.reason}</div>
                                        {r.caution && <div className="text-[11px] text-amber-300/90 mt-1.5">⚠️ {r.caution}</div>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-4 text-center">
                                오늘은 추천 없음 — {th}점 이상 후보가 없습니다(억지 추천은 하지 않습니다).
                            </div>
                        )}

                        {/* 선택 요약 배너 — 발굴 탭에선 체크만 하고, 확정·설정은 [선택] 탭에서 */}
                        <div className="bg-gray-800 border border-blue-700/40 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-300">체크한 종목 <b className="text-blue-300">{effChecked.length}</b>/{maxSelect}</span>
                            {(dirty || paramsDirty) && <span className="text-[11px] text-amber-300">· 저장 안 됨</span>}
                            <button onClick={() => setView('select')}
                                className="ml-auto text-xs px-3 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-white">
                                선택 탭에서 확정·설정 →
                            </button>
                        </div>

                        {/* 점수순 전체 표 (체크=선택, 행 클릭 → 조건별 상세) */}
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="grid grid-cols-[1.5rem_2rem_1fr_auto_auto_auto] gap-2 px-3 py-2 text-[10px] text-gray-500 border-b border-gray-700 bg-gray-800/80">
                                <span></span><span>#</span><span>종목</span>
                                <span className="text-right w-16">점수</span>
                                <span className="text-right w-20 hidden sm:block">종가</span>
                                <span className="text-right w-16 hidden sm:block">거래량배율</span>
                            </div>
                            <div className="divide-y divide-gray-700/60 max-h-[32rem] overflow-y-auto toss-log-scroll">
                                {rows.map((r, i) => {
                                    const hit = Number(r.score) >= th;
                                    const open = openSymbol === r.symbol;
                                    return (
                                        <div key={r.symbol}>
                                            <div role="button" tabIndex={0} onClick={() => setOpenSymbol(open ? null : r.symbol)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') setOpenSymbol(open ? null : r.symbol); }}
                                                className={`w-full grid grid-cols-[1.5rem_2rem_1fr_auto_auto_auto] gap-2 px-3 py-2 items-center text-left cursor-pointer hover:bg-gray-700/40 ${hit ? 'bg-green-900/15' : ''}`}>
                                                <input type="checkbox" className="w-4 h-4 accent-blue-500"
                                                    checked={effChecked.includes(r.symbol)}
                                                    disabled={!effChecked.includes(r.symbol) && effChecked.length >= maxSelect}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={() => toggleSymbol(r.symbol)} />
                                                <span className="text-[11px] text-gray-500">{i + 1}</span>
                                                <span className={`text-sm ${hit ? 'text-green-200 font-medium' : 'text-gray-300'}`}>
                                                    {r.name} <span className="text-[10px] text-gray-500">{r.symbol}</span>
                                                    {open ? ' ▾' : ''}
                                                </span>
                                                <span className={`text-right w-16 font-bold ${Number(r.score) >= buyTh ? 'text-green-400' : hit ? 'text-amber-300' : 'text-gray-400'}`}
                                                    style={{ fontVariantNumeric: 'tabular-nums' }}>{r.score}</span>
                                                <span className="text-right w-20 text-[11px] text-gray-400 hidden sm:block" style={{ fontVariantNumeric: 'tabular-nums' }}>{won(r.close)}</span>
                                                <span className="text-right w-16 text-[11px] text-gray-400 hidden sm:block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                    {r.volRatio != null ? `${Number(r.volRatio).toFixed(1)}배` : '-'}
                                                </span>
                                            </div>
                                            {open && r.detail && (
                                                <div className="px-4 pb-2 bg-gray-900/40">
                                                    {Object.entries<any>(r.detail).map(([key, v]) => (
                                                        <div key={key} className="flex items-center justify-between py-1 text-[11px]">
                                                            <span className={v.ok ? 'text-green-400' : 'text-gray-500'}>
                                                                {v.ok ? '✓' : '✗'} {v.label || key} <span className="text-gray-600">({v.crit})</span>
                                                            </span>
                                                            <span className="text-gray-400 truncate max-w-[45%] text-right" title={v.val}>
                                                                {v.val} <b className={v.ok ? 'text-green-400' : 'text-gray-600'}>+{v.pts}</b><span className="text-gray-600">/{v.max}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => runAnalyze(r.symbol, r.name)}
                                                        className="mt-1.5 text-[11px] px-3 py-1 rounded bg-emerald-800/60 border border-emerald-600/50 text-emerald-200 hover:bg-emerald-700/60">
                                                        📊 이 종목 통합 분석 (봇 점수 + 재무·수급·뉴스)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {rows.length === 0 && (
                                    <div className="text-sm text-gray-500 px-4 py-6 text-center">산출된 종목이 없습니다.</div>
                                )}
                            </div>
                        </div>
                        <div className="text-[11px] text-gray-500 px-1">
                            2단계 점수제: <b className="text-amber-300">{th}점=발굴</b>(후보 리스트업) · <b className="text-green-400">{buyTh}점=매수 진입</b>.
                            체크→저장한 종목만 봇이 감시하며, {buyTh}점 도달 시에만 매수합니다(선택 저장 후 봇 반영까지 최대 60초).
                            선택 해제해도 보유 종목의 청산(손절·익절·추세이탈) 감시는 유지됩니다.
                        </div>
                    </div>
                );
            })()}

            {/* ── 선택 탭 (매매 대상 확정 + 종목별 점수 설정 + 직접 추가) ── */}
            {view === 'select' && (() => {
                const rows: any[] = scanData?.scan?.candidates || [];
                const nameOf = (sym: string) =>
                    rows.find(r => r.symbol === sym)?.name || custom?.symbols?.[sym] || st?.symbolName || sym;
                return (
                    <div className="space-y-4">
                        {/* 저장 바 — 선택·설정 확정 */}
                        <div className="bg-gray-800 border border-blue-700/40 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-300">
                                매매 대상 <b className="text-blue-300">{effChecked.length}</b>/{maxSelect}
                            </span>
                            {effChecked.length === 0 && <span className="text-[11px] text-gray-500">선택 0개 = 매수 0 (보유분 청산 감시는 유지)</span>}
                            <div className="ml-auto flex items-center gap-2">
                                {saveMsg && <span className="text-[11px] text-gray-400">{saveMsg}</span>}
                                {(dirty || paramsDirty) && (
                                    <button onClick={() => { setChecked(null); setEditParams({}); setSaveMsg(null); }}
                                        className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">되돌리기</button>
                                )}
                                <button onClick={saveSelection} disabled={(!dirty && !paramsDirty) || saving}
                                    className={`text-xs px-4 py-1.5 rounded font-medium ${(dirty || paramsDirty) ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'} disabled:opacity-60`}>
                                    {saving ? '저장 중…' : '선택·설정 저장'}
                                </button>
                            </div>
                        </div>

                        {/* 선택된 종목별 점수 설정 — 매수 임계·손절%·익절% 개별 지정 */}
                        {effChecked.length > 0 ? (
                            <div className="bg-gray-800 rounded-lg overflow-hidden">
                                <div className="text-[11px] font-medium text-gray-400 px-3 py-2 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between">
                                    <span>⚙ 종목별 점수 설정</span>
                                    <span className="text-[10px] text-gray-500">미설정=기본값 임계 {defaultThreshold}·손절 3%·익절 8%</span>
                                </div>
                                <div className="divide-y divide-gray-700/60">
                                    {effChecked.map(sym => {
                                        const hasCustom = !!savedParams[sym] || !!editParams[sym];
                                        return (
                                            <div key={sym} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                                                <span className="text-sm text-gray-200 min-w-[7rem] flex items-center gap-1.5">
                                                    {nameOf(sym)} <span className="text-[10px] text-gray-500">{sym}</span>
                                                    {hasCustom && <span className="text-[9px] text-amber-400 bg-amber-900/30 rounded px-1">개별</span>}
                                                    <button onClick={() => runAnalyze(sym, nameOf(sym))}
                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800/60 border border-emerald-600/50 text-emerald-200 hover:bg-emerald-700/60"
                                                        title="봇 추세 점수 + 재무·수급·뉴스 통합 분석 보고서">📊 분석</button>
                                                    <button onClick={() => toggleSymbol(sym)} className="text-gray-500 hover:text-red-400 ml-0.5" aria-label="선택 해제">✕</button>
                                                </span>
                                                <div className="flex items-center gap-2 ml-auto">
                                                    <label className="flex items-center gap-1 text-[11px] text-gray-400">
                                                        임계
                                                        <input type="number" min={bounds.buyThreshold?.[0]} max={bounds.buyThreshold?.[1]}
                                                            value={paramDisplay(sym, 'buyThreshold')}
                                                            onChange={e => setParam(sym, 'buyThreshold', e.target.value)}
                                                            className="w-14 bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-200 text-right" />
                                                    </label>
                                                    <label className="flex items-center gap-1 text-[11px] text-gray-400">
                                                        손절
                                                        <input type="number" min={0} max={50} step={0.5}
                                                            value={paramDisplay(sym, 'stopLossPct')}
                                                            onChange={e => setParam(sym, 'stopLossPct', e.target.value)}
                                                            className="w-12 bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-200 text-right" />%
                                                    </label>
                                                    <label className="flex items-center gap-1 text-[11px] text-gray-400">
                                                        익절
                                                        <input type="number" min={0} max={50} step={0.5}
                                                            value={paramDisplay(sym, 'takeProfitPct')}
                                                            onChange={e => setParam(sym, 'takeProfitPct', e.target.value)}
                                                            className="w-12 bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-200 text-right" />%
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-[10px] text-gray-500 px-3 py-2 border-t border-gray-700/60">
                                    임계 = 매수 점수 기준(낮출수록 더 자주 매수). 손절/익절 = 평단 대비 %. 변경 후 위 <b className="text-blue-300">선택·설정 저장</b> 필수.
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-6 text-center">
                                아직 선택한 종목이 없습니다. <button onClick={() => setView('scan')} className="text-blue-300 underline">발굴 탭</button>에서 종목을 체크하거나, 아래에서 직접 추가하세요.
                            </div>
                        )}

                        {/* ➕ 직접 추가 종목 (유니버스 62종목 밖 — custom_symbols.json) */}
                        <div className="bg-gray-800 border border-purple-700/40 rounded-lg px-3 py-2.5 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-300">➕ 직접 추가 종목 <b className="text-purple-300">{Object.keys(custom?.symbols || {}).length}</b>/{custom?.max ?? 20}</span>
                                <input value={newCode} onChange={e => setNewCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="종목코드 6자리" inputMode="numeric"
                                    className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600" />
                                <input value={newName} onChange={e => setNewName(e.target.value.slice(0, 20))}
                                    placeholder="종목명 (예: 카카오)"
                                    onKeyDown={e => { if (e.key === 'Enter') addCustomSymbol(); }}
                                    className="w-36 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600" />
                                <button onClick={addCustomSymbol} disabled={saving}
                                    className="text-xs px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-60">추가</button>
                                {customMsg && <span className="text-[11px] text-gray-400">{customMsg}</span>}
                            </div>
                            {Object.keys(custom?.symbols || {}).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(custom!.symbols).map(([sym, name]) => {
                                        const scanned = rows.find(r => r.symbol === sym);
                                        return (
                                            <span key={sym} className="text-[11px] bg-purple-900/30 border border-purple-700/40 rounded px-2 py-1 text-purple-200 flex items-center gap-1.5">
                                                <input type="checkbox" className="w-3.5 h-3.5 accent-purple-400"
                                                    checked={effChecked.includes(sym)}
                                                    disabled={!effChecked.includes(sym) && effChecked.length >= maxSelect}
                                                    onChange={() => toggleSymbol(sym)} />
                                                {name} <span className="text-purple-400/70">{sym}</span>
                                                {scanned ? <b className="text-amber-300">{scanned.score}점</b>
                                                    : <span className="text-gray-500">스캔 전</span>}
                                                <button onClick={() => removeCustomSymbol(sym, name)}
                                                    className="text-purple-300 hover:text-white" aria-label="삭제">✕</button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="text-[10px] text-gray-500">
                                체크하면 62종목 밖이어도 매매 대상이 되고, 점수는 다음 16시 스캔부터 산출됩니다. 잘못된 코드는 봇이 시세 조회 실패로 걸러냅니다.
                            </div>
                        </div>

                        <div className="text-[11px] text-gray-500 px-1">
                            여기서 확정·저장한 종목만 봇이 감시하며, 각 종목의 임계 점수 도달 시 매수합니다(반영까지 최대 60초).
                            선택 해제해도 보유 종목의 청산(손절·익절·추세이탈) 감시는 유지됩니다.
                        </div>
                    </div>
                );
            })()}

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
                    <div className="flex gap-2 mb-2 items-center flex-wrap">
                        <TabBtn on={logTab === 'log'} onClick={() => setLogTab('log')}>실행 로그</TabBtn>
                        <TabBtn on={logTab === 'order'} onClick={() => setLogTab('order')}>주문 로그</TabBtn>
                        <button onClick={() => setExpanded(true)}
                            className="ml-auto text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
                            ⛶ 크게 보기
                        </button>
                        <span className="text-[10px] text-gray-500 self-center">한국시간 · 15초 자동갱신</span>
                    </div>
                    {/* 레벨 필터 */}
                    <div className="flex gap-1.5 mb-2 items-center flex-wrap">
                        {([['all', '전체'], ['info', '정보'], ['order', '주문'], ['error', '에러']] as [LogFilter, string][]).map(([f, label]) => (
                            <button key={f} onClick={() => setLogFilter(f)}
                                className={`text-[11px] px-2.5 py-1 rounded-full border ${logFilter === f
                                    ? (f === 'error' ? 'bg-red-700/60 border-red-500 text-red-100' : 'bg-blue-700/60 border-blue-500 text-blue-100')
                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}>
                                {label}
                            </button>
                        ))}
                        <span className="text-[10px] text-gray-500 ml-1">{shownLines.length}/{rawLines.length}줄</span>
                    </div>
                    <pre className="toss-log-scroll bg-black/60 rounded-lg p-3 text-[11px] leading-relaxed text-gray-300 overflow-auto min-h-[24rem] max-h-[70vh] whitespace-pre-wrap resize-y">
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
                    <SettingsSection title="자금 배분 · 선택 매매">
                        <Row label="최대 동시 보유">{st.maxPositions ?? '-'}종목</Row>
                        <Row label="종목당 투입 한도">{won(st.perSymbolLimitKrw)}</Row>
                        <Row label="웹 선택 상한">{st.maxSelectedSymbols ?? '-'}종목</Row>
                    </SettingsSection>
                    <SettingsSection title="운영">
                        <Row label="루프 간격">{st.loopIntervalSeconds ?? '-'}초</Row>
                        <Row label="캔들 조회 수">{st.candleCount ?? '-'}봉</Row>
                        <Row label="장시간 가드">{st.marketHoursOnly ? '켜짐 — 평일 09:00~15:30만 판단·주문' : '꺼짐(24시간 폴링)'}</Row>
                    </SettingsSection>
                </div>
            )}

            {/* 종목 통합 분석 보고서 모달 (봇 점수 + 채원 펀더멘털) */}
            {analyzeOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col p-2 sm:p-4"
                    onClick={() => setAnalyzeOpen(false)}>
                    <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden max-w-4xl w-full mx-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700 bg-gray-800">
                            <span className="text-sm font-bold text-emerald-300">📊 종목 통합 분석</span>
                            {analyzeSym && <span className="text-xs text-gray-400">{analyzeSym}</span>}
                            {analyzeStatus === 'done' && analyzeReport && (
                                <button onClick={() => {
                                    const blob = new Blob([analyzeReport], { type: 'text/markdown' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url; a.download = `${analyzeSym}_통합분석.md`; a.click();
                                    URL.revokeObjectURL(url);
                                }} className="text-[11px] px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600">⬇ 저장</button>
                            )}
                            <button onClick={() => setAnalyzeOpen(false)}
                                className="ml-auto text-gray-300 hover:text-white text-lg leading-none px-2" aria-label="닫기">✕</button>
                        </div>
                        <div className="flex-1 overflow-auto toss-log-scroll p-4">
                            {analyzeStatus === 'loading' && (
                                <div className="text-center text-gray-400 py-10">
                                    <div className="text-3xl mb-3 animate-pulse">📊</div>
                                    <div className="text-sm">{analyzeMsg}</div>
                                    <div className="text-[11px] text-gray-600 mt-2">봇 추세 점수 + DART 재무 + 네이버 수급 + 증권사 리포트 + 뉴스를 종합합니다.</div>
                                </div>
                            )}
                            {analyzeStatus === 'error' && (
                                <div className="text-center text-red-300 py-10 text-sm">{analyzeMsg}</div>
                            )}
                            {analyzeStatus === 'done' && analyzeReport && (
                                <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-gray-200 font-sans">{analyzeReport}</pre>
                            )}
                        </div>
                    </div>
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
                            <span className="text-[10px] text-gray-500 hidden sm:inline">한국시간 · 15초 자동갱신 · ESC로 닫기</span>
                            <button onClick={() => setExpanded(false)}
                                className="ml-auto text-gray-300 hover:text-white text-lg leading-none px-2"
                                aria-label="닫기">✕</button>
                        </div>
                        <pre className="toss-log-scroll flex-1 bg-black/70 p-3 text-[11px] sm:text-xs leading-relaxed text-gray-200 overflow-auto whitespace-pre-wrap">
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
        className={`text-sm px-4 py-2 -mb-px border-b-2 flex items-center gap-1.5 whitespace-nowrap shrink-0 ${on ? 'border-blue-400 text-blue-300 font-medium' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
        <Icon name={icon} className="w-4 h-4 shrink-0" />{children}
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
        className={`text-xs px-3 py-1.5 rounded whitespace-nowrap ${on ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
        {children}
    </button>
);
