import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [vue()],
  root: resolve(rootDir, 'src/client'),
  build: {
    outDir: resolve(rootDir, 'dist/client'),
    emptyOutDir: true,
  },
});
