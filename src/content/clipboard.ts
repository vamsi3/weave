/**
 * Copies the given image data URL to the clipboard using the Clipboard API.
 * @param dataUrl - The base64 data URL of the image.
 */
export const copyImageToClipboard = async (dataUrl: string): Promise<void> => {
  try {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
  } catch (error) {
    console.error("Weave: Failed to copy image to clipboard.", error)
    const message = error instanceof Error ? error.message : String(error)
    alert(chrome.i18n.getMessage("copyFailedError", message))
  }
}
