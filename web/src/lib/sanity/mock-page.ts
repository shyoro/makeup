// Mock content, replaced later by a typed GROQ query returning the same Page
// shape. Images are real Sanity assets uploaded by scripts/seed-media.mjs.
import type { MediaImage, Page, PaintedArt } from './types';

/** `focus` is the photo's focal point as fractions of its width and height,
 *  as Sanity's hotspot will give it. */
function photo(ref: string, alt: string, [x, y]: [number, number]): MediaImage {
  return {
    kind: 'image',
    alt,
    aspectRatio: 'portrait',
    image: {
      _type: 'image',
      asset: { _ref: ref },
      hotspot: { x, y, width: 0.3, height: 0.3 },
    },
  };
}

// Her painting (the main spray), as two aligned transparent layers. The IDs
// are Sanity's content hashes of the prepared files; they resolve once the
// files are uploaded with scripts/seed-media.mjs.
const art = {
  line: {
    _type: 'image',
    asset: {
      _ref: 'image-db096159a2154d1d2a8560dbc42dc2d81bc31367-2000x1493-png',
    },
  },
  color: {
    _type: 'image',
    asset: {
      _ref: 'image-27b2596cd848435ffd3f0f91adf354c62c627354-2000x1493-png',
    },
  },
} satisfies PaintedArt;

export const mockPage: Page = {
  sections: [
    {
      _type: 'hero',
      _key: 'hero',
      name: 'נועה לוי',
      subtitle: 'איפור כלות וערב',
      scrollCue: 'גללי',
      art,
    },
    {
      _type: 'portfolio',
      _key: 'portfolio',
      title: 'רגעים של יופי',
      intro:
        'כל כלה מקבלת מראה שנבנה רק בשבילה, מהפגישה הראשונה ועד הבוקר של החתונה.',
      startingPrice: 450,
      flowers: art.line,
      blocks: [
        {
          _type: 'scene',
          _key: 'bride',
          media: photo(
            'image-984f00b691b9701d451a1bd0b9e7640f780e0147-2000x3000-jpg',
            'כלה בזמן איפור לפני החופה',
            [0.6, 0.33],
          ),
        },
        {
          _type: 'text',
          _key: 'morning',
          title: 'הבוקר שלך, בקצב שלך',
          body: 'את מתיישבת, ואני דואגת לכל השאר. שקט, ריח של פרחים ומראה שמרגיש כמוך, רק ביום הכי יפה שלך.',
        },
        {
          _type: 'pair',
          _key: 'details',
          items: [
            photo(
              'image-17967403371056302fd038c06aeff8e7fb3664d6-2000x3000-jpg',
              'כלה מורחת סומק עדין מול המראה',
              [0.52, 0.42],
            ),
            photo(
              'image-3d9d808764e5bae180e7db18aa858acdc9662aa9-2000x3000-jpg',
              'כלה מחייכת בזמן הדבקת ריסים',
              [0.43, 0.45],
            ),
          ],
        },
        {
          _type: 'text',
          _key: 'lasting',
          title: 'איפור שמחזיק עד הריקוד האחרון',
          body: 'חומרים עדינים לעור, עבודת יד ותשומת לב לכל פרט, כדי שתיראי נפלא בכל תמונה, גם בסוף הערב.',
          statement: true,
        },
        {
          _type: 'scene',
          _key: 'veil',
          media: photo(
            'image-14985b0ec5fd6bb87988a852668d8d3bc0787e37-2000x2764-jpg',
            'פרופיל של כלה מבעד להינומה',
            [0.45, 0.45],
          ),
        },
        {
          _type: 'closing',
          _key: 'closing',
          title: 'נשמח להיות חלק מהיום שלך',
          body: 'חתונה, חינה או ערב מיוחד: ספרי לי על התאריך ועל השמלה, ונבנה יחד את המראה שלך.',
          // Mock: the booking section (Cal.com, parent spec §3) is not built
          // yet; the real link comes from Sanity.
          action: { label: 'לבדיקת תאריך פנוי', href: '#booking' },
        },
      ],
    },
  ],
};
