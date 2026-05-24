import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  // @sqlite.org/sqlite-wasm loads the .wasm file at runtime via `new URL(...,
  // import.meta.url)`. Excluding it from optimizeDeps keeps Vite from trying
  // to prebundle the package, which breaks that URL.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
});
