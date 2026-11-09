import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/demos/carga-01/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3344
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});