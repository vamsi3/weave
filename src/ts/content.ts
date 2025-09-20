// This content script is injected into the active tab to orchestrate the
// full-page screenshot process by scrolling, capturing segments, and stitching them.

(async () => {
  /**
   * A strongly-typed wrapper for chrome.runtime.sendMessage.
   * @param message - The message object to send.
   * @returns A promise that resolves with the response from the listener.
   */
  const sendMessage = <T>(message: RuntimeMessage): Promise<T> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  };

  /**
   * Pauses execution for a specified duration.
   * @param ms - The number of milliseconds to wait.
   */
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Finds and hides elements that are fixed or sticky at the top of the viewport
   * to prevent them from being repeated in each screenshot segment.
   * @returns A function that restores the original visibility of the hidden elements.
   */
  const hideTopFixedElements = (): (() => void) => {
    const hiddenElements: { element: HTMLElement; originalVisibility: string }[] = [];
    const allElements = document.querySelectorAll('body *');

    allElements.forEach((el) => {
      const element = el as HTMLElement;
      const style = window.getComputedStyle(element);
      const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
      if (!isFixedOrSticky) return;

      const rect = element.getBoundingClientRect();
      const isVisible =
        rect.height > 0 &&
        rect.width > 0 &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        style.display !== 'none';

      // Check if element is visible and positioned AT the top of the viewport.
      // A small tolerance accounts for borders or slight offsets.
      const isAtTop = rect.top < 10 && rect.bottom > 0;

      if (isVisible && isAtTop) {
        hiddenElements.push({
          element,
          originalVisibility: element.style.visibility,
        });
        element.style.visibility = 'hidden';
      }
    });

    // Return a function that restores the original state.
    return () => {
      hiddenElements.forEach(({ element, originalVisibility }) => {
        element.style.visibility = originalVisibility;
      });
    };
  };

  const originalScrollY = window.scrollY;
  // Temporarily hide scrollbars to prevent them from appearing in screenshots.
  const originalHtmlOverflow = document.documentElement.style.overflow;
  const originalBodyOverflow = document.body.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  try {
    const captures: string[] = [];
    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = document.documentElement.clientHeight;

    // --- First Capture ---
    window.scrollTo(0, 0);
    // Allow time for the page to render and for any lazy-loaded elements to appear.
    await sleep(500);

    let response = await sendMessage<CaptureVisibleTabResponse>({ type: 'CAPTURE_VISIBLE_TAB' });
    if (response.error || !response.data) {
      const reason = response.error || 'No data URL returned';
      throw new Error(chrome.i18n.getMessage('captureFailedError', reason));
    }
    captures.push(response.data);

    // --- Subsequent Captures Loop ---
    let currentScroll = viewportHeight;
    while (currentScroll < pageHeight) {
      window.scrollTo(0, currentScroll);
      // Allow time for scrolling and for any sticky headers to adjust or appear.
      await sleep(500);

      // Hide any newly-appeared fixed elements for this specific capture.
      const restoreVisibility = hideTopFixedElements();

      response = await sendMessage<CaptureVisibleTabResponse>({ type: 'CAPTURE_VISIBLE_TAB' });

      // IMPORTANT: Restore visibility immediately after the capture is taken.
      restoreVisibility();

      if (response.error || !response.data) {
        const reason = response.error || 'No data URL returned';
        // Even on error, attempt to restore scroll and break.
        window.scrollTo(0, originalScrollY);
        throw new Error(chrome.i18n.getMessage('captureFailedError', reason));
      }
      captures.push(response.data);

      currentScroll += viewportHeight;
    }

    // --- Image Stitching ---
    // Stitch the captured image segments into a single, seamless image.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context.');

    if (captures.length === 0) {
      throw new Error('No images were captured.');
    }

    const firstImage = new Image();
    await new Promise<void>((resolve, reject) => {
      firstImage.onload = () => resolve();
      firstImage.onerror = () => reject(new Error('Could not load the first captured image.'));
      firstImage.src = captures[0];
    });

    // Calculate the final canvas dimensions based on the first image's device pixel ratio.
    const scale = firstImage.width / window.innerWidth;
    canvas.width = firstImage.width;
    canvas.height = pageHeight * scale;

    let currentHeight = 0;
    // Draw all but the last image in full.
    for (let i = 0; i < captures.length - 1; i++) {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, currentHeight);
          currentHeight += img.height;
          resolve();
        };
        img.onerror = () => reject(new Error('Could not load an image segment.'));
        img.src = captures[i];
      });
    }

    // Handle the last image separately to crop any potential overlap from scrolling.
    const lastImg = new Image();
    await new Promise<void>((resolve, reject) => {
      lastImg.onload = () => {
        const remainingHeight = canvas.height - currentHeight;
        if (remainingHeight > 0) {
          // The source crop area starts from the bottom of the last image.
          const sourceY = lastImg.height - remainingHeight;
          ctx.drawImage(
            lastImg,
            0, // sx
            sourceY, // sy
            lastImg.width, // sWidth
            remainingHeight, // sHeight
            0, // dx
            currentHeight, // dy
            lastImg.width, // dWidth
            remainingHeight // dHeight
          );
        }
        resolve();
      };
      lastImg.onerror = () => reject(new Error('Could not load the last image segment.'));
      lastImg.src = captures[captures.length - 1];
    });

    // Send the final, stitched image to the background script.
    sendMessage({ type: 'SCREENSHOT_DATA', data: canvas.toDataURL('image/png') });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Weave Screenshot Error:', error);
    alert(chrome.i18n.getMessage('screenshotGenericError', message));
  } finally {
    // Restore original scroll position and styles.
    window.scrollTo(0, originalScrollY);
    document.documentElement.style.overflow = originalHtmlOverflow;
    document.body.style.overflow = originalBodyOverflow;
  }
})();
