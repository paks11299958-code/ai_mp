const { Router } = require('express');

const aimpRouter    = require('./aimp');
const ploppyRouter  = require('./ploppy');
const talkbellRouter = require('./talkbell');
const pastlifeRouter = require('./pastlife');

const router = Router();

// ── 헬스체크 ─────────────────────────────
router.get('/health', async (req, res) => {
    const { getPool } = require('../db/pool');
    try {
        await getPool().query('SELECT 1');
        res.json({ ok: true, db: 'connected', ts: new Date().toISOString() });
    } catch {
        res.status(503).json({ ok: false, db: 'disconnected' });
    }
});

// ── 프로젝트별 라우터 마운트 ────────────
router.use('/aimp',     aimpRouter);      // /api/aimp/*
router.use('/ploppy',   ploppyRouter);    // /api/ploppy/*
router.use('/talkbell', talkbellRouter);  // /api/talkbell/*
router.use('/pastlife', pastlifeRouter);  // /api/pastlife/*

module.exports = router;
