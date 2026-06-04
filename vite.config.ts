/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__BUILD_VERSION__': JSON.stringify(env.VITE_BUILD_VERSION || 'dev-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            if (id.includes('lucide-react') || id.includes('motion')) {
              return 'vendor-ui';
            }
            return 'vendor';
          },
        },
      },
    },
    test: {
      globals: true,
      setupFiles: './src/setupTests.ts',
      env: {
        JWT_SECRET: 'test-secret'
      },
      environment: 'jsdom',
      environmentMatchGlobs: [['tests/server/**/*.test.ts', 'node']],
      exclude: ['**/node_modules/**', '**/dist/**'],
      // Each API test file imports the full server graph (Express + socket.io +
      // a fresh better-sqlite3 :memory: DB + native bindings). Running every file
      // in its own fork at full CPU parallelism exhausts memory and crashes a
      // worker ("Worker exited unexpectedly"). Cap concurrent forks to keep peak
      // memory bounded while preserving per-file DB isolation.
      pool: 'forks',
      maxWorkers: 4,
      // Cap heap per fork — GC triggers before the OS 4 GB limit crashes the worker.
      execArgv: ['--max-old-space-size=6144'],
    }
  };
});

