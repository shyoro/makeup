// Uncovers her painting along the spray, from its stem at the bottom-left to
// its feathers at the top-right, using a rotated window that slides one way
// while its content slides back by the same amount: the art stays put and is
// revealed. Transform-only, so it runs on the compositor. Works inside a
// rotated box too, since it moves in the box's own frame.

// The spray's direction in the art's own frame.
const ANGLE = (-39 * Math.PI) / 180;
const DIR = { x: Math.cos(ANGLE), y: Math.sin(ANGLE) };
// A soft sweep's leading edge fades out over the window's last 30%
// (mask-r-from-70%, safelisted in global.css: this file is not scanned for
// classes), and the window is longer than the art's diagonal by just enough
// that the fade clears the far corner when done. A moving mask re-rasterises
// on every frame, so soft is for sweeps that play on their own, not under
// scroll, and the mask comes off once the art is uncovered.
const OPAQUE = 0.7;
const SOFT = 'mask-r-from-70%';

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
  { soft = false } = {},
): Sweep {
  const inner = win.firstElementChild as HTMLElement;
  const overhang = soft ? 1 / OPAQUE - 1 : 0;
  win.classList.add('will-change-transform');
  inner.classList.add('will-change-transform');
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
    },
    render(p: number) {
      const t = Math.min(Math.max(p, 0), 1);
      const s = (overhang * diag) / 2 + (t - 1) * len;
      win.style.transform = `translate(${s * DIR.x}px, ${s * DIR.y}px) rotate(${ANGLE}rad)`;
      inner.style.transform = `translateX(${-s}px) rotate(${-ANGLE}rad)`;
      if (soft) win.classList.toggle(SOFT, t < 1);
    },
  };
}
