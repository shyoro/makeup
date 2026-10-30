import { test, expect } from '@playwright/test';

// The page is assembled from an ordered sections[] array (parent spec §8):
// order comes from data, and the opening sells nothing.

test('sections render in data order', async ({ page }) => {
  await page.goto('/');
  const scenes = await page
    .locator('[data-scene]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-scene')));
  expect(scenes).toEqual(['hero', 'portfolio']);
});

test('hero heading is the first h1 and is the artist name', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toHaveText('נועה לוי');
});

test('no call to action in the opening', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('[data-scene="hero"] a, [data-scene="hero"] button'),
  ).toHaveCount(0);
});
