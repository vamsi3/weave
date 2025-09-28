import { waitForIdle } from "./utils"

/**
 * Finds and temporarily hides overlay elements like sticky headers and banners
 * that could interfere with the screenshot. This is achieved by adding a temporary
 * class to the elements and injecting a stylesheet to hide that class with `!important`.
 * @returns A function that can be called to restore the original visibility of the elements.
 */
export const hideOverlayElements = (): (() => void) => {
  const HIDE_CLASS = "__weave-temporary-hide"
  const elementsToRestore: HTMLElement[] = []

  // Inject a stylesheet to hide elements with our temporary class.
  // Using !important helps override any inline styles or other specific rules.
  const style = document.createElement("style")
  style.innerHTML = `.${HIDE_CLASS} { visibility: hidden !important; }`
  document.head.appendChild(style)

  const viewportHeight = window.innerHeight

  document.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const computedStyle = window.getComputedStyle(element)
    if (
      computedStyle.position === "fixed" ||
      computedStyle.position === "sticky"
    ) {
      const rect = element.getBoundingClientRect()
      // Check if the element is visible within the viewport.
      if (
        rect.height > 0 &&
        rect.width > 0 &&
        rect.bottom > 0 &&
        rect.top < viewportHeight &&
        computedStyle.visibility !== "hidden"
      ) {
        element.classList.add(HIDE_CLASS)
        elementsToRestore.push(element)
      }
    }
  })

  return () => {
    for (const element of elementsToRestore) {
      element.classList.remove(HIDE_CLASS)
    }
    if (style.parentElement) {
      document.head.removeChild(style)
    }
  }
}

/**
 * Finds the primary scrollable element on the page. This robust method avoids
 * incorrectly selecting narrow sidebars by identifying all scrollable elements
 * and choosing the one with the largest scrollable area.
 * @returns The element that should be scrolled for a full-page capture.
 */
export const getScrollableElement = (): HTMLElement => {
  const docScroller = (document.scrollingElement ||
    document.documentElement) as HTMLElement

  const candidates: HTMLElement[] = []

  // Always consider the document scroller as a potential candidate.
  if (docScroller.scrollHeight > docScroller.clientHeight) {
    candidates.push(docScroller)
  }

  // Find all other potential scrollable elements.
  document.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el === document.documentElement || el === document.body) return

    const style = window.getComputedStyle(el)
    if (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      el.scrollHeight > el.clientHeight &&
      (style.overflowY === "scroll" || style.overflowY === "auto")
    ) {
      candidates.push(el)
    }
  })

  // Filter out candidates that are too narrow to be the main content.
  const wideCandidates = candidates.filter(
    (el) => el.clientWidth > window.innerWidth * 0.4,
  )

  // If we have wide candidates, use them. Otherwise, use the original list.
  const finalCandidates =
    wideCandidates.length > 0 ? wideCandidates : candidates

  if (finalCandidates.length === 0) {
    return docScroller // Fallback if no scrollable elements are found.
  }

  // From the final candidates, pick the one with the largest scrollable area.
  let bestCandidate = finalCandidates[0]
  let maxScore = 0

  for (const candidate of finalCandidates) {
    const score =
      (candidate.scrollHeight - candidate.clientHeight) * candidate.clientWidth
    if (score > maxScore) {
      maxScore = score
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

/**
 * Prepares the page for capture by disabling animations and pre-loading all
 * lazy-loaded content by scrolling through the page.
 * @param scrollTo - The function to use for scrolling (either window or an element).
 * @param pageHeight - The total height of the page to scroll through.
 * @param viewportHeight - The height of the visible area.
 * @returns A cleanup function to restore the page to its original state.
 */
export const preparePageForCapture = async (
  scrollTo: (y: number) => void,
  pageHeight: number,
  viewportHeight: number,
): Promise<() => void> => {
  const style = document.createElement("style")
  style.innerHTML = `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
      }
    `
  document.head.appendChild(style)

  for (let y = 0; y < pageHeight; y += viewportHeight) {
    scrollTo(y)
    await waitForIdle(50)
  }

  scrollTo(0)
  await waitForIdle(300)

  return () => {
    document.head.removeChild(style)
  }
}
