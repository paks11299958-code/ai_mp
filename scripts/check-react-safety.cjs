#!/usr/bin/env node
/**
 * React 런타임 사고 정적 검사 — tsc/빌드는 통과하지만 화면을 죽이는 패턴을 잡는다.
 *
 * 배경(2026-07-28 실사고): 퀵메뉴 딥링크 useEffect를 조기 return 뒤에 넣어 React #310으로
 * 앱 전체가 백지가 됐다. 타입체크·빌드 모두 통과해서 배포 후 사장이 발견했다.
 * "빌드 통과 = 안전"이 아니라는 걸 전제로, 정적으로 잡을 수 있는 것만이라도 걸러낸다.
 *
 * 사용: node scripts/check-react-safety.cjs  (문제 발견 시 exit 1 → Vercel 빌드 중단)
 *
 * ※ 정적 검사의 한계: 조건부 API 호출 실수, 잘못된 데이터 접근 등 런타임 오류는 못 잡는다.
 *   그건 scripts/smoke-test.cjs(실제 브라우저 렌더 검증)가 담당한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

const HOOK_RE = /^\s+(useEffect|useState|useCallback|useMemo|useRef|useLayoutEffect|useReducer|useContext)\s*\(/;
const EARLY_IF_RE = /^\s{4}if\s*\(.+\)\s*\{?\s*$/;

const problems = [];

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.tsx$/.test(e.name)) out.push(p);
    }
    return out;
}

// ── 검사 1: 훅이 조기 return 뒤에 있는가 (React #310 = 화면 백지) ──────────────
// ★한 파일에 컴포넌트가 여러 개면 각각 독립적으로 봐야 한다. 앞 컴포넌트의 조기 return과
//   뒤 컴포넌트의 훅을 엮으면 전부 오탐이 된다(HomepageEditPanel에서 실제로 겪음).
const COMPONENT_START_RE = /^(export\s+)?(const|function)\s+[A-Z][A-Za-z0-9_]*\s*[:=(]/;

function checkHookOrder(file, lines, rel) {
    // 컴포넌트 시작 지점들로 파일을 구간 분할
    const starts = [];
    lines.forEach((l, i) => { if (COMPONENT_START_RE.test(l)) starts.push(i); });
    if (!starts.length) return;
    starts.push(lines.length);

    for (let s = 0; s < starts.length - 1; s++) {
        const from = starts[s], to = starts[s + 1];
        let earlyReturn = -1;
        for (let i = from; i < to; i++) {
            if (!EARLY_IF_RE.test(lines[i])) continue;
            const look = lines.slice(i + 1, Math.min(i + 4, to)).join('\n');
            if (/^\s+return\s*(\(|<|null)/m.test(look)) { earlyReturn = i + 1; break; }
        }
        if (earlyReturn < 0) continue;
        for (let i = earlyReturn; i < to; i++) {
            if (HOOK_RE.test(lines[i])) {
                problems.push({
                    rel, line: i + 1, kind: 'hook-after-early-return',
                    msg: `훅이 같은 컴포넌트의 조기 return(${earlyReturn}행) 뒤에 있음 → React #310으로 화면이 백지가 됩니다`,
                    code: lines[i].trim().slice(0, 70),
                });
            }
        }
    }
}

// ── 검사 2: 옵셔널 필드에 .을 바로 붙였는가 (undefined 접근 → 렌더 크래시) ─────
// User.email·phone 등 스키마상 옵셔널인데 `user.email.split()`처럼 쓰면 특정 계정만 죽는다
// (2026-07-28 실제로 전화가입자 크래시 위험 발견해 옵셔널 체이닝으로 고침).
const OPTIONAL_FIELDS = ['email', 'phone', 'quickMenuJson', 'introVideoUrl', 'imageUrl', 'description'];
function checkOptionalAccess(file, lines, rel) {
    lines.forEach((l, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
        for (const f of OPTIONAL_FIELDS) {
            // user.email.split(...) 처럼 옵셔널 필드 뒤에 바로 메서드/프로퍼티 접근
            const re = new RegExp(`\\.${f}\\.(?!\\.)[a-zA-Z_]`);
            if (re.test(l) && !new RegExp(`\\.${f}\\?\\.`).test(l)) {
                problems.push({
                    rel, line: i + 1, kind: 'optional-field-unguarded',
                    msg: `옵셔널 필드 .${f} 에 직접 접근 → 값이 없는 계정에서 렌더가 죽습니다(?. 사용)`,
                    code: l.trim().slice(0, 70),
                });
            }
        }
    });
}

// ── 검사 3: 기능 키 4곳 등록 정합성 (딥링크가 조용히 채팅으로 폴백) ────────────
function checkFeatureKeys() {
    const mainPath = path.join(FRONTEND, 'components/MainPageNew.tsx');
    const appPath = path.join(FRONTEND, 'App.tsx');
    const refPath = path.join(FRONTEND, 'services/referral.ts');
    if (![mainPath, appPath, refPath].every(fs.existsSync)) return;

    const m = fs.readFileSync(mainPath, 'utf8');
    const a = fs.readFileSync(appPath, 'utf8');
    const r = fs.readFileSync(refPath, 'utf8');

    const slice = (src, startMark, endMark = '};') => {
        const s = src.indexOf(startMark);
        if (s < 0) return '';
        const e = src.indexOf(endMark, s);
        return src.slice(s, e < 0 ? undefined : e);
    };

    const gridBlock = slice(m, 'export const FEATURES_GRID', '];');
    const gridKeys = [...gridBlock.matchAll(/key:\s*'([^']+)'/g)].map(x => x[1]);
    if (!gridKeys.length) return;

    const openers = [...slice(a, 'const featureBoardOpeners').matchAll(/^\s*'?([a-zA-Z-]+)'?:\s*\(\)/gm)].map(x => x[1]);
    const quick = [...slice(a, 'FEATURE_QUICK_MENU_LABEL: Record').matchAll(/^\s*'?([a-zA-Z-]+)'?:\s*'/gm)].map(x => x[1]);
    const labels = [...slice(r, 'FEATURE_SHARE_LABELS').matchAll(/'?([a-zA-Z-]+)'?:\s*'/g)].map(x => x[1]);
    const synonyms = [...slice(m, 'FEATURE_SYNONYMS', '\n};').matchAll(/^\s*'?([a-zA-Z-]+)'?:\s*\[/gm)].map(x => x[1]);

    // 진입 경로가 코드에 특별 분기로 처리되는 키(웹툰·타로)는 예외
    const SPECIAL = ['webtoon', 'tarot'];

    for (const k of gridKeys) {
        if (!SPECIAL.includes(k) && !openers.includes(k) && !quick.includes(k)) {
            problems.push({ rel: 'frontend/App.tsx', line: 0, kind: 'feature-no-entry',
                msg: `기능 '${k}' 진입경로 없음 → ?f=${k} 공유링크가 엉뚱한 채팅으로 폴백됩니다`, code: '' });
        }
        if (!labels.includes(k)) {
            problems.push({ rel: 'frontend/services/referral.ts', line: 0, kind: 'feature-no-share-label',
                msg: `기능 '${k}' 공유 제목 누락 → 공유 시 밋밋한 서비스명으로 나갑니다`, code: '' });
        }
        if (!synonyms.includes(k)) {
            problems.push({ rel: 'frontend/components/MainPageNew.tsx', line: 0, kind: 'feature-no-synonym',
                msg: `기능 '${k}' 검색 동의어 누락 → 사용자가 검색으로 못 찾습니다`, code: '' });
        }
    }
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
const files = fs.existsSync(FRONTEND) ? walk(FRONTEND) : [];
for (const f of files) {
    const rel = path.relative(ROOT, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    checkHookOrder(f, lines, rel);
    checkOptionalAccess(f, lines, rel);
}
checkFeatureKeys();

if (!problems.length) {
    console.log(`✅ React 안전 검사 통과 (${files.length}개 파일: 훅 순서 / 옵셔널 접근 / 기능키 정합성)`);
    process.exit(0);
}

const byKind = problems.reduce((acc, p) => { (acc[p.kind] ??= []).push(p); return acc; }, {});
console.error(`\n❌ React 안전 검사 실패 — ${problems.length}건\n`);
for (const [kind, list] of Object.entries(byKind)) {
    console.error(`[${kind}] ${list.length}건`);
    list.slice(0, 8).forEach(p => {
        console.error(`  ${p.rel}${p.line ? ':' + p.line : ''}`);
        console.error(`    ${p.msg}`);
        if (p.code) console.error(`    > ${p.code}`);
    });
    if (list.length > 8) console.error(`  ... 외 ${list.length - 8}건`);
    console.error('');
}
process.exit(1);
