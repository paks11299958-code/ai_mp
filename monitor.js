/**
 * Site Monitor — 3시간마다 crontab으로 실행
 * 1. 사이트 열림 확인 (HTTP 상태)
 * 2. 로그인 + 페르소나 목록 확인
 * 3. 주식자동매매(토스봇) — pm2 생존 + 정지(halt) 여부 + 발굴 기준일  ← 2026-08-05 신설
 * 4. 헤르메스 — 리스너 프로세스 생존 + 텔레그램 봇 유효                ← 2026-08-05 신설
 * 5. DB — 서버1 PostgreSQL 컨테이너 + 실제 질의 응답                   ← 2026-08-05 신설
 * 6. 서버 자원 — 서버1/서버2 디스크·메모리·스왑                        ← 2026-08-05 신설
 * 결과를 **텔레그램**으로 발송 + 스크린샷 첨부
 *
 * ★3~6번을 추가한 이유(2026-08-05 사장 지시): 기존엔 "사이트가 열리는지"만 봤다.
 *   그런데 실제로 조용히 멎었던 것들은 전부 그 바깥이었다 — 토스봇이 손실한도로
 *   HALT됐는데 알림 0건(07-31), 헤르메스가 OOM으로 죽어 무응답(07-29·07-30),
 *   서버2 스왑 고갈로 크론이 통째로 얼어붙음(07-30). 사이트는 그동안 계속 200이었다.
 *   ★"정상일 때도 매번 전체 요약"을 보내는 이유도 같다 — 알림이 안 오는 것이
 *   정상인지 감시가 죽은 건지 구분할 수 없으면 감시가 아니다.
 *
 * ★알림 경로를 Brevo 이메일 → 텔레그램으로 교체(2026-07-31 사장 결정).
 *   Brevo가 서버 IP를 인식 못 해 401로 계속 실패하고 있었다:
 *     "unrecognised IP address 34.50.63.45"
 *   점검 자체는 정상 동작했지만 **결과가 전달되지 않아** "알림이 없다"가
 *   "정상이다"를 뜻하지 못하는 상태였다 — 감시의 존재 이유가 무너진다.
 *   텔레그램은 IP 화이트리스트가 없어 서버 IP가 바뀌어도 계속 동작한다.
 *
 * 실행: node /home/paks11299958/ai_mp/monitor.js
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// ── 설정 ──────────────────────────────────────────────
const TARGET_URL       = 'https://aichat.dbzone.kr';
const SCREENSHOT_PATH  = path.join(__dirname, 'site_status.png');
// 점검 결과 요약 — 어드민 대시보드가 "마지막 실행 시각/성공여부"를 읽는다
const STATUS_PATH      = path.join(__dirname, 'monitor-status.json');
const TIMEOUT_MS       = 15_000;
const MONITOR_EMAIL    = process.env.MONITOR_EMAIL;
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD;
const TG_TOKEN         = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT          = process.env.TELEGRAM_CHAT_ID;

// ★IPv4 강제(2026-07-31 실측). 이 서버는 IPv6 경로가 막혀 있는데(curl -6 = 실패)
//   api.telegram.org는 AAAA 레코드를 준다. curl은 IPv4로 폴백해 성공하지만 node의
//   fetch는 폴백하지 못하고 ETIMEDOUT으로 죽는다 — "fetch failed"의 정체가 이것이다.
//   dns.setDefaultResultOrder('ipv4first')로는 안 잡히고, undici 커넥트 옵션이어야 한다.
const { Agent } = require('undici');
const ipv4Agent = new Agent({ connect: { family: 4 } });

// ── 확장 점검 설정(2026-08-05) ────────────────────────
const SERVER1        = 'paks11299958@10.178.0.2';   // 운영 서버(내부 IP). SSH 키 기반, alert_monitor.py와 동일 경로
const SSH_TIMEOUT_MS = 20_000;
const TOSS_DIR       = '/home/paks11299958/toss_trader';
const HERMES_PROC    = 'telegram_listener.py';      // 서버2 supervisor: hermes-listener
const RAG_ENV_PATH   = '/home/paks11299958/rag/.env';
// ★PostgreSQL 컨테이너는 **2개**다(2026-08-05 사장 지적으로 확인). 하나만 보면
//   타입봇 DB가 죽어도 'DB 정상'이라고 보고하게 된다 — 둘 다 실제 질의로 확인한다.
//   ①n8n-docker-db-1        : aichat(331MB)·company_wiki·n8n_db·golf_db·insure_db·ai_chat_auto
//   ②n8n-docker-typebot-db-1: typebot 전용
// 계정이 컨테이너마다 다르다(aichat_user vs postgres) — 운영이 실제 쓰는 계정으로 붙어야
// 권한까지 함께 검증된다. 질의는 각 DB에서 '반드시 있는' 대상을 센다.
const DB_TARGETS = [
    {
        label: '메인DB', container: 'n8n-docker-db-1', user: 'aichat_user', db: 'aichat',
        // shared-api DATABASE_URL 과 동일 계정. 회원 수는 사장이 눈으로 이상을 알아채는 지표이기도 하다.
        sql: 'select count(*) from "User"', unit: '회원', suffix: '명',
    },
    {
        label: '타입봇DB', container: 'n8n-docker-typebot-db-1', user: 'postgres', db: 'typebot',
        // 테이블명이 버전따라 바뀔 수 있어 특정 테이블 대신 카탈로그를 센다(구조 변경에 안 깨짐).
        sql: "select count(*) from pg_stat_user_tables", unit: '테이블', suffix: '개',
    },
];

// AI 스튜디오 서버3 — ★다른 서버와 판정 기준이 정반대다.
// 서버1·2 는 "꺼져 있으면 장애"지만, 서버3 은 **꺼져 있는 것이 정상**이다
// (필요할 때만 켜는 온디맨드 GPU). 그래서 '켜져 있음'을 눈에 띄게 알리는 게 목적 —
// 끄는 걸 잊으면 시간당 1,260원이 계속 나간다.
const AI_STUDIO_IP = '10.178.0.5';

// n8n·타입봇(2026-08-05 추가 지시). 컨테이너 Up 과 웹 응답을 **둘 다** 본다 —
// Up 인데 앱이 안 뜨는 구간이 실제로 있고(컨테이너는 살아도 프로세스가 멎음),
// 반대로 웹만 보면 Nginx 캐시/오류페이지에 속을 수 있다.
const DOCKER_SERVICES = [
    { label: 'n8n',        container: 'n8n-docker-n8n-1',             url: 'https://n8n.dbzone.kr'  },
    { label: '타입봇빌더',  container: 'n8n-docker-typebot-builder-1', url: 'https://chat.dbzone.kr' },
    { label: '타입봇뷰어',  container: 'n8n-docker-typebot-viewer-1',  url: 'https://bot.dbzone.kr'  },
];
// 자원 임계 — alert_monitor.py THRESHOLDS와 같은 기준을 쓴다(두 감시가 다른 말을 하면 안 됨)
const DISK_WARN = 80, DISK_CRIT = 90, MEM_WARN = 85, SWAP_WARN = 85, SWAP_CRIT = 95;
// ──────────────────────────────────────────────────────

/**
 * 텔레그램 알림. 장애일 때만 스크린샷을 붙인다(정상 보고까지 이미지를 보내면
 * 알림이 무거워져 정작 장애 알림을 흘려보게 된다).
 * ★던지지 않고 false를 반환한다 — 발송 실패가 점검 결과 기록(monitor-status.json)까지
 *   막으면 안 된다. 예전 Brevo판은 여기서 throw해 크론이 통째로 죽었다.
 */
