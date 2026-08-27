// 도결(道潔) 선생 사주 랜딩 — 히어로 연출의 공용 상수·유틸.
//
// 이 파일은 화면(SajuEntry.tsx)이 아니라 **연출 재료와 그리는 로직**을 담는다.
// 톤 값과 이미지 경로를 한 곳에 모아둬야 캔버스(연기·안개)와 정적 대체 화면이
// 같은 색·같은 비율을 쓰게 된다.
//
// 앞쪽 = 색·이미지·타임라인 상수, 뒤쪽 = 캔버스 엔진(mountSajuHero).
// 화면 쪽은 canvas 엘리먼트 하나만 넘기고, 그리는 일은 전부 여기서 한다.
// 근거 문서: doc/features/persona_entry_saju.md 의 '히어로 연출' 절.

/** 사주 랜딩 색 토큰. 먹색 바탕 + 금박 + 주홍(병오년의 붉은 기운). */
export const SAJU_TONE = {
    /** 바탕 — 먹색 */
    inkDeep: '#0d0b0a',
    ink: '#14100e',
    /** 금박 */
    gold: '#c9a227',
    goldLight: '#e8cc6a',
    /** 포인트 — 주홍 */
    vermilion: '#b8352c',
    /** 글씨 */
    text: '#f0e9dc',
    textSub: '#a89a86',
    /** 선·테두리 */
    line: 'rgba(201,162,39,0.22)',
} as const;

/** public/ 아래 실제로 존재하는 히어로 소재. 1216×832 (3:2에 가깝다). */
export const SAJU_HERO_IMAGES = {
    /** 역술가의 오래된 책 — 향로 연기가 화면 중앙 상단에 이미 찍혀 있다. */
    book: '/saju/book.png',
    /** 한국 호랑이 — 좌우에 연기가 감돈다. */
    tiger: '/saju/tiger.png',
} as const;

/** 히어로 박스 가로/세로 비. 이미지 원본(1216×832)과 같게 잡아 잘림을 막는다. */
export const SAJU_HERO_ASPECT = '1216 / 832';

/**
 * 모션 감소 설정 여부.
 * ★ SSR·테스트 환경에서 matchMedia가 없을 수 있어 반드시 존재 확인 후 호출한다
 *   (없는 걸 호출하면 화면이 통째로 죽는다).
 */
export const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 히어로 캔버스 엔진 (묶음 B)
//
// 사양서의 연출: **책 → 연기(위로 상승) → 안개(옆으로 흐름) → 호랑이**.
//
// 설계에서 지킨 세 가지:
//
// 1) **진행도는 오직 `t`(초) 하나다.** 입자마다 위치를 누적 갱신하지 않고,
//    입자는 `(주기속도, 위상)`만 들고 있다가 매 프레임 `u = frac(t*speed + phase)`
//    로 제 인생의 몇 %를 살았는지 계산한다. 그래서 리사이즈·화면 밖 정지·재개가
//    상태를 흐트러뜨리지 않고, 임의 시각으로 seek 해서 중간 프레임을 확인할 수 있다.
//
// 2) **연기와 안개는 성질이 다르다**(사양서 강조).
//    연기 = 발생점에서 위로 상승, 작게 시작해 커지며 옅어지고 sin 으로 흔들린다.
//    안개 = 큰 덩어리가 가로로만 느리게 흐른다(상승 거의 0).
//    같은 함수로 그리지 않고 아예 다른 루프로 그린다.
//
// 3) **사진에 이미 찍혀 있는 연기와 이어붙인다.**
//    책 사진의 향로는 중앙 상단(≈0.555, 0.235), 호랑이 사진의 연기는 좌·우에 있다.
//    그래서 발생점을 그 좌표에 두고, 향로 연기는 책 구간에, 좌우 연기는 호랑이
//    구간에 살아나도록 세기 곡선을 나눴다.
//
// `globalCompositeOperation` 은 'screen' 을 쓴다. 먹색 배경에서 'lighter' 는 타서
// 흰 덩어리가 된다(사양서 금지).

