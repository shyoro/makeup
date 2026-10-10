/**
 * The ONLY place an absolute origin is written in this codebase.
 *
 * Canonical tags, OG image URLs, the sitemap, JSON-LD and the Worker's CORS
 * allowlist all derive from SITE_URL. Hardcode an origin anywhere else and the
 * Phase 7 domain cutover becomes a hunt instead of a one-line edit.
 */
export const SITE_URL = 'https://makeup.workers.dev';

/**
 * True while the site is on the temporary workers.dev origin. Google must not
 * index a URL we are about to abandon — that builds SEO equity we would then
 * have to salvage with redirects. Flipped to false in Phase 7.
 */
export const NOINDEX = true;

/** Joins a path onto SITE_URL, tolerating a leading slash or its absence. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}
