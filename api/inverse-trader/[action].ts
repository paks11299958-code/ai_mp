/**
 * 인버스 ETF 1호가 스캘핑 — 어드민 API 엔드포인트.
 *
 * 라우트(동적 세그먼트 하나로 전부 처리한다 — 서버리스 함수 개수를 늘리지 않기 위함):
 *   GET    /api/inverse-trader/status          상태·호가·포지션·주문·체결·오늘통계
 *   POST   /api/inverse-trader/start           세션 시작
 *   POST   /api/inverse-trader/stop            세션 중지
 *   POST   /api/inverse-trader/emergency-stop  긴급정지(즉시 미체결 취소 + 신규주문 중단)
 *   POST   /api/inverse-trader/tick            런루프 1틱 진행(상시 데몬 대신 API 로 구동)
 *   POST   /api/inverse-trader/settle          수동 강제정산
 *   GET    /api/inverse-trader/config          설정 조회
 *   PUT    /api/inverse-trader/config          설정 저장
 *
 * ★설정 저장 시 tradingMode 에 'LIVE'(=SIMULATION 이 아닌 값)가 들어오면 400 으로 거부한다.
 * ★어드민(User.role === 'ADMIN') 만 호출할 수 있다.
 * ★증권사 주문 API 호출 없음 — 전부 시뮬레이션 브로커를 통해서만 나간다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { getInverseDb, getPrisma } from '../_lib/inverse-trader/prisma.js';
import { TRADING_MODE, LiveTradingBlockedError } from '../_lib/inverse-trader/constants.js';
import {
    DEFAULT_TRADER_CONFIG,
    SessionAlreadyRunningError,
    SessionNotFoundError,
    emergencyStop,
    forceSettleNow,
    getStatusSnapshot,
    loadTraderConfig,
    startSession,
    stopSession,
    tickSession,
} from './engine.js';

/** 어드민 확인. 아니면 응답까지 보내고 false 를 돌려준다. */
async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
    const userId = requireAuth(req, res);
    if (userId === null) return false;
    try {
        const user = await getPrisma().user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') {
            res.status(403).json({ error: '관리자만 사용할 수 있습니다.' });
            return false;
        }
        return true;
    } catch (e: any) {
        res.status(500).json({ error: `권한 확인에 실패했습니다: ${e?.message ?? String(e)}` });
        return false;
    }
}

function readBody(req: VercelRequest): Record<string, any> {
    const body: any = req.body;
    if (!body) return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch {
            return {};
        }
    }
    return body as Record<string, any>;
}

