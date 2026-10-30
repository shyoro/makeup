// The story's blocks are siblings in the portfolio section. Astro renders a
// component's script where the component is first used, so scripts (and the
// ink filter) can sit between blocks.

const BLOCK = '[data-panel], [data-story-scene], [data-pair]';

/**
 * Whether a picture is just before or after the block `el`: a full-screen
 * photo, or, before the story's first block, the opening's painting.
 */
export function pictureBeside(el: Element, side: 'before' | 'after'): boolean {
  const step = (n: Element) =>
    side === 'before' ? n.previousElementSibling : n.nextElementSibling;
  let n = step(el);
  while (n && !n.matches(BLOCK)) n = step(n);
  if (!n) return side === 'before';
  return n.matches('[data-story-scene]');
}
