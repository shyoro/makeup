// Placeholder art in the artist's one-stroke style, until her scanned
// paintings replace it (spec §6). Each shape is drawn around (0, 0) in a
// roughly 50-unit box. `fills` take the piece's tone colour; `lines` are the
// thin dark brush work.
import type { BouquetPiece } from '../../../lib/sanity/types';

export interface PlaceholderShape {
  fills: string[];
  highlights: string[];
  lines: string[];
}

const SHAPES: Record<BouquetPiece['kind'], PlaceholderShape> = {
  rose: {
    fills: [
      // solid body of the bloom, then a cupped front petal over it
      'M-23 0 C-24 -21 -8 -25 0 -24 C10 -25 24 -19 23 0 C22 19 10 22 0 22 C-12 22 -22 17 -23 0 Z',
      'M-19 4 C-15 18 15 18 19 4 C12 11 -12 11 -19 4 Z',
    ],
    // the pale edge a double-loaded brush leaves on each petal stroke
    highlights: [
      'M-20 6 C-15 19 15 19 20 6',
      'M-21 -2 C-23 -16 -10 -22 -1 -21',
      'M21 -2 C23 -16 10 -22 1 -21',
      'M-13 -6 C-12 -15 12 -15 13 -6',
      'M-11 2 C-9 9 9 9 11 2',
    ],
    lines: [
      'M-3 -5 C-8 2 5 5 6 -2 C6 -8 -2 -9 -2 -3',
      'M-6 -10 C-2 -13 3 -13 6 -10',
    ],
  },
  bud: {
    fills: [
      'M0 10 C-11 0 -6 -14 0 -19 C6 -14 11 0 0 10 Z',
      'M0 10 C-8 8 -12 2 -10 -4 C-6 2 -3 6 0 10 Z',
    ],
    highlights: ['M-2 8 C-8 0 -5 -11 0 -16'],
    lines: ['M0 10 C-2 14 -1 18 0 22', 'M0 12 C4 10 8 12 9 15'],
  },
  leaf: {
    fills: ['M0 16 C-13 5 -11 -12 0 -22 C11 -12 13 5 0 16 Z'],
    highlights: ['M-3 12 C-10 3 -8 -10 0 -19'],
    lines: [
      'M0 16 C-13 5 -11 -12 0 -22 C11 -12 13 5 0 16 Z',
      'M0 16 C-1 3 0 -9 0 -20',
    ],
  },
};

export function placeholderShape(kind: BouquetPiece['kind']): PlaceholderShape {
  return SHAPES[kind];
}

/** All path data for a kind, in draw order — fills, highlights, then lines. */
export function placeholderPath(kind: BouquetPiece['kind']): string[] {
  const s = SHAPES[kind];
  return [...s.fills, ...s.highlights, ...s.lines];
}
