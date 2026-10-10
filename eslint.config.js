import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'web/dist/', '**/.astro/**'],
  },
  {
    files: ['web/src/**/*.{ts,astro}'],
    rules: {
      // Hard rule 8: no browser storage in components. no-restricted-globals
      // only matches the bare, unqualified identifier. Bare `localStorage`
      // throws during Astro SSR, though, so the form an agent actually
      // reaches for is `window.localStorage`/`globalThis.sessionStorage` —
      // no-restricted-properties covers exactly that qualified form.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Banned by CLAUDE.md hard rule 8.' },
        { name: 'sessionStorage', message: 'Banned by CLAUDE.md hard rule 8.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'Banned by CLAUDE.md hard rule 8.',
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message: 'Banned by CLAUDE.md hard rule 8.',
        },
        {
          object: 'globalThis',
          property: 'localStorage',
          message: 'Banned by CLAUDE.md hard rule 8.',
        },
        {
          object: 'globalThis',
          property: 'sessionStorage',
          message: 'Banned by CLAUDE.md hard rule 8.',
        },
      ],
      // Hard rule 3: SITE_URL is defined once. Use absoluteUrl().
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^https?:\\/\\//]',
          message:
            'No hardcoded absolute origins. Import absoluteUrl() from src/config.ts (CLAUDE.md hard rule 3).',
        },
      ],
    },
  },
  {
    // config.ts is the one place an origin is allowed to be written.
    files: ['web/src/config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