async function sendTelegram({ text, screenshotPath }) {
    if (!TG_TOKEN || !TG_CHAT) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN/CHAT_ID 없음 — 알림 건너뜀');
        return false;
    }

    const api = (m) => `https://api.telegram.org/bot${TG_TOKEN}/${m}`;
    try {
        if (screenshotPath && fs.existsSync(screenshotPath)) {
            // 사진 + 캡션을 한 번에 보낸다(캡션 상한 1024자).
            const form = new FormData();
            form.append('chat_id', TG_CHAT);
            form.append('parse_mode', 'HTML');
            form.append('caption', text.slice(0, 1024));
            form.append('photo', new Blob([fs.readFileSync(screenshotPath)]), 'site_status.png');
            const res = await fetch(api('sendPhoto'), { method: 'POST', body: form, dispatcher: ipv4Agent });
            if (res.ok) return true;
            console.error(`⚠️ 사진 발송 실패(${res.status}) — 텍스트로 폴백`);
        }
        const res = await fetch(api('sendMessage'), {
            method:     'POST',
            headers:    { 'Content-Type': 'application/json' },
            body:       JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
            dispatcher: ipv4Agent,
        });
        if (!res.ok) {
            console.error(`⚠️ 텔레그램 발송 실패 (${res.status}): ${await res.text().catch(() => '')}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`⚠️ 텔레그램 발송 예외: ${e.message}`);
        return false;
    }
}

/** 명령 실행 헬퍼. 실패해도 던지지 않고 {ok, out, err}를 준다 —
 *  점검 하나가 실패해도 나머지 보고까지 죽으면 안 된다. */
function run(cmd, args, timeout = SSH_TIMEOUT_MS) {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
            resolve({ ok: !err, out: (stdout || '').trim(), err: (stderr || err?.message || '').trim() });
        });
    });
}

/** 서버1에서 원격 명령 실행. ControlMaster=no는 alert_monitor.py와 동일 —
 *  공유 커넥션 캐시가 만료돼 있으면 조용히 매달리는 일이 있었다. */
function ssh1(script) {
    return run('ssh', ['-o', 'ControlMaster=no', '-o', 'ConnectTimeout=10',
                       '-o', 'BatchMode=yes', SERVER1, script]);
}

/**
 * ── Check 3: 주식자동매매(토스봇) ─────────────────────
 * 사장 선택(2026-08-05) = "생존 + 정지여부" 수준. 잔고·손익은 넣지 않는다
 * (3시간마다 오면 알림이 길어져 정작 이상징후를 흘려보게 된다).
 *
 * ★halt=true 는 프로세스가 online 이어도 **매매를 안 하고 있는 상태**다.
 *   07-31 손실한도 HALT 때 아무도 몰랐던 게 정확히 이 구간이라 online 만
 *   보면 안 되고 selection.json 의 halt 를 같이 읽어야 한다.
 * ★발굴 기준일(autoScanDate)도 함께 보고한다 — 발굴 스캔은 장마감 후
 *   KST 16시 이후 하루 1회라, 오전에 보이는 선택 종목은 정상적으로 '어제 것'이다.
 *   날짜를 안 보여주면 이게 멎은 건지 설계대로인지 구분할 수 없다.
 */
async function checkTossTrader() {
    // pm2 상태 + selection.json 을 한 번의 SSH 로 (왕복 줄이기)
    const r = await ssh1(
        `cd ~/shared-api && node_modules/.bin/pm2 jlist 2>/dev/null; ` +
        `echo '---SPLIT---'; cat ${TOSS_DIR}/logs/selection.json 2>/dev/null; ` +
        // 페이퍼 실험 현황(2026-08-05 손절5%·익절3% 관찰) — 체결이 나오면 알려야 한다.
        // ★봇에 체결 알림 경로가 아예 없어(notify.py 는 HALT 전용) 첫 거래가 나도
        //   로그를 뒤지기 전엔 아무도 모른다. 관찰이 목적인데 관찰 수단이 없던 셈.
        `echo '---SPLIT---'; cat ${TOSS_DIR}/logs/pnl_ledger_paper.json 2>/dev/null; ` +
        `echo '---SPLIT---'; grep -c '주문 성공' ${TOSS_DIR}/logs/orders_paper.log 2>/dev/null || echo 0`
    );
    if (!r.ok) return { ok: false, detail: `서버1 SSH 실패: ${r.err.slice(0, 120)}` };

    const [jlistRaw, selRaw, paperLedgerRaw, paperFillsRaw] = r.out.split('---SPLIT---');
    let procs;
    try {
        procs = JSON.parse((jlistRaw || '').trim());
    } catch {
        return { ok: false, detail: 'pm2 jlist 파싱 실패 — pm2 데몬 확인 필요' };
    }

    const find = (name) => procs.find((p) => p.name === name);
    const live  = find('toss-trader');
    const paper = find('toss-trader-paper');

    if (!live) return { ok: false, detail: 'pm2에 toss-trader 프로세스가 없음(미기동)' };

    const liveStatus  = live.pm2_env?.status ?? 'unknown';
    const paperStatus = paper?.pm2_env?.status ?? '없음';

    // 정지(halt) 여부 — selection.json 이 정본
    let halt = null, scanDate = null;
    try {
        const sel = JSON.parse((selRaw || '').trim());
        halt     = sel.halt === true;
        scanDate = sel.autoScanDate || null;
    } catch { /* 파일이 아직 없을 수 있다(첫 기동 전) — null 로 두고 아래에서 표기 */ }

    const parts = [`실봇 ${liveStatus}`, `페이퍼 ${paperStatus}`];
    if (halt === true)       parts.push('🛑 정지(halt=true)');
    else if (halt === false) parts.push('매매가동(halt=false)');
    else                     parts.push('⚠️ selection.json 없음');
    if (scanDate) parts.push(`발굴기준일 ${scanDate}`);

    // ── 페이퍼 실험 현황(손절5%·익절3%·임계70 관찰, 2026-08-05~) ──
    // 체결이 0건이면 "아직"이라고만 적고, 나오기 시작하면 건수·손익을 싣는다.
    // 실봇 적용 여부를 이 숫자로 판단하기로 했으므로(사장 결정) 눈에 보여야 한다.
    const fills = parseInt((paperFillsRaw || '').trim(), 10);
    let paperPnl = null;
    try {
        const led = JSON.parse((paperLedgerRaw || '').trim());
        paperPnl = Number(led.realizedPnlKrw ?? 0);
    } catch { /* 거래 전이면 파일 자체가 없다 — 정상 */ }

    if (Number.isFinite(fills) && fills > 0) {
        const pnlTxt = paperPnl == null ? '' :
            ` 손익 ${paperPnl > 0 ? '+' : ''}${Math.round(paperPnl).toLocaleString('ko-KR')}원`;
        parts.push(`📝페이퍼실험 체결 ${fills}건${pnlTxt}`);
    } else {
        parts.push('📝페이퍼실험 체결 아직 0건');
    }

    // online 이어도 halt 면 정상이 아니다 — 실제로 매매를 안 하고 있는 상태다.
    // ★페이퍼 체결 수는 판정에 넣지 않는다 — 0건은 '이상'이 아니라 관찰 대기 상태다.
    const ok = liveStatus === 'online' && halt === false;
    return { ok, detail: parts.join(' · ') };
}

/**
 * ── Check 4: 헤르메스 ─────────────────────────────────
 * ①리스너 프로세스 생존 ②텔레그램 봇 토큰 유효.
 *
 * ★getUpdates 는 절대 호출하지 않는다 — 폴링을 리스너에게서 빼앗아
 *   409 Conflict 를 유발해, 감시가 감시 대상을 망가뜨리게 된다. getMe 만 쓴다.
 * ★프로세스 생존만으로는 부족하다는 걸 07-29 사고가 보여줬지만(살아있어도
 *   plan()에서 응답을 버리고 있었다), 3시간 주기 점검에서 실제 대화를 시켜볼
 *   수는 없다. 여기서 잡으려는 건 '죽어서 무응답'이고, 논리 버그는 몫이 다르다.
 */
async function checkHermes() {
    // ★`pgrep -f 이름` 은 쓰지 않는다 — 패턴이 **자기 명령줄에도 매칭**돼(셸·grep·
    //   백업 스크립트가 그 문자열을 달고 있으면) 리스너가 죽어도 '살아있다'고
    //   오판한다. 실측으로 확인: 존재하지 않는 이름을 넣었는데 3건이 잡혔다.
    //   대신 `python 인터프리터로 실행 중이고 인자에 그 스크립트가 있는 것`만 센다.
    const p = await run('ps', ['-eo', 'pid=,args='], 5_000);
    const pids = p.out.split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes(HERMES_PROC) && /(^|\/)(python|python3)[0-9.]*\s/.test(l.replace(/^\d+\s+/, ' ')))
        .map((l) => l.split(/\s+/)[0]);
    if (pids.length === 0) {
        return { ok: false, detail: `리스너 프로세스 없음 — sudo supervisorctl restart hermes-listener 필요` };
    }
    // ★중복 실행은 그 자체가 장애다 — 두 프로세스가 같은 봇을 폴링하면
    //   409 Conflict 로 서로를 밀어내 결국 아무도 응답하지 못한다.
    if (pids.length > 1) {
        return { ok: false, detail: `리스너 ${pids.length}개 중복 실행(409 유발) — pid ${pids.join(',')}` };
    }

    // 봇 토큰 유효성 — 토큰이 죽으면 프로세스가 살아도 아무 말도 못 받는다.
    let token = process.env.TELEGRAM_BOT_TOKEN;
    try {
        const m = fs.readFileSync(RAG_ENV_PATH, 'utf8').match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
        if (m) token = m[1].trim();
    } catch { /* rag/.env 를 못 읽으면 shared-api 쪽 토큰으로 폴백 */ }

    if (!token) return { ok: true, detail: `리스너 실행 중(pid ${pids[0]}) · 봇 토큰 미확인` };

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`,
                                { dispatcher: ipv4Agent, signal: AbortSignal.timeout(10_000) });
        const j = await res.json().catch(() => ({}));
        if (!j.ok) return { ok: false, detail: `리스너는 실행 중이나 봇 토큰 무효(${res.status})` };
        return { ok: true, detail: `리스너 실행 중(pid ${pids[0]}) · 봇 @${j.result?.username} 정상` };
    } catch (e) {
        return { ok: false, detail: `리스너 실행 중이나 텔레그램 API 확인 실패: ${e.message}` };
    }
}

