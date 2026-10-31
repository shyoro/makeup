import { defineConfig, devices } from '@playwright/test';

// Viewports are locked by the spec. Mobile is the primary target and runs first.
//
// webServer uses `astro preview` (already a pinned dependency of the `web`
// workspace) instead of `npx --yes serve`. `serve` is not a project
// dependency, so `npx --yes serve` would silently reach out to the network
// to fetch an unpinned package on every fresh checkout/CI run. `astro
// preview` serves the same static `web/dist` output, defaults to port 4321,
// and requires no extra install.
export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'npm run build -w web && npm run preview -w web -- --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Astro 7 auto-detects an agentic environment (e.g. Claude Code) and
    // daemonizes `astro preview` in that case: the foreground process
    // prints its status and exits immediately, which Playwright reports as
    // "Process from config.webServer exited early." ASTRO_PREVIEW_BACKGROUND
    // opts out of that auto-detection so the server stays in the foreground
    // process Playwright spawned and is watching.
    //
    // PUBLIC_CONTACT_PHONE: her real number lives only in .env (spec 3.1:
    // the repo must not make it scrapable). Tests build with this obviously
    // fake one instead; a variable set here beats the .env file.
    env: {
      ASTRO_PREVIEW_BACKGROUND: '1',
      PUBLIC_CONTACT_PHONE: '+972-50-000-0000',
    },
  },
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
