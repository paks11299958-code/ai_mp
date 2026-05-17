const { Router } = require('express');
const { query } = require('../../db/pool');

const router = Router();

// 예시: GET /api/aimp/ping
router.get('/ping', (req, res) => {
    res.json({ project: 'aimp', ok: true });
});

// TODO: 기존 Vercel api/router.ts 라우트를 순차적으로 이 파일로 이전

module.exports = router;
