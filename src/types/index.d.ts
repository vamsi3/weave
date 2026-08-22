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
 * The response for a `CAPTURE_VISIBLE_TAB` message, as a discriminated
 * result union: exactly one of the success or failure shapes, never a
 * bag of optional fields.
 */
type CaptureVisibleTabResponse =
  | { readonly ok: true; readonly dataUrl: string }
  | { readonly ok: false; readonly error: string }

/**
 * Maps every message type to the response type its sender may await.
 * `undefined` marks fire-and-forget messages. This is the single source of
 * truth tying the two ends of the protocol together at compile time.
 */
interface MessageResponseMap {
  CAPTURE_VISIBLE_TAB: CaptureVisibleTabResponse
  GET_SETTINGS: ExtensionSettings
  SCREENSHOT_DATA: undefined
  DOWNLOAD_SCREENSHOT: undefined
}

/** The response type a given message must be answered with. */
type ResponseFor<M extends RuntimeMessage> = MessageResponseMap[M["type"]]