/**
 * ── Check 5: DB ──────────────────────────────────────
 * 서버1 Docker PostgreSQL. ★pg_isready 만 보면 안 된다 —
 * work_lessons 의 'pg_isready 오탐' 교훈대로 준비됐다고 답하면서 실제 질의는
 * 실패하는 구간이 있다. 그래서 실제 SELECT 를 한 번 던져 응답까지 확인한다.
 */
async function checkDatabase() {
    // 컨테이너 2개를 각각 확인한다. 하나가 죽어도 나머지는 계속 점검해야 하므로
    // 개별 실패를 삼키지 않고 각자 결과로 남긴다.
    const out = {};
    await Promise.all(DB_TARGETS.map(async (t) => {
        const r = await ssh1(
            `docker exec ${t.container} psql -U ${t.user} -d ${t.db} -tAc "${t.sql.replace(/"/g, '\\"')}" 2>&1`
        );
        if (!r.ok) {
            out[t.label] = { ok: false, detail: `질의 실패: ${(r.out || r.err).slice(0, 130)}` };
            return;
        }
        // psql 은 경고를 앞줄에 흘릴 수 있어 마지막 비어있지 않은 줄을 값으로 본다.
        const line = r.out.split('\n').map((s) => s.trim()).filter(Boolean).pop() || '';
        if (!/^\d+$/.test(line)) {
            out[t.label] = { ok: false, detail: `응답 이상: ${line.slice(0, 130)}` };
            return;
        }
        out[t.label] = {
            ok: true,
            detail: `${t.db} 응답 정상 (${t.unit} ${Number(line).toLocaleString('ko-KR')}${t.suffix})`,
        };
    }));
    return out;
}