/** 재생 길이(초). 이 시각에 도달하면 rAF 를 멈추고 호랑이 상태로 정지한다. */
export const SAJU_HERO_DURATION = 6;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** a→b 구간을 0→1 로 부드럽게. 구간 밖은 0/1 로 물린다. */
const ramp = (a: number, b: number, t: number): number => {
    const u = clamp01((t - a) / (b - a));
    return u * u * (3 - 2 * u);
};

/** 결정적 난수 — 같은 화면이면 항상 같은 배치가 나온다(디버깅·캡처 재현용). */
const makeRng = (seed: number) => {
    let s = seed >>> 0;
    return (): number => {
        s = (s + 0x6d2b79f5) >>> 0;
        let x = Math.imul(s ^ (s >>> 15), 1 | s);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * 타임라인 한 시점의 연출 세기.
 * ★사양서 표를 그대로 옮긴 곳 — 연출을 손볼 일이 있으면 여기만 고치면 된다.
 */
export interface SajuHeroPhase {
    /** 책 이미지 불투명도 */
    book: number;
    /** 호랑이 이미지 불투명도 */
    tiger: number;
    /** 향로(중앙 상단) 연기 세기 — 사진에 찍힌 향로 연기를 이어받는다 */
    smokeCenter: number;
    /** 아래에서 솟구쳐 책을 감싸는 큰 연기 세기 */
    smokeSwell: number;
    /** 좌우 연기 세기 — 호랑이 사진 좌우의 연기와 이어붙는다 */
    smokeSide: number;
    /** 안개 세기 */
    fog: number;
}

export const sajuHeroPhase = (t: number): SajuHeroPhase => ({
    // 1.7~3.2 사이에 연기에 삼켜지며 사라진다.
    book: 1 - ramp(1.7, 3.2, t),
    // ★2.9부터 안개 속에서 서서히 드러나 5.0에 완전히 선다.
    //   책 페이드(1.7~3.2)와 **겹쳐야** 한다 — 3.2에 책이 0인데 호랑이가 아직
    //   0이면 그 사이가 순수 검은 화면이 되고, 연기가 그 검정을 혼자 감당하게 된다.
    tiger: ramp(2.9, 5.0, t),
    // 0~1.5 서서히 짙어지고, 1.5~2.8 최고조, 3.2~5.2 잦아든다.
    smokeCenter: 0.5 * ramp(0, 1.5, t) + 0.5 * ramp(1.5, 2.8, t) - 0.85 * ramp(3.2, 5.2, t),
    // ★책을 삼키는 연기. 향로 하나로는 화면 아래쪽 책에 닿지 않아서, 1.3초부터
    //   화면 아래 전폭에서 큰 덩어리가 솟구쳐 올라 책을 덮는다.
    smokeSwell: ramp(1.3, 2.9, t) - ramp(3.4, 5.4, t),
    // 호랑이가 드러나는 구간부터 좌우에서 은은하게. 끝까지 남는다.
    smokeSide: 0.6 * ramp(3.4, 5.4, t),
    // 2.2부터 화면을 덮었다가 4.2~5.8에 걷히며 옅게 남는다.
    //   ★책이 사라지는 구간(1.7~3.2)과 겹쳐야 한다 — 안 겹치면 그 사이가 그냥 검은 화면이 된다.
    fog: ramp(2.2, 3.6, t) - 0.6 * ramp(4.2, 5.8, t),
});

/** 연기 입자 — 상태 없음. u=frac(t*speed+phase) 하나로 전 생애가 결정된다. */
interface Puff {
    /** 발생점(0~1 정규화) */
    ox: number;
    oy: number;
    /** 얼마나 높이 오르는가(화면 높이 비) */
    rise: number;
    /** 초당 생애 수 */
    speed: number;
    phase: number;
    /** 좌우 흔들림 폭·주기 */
    wob: number;
    wobF: number;
    /** 시작 반지름 / 증가량(화면 높이 비) */
    r0: number;
    rg: number;
    /** 상승하며 한쪽으로 밀리는 정도 */
    drift: number;
    /** 개체 밝기 */
    alpha: number;
    /** 0 = 향로(중앙 상단), 1 = 좌우(호랑이 사진과 이어붙는 곳), 2 = 아래에서 솟구치는 큰 덩어리 */
    kind: 0 | 1 | 2;
}

/** 안개 덩어리 — 가로로만 흐른다. */
interface Fog {
    y: number;
    rx: number;
    ry: number;
    speed: number;
    phase: number;
    alpha: number;
}

/** 발생점 — 두 사진에 실제로 찍혀 있는 연기 위치에 맞췄다. */
const EMITTERS = {
    // ★y 는 뚜껑 '꼭지'가 아니라 그 **위쪽 어두운 배경**이다. 뚜껑 자체는 사진에서
    //   이미 밝아 연기를 얹어도 대비가 죽는다(0.235 → 0.20). x 는 향로 중심 그대로.
    /** 책 사진의 향로 뚜껑 바로 위 */
    censer: { x: 0.555, y: 0.20 },
    /** 호랑이 사진 왼쪽에 감도는 연기 */
    left: { x: 0.055, y: 0.56 },
    /** 호랑이 사진 오른쪽(촛불 위) 연기 */
    right: { x: 0.855, y: 0.78 },
} as const;

const buildPuffs = (count: number): Puff[] => {
    const rnd = makeRng(0x5a10c);
    const out: Puff[] = [];
    for (let i = 0; i < count; i++) {
        // 5개마다 향로 2 · 솟구침 2 · 좌우 1.
        const m = i % 5;
        const kind: 0 | 1 | 2 = m < 2 ? 0 : m < 4 ? 2 : 1;
        if (kind === 2) {
            // ★솟구침 — 화면 아래 전폭에서 시작해 크고 진하게 위로 오른다.
            out.push({
                ox: 0.1 + rnd() * 0.8,
                oy: 1.02 + rnd() * 0.1,
                rise: 0.7 + rnd() * 0.55,
                speed: 1 / (4.2 + rnd() * 3.4),
                phase: rnd(),
                wob: 0.03 + rnd() * 0.06,
                wobF: 2 + rnd() * 3,
                // ★크고 진해야 한다. 이보다 옅으면 책이 '연기에 삼켜지는' 게 아니라
                //   그냥 '화면이 캄캄해지는' 것으로 보인다(전환 중간 프레임 평균 23/255 사고).
                r0: 0.1 + rnd() * 0.085,
                rg: 0.22 + rnd() * 0.22,
                drift: (rnd() - 0.5) * 0.12,
                alpha: 0.7 + rnd() * 0.3,
                kind,
            });
            continue;
        }
        const em = kind === 0 ? EMITTERS.censer : i % 10 === 4 ? EMITTERS.left : EMITTERS.right;
        out.push({
            ox: em.x + (rnd() - 0.5) * (kind === 0 ? 0.035 : 0.05),
            oy: em.y + (rnd() - 0.5) * 0.03,
            rise: kind === 0 ? 0.24 + rnd() * 0.34 : 0.16 + rnd() * 0.22,
            speed: 1 / (3.4 + rnd() * 3.6),
            phase: rnd(),
            wob: (kind === 0 ? 0.045 : 0.03) + rnd() * 0.05,
            wobF: 3 + rnd() * 4,
            // ★향로(kind 0)만 크고 진하게. 0~1.5s 구간은 이 입자밖에 없어서
            //   좌우 입자와 같은 세기로 두면 '연기가 짙어진다'가 전혀 안 보인다.
            r0: kind === 0 ? 0.035 + rnd() * 0.025 : 0.018 + rnd() * 0.024,
            rg: 0.08 + rnd() * 0.1,
            drift: (rnd() - 0.5) * 0.09,
            alpha: kind === 0 ? 0.45 + rnd() * 0.25 : 0.2 + rnd() * 0.18,
            kind,
        });
    }
    return out;
};

const buildFog = (count: number): Fog[] => {
    const rnd = makeRng(0xf06);
    const out: Fog[] = [];
    for (let i = 0; i < count; i++) {
        out.push({
            y: 0.26 + rnd() * 0.62,
            rx: 0.32 + rnd() * 0.32,
            ry: 0.11 + rnd() * 0.13,
            // 서로 다른 속도로 겹쳐 흘러야 깊이가 생긴다. 방향은 전부 →.
            speed: 1 / (14 + rnd() * 22),
            phase: rnd(),
            // ★연기와 함께 전환 구간의 검정을 덮는 몫이다. 옅으면 암전으로 읽힌다.
            alpha: 0.4 + rnd() * 0.15,
        });
    }
    return out;
};

/** 이미지를 캔버스에 꽉 차게(cover) 그린다. */
const drawCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    W: number,
    H: number,
    alpha: number,
): void => {
    if (alpha <= 0.002 || !img.complete || !img.naturalWidth) return;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    ctx.globalAlpha = 1;
};

export interface SajuHeroHandle {
    /** rAF·옵저버·리스너를 모두 걷어낸다. */
    destroy(): void;
    /** 임의 시각의 한 프레임을 그린다(검증용 — 자동 재생을 멈춘다). */
    seek(seconds: number): void;
}

/**
 * 캔버스에 히어로 연출을 붙인다.
 * - devicePixelRatio 대응(최대 2배까지만 — 그 이상은 화질 이득 대비 비용이 크다)
 * - 부모 폭 변화에 맞춰 리사이즈
 * - IntersectionObserver 로 화면 밖이면 rAF 정지(타임라인도 함께 멈춘다)
 * - 6초를 채우면 rAF 를 끄고 마지막 프레임(호랑이)에서 정지
 *
 * ★prefers-reduced-motion 판단은 **호출부**가 한다. 그 경우 이 함수를 아예 부르지
 *   않고 호랑이 이미지를 정적으로 띄운다(캔버스를 만들지 않는다).
 */
export const mountSajuHero = (canvas: HTMLCanvasElement): SajuHeroHandle => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { destroy: () => {}, seek: () => {} };

    const book = new Image();
    const tiger = new Image();
    book.src = SAJU_HERO_IMAGES.book;
    tiger.src = SAJU_HERO_IMAGES.tiger;

    let W = 1;
    let H = 1;
    let puffs: Puff[] = [];
    let fogs: Fog[] = [];
    let puffCount = -1;

    let t = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    let stopped = false;
    let manual = false;
    // ★두 이미지가 '정리'된 개수(load 든 error 든). 2가 되기 전에는 t 를 흘리지 않는다.
    let settled = 0;

    const resize = (): void => {
        const host = canvas.parentElement;
        const cssW = Math.max(1, host ? host.clientWidth : canvas.clientWidth);
        const cssH = Math.round((cssW * 832) / 1216);
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        W = Math.round(cssW * dpr);
        H = Math.round(cssH * dpr);
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;

        // 입자 수는 폭으로 정한다(사양서: PC 40~60, 모바일 20~30).
        const want = cssW < 820 ? 26 : 54;
        if (want !== puffCount) {
            puffCount = want;
            puffs = buildPuffs(want);
            fogs = buildFog(cssW < 820 ? 4 : 6);
        }
    };

    const drawSmoke = (phase: SajuHeroPhase): void => {
        ctx.globalCompositeOperation = 'screen';
        for (const p of puffs) {
            const intensity = p.kind === 0 ? phase.smokeCenter : p.kind === 1 ? phase.smokeSide : phase.smokeSwell;
            if (intensity <= 0.01) continue;
            const u = (t * p.speed + p.phase) % 1;
            // 태어날 때 빠르게 나타나고, 남은 생애 동안 길게 옅어진다.
            const fade = u < 0.18 ? u / 0.18 : Math.pow(1 - (u - 0.18) / 0.82, 1.5);
            const a = intensity * p.alpha * fade;
            if (a <= 0.004) continue;
            // ★상승 — 위로 간다. 높이 오를수록 흔들림 폭이 커진다.
            const sway = Math.sin(u * p.wobF + p.phase * 6.283) * p.wob * Math.pow(u, 1.4);
            const x = (p.ox + sway + p.drift * u) * W;
            const y = (p.oy - u * p.rise) * H;
            const r = (p.r0 + u * p.rg) * H;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            // ★단차가 급하면 입자가 '연기'가 아니라 '작고 밝은 점'으로 찍히고,
            //   겹친 자리에 동심원 밴딩 링이 보인다. 알파를 바깥까지 길게 끌고 간다.
            g.addColorStop(0, `rgba(228,222,210,${a})`);
            g.addColorStop(0.35, `rgba(210,204,193,${a * 0.72})`);
            g.addColorStop(0.72, `rgba(190,185,175,${a * 0.3})`);
            g.addColorStop(1, 'rgba(176,171,162,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
    };

    const drawFog = (phase: SajuHeroPhase): void => {
        if (phase.fog <= 0.01) return;
        ctx.globalCompositeOperation = 'screen';
        for (const f of fogs) {
            const u = (t * f.speed + f.phase) % 1;
            // ★가로 흐름 — 화면 밖에서 들어와 화면 밖으로 나간다. 상승은 거의 없다.
            const x = (-0.4 + u * 1.8) * W;
            const y = (f.y + Math.sin(u * 6.283 + f.phase * 6.283) * 0.018) * H;
            const rx = f.rx * W;
            const ry = f.ry * H;
            // 양 끝에서 뚝 끊기지 않도록 들고 날 때 흐려준다.
            const edge = Math.min(1, u / 0.15, (1 - u) / 0.15);
            const a = phase.fog * f.alpha * clamp01(edge);
            if (a <= 0.004) continue;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, ry / rx);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
            g.addColorStop(0, `rgba(206,201,192,${a})`);
            g.addColorStop(0.5, `rgba(186,182,175,${a * 0.5})`);
            g.addColorStop(1, 'rgba(170,166,160,0)');
            ctx.fillStyle = g;
            ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
            ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
    };

    const render = (): void => {
        const phase = sajuHeroPhase(t);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0b0908';
        ctx.fillRect(0, 0, W, H);
        drawCover(ctx, book, W, H, phase.book);
        drawCover(ctx, tiger, W, H, phase.tiger);
        drawFog(phase);
        drawSmoke(phase);
    };

    const frame = (ts: number): void => {
        raf = 0;
        if (stopped || manual) return;
        // dt 를 0.05초로 물린다. 탭이 뒤로 갔다 오거나 프레임이 밀려도
        // 타임라인이 껑충 뛰지 않는다(= 사실상 자동 일시정지).
        const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
        last = ts;
        t = Math.min(SAJU_HERO_DURATION, t + dt);
        render();
        if (t >= SAJU_HERO_DURATION) {
            // 1회 재생 끝 — 호랑이 상태로 정지한다.
            stopped = true;
            return;
        }
        raf = requestAnimationFrame(frame);
    };

    const play = (): void => {
        // ★이미지가 도착하기 전에 t 가 흐르면 책 구간이 통째로 검은 화면으로 날아간다
        //   (6초짜리 1회 재생이라 되돌릴 기회가 없다). 준비될 때까지 t=0 프레임을 유지한다.
        if (stopped || manual || raf || settled < 2) return;
        last = 0;
        raf = requestAnimationFrame(frame);
    };

    const pause = (): void => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    };

    const onResize = (): void => {
        resize();
        render();
    };

    resize();
    render();

    // 이미지가 '정리'되면(도착하든 실패하든) 그 프레임을 다시 그리고, 둘 다 정리됐으면
    // 그때부터 타임라인을 흘린다.
    // ★error 도 반드시 준비로 센다 — 404 하나로 재생이 영영 시작되지 않으면 안 된다.
    const settle = (): (() => void) => {
        let done = false;
        return () => {
            if (done) return;
            done = true;
            settled++;
            render();
            if (visible) play();
        };
    };
    const onBook = settle();
    const onTiger = settle();
    book.addEventListener('load', onBook);
    book.addEventListener('error', onBook);
    tiger.addEventListener('load', onTiger);
    tiger.addEventListener('error', onTiger);
    // 캐시에 있어 이미 끝난 경우(load 가 안 올 수 있다).
    if (book.complete) onBook();
    if (tiger.complete) onTiger();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(onResize);
        if (canvas.parentElement) ro.observe(canvas.parentElement);
    } else {
        window.addEventListener('resize', onResize);
    }

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === 'function') {
        io = new IntersectionObserver(
            entries => {
                visible = entries.some(e => e.isIntersecting);
                if (visible) play();
                else pause();
            },
            { threshold: 0.05 },
        );
        io.observe(canvas);
    } else {
        play();
    }

    return {
        destroy() {
            stopped = true;
            pause();
            book.removeEventListener('load', onBook);
            book.removeEventListener('error', onBook);
            tiger.removeEventListener('load', onTiger);
            tiger.removeEventListener('error', onTiger);
            if (ro) ro.disconnect();
            else window.removeEventListener('resize', onResize);
            if (io) io.disconnect();
        },
        seek(seconds: number) {
            manual = true;
            pause();
            t = Math.max(0, Math.min(SAJU_HERO_DURATION, seconds));
            render();
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 로딩 연기 — 풀이를 기다리는 동안 향 연기만 계속 피어오른다.
//
// 왜(2026-08-27 사장 지시): "기다리는 화면이 너무 밋밋하다." 히어로 연출을 그대로
// 재생하는 안도 있었으나 그건 **6초짜리 정해진 타임라인**이라 풀이가 20~30초 걸리면
// 끝나고 정지 프레임만 남아 다시 밋밋해진다. 그래서 **연기만 무한 루프**로 돌린다.
// ★"도결 선생이 명부를 살피는 중"에 향 연기가 오르는 것은 사주 정서와도 맞는다.
//
// ★히어로와 같은 그리기 방식(radialGradient + screen 합성)을 쓰되, 타임라인·이미지·
//   안개는 없다. 향로 계열 입자만 쓰고 발생점을 화면 아래쪽에 고르게 편다.
export const mountSajuLoadingSmoke = (canvas: HTMLCanvasElement): { destroy(): void } => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { destroy: () => {} };

    const rnd = makeRng(0x10ad1);
    const N = (typeof window !== 'undefined' && window.innerWidth < 600) ? 14 : 24;
    const puffs = Array.from({ length: N }, () => ({
        ox: 0.08 + rnd() * 0.84,
        // ★발생점을 아래로만 몰면 판 하단에 뭉쳐 보인다(실측). 화면 아래~중간까지 흩어
        //   각 입자가 서로 다른 높이에서 시작하게 한다 — 어느 순간을 잘라도 고르게 퍼진다.
        oy: 0.55 + rnd() * 0.62,
        rise: 0.75 + rnd() * 0.5,
        speed: 1 / (5.5 + rnd() * 4),     // 히어로보다 느리게 — 기다림을 재촉하지 않는다
        phase: rnd(),
        wob: 0.035 + rnd() * 0.05,
        wobF: 2 + rnd() * 3,
        r0: 0.05 + rnd() * 0.05,
        rg: 0.14 + rnd() * 0.16,
        drift: (rnd() - 0.5) * 0.1,
        alpha: 0.3 + rnd() * 0.22,        // 글을 읽어야 하므로 히어로보다 옅게
    }));

    let W = 1, H = 1, raf = 0, t = 0, last = 0, visible = true;

    const resize = (): void => {
        const dpr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
        const r = canvas.getBoundingClientRect();
        W = Math.max(1, Math.round(r.width * dpr));
        H = Math.max(1, Math.round(r.height * dpr));
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;
    };

    const render = (): void => {
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'screen';
        for (const p of puffs) {
            const u = (t * p.speed + p.phase) % 1;
            const fade = u < 0.2 ? u / 0.2 : Math.pow(1 - (u - 0.2) / 0.8, 1.4);
            const a = p.alpha * fade;
            if (a <= 0.004) continue;
            const sway = Math.sin(u * p.wobF + p.phase * 6.283) * p.wob * Math.pow(u, 1.4);
            const x = (p.ox + sway + p.drift * u) * W;
            const y = (p.oy - u * p.rise) * H;
            const r = (p.r0 + u * p.rg) * H;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(228,222,210,${a})`);
            g.addColorStop(0.35, `rgba(210,204,193,${a * 0.72})`);
            g.addColorStop(0.72, `rgba(190,185,175,${a * 0.3})`);
            g.addColorStop(1, 'rgba(176,171,162,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
    };

    const tick = (now: number): void => {
        raf = requestAnimationFrame(tick);
        if (!visible) { last = now; return; }
        // ★탭을 오래 비웠다 돌아와도 한 번에 튀지 않게 상한을 둔다.
        const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
        last = now;
        t += dt;
        render();
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); render(); }) : null;
    ro?.observe(canvas);
    const io = typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); }, { threshold: 0 })
        : null;
    io?.observe(canvas);
    raf = requestAnimationFrame(tick);

    return {
        destroy(): void {
            cancelAnimationFrame(raf);
            ro?.disconnect();
            io?.disconnect();
        },
    };
};
