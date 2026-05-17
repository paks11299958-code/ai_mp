const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
    const app = express();

    // ── CORS ─────────────────────────────
    const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
        : '*';

    app.use(cors({
        origin: allowedOrigins,
        credentials: true,
    }));

    // ── 바디 파싱 ────────────────────────
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ── 요청 로깅 ────────────────────────
    app.use((req, _res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
        next();
    });

    // ── API 라우터 마운트 ────────────────
    app.use('/api', apiRouter);

    // ── 404 ──────────────────────────────
    app.use((req, res) => {
        res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
    });

    // ── 에러 핸들러 ──────────────────────
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
