import { test, expect } from '@playwright/test';

// Behavioural tests: assert what utilities actually DO to rendered elements,
// not implementation details like whether Tailwind also happens to emit a
// `--color-*` custom property at `:root` (it does not, in Tailwind 4.3.3 —
// confirmed empirically. A test asserting otherwise would fail against a
// CORRECT contract). See task-4-5-report.md for the full reasoning and the
// fix-round-1 addendum for why these tests were rewritten.

test('the *.astro source glob actually generates utilities, not just the safelist', async ({
  page,
}) => {
  // Every OTHER test in this file probes classes injected from JS at
  // runtime, and every one of those classes is ALSO in global.css's
  // @source inline() safelist — so those tests would pass identically
  // even if the `@source "../**/*.{astro,md,mdx}"` glob silently matched
  // nothing. This test exists solely to prove the glob itself resolves,
  // by checking a real, already-rendered element (web/src/pages/
  // index.astro's <h1 class="mt-4">) whose class is deliberately NOT in
  // the safelist. It is not testing that h1 should have this margin; it
  // is testing that markup-sourced utilities generate at all.
  await page.goto('/');
  const marginTop = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? getComputedStyle(h1).marginTop : null;
  });
  expect(
    marginTop,
    'h1.mt-4 from index.astro must resolve via the *.astro source glob',
  ).toBe('16px');
});

test('locked breakpoints: md is exactly 48rem, lg is exactly 80rem, sm/xl/2xl do not exist', async ({
  page,
}) => {
  await page.goto('/');

  async function displayOf(className: string) {
    return page.evaluate((cls) => {
      const el = document.createElement('div');
      el.className = cls;
      el.textContent = 'probe';
      document.body.append(el);
      const display = getComputedStyle(el).display;
      el.remove();
      return display;
    }, className);
  }

  // md:hidden must hide at >=768px (48rem) and show below it.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await displayOf('md:hidden'),
    'md:hidden must NOT hide below 768px',
  ).not.toBe('none');

  await page.setViewportSize({ width: 820, height: 1180 });
  expect(
    await displayOf('md:hidden'),
    'md:hidden must hide at/above 768px',
  ).toBe('none');

  // lg:hidden is pinned to exactly 80rem (1280px), not Tailwind's own
  // default lg (64rem / 1024px). A later agent "fixing" --breakpoint-lg
  // back to Tailwind's default would pass every other test in this file
  // while breaking the entire 1024-1280px band; this is the only assertion
  // that would catch it.
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(
    await displayOf('lg:hidden'),
    'lg:hidden must NOT hide at 1024px (below 80rem)',
  ).not.toBe('none');

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(
    await displayOf('lg:hidden'),
    'lg:hidden must hide at 1440px (at/above 80rem)',
  ).toBe('none');

  // Tailwind's default sm: (40rem / 640px) must have been cleared: a
  // sm:hidden element must NOT hide at 700px, because sm: no longer exists
  // as a variant at all.
  await page.setViewportSize({ width: 700, height: 900 });
  expect(await displayOf('sm:hidden'), 'sm: must not exist').not.toBe('none');

  // xl: (80rem default) and 2xl: (96rem default) must also not exist as
  // variants, at any viewport we test elsewhere in this file.
  for (const width of [390, 820, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await displayOf('xl:hidden'),
      `xl: must not exist (checked at ${width}px)`,
    ).not.toBe('none');
    expect(
      await displayOf('2xl:hidden'),
      `2xl: must not exist (checked at ${width}px)`,
    ).not.toBe('none');
  }
});

test('semantic role tokens: every utility renders exactly what its --role-* primitive specifies', async ({
  page,
}) => {
  await page.goto('/');

  // Table-driven so adding a role to the contract without adding it here
  // is the only silent path (per fix-round-1 F2). For each entry: read the
  // named --role-* primitive directly off :root (never through the utility
  // chain, so a rename of the primitive is visible on its own), assert it
  // is non-empty (catches deletion/rename outright — this alone is what a
  // renamed --role-ink would fail, even though `color` inherits and never
  // reads as '' / transparent), then cross-check that the utility actually
  // renders that exact value (via the browser's own color parser, so
  // cosmetic serialization differences like "22%" vs "0.22" don't matter).
  const colorRoles: Array<{
    role: string;
    className: string;
    prop: 'backgroundColor' | 'color' | 'borderColor';
  }> = [
    {
      role: '--role-surface',
      className: 'bg-surface',
      prop: 'backgroundColor',
    },
    {
      role: '--role-surface-raised',
      className: 'bg-surface-raised',
      prop: 'backgroundColor',
    },
    { role: '--role-ink', className: 'text-ink', prop: 'color' },
    { role: '--role-ink-muted', className: 'text-ink-muted', prop: 'color' },
    { role: '--role-accent', className: 'bg-accent', prop: 'backgroundColor' },
    { role: '--role-on-accent', className: 'text-on-accent', prop: 'color' },
    {
      role: '--role-hairline',
      className: 'border-hairline',
      prop: 'borderColor',
    },
  ];

  for (const { role, className, prop } of colorRoles) {
    const result = await page.evaluate(
      ({ role, className, prop }) => {
        const raw = getComputedStyle(document.documentElement)
          .getPropertyValue(role)
          .trim();

        const el = document.createElement('div');
        el.className = className;
        document.body.append(el);
        const computed =
          getComputedStyle(el)[
            prop as 'backgroundColor' | 'color' | 'borderColor'
          ];
        el.remove();

        // Canonicalize both sides through the browser's own color parser
        // (canvas fillStyle), so "oklch(22% .005 60)" (raw, author syntax)
        // and "oklch(0.22 0.005 60)" (computed, normalized) compare equal
        // when they are the same color, and compare unequal when they are
        // genuinely different (including when `raw` is '' / invalid).
        function canonical(value: string): string | null {
          if (!value) return null;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#010203'; // sentinel: detects a no-op (invalid) assignment
          ctx.fillStyle = value;
          if (ctx.fillStyle === '#010203' && value !== '#010203') return null;
          return ctx.fillStyle;
        }

        return {
          raw,
          computed,
          canonicalRaw: canonical(raw),
          canonicalComputed: canonical(computed),
        };
      },
      { role, className, prop },
    );

    expect(result.raw, `${role} must be defined (non-empty) at :root`).not.toBe(
      '',
    );
    expect(
      result.canonicalRaw,
      `${role} must parse as a real color`,
    ).not.toBeNull();
    expect(
      result.canonicalComputed,
      `${className}'s computed ${prop} must equal ${role} (got raw=${result.raw}, computed=${result.computed})`,
    ).toBe(result.canonicalRaw);
  }
});

