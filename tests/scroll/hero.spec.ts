import { test, expect, type Page } from '@playwright/test';

// The opening is her painting growing along the spray: the ink drawing sweeps
// in from the bottom-left on its own at first view, and the colour follows it
// as she scrolls.
// Checked by hit-testing points of the art box: a layer only "hits" where its
// sweep has uncovered it.

// Fractions of the art box. On phones the box is wider than the screen, so
// both points must stay inside the visible middle of it.
const REAR = [0.3, 0.72] as const; // lower-left, where the spray starts
const LEAD = [0.7, 0.22] as const; // upper-right, uncovered last

async function layersAt(page: Page, [fx, fy]: readonly [number, number]) {
  const layers = await page.evaluate(
    ([fx, fy]) => {
      const box = document.querySelector('[data-art]')!.getBoundingClientRect();
      const x = box.left + box.width * fx;
      const y = box.top + box.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
      return document
        .elementsFromPoint(x, y)
        .map((el) => el.closest('[data-wipe]')?.getAttribute('data-wipe'))
        .filter((v): v is string => Boolean(v));
    },
    [fx, fy] as const,
  );
  expect(layers, 'sample point must be on screen').not.toBeNull();
  return layers!;
}

async function scrollToHeroEnd(page: Page) {
  const end = Number(
    await page.locator('[data-scene="hero"]').getAttribute('data-end'),
  );
  expect(end).toBeGreaterThan(0);
  await page.evaluate((y) => window.scrollTo(0, y), end);
  await page.waitForTimeout(1200);
}

test('the whole ink drawing appears on its own at first view', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2600);
  for (const point of [REAR, LEAD]) {
    expect(await layersAt(page, point)).toContain('line');
    expect(await layersAt(page, point)).not.toContain('color');
  }
});

test('the drawing draws in with a soft edge that comes off once drawn', async ({
  page,
}) => {
  const mask = () =>
    page
      .locator('[data-scene="hero"] [data-wipe="line"]')
      .evaluate((el) => getComputedStyle(el).maskImage);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(await mask()).toContain('linear-gradient');
  // A moving mask re-rasterises every frame: none is left for scrolling.
  await page.waitForLoadState('load');
  await page.waitForTimeout(3500);
  expect(await mask()).toBe('none');
});

test('the scroll cue fades out with the name', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await scrollToHeroEnd(page);
  const opacity = (selector: string) =>
    page
      .locator(selector)
      .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(await opacity('[data-scene="hero"] [data-title]')).toBeLessThan(0.05);
  expect(await opacity('[data-scene="hero"] [data-cue]')).toBeLessThan(0.05);
});

test('scrolling paints the whole spray', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await scrollToHeroEnd(page);
  expect(await layersAt(page, LEAD)).toContain('color');
});

test('jumping to the bottom leaves the spray fully painted', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await scrollToHeroEnd(page);
  expect(await layersAt(page, LEAD)).toContain('color');
});

test('the whole painting shows with JavaScript disabled', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
  expect(await layersAt(page, LEAD)).toContain('color');
  expect(await layersAt(page, REAR)).toContain('color');
  await context.close();
});
