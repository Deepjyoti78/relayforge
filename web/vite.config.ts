import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.DEV_API_PROXY_TARGET || (process.env.VITE_API_URL === '/' ? undefined : process.env.VITE_API_URL) || 'http://127.0.0.1:3100';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/v1': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
