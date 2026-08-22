/**
 * Pure stitching geometry for full-page capture.
 *
 * Everything in this module is a pure function of its inputs — no DOM, no
 * Chrome APIs — so the math that decides how captured segments map onto the
 * output canvas is unit-testable.
 *
 * Two unit systems are in play and must never be confused:
 *  - CSS pixels: scroll positions and viewport sizes reported by the DOM.
 *  - Device pixels: dimensions of the bitmaps that captureVisibleTab returns
 *    (CSS pixels multiplied by the device pixel ratio / zoom factor).
 * The branded types below make mixing them a compile-time error.
 */

declare const CSS_PX: unique symbol
declare const DEVICE_PX: unique symbol

/** A length in CSS pixels (DOM scroll positions, viewport sizes). */
export type CssPx = number & { readonly [CSS_PX]: true }
/** A length in physical device pixels (captured bitmap dimensions). */
export type DevicePx = number & { readonly [DEVICE_PX]: true }

export const cssPx = (value: number): CssPx => value as CssPx
export const devicePx = (value: number): DevicePx => value as DevicePx

/**
 * The largest canvas dimension Chromium reliably supports. Beyond this,
 * canvas operations silently fail and produce a blank image, so extremely
 * long pages are clamped to this height instead of failing outright.
 */
export const MAX_CANVAS_DIMENSION = devicePx(32767)

/** One captured viewport bitmap and the scroll position it was taken at. */
export interface CapturedSegment {
  /** The actual scrollTop (CSS px) of the scroller when this was captured. */
  readonly scrollTop: CssPx
  /** Captured bitmap width in device pixels. */
  readonly width: DevicePx
  /** Captured bitmap height in device pixels. */
  readonly height: DevicePx
}

/** A drawImage instruction: which part of a segment lands where. */
export interface SegmentDraw {
  readonly segmentIndex: number
  /** Vertical crop offset into the source bitmap (device px). */
  readonly sourceY: DevicePx
  /** Height of the cropped source region (device px). */
  readonly sourceHeight: DevicePx
  /** Vertical position on the destination canvas (device px). */
  readonly destY: DevicePx
}

/** Complete layout for the output canvas. */
export interface StitchLayout {
  readonly canvasWidth: DevicePx
  readonly canvasHeight: DevicePx
  readonly scale: number
  readonly draws: readonly SegmentDraw[]
}

/**
 * Derives the device-pixel-per-CSS-pixel scale from the first captured
 * bitmap. This is more reliable than window.devicePixelRatio because it
 * also reflects browser zoom applied at capture time.
 */
export const captureScale = (
  imageWidth: DevicePx,
  viewportWidth: CssPx,
): number => {
  if (viewportWidth <= 0) {
    throw new RangeError(
      `Viewport width must be positive, got ${viewportWidth}`,
    )
  }
  return imageWidth / viewportWidth
}

/**
 * Computes where each captured segment must be drawn on the output canvas.
 *
 * Segments are positioned by the *actual* scroll offset they were captured
 * at — not by assuming perfect viewport-height steps — which keeps the
 * stitch correct when the page scroll-snaps, when the last scroll clamps at
 * the bottom, or at fractional zoom levels. Whenever two segments overlap,
 * the later segment's overlapping top region is cropped away.
 *
 * @param segments - Captures in top-to-bottom scroll order.
 * @param viewportWidth - The scroller's viewport width in CSS pixels.
 * @returns The canvas dimensions and the crop/draw instructions.
 */
export const computeStitchLayout = (
  segments: readonly CapturedSegment[],
  viewportWidth: CssPx,
): StitchLayout => {
  const first = segments[0]
  if (!first) {
    throw new RangeError("Cannot stitch zero segments.")
  }
  if (segments.some((segment) => segment.width !== first.width)) {
    throw new RangeError(
      "Capture width changed mid-capture (window resized or zoomed).",
    )
  }

  const scale = captureScale(first.width, viewportWidth)
  const draws: SegmentDraw[] = []
  let coveredUntil = devicePx(0)

  /**
   * Sub-pixel rounding of scrollTop*scale can leave a ≤1 device px gap
   * between consecutive segments at fractional zoom levels. Gaps within
   * this tolerance are snapped closed (shifting content by under a pixel)
   * instead of leaving a visible blank seam.
   */
  const ROUNDING_GAP_TOLERANCE = 2

  for (const [segmentIndex, segment] of segments.entries()) {
    const idealDestY = Math.round(segment.scrollTop * scale)
    let destY: DevicePx
    let sourceY: DevicePx

    if (idealDestY >= coveredUntil) {
      const gap = idealDestY - coveredUntil
      // A larger gap cannot legitimately happen because capture steps by at
      // most one viewport; if it does, draw at the ideal position and let
      // the gap surface visibly rather than silently distorting content.
      destY =
        gap > 0 && gap <= ROUNDING_GAP_TOLERANCE
          ? coveredUntil
          : devicePx(idealDestY)
      sourceY = devicePx(0)
    } else {
      // Overlap: crop away whatever a previous segment already covered.
      destY = coveredUntil
      sourceY = devicePx(coveredUntil - idealDestY)
    }

    const sourceHeight = devicePx(segment.height - sourceY)
    if (sourceHeight <= 0) {
      continue // Fully covered by previous segments; nothing to draw.
    }
    draws.push({ segmentIndex, sourceY, sourceHeight, destY })
    coveredUntil = devicePx(destY + sourceHeight)
  }

  return {
    canvasWidth: first.width,
    canvasHeight: coveredUntil,
    scale,
    draws,
  }
}

/**
 * Clamps a layout to the maximum canvas dimension, dropping or trimming
 * draws that extend beyond the limit. Returns the layout unchanged when it
 * already fits.
 */
export const clampLayout = (
  layout: StitchLayout,
  maxDimension: DevicePx = MAX_CANVAS_DIMENSION,
): StitchLayout => {
  if (layout.canvasHeight <= maxDimension) {
    return layout
  }
  const draws: SegmentDraw[] = []
  for (const draw of layout.draws) {
    if (draw.destY >= maxDimension) {
      break
    }
    const visibleHeight = Math.min(draw.sourceHeight, maxDimension - draw.destY)
    draws.push({ ...draw, sourceHeight: devicePx(visibleHeight) })
  }
  return { ...layout, canvasHeight: maxDimension, draws }
}
