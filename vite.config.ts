import { defineConfig } from 'vite';

// ARTIFACT=1 встраивает модели прямо в JS (для превью на claude.ai, где .glb не раздаётся отдельно)
export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: process.env.ARTIFACT ? 20_000_000 : 4096,
  },
});
