import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, rmSync } from 'node:fs';

/**
 * Cloudflare Workers static assets rejects a catch-all `/* /index.html 200` in _redirects (error 100324),
 * and wrangler.jsonc already provides SPA fallback. Drop such a file from the build output so a stale
 * public/_redirects can never break a deploy.
 */
const dropSpaCatchAllRedirects = () => ({
  name: 'drop-spa-catch-all-redirects',
  apply: 'build' as const,
  closeBundle() {
    const f = 'dist/_redirects';
    if (existsSync(f) && /^\s*\/\*\s+\/index\.html\b/m.test(readFileSync(f, 'utf8'))) {
      rmSync(f);
      console.warn('\n[cosmos] Removed dist/_redirects (SPA catch-all). Delete public/_redirects from your repo; wrangler.jsonc handles SPA fallback.\n');
    }
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), dropSpaCatchAllRedirects()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
