// 체험 "한 기기 영구 1회"용 브라우저 특성 지문(2026-10-03, 사장 B안) — 서버 lib/deviceTrial.ts 와 짝.
//
// ★이건 신원 확인이 아니다. 같은 기종이면 지문이 거의 같으므로 서버는 **접속 네트워크와 쌍으로만** 판정한다.
// ★쿠키·localStorage 에 저장하지 않는다 — 지우면 다시 계산돼도 **같은 값**이 나와야 의미가 있다.
// ★원문을 보내지 않는다. 특성을 모아 SHA-256 hex 로만 보내고, 서버는 그걸 또 비밀값으로 해시해 저장한다.

let cached: string | null = null;
let pending: Promise<string> | null = null;

function canvasTrait(): string {
    try {
        const c = document.createElement('canvas'); c.width = 220; c.height = 30;
        const g = c.getContext('2d'); if (!g) return '';
        g.textBaseline = 'top'; g.font = "14px 'Arial'"; g.fillStyle = '#f60'; g.fillRect(100, 1, 62, 20);
        g.fillStyle = '#069'; g.fillText('AI놀이터 체험 ✦ 1,000P', 2, 15);
        g.fillStyle = 'rgba(102, 204, 0, 0.7)'; g.fillText('AI놀이터 체험 ✦ 1,000P', 4, 17);
        return c.toDataURL();
    } catch { return ''; }
}

function webglTrait(): string {
    try {
        const c = document.createElement('canvas');
        const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!gl) return '';
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        return `${vendor}|${renderer}`;
    } catch { return ''; }
}

/** 특성 원문 모음(테스트용으로 분리). 시간에 따라 바뀌는 값(배터리·창 크기 등)은 넣지 않는다. */
export function collectTraits(): string {
    const n = navigator as any;
    const s = window.screen;
    return [
        n.userAgent, n.language, (n.languages || []).join(','), n.platform,
        n.hardwareConcurrency, n.deviceMemory, n.maxTouchPoints,
        s?.width, s?.height, s?.colorDepth, window.devicePixelRatio,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        webglTrait(), canvasTrait(),
    ].map(v => String(v ?? '')).join('§');
}

async function sha256Hex(text: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 지문을 계산한다(한 번만). 실패하면 '' — 서버는 지문이 없으면 쿠키 검사만 한다. */
export function initDeviceFp(): Promise<string> {
    if (cached !== null) return Promise.resolve(cached);
    if (!pending) {
        pending = (async () => {
            try { cached = window.crypto?.subtle ? await sha256Hex(collectTraits()) : ''; }
            catch { cached = ''; }
            return cached;
        })();
    }
    return pending;
}

/** 이미 계산된 지문(없으면 ''). 요청 헤더에 동기적으로 붙일 때 쓴다. */
export const getDeviceFp = (): string => cached ?? '';
