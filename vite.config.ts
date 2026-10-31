import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /<repo-name>/.
const PAGES_BASE = '/nightbus/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PAGES_BASE : '/',
  build: {
    target: 'es2023',
    // Phaser alone is ~1.5 MB minified; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
}));
