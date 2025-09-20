// This script handles the logic for the screenshot viewer page (viewer.html),
// displaying the captured image and providing copy/download actions.

(() => {
  /**
   * Populates the UI with localized strings from _locales/.../messages.json.
   */
  const localizePage = (): void => {
    document.title = chrome.i18n.getMessage('viewerTitle');

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const messageKey = element.getAttribute('data-i18n');
      if (messageKey) {
        element.textContent = chrome.i18n.getMessage(messageKey);
      }
    });

    document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      const messageKey = element.getAttribute('data-i18n-alt');
      if (messageKey && element instanceof HTMLImageElement) {
        element.alt = chrome.i18n.getMessage(messageKey);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    localizePage();

    // --- DOM Element References ---
    const screenshotImg = document.getElementById('screenshot') as HTMLImageElement;
    const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
    const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

    // Retrieve the screenshot data URL from temporary local storage.
    const result = await chrome.storage.local.get(['screenshotUrl']);
    const screenshotUrl: string | undefined = result.screenshotUrl;

    if (screenshotUrl && screenshotImg) {
      screenshotImg.src = screenshotUrl;
      // The screenshot URL is stored temporarily. It's removed after being displayed
      // to ensure that opening the viewer again doesn't show a stale image.
      chrome.storage.local.remove('screenshotUrl');

      downloadBtn?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DOWNLOAD_SCREENSHOT', dataUrl: screenshotUrl });

        // Give the user visual feedback that the action was successful.
        downloadBtn.textContent = chrome.i18n.getMessage('downloadingButton');
        downloadBtn.disabled = true;
        setTimeout(() => {
          downloadBtn.textContent = chrome.i18n.getMessage('downloadButton');
          downloadBtn.disabled = false;
        }, 2000);
      });

      copyBtn?.addEventListener('click', async () => {
        try {
          const response = await fetch(screenshotUrl);
          const blob = await response.blob();
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);

          // Give the user visual feedback that the action was successful.
          copyBtn.textContent = chrome.i18n.getMessage('copiedButton');
          setTimeout(() => (copyBtn.textContent = chrome.i18n.getMessage('copyButton')), 2000);
        } catch (err) {
          console.error('Failed to copy image:', err);
          copyBtn.textContent = chrome.i18n.getMessage('errorButton');
        }
      });
    } else if (screenshotImg) {
      screenshotImg.alt = chrome.i18n.getMessage('noScreenshotAltText');
    }
  });
})();
