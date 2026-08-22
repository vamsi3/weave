import { describe, expect, test } from "bun:test"
import {
  type CapturedSegment,
  captureScale,
  clampLayout,
  computeStitchLayout,
  cssPx,
  devicePx,
  MAX_CANVAS_DIMENSION,
  type SegmentDraw,
} from "./geometry"

/** Builds a segment captured at `scrollTop` with a bitmap of w×h device px. */
const segment = (
  scrollTop: number,
  width: number,
  height: number,
): CapturedSegment => ({
  scrollTop: cssPx(scrollTop),
  width: devicePx(width),
  height: devicePx(height),
})

/** Builds an expected draw instruction from plain numbers. */
const draw = (
  segmentIndex: number,
  sourceY: number,
  sourceHeight: number,
  destY: number,
): SegmentDraw => ({
  segmentIndex,
  sourceY: devicePx(sourceY),
  sourceHeight: devicePx(sourceHeight),
  destY: devicePx(destY),
})

describe("captureScale", () => {
  test("derives DPR 2 from bitmap twice the viewport width", () => {
    expect(captureScale(devicePx(2560), cssPx(1280))).toBe(2)
  })

  test("derives fractional zoom factors exactly", () => {
    expect(captureScale(devicePx(1600), cssPx(1280))).toBe(1.25)
  })

  test("rejects non-positive viewport widths", () => {
    expect(() => captureScale(devicePx(100), cssPx(0))).toThrow(RangeError)
  })
})

describe("computeStitchLayout", () => {
  test("rejects an empty capture list", () => {
    expect(() => computeStitchLayout([], cssPx(1280))).toThrow(RangeError)
  })

  test("rejects segments whose widths differ (mid-capture resize)", () => {
    const segments = [segment(0, 1280, 800), segment(800, 1000, 800)]
    expect(() => computeStitchLayout(segments, cssPx(1280))).toThrow(
      /width changed/,
    )
  })

  test("single segment maps 1:1 at DPR 1", () => {
    const layout = computeStitchLayout([segment(0, 1280, 800)], cssPx(1280))
    expect(layout.scale).toBe(1)
    expect(layout.canvasWidth).toBe(devicePx(1280))
    expect(layout.canvasHeight).toBe(devicePx(800))
    expect(layout.draws).toEqual([draw(0, 0, 800, 0)])
  })

  test("perfectly-stepped segments tile without cropping", () => {
    // Viewport 800 CSS px tall at DPR 1; page 2400 tall; steps land exactly.
    const segments = [
      segment(0, 1280, 800),
      segment(800, 1280, 800),
      segment(1600, 1280, 800),
    ]
    const layout = computeStitchLayout(segments, cssPx(1280))
    expect(layout.canvasHeight).toBe(devicePx(2400))
    expect(layout.draws).toEqual([
      draw(0, 0, 800, 0),
      draw(1, 0, 800, 800),
      draw(2, 0, 800, 1600),
    ])
  })

  test("bottom-clamped final segment gets its overlap cropped", () => {
    // Page 2000 CSS px tall, viewport 800: the third scroll to 1600 clamps
    // at 1200, so 400 of its 800 rows duplicate the second segment.
    const segments = [
      segment(0, 1280, 800),
      segment(800, 1280, 800),
      segment(1200, 1280, 800),
    ]
    const layout = computeStitchLayout(segments, cssPx(1280))
    expect(layout.canvasHeight).toBe(devicePx(2000))
    // Crop the duplicated overlap off the top of the final segment.
    expect(layout.draws.at(-1)).toEqual(draw(2, 400, 400, 1600))
  })

  test("DPR 2: overlap math happens in device pixels", () => {
    // Same bottom-clamp shape as above but every bitmap is 2x.
    const segments = [
      segment(0, 2560, 1600),
      segment(800, 2560, 1600),
      segment(1200, 2560, 1600),
    ]
    const layout = computeStitchLayout(segments, cssPx(1280))
    expect(layout.scale).toBe(2)
    expect(layout.canvasHeight).toBe(devicePx(4000))
    expect(layout.draws.at(-1)).toEqual(draw(2, 800, 800, 3200))
  })

  test("fractional DPR 1.25 stays gapless without accumulating drift", () => {
    // Viewport 789 CSS px tall (odd on purpose) at 1.25 scale → 986.25
    // device px per step: rounding would leave 1px seams without the
    // gap-snapping logic. Consecutive draws must tile exactly.
    const viewportCss = 789
    const bitmapHeight = Math.round(viewportCss * 1.25) // 986
    const segments = Array.from({ length: 10 }, (_, i) =>
      segment(i * viewportCss, 1600, bitmapHeight),
    )
    const layout = computeStitchLayout(segments, cssPx(1280))
    expect(layout.scale).toBe(1.25)
    let expectedNext = 0
    for (const d of layout.draws) {
      expect(d.destY).toBe(devicePx(expectedNext)) // gapless tiling
      expectedNext = d.destY + d.sourceHeight
    }
    const ideal = 10 * viewportCss * 1.25
    expect(Math.abs(layout.canvasHeight - ideal)).toBeLessThanOrEqual(10)
  })

  test("scroll-snap drift: segments land where they actually scrolled", () => {
    // The second scroll aimed at 800 but the page snapped it to 750.
    const segments = [segment(0, 1280, 800), segment(750, 1280, 800)]
    const layout = computeStitchLayout(segments, cssPx(1280))
    // Overlap of 50 rows is cropped; the segment is NOT drawn at 800.
    expect(layout.draws[1]).toEqual(draw(1, 50, 750, 800))
    expect(layout.canvasHeight).toBe(devicePx(1550))
  })

  test("fully-redundant segments are skipped", () => {
    // Two captures at the same position: second adds nothing.
    const segments = [segment(0, 1280, 800), segment(0, 1280, 800)]
    const layout = computeStitchLayout(segments, cssPx(1280))
    expect(layout.draws).toHaveLength(1)
    expect(layout.canvasHeight).toBe(devicePx(800))
  })
})

describe("clampLayout", () => {
  test("returns the layout untouched when within limits", () => {
    const layout = computeStitchLayout([segment(0, 1280, 800)], cssPx(1280))
    expect(clampLayout(layout)).toBe(layout)
  })

  test("trims draws that cross the canvas limit and drops those beyond", () => {
    const viewport = 800
    const count = 50 // 40,000 device px total, over the 32,767 limit
    const segments = Array.from({ length: count }, (_, i) =>
      segment(i * viewport, 1280, viewport),
    )
    const layout = clampLayout(computeStitchLayout(segments, cssPx(1280)))
    expect(layout.canvasHeight).toBe(MAX_CANVAS_DIMENSION)
    const last = layout.draws.at(-1)
    if (!last) throw new Error("expected draws")
    // The final visible draw is trimmed exactly to the limit.
    expect(devicePx(last.destY + last.sourceHeight)).toBe(MAX_CANVAS_DIMENSION)
    // Nothing extends past the limit.
    expect(
      layout.draws.every(
        (d) => d.destY + d.sourceHeight <= MAX_CANVAS_DIMENSION,
      ),
    ).toBe(true)
  })
})
