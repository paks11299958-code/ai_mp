import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCandles, type OHLC } from './ChaewonDeskEntry';

// 윤채원 트레이딩 데스크 랜딩 (2026-09-07).
//
// 여기서 지키는 건 **표현 규칙**이다. 화면 색이 틀리면 눈에 보이지만,
// "매수"라는 단어가 새어 나오는 건 아무도 못 보다가 민원으로 돌아온다.
//
// ★소스 검사인 이유: 이 컴포넌트는 fetch 4개에 매달려 있어 렌더 테스트로는
//   정작 지켜야 할 문구가 아니라 목(mock) 을 검증하게 된다.

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
const SRC = read('ChaewonDeskEntry.tsx');
const SHEET = read('../PersonaEntrySheet.tsx');

describe('진입 배선', () => {
    it('윤채원 접두사로 갈아 끼운다', () => {
        expect(SHEET).toContain("guide.title?.startsWith('윤채원')");
        expect(SHEET).toContain('<ChaewonDeskEntry');
        expect(SHEET).toContain("import { ChaewonDeskEntry }");
    });

    it('★윤채린과 접두사가 겹치지 않는다', () => {
        // 겹치면 먼저 오는 분기가 둘 다 먹는다 — 규칙 자체를 못박아 둔다.
        expect('윤채원'.startsWith('윤채린')).toBe(false);
        expect('윤채린'.startsWith('윤채원')).toBe(false);
    });

    it('메뉴는 실제 계약에 연결된다', () => {
        expect(SRC).toContain("onFeature('stock')");   // 내 종목 분석
        expect(SRC).toContain('onStart()');            // 채팅
        expect(SRC).toContain('onInvite');
    });

    it('닫는 길이 둘이다 — ✕와 Esc', () => {
        expect(SRC).toContain("e.key === 'Escape'");
        expect(SRC).toMatch(/aria-label="닫기"/);
    });
});

