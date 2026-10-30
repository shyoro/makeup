import { test, expect } from '@playwright/test';

// Palette "A · Plum as the ink" — spec 2026-10-30-scroll-story-design.md §5.

test('plum ink on shaded white', async ({ page }) => {
  await page.goto('/');
  const { color, background } = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { color: s.color, background: s.backgroundColor };
  });
  expect(color).toBe('rgb(59, 35, 64)');
  expect(background).toBe('rgb(250, 246, 243)');
});