test('type role utilities resolve to the configured font families', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    function fontOf(className: string) {
      const el = document.createElement('div');
      el.className = className;
      document.body.append(el);
      const value = getComputedStyle(el).fontFamily;
      el.remove();
      return value;
    }
    return {
      display: fontOf('font-display'),
      ui: fontOf('font-ui'),
    };
  });
  expect(result.display).toContain('Frank Ruhl Libre');
  expect(result.ui).toContain('Assistant');
});

test('radius and section-spacing tokens: utilities render exactly what their --role-* primitive specifies', async ({
  page,
}) => {
  await page.goto('/');

  const result = await page.evaluate(() => {
    function pxFor(
      rawValue: string,
      styleProp: 'borderRadius' | 'paddingBlock',
    ) {
      const scratch = document.createElement('div');
      (scratch.style as unknown as Record<string, string>)[styleProp] =
        rawValue;
      document.body.append(scratch);
      const computed =
        styleProp === 'borderRadius'
          ? getComputedStyle(scratch).borderRadius
          : getComputedStyle(scratch).paddingTop;
      scratch.remove();
      return computed;
    }

    const rawRadius = getComputedStyle(document.documentElement)
      .getPropertyValue('--role-radius-card')
      .trim();
    const rawSpace = getComputedStyle(document.documentElement)
      .getPropertyValue('--role-space-section')
      .trim();

    const radiusEl = document.createElement('div');
    radiusEl.className = 'rounded-card';
    document.body.append(radiusEl);
    const radiusComputed = getComputedStyle(radiusEl).borderRadius;
    radiusEl.remove();

    const spaceEl = document.createElement('div');
    spaceEl.className = 'py-section';
    document.body.append(spaceEl);
    const spaceComputed = getComputedStyle(spaceEl).paddingTop;
    spaceEl.remove();

    return {
      rawRadius,
      rawSpace,
      radiusComputed,
      spaceComputed,
      radiusExpected: rawRadius ? pxFor(rawRadius, 'borderRadius') : null,
      spaceExpected: rawSpace ? pxFor(rawSpace, 'paddingBlock') : null,
    };
  });

  expect(
    result.rawRadius,
    '--role-radius-card must be defined (non-empty) at :root',
  ).not.toBe('');
  expect(
    result.rawSpace,
    '--role-space-section must be defined (non-empty) at :root',
  ).not.toBe('');
  expect(
    result.radiusComputed,
    'rounded-card must render --role-radius-card',
  ).toBe(result.radiusExpected);
  expect(
    result.spaceComputed,
    'py-section must render --role-space-section',
  ).toBe(result.spaceExpected);
});

test('locked aspect ratios are available as utilities', async ({ page }) => {
  await page.goto('/');
  const ratios = await page.evaluate(() => {
    // Class names are written as literal strings (not built via template
    // interpolation) so Tailwind's static source scanner can see them as
    // candidates and generate the utilities. They are also declared in the
    // @source inline(...) safelist in global.css, which is the actual
    // source of truth for what ships to production.
    function ratioOf(className: string) {
      const el = document.createElement('div');
      el.className = className;
      document.body.append(el);
      const value = getComputedStyle(el).aspectRatio;
      el.remove();
      return value;
    }
    return {
      hero: ratioOf('aspect-hero'),
      portrait: ratioOf('aspect-portrait'),
      editorial: ratioOf('aspect-editorial'),
      avatar: ratioOf('aspect-avatar'),
    };
  });
  expect(ratios.hero).toBe('16 / 9');
  expect(ratios.portrait).toBe('4 / 5');
  expect(ratios.editorial).toBe('3 / 2');
  expect(ratios.avatar).toBe('1 / 1');
});
