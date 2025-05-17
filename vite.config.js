import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src/client'),
  publicDir: resolve(__dirname, 'audio'),
  build: {
    outDir: resolve(__dirname, 'dist-client'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/index.html'),
      },
    },
    assetsInlineLimit: 4096,
  },
});
