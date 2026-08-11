import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 학습코칭 컴포넌트 반응형 렌더링 검증용(묶음 E, 2026-08-11). 기존 vite.config.ts는
// 빌드/개발서버 설정이라 손대지 않고, 테스트 전용 설정을 분리했다.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': path.resolve(__dirname, '.') },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['**/*.test.tsx', '**/*.test.ts'],
    },
});
