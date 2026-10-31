import { test, expect } from '@playwright/test';

// <Media> renders Sanity images with a responsive srcset inside a box whose
// shape comes from the locked aspect ratio, never from the asset.

test('media renders a sanity srcset', async ({ page }) => {
  await page.goto('/');
  const img = page.locator('[data-pair] [data-media] img').first();
  const srcset = (await img.getAttribute('srcset')) ?? '';
  expect(srcset).toContain('cdn.sanity.io');
  expect(
    srcset.split(',').filter((s) => /\s\d+w$/.test(s.trim())).length,
  ).toBeGreaterThanOrEqual(4);
  expect((await img.getAttribute('alt'))?.trim()).toBeTruthy();
});

test('media box is locked to its aspect', async ({ page }) => {
  await page.goto('/');
  const box = await page
    .locator('[data-pair] [data-media]')
    .first()
    .boundingBox();
  expect(box).not.toBeNull();
  // The pair's photos: 4:5 on phones, 16:9 from tablets.
  const ratio = page.viewportSize()!.width < 768 ? 4 / 5 : 16 / 9;
  expect(Math.abs(box!.width / box!.height - ratio)).toBeLessThan(0.01);
});
