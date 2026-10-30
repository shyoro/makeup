// Content shapes mirrored from the future Sanity schema (parent spec §7, §8).
// The mock page in mock-page.ts and, later, the GROQ query both produce these.

export interface SanityImageRef {
  _type: 'image';
  asset: { _ref: string };
  hotspot?: { x: number; y: number; width: number; height: number };
}

/** Names of the locked aspect ratios in theme-contract.css. */
export type AspectName = 'hero' | 'portrait' | 'editorial' | 'avatar';

export interface MediaImage {
  kind: 'image';
  alt: string;
  caption?: string;
  aspectRatio: AspectName;
  image: SanityImageRef;
}
