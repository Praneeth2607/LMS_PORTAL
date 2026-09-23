import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Listen on the LAN so phones can open attendance QR links during demos.
    host: true,
    // Forward /api calls to Express so the browser sees a single origin in dev.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
