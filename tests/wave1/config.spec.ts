import { test, expect } from '@playwright/test';
import { SITE_URL, NOINDEX, absoluteUrl } from '../../web/src/config';

test('SITE_URL is an absolute origin with no trailing slash', () => {
  expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
});

test('noindex is on while the site lives on workers.dev', () => {
  expect(NOINDEX).toBe(true);
});

test('absoluteUrl joins without doubling or dropping the slash', () => {
  expect(absoluteUrl('/about')).toBe(`${SITE_URL}/about`);
  expect(absoluteUrl('about')).toBe(`${SITE_URL}/about`);
  expect(absoluteUrl('/')).toBe(`${SITE_URL}/`);
});
