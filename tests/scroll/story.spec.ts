import { test, expect, type Page } from '@playwright/test';

// The portfolio is a scroll story: full-screen photo scenes that fade in,
// settle from a subtle zoom and wash out into her colours as a text section
// scrolls over them; text sections carry her flowers in black and white,
// turned 90° and 180°, growing as they pass; photo pairs sit between.

/** Scroll so the element's top sits at `at` (0 = viewport top, 1 = bottom). */
async function placeTop(page: Page, selector: string, at: number, nth = 0) {
  await page
    .locator(selector)
    .nth(nth)
    .evaluate((el, at) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - window.innerHeight * at);
    }, at);
  await page.waitForTimeout(1200);
}

async function sceneState(page: Page, nth = 0) {
  return page
    .locator('[data-story-scene]')
    .nth(nth)
    .evaluate((scene) => {
      const visible = (el: Element) => {
        const s = getComputedStyle(el);
        return s.visibility === 'hidden' ? 0 : Number(s.opacity);
      };
      const layer = scene.querySelector('[data-layer]')!;
      const fade = scene.querySelector('[data-fade]')!;
      const zoom = scene.querySelector('[data-zoom]')!;
      return {
        position: getComputedStyle(layer).position,
        shown: visible(layer) * visible(fade),
        zoom: new DOMMatrix(getComputedStyle(zoom).transform).a,
        wash: Number(
          getComputedStyle(scene.querySelector('[data-wash]')!).opacity,
        ),
      };
    });
}

test('a scene fades in full-screen as it scrolls in', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await placeTop(page, '[data-story-scene]', 0.9);
  const before = await sceneState(page);
  expect(before.position).toBe('fixed');
  expect(before.shown).toBeLessThan(0.05);

  await placeTop(page, '[data-story-scene]', 0);
  expect((await sceneState(page)).shown).toBeGreaterThan(0.95);
});

test('scene photos settle from a subtle zoom', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await placeTop(page, '[data-story-scene]', 0.5);
  const early = (await sceneState(page)).zoom;
  await placeTop(page, '[data-story-scene]', -0.5);
  const later = (await sceneState(page)).zoom;
  expect(early).toBeGreaterThan(1.05);
  expect(later).toBeLessThan(early);
  expect(later).toBeGreaterThanOrEqual(1);
});

test('the photo washes into her colour as the next text arrives, then leaves', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  // The text section after the first scene, half-way up the screen.
  await placeTop(page, '[data-panel]', 0.5, 1);
  expect((await sceneState(page)).wash).toBeGreaterThan(0.5);
  // Fully over the text: the photo is gone.
  await placeTop(page, '[data-panel]', 0, 1);
  expect((await sceneState(page)).shown).toBeLessThan(0.05);
});

test('text sections sit above the photos', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await placeTop(page, '[data-panel]', 0.3, 1);
  const onTop = await page
    .locator('[data-panel]')
    .nth(1)
    .evaluate((panel) => {
      const h = panel.querySelector('h3')!.getBoundingClientRect();
      const hit = document.elementFromPoint(
        h.left + h.width / 2,
        h.top + h.height / 2,
      );
      return Boolean(
        hit && panel.contains(hit) && !hit.closest('[data-flowers]'),
      );
    });
  expect(onTop).toBe(true);
});

test('text sections carry black and white flowers turned 90° and 180°', async ({
  page,
}) => {
  await page.goto('/');
  const flowers = await page
    .locator('[data-panel] [data-flowers]')
    .evaluateAll((els) =>
      els.map((el) => ({
        rotate: getComputedStyle(el).rotate,
        mono: el
          .querySelector('img')!
          .getAttribute('srcset')!
          .includes('sat=-100'),
      })),
    );
  expect(flowers.length).toBeGreaterThanOrEqual(2);
  expect(flowers.map((f) => f.rotate)).toEqual(
    expect.arrayContaining(['90deg', '180deg']),
  );
  for (const f of flowers) expect(f.mono).toBe(true);
});

test('the flowers grow as their text section scrolls through', async ({
  page,
}) => {
  const covered = () =>
    page
      .locator('[data-panel]')
      .nth(1)
      .evaluate((panel) => {
        // Sample the art box's centre: uncovered part-way through the sweep.
        const box = panel
          .querySelector('[data-flowers]')!
          .getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        if (y < 0 || y > innerHeight) return null;
        return document
          .elementsFromPoint(x, y)
          .some((el) => el.closest('[data-flowers] [data-wipe]'));
      });
  await page.goto('/');
  await page.waitForLoadState('load');
  await placeTop(page, '[data-panel]', 0.45, 1);
  expect(await covered()).toBe(false);
  await placeTop(page, '[data-panel]', 0, 1);
  expect(await covered()).toBe(true);
});

test('pair photos reveal on scroll inside 5px frames', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const opacity = () =>
    page
      .locator('[data-pair] [data-reveal]')
      .first()
      .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(await opacity()).toBeLessThan(0.05);
  await placeTop(page, '[data-pair]', 0.1);
  expect(await opacity()).toBeGreaterThan(0.99);

  const radii = await page
    .locator('[data-pair] [data-media]')
    .evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return [s.borderStartStartRadius, s.borderEndEndRadius];
      }),
    );
  for (const r of radii) expect(r).toEqual(['5px', '5px']);
});

test('pair slots keep 4:5 before images load', async ({ page }) => {
  await page.route('**/cdn.sanity.io/**', () => {
    // never respond: images stay pending
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const ratios = await page
    .locator('[data-pair] [data-reveal]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.width / r.height;
      }),
    );
  expect(ratios.length).toBeGreaterThan(0);
  for (const r of ratios) expect(Math.abs(r - 0.8)).toBeLessThan(0.01);
});

test('the story reads top to bottom with JavaScript disabled', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const layers = await page
    .locator('[data-story-scene] [data-layer]')
    .evaluateAll((els) =>
      els.map((el) => ({
        position: getComputedStyle(el).position,
        opacity: Number(getComputedStyle(el).opacity),
      })),
    );
  expect(layers.length).toBeGreaterThan(0);
  for (const l of layers) {
    expect(l.position).not.toBe('fixed');
    expect(l.opacity).toBe(1);
  }
  const reveals = await page
    .locator('[data-reveal]')
    .evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
  for (const o of reveals) expect(o).toBe(1);
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