function firstQuery(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

// ─────────────────────────────────────────────────────────────
// 설정 검증
// ─────────────────────────────────────────────────────────────

export interface ConfigValidationError {
    field: string;
    message: string;
}

/**
 * 설정 저장 입력 검증.
 * ★tradingMode 가 SIMULATION 이 아니면(=LIVE 포함) 여기서 막는다 → 400.
 */
export function validateConfigInput(
    input: Record<string, any>,
    current: Record<string, any>
): { data: Record<string, any> } | { errors: ConfigValidationError[] } {
    const errors: ConfigValidationError[] = [];
    const data: Record<string, any> = {};

    // ★실거래 차단 — 가장 먼저 검사한다.
    if (input.tradingMode !== undefined && input.tradingMode !== null && input.tradingMode !== '') {
        const mode = String(input.tradingMode).trim().toUpperCase();
        if (mode !== TRADING_MODE) {
            errors.push({
                field: 'tradingMode',
                message: `실거래 모드는 허용되지 않습니다(요청='${input.tradingMode}'). 이 시스템은 ${TRADING_MODE} 전용이며 증권사 주문 API를 호출하지 않습니다.`,
            });
        }
    }
    data.tradingMode = TRADING_MODE;

    const str = (field: string, fallback: string) => {
        if (input[field] === undefined) return fallback;
        const v = String(input[field]).trim();
        if (!v) {
            errors.push({ field, message: `${field} 는 비워둘 수 없습니다.` });
            return fallback;
        }
        return v;
    };
    const posInt = (field: string, fallback: number, min: number, max: number) => {
        if (input[field] === undefined) return fallback;
        const v = Number(input[field]);
        if (!Number.isFinite(v) || !Number.isInteger(v) || v < min || v > max) {
            errors.push({ field, message: `${field} 는 ${min}~${max} 사이 정수여야 합니다(받은 값: ${input[field]}).` });
            return fallback;
        }
        return v;
    };
    const num = (field: string, fallback: number, min: number, max: number) => {
        if (input[field] === undefined) return fallback;
        const v = Number(input[field]);
        if (!Number.isFinite(v) || v < min || v > max) {
            errors.push({ field, message: `${field} 는 ${min}~${max} 사이 숫자여야 합니다(받은 값: ${input[field]}).` });
            return fallback;
        }
        return v;
    };

    data.symbol = str('symbol', current.symbol);
    data.symbolName = str('symbolName', current.symbolName);
    data.defaultQty = posInt('defaultQty', current.defaultQty, 1, 100_000_000);
    data.closeBufferMin = posInt('closeBufferMin', current.closeBufferMin, 1, 180);
    data.maxPositionQty = posInt('maxPositionQty', current.maxPositionQty, 1, 1_000_000_000);
    data.dailyLossLimit = num('dailyLossLimit', current.dailyLossLimit, 0, 1_000_000_000);
    data.enabled = input.enabled === undefined ? !!current.enabled : !!input.enabled;

    if (data.defaultQty > data.maxPositionQty) {
        errors.push({
            field: 'defaultQty',
            message: `기본 주문수량(${data.defaultQty})이 최대 보유수량(${data.maxPositionQty})보다 클 수 없습니다.`,
        });
    }

    if (errors.length > 0) return { errors };
    return { data };
}

// ─────────────────────────────────────────────────────────────
// 핸들러
// ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = (firstQuery(req.query.action as any) ?? '').toLowerCase();

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (!(await requireAdmin(req, res))) return;

    const db = getInverseDb();
    const body = readBody(req);
    const sessionId = (body.sessionId as string | undefined) ?? firstQuery(req.query.sessionId as any);

    try {
        switch (action) {
            // ── 상태 조회 ─────────────────────────────────────
            case 'status': {
                if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
                const snapshot = await getStatusSnapshot(db, sessionId);
                return res.status(200).json({ ok: true, ...snapshot });
            }

            // ── 시작 ─────────────────────────────────────────
            case 'start': {
                if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
                const result = await startSession(db);
                const snapshot = await getStatusSnapshot(db, result.session.id);
                return res.status(200).json({
                    ok: true,
                    started: !result.rehydrated,
                    rehydrated: result.rehydrated,
                    seeded: result.seeded,
                    seedReason: result.seedReason ?? null,
                    ...snapshot,
                });
            }

            // ── 중지 ─────────────────────────────────────────
            case 'stop': {
                if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
                const reason = typeof body.reason === 'string' && body.reason.trim()
                    ? body.reason.trim()
                    : undefined;
                const result = await stopSession(db, sessionId, reason);
                const snapshot = await getStatusSnapshot(db, result.sessionId);
                return res.status(200).json({ ok: true, stop: result, ...snapshot });
            }

            // ── 긴급정지 ──────────────────────────────────────
            case 'emergency-stop':
            case 'emergency_stop': {
                if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
                const reason = typeof body.reason === 'string' && body.reason.trim()
                    ? body.reason.trim()
                    : undefined;
                const result = await emergencyStop(db, sessionId, reason);
                const snapshot = await getStatusSnapshot(db, result.sessionId);
                return res.status(200).json({ ok: true, stop: result, ...snapshot });
            }

            // ── 런루프 1틱 (상시 데몬 대신 이 호출로 진행한다) ──
            case 'tick': {
                if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
                const raw = Number(body.times ?? firstQuery(req.query.times as any) ?? 1);
                const times = Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.floor(raw))) : 1;
                const results = [];
                for (let i = 0; i < times; i++) {
                    const r = await tickSession(db, sessionId);
                    results.push(r);
                    if (r.skipped || r.settlement) break; // 정산이 돌았거나 더 진행할 수 없으면 중단
                }
                const last = results[results.length - 1];
                const snapshot = await getStatusSnapshot(db, last?.sessionId ?? sessionId);
                return res.status(200).json({ ok: true, ticks: results, ...snapshot });
            }

            // ── 수동 강제정산 ─────────────────────────────────
            case 'settle': {
                if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
                const result = await forceSettleNow(db, sessionId);
                const snapshot = await getStatusSnapshot(db, result.sessionId);
                return res.status(200).json({ ok: true, settlement: result, ...snapshot });
            }

            // ── 설정 조회 / 저장 ──────────────────────────────
            case 'config': {
                if (req.method === 'GET') {
                    const config = await loadTraderConfig(db);
                    return res.status(200).json({ ok: true, config, tradingMode: TRADING_MODE });
                }
                if (req.method !== 'PUT' && req.method !== 'POST') {
                    return methodNotAllowed(res, 'GET, PUT');
                }

                const current = await loadTraderConfig(db).catch(() => ({ ...DEFAULT_TRADER_CONFIG }));
                const validated = validateConfigInput(body, current);
                if ('errors' in validated) {
                    return res.status(400).json({
                        ok: false,
                        error: validated.errors[0].message,
                        errors: validated.errors,
                    });
                }

                const existing = await db.inverseTraderConfig.findFirst({ orderBy: { id: 'desc' } });
                const saved = existing
                    ? await db.inverseTraderConfig.update({ where: { id: existing.id }, data: validated.data })
                    : await db.inverseTraderConfig.create({ data: validated.data });
                return res.status(200).json({ ok: true, config: saved, tradingMode: TRADING_MODE });
            }

            default:
                return res.status(404).json({
                    ok: false,
                    error: `알 수 없는 경로입니다: ${action || '(없음)'}`,
                    actions: ['status', 'start', 'stop', 'emergency-stop', 'tick', 'settle', 'config'],
                });
        }
    } catch (e: any) {
        // ★실거래 요청은 400 으로 분리해 돌려준다(운영 로그에서 즉시 구분되게).
        if (e instanceof LiveTradingBlockedError) {
            return res.status(400).json({ ok: false, error: e.message });
        }
        if (e instanceof SessionAlreadyRunningError) {
            return res.status(409).json({ ok: false, error: e.message, sessionId: e.sessionId });
        }
        if (e instanceof SessionNotFoundError) {
            return res.status(404).json({ ok: false, error: e.message });
        }
        console.error('[inverse-trader] 처리 실패', action, e);
        return res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
}

function methodNotAllowed(res: VercelResponse, allow: string) {
    res.setHeader('Allow', allow);
    return res.status(405).json({ ok: false, error: `허용되지 않는 메서드입니다. (${allow})` });
}
