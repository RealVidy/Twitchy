/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    cors: { origin: [/chrome-extension:\/\//] },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
