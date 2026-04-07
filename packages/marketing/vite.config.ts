import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: isSsrBuild
        ? undefined
        : {
            manualChunks: {
              vendor: ['react', 'react-dom'],
            },
          },
    },
  },
}));
