import { copyImageToClipboard } from "./clipboard"
import { sendMessage } from "./comms"
import {
  type CapturedSegment,
  clampLayout,
  computeStitchLayout,
  cssPx,
  devicePx,
  type StitchLayout,
} from "./geometry"
import {
  getScrollableElement,
  hideOverlayElements,
  preparePageForCapture,
} from "./page"
import { waitForIdle } from "./utils"

/**
 * Chrome enforces MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND (2/sec). Pacing
 * captures slightly above 500ms apart keeps long captures from tripping the
 * quota, which would otherwise abort mid-page with an opaque error.
 */
const MIN_CAPTURE_INTERVAL_MS = 550

/**
 * A helper function to load an image from a data URL.
 * @param src - The data URL of the image.
 * @returns A Promise that resolves with the HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error(`Could not load image from src: ${src.slice(0, 50)}...`))
    img.src = src
  })
}

/**
 * A helper that executes an async task while temporarily injecting CSS to hide scrollbars.
 * This method is non-destructive and does not disable scrolling functionality.
 * @param task - The async function to execute.
 * @returns The result of the task.
 */
const withHiddenScrollbars = async <T>(task: () => Promise<T>): Promise<T> => {
  const style = document.createElement("style")
  style.textContent = `
    *::-webkit-scrollbar { display: none !important; }
    * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
  `
  document.head.appendChild(style)
  try {
    return await task()
  } finally {
    style.remove()
  }
}

/** Timestamp of the last captureVisibleTab call, for quota pacing. */
let lastCaptureAt = 0

/**
 * Requests a capture of the visible tab from the background worker,
 * pacing calls to stay under Chrome's captureVisibleTab rate quota.
 * @returns The data URL of the captured bitmap.
 */
const captureVisibleBitmap = async (): Promise<string> => {
  const elapsed = Date.now() - lastCaptureAt
  if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CAPTURE_INTERVAL_MS - elapsed),
    )
  }
  const response = await withHiddenScrollbars(() =>
    sendMessage({ type: "CAPTURE_VISIBLE_TAB" }),
  )
  lastCaptureAt = Date.now()
  if (!response.ok) {
    throw new Error(response.error)
  }
  return response.dataUrl
}

/** A capture segment before its bitmap has been decoded. */
interface RawSegment {
  readonly scrollTop: number
  readonly dataUrl: string
}

/**
 * Decodes captured data URLs and computes the stitch layout from the
 * scroll positions each segment was actually captured at.
 */
const stitchSegments = async (
  rawSegments: readonly RawSegment[],
  viewportWidth: number,
): Promise<string> => {
  const images = await Promise.all(
    rawSegments.map((raw) => loadImage(raw.dataUrl)),
  )
  const segments: CapturedSegment[] = rawSegments.map((raw, index) => {
    const image = images[index]
    if (!image) throw new Error("Segment image missing after decode.")
    return {
      scrollTop: cssPx(raw.scrollTop),
      width: devicePx(image.width),
      height: devicePx(image.height),
    }
  })

  const layout: StitchLayout = clampLayout(
    computeStitchLayout(segments, cssPx(viewportWidth)),
  )

  const canvas = document.createElement("canvas")
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not create canvas context.")

  for (const draw of layout.draws) {
    const image = images[draw.segmentIndex]
    if (!image) throw new Error("Segment image missing during stitch.")
    ctx.drawImage(
      image,
      0,
      draw.sourceY,
      image.width,
      draw.sourceHeight,
      0,
      draw.destY,
      image.width,
      draw.sourceHeight,
    )
  }

  return canvas.toDataURL("image/png")
}

/**
 * Captures a full-page screenshot by scrolling, taking segment captures,
 * and stitching them together. Handles both standard window scrolling and
 * custom inner-element scrolling, positioning each segment by the scroll
 * offset it was *actually* captured at (robust to scroll-snap and clamping).
 * @param scrollElement - The HTML element identified as the primary scroller for the page.
 * @returns A Promise that resolves with the data URL of the final stitched image.
 */
