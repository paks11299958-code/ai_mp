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

// 수익률 화면 표기 헬퍼 — 한국 주식 관례: 이익=빨강(▲), 손실=파랑(▼).
// (토스·증권사 앱과 동일. 서구식 초록/빨강과 반대이므로 주의.)
const signWon = (n: any) => {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    const v = Number(n);
    return (v > 0 ? '+' : '') + v.toLocaleString() + '원';
};
const signPct = (n: any, digits = 2) => {
    if (n == null || !Number.isFinite(Number(n))) return '-';
    const v = Number(n);
    return (v > 0 ? '+' : '') + v.toFixed(digits) + '%';
};
// 이익=빨강 / 손실=파랑 / 0=회색 (한국 관례)
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
type View = 'scan' | 'select' | 'profit' | 'monitor' | 'score' | 'log' | 'settings';
type LogFilter = 'all' | 'info' | 'order' | 'error';

export const TossTraderPanel: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [paperData, setPaperData] = useState<any>(null);    // 가상매매(페이퍼 봇) 상태
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
    // 손절·익절·임계 최적값 백테스트 모달
    const [btOpen, setBtOpen] = useState(false);
    const [btData, setBtData] = useState<any>(null);
    const [btStatus, setBtStatus] = useState<string>('');   // '', 'loading', 'done', 'error'
    const [btSym, setBtSym] = useState<string>('');
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
    // 채원 발굴 일기(StockDiscovery) — 날짜별 누적. discovery.latest=최신, discovery.dates=날짜목록
    const [discovery, setDiscovery] = useState<{ dates: string[]; latest: any } | null>(null);
    const [discoveryDay, setDiscoveryDay] = useState<any>(null);   // 선택한 날짜의 상세(없으면 latest)
    const [pickedDate, setPickedDate] = useState<string | null>(null);
    // 발굴 아카이브(DiscoveryRecord) — 발굴일 당일정보 박제 + D+1/D+7 추이. 서브탭 진입 시 로드.
    const [scanSub, setScanSub] = useState<'today' | 'history'>('today');
    const [archDates, setArchDates] = useState<any[] | null>(null);   // null=미로드, []=기록 없음
    const [archDate, setArchDate] = useState<string | null>(null);
    const [archDay, setArchDay] = useState<any>(null);                // {date, market, records[]}
    const [archLoading, setArchLoading] = useState(false);
    const [archOpenSym, setArchOpenSym] = useState<string | null>(null);

    const pickArchDate = useCallback(async (date: string) => {
        setArchDate(date); setArchLoading(true); setArchOpenSym(null);
        try { setArchDay(await adminApi.getDiscoveryRecordsByDate(date)); }
        catch { setArchDay(null); }
        finally { setArchLoading(false); }
    }, []);
    const loadArchive = useCallback(async () => {
        try {
            const d = await adminApi.getDiscoveryRecordDates();
            setArchDates(d.dates || []);
            if (d.dates?.length) await pickArchDate(d.dates[0].tradeDate);
        } catch { setArchDates([]); }
    }, [pickArchDate]);

    const load = useCallback(async () => {
        try {
            const [s, l, o, sel, cu, disc, paper] = await Promise.all([
                adminApi.getTossStatus(),
                adminApi.getTossLogs(120),
                adminApi.getTossOrders(80),
                adminApi.getTossSelection().catch(() => null),
                adminApi.getTossCustomSymbols().catch(() => null),
                adminApi.getTossDiscovery().catch(() => null), // 채원 발굴 일기
                adminApi.getTossPaperStatus().catch(() => null), // 가상매매(페이퍼)
            ]);
            setData(s);
            setPaperData(paper);
            setLogs(l.lines || []);
            setOrders(o.lines || []);
            setDiscovery(disc);
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
    const defaultThreshold: number = Number(data?.status?.buyThreshold ?? 80);
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
    // 손절·익절·임계 최적값 백테스트 실행(봇 동일 로직, AI 없어 빠름·무료)
    const runBacktest = async (sym: string, name: string) => {
        setBtOpen(true); setBtSym(`${name} (${sym})`); setBtData(null); setBtStatus('loading');
        try {
            const d = await adminApi.getTossBacktest(sym);
            setBtData(d); setBtStatus(d?.ok ? 'done' : 'error');
        } catch (e: any) {
            setBtData({ error: e?.message || '오류' }); setBtStatus('error');
        }
    };
    // 추천 조합을 이 종목의 설정 입력에 바로 채우기(저장은 사장이)
    const applyBacktest = (sym: string, stop: number, take: number, threshold?: number) => {
        if (threshold != null) setParam(sym, 'buyThreshold', String(threshold));
        setParam(sym, 'stopLossPct', String(+(stop * 100).toFixed(1)));
        setParam(sym, 'takeProfitPct', String(+(take * 100).toFixed(1)));
        setBtOpen(false);
        setView('select');
    };

    // 종목 통합 분석 — 비동기(요청만 하고 창 닫힘). 완료되면 채원이 텔레그램으로 요약 발송.
    // ★3중 AI라 ~1분 걸려서, 창을 붙잡지 않고 백그라운드로 돌린다(2026-07-09 사장 요청).
    const runAnalyze = async (sym: string, name: string) => {
        setAnalyzeOpen(true);
        setAnalyzeSym(sym);
        setAnalyzeReport(null);
        setAnalyzeStatus('requested');
        setAnalyzeMsg('');
        try {
            const r = await adminApi.requestTossAnalyze({ symbol: sym });
            setAnalyzeMsg(r?.reused
                ? `${name}(${sym})은 이미 분석 중입니다. 완료되면 텔레그램으로 보내드립니다.`
                : `${name}(${sym}) 분석을 요청했습니다. 재무·수급·뉴스·봇 점수를 종합해 약 1분 뒤 텔레그램으로 요약을 보내드립니다. 발굴 카드의 '투자 요약'이 비어 있었다면 완료 후 자동으로 채워집니다.`);
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
            : '정지 해제 플래그만 저장합니다(봇 재시작은 안 함). 보통은 "정지 해제 + 재시작"을 쓰세요. 진행할까요?';
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

    // 🔴 긴급정지 해제 + 봇 재시작을 한 번에(래치 해제). 리스크 halt(위험 감지)면
    // 서버가 409로 막고, 사용자가 원인 확인 후 force 로 재확인해야 진행된다.
    const restartBot = async (force = false) => {
        const ask = force
            ? '⚠️ 리스크 정지(위험 감지)를 무시하고 재시작합니다. 원인을 확인하셨습니까? 계속할까요?'
            : '정지를 해제하고 봇을 재시작합니다(래치 해제). 재시작 후 정상 가동됩니다. 진행할까요?';
        if (!window.confirm(ask)) return;
        setSaving(true);
        setSaveMsg('봇 재시작 중… (최대 15초)');
        try {
            const r = await adminApi.restartTossBot(force);
            setSaveMsg(r?.message || '재시작 완료');
            await load();
        } catch (e: any) {
            // 409 risk_halt = 위험 정지라 force 재확인 유도
            const detail = e?.response?.data || e?.data || {};
            if (detail?.error === 'risk_halt' || /risk_halt|리스크/.test(e?.message || '')) {
                if (window.confirm(`${detail?.message || '리스크 정지 상태입니다.'}\n\n그래도 재시작하시겠습니까?`)) {
                    setSaving(false);
                    return restartBot(true);
                }
                setSaveMsg('재시작 취소(리스크 정지 확인 필요).');
            } else {
                setSaveMsg(`재시작 실패: ${detail?.message || e?.message || '오류'}`);
            }
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

    // 종목코드 → 한글명 통합 조회(어드민 전 화면에서 이름이 항상 뜨도록).
    // 여러 소스를 순서대로: 봇 status 이름맵 > 직접추가 > 발굴일기 > 못 찾으면 코드.
    const symName = (code: string): string => {
        if (!code) return code;
        const fromStatus = st?.symbolNames?.[code];
        if (fromStatus && fromStatus !== code) return fromStatus;
        if (custom?.symbols?.[code]) return custom.symbols[code];
        const disc = discovery?.latest;
        if (disc?.kospiJson?.symbol === code && disc.kospiJson.name) return disc.kospiJson.name;
        if (disc?.kosdaqJson?.symbol === code && disc.kosdaqJson.name) return disc.kosdaqJson.name;
        return code;
    };

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
        <div className="p-4 space-y-4 text-gray-200 h-full overflow-y-auto toss-log-scroll">
            <style>{LOG_SCROLL_CSS}</style>
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Icon name="TrendingUp" className="w-5 h-5 text-blue-400" />
                    토스 자동매매 봇
                </h3>
                <div className="flex items-center gap-2">
                    {(haltActive || st?.webHalt || halted) ? (
                        <button onClick={() => restartBot(false)} disabled={saving}
                            className="text-xs px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white font-bold disabled:opacity-50">
                            ▶ 정지 해제 + 재시작
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
                    재개하려면 위의 <b className="text-green-300">▶ 정지 해제 + 재시작</b> 버튼을 누르세요(해제 후 봇이 자동 재시작됩니다).
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
                <ViewTab on={view === 'profit'} onClick={() => setView('profit')} icon="TrendingUp">수익률</ViewTab>
                <ViewTab on={view === 'monitor'} onClick={() => setView('monitor')} icon="Activity">모니터링</ViewTab>
                <ViewTab on={view === 'score'} onClick={() => setView('score')} icon="BarChart2">평가</ViewTab>
                <ViewTab on={view === 'log'} onClick={() => setView('log')} icon="Server">로그</ViewTab>
                <ViewTab on={view === 'settings'} onClick={() => setView('settings')} icon="Settings">설정</ViewTab>
            </div>

            {/* ── 수익률 탭 (토스 '내 투자' 스타일 대표 화면) ── */}
            {view === 'profit' && (() => {
                if (!st) {
                    return <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-6 text-center">봇 상태를 불러오는 중입니다…</div>;
                }
                // ── 계좌 전체 수익률: (총평가액 − 초기자본) / 초기자본 ──
                const equity = Number(st.equityKrw);
                const initCap = Number(st.initialCapitalKrw);
                const hasEquity = Number.isFinite(equity) && equity > 0;
                const hasInit = Number.isFinite(initCap) && initCap > 0;
                const totalPnl = hasEquity && hasInit ? equity - initCap : null;      // 총손익(실현+미실현)
                const totalPct = totalPnl != null ? (totalPnl / initCap) * 100 : null;

                // ── 보유 종목별 평가손익 (미실현) ──
                // 장중엔 st.symbols[]에 평단·현재가·수량이 담김. 보유(avgPrice 있고 수량>0)만.
                const rows: any[] = Array.isArray(st.symbols) ? st.symbols : [];
                const holdings = rows.filter(s => s.avgPrice && Number(s.avgPrice) > 0
                    && (s.quantity == null || Number(s.quantity) > 0));
                const holdMetric = (s: any) => {
                    const avg = Number(s.avgPrice);
                    const cur = Number(s.lastPrice);
                    const qty = s.quantity != null && Number.isFinite(Number(s.quantity)) ? Number(s.quantity) : null;
                    const okPrice = Number.isFinite(avg) && avg > 0 && Number.isFinite(cur) && cur > 0;
                    const pctVal = okPrice ? ((cur - avg) / avg) * 100 : null;         // 미실현 수익률
                    const amtVal = okPrice && qty != null ? (cur - avg) * qty : null;  // 미실현 금액(수량 필요)
                    return { avg, cur, qty, pctVal, amtVal };
                };
                // 보유분 미실현 손익 합계(금액 계산 가능한 종목만)
                const unrealTotal = holdings.reduce((acc, s) => {
                    const m = holdMetric(s); return acc + (m.amtVal != null ? m.amtVal : 0);
                }, 0);
                const anyAmt = holdings.some(s => holdMetric(s).amtVal != null);

                const realizedToday = Number(st.realizedPnl);
                const realizedTotal = st.realizedPnlTotalKrw;
                const marketClosed = st.marketOpen === false;

                return (
                    <div className="space-y-4">
                        {/* 🏆 대표 카드 — 총평가액 + 계좌 전체 손익 */}
                        <div className="rounded-2xl px-5 py-5 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700">
                            <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                                <span>내 투자 · 총 평가금액</span>
                                {/* 장외에도 봇이 스냅샷을 실어줌 — 기준 표기.
                                    priceBasis: nxt=넥스트장(NXT, 평일 08~20시) 실시간 / close=마지막 체결가 동결 */}
                                {marketClosed && hasEquity && (
                                    st.priceBasis === 'nxt'
                                        ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">🌃 넥스트장(NXT) 반영</span>
                                        : <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">🌙 넥스트장 마감가 기준</span>
                                )}
                            </div>
                            <div className="text-3xl font-bold text-gray-50 tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {hasEquity ? equity.toLocaleString() : '-'}<span className="text-lg text-gray-400 font-medium ml-1">원</span>
                            </div>
                            {totalPnl != null ? (
                                <div className={`mt-1.5 text-base font-bold flex items-center gap-1.5 ${pnlColor(totalPnl)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    <span>{pnlArrow(totalPnl)} {signWon(totalPnl)}</span>
                                    <span className="text-sm">({signPct(totalPct)})</span>
                                </div>
                            ) : (
                                <div className="mt-1.5 text-xs text-gray-500">
                                    {!hasInit ? '초기자본(원금) 미설정 — 서버 config의 INITIAL_CAPITAL_KRW 필요' : '평가금액 산출 대기(봇 갱신)'}
                                </div>
                            )}
                            {hasInit && (
                                <div className="mt-3 pt-3 border-t border-gray-700/60 flex items-center justify-between text-[11px] text-gray-500">
                                    <span>원금(초기자본) {initCap.toLocaleString()}원</span>
                                    <span className={stale ? 'text-red-300' : ''}>{data?.staleSeconds != null ? `${data.staleSeconds}s 전 갱신` : ''}</span>
                                </div>
                            )}
                        </div>

                        {/* 실현 / 미실현 손익 요약 2칸 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-800 rounded-xl px-4 py-3">
                                <div className="text-[11px] text-gray-500 mb-1">누적 실현손익</div>
                                <div className={`text-lg font-bold ${pnlColor(realizedTotal)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {realizedTotal == null ? '-' : signWon(realizedTotal)}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">지금까지 사고팔아 확정된 손익 누계</div>
                            </div>
                            <div className="bg-gray-800 rounded-xl px-4 py-3">
                                <div className="text-[11px] text-gray-500 mb-1">오늘 실현손익</div>
                                <div className={`text-lg font-bold ${pnlColor(realizedToday)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {Number.isFinite(realizedToday) ? signWon(realizedToday) : '-'}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">오늘 확정된 손익(장 마감 시 리셋)</div>
                            </div>
                        </div>

                        {/* 📈 보유 종목별 평가손익(미실현) */}
                        <div className="bg-gray-800 rounded-xl overflow-hidden">
                            <div className="text-[11px] font-medium text-gray-400 px-4 py-2.5 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between">
                                <span>📈 보유 종목 평가손익 {holdings.length > 0 && <span className="text-gray-500">({holdings.length})</span>}</span>
                                {anyAmt && (
                                    <span className={`text-xs font-bold ${pnlColor(unrealTotal)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        합계 {signWon(unrealTotal)}
                                    </span>
                                )}
                            </div>
                            {holdings.length > 0 ? (
                                <div className="divide-y divide-gray-700/60">
                                    {holdings.map((s: any) => {
                                        const m = holdMetric(s);
                                        const invest = m.qty != null && Number.isFinite(m.avg) ? m.avg * m.qty : null;   // 종목별 총 투자금
                                        const evalAmt = m.qty != null && Number.isFinite(m.cur) ? m.cur * m.qty : null;  // 현재 평가금
                                        return (
                                            <div key={s.symbol} className="px-4 py-3">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm text-gray-100 font-medium">
                                                        {s.symbolName && s.symbolName !== s.symbol ? s.symbolName : symName(s.symbol)}
                                                        <span className="text-[10px] text-gray-500 ml-1.5">{s.symbol}</span>
                                                        {m.qty != null && <span className="text-[10px] text-gray-400 ml-1.5">{m.qty}주</span>}
                                                    </span>
                                                    <span className={`text-base font-bold ${pnlColor(m.pctVal)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                        {pnlArrow(m.pctVal)} {signPct(m.pctVal)}
                                                        {m.amtVal != null && <span className="text-sm ml-1.5">{signWon(m.amtVal)}</span>}
                                                    </span>
                                                </div>
                                                {/* 평단→현재가: 크게(사장 지시 07-16). 현재가=넥스트장 반영(priceBasis) */}
                                                <div className="text-base text-gray-200 font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                    평단 {won(m.avg)} → 현재 <span className={pnlColor(m.pctVal)}>{won(m.cur)}</span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between text-[12px] text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                    <span>투자 <b className="text-gray-300">{invest != null ? won(Math.round(invest)) : '-'}</b>
                                                        {' → '}평가 <b className={evalAmt != null && invest != null ? pnlColor(evalAmt - invest) : 'text-gray-300'}>{evalAmt != null ? won(Math.round(evalAmt)) : '-'}</b></span>
                                                    {m.amtVal == null && <span className="text-gray-600">금액=수량 확인 중</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-4 py-6 text-center text-sm text-gray-500">
                                    {'현재 보유 중인 종목이 없습니다. (봇이 매수하면 여기에 평가손익이 표시됩니다' +
                                     (marketClosed ? ' — 장외엔 마감가 기준)' : ')')}
                                </div>
                            )}
                        </div>

                        {/* 📝 가상매매(P2 페이퍼 봇) — 실계좌 vs 가상 수익률 비교 */}
                        {(() => {
                            const pst = paperData?.status;
                            if (!paperData?.available || !pst) {
                                return (
                                    <div className="bg-gray-800/40 rounded-xl border border-dashed border-gray-700 px-4 py-3 text-[11px] text-gray-500">
                                        📝 가상매매(페이퍼 봇)가 아직 미기동입니다. 기동되면 여기에 실계좌 vs 가상 수익률 비교가 표시됩니다.
                                    </div>
                                );
                            }
                            const pEquity = Number(pst.equityKrw);
                            const pInit = Number(pst.initialCapitalKrw);
                            const pOk = Number.isFinite(pEquity) && pEquity > 0 && Number.isFinite(pInit) && pInit > 0;
                            const pPnl = pOk ? pEquity - pInit : null;
                            const pPct = pPnl != null ? (pPnl / pInit) * 100 : null;
                            const pRows: any[] = Array.isArray(pst.symbols) ? pst.symbols : [];
                            const pHold = pRows.filter((s: any) => s.avgPrice && Number(s.avgPrice) > 0
                                && (s.quantity == null || Number(s.quantity) > 0));
                            const pStale = (paperData?.staleSeconds ?? 0) > 300;
                            const cmpCol = (label: string, pct: number | null, sub: string) => (
                                <div className="bg-gray-900/60 rounded-lg px-3 py-2.5 text-center">
                                    <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
                                    <div className={`text-lg font-bold ${pnlColor(pct)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {pct == null ? '-' : `${pnlArrow(pct)} ${signPct(pct)}`}
                                    </div>
                                    <div className="text-[10px] text-gray-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{sub}</div>
                                </div>
                            );
                            return (
                                <div className="bg-gray-800 rounded-xl overflow-hidden border border-indigo-700/30">
                                    <div className="text-[11px] font-medium text-indigo-300 px-4 py-2.5 border-b border-gray-700 bg-indigo-900/20 flex items-center justify-between">
                                        <span>📝 가상매매 (페이퍼 봇 — 실주문 없음, 발굴 추천 자동선택)</span>
                                        <span className={`text-[10px] ${pStale ? 'text-red-300' : 'text-gray-500'}`}>
                                            {paperData?.staleSeconds != null ? `${paperData.staleSeconds}s 전 갱신` : ''}
                                        </span>
                                    </div>
                                    <div className="p-3 space-y-3">
                                        {/* 수익률 비교: 실계좌 vs 가상 */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {cmpCol('💰 실계좌 (LIVE)', totalPct,
                                                hasEquity ? `${equity.toLocaleString()}원 / 원금 ${hasInit ? initCap.toLocaleString() : '-'}원` : '평가액 대기')}
                                            {cmpCol('📝 가상 (PAPER)', pPct,
                                                pOk ? `${pEquity.toLocaleString()}원 / 원금 ${pInit.toLocaleString()}원` : '평가액 대기')}
                                        </div>
                                        {/* 가상 보유 + 오늘/누적 실현 */}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            <span>가상 오늘 실현 <b className={pnlColor(pst.realizedPnl)}>{Number.isFinite(Number(pst.realizedPnl)) ? signWon(pst.realizedPnl) : '-'}</b></span>
                                            <span>가상 누적 실현 <b className={pnlColor(pst.realizedPnlTotalKrw)}>{pst.realizedPnlTotalKrw == null ? '-' : signWon(pst.realizedPnlTotalKrw)}</b></span>
                                            <span>가상 감시 종목 {Array.isArray(pst.selectedSymbols) ? pst.selectedSymbols.length : 0}개
                                                {Array.isArray(pst.selectedSymbols) && pst.selectedSymbols.length > 0 &&
                                                    ` (${pst.selectedSymbols.map((c: string) => pst.symbolNames?.[c] || c).join(', ')})`}</span>
                                        </div>
                                        {pHold.length > 0 && (
                                            <div className="divide-y divide-gray-700/60 border-t border-gray-700/60">
                                                {pHold.map((s: any) => {
                                                    const m = holdMetric(s);
                                                    return (
                                                        <div key={s.symbol} className="flex items-center justify-between py-2 text-[12px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                            <span className="text-gray-200">{s.symbolName && s.symbolName !== s.symbol ? s.symbolName : symName(s.symbol)}
                                                                <span className="text-[10px] text-gray-500 ml-1">{m.qty != null ? `${m.qty}주` : ''}</span></span>
                                                            <span className="text-gray-500">평단 {won(m.avg)} → {won(m.cur)}</span>
                                                            <span className={`font-bold ${pnlColor(m.pctVal)}`}>{pnlArrow(m.pctVal)} {signPct(m.pctVal)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <div className="text-[10px] text-gray-600">
                                            같은 전략을 실계좌와 가상 계좌가 나란히 굴립니다. 가상은 발굴 추천을 자동 선택하므로,
                                            수익률 차이 = "사장 선택 vs 봇 추천"의 성과 비교이기도 합니다.
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 설명 */}
                        <details className="bg-gray-800/40 rounded-lg border border-gray-700/60">
                            <summary className="text-xs text-gray-400 px-3 py-2 cursor-pointer select-none hover:text-gray-200">ℹ️ 이 수치들은 어떻게 계산되나요? (펼치기)</summary>
                            <div className="text-[11px] text-gray-400 px-3 pb-3 space-y-1.5 leading-relaxed">
                                <div><b className="text-gray-300">총 평가금액</b> — 지금 계좌를 다 팔면 받는 돈(보유주식 현재가 평가 + 현금). 봇이 증권 API로 실측.</div>
                                <div><b className="text-gray-300">계좌 전체 손익 / 수익률</b> — (총평가액 − 원금) ÷ 원금. 원금=입금액(INITIAL_CAPITAL_KRW). 실현+미실현이 모두 반영된 진짜 성과입니다.</div>
                                <div><b className="text-gray-300">누적 실현손익</b> — 시작 이후 실제로 사고팔아 확정된 손익 총합.</div>
                                <div><b className="text-gray-300">보유 종목 평가손익</b> — 아직 안 판 종목의 (현재가 − 평단) × 수량. 팔기 전이라 '평가상' 손익(미실현).</div>
                                <div className="text-gray-500 pt-1 border-t border-gray-700/40">🇰🇷 색: <span className="text-red-400">빨강 ▲ 이익</span> / <span className="text-blue-400">파랑 ▼ 손실</span> (한국 증권 관례, 토스와 동일).</div>
                            </div>
                        </details>
                    </div>
                );
            })()}

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

                    {/* 🧭 지금 봇이 뭘 하고 있나 — 사람 말 요약 */}
                    {(() => {
                        const sel: string[] = Array.isArray(st.selectedSymbols) ? st.selectedSymbols : [];
                        const closed = st.marketOpen === false;
                        const halted = st.halted;
                        let line: string;
                        if (halted) line = '🔴 긴급정지 상태입니다. 신규 주문을 멈추고 미체결을 취소했습니다. 재개하려면 정지를 해제하고 서버에서 봇을 재시작해야 합니다.';
                        else if (closed) line = `🌙 지금은 장이 열리지 않은 시간(장외)이라 봇이 매매 판단을 쉬고 있습니다. 평일 09:00~15:30에만 사고팝니다. 아래 선택한 종목을 장이 열리면 감시·매매합니다.`;
                        else if (sel.length === 0) line = '봇이 켜져 있지만 감시할 종목이 없습니다. [선택] 탭이나 [발굴] 탭에서 종목을 담아 저장하세요.';
                        else line = `봇이 선택된 ${sel.length}개 종목을 실시간 감시 중입니다. 각 종목의 매수 점수가 임계에 도달하면 사고, 보유 중이면 손절·익절·추세이탈을 지켜봅니다.`;
                        return (
                            <div className="text-sm text-gray-200 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2.5">
                                <span className="text-emerald-300 text-xs font-medium">🧭 봇 현황</span><br />
                                {line}
                            </div>
                        );
                    })()}

                    {/* 신호 근거 */}
                    {st.signalReason && (
                        <div className="text-xs text-gray-400 bg-gray-800/60 rounded px-3 py-2">
                            판단 근거: {st.signalReason}
                        </div>
                    )}

                    {/* 감시 종목 목록 — 장중엔 종목별 실시간 스냅샷(st.symbols),
                        장외엔 선택 목록(selectedSymbols)만이라도 "무엇을 감시할지" 보여준다. */}
                    {Array.isArray(st.symbols) && st.symbols.length > 0 ? (
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="text-[11px] font-medium text-gray-400 px-3 py-2 border-b border-gray-700 bg-gray-800/80">
                                감시 종목 {st.symbols.length}개 <span className="text-gray-500">(실시간)</span>
                                {Array.isArray(st.selectedSymbols) && <span className="text-gray-500"> · 웹 선택 {st.selectedSymbols.length}개 · 동시보유 한도 {st.maxPositions ?? '-'}</span>}
                            </div>
                            <div className="divide-y divide-gray-700/60">
                                {st.symbols.map((s: any) => (
                                    <div key={s.symbol} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center text-sm">
                                        <span className="text-gray-200">
                                            {s.symbolName && s.symbolName !== s.symbol ? s.symbolName : symName(s.symbol)} <span className="text-[10px] text-gray-500">{s.symbol}</span>
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
                    ) : (Array.isArray(st.selectedSymbols) && st.selectedSymbols.length > 0 && (
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="text-[11px] font-medium text-gray-400 px-3 py-2 border-b border-gray-700 bg-gray-800/80">
                                감시 예정 종목 {st.selectedSymbols.length}개 <span className="text-gray-500">(장이 열리면 실시간 감시 시작)</span>
                            </div>
                            <div className="divide-y divide-gray-700/60">
                                {st.selectedSymbols.map((code: string) => (
                                    <div key={code} className="flex items-center gap-2 px-3 py-2 text-sm">
                                        <span className="text-gray-200">{symName(code)}</span>
                                        <span className="text-[10px] text-gray-500">{code}</span>
                                        <span className="ml-auto text-[11px] text-gray-500">장외 대기</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* 각 지표 뜻 — 접이식 설명 */}
                    <details className="bg-gray-800/40 rounded-lg border border-gray-700/60">
                        <summary className="text-xs text-gray-400 px-3 py-2 cursor-pointer select-none hover:text-gray-200">ℹ️ 위 지표들이 무슨 뜻인가요? (펼치기)</summary>
                        <div className="text-[11px] text-gray-400 px-3 pb-3 space-y-1.5 leading-relaxed">
                            <div><b className="text-gray-300">일손실 한도 여유</b> — 오늘 손실이 이 한도에 닿으면 봇이 스스로 매매를 멈춥니다(하루치 최대 손실 방어). 총투자금의 10%가 기본.</div>
                            <div><b className="text-gray-300">상태 / 장외 대기</b> — 봇이 켜져 있는지. 평일 09:00~15:30만 매매하고, 그 외엔 '장외 대기'로 판단을 쉽니다.</div>
                            <div><b className="text-gray-300">모드</b> — 🔴실거래는 진짜 돈으로 주문, 🟢드라이런은 흉내만(주문 0). 전환은 서버에서만.</div>
                            <div><b className="text-gray-300">최근 신호</b> — BUY(매수)/SELL(매도)/HOLD(보유·관망)/CLOSED(장외). 봇이 마지막으로 내린 판단.</div>
                            <div><b className="text-gray-300">전략</b> — 점수형 추세추종: 오르는 추세를 점수로 확인하고 따라 사는 방식.</div>
                            <div><b className="text-gray-300">써킷브레이커</b> — 위험 신호(연속 손절·일손실 초과) 때 봇을 자동 정지시키는 안전 차단기. '정상'이면 문제 없음.</div>
                            <div><b className="text-gray-300">연속 손절</b> — 연달아 손절한 횟수. 일정 횟수(기본 3회) 넘으면 그날 매매를 멈춥니다(손실 악순환 방지).</div>
                            <div><b className="text-gray-300">실현손익</b> — 오늘 실제로 사고팔아 확정된 손익(보유만 한 건 미포함).</div>
                        </div>
                    </details>
                </div>
                );
            })()}

            {/* ── 발굴 탭: 오늘의 발굴(채원 일기) ↔ 📅 발굴 이력(아카이브 대시보드+D+N 추이) ── */}
            {view === 'scan' && (
            <div className="space-y-4">
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setScanSub('today')}
                        className={`text-xs px-3 py-1.5 rounded-full border ${scanSub === 'today' ? 'bg-emerald-800/60 border-emerald-600/60 text-emerald-200 font-medium' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        오늘의 발굴
                    </button>
                    <button onClick={() => { setScanSub('history'); if (archDates === null) loadArchive(); }}
                        className={`text-xs px-3 py-1.5 rounded-full border ${scanSub === 'history' ? 'bg-indigo-800/60 border-indigo-600/60 text-indigo-200 font-medium' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        📅 발굴 이력
                    </button>
                    <span className="text-[10px] text-gray-600 ml-auto">이력=발굴일 당일정보 박제 + 이후 주가 추이</span>
                </div>

            {scanSub === 'today' && (() => {
                const dates: string[] = discovery?.dates || [];
                const day = discoveryDay || discovery?.latest || null;
                if (!day) {
                    return (
                        <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-6 text-center">
                            아직 발굴 기록이 없습니다. 애널리스트 <b className="text-emerald-300">윤채원</b>이 매일 아침 7시에
                            코스피·코스닥 각 1종목을 발굴해 여기에 기록합니다.
                        </div>
                    );
                }
                const pickDate = async (d: string) => {
                    setPickedDate(d);
                    if (discovery?.latest?.tradeDate === d) { setDiscoveryDay(discovery.latest); return; }
                    try { setDiscoveryDay(await adminApi.getTossDiscoveryByDate(d)); }
                    catch { setDiscoveryDay(null); }
                };
                const kospi = day.kospiJson, kosdaq = day.kosdaqJson;
                const curDate = pickedDate || day.tradeDate;

                const stockCard = (title: string, s: any) => {
                    if (!s) return (
                        <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-500">
                            <b className="text-gray-400">{title}</b> — 발굴 없음
                        </div>
                    );
                    const emoji = s.score >= s.threshold ? '🟢' : s.score >= 60 ? '🟡' : '⚪';
                    const badge = s.score >= s.threshold ? '매수 신호' : s.score >= 60 ? '감시 대상' : '관망';
                    return (
                        <div className="bg-gradient-to-br from-emerald-900/20 to-gray-800 border border-emerald-700/40 rounded-lg px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-300 text-xs font-bold">{title}</span>
                                <span className="ml-auto text-2xl font-bold text-emerald-200" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.score}점</span>
                            </div>
                            <div className="text-lg font-bold text-gray-100 flex items-center gap-2">
                                {(() => {
                                    const on = effChecked.includes(s.symbol);
                                    const full = !on && effChecked.length >= maxSelect;
                                    return (
                                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-medium px-2 py-1 rounded border ${on ? 'bg-blue-700/50 border-blue-500 text-blue-100' : full ? 'border-gray-700 text-gray-600 cursor-not-allowed' : 'border-gray-600 text-gray-300 hover:border-blue-500'}`}
                                            title={full ? `최대 ${maxSelect}종목까지 선택` : on ? '감시 목록에서 빼기' : '감시 목록에 담기'}>
                                            <input type="checkbox" className="w-3.5 h-3.5 accent-blue-500"
                                                checked={on} disabled={full}
                                                onChange={() => toggleSymbol(s.symbol)} />
                                            {on ? '감시 중' : '감시 담기'}
                                        </label>
                                    );
                                })()}
                                <span>{s.name} <span className="text-xs text-gray-500 font-normal">({s.symbol})</span></span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className={`px-2 py-0.5 rounded-full ${s.score >= s.threshold ? 'bg-green-800/60 text-green-200' : s.score >= 60 ? 'bg-amber-800/50 text-amber-200' : 'bg-gray-700 text-gray-400'}`}>{emoji} {badge} · 임계 {s.threshold}</span>
                                {s.price ? <span className="text-gray-400">현재가 {Number(s.price).toLocaleString()}원</span> : null}
                            </div>
                            {/* 6조건 */}
                            {s.detail && (
                                <div className="text-[11px] text-gray-400 border-t border-gray-700/60 pt-1.5">
                                    {Object.values<any>(s.detail).map((v, i) => (
                                        <span key={i} className={v.ok ? 'text-green-400 mr-2' : 'text-gray-600 mr-2'}>
                                            {v.ok ? '✓' : '✗'}{v.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {/* 왜 이 종목인가 — 통합분석 요약 */}
                            {s.summary && (
                                <div className="text-[12px] text-gray-300 leading-relaxed bg-gray-900/50 rounded px-3 py-2 border-t border-emerald-800/30 whitespace-pre-wrap">
                                    <div className="text-[10px] text-emerald-400 mb-1 font-medium">📊 왜 이 종목인가 (재무·수급·뉴스+AI)</div>
                                    {s.summary}
                                </div>
                            )}
                            <button onClick={() => runAnalyze(s.symbol, s.name)}
                                className="text-[11px] px-3 py-1 rounded bg-emerald-800/60 border border-emerald-600/50 text-emerald-200 hover:bg-emerald-700/60">
                                📊 지금 다시 분석
                            </button>
                        </div>
                    );
                };

                return (
                    <div className="space-y-4">
                        {/* 날짜 선택 (일기장 넘기기) */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-400">📅 발굴 일자</span>
                            <select value={curDate} onChange={e => pickDate(e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200">
                                {dates.map(d => <option key={d} value={d}>{d}{d === discovery?.latest?.tradeDate ? ' (최신)' : ''}</option>)}
                            </select>
                            <span className="text-[11px] text-gray-500 ml-auto">애널리스트 윤채원 · 매일 07:00 발굴</span>
                        </div>

                        {/* 감시 선택 저장 바 — 카드에서 '감시 담기' 체크 후 여기서 바로 저장 */}
                        {(dirty || paramsDirty) && (
                            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-blue-200">감시 목록 변경됨 — 저장해야 봇에 반영됩니다 (현재 {effChecked.length}/{maxSelect})</span>
                                <div className="ml-auto flex items-center gap-2">
                                    <button onClick={() => { setChecked(null); setEditParams({}); setSaveMsg(null); }}
                                        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">되돌리기</button>
                                    <button onClick={saveSelection} disabled={saving}
                                        className="px-4 py-1 rounded font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60">
                                        {saving ? '저장 중…' : '감시 목록 저장'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {saveMsg && !dirty && !paramsDirty && (
                            <div className="text-[11px] text-emerald-400 px-1">{saveMsg}</div>
                        )}

                        {/* 코스피 · 코스닥 각 1종목 */}
                        <div className="grid md:grid-cols-2 gap-3">
                            {stockCard('🏛 코스피 추천', kospi)}
                            {stockCard('💹 코스닥 추천', kosdaq)}
                        </div>

                        {/* 채원 종합 코멘트 */}
                        {day.comment && (
                            <div className="bg-gray-800/60 rounded-lg px-4 py-3 text-sm text-gray-300 leading-relaxed">
                                <span className="text-emerald-300 font-medium">💬 채원 코멘트</span><br />
                                {day.comment}
                            </div>
                        )}

                        <div className="text-[11px] text-gray-500 px-1">
                            봇 추세 점수(6조건, 임계 이상=매수 신호) + 통합분석(재무·수급·뉴스+AI)을 종합한 발굴입니다.
                            실제 매매 선택은 <button onClick={() => setView('select')} className="text-blue-300 underline">선택 탭</button>에서 직접 하세요.
                        </div>
                    </div>
                );
            })()}

            {/* 📅 발굴 이력 — 날짜별 아카이브: 증시요약 + 종목별(수급·뉴스·조건표) + D+1/D+7 추이 */}
            {scanSub === 'history' && (() => {
                if (archDates === null) return <div className="text-xs text-gray-500 px-1">불러오는 중…</div>;
                if (!archDates.length) return (
                    <div className="text-sm text-gray-400 bg-gray-800/60 rounded-lg px-4 py-6 text-center">
                        아직 발굴 아카이브가 없습니다. 매 영업일 <b className="text-indigo-300">16:10</b>에 봇 스캔(60점↑ 후보)과
                        채원 발굴의 당일 정보(고저·수급·뉴스·증시요약)를 자동 수집해 여기에 쌓입니다.
                    </div>
                );
                const mk = archDay?.market;
                const records: any[] = archDay?.records || [];
                const srcLabel = (s: string) => s === 'chaewon' ? '채원' : s === 'bot_scan+chaewon' ? '봇+채원' : '봇 스캔';
                const flowCell = (v: number | null, maxAbs: number) => (
                    <div className="min-w-[5.5rem]">
                        <div className={`text-right text-[11px] ${pnlColor(v)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {v == null ? '-' : (v > 0 ? '+' : '') + v.toLocaleString()}
                        </div>
                        <div className="h-1 bg-gray-700/50 rounded overflow-hidden">
                            <div className={`h-full ${(v ?? 0) > 0 ? 'bg-red-400' : 'bg-blue-400'}`}
                                style={{ width: maxAbs && v != null ? Math.min(100, Math.abs(v) / maxAbs * 100) + '%' : '0%' }} />
                        </div>
                    </div>
                );
                return (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-400">📅 발굴 일자</span>
                            <select value={archDate ?? ''} onChange={e => pickArchDate(e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200">
                                {archDates.map((d: any) => (
                                    <option key={d.tradeDate} value={d.tradeDate}>
                                        {d.tradeDate} · {d.count}종목{d.recommendedNames ? ` · ⭐${d.recommendedNames}` : ''}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[11px] text-gray-500 ml-auto">종목을 누르면 당일 대시보드가 펼쳐집니다</span>
                        </div>

                        {archLoading && <div className="text-xs text-gray-500 px-1">불러오는 중…</div>}
                        {!archLoading && !archDay && <div className="text-xs text-gray-500 px-1">이 날짜의 데이터를 불러오지 못했습니다.</div>}
                        {!archLoading && archDay && (<>
                            {/* 그날의 증시 (지수 스냅샷 + AI 요약) */}
                            {mk && (
                                <div className="bg-gray-800/70 border border-gray-700 rounded-lg px-4 py-3 space-y-2">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        <span className="text-xs text-gray-400 font-medium">🌐 그날의 증시</span>
                                        <span className="text-gray-200">코스피 <b>{mk.kospiClose != null ? Number(mk.kospiClose).toLocaleString() : '-'}</b>{' '}
                                            <span className={pnlColor(mk.kospiChangePct)}>{signPct(mk.kospiChangePct)}</span></span>
                                        <span className="text-gray-200">코스닥 <b>{mk.kosdaqClose != null ? Number(mk.kosdaqClose).toLocaleString() : '-'}</b>{' '}
                                            <span className={pnlColor(mk.kosdaqChangePct)}>{signPct(mk.kosdaqChangePct)}</span></span>
                                    </div>
                                    {mk.summary && <div className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-gray-700/60 pt-2">{mk.summary}</div>}
                                </div>
                            )}

                            {/* 종목 카드 목록 (클릭=당일 대시보드 펼침) */}
                            <div className="space-y-2">
                                {records.map((r: any) => {
                                    const open = archOpenSym === r.symbol;
                                    const t = r.trend;
                                    const flowDays: any[] = r.investorFlow?.days || [];
                                    const maxAbs = Math.max(0, ...flowDays.flatMap((d: any) =>
                                        [d.individual, d.organ, d.foreigner].map((v: any) => Math.abs(v ?? 0))));
                                    return (
                                        <div key={r.symbol} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                                            <button onClick={() => setArchOpenSym(open ? null : r.symbol)}
                                                className="w-full px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-left hover:bg-gray-700/40">
                                                <span className="text-sm font-bold text-gray-100">{r.name} <span className="text-[10px] text-gray-500 font-normal">{r.symbol}</span></span>
                                                {r.recommended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/50">⭐ 추천</span>}
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{srcLabel(r.source)}</span>
                                                {r.score != null && <span className="text-sm font-bold text-emerald-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.score}점</span>}
                                                <span className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                    <span className="text-gray-400">종가 {won(r.close)}</span>
                                                    <span className={pnlColor(t?.d1Pct)}>D+1 {signPct(t?.d1Pct)}</span>
                                                    <span className={pnlColor(t?.d7Pct)}>D+7 {signPct(t?.d7Pct)}</span>
                                                    <span className={pnlColor(t?.latestPct)}>현재 {signPct(t?.latestPct)}</span>
                                                    <span className="text-gray-600">{open ? '▲' : '▼'}</span>
                                                </span>
                                            </button>
                                            {open && (
                                                <div className="px-3 pb-3 pt-2 border-t border-gray-700/60 space-y-3">
                                                    {/* 발굴일 시세 */}
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                        <span>고가 <b className="text-gray-300">{won(r.high)}</b></span>
                                                        <span>저가 <b className="text-gray-300">{won(r.low)}</b></span>
                                                        <span>거래량 <b className="text-gray-300">{r.volume != null ? Number(r.volume).toLocaleString() : '-'}</b>{r.volRatio ? ` (20일 평균의 ${r.volRatio}배)` : ''}</span>
                                                    </div>
                                                    {/* 점수 조건표 (발굴 시점) */}
                                                    {r.scoreDetail && (
                                                        <div className="text-[11px] text-gray-400">
                                                            {Object.values<any>(r.scoreDetail).map((v, i) => (
                                                                <span key={i} className={v.ok ? 'text-green-400 mr-2' : 'text-gray-600 mr-2'}>
                                                                    {v.ok ? '✓' : '✗'}{v.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* 수급 (개인/기관/외국인 순매수량, 발굴 시점 최근 5영업일) */}
                                                    {flowDays.length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] text-gray-500 mb-1.5">🧭 수급 — 순매수량(주), 발굴 시점 최근 5영업일 {flowDays[0]?.foreignerHoldRatio != null ? `· 외국인 보유 ${flowDays[0].foreignerHoldRatio}%` : ''}</div>
                                                            <div className="overflow-x-auto">
                                                                <div className="min-w-[22rem] space-y-1.5">
                                                                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                                        <span className="w-[4.2rem]">일자</span>
                                                                        <span className="min-w-[5.5rem] text-right">개인</span>
                                                                        <span className="min-w-[5.5rem] text-right">기관</span>
                                                                        <span className="min-w-[5.5rem] text-right">외국인</span>
                                                                    </div>
                                                                    {flowDays.map((d: any, i: number) => (
                                                                        <div key={i} className="flex items-center gap-3">
                                                                            <span className="w-[4.2rem] text-[10px] text-gray-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{(d.date || '').slice(5)}</span>
                                                                            {flowCell(d.individual, maxAbs)}
                                                                            {flowCell(d.organ, maxAbs)}
                                                                            {flowCell(d.foreigner, maxAbs)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* 발굴일 뉴스 */}
                                                    {Array.isArray(r.newsJson) && r.newsJson.length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] text-gray-500 mb-1">📰 발굴일 뉴스</div>
                                                            <ul className="space-y-1">
                                                                {r.newsJson.map((n: any, i: number) => (
                                                                    <li key={i} className="text-[12px] leading-snug">
                                                                        <a href={n.link} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">{n.title}</a>
                                                                        <span className="text-[10px] text-gray-600 ml-1.5">{n.office}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {/* 발굴 후 주가 추이 */}
                                                    {t?.after?.length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] text-gray-500 mb-1">📈 발굴 후 종가 추이 (발굴일 종가 대비)</div>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                                {t.after.map((a: any, i: number) => {
                                                                    const p = r.close && a.close ? ((a.close - r.close) / r.close) * 100 : null;
                                                                    return (
                                                                        <span key={i} className="text-gray-500">
                                                                            {(a.date || '').slice(5)} <span className={pnlColor(p)}>{signPct(p, 1)}</span>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button onClick={() => runAnalyze(r.symbol, r.name)}
                                                        className="text-[11px] px-3 py-1 rounded bg-emerald-800/60 border border-emerald-600/50 text-emerald-200 hover:bg-emerald-700/60">
                                                        📊 지금 다시 분석
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-[11px] text-gray-500 px-1">
                                D+1/D+7/현재 = 발굴일 종가 대비 등락률(조회 시점에 계산). 수급·뉴스는 발굴 당일 박제된 스냅샷입니다.
                            </div>
                        </>)}
                    </div>
                );
            })()}
            </div>
            )}

            {/* ── 선택 탭 (매매 대상 확정 + 종목별 점수 설정 + 직접 추가) ── */}
            {view === 'select' && (() => {
                const rows: any[] = scanData?.scan?.candidates || [];
                const nameOf = (sym: string) => {
                    const n = symName(sym);
                    if (n !== sym) return n;                    // 통합 조회로 이름 찾으면 사용
                    return rows.find(r => r.symbol === sym)?.name || sym;  // 스캔 결과 폴백
                };
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
                                                    <button onClick={() => runBacktest(sym, nameOf(sym))}
                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-800/60 border border-indigo-600/50 text-indigo-200 hover:bg-indigo-700/60"
                                                        title="과거 데이터로 손절·익절·임계 최적값 찾기">🔬 최적값</button>
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
                                <div className="text-[11px] text-gray-400 px-3 py-3 border-t border-gray-700/60 space-y-2 leading-relaxed">
                                    <div className="text-gray-300 font-medium">💡 각 수치가 하는 일 (그대로 두면 봇 기본값)</div>
                                    <div>
                                        <span className="text-emerald-300 font-medium">임계 (기본 80)</span> — 매수 점수 기준입니다.
                                        봇이 종목을 <b>6가지 조건</b>(추세 정배열·장기추세·거래량·RSI·신고가·시장)으로 채점해 <b>100점 만점</b>으로 매기는데,
                                        이 점수가 <b>임계 이상</b>이면 매수합니다.
                                        <span className="text-gray-500"> 낮추면(예: 70) 더 약한 신호에도 자주 사고, 높이면(예: 90) 아주 강한 신호에만 삽니다. 너무 낮추면 잘못된 신호에 물릴 수 있어 주의.</span>
                                    </div>
                                    <div>
                                        <span className="text-red-300 font-medium">손절 (기본 3%)</span> — 산 가격(평단)보다 이만큼 <b>떨어지면 자동으로 팝니다</b>.
                                        더 큰 손실을 막는 안전장치예요. 3%면 10만원에 샀을 때 <b>9만 7천원</b>에 손절.
                                        <span className="text-gray-500"> 좁히면(1~2%) 조금만 빠져도 빨리 나와 손실은 작지만 잔파동에 자주 털리고, 넓히면(5%) 여유는 있지만 한 번에 크게 잃을 수 있습니다.</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-300 font-medium">익절 (기본 8%)</span> — 평단보다 이만큼 <b>오르면 자동으로 팔아 수익을 확정</b>합니다.
                                        8%면 10만원에 샀을 때 <b>10만 8천원</b>에 익절.
                                        <span className="text-gray-500"> 낮추면(5%) 자주 짧게 먹고 나오고, 높이면(15%) 크게 노리지만 다시 떨어져 못 팔 수도 있습니다.</span>
                                    </div>
                                    <div className="text-gray-500 pt-1 border-t border-gray-700/40">
                                        ※ 이 밖에 <b className="text-gray-400">추세이탈</b>(주가가 20일 이동평균선 아래로 내려가면 매도)도 자동 적용됩니다.
                                        변경 후 위 <b className="text-blue-300">선택·설정 저장</b>을 눌러야 봇에 반영됩니다(최대 60초).
                                    </div>
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

            {/* 손절·익절·임계 최적값 백테스트 모달 */}
            {btOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col p-2 sm:p-4" onClick={() => setBtOpen(false)}>
                    <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden max-w-3xl w-full mx-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700 bg-gray-800">
                            <span className="text-sm font-bold text-indigo-300">🔬 손절·익절·임계 최적값</span>
                            <span className="text-xs text-gray-400">{btSym}</span>
                            <button onClick={() => setBtOpen(false)} className="ml-auto text-gray-300 hover:text-white text-lg px-2" aria-label="닫기">✕</button>
                        </div>
                        <div className="flex-1 overflow-auto toss-log-scroll p-4 space-y-4">
                            {btStatus === 'loading' && (
                                <div className="text-center text-gray-400 py-10">
                                    <div className="text-3xl mb-3 animate-pulse">🔬</div>
                                    <div className="text-sm">과거 200봉(약 9~10개월)으로 손절·익절 조합을 모두 시뮬레이션 중…</div>
                                    <div className="text-[11px] text-gray-600 mt-1">봇과 동일한 판단 로직 · AI 없음 · 수 초</div>
                                </div>
                            )}
                            {btStatus === 'error' && (
                                <div className="text-center text-red-300 py-10 text-sm">{btData?.error || '백테스트 실패'}</div>
                            )}
                            {btStatus === 'done' && btData?.ok && (() => {
                                const pctPnl = (v: any) => v == null ? '-' : `${(v * 100).toFixed(1)}%`;
                                const pctW = (v: any) => v == null ? '-' : `${(v * 100).toFixed(0)}%`;
                                const best = btData.best, cur = btData.current;
                                const hasTrades = (btData.grid || []).some((g: any) => g.trades > 0);
                                return (
                                    <>
                                        {/* 추천 요약 */}
                                        <div className="bg-indigo-900/25 border border-indigo-700/40 rounded-lg px-4 py-3 text-sm">
                                            {hasTrades ? (
                                                <>
                                                    <div className="text-indigo-200 font-medium mb-1">💡 과거 데이터 기준 추천</div>
                                                    <div className="text-gray-200">
                                                        손절 <b className="text-red-300">{(best.stop * 100).toFixed(0)}%</b> · 익절 <b className="text-blue-300">{(best.take * 100).toFixed(0)}%</b>
                                                        <span className="text-gray-400"> → 누적 {pctPnl(best.cumReturnPct)} (거래 {best.trades}회, 낙폭 {pctPnl(best.mddPct)})</span>
                                                    </div>
                                                    {cur && (
                                                        <div className="text-[12px] text-gray-500 mt-1">
                                                            현재 기본(손절 3%·익절 8%): 누적 {pctPnl(cur.cumReturnPct)} (거래 {cur.trades}회)
                                                        </div>
                                                    )}
                                                    <button onClick={() => applyBacktest(btData.symbol, best.stop, best.take)}
                                                        className="mt-2 text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                                                        이 손절·익절을 설정에 적용 →
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="text-amber-200">이 종목은 임계 80에선 과거 구간에 매수가 없었습니다. 아래 <b>임계별 표</b>를 보고 임계를 낮추는 걸 검토하세요.</div>
                                            )}
                                        </div>

                                        {/* 임계별 표 (거래 발생 여부) */}
                                        <div>
                                            <div className="text-xs text-gray-400 mb-1">📊 임계별 성과 (손익 3%/8% 고정) — 이 종목은 몇 점부터 사는 게 좋은가</div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[11px] text-gray-300">
                                                    <thead className="text-gray-500 border-b border-gray-700">
                                                        <tr><th className="text-left py-1">임계</th><th className="text-right">거래</th><th className="text-right">승률</th><th className="text-right">누적수익</th><th className="text-right">최대낙폭</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {(btData.thresholdGrid || []).map((t: any) => (
                                                            <tr key={t.threshold} className="border-b border-gray-800">
                                                                <td className="py-1">{t.threshold}{t.threshold === 80 ? ' (기본)' : ''}</td>
                                                                <td className="text-right">{t.trades}</td>
                                                                <td className="text-right">{pctW(t.winRate)}</td>
                                                                <td className={`text-right ${t.cumReturnPct > 0 ? 'text-green-400' : t.cumReturnPct < 0 ? 'text-red-400' : ''}`}>{pctPnl(t.cumReturnPct)}</td>
                                                                <td className="text-right text-gray-500">{pctPnl(t.mddPct)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* 손절×익절 그리드 상위 */}
                                        {hasTrades && (
                                            <div>
                                                <div className="text-xs text-gray-400 mb-1">📈 손절·익절 조합 상위 (임계 80 기준, 성과순)</div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-[11px] text-gray-300">
                                                        <thead className="text-gray-500 border-b border-gray-700">
                                                            <tr><th className="text-left py-1">손절</th><th className="text-left">익절</th><th className="text-right">거래</th><th className="text-right">승률</th><th className="text-right">누적수익</th><th className="text-right">낙폭</th><th></th></tr>
                                                        </thead>
                                                        <tbody>
                                                            {(btData.grid || []).slice(0, 8).map((g: any, i: number) => (
                                                                <tr key={i} className="border-b border-gray-800">
                                                                    <td className="py-1 text-red-300">{(g.stop * 100).toFixed(0)}%</td>
                                                                    <td className="text-blue-300">{(g.take * 100).toFixed(0)}%</td>
                                                                    <td className="text-right">{g.trades}</td>
                                                                    <td className="text-right">{pctW(g.winRate)}</td>
                                                                    <td className={`text-right ${g.cumReturnPct > 0 ? 'text-green-400' : g.cumReturnPct < 0 ? 'text-red-400' : ''}`}>{pctPnl(g.cumReturnPct)}</td>
                                                                    <td className="text-right text-gray-500">{pctPnl(g.mddPct)}</td>
                                                                    <td className="text-right"><button onClick={() => applyBacktest(btData.symbol, g.stop, g.take)} className="text-indigo-300 hover:text-indigo-100 underline">적용</button></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <div className="text-[10px] text-gray-500 border-t border-gray-700/60 pt-2">⚠️ {btData.note}</div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* 종목 통합 분석 — 비동기 안내 모달(요청만 하고 결과는 텔레그램) */}
            {analyzeOpen && (
                <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setAnalyzeOpen(false)}>
                    <div className="bg-gray-900 rounded-lg overflow-hidden max-w-md w-full shadow-2xl border border-gray-700"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700 bg-gray-800">
                            <span className="text-sm font-bold text-emerald-300">📊 종목 통합 분석</span>
                            {analyzeSym && <span className="text-xs text-gray-400">{analyzeSym}</span>}
                            <button onClick={() => setAnalyzeOpen(false)}
                                className="ml-auto text-gray-300 hover:text-white text-lg leading-none px-2" aria-label="닫기">✕</button>
                        </div>
                        <div className="p-5 text-center space-y-3">
                            {analyzeStatus === 'error' ? (
                                <div className="text-red-300 text-sm">{analyzeMsg}</div>
                            ) : (
                                <>
                                    <div className="text-3xl">📨</div>
                                    <div className="text-sm text-gray-200">{analyzeMsg || '분석을 요청하고 있습니다…'}</div>
                                    <div className="text-[11px] text-gray-500">봇 추세 점수 + DART 재무 + 네이버 수급 + 증권사 리포트 + 뉴스를 종합합니다. 창을 닫아도 백그라운드에서 진행됩니다.</div>
                                    <button onClick={() => setAnalyzeOpen(false)}
                                        className="text-xs px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white">확인</button>
                                </>
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
