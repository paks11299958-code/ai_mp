import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';
import { CHAERIN_PORTRAIT, ChaerinMenu } from './chaerinMenu';
import './chaerinBeauty.css';
import './chaerinClinic.css';
import type { EntryGiftContext, GuestGate, PersonaEntryGuide } from '../PersonaEntrySheet';

// 윤채린 v3: 화이트 뷰티 갤러리. 견적 요청·응답·차감 계약은 v2 그대로다.
const IMG = { hero: CHAERIN_PORTRAIT, sample: '/chaerin/clinic/sample_face.jpg' } as const;

export const ESTIMATE_FEATURE = 'beauty-estimate';
const API = '/api/beauty-estimate';
/** 스캔 연출 최소 시간 — 응답이 빨라도 "살펴보는" 시간을 보장한다(시안 4.8초 연출 기준). */
export const MIN_SCAN_MS = 4500;
const REQUEST_TIMEOUT_MS = 90_000;
const FAIL_MSG = '분석이 잠시 어려워요. 잠시 후 다시 시도해 주세요.';
const NOT_READY_MSG = '준비 중인 기능이에요. 조금만 기다려 주세요.';

type Part = 'eye' | 'nose' | 'contour' | 'lip' | 'skin';
/** 서버 part id 순서·이름(PART_NAMES)과 같다. 색은 화면 표시용. */
const PARTS: { id: Part; name: string; color: string; chip: string; at: [number, number] }[] = [
    { id: 'eye', name: '눈', color: '#E9C98E', chip: '눈 · 눈매 길이·꺼풀 측정', at: [8, 33] },
    { id: 'nose', name: '코', color: '#D9A48F', chip: '코 · 콧대 높이·코끝', at: [56, 44] },
    { id: 'contour', name: '윤곽', color: '#B98574', chip: '윤곽 · 턱선·광대 폭', at: [6, 56] },
    { id: 'lip', name: '입·입술', color: '#C9B4D8', chip: '입 · 입술 두께·입꼬리', at: [54, 55] },
    { id: 'skin', name: '피부·탄력', color: '#9FB7C7', chip: '피부 · 결·톤', at: [10, 22] },
];
const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));

// 스캔 연출 = 사진 위 가이드 타원·빛줄기 + **추상 얼굴 도식**(부위별로 불이 켜짐).
// ★사진 위에 점·윤곽선을 찍지 않는다 — AI 좌표(thinking 끈 flash)가 입·턱에서 10~20% 어긋나
//   선이 얼굴 밖으로 나갔다(09-28 가상 인물 실측). 틀린 위치보다 정직한 도식이 낫다. 서버도 좌표를 안 준다.
const ZONES: Record<Part, React.ReactNode> = {
    eye: (
        <>
            <ellipse cx="38" cy="50" rx="8" ry="3.6" />
            <ellipse cx="62" cy="50" rx="8" ry="3.6" />
        </>
    ),
    nose: <path d="M50 52 L46 68 Q50 71 54 68 Z" />,
    lip: <ellipse cx="50" cy="80" rx="10" ry="3.8" />,
    contour: <path d="M22 60 Q24 88 50 102 Q76 88 78 60" fill="none" strokeWidth="3" />,
    skin: (
        <>
            <circle cx="31" cy="66" r="7" />
            <circle cx="69" cy="66" r="7" />
        </>
    ),
};
const SCAN_MSGS = [
    '얼굴 윤곽을 찾고 있어요…',
    '이목구비 위치를 잡는 중…',
    '고른 부위를 살펴보는 중…',
    '공개 가격과 맞춰 보는 중…',
];

// ── 서버 응답 형식 ──
interface EstimateItem {
    id: string;
    name: string;
    min: number;
    max: number;
    note?: string;
    suggested: boolean;
}
interface EstimatePart {
    part: Part;
    name: string;
    feature: string;
    items: EstimateItem[];
}
export interface EstimateReport {
    asOf: string;
    charm: string;
    parts: EstimatePart[];
    suggestedTotal: { min: number; max: number };
    pointsCharged: number;
    newBalance?: number;
}
interface CatalogResp {
    asOf: string;
    parts: {
        part: Part;
        name: string;
        items: { id: string; name: string; min: number; max: number; note?: string; singleSource?: boolean }[];
    }[];
    sources: string[];
}

