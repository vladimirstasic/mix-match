import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Without this, Rollup's automatic chunking ties posthog-js to whichever
        // lazy-loaded feature chunk happens to import lib/analytics.ts first
        // (observed: it got bundled into ExportModal, +85KB gzipped) instead of
        // the eager main bundle where it's actually initialized.
        manualChunks(id) {
          if (id.includes('node_modules/posthog-js')) return 'vendor-posthog';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
