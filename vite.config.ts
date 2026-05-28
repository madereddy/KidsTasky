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
      exclude: ['**/node_modules/**', '**/dist/**']
    }
  };
});

