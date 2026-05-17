require('dotenv').config();

const { getPool } = require('./db/pool');
const createApp = require('./app');

const PORT = process.env.PORT || 3020;

async function start() {
    // ── DB 풀 사전 예열 ──────────────────
    console.log('[Server] DB 커넥션 풀 초기화 중...');
    try {
        const pool = getPool();
        const client = await pool.connect();
        const { rows } = await client.query('SELECT NOW() AS now');
        client.release();
        console.log(`[Server] DB 풀 준비 완료 ✓  (DB 시각: ${rows[0].now})`);
        console.log(`[Server] 유휴 커넥션: ${pool.idleCount} / 최대: ${pool.totalCount}`);
    } catch (err) {
        console.error('[Server] DB 연결 실패:', err.message);
        process.exit(1);
    }

    // ── Express 앱 구동 ──────────────────
    const app = createApp();
    app.listen(PORT, () => {
        console.log(`[Server] 포트 ${PORT} 에서 실행 중`);
        console.log(`[Server] 헬스체크: http://localhost:${PORT}/api/health`);
    });

    // ── 프로세스 종료 시 풀 정리 ─────────
    const gracefulShutdown = async (signal) => {
        console.log(`\n[Server] ${signal} 수신 → 종료 중...`);
        await getPool().end();
        console.log('[Server] DB 풀 종료 완료');
        process.exit(0);
    };

    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

start();
