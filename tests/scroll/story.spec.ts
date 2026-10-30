import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    /** Opacity times every ancestor's; 0 when hidden. */
    opacityOf(el: Element): number;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.opacityOf = (el) => {
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.visibility === 'hidden') return 0;
        o *= Number(s.opacity);
      }
      return o;
    };
  });
});

// The portfolio is a scroll story: full-screen photo scenes that fade in as
// the words before them dissolve, settle from a subtle zoom and wash out into
// her colours as the next text section scrolls over them; text sections carry
// her flowers in ink, turned 90° and 180°, growing beside the words; photo
// pairs sit between, and the story ends on a way to book.

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
        zoom: ((sc) => (sc === 'none' ? 1 : parseFloat(sc)))(
          getComputedStyle(zoom).scale,
        ),
        wash: Number(
          getComputedStyle(scene.querySelector('[data-wash]')!).opacity,
        ),
      };
    });
}

test('a scene fades in full-screen as it scrolls in', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await placeTop(page, '[data-story-scene]', 1);
  const before = await sceneState(page);
  expect(before.position).toBe('fixed');
  expect(before.shown).toBeLessThan(0.05);

  await placeTop(page, '[data-story-scene]', 0);
  expect((await sceneState(page)).shown).toBeGreaterThan(0.95);
});

test('a photo fades in as the words before it dissolve', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  // The first scene follows the portfolio's heading section: midway
  // through the words' hand-over to it.
  await placeTop(page, '[data-story-scene]', 0.8);
  const photo = (await sceneState(page)).shown;
  const words = await page
    .locator('[data-panel-text]')
    .first()
    .evaluate((el) => window.opacityOf(el));
  expect(photo).toBeGreaterThan(0.15);
  expect(photo).toBeLessThan(0.85);
  expect(words).toBeGreaterThan(0.05);
  expect(words).toBeLessThan(0.95);
});

test('every screen of the story shows a photo or words', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await page.waitForLoadState('load');
  const start = Number(
    await page.locator('[data-scene="hero"]').getAttribute('data-end'),
  );
  const { end, vh } = await page.evaluate(() => ({
    end: document.documentElement.scrollHeight - innerHeight,
    vh: innerHeight,
  }));
  const empty: number[] = [];
  for (let y = start; y <= end; y += vh / 4) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(700);
    const seen = await page.evaluate(() => {
      // Words and pair photos count across the middle of the screen, not
      // sliding in or out at an edge. A cross-fade counts as full when the
      // photo and the words together make up most of one.
      const inView = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.bottom > innerHeight * 0.2 && r.top < innerHeight * 0.8;
      };
      const most = (els: Element[]) =>
        Math.max(0, ...els.map((el) => window.opacityOf(el)));
      const photo = most([
        ...document.querySelectorAll('[data-story-scene] [data-fade]'),
      ]);
      const content = most(
        [
          ...document.querySelectorAll(
            '[data-panel-text], [data-reveal], [data-scene="hero"] [data-art]',
          ),
        ].filter(inView),
      );
      return photo + content >= 0.6;
    });
    if (!seen) empty.push(Math.round((y / vh) * 100) / 100);
  }
  expect(empty, 'scroll positions, in screens, with nothing to see').toEqual(
    [],
  );
});

test('full-screen photos keep their focal point in frame', async ({ page }) => {
  await page.goto('/');
  const position = await page
    .locator('[data-story-scene] img')
    .first()
    .evaluate((img) => getComputedStyle(img).objectPosition);
  expect(position).not.toBe('50% 50%');
});

test('scene photos land from a zoom, then push in as they pass', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await placeTop(page, '[data-story-scene]', 0.85);
  const entering = (await sceneState(page)).zoom;
  await placeTop(page, '[data-story-scene]', 0);
  const held = (await sceneState(page)).zoom;
  // Its bottom a fifth of the way down: leaving, as the next words arrive.
  await page
    .locator('[data-story-scene]')
    .first()
    .evaluate((el) => {
      const bottom = el.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo(0, bottom - innerHeight * 0.2);
    });
  await page.waitForTimeout(1200);
  const leaving = (await sceneState(page)).zoom;
  expect(entering).toBeGreaterThan(1.15);
  expect(held).toBeLessThan(entering);
  expect(held).toBeGreaterThanOrEqual(1);
  expect(leaving).toBeGreaterThan(held);
});

