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
        return (
          r.bottom > innerHeight * 0.2 &&
          r.top < innerHeight * 0.8 &&
          r.right > innerWidth * 0.2 &&
          r.left < innerWidth * 0.8
        );
      };
      const most = (els: Element[]) =>
        Math.max(0, ...els.map((el) => window.opacityOf(el)));
      const photo = most([
        ...document.querySelectorAll('[data-story-scene] [data-fade]'),
      ]);
      const content = most(
        [
          ...document.querySelectorAll(
            '[data-panel-text], [data-slide] [data-media], [data-scene="hero"] [data-art]',
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
    expect(f.opacity).toBeGreaterThanOrEqual(0.55);
    expect(f.opacity).toBeLessThanOrEqual(0.65);
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

test('the flowers grow as their section scrolls through', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const flowers = page.locator('[data-panel] [data-flowers]').nth(1);
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
      if (bottom <= top || right <= left) return 0;
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
  // Its section follows a photo: nothing grows until that has gone.
  await placeTop(page, '[data-panel]', 0.3, 1);
  const early = await uncovered();
  await placeTop(page, '[data-panel]', -0.45, 1);
  const late = await uncovered();
  expect(early).toBe(0);
  expect(late).toBeGreaterThan(0.8);
});

test('the growing spray has a soft leading edge, without a moving mask', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const edges = await page
    .locator('[data-flowers] [data-wipe]')
    .evaluateAll((wins) =>
      wins.map((win) => {
        const feather = win.querySelector<HTMLElement>(
          ':scope > [data-feather]',
        );
        const w = (win as HTMLElement).offsetWidth;
        return {
          // A moving mask re-rasterises every frame.
          mask: getComputedStyle(win).maskImage,
          fill: feather ? getComputedStyle(feather).backgroundImage : 'none',
          // The fade sits on the window's leading (far) end.
          end: feather
            ? Math.abs(feather.offsetLeft + feather.offsetWidth - w)
            : w,
          share: feather ? feather.offsetWidth / w : 0,
        };
      }),
    );
  expect(edges.length).toBeGreaterThan(0);
  for (const e of edges) {
    expect(e.mask).toBe('none');
    expect(e.fill).toContain('linear-gradient');
    expect(e.end).toBeLessThanOrEqual(1);
    expect(e.share).toBeGreaterThan(0.2);
  }
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

/** How far each pair photo sits from its place, in widths; + is right. */
function pairOffsets(page: Page) {
  return page.locator('[data-pair] [data-slide]').evaluateAll((slots) =>
    slots.map((slot) => {
      const place = slot.getBoundingClientRect();
      const photo = slot.querySelector('[data-media]')!.getBoundingClientRect();
      return (photo.left - place.left) / place.width;
    }),
  );
}

test('pair photos slide in with scroll, the first from the right and the second from the left', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const slots = '[data-pair] [data-slide]';
  for (const [i, side] of [
    [0, 1],
    [1, -1],
  ] as const) {
    await placeTop(page, slots, 0.95, i);
    const entering = (await pairOffsets(page))[i]! * side;
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await placeTop(page, slots, 0.6, i);
    const partway = (await pairOffsets(page))[i]! * side;
    // Centred on screen.
    await page
      .locator(slots)
      .nth(i)
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        window.scrollTo(
          0,
          r.top + window.scrollY + r.height / 2 - innerHeight / 2,
        );
      });
    await page.waitForTimeout(1200);
    const centred = (await pairOffsets(page))[i]!;
    expect(entering).toBeGreaterThan(0.5);
    expect(partway).toBeGreaterThan(0.02);
    expect(partway).toBeLessThan(entering);
    expect(Math.abs(centred)).toBeLessThan(0.01);
  }
});

test('pair photos run the full width, one under the other, in 5px frames', async ({
  page,
}) => {
  await page.goto('/');
  const rects = await page
    .locator('[data-pair] [data-slide]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, gutters: innerWidth - r.width, ...r.toJSON() };
      }),
    );
  expect(rects).toHaveLength(2);
  for (const r of rects) expect(r.gutters).toBeLessThanOrEqual(48);
  expect(rects[1]!.top).toBeGreaterThan(rects[0]!.bottom);
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

test('pair slots keep their shape before images load: 4:5 on phones, 16:9 wider', async ({
  page,
}) => {
  await page.route('**/cdn.sanity.io/**', () => {
    // never respond: images stay pending
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const ratio = page.viewportSize()!.width < 768 ? 4 / 5 : 16 / 9;
  const ratios = await page
    .locator('[data-pair] [data-media]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.width / r.height;
      }),
    );
  expect(ratios.length).toBeGreaterThan(0);
  for (const r of ratios) expect(Math.abs(r - ratio)).toBeLessThan(0.01);
});

