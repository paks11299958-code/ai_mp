const { Router } = require('express');
const { query } = require('../../db/pool');

const router = Router();

// GET /api/ploppy/ping
router.get('/ping', (req, res) => {
    res.json({ project: 'ploppy', ok: true });
});

// TODO: Ploppy 전용 라우트 추가

module.exports = router;
