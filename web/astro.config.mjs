import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The site has no server. Anything it knows is public. Secrets live only in
// Worker secrets. See docs/superpowers/specs/2026-09-13-makeup-site-design.md
//
// envDir points at the repo root so the single root .env (and its
// PUBLIC_SANITY_* values) is read; only PUBLIC_-prefixed names reach the site.
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    envDir: fileURLToPath(new URL('..', import.meta.url)),
  },
});
