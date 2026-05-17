module.exports = {
    apps: [
        {
            name: 'shared-api',
            script: './index.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env_production: {
                NODE_ENV: 'production',
            },
            error_file: './logs/err.log',
            out_file:   './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
    ],
};
