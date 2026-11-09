import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_API_URL || 'https://relayforge-staging-api.onrender.com';

export default defineConfig({
  plugins: [react()],
  server: {
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
