// Mock content, replaced later by a typed GROQ query returning the same Page
// shape. Images are real Sanity assets uploaded by scripts/seed-media.mjs.
import type { BouquetPiece, MediaImage, Page } from './types';

function photo(ref: string, alt: string): MediaImage {
  return {
    kind: 'image',
    alt,
    aspectRatio: 'portrait',
    image: { _type: 'image', asset: { _ref: ref } },
  };
}

// Weighted toward the inline-start side, under the name; blooms climb the
// stems from the bottom up, so `at` grows as `y` shrinks.
const bouquet: BouquetPiece[] = [
  {
    _key: 'l1',
    kind: 'leaf',
    tone: 'leaf',
    x: 30,
    y: 88,
    scale: 0.9,
    rotate: -30,
    at: 0.12,
  },
  {
    _key: 'l2',
    kind: 'leaf',
    tone: 'leaf',
    x: 52,
    y: 80,
    scale: 0.8,
    rotate: 35,
    at: 0.18,
  },
  {
    _key: 'r1',
    kind: 'rose',
    tone: 'purple',
    x: 22,
    y: 78,
    scale: 1.1,
    rotate: -8,
    at: 0.22,
  },
  {
    _key: 'r2',
    kind: 'rose',
    tone: 'purple',
    x: 40,
    y: 74,
    scale: 0.95,
    rotate: 12,
    at: 0.28,
  },
  {
    _key: 'l3',
    kind: 'leaf',
    tone: 'leaf',
    x: 12,
    y: 66,
    scale: 0.85,
    rotate: -50,
    at: 0.32,
  },
  {
    _key: 'r3',
    kind: 'rose',
    tone: 'blue',
    x: 30,
    y: 62,
    scale: 0.9,
    rotate: 4,
    at: 0.4,
  },
  {
    _key: 'r4',
    kind: 'rose',
    tone: 'blue',
    x: 48,
    y: 60,
    scale: 0.8,
    rotate: -14,
    at: 0.45,
  },
  {
    _key: 'l4',
    kind: 'leaf',
    tone: 'leaf',
    x: 60,
    y: 52,
    scale: 0.75,
    rotate: 40,
    at: 0.5,
  },
  {
    _key: 'r5',
    kind: 'rose',
    tone: 'pink',
    x: 24,
    y: 48,
    scale: 1.25,
    rotate: 6,
    at: 0.56,
  },
  {
    _key: 'r6',
    kind: 'rose',
    tone: 'pink',
    x: 42,
    y: 44,
    scale: 1,
    rotate: -10,
    at: 0.62,
  },
  {
    _key: 'b1',
    kind: 'bud',
    tone: 'pink',
    x: 14,
    y: 38,
    scale: 0.8,
    rotate: -20,
    at: 0.68,
  },
  {
    _key: 'l5',
    kind: 'leaf',
    tone: 'leaf',
    x: 34,
    y: 34,
    scale: 0.7,
    rotate: -35,
    at: 0.72,
  },
  {
    _key: 'b2',
    kind: 'bud',
    tone: 'purple',
    x: 54,
    y: 32,
    scale: 0.7,
    rotate: 18,
    at: 0.78,
  },
  {
    _key: 'b3',
    kind: 'bud',
    tone: 'blue',
    x: 28,
    y: 24,
    scale: 0.65,
    rotate: -6,
    at: 0.84,
  },
  {
    _key: 'r7',
    kind: 'rose',
    tone: 'pink',
    x: 38,
    y: 18,
    scale: 0.85,
    rotate: 8,
    at: 0.9,
  },
];

export const mockPage: Page = {
  sections: [
    {
      _type: 'hero',
      _key: 'hero',
      name: 'נועה לוי',
      subtitle: 'איפור כלות וערב',
      scrollCue: 'גללי',
      bouquet,
    },
    {
      _type: 'portfolio',
      _key: 'portfolio',
      title: 'רגעים של יופי',
      intro:
        'כל כלה מקבלת מראה שנבנה רק בשבילה, מהפגישה הראשונה ועד הבוקר של החתונה.',
      startingPrice: 450,
      items: [
        photo(
          'image-984f00b691b9701d451a1bd0b9e7640f780e0147-2000x3000-jpg',
          'כלה בזמן איפור לפני החופה',
        ),
        photo(
          'image-17967403371056302fd038c06aeff8e7fb3664d6-2000x3000-jpg',
          'מריחת סומק עדין על הלחי',
        ),
        photo(
          'image-14985b0ec5fd6bb87988a852668d8d3bc0787e37-2000x2764-jpg',
          'פרופיל של כלה מבעד להינומה',
        ),
        photo(
          'image-3d9d808764e5bae180e7db18aa858acdc9662aa9-2000x3000-jpg',
          'הדבקת ריסים במכחול דק',
        ),
        photo(
          'image-1508d49ed84d73edff2c9e198a93cace11f83cd2-2000x2667-jpg',
          'מוצרי איפור מסודרים על השולחן',
        ),
        photo(
          'image-0a65f48d354b0da5eae245d4a6068b914ae6df3c-2000x1335-jpg',
          'ערכת האיפור פתוחה על שולחן עץ',
        ),
      ],
    },
  ],
};
