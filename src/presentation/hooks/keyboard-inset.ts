export type ViewportGeometry = {
  /** Layout viewport height, i.e. `window.innerHeight`. */
  layoutHeight: number;
  /** Visual viewport height, which shrinks while a software keyboard is open. */
  visualHeight: number;
  /** How far the visual viewport is scrolled inside the layout viewport. */
  offsetTop: number;
};

/**
 * Browser chrome (collapsing URL bars, gesture bars) moves the visual viewport by
 * a few pixels, so only a substantial gap is treated as an open keyboard.
 */
export const KEYBOARD_INSET_THRESHOLD_PX = 120;

/**
 * Height, in CSS pixels, that a software keyboard currently hides.
 *
 * Returns 0 whenever no keyboard is detectable, so callers can use the value as a
 * plain layout offset without branching.
 */
export function keyboardInsetFrom(geometry: ViewportGeometry): number {
  const hidden = geometry.layoutHeight - geometry.visualHeight - geometry.offsetTop;
  if (!Number.isFinite(hidden) || hidden < KEYBOARD_INSET_THRESHOLD_PX) return 0;
  return Math.round(Math.min(hidden, geometry.layoutHeight));
}

export function isKeyboardOpen(geometry: ViewportGeometry): boolean {
  return keyboardInsetFrom(geometry) > 0;
}
