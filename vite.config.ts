import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /<repo-name>/.
const PAGES_BASE = '/nightbus/';
const THEME = '#0b0d1a';

export default defineConfig(({ command, isPreview }) => {
  // `vite preview` serves the build, so it needs the same base as GitHub Pages.
  const base = command === 'build' || isPreview ? PAGES_BASE : '/';
  return {
    base,
    build: {
      target: 'es2023',
      // Phaser alone is ~1.5 MB minified; don't warn about it.
      chunkSizeWarningLimit: 2000,
    },
    plugins: [
      VitePWA({
        // 'prompt', not 'autoUpdate': an automatic reload could interrupt a bus ride.
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'Viimeinen yöbussi',
          short_name: 'Yöbussi',
          description: 'Pidä silmät auki ja jää pois oikealla pysäkillä.',
          lang: 'fi',
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'landscape',
          theme_color: THEME,
          background_color: THEME,
          start_url: base,
          scope: base,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache everything the game needs offline: code (incl. route JSON chunks), fonts, images, audio.
          globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2,json,ogg,mp3,m4a,wav}'],
          // Default is 2 MB; large audio or spritesheets would otherwise be skipped silently.
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    },
  };
});
