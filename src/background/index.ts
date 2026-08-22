// This service worker script handles background tasks for the Weave extension,
// such as initiating downloads, opening the viewer, and providing settings.

import { DEFAULT_SETTINGS, loadSettings } from "../shared/settings"

/**
 * Initiates a download of the provided screenshot data URL.
 * @param dataUrl - The base64 data URL of the image to download.
 */
async function downloadScreenshot(dataUrl: string): Promise<void> {
  const { saveAs } = await loadSettings()
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: `screenshot-${Date.now()}.png`,
      saveAs,
    })
  } catch (error) {
    console.error("Weave Error: Download failed.", error)
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) {
    console.error("Weave Error: Cannot execute script, tab ID is undefined.")
    return
  }
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["content/index.js"],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(`Weave Error: Script injection failed on tab ${tab.id}.`)
        console.error(chrome.runtime.lastError.message)
      }
    },
  )
})

/**
 * The main message listener for the extension.
 * Fully async, with per-type error handling so every message that expects a
 * response always receives one in the exact shape its sender awaits
 * (see MessageResponseMap in types/index.d.ts).
 */
chrome.runtime.onMessage.addListener(
  (
    request: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    ;(async () => {
      switch (request.type) {
        case "GET_SETTINGS": {
          try {
            const settings = await loadSettings()
            sendResponse(settings satisfies ExtensionSettings)
          } catch (error) {
            // Storage failures must not break capture; fall back to defaults.
            console.error("Weave Error: Failed to load settings.", error)
            sendResponse(DEFAULT_SETTINGS satisfies ExtensionSettings)
          }
          break
        }

        case "CAPTURE_VISIBLE_TAB": {
          try {
            const dataUrl = await chrome.tabs.captureVisibleTab({
              format: "png",
            })
            sendResponse({
              ok: true,
              dataUrl,
            } satisfies CaptureVisibleTabResponse)
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error)
            console.error("Weave Error: captureVisibleTab failed.", error)
            sendResponse({
              ok: false,
              error: message,
            } satisfies CaptureVisibleTabResponse)
          }
          break
        }

        case "SCREENSHOT_DATA": {
          // This is a fire-and-forget message. The content script does not wait
          // for a response, allowing it to clean up immediately.
          if (request.action === "open") {
            await chrome.storage.local.set({ screenshotUrl: request.data })
            await chrome.tabs.create({ url: "viewer/index.html" })
          } else if (request.action === "download") {
            await downloadScreenshot(request.data)
          }
          // No response is sent.
          break
        }

        case "DOWNLOAD_SCREENSHOT": {
          await downloadScreenshot(request.dataUrl)
          // No response is sent.
          break
        }

        default: {
          // This block should be unreachable if all message types are handled.
          // The `_exhaustiveCheck` variable ensures compile-time safety.
          const _exhaustiveCheck: never = request
          console.warn(
            `Unhandled message type: ${(request as { type?: string })?.type}`,
          )
          break
        }
      }
    })().catch((error) => {
      // Backstop for unexpected failures in fire-and-forget handlers.
      console.error(
        `Weave Error: Unhandled failure for message type ${request.type}.`,
        error,
      )
    })

    // Return true ONLY for messages that send an asynchronous response.
    return (
      request.type === "GET_SETTINGS" || request.type === "CAPTURE_VISIBLE_TAB"
    )
  },
)