test('the photo washes into her colour as the next text arrives, then leaves', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  // The text section after the first scene, half-way up the screen.
  await placeTop(page, '[data-panel]', 0.5, 1);
  const { wash } = await sceneState(page);
  expect(wash).toBeGreaterThan(0.5);
  // A veil of colour, not a slab: capped, and graded from the words' side.
  expect(wash).toBeLessThanOrEqual(0.7);
  const fill = await page
    .locator('[data-wash]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(fill).toContain('linear-gradient');
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

test('text sections carry her flowers in ink, turned 90° and 180°', async ({
  page,
}) => {
  await page.goto('/');
  const flowers = await page
    .locator('[data-panel] [data-flowers]')
    .evaluateAll((els) =>
      els.map((el) => {
        const img = el.querySelector('img')!;
        return {
          rotate: getComputedStyle(el).rotate,
          opacity: Number(getComputedStyle(el).opacity),
          mono: img.getAttribute('srcset')!.includes('sat=-100'),
          ink: getComputedStyle(el.querySelector('[data-media]')!).filter,
        };
      }),
    );
  expect(flowers.length).toBeGreaterThanOrEqual(2);
  expect(flowers.map((f) => f.rotate)).toEqual(
    expect.arrayContaining(['90deg', '180deg']),
  );
  for (const f of flowers) {
    expect(f.mono).toBe(true);
    expect(f.ink).toContain('url(');
    expect(f.opacity).toBeGreaterThanOrEqual(0.65);
    expect(f.opacity).toBeLessThanOrEqual(0.75);
  }
});

test('the flowers stay clear of the words', async ({ page }) => {
  await page.goto('/');
  const overlaps = await page.locator('[data-panel]').evaluateAll((panels) =>
    panels.map((panel) => {
      const t = panel
        .querySelector('[data-panel-text]')!
        .getBoundingClientRect();
      const f = panel.querySelector('[data-flowers]')!.getBoundingClientRect();
      const w = Math.max(
        0,
        Math.min(t.right, f.right) - Math.max(t.left, f.left),
      );
      const h = Math.max(
        0,
        Math.min(t.bottom, f.bottom) - Math.max(t.top, f.top),
      );
      return Math.round(((w * h) / (t.width * t.height)) * 100) / 100;
    }),
  );
  expect(overlaps.length).toBeGreaterThan(0);
  for (const o of overlaps) expect(o).toBeLessThan(0.25);
});

test('no flowers lie over her painting while it shows', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const vh = page.viewportSize()!.height;
  for (const y of [0.5, 0.75, 1, 1.25, 1.5]) {
    await page.evaluate((y) => window.scrollTo(0, y), y * vh);
    await page.waitForTimeout(800);
    // Grid points over the painting where a spray's drawing has been
    // uncovered (a sweep window's own box reaches past its art; only the
    // drawing inside it counts).
    const overlap = await page.evaluate(() => {
      const art = document.querySelector('[data-scene="hero"] [data-art]')!;
      if (window.opacityOf(art) < 0.1) return 0;
      const a = art.getBoundingClientRect();
      const top = Math.max(a.top, 0);
      const bottom = Math.min(a.bottom, innerHeight);
      let hits = 0;
      for (let i = 0.5; i < 12; i++)
        for (let j = 0.5; j < 12; j++) {
          const x = a.left + ((a.right - a.left) * i) / 12;
          const y = top + ((bottom - top) * j) / 12;
          if (
            document
              .elementsFromPoint(x, y)
              .some((el) => el.matches('[data-flowers] [data-wipe] img'))
          )
            hits++;
        }
      return hits;
    });
    expect(overlap, `at ${y} screens`).toBe(0);
  }
});

test('flowers leave with the words before the next photo', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  // The heading section hands over to the first photo.
  await placeTop(page, '[data-story-scene]', 0.6);
  const flowers = await page
    .locator('[data-panel] [data-flowers]')
    .first()
    .evaluate((el) => window.opacityOf(el));
  expect(flowers).toBeLessThan(0.05);
});

test('the flowers grow as they scroll into view', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const flowers = page.locator('[data-panel] [data-flowers]').nth(1);
  // Scroll so the box's top (or centre) sits at `at` of the screen.
  const place = async (edge: 'top' | 'center', at: number) => {
    await flowers.evaluate(
      (el, [edge, at]) => {
        const r = el.getBoundingClientRect();
        const y = edge === 'top' ? r.top : r.top + r.height / 2;
        window.scrollTo(0, window.scrollY + y - innerHeight * Number(at));
      },
      [edge, at] as const,
    );
    await page.waitForTimeout(1200);
  };
  // Share of the box's visible part that the sweep has uncovered.
  const uncovered = () =>
    flowers.evaluate((box) => {
      // Visible part: inside the screen and its section (which clips it).
      const r = box.getBoundingClientRect();
      const p = box.closest('[data-panel]')!.getBoundingClientRect();
      const top = Math.max(r.top, p.top, 0);
      const bottom = Math.min(r.bottom, p.bottom, innerHeight);
      const left = Math.max(r.left, p.left, 0);
      const right = Math.min(r.right, p.right, innerWidth);
      let hits = 0;
      for (let i = 0.5; i < 6; i++)
        for (let j = 0.5; j < 6; j++) {
          const x = left + ((right - left) * i) / 6;
          const y = top + ((bottom - top) * j) / 6;
          if (
            document
              .elementsFromPoint(x, y)
              .some((el) => box.contains(el) && el.closest('[data-wipe]'))
          )
            hits++;
        }
      return hits / 36;
    });
  await place('top', 0.85);
  const early = await uncovered();
  await place('center', 0.25);
  const late = await uncovered();
  expect(late).toBeGreaterThan(0.8);
  expect(late - early).toBeGreaterThan(0.3);
});

