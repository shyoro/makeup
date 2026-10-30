import { test, expect, type Page } from '@playwright/test';

// Portfolio photos open through an arch-shaped clip as they scroll into view,
// while the box keeps its locked 4:5 shape whether or not the image loaded.

const OPEN = /^inset\(0(%|px)?[\s)]/;

async function revealState(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>('[data-reveal]')!;
    const img = wrap.querySelector('img')!;
    const m = new DOMMatrix(getComputedStyle(img).transform);
    return { clip: getComputedStyle(wrap).clipPath, scale: m.a };
  });
}

test('photos reveal on scroll', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const before = await revealState(page);
  expect(before.clip).not.toBe('none');
  expect(before.clip).not.toMatch(OPEN);

  await page
    .locator('[data-reveal]')
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1200);
  const after = await revealState(page);
  expect(after.clip).toMatch(OPEN);
  expect(Math.abs(after.scale - 1)).toBeLessThan(0.01);
});

test('portfolio slots keep 4:5 before images load', async ({ page }) => {
  await page.route('**/cdn.sanity.io/**', () => {
    // never respond: images stay pending
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const ratios = await page.locator('[data-reveal]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    }),
  );
  expect(ratios.length).toBeGreaterThan(0);
  for (const r of ratios) expect(Math.abs(r - 0.8)).toBeLessThan(0.01);
});

test('portfolio visible with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const clips = await page
    .locator('[data-reveal]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).clipPath));
  expect(clips.length).toBeGreaterThan(0);
  for (const c of clips) expect(c).toBe('none');
  await context.close();
});

test('no horizontal overflow after resize', async ({ page }) => {
  await page.goto('/');
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, `overflow at ${size.width}×${size.height}`).toBe(false);
  }
});
