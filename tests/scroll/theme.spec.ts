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

test('flower tokens resolve', async ({ page }) => {
  await page.goto('/');
  const { fill, stroke } = await page.evaluate(() => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'fill-flower-pink stroke-flower-line');
    path.setAttribute('d', 'M0 0 L10 10');
    svg.append(path);
    document.body.append(svg);
    const s = getComputedStyle(path);
    const out = { fill: s.fill, stroke: s.stroke };
    svg.remove();
    return out;
  });
  expect(fill).not.toBe('rgb(0, 0, 0)');
  expect(stroke).not.toBe('none');
});
