const { Router } = require('express');
const { query } = require('../../db/pool');

const router = Router();

// GET /api/pastlife/ping
router.get('/ping', (req, res) => {
    res.json({ project: 'pastlife', ok: true });
});

// TODO: 전생 알아보기 전용 라우트 추가

module.exports = router;