describe('★표현 규칙 (투자자문 소지)', () => {
    it('요약에서 투자의견·매수 행을 걸러낸다', () => {
        // 원문 실측: "| 투자의견 | **매수 (80점)** — …"
        expect(SRC).toMatch(/const DROP = .*투자의견/);
        expect(SRC).toMatch(/DROP = .*매수/);
    });

    it('점수는 관심 높음/관심/참고로만 말한다', () => {
        expect(SRC).toContain("'관심 높음'");
        expect(SRC).not.toMatch(/['"]추천 종목['"]/);
    });

    it('면책이 화면에 항상 있다', () => {
        expect(SRC).toContain('투자 권유가 아닙니다');
        expect(SRC).toContain('이용자 본인에게 있습니다');
    });

    it('가상매매임을 명시한다', () => {
        expect(SRC).toContain('모의 거래');
        expect(SRC).toContain('과거 성과가 미래를 보장하지 않습니다');
    });

    it('🔴봇의 실계좌를 부르지 않는다', () => {
        // /api/stock-picks/paper 는 페이퍼 계좌만 내려준다. 다른 계좌 API 금지.
        expect(SRC).not.toMatch(/\/api\/(auto-?trad|account|balance)/i);
    });
});

describe('★지수 표기 — 지수에 원을 붙이지 않는다', () => {
    // 2026-08-28 서아에서 낸 사고를 그대로 옮겨 놓지 않기 위한 회귀.
    // ChaewonDeskEntry 의 indexValue 규칙을 그대로 옮겨 판정한다.
    const indexValue = (m: { valueKind?: string | null; price: number | null; proxy?: { name?: string } | null }) => {
        const fmt = (v: number | null, d = 0) =>
            v === null ? '—' : v.toLocaleString('ko-KR', { maximumFractionDigits: d });
        if (m.valueKind === 'etf') {
            return { text: m.price === null ? '—' : `${fmt(m.price)}원`,
                     cap: m.proxy?.name ? `대용: ${m.proxy.name}` : '대용 ETF(확인 필요)' };
        }
        return { text: fmt(m.price, 2), cap: '' };
    };

    it('지수는 원이 없다', () => {
        const r = indexValue({ valueKind: 'index', price: 6995.39 });
        expect(r.text).not.toContain('원');
        expect(r.text).toBe('6,995.39');
    });

    it('ETF 대용일 때만 원 + 대용 이름을 병기한다', () => {
        const r = indexValue({ valueKind: 'etf', price: 12345, proxy: { name: 'KODEX 200' } });
        expect(r.text).toBe('12,345원');
        expect(r.cap).toContain('KODEX 200');
    });

    it('대용인데 이름이 없으면 확인이 필요하다고 말한다', () => {
        expect(indexValue({ valueKind: 'etf', price: 100, proxy: null }).cap).toContain('확인 필요');
    });

    it('값이 없어도 죽지 않는다', () => {
        expect(indexValue({ valueKind: 'index', price: null }).text).toBe('—');
    });
});

describe('한국 증시 색 관례 — 상승 빨강, 하락 파랑', () => {
    const cls = (p: number | null) => (p === null || p === 0 ? 'flat' : p > 0 ? 'up' : 'down');
    const mark = (p: number | null) => (p === null || p === 0 ? '·' : p > 0 ? '▲' : '▼');

    it('오르면 ▲ up, 내리면 ▼ down', () => {
        expect([cls(4.61), mark(4.61)]).toEqual(['up', '▲']);
        expect([cls(-1.97), mark(-1.97)]).toEqual(['down', '▼']);
    });

    it('보합·미상은 중립으로 둔다', () => {
        expect(cls(0)).toBe('flat');
        expect(cls(null)).toBe('flat');
    });

    it('빨강이 up, 파랑이 down 에 붙어 있다', () => {
        expect(SRC).toContain('.cd-up{color:#ff6b74}');
        expect(SRC).toContain('.cd-down{color:#6aa9ff}');
    });
});

describe('요약 표 파싱', () => {
    // 실측 원문(그대로 복사) — 여기서 걸러내는 게 이 화면의 핵심이다.
    const summary = [
        '투자 요약',
        '| 구분 | 내용 |',
        '|------|------|',
        '| 투자의견 | **매수 (80점)** — 정제마진 강세 지속 |',
        '| 봇 추세 점수 | 65/80점 → 보류(HOLD) |',
        '| 목표주가 | 180,000 ~ 210,000원 |',
        '| 현재주가 | 158,300원 |',
        '| 상승여력 | 13.7% ~ 32.66% |',
        '| 핵심 리스크 | 지정학적 요인 |',
    ].join('\n');

    const DROP = /투자의견|봇 추세|매수|매도|추천/;
    const pickRows = (s: string): [string, string][] => {
        const out: [string, string][] = [];
        (s || '').split('\n').forEach(line => {
            const m = line.match(/^\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/);
            if (!m) return;
            const k = m[1].trim(), v = m[2].trim();
            if (!k || /^-+$/.test(k) || k === '구분' || DROP.test(k) || DROP.test(v)) return;
            out.push([k, v.replace(/\*\*/g, '')]);
        });
        return out.slice(0, 4);
    };

    it('★투자의견·봇 추세 행은 나오지 않는다', () => {
        const keys = pickRows(summary).map(r => r[0]);
        expect(keys).not.toContain('투자의견');
        expect(keys).not.toContain('봇 추세 점수');
    });

    it('어디에도 매수/추천이라는 말이 남지 않는다', () => {
        const flat = pickRows(summary).flat().join(' ');
        expect(flat).not.toMatch(/매수|매도|추천/);
    });

    it('참고 지표는 살린다', () => {
        const keys = pickRows(summary).map(r => r[0]);
        expect(keys).toContain('목표주가');
        expect(keys).toContain('현재주가');
        expect(keys).toContain('핵심 리스크');
    });

    it('표 머리글·구분선은 버린다', () => {
        expect(pickRows(summary).map(r => r[0])).not.toContain('구분');
    });

    it('요약이 비어도 죽지 않는다', () => {
        expect(pickRows('')).toEqual([]);
    });

    it('★금액에는 원이 그대로 남는다 — 지수가 아니다', () => {
        const rows = Object.fromEntries(pickRows(summary));
        expect(rows['현재주가']).toContain('원');
    });
});

describe('★일봉 캔들', () => {
    // 2026-09-07 실측 사고: 선을 0~160 끝까지 그렸더니 **오른쪽 끝이 잘렸다** —
    // 하필 거기가 "오늘 오른 지점"이라 제일 중요한 데가 안 보였다. PAD 는 그 재발방지다.
    //
    // 2026-09-08: 그래프가 `Math.sin` 으로 지어낸 가짜였다. 이제 실제 일봉만 그린다.
    // ★테스트는 **출하되는 함수**를 부른다 — 예전처럼 로직을 복사해 두면 소스가 바뀌어도
    //   테스트는 옛 사본만 통과시킨다(통과=검증 아님).
    const PAD = 6;

    /** 실측 코스피 일봉(2026-08-25~09-07, 네이버). */
    const REAL: OHLC[] = [
        { date: '2026-08-25', open: 6535.93, high: 6747.16, low: 6408.82, close: 6742.74 },
        { date: '2026-08-26', open: 6727.25, high: 6887.18, low: 6704.10, close: 6808.21 },
        { date: '2026-08-27', open: 6996.12, high: 6996.12, low: 6841.88, close: 6912.37 },
        { date: '2026-08-28', open: 6846.54, high: 6901.78, low: 6780.13, close: 6788.88 },
        { date: '2026-08-31', open: 6613.58, high: 6820.10, low: 6547.76, close: 6820.02 },
        { date: '2026-09-01', open: 6784.29, high: 6857.35, low: 6732.47, close: 6835.80 },
        { date: '2026-09-02', open: 6625.47, high: 6694.57, low: 6558.30, close: 6562.72 },
        { date: '2026-09-03', open: 6650.33, high: 6682.97, low: 6439.49, close: 6579.48 },
        { date: '2026-09-04', open: 6654.36, high: 6746.14, low: 6632.77, close: 6687.21 },
        { date: '2026-09-07', open: 6910.78, high: 6995.40, low: 6867.91, close: 6995.39 },
    ];

    it('열 개가 전부 여백 안에 들어간다', () => {
        const bars = buildCandles(REAL);
        expect(bars.length).toBe(10);
        for (const b of bars) {
            expect(b.x - b.w / 2).toBeGreaterThanOrEqual(PAD - 0.01);
            expect(b.x + b.w / 2).toBeLessThanOrEqual(160 - PAD + 0.01);
            // ★꼬리까지 재야 한다. 종가만 스케일하면 고가·저가가 칸 밖으로 삐져나간다.
            expect(b.highY).toBeGreaterThanOrEqual(PAD - 0.01);
            expect(b.lowY).toBeLessThanOrEqual(96 - PAD + 0.01);
            expect(b.bodyY).toBeGreaterThanOrEqual(PAD - 0.01);
            expect(b.bodyY + b.bodyH).toBeLessThanOrEqual(96 - PAD + 0.01);
        }
    });

    it('캔들이 서로 겹치지 않는다', () => {
        const bars = buildCandles(REAL);
        for (let i = 1; i < bars.length; i++) {
            expect(bars[i].x - bars[i].w / 2).toBeGreaterThanOrEqual(bars[i - 1].x + bars[i - 1].w / 2 - 0.01);
        }
    });

    it('양봉/음봉을 종가 기준으로 가른다 — 한국 관례(양봉=빨강)', () => {
        const bars = buildCandles(REAL);
        expect(bars[bars.length - 1].up).toBe(true);    // 09-07 시 6910.78 → 종 6995.39
        expect(bars[6].up).toBe(false);                 // 09-02 시 6625.47 → 종 6562.72
    });

    it('꼬리는 항상 몸통을 감싼다', () => {
        for (const b of buildCandles(REAL)) {
            expect(b.highY).toBeLessThanOrEqual(b.bodyY + 0.01);            // 위가 더 작은 y
            expect(b.lowY).toBeGreaterThanOrEqual(b.bodyY + b.bodyH - 0.01);
        }
    });

    it('도지(시가==종가)도 보이게 최소 높이를 준다', () => {
        const [b] = buildCandles([{ date: 'd', open: 100, high: 105, low: 95, close: 100 }]);
        expect(b.bodyH).toBeGreaterThanOrEqual(1);
    });

    it('전 구간 보합이어도 0으로 나누지 않는다', () => {
        const flat = buildCandles([
            { date: 'a', open: 100, high: 100, low: 100, close: 100 },
            { date: 'b', open: 100, high: 100, low: 100, close: 100 },
        ]);
        expect(flat.every(b => Number.isFinite(b.bodyY) && Number.isFinite(b.lowY))).toBe(true);
    });

    it('깨진 행은 버리고 나머지를 그린다', () => {
        const bars = buildCandles([
            { date: 'a', open: 100, high: 110, low: 95, close: 105 },
            { date: 'bad', open: 0, high: NaN, low: -1, close: 0 } as any,
        ]);
        expect(bars.length).toBe(1);
        expect(bars[0].date).toBe('a');
    });

    it('데이터가 없으면 빈 배열 — 지어내지 않는다', () => {
        expect(buildCandles([])).toEqual([]);
    });

    it('★소스에 사인파 가짜 그래프가 되살아나지 않았다', () => {
        expect(SRC).toContain('const PAD = 6');
        // 호출만 잡는다 — 사고 경위를 적어 둔 주석의 `Math.sin` 은 남겨야 재발을 막는다.
        expect(SRC).not.toMatch(/Math\.sin\(/);
        expect(SRC).toContain('/api/desk/candles');     // 실데이터를 부르는지
    });

    it('다 찍히면 멈춘다 — 무한 반복이 아니다', () => {
        expect(SRC).toContain('clearInterval');
        expect(SRC).toMatch(/}, 500\)/);                // 500ms = 1초에 두 개
    });
});

describe('가상매매 표시', () => {
    it('손실이어도 그대로 낸다', () => {
        // 실측 -1.9756% → "-1.98%". 숨기면 더 위험하다.
        const pct = -1.9756000000000014;
        expect(`${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`).toBe('-1.98%');
    });

    it('기록이 없으면 없다고 말한다', () => {
        expect(SRC).toContain('가상매매 기록이 아직 없습니다');
    });

    it('🔴★★보유 종목명은 내지 않는다 — 개수까지만', () => {
        // 사장 지시(2026-09-07): 수익률·손익은 지나간 성과지만 보유 종목은 **지금의
        // 포지션**이라, 페이퍼 계좌라도 회원에겐 매수 신호로 읽힌다.
        expect(SRC).not.toContain('paper.holdings ||');
        expect(SRC).not.toMatch(/holdings\s*\|\|\s*\[\]\)\.join/);
        expect(SRC).toContain('종목</b></>');          // 개수 표기는 남는다
    });

    it('★★화면 순서 — 살아있나 → 믿을만한가 → 뭘보나 → 내것도', () => {
        // 2026-09-07 사장 "위치도 중요한 거 같은데".
        // 회원의 질문 순서대로 답한다. 특히 **메뉴(결제)가 설득보다 앞에 오면 안 된다.**
        const at = (s: string) => { const i = SRC.indexOf(s); expect(i, `${s} 없음`).toBeGreaterThan(0); return i; };
        const 뉴스 = at('증권 탑뉴스');
        const 가상매매 = at('가상매매 성적');
        const 관심종목 = at('오늘의 AI 관심 종목');
        const 메뉴 = at('내 종목 분석');
        const 면책 = at('PLEASE READ');

        expect(가상매매, '가상매매는 뉴스 뒤').toBeGreaterThan(뉴스);
        expect(관심종목, '관심 종목은 가상매매 뒤').toBeGreaterThan(가상매매);
        expect(메뉴, '★메뉴(결제)는 설득 뒤에 온다').toBeGreaterThan(관심종목);
        expect(면책, '면책은 맨 아래').toBeGreaterThan(메뉴);
    });

    it('★가상매매를 관심 종목 뒤로 내리지 않는다', () => {
        // 한 번 그렇게 했다가 되돌렸다 — 관심 종목 카드가 표까지 달려 길어서
        // 그 아래는 스크롤 끝이다. 안 보이는 자리에 둔 신뢰의 근거는 없는 것과 같다.
        expect(SRC.indexOf('가상매매 성적')).toBeLessThan(SRC.indexOf('오늘의 AI 관심 종목'));
    });
});