/**
 * ── Check 7: n8n · 타입봇 ─────────────────────────────
 * 컨테이너 생존(docker ps) + 실제 웹 응답(HTTP)을 함께 본다.
 *
 * ★3xx 를 실패로 보지 않는다 — 타입봇 빌더는 비로그인 접근에 307 로
 *   /signin 으로 보내는 게 **정상 동작**이다(실측 확인). 4xx/5xx 만 장애로 센다.
 */
async function checkDockerServices() {
    const r = await ssh1(`docker ps --format '{{.Names}}\t{{.Status}}'`);
    const upMap = new Map();
    if (r.ok) {
        for (const line of r.out.split('\n')) {
            const [name, status] = line.split('\t');
            if (name) upMap.set(name.trim(), (status || '').trim());
        }
    }

    const out = {};
    await Promise.all(DOCKER_SERVICES.map(async ({ label, container, url }) => {
        if (!r.ok) {
            out[label] = { ok: false, detail: `서버1 docker 조회 실패: ${r.err.slice(0, 80)}` };
            return;
        }
        const status = upMap.get(container);
        if (!status || !/^Up\b/.test(status)) {
            out[label] = { ok: false, detail: `컨테이너 미기동(${status || '없음'})` };
            return;
        }

        // 웹 응답 — 리다이렉트는 따라가지 않고 코드만 본다(3xx 자체가 정상 신호일 수 있다).
        let web;
        try {
            const res = await fetch(url, {
                method: 'GET', redirect: 'manual',
                dispatcher: ipv4Agent, signal: AbortSignal.timeout(12_000),
            });
            web = res.status >= 400
                ? { ok: false, note: `HTTP ${res.status}` }
                : { ok: true,  note: `HTTP ${res.status}` };
        } catch (e) {
            web = { ok: false, note: `접속 실패(${e.message.slice(0, 60)})` };
        }

        out[label] = {
            ok: web.ok,
            detail: web.ok ? `${status} · ${web.note}` : `컨테이너는 ${status} 이나 웹 ${web.note}`,
        };
    }));
    return out;
}