async function captureScrollingPage(
  scrollElement: HTMLElement,
): Promise<string> {
  const isWindowScrolling =
    scrollElement === document.documentElement ||
    scrollElement === document.body

  const viewportHeight = isWindowScrolling
    ? window.innerHeight
    : scrollElement.clientHeight
  const viewportWidth = isWindowScrolling
    ? window.innerWidth
    : scrollElement.clientWidth
  const originalScrollTop = isWindowScrolling
    ? window.scrollY
    : scrollElement.scrollTop

  const scrollTo = (y: number) => {
    if (isWindowScrolling) {
      window.scrollTo(0, y)
    } else {
      scrollElement.scrollTop = y
    }
  }
  const readScrollTop = () =>
    isWindowScrolling ? window.scrollY : scrollElement.scrollTop

  // First, run the preparation step. This scrolls through the page, triggering
  // lazy-loading and forcing the browser to calculate the true scrollHeight.
  const cleanupPage = await preparePageForCapture(
    scrollTo,
    scrollElement.scrollHeight, // Use initial height for the first pass
    viewportHeight,
  )

  // After preparation, get the definitive, fully-loaded page height.
  const finalPageHeight = scrollElement.scrollHeight

  // Now, perform a definitive check. If the fully-loaded page doesn't actually
  // scroll, capture only the visible part and we're done.
  if (finalPageHeight <= viewportHeight) {
    cleanupPage()
    scrollTo(originalScrollTop)
    return captureVisiblePage()
  }

  try {
    const rawSegments: RawSegment[] = []

    // Initial capture at the top of the page (preparation left us at 0,
    // but read the real position rather than assuming it).
    rawSegments.push({
      scrollTop: readScrollTop(),
      dataUrl: await captureVisibleBitmap(),
    })

    let lastScrollTop = readScrollTop()

    // Scroll and capture segments until the bottom is reached.
    for (let y = viewportHeight; y < finalPageHeight; y += viewportHeight) {
      scrollTo(y)
      await waitForIdle(100)

      const currentScrollTop = readScrollTop()
      if (currentScrollTop === lastScrollTop) {
        break // Reached the absolute bottom.
      }

      const restoreVisibility = hideOverlayElements()
      try {
        await waitForIdle(16) // Wait for repaint after hiding elements.
        rawSegments.push({
          scrollTop: currentScrollTop,
          dataUrl: await captureVisibleBitmap(),
        })
        lastScrollTop = currentScrollTop
      } finally {
        // This is guaranteed to run, ensuring elements are always restored.
        restoreVisibility()
      }
    }

    return await stitchSegments(rawSegments, viewportWidth)
  } finally {
    // This outer finally guarantees the global styles and scroll position are restored.
    cleanupPage()
    scrollTo(originalScrollTop)
  }
}

/**
 * Captures only the currently visible portion of the page.
 * @returns A Promise that resolves with the data URL of the captured image.
 */
async function captureVisiblePage(): Promise<string> {
  await waitForIdle(250)
  return captureVisibleBitmap()
}

/**
 * The main function that orchestrates the entire screenshot process.
 * It no longer manages page styles, deferring state management to the
 * individual capture functions.
 */
export async function takeScreenshot(): Promise<void> {
  const settings = await sendMessage({ type: "GET_SETTINGS" })

  const finalDataUrl = settings.scrollingEnabled
    ? await captureScrollingPage(getScrollableElement())
    : await captureVisiblePage()

  switch (settings.defaultAction) {
    case "copy":
      await copyImageToClipboard(finalDataUrl)
      break
    case "open":
    case "download":
      chrome.runtime.sendMessage({
        type: "SCREENSHOT_DATA",
        action: settings.defaultAction,
        data: finalDataUrl,
      } satisfies ScreenshotDataMessage)
      break
  }
}
