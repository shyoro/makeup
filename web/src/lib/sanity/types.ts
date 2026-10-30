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

export type FlowerTone = 'pink' | 'blue' | 'purple' | 'leaf';

/**
 * One flower or leaf in the opening bouquet.
 * x, y: percent of the bouquet box (0–100); x is measured from the
 * inline-start edge, so the bouquet mirrors with the page direction.
 * at: 0–1, the point in the scene's scroll progress where it blooms.
 * image: a future scan of her painting; when absent the placeholder SVG for
 * `kind` is drawn in the `tone` colour.
 */
export interface BouquetPiece {
  _key: string;
  kind: 'rose' | 'bud' | 'leaf';
  tone: FlowerTone;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  at: number;
  image?: SanityImageRef;
}

export interface HeroSection {
  _type: 'hero';
  _key: string;
  name: string;
  subtitle: string;
  scrollCue?: string;
  bouquet: BouquetPiece[];
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
