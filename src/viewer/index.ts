// This script handles the logic for the screenshot viewer page (viewer.html),
// displaying the captured image and providing copy/download actions.

;(() => {
  /**
   * Applies localized strings to the DOM. It finds all elements with a
   * `data-i18n` attribute and sets their text content. It also handles
   * `data-i18n-alt` for image alt text.
   */
  const localize = (): void => {
    const i18nElements = document.querySelectorAll<HTMLElement>(
      "[data-i18n], [data-i18n-alt]",
    )
    for (const element of i18nElements) {
      const textKey = element.dataset.i18n
      const altKey = element.dataset.i18nAlt

      if (textKey) {
        element.textContent = chrome.i18n.getMessage(textKey)
      }
      if (altKey && element instanceof HTMLImageElement) {
        element.alt = chrome.i18n.getMessage(altKey)
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Apply translations before doing anything else.
    localize()

    const screenshotImg =
      document.querySelector<HTMLImageElement>("#screenshot")
    const downloadBtn =
      document.querySelector<HTMLButtonElement>("#downloadBtn")
    const copyBtn = document.querySelector<HTMLButtonElement>("#copyBtn")

    // Early exit if essential elements are not found.
    if (!screenshotImg || !downloadBtn || !copyBtn) {
      console.error("Essential UI elements for viewer page are missing.")
      return
    }

    // Retrieve the screenshot data URL from temporary local storage.
    const { screenshotUrl } = (await chrome.storage.local.get([
      "screenshotUrl",
    ])) as { screenshotUrl?: string }

    if (screenshotUrl) {
      screenshotImg.src = screenshotUrl
      // The screenshot URL is stored temporarily and removed after being displayed
      // to ensure that opening the viewer again doesn't show a stale image.
      chrome.storage.local.remove("screenshotUrl")

      downloadBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "DOWNLOAD_SCREENSHOT",
          dataUrl: screenshotUrl,
        } as DownloadScreenshotMessage)

        // Provide visual feedback to the user.
        const originalText = downloadBtn.textContent
        downloadBtn.textContent = chrome.i18n.getMessage("downloadingButton")
        downloadBtn.disabled = true
        setTimeout(() => {
          downloadBtn.textContent = originalText
          downloadBtn.disabled = false
        }, 2000)
      })

      copyBtn.addEventListener("click", async () => {
        try {
          const response = await fetch(screenshotUrl)
          const blob = await response.blob()
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob }),
          ])

          // Provide visual feedback to the user.
          const originalText = copyBtn.textContent
          copyBtn.textContent = chrome.i18n.getMessage("copiedButton")
          setTimeout(() => {
            copyBtn.textContent = originalText
          }, 2000)
        } catch (err) {
          console.error("Failed to copy image:", err)
          copyBtn.textContent = chrome.i18n.getMessage("errorButton")
        }
      })
    } else {
      screenshotImg.alt = chrome.i18n.getMessage("noScreenshotAltText")
    }
  })
})()