/**
 * ── Check 8: AI 스튜디오(서버3) ───────────────────────────
 * ★"꺼져 있음"이 정상이고 "켜져 있음"이 주의 신호다.
 *   07-31 토스봇 HALT 알림 0건 사고와 같은 계열 — 상태가 평소와 다를 때
 *   반드시 눈에 띄어야 한다. 여기선 '켜져 있다'가 그 상태다.
 * ★ok 판정: 꺼져 있으면 ok(정상). 켜져 있어도 ok 로 두되 문구로 드러낸다 —
 *   일하려고 켠 것일 수 있으므로 '장애'로 보고하면 거짓 경보가 된다.
 */
async function checkAiStudio() {
    // SSH 로 살아있는지 + 큐/가동시간 확인. 꺼져 있으면 접속 자체가 실패한다.
    const r = await run('ssh', ['-o', 'ControlMaster=no', '-o', 'ConnectTimeout=8',
                                '-o', 'BatchMode=yes', `paks11299958@${AI_STUDIO_IP}`,
        `up=$(awk '{print int($1/60)}' /proc/uptime); ` +
        `q=$(curl -s -m 3 http://127.0.0.1:8188/queue 2>/dev/null | ` +
        `python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('queue_running',[]))+len(d.get('queue_pending',[])))" 2>/dev/null || echo '?'); ` +
        `w=$(systemctl is-active gpu-worker 2>/dev/null); ` +
        `echo "$up|$q|$w"`], 20_000);

    if (!r.ok) {
        // 접속 실패 = 꺼져 있음. 이게 기본 상태이므로 정상으로 본다.
        return { ok: true, detail: '⚫ 꺼짐(정상 — 필요할 때만 켜는 서버)' };
    }
    const [upRaw, queue, worker] = (r.out.trim().split('\n').pop() || '').split('|');
    const up = parseInt(upRaw, 10);
    const parts = [`🟡 **가동 중** ${Number.isFinite(up) ? `${Math.floor(up / 60)}시간 ${up % 60}분째` : ''}`];
    parts.push(`큐 ${queue === '?' ? '확인불가' : `${queue}건`}`);
    parts.push(`워커 ${worker || '?'}`);
    // 시간당 약 1,260원 — 얼마나 쓰고 있는지 바로 보이게 한다
    if (Number.isFinite(up)) parts.push(`누적 약 ${Math.round(up / 60 * 1260).toLocaleString('ko-KR')}원`);
    return { ok: true, detail: parts.join(' · ') };
}

/** /proc/meminfo·df 파싱 결과를 한 줄 요약 + 이상여부로 변환. 서버1·2 공용. */
function summarizeResources(label, { diskPct, memPct, swapPct, swapUsedMb }) {
    const flags = [];
    if (diskPct >= DISK_CRIT)  flags.push(`🔴디스크 ${diskPct}%`);
    else if (diskPct >= DISK_WARN) flags.push(`⚠️디스크 ${diskPct}%`);
    if (memPct  >= MEM_WARN)   flags.push(`⚠️메모리 ${memPct}%`);
    if (swapPct >= SWAP_CRIT)  flags.push(`🔴스왑 ${swapPct}%`);
    else if (swapPct >= SWAP_WARN) flags.push(`⚠️스왑 ${swapPct}%`);

    const base = `${label} 디스크 ${diskPct}% · 메모리 ${memPct}%` +
                 (swapUsedMb != null ? ` · 스왑 ${swapPct}%(${swapUsedMb}MB)` : '');
    return { ok: flags.length === 0, detail: flags.length ? `${base} → ${flags.join(', ')}` : base };
}