test('a full-screen photo holds the screen on its own for under a screen of scroll', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  // In tenths of a screen: how long the photo is on screen, and how long with
  // no words over or around it, while nothing but the photo is to be seen.
  let shown = 0;
  let alone = 0;
  for (let at = 1; at > -1.05; at -= 0.1) {
    await page
      .locator('[data-story-scene]')
      .first()
      .evaluate((el, at) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - window.innerHeight * at);
      }, at);
    await page.waitForTimeout(650);
    const s = await page.evaluate(() => ({
      photo: window.opacityOf(
        document.querySelector('[data-story-scene] [data-fade]')!,
      ),
      words: [...document.querySelectorAll('[data-panel-text]')].some((t) => {
        const r = t.getBoundingClientRect();
        return window.opacityOf(t) > 0.3 && r.bottom > 0 && r.top < innerHeight;
      }),
    }));
    if (s.photo > 0.5) shown++;
    if (s.photo > 0.5 && !s.words) alone++;
  }
  expect(alone / 10).toBeLessThan(1);
  expect(shown / 10).toBeLessThanOrEqual(1.2);
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
  // Centred body text wraps in even lines too.
  const wraps = await page.locator('[data-panel-text]').evaluateAll((els) =>
    els.map((el) => {
      const p = el.querySelector('p')!;
      return {
        heading: getComputedStyle(el.querySelector('h2, h3')!).textWrapStyle,
        body: getComputedStyle(p).textWrapStyle,
        centred: getComputedStyle(p).textAlign === 'center',
      };
    }),
  );
  expect(wraps.length).toBeGreaterThan(0);
  expect(wraps.some((w) => w.centred)).toBe(true);
  for (const { centred, ...w } of wraps)
    expect(w).toEqual({
      heading: 'balance',
      body: centred ? 'balance' : 'pretty',
    });
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
      const blocks = [
        ...section.querySelectorAll(
          ':scope > [data-panel], :scope > [data-story-scene], :scope > [data-pair]',
        ),
      ];
      return blocks.at(-1)!.querySelectorAll('[data-closing] > a').length;
    });
  expect(last).toBe(1);
  const action = page.locator('[data-closing] > a');
  expect(await action.getAttribute('href')).toBeTruthy();
  const box = (await action.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(56);
  expect(box.width).toBeGreaterThanOrEqual(240);
});

test('the closing opens a WhatsApp chat, with her number large to call', async ({
  page,
}) => {
  // Built with playwright.config.ts's fake number and chat link.
  await page.goto('/');
  const chat = page.locator('[data-closing] > a');
  expect(await chat.getAttribute('href')).toMatch(
    /^https:\/\/wa\.me\/972500000000\?text=/,
  );
  await expect(chat).toHaveAttribute('target', '_blank');
  expect(await chat.getAttribute('rel')).toContain('noopener');
  await expect(chat).toContainText('וואטסאפ');
  // Tapping the number opens the dialer, on iOS and Android alike.
  const call = page.locator('[data-closing] [data-phone]');
  await expect(call).toHaveAttribute('href', 'tel:+972500000000');
  await expect(call.locator('bdi[dir="ltr"]')).toHaveText('050-000-0000');
  const size = await call.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  expect(size).toBeGreaterThanOrEqual(
    page.viewportSize()!.width >= 768 ? 48 : 30,
  );
  expect((await call.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});

test('the closing spray keeps clear of the actions', async ({ page }) => {
  await page.goto('/');
  const gap = await page.locator('[data-closing]').evaluate((closing) => {
    const f = closing
      .closest('[data-panel]')!
      .querySelector('[data-flowers]')!
      .getBoundingClientRect();
    // Positive when the two boxes are apart along either axis.
    const apart = (a: DOMRect) =>
      Math.max(
        a.left - f.right,
        f.left - a.right,
        a.top - f.bottom,
        f.top - a.bottom,
      );
    return Math.min(
      ...[...closing.querySelectorAll('a')].map((a) =>
        apart(a.getBoundingClientRect()),
      ),
    );
  });
  expect(gap).toBeGreaterThanOrEqual(24);
});

/**
 * Ink the closing's flowers lay near its words and actions once drawn: dark
 * pixels within `margin` of each line of text and each action, one count per
 * box.
 */
async function closingInk(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(2800);
  const margin = page.viewportSize()!.width >= 768 ? 24 : 16;
  // Every line of text and every action as laid out; then they go, so a
  // screenshot shows only what lies around them.
  const boxes = await page.locator('[data-closing]').evaluate((closing, m) => {
    const rects: DOMRect[] = [];
    for (const el of closing.querySelectorAll('h3, p')) {
      const range = document.createRange();
      range.selectNodeContents(el);
      rects.push(...range.getClientRects());
    }
    for (const a of closing.querySelectorAll('a'))
      rects.push(a.getBoundingClientRect());
    closing.closest<HTMLElement>('[data-panel-text]')!.style.visibility =
      'hidden';
    return rects.map((r) => ({
      x: Math.max(r.x - m, 0),
      y: Math.max(r.y - m, 0),
      right: Math.min(r.right + m, innerWidth),
      bottom: Math.min(r.bottom + m, innerHeight),
    }));
  }, margin);
  const shot = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ shot, boxes }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${shot}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const k = img.width / innerWidth;
      return boxes.map((b) => {
        const d = g.getImageData(
          b.x * k,
          b.y * k,
          (b.right - b.x) * k,
          (b.bottom - b.y) * k,
        );
        let dark = 0;
        for (let i = 0; i < d.data.length; i += 4)
          if (d.data[i] + d.data[i + 1] + d.data[i + 2] < 600) dark++;
        return dark;
      });
    },
    { shot, boxes },
  );
}

