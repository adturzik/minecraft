import { defineConfig } from 'vite';

export default defineConfig({
  base: '/minecraft/',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
});