test('the last flowers draw themselves as the story ends', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(2800);
  // Share of the closing spray's visible part that is uncovered.
  const uncovered = await page.locator('[data-closing]').evaluate((closing) => {
    const panel = closing.closest('[data-panel]')!;
    const box = panel.querySelector('[data-flowers]')!;
    const r = box.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const top = Math.max(r.top, p.top, 0);
    const bottom = Math.min(r.bottom, p.bottom, innerHeight);
    const left = Math.max(r.left, p.left, 0);
    const right = Math.min(r.right, p.right, innerWidth);
    let hits = 0;
    for (let i = 0.5; i < 6; i++)
      for (let j = 0.5; j < 6; j++) {
        const x = left + ((right - left) * i) / 6;
        const y = top + ((bottom - top) * j) / 6;
        if (
          document
            .elementsFromPoint(x, y)
            .some((el) => el.matches('[data-flowers] [data-wipe] img'))
        )
          hits++;
      }
    return hits / 36;
  });
  expect(uncovered).toBeGreaterThan(0.8);
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

test('on phones the pair photos stack, large', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, 'phones only');
  await page.goto('/');
  const rects = await page
    .locator('[data-pair] [data-reveal]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          width: r.width / innerWidth,
          left: r.left / innerWidth,
          top: r.top,
          bottom: r.bottom,
        };
      }),
    );
  expect(rects).toHaveLength(2);
  for (const r of rects) expect(r.width).toBeGreaterThan(0.78);
  expect(rects[1]!.top).toBeGreaterThan(rects[0]!.bottom);
  // Offset clearly to either side, not by an accidental few pixels.
  expect(Math.abs(rects[0]!.left - rects[1]!.left) * 390).toBeGreaterThan(45);
});

test('pair photos settle from a zoom inside their frames', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const scale = () =>
    page
      .locator('[data-pair] [data-reveal] img')
      .first()
      .evaluate((img) => {
        const s = getComputedStyle(img).scale;
        return s === 'none' ? 1 : parseFloat(s);
      });
  await placeTop(page, '[data-pair] [data-reveal]', 0.9);
  expect(await scale()).toBeGreaterThan(1.05);
  await placeTop(page, '[data-pair] [data-reveal]', 0.2);
  expect(await scale()).toBeLessThan(1.01);
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

test('text sections vary in placement and scale', async ({ page }) => {
  await page.goto('/');
  const panels = await page
    .locator('[data-panel] [data-panel-text]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const h3 = el.querySelector('h3');
        return {
          placement: `${Math.round(((r.left + r.width / 2) / innerWidth) * 10)}:${getComputedStyle(el).textAlign}`,
          size: h3 ? parseFloat(getComputedStyle(h3).fontSize) : null,
        };
      }),
    );
  expect(new Set(panels.map((p) => p.placement)).size).toBeGreaterThanOrEqual(
    2,
  );
  // One section carries a larger statement line.
  const sizes = panels.flatMap((p) => (p.size ? [p.size] : []));
  expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(1.2);
});

test('headings wrap balanced and body text without a lone last word', async ({
  page,
}) => {
  await page.goto('/');
  const wraps = await page.locator('[data-panel-text]').evaluateAll((els) =>
    els.map((el) => ({
      heading: getComputedStyle(el.querySelector('h2, h3')!).textWrapStyle,
      body: getComputedStyle(el.querySelector('p')!).textWrapStyle,
    })),
  );
  expect(wraps.length).toBeGreaterThan(0);
  for (const w of wraps)
    expect(w).toEqual({ heading: 'balance', body: 'pretty' });
});

test('the words read in full ink, the price at body size', async ({ page }) => {
  await page.goto('/');
  const INK = 'rgb(59, 35, 64)';
  const bodies = await page
    .locator('[data-panel-text] h3 + p')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
  expect(bodies.length).toBeGreaterThan(0);
  for (const c of bodies) expect(c).toBe(INK);
  const price = await page
    .locator('[data-scene="portfolio"] p', { hasText: '₪' })
    .first()
    .evaluate((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      color: getComputedStyle(el).color,
    }));
  expect(price.size).toBeGreaterThanOrEqual(18);
  expect(price.color).toBe(INK);
});

test('the story ends on a clear way to book', async ({ page }) => {
  await page.goto('/');
  // The last block of the story holds the action.
  const last = await page
    .locator('[data-scene="portfolio"]')
    .evaluate((section) => {
      const blocks = [...section.children].filter(
        (el) => el.tagName !== 'SCRIPT',
      );
      return blocks.at(-1)!.querySelectorAll('[data-closing] a').length;
    });
  expect(last).toBe(1);
  const action = page.locator('[data-closing] a');
  expect(await action.getAttribute('href')).toBeTruthy();
  const box = (await action.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(56);
  expect(box.width).toBeGreaterThanOrEqual(240);
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
