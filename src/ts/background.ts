// This service worker script handles background tasks for the Weave extension,
// such as capturing screenshots, initiating downloads, and routing messages.

let creatingOffscreenDocument: Promise<void> | null;

/**
 * Checks if an offscreen document is already active.
 * @param path - The path to the offscreen document's HTML file.
 * @returns A promise that resolves to true if the document exists, false otherwise.
 */
async function hasOffscreenDocument(path: string): Promise<boolean> {
  const offscreenUrl = chrome.runtime.getURL(path);
  // In a service worker, `self` is the global scope. We cast through `unknown`
  // to `ServiceWorkerGlobalScope` for type-safe access to the `clients` property.
  const matchedClients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll();
  return matchedClients.some((client: Client) => client.url === offscreenUrl);
}

/**
 * Creates and sets up the offscreen document needed for clipboard operations.
 * It ensures only one creation process happens at a time.
 * @param path - The path to the offscreen document's HTML file.
 */
async function setupOffscreenDocument(path: string): Promise<void> {
  if (await hasOffscreenDocument(path)) {
    return;
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
  } else {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: chrome.i18n.getMessage('copyToClipboardJustification'),
    });
    await creatingOffscreenDocument;
    creatingOffscreenDocument = null;
  }
}

/**
 * Sends a message to the offscreen document to copy an image data URL to the clipboard.
 * @param dataUrl - The base64 data URL of the image to copy.
 */
async function copyImageToClipboard(dataUrl: string): Promise<void> {
  await setupOffscreenDocument('offscreen.html');
  chrome.runtime.sendMessage({
    type: 'COPY_IMAGE_TO_CLIPBOARD',
    target: 'offscreen',
    dataUrl: dataUrl,
  });
}

/**
 * Initiates a download of the provided screenshot data URL.
 * @param dataUrl - The base64 data URL of the image to download.
 */
async function downloadScreenshot(dataUrl: string): Promise<void> {
  const { saveAs } = (await chrome.storage.sync.get({
    saveAs: true,
  })) as { saveAs: boolean };

  chrome.downloads.download({
    url: dataUrl,
    filename: `screenshot-${Date.now()}.png`,
    saveAs: saveAs,
  });
}

// --- Event Listeners ---

// Triggers the content script when the user clicks the extension action icon.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) {
    console.error('Weave Error: Cannot execute script, tab ID is undefined.');
    return;
  }
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ['content.js'],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          `Weave Error: Script injection failed on tab ${tab.id}.`
        );
        console.error(chrome.runtime.lastError.message);
      }
    }
  );
});

// The main message listener for the extension. It uses a pattern for handling
// async responses in service workers: `return true` keeps the message port open
// while the async operation completes.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'CAPTURE_VISIBLE_TAB') {
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
        sendResponse({ data: dataUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendResponse({ error: message });
      }
    })();
    return true;
  }

  if (request.type === 'SCREENSHOT_DATA') {
    (async () => {
      const { defaultAction } = (await chrome.storage.sync.get({
        defaultAction: 'open',
      })) as { defaultAction: 'open' | 'download' | 'copy' };

      switch (defaultAction) {
        case 'open':
          await chrome.storage.local.set({ screenshotUrl: request.data });
          await chrome.tabs.create({ url: 'viewer.html' });
          break;
        case 'download':
          await downloadScreenshot(request.data);
          break;
        case 'copy':
          await copyImageToClipboard(request.data);
          break;
        default:
          console.warn(`Weave: Unknown default action: ${defaultAction}`);
          break;
      }
    })();
    return false;
  }

  if (request.type === 'DOWNLOAD_SCREENSHOT') {
    downloadScreenshot(request.dataUrl);
    return false;
  }

  return false;
});

export {};
