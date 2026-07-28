// 날짜·시간 표시 공통 유틸 (2026-07-29 신설)
//
// ★문제: `toLocaleString()`을 timeZone 없이 쓰면 **보는 사람 기기의 시간대**를 따른다.
//   서버는 UTC로 돌기 때문에 같은 값이 폰(KST)에서는 07-29 07:30, PC가 UTC면
//   07-28 22:30으로 보인다 — 9시간 차이. 실제로 어드민 전반이 이 상태였다.
// ★방침: 현재 이용자가 전부 한국인이므로 **화면 표시는 KST로 고정**한다.
//   나중에 해외 이용자가 생기면 이 파일 한 곳만 바꾸면 된다.

const TZ = 'Asia/Seoul';
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 어떤 형태로 들어와도 Date로. 실패하면 null(호출부가 '—'를 찍게). */
function toDate(v: string | number | Date | null | undefined): Date | null {
    if (v === null || v === undefined || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

/** 2026-07-29 07:30 (KST 고정) */
export function fmtDateTime(v: string | number | Date | null | undefined, fallback = '—'): string {
    const d = toDate(v);
    if (!d) return fallback;
    // sv-SE는 YYYY-MM-DD HH:mm 형태로 나와 정렬·비교에 안전하다
    return d.toLocaleString('sv-SE', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    }).replace(' ', ' ');
}

/** 2026-07-29 (KST 고정) */
export function fmtDate(v: string | number | Date | null | undefined, fallback = '—'): string {
    const d = toDate(v);
    if (!d) return fallback;
    return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

/** 07-29(수) 07:30 — 보고·목록처럼 좁은 자리용 */
export function fmtShort(v: string | number | Date | null | undefined, fallback = '—'): string {
    const d = toDate(v);
    if (!d) return fallback;
    const md = d.toLocaleDateString('sv-SE', { timeZone: TZ }).slice(5);
    const hm = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    // 요일도 KST 기준이어야 한다(UTC 기준 getDay()를 쓰면 자정 근처에서 하루 어긋남)
    const en = d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
    const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(en);
    return `${md}(${idx >= 0 ? KO_DAYS[idx] : '?'}) ${hm}`;
}

/** 07:30 — 시각만 */
export function fmtTime(v: string | number | Date | null | undefined, fallback = '—'): string {
    const d = toDate(v);
    if (!d) return fallback;
    return d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/** "3분 전" 같은 상대 표기. 하루 넘으면 날짜로. */
export function fmtRelative(v: string | number | Date | null | undefined, fallback = '—'): string {
    const d = toDate(v);
    if (!d) return fallback;
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 0) return fmtDateTime(v, fallback);
    if (sec < 60) return '방금';
    if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
    return fmtDateTime(v, fallback);
}

/** 지금 KST 시각 문자열 (화면 상단 "현재 …" 표기용) */
export function nowKst(): string {
    return fmtDateTime(new Date());
}
