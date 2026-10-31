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

/** A full-screen photo the story passes through. */
export interface StoryScene {
  _type: 'scene';
  _key: string;
  media: MediaImage;
}

/** A text section that scrolls over the photos. */
export interface StoryText {
  _type: 'text';
  _key: string;
  title: string;
  body: string;
  /** Set it larger and centred, as the story's statement line. */
  statement?: boolean;
}

/** Two photos side by side. */
export interface StoryPair {
  _type: 'pair';
  _key: string;
  items: [MediaImage, MediaImage];
}

/** A link to act on; where it points comes from Sanity, never the code. */
export interface Action {
  label: string;
  href: string;
  /** A WhatsApp chat: shown with its mark, opened in the app or a new tab. */
  kind?: 'whatsapp';
}

/** The last words of the story, with the one clear action. */
export interface StoryClosing {
  _type: 'closing';
  _key: string;
  title: string;
  body: string;
  action: Action;
  /** Her number, shown under the action; from siteSettings (parent spec §5). */
  phone?: string;
}

export type StoryBlock = StoryScene | StoryText | StoryPair | StoryClosing;

export interface PortfolioSection {
  _type: 'portfolio';
  _key: string;
  title: string;
  intro?: string;
  /** Mock only until pricing comes from Sanity botKnowledge (parent spec §3.2). */
  startingPrice?: number;
  /** Her ink drawing, shown in black and white behind the text sections. */
  flowers?: SanityImageRef;
  /** In reading order; she can reorder, add and remove them. */
  blocks: StoryBlock[];
}

export type PageSection = HeroSection | PortfolioSection;

export interface Page {
  sections: PageSection[];
}
