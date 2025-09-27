import { takeScreenshot } from "./capture"
import { PORT_CLOSED_ERROR_NAME } from "./comms"

/**
 * This is the main entry point for the content script.
 * It orchestrates the screenshot process and handles top-level errors,
 * such as page navigation during capture.
 */
;(async () => {
  try {
    await takeScreenshot()
  } catch (error) {
    if (error instanceof Error) {
      // Gracefully handle user-initiated cancellations (e.g., navigating away).
      // A PORT_CLOSED_ERROR_NAME error means the user navigated away, so we can
      // fail silently without alerting them.
      if (error.name === PORT_CLOSED_ERROR_NAME) {
        // Process terminated due to page navigation. No action needed.
      } else if (error.message.includes("Tabs cannot be edited right now")) {
        // This can happen if the user closes the tab or navigates while capture is active.
        alert(chrome.i18n.getMessage("captureCancelledError"))
      } else {
        // Handle genuine technical errors.
        console.error("Weave Screenshot Error:", error)
        alert(chrome.i18n.getMessage("screenshotGenericError", error.message))
      }
    } else {
      // Fallback for non-Error objects.
      console.error("Weave Screenshot Error:", error)
      alert(chrome.i18n.getMessage("screenshotGenericError", String(error)))
    }
  }
})()
