import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// The site has no server. Anything it knows is public. Secrets live only in
// Worker secrets. See docs/superpowers/specs/2026-09-13-makeup-site-design.md
export default defineConfig({
  output: 'static',
  vite: { plugins: [tailwindcss()] },
});