/**
 * ── Check 6: 서버 자원 ────────────────────────────────
 * 서버1(SSH)·서버2(자기 자신) 디스크/메모리/스왑.
 * ★서버2를 서버2가 보는 한계는 인정한다 — 통째로 죽으면 이 점검도 같이 죽는다.
 *   여기서 잡으려는 건 '서버는 살아있는데 자원이 말라 개별 작업만 죽는' 구간이다
 *   (07-30 스왑 고갈로 크론이 얼어붙은 사고가 정확히 그 구간이었다).
 */
async function checkResources() {
    const results = {};

    // 서버1 — 원격
    const r1 = await ssh1(
        `df -P / | tail -1 | awk '{print $5}' | tr -d '%'; ` +
        `free | awk '/^Mem:/{printf "%.0f\\n", $3/$2*100} /^Swap:/{if($2>0) printf "%.0f %d\\n", $3/$2*100, $3/1024; else print "0 0"}'`
    );
    if (r1.ok) {
        const [d, m, s] = r1.out.split('\n').map((x) => x.trim());
        const [swapPct, swapUsedMb] = (s || '0 0').split(/\s+/).map(Number);
        results.server1 = summarizeResources('서버1', {
            diskPct: parseInt(d, 10), memPct: parseInt(m, 10), swapPct, swapUsedMb,
        });
    } else {
        results.server1 = { ok: false, detail: `서버1 자원 조회 실패: ${r1.err.slice(0, 100)}` };
    }

    // 서버2 — 자기 자신
    try {
        const meminfo = {};
        for (const line of fs.readFileSync('/proc/meminfo', 'utf8').split('\n')) {
            const [k, v] = line.split(':');
            if (v) meminfo[k] = parseInt(v.trim().split(/\s+/)[0], 10);   // KB
        }
        const memPct = Math.round((meminfo.MemTotal - meminfo.MemAvailable) / meminfo.MemTotal * 100);
        const swapTotal = meminfo.SwapTotal || 0;
        const swapUsed  = swapTotal - (meminfo.SwapFree || 0);
        const swapPct   = swapTotal ? Math.round(swapUsed / swapTotal * 100) : 0;

        const df = await run('sh', ['-c', "df -P / | tail -1 | awk '{print $5}' | tr -d '%'"], 5_000);
        results.server2 = summarizeResources('서버2', {
            diskPct: parseInt(df.out, 10) || 0, memPct, swapPct, swapUsedMb: Math.round(swapUsed / 1024),
        });
    } catch (e) {
        results.server2 = { ok: false, detail: `서버2 자원 조회 실패: ${e.message}` };
    }

    return results;
}