// A few specks of scan grain are allowed.
test('the closing flowers keep clear of its words and actions', async ({
  page,
}) => {
  for (const dark of await closingInk(page))
    expect(dark).toBeLessThanOrEqual(8);
});

test('the closing flowers keep clear on a small laptop too', async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width < 1280, 'laptops only');
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const dark of await closingInk(page))
    expect(dark).toBeLessThanOrEqual(8);
});

test('on phones a WhatsApp tile shows between the first photo and the closing', async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width >= 768, 'phones only');
  await page.goto('/');
  await page.waitForLoadState('load');
  const tile = page.locator('[data-chat-tile]');
  const shown = () =>
    tile.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && Number(s.opacity) > 0.9;
    });
  expect(await shown()).toBe(false);
  await placeTop(page, '[data-story-scene]', 0);
  expect(await shown()).toBe(false);
  await placeTop(page, '[data-panel]', -0.1, 1);
  expect(await shown()).toBe(true);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(800);
  expect(await shown()).toBe(false);
  const link = tile.locator('a');
  expect(await link.getAttribute('href')).toMatch(
    /^https:\/\/wa\.me\/972500000000/,
  );
  await expect(link).toHaveAttribute('aria-label', /וואטסאפ/);
});

test('on phones the tile arrives once the first photo has gone, clear of the words', async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width >= 768, 'phones only');
  await page.goto('/');
  await page.waitForLoadState('load');
  const panel = '[data-story-scene] ~ [data-panel]';
  await placeTop(page, panel, 1);
  // Scroll on in small steps until the tile shows.
  const shown = () =>
    page
      .locator('[data-chat-tile]')
      .evaluate((el) => getComputedStyle(el).visibility !== 'hidden');
  for (let at = 1; at > -0.5 && !(await shown()); at -= 0.03) {
    await page
      .locator(panel)
      .first()
      .evaluate((el, at) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - window.innerHeight * at);
      }, at);
    await page.waitForTimeout(300);
  }
  expect(await shown()).toBe(true);
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => {
    const tile = document
      .querySelector('[data-chat-tile] a')!
      .getBoundingClientRect();
    // Lines of words on screen that the tile covers.
    let covered = 0;
    for (const el of document.querySelectorAll(
      '[data-panel-text] :is(h2, h3, p)',
    )) {
      if (window.opacityOf(el) < 0.1) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of range.getClientRects())
        if (
          r.right > tile.left &&
          r.left < tile.right &&
          r.bottom > tile.top &&
          r.top < tile.bottom
        )
          covered++;
    }
    return {
      photo: window.opacityOf(
        document.querySelector('[data-story-scene] [data-fade]')!,
      ),
      covered,
    };
  });
  expect(state.photo).toBeLessThan(0.05);
  expect(state.covered).toBe(0);
});

test('no WhatsApp tile on tablets and desktops', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, 'tablets and desktops only');
  await page.goto('/');
  await placeTop(page, '[data-panel]', 0.2, 1);
  await expect(page.locator('[data-chat-tile]')).toBeHidden();
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
  // No call to action leaks into the opening, and the closing keeps both.
  await expect(page.locator('[data-chat-tile]')).toBeHidden();
  await expect(page.locator('[data-closing] > a')).toBeVisible();
  await expect(page.locator('[data-closing] [data-phone]')).toBeVisible();
  // The pair's photos in place.
  const photos = await page
    .locator('[data-pair] [data-media]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
  expect(photos.length).toBeGreaterThan(0);
  for (const t of photos) expect(t).toBe('none');
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
