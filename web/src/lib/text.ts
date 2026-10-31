// Hebrew wrapping for headings.

/**
 * Keeps each one- or two-letter word (עד, של, על, את…) on the line of the
 * word after it, so a heading never leaves one on a line of its own.
 */
export const keepShortWords = (text: string): string =>
  text.replace(/(?<=^|\s)([א-ת]{1,2})\s+/g, '$1 ');
