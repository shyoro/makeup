import { test, expect, type Page } from '@playwright/test';

// Portfolio photos rise gently out of the page's background tone as they
// scroll in, inside fixed frames with soft 5px corners, while the background
// drifts through her colours.

async function revealState(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>('[data-reveal]')!;
    const img = wrap.querySelector('img')!;
    const m = new DOMMatrix(getComputedStyle(img).transform);
    return { opacity: Number(getComputedStyle(wrap).opacity), scale: m.a };
  });
}

async function strongestTone(page: Page) {
  return page
    .locator('[data-tone]')
    .evaluateAll((els) =>
      Math.max(...els.map((el) => Number(getComputedStyle(el).opacity))),
    );
}

test('photos reveal on scroll', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  expect((await revealState(page)).opacity).toBeLessThan(0.05);

  await page
    .locator('[data-reveal]')
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1200);
  const after = await revealState(page);
  expect(after.opacity).toBeGreaterThan(0.99);
  expect(Math.abs(after.scale - 1)).toBeLessThan(0.01);
});

test('every photo is fully revealed at the bottom of the page', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  const opacities = await page
    .locator('[data-reveal]')
    .evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
  for (const o of opacities) expect(o).toBeGreaterThan(0.99);
});

test('photo frames have gentle 5px corners', async ({ page }) => {
  await page.goto('/');
  const radii = await page
    .locator('[data-reveal] [data-media]')
    .evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return [s.borderStartStartRadius, s.borderEndEndRadius];
      }),
    );
  expect(radii.length).toBeGreaterThan(0);
  for (const r of radii) expect(r).toEqual(['5px', '5px']);
});

test('the background tone shifts while scrolling the portfolio', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const before = await strongestTone(page);
  await page.locator('[data-scene="portfolio"]').evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + el.offsetHeight * 0.4);
  });
  await page.waitForTimeout(1200);
  expect(before).toBeLessThan(0.02);
  expect(await strongestTone(page)).toBeGreaterThan(0.1);
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
  const opacities = await page
    .locator('[data-reveal]')
    .evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
  expect(opacities.length).toBeGreaterThan(0);
  for (const o of opacities) expect(o).toBe(1);
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
