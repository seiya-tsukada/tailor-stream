import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// ローカル開発では /api を uvicorn（FastAPI）に転送する
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    proxy: {
      '/api': API_PROXY_TARGET,
    },
  },
});
