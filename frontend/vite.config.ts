import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

const buildTime = new Date().toISOString();
let gitCommit = 'unknown';
try { gitCommit = execSync('git rev-parse --short HEAD').toString().trim(); } catch {}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      publicDir: '../public',
      define: {
        // This is just generic value for the GEMINI API key.
        // This is not used at all, and can be ignored!
        'process.env.API_KEY' : JSON.stringify('api-key-this-is-not-used-can-be-ignored!'),
        __BUILD_TIME__: JSON.stringify(buildTime),
        __GIT_COMMIT__: JSON.stringify(gitCommit),
      },
      server: {
        proxy: {
          '/api': 'http://localhost:3002',
          '/api-proxy': 'http://localhost:3002',
        },
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