describe('뉴스 탭 — 주식과 직결된 것만', () => {
    it('경제·증시 / 해외 / AI·기술 세 개다', () => {
        const keys = ['경제증시', '해외뉴스', 'AI기술'];
        for (const k of keys) expect(SRC).toContain(`'${k}'`);
        // 스포츠·날씨까지 넣으면 이 화면의 정체성이 흐려진다.
        expect(SRC).not.toContain("'스포츠'");
        expect(SRC).not.toContain("'날씨'");
    });

    it('탭을 눌러도 다시 부르지 않는다', () => {
        // setTab 만 하고 fetch 는 마운트 때 한 번뿐이어야 한다.
        const effects = SRC.match(/useEffect\(/g) ?? [];
        expect(effects.length).toBeLessThanOrEqual(3);   // 데이터·Esc·그래프
        expect(SRC).not.toMatch(/useEffect\([^)]*\[\s*tab\s*\]/);
    });
});

describe('한 API가 죽어도 화면은 산다', () => {
    it('각 fetch 가 따로 실패를 잡는다', () => {
        const catches = SRC.match(/\.catch\(\(\) => alive && fail\(/g) ?? [];
        expect(catches.length).toBeGreaterThanOrEqual(3);
        expect(SRC).toContain('일부 데이터를 불러오지 못했습니다');
    });

    it('언마운트 뒤에는 상태를 건드리지 않는다', () => {
        expect(SRC).toContain('let alive = true');
        expect(SRC).toContain('return () => { alive = false; };');
    });
});
