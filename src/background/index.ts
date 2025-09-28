// This service worker script handles background tasks for the Weave extension,
// such as initiating downloads, opening the viewer, and providing settings.

/**
 * Initiates a download of the provided screenshot data URL.
 * @param dataUrl - The base64 data URL of the image to download.
 */
async function downloadScreenshot(dataUrl: string): Promise<void> {
  const { saveAs } = (await chrome.storage.sync.get({
    saveAs: true,
  })) as Pick<ExtensionSettings, "saveAs">

  chrome.downloads.download({
    url: dataUrl,
    filename: `screenshot-${Date.now()}.png`,
    saveAs,
  })
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
 * This has been refactored to be fully async and includes a top-level
 * try/catch block to ensure a response is always sent for messages that expect one.
 */
chrome.runtime.onMessage.addListener(
  (
    request: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    ;(async () => {
      try {
        switch (request.type) {
          case "GET_SETTINGS": {
            const defaults: ExtensionSettings = {
              defaultAction: "open",
              saveAs: true,
              scrollingEnabled: true,
            }
            const settings = await chrome.storage.sync.get(defaults)
            sendResponse(settings)
            break
          }

          case "CAPTURE_VISIBLE_TAB": {
            const dataUrl = await chrome.tabs.captureVisibleTab({
              format: "png",
            })
            sendResponse({ data: dataUrl })
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
            const errorMessage = `Unhandled message type: ${
              (request as { type?: string })?.type
            }`
            console.warn(errorMessage)
            // Send a response for any unhandled case that might expect one.
            sendResponse({ error: errorMessage })
            break
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(
          `Error in message listener for type ${request.type}:`,
          error,
        )
        // Ensure any awaiting listener receives an error response.
        sendResponse({ error: message })
      }
    })()

    // Return true ONLY for messages that send an asynchronous response.
    return (
      request.type === "GET_SETTINGS" || request.type === "CAPTURE_VISIBLE_TAB"
    )
  },
)
