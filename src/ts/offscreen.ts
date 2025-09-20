// This script runs in an offscreen document, a hidden page that can use DOM APIs
// not available to service workers, such as the Clipboard API.

/**
 * Listens for a message from the service worker to copy an image to the clipboard.
 * @param msg - The message object received.
 */
const messageListener = async (msg: RuntimeMessage): Promise<void> => {
  if (msg.type !== 'COPY_IMAGE_TO_CLIPBOARD' || msg.target !== 'offscreen') {
    return;
  }

  try {
    const response = await fetch(msg.dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  } catch (error) {
    console.error('Offscreen document copy error:', error);
  } finally {
    // The offscreen document must close itself after completing its task
    // to release system resources.
    window.close();
  }
};

chrome.runtime.onMessage.addListener(messageListener);
