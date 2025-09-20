/**
 * Shared type definitions for the Weave Chrome Extension.
 * This .d.ts file makes these types globally available
 * within the project's TypeScript files without needing explicit imports.
 */

/**
 * Represents the settings stored in chrome.storage.sync.
 */
interface ExtensionSettings {
  defaultAction: 'open' | 'download' | 'copy';
  saveAs: boolean;
}

// --- Message Types for chrome.runtime messaging ---

/**
 * A union of all possible message types exchanged within the extension.
 */
type RuntimeMessage =
  | { type: 'CAPTURE_VISIBLE_TAB' }
  | { type: 'SCREENSHOT_DATA'; data: string }
  | { type: 'DOWNLOAD_SCREENSHOT'; dataUrl: string }
  | { type: 'COPY_IMAGE_TO_CLIPBOARD'; target: 'offscreen'; dataUrl: string };

// --- Response Types for chrome.runtime messaging ---

/**
 * The expected response format when requesting a tab capture.
 */
type CaptureVisibleTabResponse = {
  data?: string;
  error?: string;
};
