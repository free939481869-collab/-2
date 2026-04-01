import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const uicheckProxy = process.env.UICHECK_PROXY_PORT || '8787';
    const uicheckTarget = `http://127.0.0.1:${uicheckProxy}`;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/uicheck': {
            target: uicheckTarget,
            changeOrigin: true,
          },
        },
      },
      preview: {
        port: 4173,
        proxy: {
          '/api/uicheck': {
            target: uicheckTarget,
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
        'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || env.GEMINI_API_BASE_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
