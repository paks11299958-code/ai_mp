#!/usr/bin/env node
/**
 * React 훅 순서 정적 검사 — App.tsx처럼 "조기 return이 여러 개 있는 큰 컴포넌트"에서
 * 훅이 조기 return 뒤에 추가되는 사고를 잡는다.
 *
 * 배경(2026-07-28 실사고): 퀵메뉴 딥링크 useEffect를 `if (screen === 'main')` 바로 위에
 * 넣었는데, 그보다 앞에 resetToken/isAuthChecking/screen==='authPage' 조기 return이
 * 이미 있었다. 인증 상태에 따라 훅 개수가 달라져 React #310으로 앱 전체가 백지가 됐다.
 * tsc/빌드는 모두 통과하므로 정적 검사로만 잡힌다.
 *
 * 사용: node scripts/check-hook-order.cjs   (실패 시 exit 1)
 */
const fs = require('fs');
const path = require('path');

const TARGETS = ['frontend/App.tsx'];
const HOOK_RE = /^\s+(useEffect|useState|useCallback|useMemo|useRef|useLayoutEffect|useReducer|useContext)\s*\(/;
// 컴포넌트 본문(들여쓰기 4칸) 레벨의 조기 return만 본다
const EARLY_RETURN_RE = /^\s{4}if\s*\(.+\)\s*\{?\s*$/;

let failed = false;

for (const rel of TARGETS) {
    const file = path.join(__dirname, '..', rel);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');

    // 첫 조기 return 위치 찾기 (if 블록 안에 return ( 또는 return < 가 있는 것)
    let firstEarlyReturn = -1;
    for (let i = 0; i < lines.length; i++) {
        if (!EARLY_RETURN_RE.test(lines[i])) continue;
        const lookahead = lines.slice(i + 1, i + 4).join('\n');
        if (/^\s+return\s*(\(|<|null)/m.test(lookahead)) { firstEarlyReturn = i + 1; break; }
    }
    if (firstEarlyReturn < 0) continue;

    const offenders = [];
    for (let i = firstEarlyReturn; i < lines.length; i++) {
        if (HOOK_RE.test(lines[i])) offenders.push({ line: i + 1, text: lines[i].trim().slice(0, 70) });
    }

    if (offenders.length) {
        failed = true;
        console.error(`\n❌ ${rel}: 조기 return(${firstEarlyReturn}행) 뒤에 훅이 ${offenders.length}개 있습니다.`);
        console.error('   → 렌더마다 훅 개수가 달라져 React #310으로 화면이 백지가 됩니다.');
        offenders.slice(0, 10).forEach(o => console.error(`   ${o.line}: ${o.text}`));
    } else {
        console.log(`✅ ${rel}: 모든 훅이 첫 조기 return(${firstEarlyReturn}행)보다 위에 있습니다.`);
    }
}

process.exit(failed ? 1 : 0);
