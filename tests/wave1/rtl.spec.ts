import { test, expect } from '@playwright/test';

test('document is Hebrew and right-to-left', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'he');
  await expect(html).toHaveAttribute('dir', 'rtl');
});

test('noindex is present while on workers.dev', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});

test('Hebrew text renders in the intended face, not a Latin fallback', async ({
  page,
}) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();

  // getComputedStyle(el).fontFamily only reports the DECLARED family list —
  // it reports the same string whether or not the browser actually found a
  // face to shape the glyphs with, so it would pass even on a full Latin
  // fallback with tofu boxes everywhere. document.fonts.check() reports
  // real face availability instead: it returns true only if a matching,
  // loaded FontFace exists for that font string.
  const [headingFaceAvailable, headingDeclaredFamily, uiFaceAvailable] =
    await page.evaluate(async () => {
      await document.fonts.ready;
      const h1 = document.querySelector('h1');
      return [
        document.fonts.check('1em "Frank Ruhl Libre"'),
        h1 ? getComputedStyle(h1).fontFamily : '',
        // Body copy uses font-ui (Assistant); assert its face loaded too.
        document.fonts.check('1em "Assistant"'),
      ];
    });

  expect(
    headingFaceAvailable,
    'Frank Ruhl Libre face must actually be available/loaded',
  ).toBe(true);
  expect(headingDeclaredFamily).toContain('Frank Ruhl Libre');
  expect(
    uiFaceAvailable,
    'Assistant face must actually be available/loaded',
  ).toBe(true);
});

test('text flows from the right edge', async ({ page }) => {
  await page.goto('/');
  const box = await page.getByRole('heading', { level: 1 }).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  // In RTL the heading's right edge sits near the viewport's right edge.
  const gapRight = viewport!.width - (box!.x + box!.width);
  expect(gapRight).toBeLessThan(viewport!.width / 2);
});

test('no horizontal overflow at any locked viewport', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// The `brand-he` skill states as a hard rule that the shekel sign shares the
// dir="ltr" wrapper WITH its digits. Both `<span dir="ltr">450</span> ₪` and
// `<span dir="ltr">450</span><span dir="ltr">₪</span>` let the sign reorder
// away from its number in RTL flow, so "has some LTR ancestor" is too weak a
// predicate -- the sign and the digits must resolve to the SAME wrapper.
// Until this test existed the rule was documented but unenforced.
test('every shekel sign shares a dir="ltr" wrapper with its digits', async ({
  page,
}) => {
  await page.goto('/');

  const signs = await page.evaluate(() => {
    const found: { text: string; wrapper: string | null }[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent;
      if (!text || !text.includes('₪')) continue;
      const wrapper = n.parentElement?.closest('[dir="ltr"]');
      found.push({
        text: text.trim(),
        wrapper: wrapper ? (wrapper.textContent ?? '') : null,
      });
    }
    return found;
  });

  const orphaned = signs.filter(
    (s) => s.wrapper === null || !/[0-9]/.test(s.wrapper),
  );
  expect(orphaned).toEqual([]);

  // Non-vacuity, asserted LAST on purpose: a page with no shekel sign would
  // satisfy the check above without exercising it, but putting this first
  // meant a real regression aborted here and reported the wrong problem.
  expect(signs.length).toBeGreaterThan(0);
});
