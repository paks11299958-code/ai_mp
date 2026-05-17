const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (pool) return pool;

    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        min: parseInt(process.env.POOL_MIN ?? '2'),
        max: parseInt(process.env.POOL_MAX ?? '10'),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 3_000,
    });

    pool.on('connect', (client) => {
        console.log(`[DB Pool] connection added (total: ${pool.totalCount})`);
    });

    pool.on('remove', () => {
        console.log(`[DB Pool] connection removed (total: ${pool.totalCount})`);
    });

    pool.on('error', (err) => {
        console.error('[DB Pool] unexpected error:', err.message);
    });

    return pool;
}

// 편의 함수: 커넥션을 꺼내 쿼리 실행 후 자동 반환
async function query(text, params) {
    const client = await getPool().connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

// 트랜잭션 편의 함수
async function withTransaction(fn) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { getPool, query, withTransaction };
