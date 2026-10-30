import { createImageUrlBuilder } from '@sanity/image-url';
import type { AspectName, SanityImageRef } from './types';

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET;

// Fail the build loudly rather than ship broken image addresses.
if (!projectId) throw new Error('Missing PUBLIC_SANITY_PROJECT_ID');
if (!dataset) throw new Error('Missing PUBLIC_SANITY_DATASET');

const builder = createImageUrlBuilder({ projectId, dataset });

// Width ÷ height for each locked ratio; mirrors --aspect-* in theme-contract.css.
const RATIO: Record<AspectName, number> = {
  hero: 16 / 9,
  portrait: 4 / 5,
  editorial: 3 / 2,
  avatar: 1,
};

const DEFAULT_WIDTHS = [400, 800, 1200, 1600];

/**
 * 'cover'   crops to the locked ratio at the CDN and fills the slot.
 * 'contain' keeps the whole asset and fits it inside the slot (cut-out art).
 * 'fill'    keeps the whole asset and fills a slot shaped by CSS, such as a
 *           full-screen scene, cropping only in the browser.
 */
export type ImageFit = 'cover' | 'contain' | 'fill';

export interface ImageOptions {
  widths?: number[];
  fit?: ImageFit;
  /** Black and white, done by the CDN (saturation -100). */
  mono?: boolean;
}

function urlFor(
  ref: SanityImageRef,
  aspect: AspectName,
  width: number,
  { fit = 'cover', mono = false }: ImageOptions,
) {
  let img = builder.image(ref).width(width).auto('format');
  if (mono) img = img.saturation(-100);
  return fit === 'cover'
    ? img
        .height(Math.round(width / RATIO[aspect]))
        .fit('crop')
        .url()
    : img.fit('max').url();
}

export function imageSrcSet(
  ref: SanityImageRef,
  aspect: AspectName,
  options: ImageOptions = {},
): { src: string; srcset: string } {
  const widths = options.widths ?? DEFAULT_WIDTHS;
  const mid = widths[Math.floor(widths.length / 2)] ?? 800;
  return {
    src: urlFor(ref, aspect, mid, options),
    srcset: widths
      .map((w) => `${urlFor(ref, aspect, w, options)} ${w}w`)
      .join(', '),
  };
}
