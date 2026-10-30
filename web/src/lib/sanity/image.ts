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

function urlFor(ref: SanityImageRef, aspect: AspectName, width: number) {
  return builder
    .image(ref)
    .width(width)
    .height(Math.round(width / RATIO[aspect]))
    .fit('crop')
    .auto('format')
    .url();
}

export function imageSrcSet(
  ref: SanityImageRef,
  aspect: AspectName,
  widths: number[] = DEFAULT_WIDTHS,
): { src: string; srcset: string } {
  return {
    src: urlFor(ref, aspect, widths[Math.floor(widths.length / 2)] ?? 800),
    srcset: widths.map((w) => `${urlFor(ref, aspect, w)} ${w}w`).join(', '),
  };
}