type Screen = 'entry' | 'table' | 'consent' | 'pick' | 'scan' | 'report';
/** 뒤로·Escape는 한 단계 위. 분석 중에는 요청 결과를 기다린다. */
const PARENT: Record<Screen, Screen | null> = {
    entry: null,
    table: 'entry',
    consent: 'entry',
    pick: 'consent',
    scan: 'scan',
    report: 'entry',
};
const prefersReducedMotion = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const fmt = (n: number) => n.toLocaleString('ko-KR');
const authHeaders = (): Record<string, string> => {
    try {
        const t = localStorage.getItem('token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    } catch {
        return {};
    }
};

/**
 * 사진 → EXIF 회전 보정 + 긴 변 1280px JPEG(0.85). HairStyleBoard 의 처리(createImageBitmap from-image)와 같다.
 * createImageBitmap 이 없으면 <img> 디코드(브라우저가 EXIF 방향을 적용)로 대신한다.
 */
export async function prepPhoto(file: File): Promise<{ base64: string; width: number; height: number }> {
    let src: CanvasImageSource & { width: number; height: number };
    let release = () => {};
    if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
        src = bmp;
        release = () => bmp.close?.();
    } else {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        try {
            await img.decode();
        } finally {
            URL.revokeObjectURL(url);
        }
        src = img;
    }
    try {
        const w0 = (src as HTMLImageElement).naturalWidth || src.width;
        const h0 = (src as HTMLImageElement).naturalHeight || src.height;
        if (!w0 || !h0) throw new Error('empty image');
        const scale = Math.min(1, 1280 / Math.max(w0, h0));
        const w = Math.round(w0 * scale),
            h = Math.round(h0 * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.drawImage(src, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (!base64) throw new Error('encode failed');
        return { base64, width: w, height: h };
    } finally {
        release();
    }
}

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    /** 로그인 회원 시트에만 온다 — 없으면 비로그인으로 본다. */
    gift?: EntryGiftContext;
    /** 비로그인 시트에서만 온다(PersonaEntrySheet 의 guestGate 규약). */
    onGuestGate?: GuestGate;
}

export const ChaerinClinicEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, gift, onGuestGate }) => {
    const [reduce] = useState(prefersReducedMotion);
    const [storedScreen] = useState(() => {
        try {
            const stored = sessionStorage.getItem('cc-screen');
            sessionStorage.removeItem('cc-screen');
            return stored === 'estimate' ? 'estimate' : undefined;
        } catch {
            return undefined;
        }
    });
    const requestedScreen = guide.chaerinScreen || storedScreen;
    const [screen, setScreen] = useState<Screen>(requestedScreen === 'table' ? 'table' : 'entry');
    const handledGuide = useRef<PersonaEntryGuide | null>(null);
    const [toast, setToast] = useState('');

    // 단가: undefined=모름(조회 전·실패), null=행 없음(준비 중), number=단가
    const [price, setPrice] = useState<number | null | undefined>(undefined);
    const [catalog, setCatalog] = useState<CatalogResp | null>(null);
    const [catalogErr, setCatalogErr] = useState(false);

    const [consent, setConsent] = useState([false, false, false]);
    const [preview, setPreview] = useState<string | null>(null);
    const [photoDims, setPhotoDims] = useState<{ w: number; h: number } | null>(null);
    const [prepping, setPrepping] = useState(false);
    const [parts, setParts] = useState<Part[]>([]);
    const [pickErr, setPickErr] = useState('');
    const [busy, setBusy] = useState(false);

    const [scanMsg, setScanMsg] = useState(SCAN_MSGS[0]);
    const [chipCount, setChipCount] = useState(0);

    const [report, setReport] = useState<EstimateReport | null>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [shownCards, setShownCards] = useState(0);
    const [shownSum, setShownSum] = useState<[number, number]>([0, 0]);

    const rootRef = useRef<HTMLDivElement>(null);
    const photoRef = useRef<string | null>(null); // base64 — 상태·로그·저장소에 두지 않는다
    const previewRef = useRef<string | null>(null);
    const busyRef = useRef(false);
    const aliveRef = useRef(true);
    const abortRef = useRef<AbortController | null>(null);
    const timersRef = useRef<number[]>([]);
    const scanTimersRef = useRef<number[]>([]);
    const toastTimerRef = useRef<number | undefined>(undefined);
    const rafRef = useRef(0);
    const sumRef = useRef<[number, number]>([0, 0]);
    const fileSeqRef = useRef(0);
    const isGuest = !gift;
    const who = guide.personaName || guide.title || '윤채린';

    const later = useCallback((fn: () => void, ms: number, bucket: 'ui' | 'scan' = 'ui') => {
        const id = window.setTimeout(fn, ms);
        (bucket === 'scan' ? scanTimersRef : timersRef).current.push(id);
        return id;
    }, []);
    const clearScanTimers = () => {
        scanTimersRef.current.forEach(clearTimeout);
        scanTimersRef.current = [];
    };

    const say = useCallback((m: string) => {
        setToast(m);
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(''), 2600);
    }, []);

    // 언마운트 — 타이머·rAF·요청·objectURL·사진 전부 정리
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            timersRef.current.forEach(clearTimeout);
            scanTimersRef.current.forEach(clearTimeout);
            clearTimeout(toastTimerRef.current);
            cancelAnimationFrame(rafRef.current);
            abortRef.current?.abort();
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
            previewRef.current = null;
            photoRef.current = null;
        };
    }, []);

    // 단가 — 로그인 회원만(비로그인은 401). 못 받으면 배지만 생략한다.
    useEffect(() => {
        if (!gift) return;
        let alive = true;
        fetch('/api/points/menu-prices', { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`prices ${r.status}`))))
            .then((d: { prices?: Record<string, number> }) => {
                if (!alive) return;
                const v = d?.prices?.[ESTIMATE_FEATURE];
                setPrice(typeof v === 'number' && Number.isFinite(v) ? v : null);
            })
            .catch(() => {
                /* 모름 — 서버가 최종 판정(503/402) */
            });
        return () => {
            alive = false;
        };
        // gift 객체는 렌더마다 새로 올 수 있다 — 로그인 여부만 본다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!gift]);

    const go = useCallback((s: Screen) => {
        setScreen(s);
        rootRef.current?.scrollTo?.({ top: 0 });
    }, []);
    const toClinic = useCallback(() => go('entry'), [go]);

    // 가격표 — 처음 열 때 한 번(비로그인도 공개)
    const loadCatalog = useCallback(() => {
        setCatalogErr(false);
        fetch(`${API}/catalog`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog ${r.status}`))))
            .then((d: CatalogResp) => {
                if (aliveRef.current) setCatalog(d);
            })
            .catch(() => {
                if (aliveRef.current) setCatalogErr(true);
            });
    }, []);
    useEffect(() => {
        if (screen === 'table' && !catalog && !catalogErr) loadCatalog();
    }, [screen, catalog, catalogErr, loadCatalog]);

    const back = useCallback(() => {
        const up = PARENT[screen];
        if (up === null) onClose();
        else if (up !== screen) go(up);
    }, [screen, go, onClose]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.querySelector('[data-charge-layer]')) back();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [back]);

    // ── 견적 진입 ──
    const openEstimate = () => {
        if (isGuest) {
            if (onGuestGate) onGuestGate('paid', ESTIMATE_FEATURE);
            else say('로그인 후 이용할 수 있어요');
            return;
        }
        if (price === null) {
            say(NOT_READY_MSG);
            return;
        }
        go('consent');
    };
    // 채팅·메인 견적 링크도 같은 회원/가격 게이트를 통과한다.
    useEffect(() => {
        if (!requestedScreen || handledGuide.current === guide) return;
        if (requestedScreen === 'estimate' && !isGuest && price === undefined) return;
        handledGuide.current = guide;
        if (requestedScreen === 'table') go('table');
        else openEstimate();
    }, [guide, requestedScreen, isGuest, price, go]);

    const allAgreed = consent.every(Boolean);

    // ── 사진 ──
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // 같은 사진을 다시 골라도 change 가 오게
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setPickErr('사진 파일만 올릴 수 있어요.');
            return;
        }
        const seq = ++fileSeqRef.current;
        setPickErr('');
        setPrepping(true);
        try {
            const p = await prepPhoto(file);
            if (!aliveRef.current || seq !== fileSeqRef.current) return;
            photoRef.current = p.base64;
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
            const url = URL.createObjectURL(file);
            previewRef.current = url;
            setPreview(url);
            setPhotoDims({ w: p.width, h: p.height });
        } catch {
            if (aliveRef.current && seq === fileSeqRef.current)
                setPickErr('사진을 읽지 못했어요. 다른 사진으로 올려 주세요.');
        } finally {
            if (aliveRef.current && seq === fileSeqRef.current) setPrepping(false);
        }
    };
    const togglePart = (id: Part) => setParts((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]));
    const canAnalyze = !!preview && parts.length > 0 && !busy && !prepping;

    // ── 분석 ──
    const startScanFx = (chosen: Part[]) => {
        clearScanTimers();
        setScanMsg(SCAN_MSGS[0]);
        setChipCount(0);
        if (reduce) {
            setChipCount(chosen.length);
            return;
        }
        SCAN_MSGS.forEach((m, i) => {
            if (i) later(() => setScanMsg(m), i * 1100, 'scan');
        });
        chosen.forEach((_, i) => later(() => setChipCount(i + 1), 1600 + i * 450, 'scan'));
    };

    const failToPick = (msg: string) => {
        clearScanTimers();
        setPickErr(msg);
        go('pick');
    };

    const analyze = async () => {
        if (busyRef.current || !canAnalyze || !photoRef.current || !gift) return;
        busyRef.current = true;
        setBusy(true);
        setPickErr('');
        const chosen = PARTS.map((p) => p.id).filter((id) => parts.includes(id));
        const t0 = Date.now();
        go('scan');
        startScanFx(chosen);

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const timeout = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        try {
            let res: Response;
            try {
                res = await fetch(API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({
                        imageBase64: photoRef.current,
                        mimeType: 'image/jpeg',
                        parts: chosen,
                        adultConfirmed: true,
                    }),
                    signal: ctrl.signal,
                });
            } catch {
                if (aliveRef.current) failToPick(FAIL_MSG);
                return;
            }
            const data = await res.json().catch(() => ({}) as any);
            if (!aliveRef.current) return;

            if (!res.ok) {
                if (res.status === 402) {
                    clearScanTimers();
                    go('pick');
                    gift.onNeedCharge();
                } else if (
                    res.status === 422 &&
                    (data?.error === 'UNCLEAR_IMAGE' || data?.error === 'MINOR_SUSPECTED')
                ) {
                    failToPick(`${data.message || FAIL_MSG} (포인트는 차감되지 않았어요)`);
                } else if (res.status === 503 && data?.error === 'PRICE_NOT_SET') {
                    setPrice(null);
                    failToPick(NOT_READY_MSG);
                    say(NOT_READY_MSG);
                } else {
                    failToPick(FAIL_MSG);
                }
                return;
            }

            const r = data as EstimateReport;
            if (!Array.isArray(r?.parts)) {
                failToPick(FAIL_MSG);
                return;
            }
            if (r.pointsCharged > 0) gift.onPointsChanged?.();
            setChipCount(chosen.length);

            const wait = reduce ? 0 : Math.max(0, MIN_SCAN_MS - (Date.now() - t0));
            const show = () => {
                clearScanTimers();
                setReport(r);
                setChecked(new Set(r.parts.flatMap((p) => p.items.filter((i) => i.suggested).map((i) => i.id))));
                sumRef.current = [0, 0];
                setShownSum([0, 0]);
                setShownCards(0);
                go('report');
            };
            if (wait) later(show, wait, 'scan');
            else show();
        } finally {
            clearTimeout(timeout);
            if (abortRef.current === ctrl) abortRef.current = null;
            busyRef.current = false;
            if (aliveRef.current) setBusy(false);
        }
    };

    // ── 리포트 계산(체크된 항목의 min/max 합) ──
    const totals = useMemo(() => {
        const per: Record<string, [number, number, number]> = {}; // [min, max, 체크 수]
        let min = 0,
            max = 0;
        for (const p of report?.parts ?? []) {
            let a = 0,
                b = 0,
                n = 0;
            for (const it of p.items)
                if (checked.has(it.id)) {
                    a += it.min;
                    b += it.max;
                    n++;
                }
            per[p.part] = [a, b, n];
            min += a;
            max += b;
        }
        const maxAll = Math.max(1, ...(report?.parts ?? []).flatMap((p) => p.items.map((i) => i.max)));
        return { per, min, max, maxAll };
    }, [report, checked]);

    // 카드 순차 등장
    useEffect(() => {
        if (screen !== 'report' || !report) return;
        if (reduce) {
            setShownCards(report.parts.length);
            return;
        }
        const ids = report.parts.map((_, i) => later(() => setShownCards((c) => Math.max(c, i + 1)), 250 + i * 180));
        return () => ids.forEach(clearTimeout);
    }, [screen, report, reduce, later]);

    // 총액 카운트업
    useEffect(() => {
        if (screen !== 'report') return;
        const to: [number, number] = [totals.min, totals.max];
        cancelAnimationFrame(rafRef.current);
        if (reduce || typeof requestAnimationFrame !== 'function') {
            sumRef.current = to;
            setShownSum(to);
            return;
        }
        const from = sumRef.current;
        const ms = from[0] === 0 && from[1] === 0 ? 900 : 450;
        const t0 = performance.now();
        const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / ms),
                e = 1 - Math.pow(1 - p, 3);
            const cur: [number, number] = [
                Math.round(from[0] + (to[0] - from[0]) * e),
                Math.round(from[1] + (to[1] - from[1]) * e),
            ];
            sumRef.current = cur;
            setShownSum(cur);
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [screen, totals.min, totals.max, reduce]);

    const toggleItem = (id: string) =>
        setChecked((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const steps = (on: number) => (
        <div className="cc-steps" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < on ? 'cc-on' : ''} />
            ))}
        </div>
    );
    const priceLabel = isGuest
        ? '회원'
        : price === null
          ? '준비 중'
          : typeof price === 'number'
            ? price > 0
                ? `${fmt(price)}P`
                : '무료'
            : '';
    const chosenParts = PARTS.filter((p) => parts.includes(p.id));

    return (
        <div className="cc-root" ref={rootRef} role="dialog" aria-modal="true" aria-label={`${who} 뷰티 상담`}>
            <div className="cc-wrap">
                <header className="cc-gallery-header">
                    <div className="cc-gallery-brand">
                        CHAERIN / BEAUTY NOTES<small>내 피부에 맞는 게 정답</small>
                    </div>
                    <button type="button" className="cc-close" onClick={onClose} aria-label="닫기">
                        ×
                    </button>
                </header>
                {screen !== 'entry' && (
                    <p className="cc-sublegal">AI 뷰티 컨설턴트 · 의료인 아님 · 공개 가격 참고 범위</p>
                )}
                {screen === 'entry' && (
                    <section aria-label="채린 뷰티 상담 입구">
                        <div className="cc-gallery-hero">
                            <div className="cc-gallery-copy">
                                <span className="cc-gallery-eyebrow">Beauty notes / 01</span>
                                <h1>
                                    나답게,
                                    <br />
                                    조금 더 편하게.
                                </h1>
                                <p>
                                    피부 고민도, 새로운 내 모습도.
                                    <br />
                                    채린이 옆에서 같이 볼게.
                                </p>
                                <small>AI 뷰티 컨설턴트 · 의료인 아님</small>
                            </div>
                            <img src={IMG.hero} alt="아이보리 니트를 입고 노트를 든 윤채린" />
                        </div>
                        <button type="button" className="cc-chat-cta" onClick={() => onStart()}>
                            <img src="/chaerin/menu/chat-v3.webp" alt="" />
                            <span>
                                <strong>대화하기</strong>
                                <small>피부 고민, 편하게 말해줘</small>
                            </span>
                            <span>
                                {CHAT_MESSAGE_COST}P<small>대화 →</small>
                            </span>
                        </button>
                        <ChaerinMenu
                            estimatePrice={priceLabel || '확인 중'}
                            onEstimate={openEstimate}
                            onTable={() => go('table')}
                            onFeature={onFeature}
                        />
                        <p className="cc-gallery-note">그림은 기능을 소개하는 예시이며 실제 결과가 아니에요.</p>
                        <p className="cc-gallery-legal">
                            채린은 AI 뷰티 컨설턴트 · 의료인 아님. 견적은 공개 가격의 참고 범위이며 진단·처방이
                            아니에요.
                        </p>
                    </section>
                )}

                {screen === 'table' && (
                    <section className="cc-screen" key="table" aria-label="부위별 평균 가격표">
                        <button type="button" className="cc-back" onClick={toClinic}>
                            ← 처음으로
                        </button>
                        <h2>부위별 평균 가격표</h2>
                        <p className="cc-src">
                            {catalog?.asOf ? `${catalog.asOf.replace('-', '.')} 기준 · ` : ''}병원 공개 수가표·가격 비교
                            서비스 모음 · 만원 · 병원·지역·방법에 따라 달라요
                        </p>
                        {!catalog && !catalogErr && (
                            <p className="cc-status" role="status">
                                가격표를 불러오는 중…
                            </p>
                        )}
                        {catalogErr && (
                            <div className="cc-panel">
                                <p className="cc-err" role="alert">
                                    가격표를 불러오지 못했어요.
                                </p>
                                <button type="button" className="cc-btn cc-ghost" onClick={loadCatalog}>
                                    다시 불러오기
                                </button>
                            </div>
                        )}
                        {catalog && (
                            <div className="cc-menu">
                                {catalog.parts.map((p) => (
                                    <div className="cc-pcard cc-show" key={p.part}>
                                        <div className="cc-top">
                                            <h4>{p.name}</h4>
                                        </div>
                                        {p.items.map((it) => (
                                            <div className="cc-trow" key={it.id}>
                                                <span>
                                                    {it.name}
                                                    {it.note ? ` (${it.note})` : ''}
                                                    {it.singleSource ? ' *' : ''}
                                                </span>
                                                <span className="cc-won">
                                                    {fmt(it.min)}~{fmt(it.max)}만
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <p className="cc-src">
                                    출처: {catalog.sources.join(', ')}.
                                    {catalog.parts.some((p) => p.items.some((i) => i.singleSource))
                                        ? ' * 표시는 단일 출처 항목이에요.'
                                        : ''}
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {screen === 'consent' && (
                    <section className="cc-screen" key="consent" aria-label="시작 전 확인">
                        <button type="button" className="cc-back" onClick={toClinic}>
                            ← 처음으로
                        </button>
                        {steps(1)}
                        <div className="cc-panel">
                            <h3>시작 전에 확인해 주세요</h3>
                            {[
                                <>만 19세 이상이에요.</>,
                                <>
                                    결과는 공개 가격을 모은 <b>참고 범위</b>이고, 진단·처방이 아니라는 걸 알아요. 실제
                                    수술 여부와 비용은 의사 상담으로 정해요.
                                </>,
                                <>
                                    사진은 분석에만 쓰고 <b>저장하지 않아요</b>.
                                </>,
                            ].map((txt, i) => (
                                <label className="cc-check" key={i}>
                                    <input
                                        type="checkbox"
                                        checked={consent[i]}
                                        onChange={(e) => {
                                            const v = e.target.checked;
                                            setConsent((c) => c.map((x, j) => (j === i ? v : x)));
                                        }}
                                    />
                                    <span>{txt}</span>
                                </label>
                            ))}
                            <button type="button" className="cc-btn" disabled={!allAgreed} onClick={() => go('pick')}>
                                동의하고 시작하기
                            </button>
                        </div>
                    </section>
                )}

                {screen === 'pick' && (
                    <section className="cc-screen" key="pick" aria-label="사진과 관심 부위">
                        <button type="button" className="cc-back" onClick={() => go('consent')}>
                            ← 이전
                        </button>
                        {steps(2)}
                        <div className="cc-panel">
                            <h3>정면 사진과 관심 부위</h3>
                            <div className="cc-upload">
                                <img
                                    src={preview ?? IMG.sample}
                                    alt={preview ? '올린 사진 미리보기' : '예시 정면 사진(가상 인물)'}
                                />
                                <div>
                                    <p>
                                        이마·턱선·귀가 보이는 <b>정면 사진</b>이 가장 정확해요. 안경·필터는 빼 주세요.
                                    </p>
                                    <label className="cc-file">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={onFile}
                                            aria-label="정면 사진 고르기"
                                        />
                                        📷 {prepping ? '사진 준비 중…' : preview ? '사진 바꾸기' : '사진 고르기'}
                                    </label>
                                </div>
                            </div>
                            <p style={{ fontSize: 14, fontWeight: 700 }}>어디가 궁금하세요? (여러 개 가능)</p>
                            <div className="cc-parts">
                                {PARTS.map((p) => (
                                    <button
                                        type="button"
                                        key={p.id}
                                        className="cc-part"
                                        aria-pressed={parts.includes(p.id)}
                                        onClick={() => togglePart(p.id)}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                            {pickErr && (
                                <p className="cc-err" role="alert">
                                    {pickErr}
                                </p>
                            )}
                            <button type="button" className="cc-btn" disabled={!canAnalyze} onClick={analyze}>
                                {busy
                                    ? '분석 중…'
                                    : `분석 시작${typeof price === 'number' && price > 0 ? ` · ${fmt(price)}P` : ''}`}
                            </button>
                            <p className="cc-src" style={{ textAlign: 'center' }}>
                                얼굴이 또렷하지 않거나 분석이 안 되면 포인트는 차감되지 않아요.
                            </p>
                        </div>
                    </section>
                )}

                {screen === 'scan' && (
                    <section className="cc-screen" key="scan" aria-label="얼굴 분석 중">
                        {steps(3)}
                        <div className="cc-scan">
                            {preview && <img src={preview} alt="" />}
                            <div className="cc-guide" aria-hidden="true" />
                            {!reduce && <div className="cc-beam" />}
                        </div>
                        <div className="cc-diagram">
                            <svg viewBox="0 0 100 110" aria-hidden="true">
                                <path
                                    className="cc-faceline"
                                    d="M50 8 C74 8 82 30 80 58 C78 86 64 102 50 104 C36 102 22 86 20 58 C18 30 26 8 50 8 Z"
                                />
                                {PARTS.map((p) => {
                                    const i = chosenParts.findIndex((c) => c.id === p.id);
                                    const lit = i >= 0 && i < chipCount;
                                    return (
                                        <g
                                            key={p.id}
                                            className={`cc-zone${lit ? ' cc-lit' : ''}${i < 0 ? ' cc-off' : ''}`}
                                            style={{ ['--z' as string]: p.color } as React.CSSProperties}
                                        >
                                            {ZONES[p.id]}
                                        </g>
                                    );
                                })}
                            </svg>
                            <ul className="cc-chips">
                                {chosenParts.map((p, i) => (
                                    <li key={p.id} className={i < chipCount ? 'cc-done' : ''}>
                                        <i style={{ background: p.color }} />
                                        {p.chip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p className="cc-status" aria-live="polite">
                            {scanMsg}
                        </p>
                    </section>
                )}

                {screen === 'report' && report && (
                    <section className="cc-screen" key="report" aria-label="견적 리포트">
                        {steps(4)}
                        <div className="cc-total">
                            <small>선택한 시술 기준 예상 총액 · 참고 범위</small>
                            <div className="cc-sum" aria-hidden="true">
                                {fmt(shownSum[0])} ~ {fmt(shownSum[1])}
                                <em> 만원</em>
                            </div>
                            <span className="cc-sr" data-testid="cc-total" role="status">
                                예상 총액 {fmt(totals.min)}만 ~ {fmt(totals.max)}만 원
                            </span>
                            <div className="cc-stack" aria-hidden="true">
                                {report.parts.map((p) => (
                                    <i
                                        key={p.part}
                                        style={{
                                            background: PART_BY_ID.get(p.part)?.color,
                                            width: `${totals.max ? ((totals.per[p.part]?.[1] ?? 0) / totals.max) * 100 : 0}%`,
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="cc-legend">
                                {report.parts.map((p) => (
                                    <span key={p.part} style={{ ['--c' as string]: PART_BY_ID.get(p.part)?.color }}>
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <p className="cc-charm">
                            ✨ <b>채린이 먼저 본 매력</b> — {report.charm}
                        </p>
                        <div className="cc-cards">
                            {report.parts.map((p, pi) => {
                                const [a, b, n] = totals.per[p.part] ?? [0, 0, 0];
                                const shown = pi < shownCards;
                                return (
                                    <article key={p.part} className={`cc-pcard${shown ? ' cc-show' : ''}`}>
                                        <div className="cc-top">
                                            <h4>{p.name}</h4>
                                            <span className="cc-range">
                                                {n ? `${fmt(a)}~${fmt(b)}만` : '선택 없음'}
                                            </span>
                                        </div>
                                        <p className="cc-feat">{p.feature}</p>
                                        {p.items.map((it) => (
                                            <label className="cc-opt" key={it.id}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked.has(it.id)}
                                                    onChange={() => toggleItem(it.id)}
                                                />
                                                <span>
                                                    {it.name}
                                                    {it.note ? ` (${it.note})` : ''}
                                                </span>
                                                <span className="cc-won">
                                                    {fmt(it.min)}~{fmt(it.max)}만
                                                </span>
                                                <span className="cc-bar" aria-hidden="true">
                                                    <i
                                                        style={
                                                            shown
                                                                ? {
                                                                      left: `${(it.min / totals.maxAll) * 100}%`,
                                                                      width: `${Math.max(2, ((it.max - it.min) / totals.maxAll) * 100)}%`,
                                                                  }
                                                                : { left: 0, width: 0 }
                                                        }
                                                    />
                                                </span>
                                            </label>
                                        ))}
                                        <p className="cc-src">
                                            공개 가격 범위{report.asOf ? `(${report.asOf.replace('-', '.')} 기준)` : ''}{' '}
                                            · 병원·방법에 따라 달라요
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                        <p className="cc-legal">
                            이 리포트는 사진에서 보이는 특징과 <b>공개된 평균 가격</b>으로 만든 참고 자료예요. 진단이
                            아니며 특정 병원·시술을 권하지 않아요. 마취·검사·재수술·부가세는 별도일 수 있고, 실제 수술
                            여부와 비용은 반드시 전문의 상담으로 정하세요.
                        </p>
                        <button
                            type="button"
                            className="cc-btn"
                            onClick={() => {
                                setPickErr('');
                                go('pick');
                            }}
                        >
                            다시 해보기
                        </button>
                        <button type="button" className="cc-btn cc-ghost" onClick={() => onStart()}>
                            대화하기
                        </button>
                        <button type="button" className="cc-btn cc-ghost" onClick={toClinic}>
                            처음으로
                        </button>
                    </section>
                )}
            </div>
            {toast && (
                <div className="cc-toast" role="status" aria-live="polite">
                    {toast}
                </div>
            )}
        </div>
    );
};
