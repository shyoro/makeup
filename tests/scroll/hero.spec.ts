import { test, expect, type Page } from '@playwright/test';

// The opening bouquet grows with scroll: line work draws itself, then each
// flower opens at its point in the scene. Measured through the drawn dash
// length (DrawSVG writes stroke-dasharray) and each piece's opacity.

async function bouquetState(page: Page) {
  return page.evaluate(() => {
    const line = document.querySelector<SVGPathElement>('[data-lines] path');
    const dash = line ? getComputedStyle(line).strokeDasharray : 'none';
    const drawn = dash === 'none' ? null : parseFloat(dash);
    const opacities = [
      ...document.querySelectorAll<SVGGElement>('[data-piece]'),
    ].map((p) => Number(getComputedStyle(p).opacity));
    return {
      drawn,
      length: line ? line.getTotalLength() : 0,
      opacities,
    };
  });
}

async function scrollToHeroEnd(page: Page) {
  const end = Number(
    await page.locator('[data-scene="hero"]').getAttribute('data-end'),
  );
  expect(end).toBeGreaterThan(0);
  await page.evaluate((y) => window.scrollTo(0, y), end);
  await page.waitForTimeout(1200);
}

test('bouquet starts ungrown', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const s = await bouquetState(page);
  expect(s.drawn).not.toBeNull();
  expect(s.drawn!).toBeLessThan(1);
  expect(s.opacities.at(-1)!).toBeLessThan(0.1);
});

test('scrolling grows the bouquet', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await scrollToHeroEnd(page);
  const s = await bouquetState(page);
  expect(s.drawn!).toBeGreaterThan(s.length - 1);
  for (const o of s.opacities) expect(o).toBeGreaterThan(0.9);
});

test('jumping to the bottom leaves the bouquet fully grown', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await scrollToHeroEnd(page);
  const s = await bouquetState(page);
  expect(s.drawn!).toBeGreaterThan(s.length - 1);
  for (const o of s.opacities) expect(o).toBeGreaterThan(0.9);
});

test('content visible with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
  const s = await bouquetState(page);
  expect(s.opacities.length).toBeGreaterThan(0);
  for (const o of s.opacities) expect(o).toBe(1);
  await context.close();
});
