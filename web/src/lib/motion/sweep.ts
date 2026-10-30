// Uncovers her painting along the spray, from its stem at the bottom-left to
// its feathers at the top-right, using a rotated window that slides one way
// while its content slides back by the same amount: the art stays put and is
// revealed. Transform-only, so it runs on the compositor. Works inside a
// rotated box too, since it moves in the box's own frame.

// The spray's direction in the art's own frame.
const ANGLE = (-39 * Math.PI) / 180;
const DIR = { x: Math.cos(ANGLE), y: Math.sin(ANGLE) };
// How the leading edge looks:
// - 'mask' fades the art out over the window's last 30%. A moving mask
//   re-rasterises on every frame, so it is for sweeps that play on their own,
//   not under scroll.
// - 'feather' lays a static gradient into the page surface over that last
//   30%, which moves with the window at no raster cost. It only reads as a
//   soft edge over the plain surface.
// - 'hard' leaves the edge crisp.
// Either fade comes off once the art is uncovered. Then the window is longer
// than the art's diagonal by just enough that the fade clears the far corner
// when done. The classes are safelisted in global.css: this file is not
// scanned for classes.
export type SweepEdge = 'mask' | 'feather' | 'hard';
const OPAQUE = 0.7;
const MASK = 'mask-r-from-70%';
const FEATHER = [
  'absolute',
  'bg-linear-to-r',
  'from-transparent',
  'to-surface',
  'will-change-transform',
];

export interface Sweep {
  /** Re-measure the box; call on load and on every ScrollTrigger refresh. */
  layout(): void;
  /** p: 0 hidden → 1 fully uncovered. */
  render(p: number): void;
}

/** `win` is an `overflow-hidden` child of `box` with one child: the art. */
export function createSweep(
  box: HTMLElement,
  win: HTMLElement,
  { edge = 'hard' }: { edge?: SweepEdge } = {},
): Sweep {
  const inner = win.firstElementChild as HTMLElement;
  const overhang = edge === 'hard' ? 0 : 1 / OPAQUE - 1;
  win.classList.add('will-change-transform');
  inner.classList.add('will-change-transform');
  let feather: HTMLElement | undefined;
  if (edge === 'feather') {
    feather = document.createElement('div');
    feather.dataset.feather = '';
    feather.classList.add(...FEATHER);
    win.append(feather);
  }
  let diag = 0;
  let len = 0;
  return {
    layout() {
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      diag = Math.hypot(w, h);
      len = diag * (1 + overhang);
      Object.assign(win.style, {
        inset: 'auto',
        left: `${(w - len) / 2}px`,
        top: `${(h - diag) / 2}px`,
        width: `${len}px`,
        height: `${diag}px`,
      });
      Object.assign(inner.style, {
        inset: 'auto',
        left: `${(len - w) / 2}px`,
        top: `${(diag - h) / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
      });
      if (feather)
        Object.assign(feather.style, {
          left: `${len * OPAQUE}px`,
          top: '0',
          width: `${len * (1 - OPAQUE)}px`,
          height: `${diag}px`,
        });
    },
    render(p: number) {
      const t = Math.min(Math.max(p, 0), 1);
      const s = (overhang * diag) / 2 + (t - 1) * len;
      win.style.transform = `translate(${s * DIR.x}px, ${s * DIR.y}px) rotate(${ANGLE}rad)`;
      inner.style.transform = `translateX(${-s}px) rotate(${-ANGLE}rad)`;
      if (edge === 'mask') win.classList.toggle(MASK, t < 1);
      if (feather) feather.style.visibility = t > 0 && t < 1 ? '' : 'hidden';
    },
  };
}
