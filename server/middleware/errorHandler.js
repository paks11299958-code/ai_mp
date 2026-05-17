function errorHandler(err, req, res, next) {
    const status = err.status ?? err.statusCode ?? 500;
    console.error(`[Error] ${req.method} ${req.originalUrl} → ${status}: ${err.message}`);
    res.status(status).json({ error: err.message || '서버 오류가 발생했습니다.' });
}

module.exports = errorHandler;