(async () => {
    const now     = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const startedAt = Date.now();
    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();

    const results = {
        site:    { ok: false, detail: '' },
        login:   { ok: false, detail: '' },
        toss:    { ok: false, detail: '미점검' },
        hermes:  { ok: false, detail: '미점검' },
        dbMain:  { ok: false, detail: '미점검' },
        dbTypebot: { ok: false, detail: '미점검' },
        n8n:     { ok: false, detail: '미점검' },
        tbBuild: { ok: false, detail: '미점검' },
        tbView:  { ok: false, detail: '미점검' },
        aiStudio: { ok: false, detail: '미점검' },
        server1: { ok: false, detail: '미점검' },
        server2: { ok: false, detail: '미점검' },
    };

    try {
        // ── Check 1: 사이트 열림 ──────────────────────────────
        try {
            const response = await page.goto(TARGET_URL, {
                timeout:   TIMEOUT_MS,
                waitUntil: 'networkidle',
            });
            const status = response?.status() ?? 0;

            // ★403 + "Security Checkpoint" = Vercel 봇 차단이지 사이트 장애가 아니다
            //   (2026-08-05 실측: 감시 서버 IP가 반복 요청으로 일시 차단됐는데
            //    같은 시각 서버1에서는 HTTP 200 정상이었다).
            //   이걸 장애로 보고하면 "사이트가 죽었다"는 거짓 경보가 되고, 반대로
            //   조용히 통과시키면 진짜 장애를 놓친다 — 별도 상태로 구분해 알린다.
            let checkpoint = false;
            if (status === 403) {
                const body = await page.content().catch(() => '');
                checkpoint = /Security Checkpoint/i.test(body);
            }

            if (checkpoint) {
                results.site = {
                    ok: false,
                    detail: 'Vercel 보안 체크포인트(403) — 이 감시 서버 IP가 차단된 상태. ' +
                            '사이트 자체 장애가 아닐 수 있으니 다른 경로에서 접속 확인 필요',
                };
                console.error('⚠️ [사이트] Vercel 보안 체크포인트 403 — 감시 IP 차단 의심');
            } else if (status >= 400) {
                throw new Error(`HTTP ${status}`);
            } else {
                results.site = { ok: true, detail: `HTTP ${status}` };
                console.log(`✅ [사이트] ${TARGET_URL} — HTTP ${status}`);
            }
        } catch (err) {
            results.site = { ok: false, detail: err.message };
            console.error(`❌ [사이트] ${err.message}`);
        }

        // ── Check 2: 로그인 + 페르소나 목록 ──────────────────
        if (!results.site.ok) {
            results.login = { ok: false, detail: '사이트 접속 실패로 로그인 점검 건너뜀' };
        } else if (!MONITOR_EMAIL || !MONITOR_PASSWORD) {
            results.login = { ok: false, detail: 'MONITOR_EMAIL/MONITOR_PASSWORD 환경변수 미설정' };
        } else {
            try {
                // 페이지 안정화 대기
                await page.waitForTimeout(2000);

                // 공지사항 모달이 자동 팝업된 경우 배경 클릭으로 닫기
                // (AnnouncementModal z-50이 AuthModal z-50 위를 덮어 email input을 가림)
                const announcementVisible = await page.locator('text=공지사항').first().isVisible().catch(() => false);
                if (announcementVisible) {
                    await page.mouse.click(10, 10); // 모달 외부 배경 클릭 → onClose
                    await page.waitForTimeout(500);
                }

                // 햄버거 메뉴 먼저 열기 (2026-06-24 첫화면 개편: 로그인/로그아웃이 햄버거 안으로 이동).
                // 로고 바 우측 햄버거(aria-label="메뉴 열기")를 눌러야 '로그인' 항목이 드로어에 나타남.
                await page.getByRole('button', { name: '메뉴 열기' }).first().click({ force: true, timeout: TIMEOUT_MS });
                await page.waitForTimeout(500);

                // 로그인 버튼(드로어 안) 클릭 → 로그인 화면(authPage) 진입
                await page.getByRole('button', { name: '로그인' }).first().click({ force: true, timeout: TIMEOUT_MS });

                // 이메일 입력창 대기 후 입력
                await page.waitForSelector('input[placeholder*="example@email.com"]', { timeout: 10_000 });
                await page.fill('input[placeholder*="example@email.com"]', MONITOR_EMAIL);

                // 비밀번호 입력
                await page.fill('input[type="password"]', MONITOR_PASSWORD);

                // 폼 제출 (Enter)
                await page.keyboard.press('Enter');

                // 모달 닫힘 대기 (비밀번호 input 사라짐 = 로그인 성공)
                await page.waitForSelector('input[type="password"]', {
                    state:   'hidden',
                    timeout: TIMEOUT_MS,
                });

                // 로그인 후 첫화면(MainPageNew) 노출 확인.
                // 로그인 시 헤더 개인화 인사 "{username}님, 다시 만나 반가워요 ✦"가 뜨므로 이를 성공 지표로 사용.
                // (2026-06-24: 옛 지표 'text=님 ✦'는 "님"과 "✦" 사이에 ", 다시 만나 반가워요"가 끼어 매칭 실패 → 문구로 변경)
                await page.waitForSelector('text=다시 만나 반가워요', { timeout: 10_000 });

                results.login = { ok: true, detail: '로그인 성공 — 첫화면 확인' };
                console.log('✅ [로그인] 성공 — 첫화면 노출 확인');
            } catch (err) {
                results.login = { ok: false, detail: err.message };
                console.error(`❌ [로그인] ${err.message}`);
            }
        }

        // ── Check 3~6: 토스봇 / 헤르메스 / DB / 서버자원 ────
        // 브라우저 점검과 독립이라 병렬로 돈다(각 함수는 던지지 않고 결과를 반환).
        // Promise.all 이 아니라 allSettled 로 받는다 — 하나가 예상 못 한 예외로
        // 터져도 나머지 보고는 나가야 한다.
        const [tossR, hermesR, dbR, dockerR, resR, studioR] = await Promise.allSettled([
            checkTossTrader(), checkHermes(), checkDatabase(), checkDockerServices(), checkResources(),
            checkAiStudio(),
        ]);
        const unwrap = (r, label) =>
            r.status === 'fulfilled' ? r.value : { ok: false, detail: `${label} 점검 예외: ${r.reason?.message ?? r.reason}` };

        results.toss     = unwrap(tossR,   '토스봇');
        results.aiStudio = unwrap(studioR, 'AI스튜디오');
        results.hermes = unwrap(hermesR, '헤르메스');

        if (dbR.status === 'fulfilled') {
            results.dbMain    = dbR.value['메인DB']   ?? { ok: false, detail: '결과 없음' };
            results.dbTypebot = dbR.value['타입봇DB'] ?? { ok: false, detail: '결과 없음' };
        } else {
            const d = `DB 점검 예외: ${dbR.reason?.message ?? dbR.reason}`;
            results.dbMain = results.dbTypebot = { ok: false, detail: d };
        }

        if (dockerR.status === 'fulfilled') {
            results.n8n     = dockerR.value['n8n']       ?? { ok: false, detail: '결과 없음' };
            results.tbBuild = dockerR.value['타입봇빌더'] ?? { ok: false, detail: '결과 없음' };
            results.tbView  = dockerR.value['타입봇뷰어'] ?? { ok: false, detail: '결과 없음' };
        } else {
            const d = `docker 점검 예외: ${dockerR.reason?.message ?? dockerR.reason}`;
            results.n8n = results.tbBuild = results.tbView = { ok: false, detail: d };
        }

        if (resR.status === 'fulfilled') {
            results.server1 = resR.value.server1;
            results.server2 = resR.value.server2;
        } else {
            const d = `자원 점검 예외: ${resR.reason?.message ?? resR.reason}`;
            results.server1 = { ok: false, detail: d };
            results.server2 = { ok: false, detail: d };
        }
        for (const [k, v] of Object.entries({ 토스봇: results.toss, 헤르메스: results.hermes,
                                              메인DB: results.dbMain, 타입봇DB: results.dbTypebot,
                                              n8n: results.n8n,
                                              타입봇빌더: results.tbBuild, 타입봇뷰어: results.tbView,
                                              AI스튜디오: results.aiStudio,
                                              서버1: results.server1, 서버2: results.server2 })) {
            console.log(`${v.ok ? '✅' : '❌'} [${k}] ${v.detail}`);
        }

        // ── 스크린샷 ──────────────────────────────────────────
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
        console.log(`📸 스크린샷: ${SCREENSHOT_PATH}`);

        // ── 텔레그램 발송 ─────────────────────────────────────
        // ★사장 선택(2026-08-05) = "항상 전체 요약". 정상일 때도 7개 항목을 다 적는다 —
        //   알림이 안 오는 게 정상인지 감시가 죽은 건지 구분할 수 없으면 감시가 아니다.
        //   대신 정상 항목은 한 줄로 짧게, 실패 항목만 상세를 덧붙인다.
        const checks = [
            ['사이트 열림',  results.site],
            ['로그인',       results.login],
            ['주식자동매매', results.toss],
            ['헤르메스',     results.hermes],
            ['메인 DB',      results.dbMain],
            ['타입봇 DB',    results.dbTypebot],
            ['n8n',          results.n8n],
            ['타입봇 빌더',  results.tbBuild],
            ['타입봇 뷰어',  results.tbView],
            ['AI 스튜디오',  results.aiStudio],
            ['서버1 자원',   results.server1],
            ['서버2 자원',   results.server2],
        ];
        const allOk  = checks.every(([, r]) => r.ok);
        const failed = checks.filter(([, r]) => !r.ok);

        // 정상이어도 detail 을 보여준다(halt 여부·발굴 기준일·자원 수치가 여기 있다).
        const line = (label, { ok, detail }) =>
            `${ok ? '✅' : '❌'} <b>${label}</b> — ${esc(detail || (ok ? '정상' : '실패'))}`;

        const text = [
            allOk ? '✅ <b>전체 정상</b>' : `🚨 <b>이상 감지 (${failed.length}건)</b>`,
            'aichat.dbzone.kr',
            '',
            ...checks.map(([label, r]) => line(label, r)),
            '',
            `🕘 ${now}`,
            ...(allOk ? [] : ['', `<b>확인 필요: ${esc(failed.map(([l]) => l).join(', '))}</b>`]),
        ].join('\n');

        // 장애일 때만 스크린샷을 붙인다 — 정상 보고까지 이미지면 알림이 무거워져
        // 정작 장애 알림을 흘려보게 된다.
        // ★붙이는 조건은 '웹 화면' 장애일 때뿐이다(site/login). 토스봇 halt 나
        //   DB 이상에 사이트 스크린샷을 붙여봐야 아무 단서도 주지 못한다.
        const webFail = !results.site.ok || !results.login.ok;
        const sent = await sendTelegram({
            text,
            screenshotPath: webFail ? SCREENSHOT_PATH : null,
        });
        console.log(sent ? '📨 텔레그램 발송 완료' : '⚠️ 텔레그램 발송 실패(점검 결과는 기록됨)');
        if (!allOk) process.exitCode = 1;

    } finally {
        await browser.close();

        // ── 결과 요약 기록 (대시보드용) ─────────────────────
        // try 안에서 예외가 나도 results는 부분 채워진 상태로 남기 위해 finally에서 기록.
        try {
            // ★`ok` 는 site+login 으로 유지한다 — 어드민 대시보드가 이 값을
            //   '사이트 정상' 표시로 쓰고 있어, 토스봇 halt 같은 다른 축의 이상까지
            //   여기에 섞으면 화면 의미가 조용히 바뀐다. 확장 항목은 별도 키로 싣고
            //   전체 판정은 allOk 로 따로 노출한다.
            const ok = results.site.ok && results.login.ok;
            fs.writeFileSync(STATUS_PATH, JSON.stringify({
                lastRun:    new Date().toISOString(),
                lastRunKST: now,
                ok,
                allOk:      Object.values(results).every((r) => r.ok),
                site:       results.site,
                login:      results.login,
                toss:       results.toss,
                hermes:     results.hermes,
                dbMain:     results.dbMain,
                dbTypebot:  results.dbTypebot,
                n8n:        results.n8n,
                typebotBuilder: results.tbBuild,
                typebotViewer:  results.tbView,
                aiStudio:   results.aiStudio,
                server1:    results.server1,
                server2:    results.server2,
                durationMs: Date.now() - startedAt,
                host:       os.hostname(),
            }, null, 2));
        } catch (e) {
            console.error(`⚠️ monitor-status.json 기록 실패: ${e.message}`);
        }
    }
})();

/** 텔레그램 parse_mode=HTML용 이스케이프. 에러 메시지에 <, > 가 섞이면
 *  (Playwright 셀렉터 등) 태그로 해석돼 발송이 400으로 실패한다. */
function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
