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

/**
 * Her painting in two aligned layers of the same size: the ink drawing alone,
 * and the finished colour work. Both are transparent cut-outs held in Sanity.
 */
export interface PaintedArt {
  line: SanityImageRef;
  color: SanityImageRef;
}

export interface HeroSection {
  _type: 'hero';
  _key: string;
  name: string;
  subtitle: string;
  scrollCue?: string;
  art: PaintedArt;
}

export interface PortfolioSection {
  _type: 'portfolio';
  _key: string;
  title: string;
  intro?: string;
  /** Mock only until pricing comes from Sanity botKnowledge (parent spec §3.2). */
  startingPrice?: number;
  items: MediaImage[];
}

export type PageSection = HeroSection | PortfolioSection;

export interface Page {
  sections: PageSection[];
}
