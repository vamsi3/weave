/**
 * Shared type definitions for the Weave Chrome Extension.
 * This .d.ts file makes these types globally available
 * within the project's TypeScript files without needing explicit imports.
 */

/**
 * Represents the settings stored in chrome.storage.sync.
 * Defines the user's preferences for the extension's behavior.
 */
interface ExtensionSettings {
  defaultAction: "open" | "download" | "copy"
  saveAs: boolean
  scrollingEnabled: boolean
}

/** A request from the content script to capture the currently visible tab area. */
type CaptureVisibleTabMessage = {
  type: "CAPTURE_VISIBLE_TAB"
}

/** A request from the content script to retrieve the user's saved settings. */
type GetSettingsMessage = {
  type: "GET_SETTINGS"
}

/**
 * A message from the content script containing the final screenshot data URL.
 * This is a "fire-and-forget" message; the content script does not wait for a response.
 */
type ScreenshotDataMessage = {
  type: "SCREENSHOT_DATA"
  action: "open" | "download"
  data: string
}

/** A request from the viewer page to download the screenshot. */
type DownloadScreenshotMessage = {
  type: "DOWNLOAD_SCREENSHOT"
  dataUrl: string
}

/**
 * A discriminated union of all possible message types exchanged within the extension.
 * This allows for strong type checking in message listeners.
 */
type RuntimeMessage =
  | CaptureVisibleTabMessage
  | GetSettingsMessage
  | ScreenshotDataMessage
  | DownloadScreenshotMessage

/**
 * The expected response format for a `CAPTURE_VISIBLE_TAB` message.
 * It contains either the data URL of the capture or an error message.
 */
type CaptureVisibleTabResponse = {
  data?: string
  error?: string
}

/**
 * The expected response format for a `SCREENSHOT_DATA` message.
 * This is no longer used as the message is now fire-and-forget, but is kept
 * for potential future use or as a reference.
 */
type ScreenshotDataResponse = {
  success: boolean
  error?: string
}
