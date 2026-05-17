const { Router } = require('express');
const { query } = require('../../db/pool');

const router = Router();

// GET /api/talkbell/ping
router.get('/ping', (req, res) => {
    res.json({ project: 'talkbell', ok: true });
});

// TODO: TalkBell 전용 라우트 추가

module.exports = router;
