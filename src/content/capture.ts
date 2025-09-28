import { copyImageToClipboard } from "./clipboard"
import { sendMessage } from "./comms"
import {
  getScrollableElement,
  hideOverlayElements,
  preparePageForCapture,
} from "./page"
import { waitForIdle } from "./utils"

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
  style.innerHTML = `
    *::-webkit-scrollbar { display: none !important; }
    * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
  `
  document.head.appendChild(style)
  try {
    return await task()
  } finally {
    if (style.parentElement) {
      document.head.removeChild(style)
    }
  }
}

/**
 * Captures a full-page screenshot by scrolling, taking segment captures,
 * and stitching them together. This function now robustly handles both
 * standard window scrolling and custom inner-element scrolling.
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
    const captures: string[] = []
    // Initial capture at the top of the page.
    let response = await withHiddenScrollbars(() =>
      sendMessage<CaptureVisibleTabResponse>({
        type: "CAPTURE_VISIBLE_TAB",
      }),
    )
    if (response.error || !response.data) {
      throw new Error(response.error ?? "Initial capture failed.")
    }
    captures.push(response.data)

    let lastScrollTop = isWindowScrolling
      ? window.scrollY
      : scrollElement.scrollTop

    // Scroll and capture segments until the bottom is reached.
    for (let y = viewportHeight; y < finalPageHeight; y += viewportHeight) {
      scrollTo(y)
      await waitForIdle(100)

      const currentScrollTop = isWindowScrolling
        ? window.scrollY
        : scrollElement.scrollTop

      if (currentScrollTop === lastScrollTop) {
        break // Reached the absolute bottom.
      }

      const restoreVisibility = hideOverlayElements()
      try {
        await waitForIdle(16) // Wait for repaint after hiding elements.

        response = await withHiddenScrollbars(() =>
          sendMessage<CaptureVisibleTabResponse>({
            type: "CAPTURE_VISIBLE_TAB",
          }),
        )

        if (response.error || !response.data) {
          throw new Error(response.error ?? "A capture segment failed.")
        }
        captures.push(response.data)
        lastScrollTop = currentScrollTop
      } finally {
        // This is guaranteed to run, ensuring elements are always restored.
        restoreVisibility()
      }
    }

    // Recalculate page height based on the final scroll position for a perfect stitch.
    const actualPageHeight = lastScrollTop + viewportHeight

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not create canvas context.")

    const firstImage = await loadImage(captures[0])
    const scale =
      firstImage.width /
      (isWindowScrolling ? window.innerWidth : scrollElement.clientWidth)
    canvas.width = firstImage.width
    canvas.height = actualPageHeight * scale

    let currentHeight = 0
    for (const capture of captures.slice(0, -1)) {
      const img = await loadImage(capture)
      ctx.drawImage(img, 0, currentHeight)
      currentHeight += img.height
    }

    const lastCapture = captures.at(-1)
    if (!lastCapture) {
      // This path should not be reachable given the logic flow.
      throw new Error("Stitching failed: the last capture segment is missing.")
    }
    const lastImg = await loadImage(lastCapture)

    const remainingHeight = canvas.height - currentHeight
    if (remainingHeight > 0) {
      const sourceY = Math.max(0, lastImg.height - remainingHeight)
      ctx.drawImage(
        lastImg,
        0,
        sourceY,
        lastImg.width,
        remainingHeight,
        0,
        currentHeight,
        lastImg.width,
        remainingHeight,
      )
    }

    return canvas.toDataURL("image/png")
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
  const response = await withHiddenScrollbars(() =>
    sendMessage<CaptureVisibleTabResponse>({
      type: "CAPTURE_VISIBLE_TAB",
    }),
  )
  if (response.error || !response.data) {
    throw new Error(
      response.error ?? "Visible capture failed without an error message.",
    )
  }
  return response.data
}

/**
 * The main function that orchestrates the entire screenshot process.
 * It no longer manages page styles, deferring state management to the
 * individual capture functions.
 */
export async function takeScreenshot(): Promise<void> {
  const settings = await sendMessage<ExtensionSettings>({
    type: "GET_SETTINGS",
  })

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
      })
      break
  }
}
