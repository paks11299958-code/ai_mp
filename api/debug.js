module.exports = (req, res) => {
  res.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ? 'SET' : 'NOT SET',
    PROXY_HEADER: process.env.PROXY_HEADER ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  });
};
