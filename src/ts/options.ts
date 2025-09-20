// This script handles the logic for the extension's options page.

(() => {
  // --- DOM Element References ---
  const radioButtons = document.querySelectorAll<HTMLInputElement>('input[name="defaultAction"]');
  const saveAsCheckbox = document.getElementById('saveAs') as HTMLInputElement;
  const indicator = document.querySelector<HTMLDivElement>('.selection-indicator');

  /**
   * Populates the UI with localized strings from _locales/.../messages.json.
   */
  const localizePage = (): void => {
    document.title = chrome.i18n.getMessage('optionsTitle');

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const messageKey = element.getAttribute('data-i18n');
      if (messageKey) {
        element.textContent = chrome.i18n.getMessage(messageKey);
      }
    });
  };

  // --- UI Logic ---

  /**
   * Moves the selection indicator for the segmented button. It dynamically adjusts
   * for horizontal or vertical layouts to create a smooth, responsive animation.
   * @param selectedLabel - The label element corresponding to the checked radio button.
   */
  const moveIndicator = (selectedLabel: HTMLLabelElement | null): void => {
    if (!indicator || !selectedLabel) {
      console.error('Required elements for segmented button are missing.');
      return;
    }

    const segmentedButton = selectedLabel.closest('.segmented-button');
    if (!segmentedButton) return;

    // Check the computed style to see if the media query for vertical layout is active.
    const isVertical = getComputedStyle(segmentedButton).flexDirection === 'column';

    if (isVertical) {
      const labelHeight = selectedLabel.offsetHeight;
      const labelTop = selectedLabel.offsetTop;

      indicator.style.width = '100%'; // Full width in vertical mode.
      indicator.style.height = `${labelHeight}px`;
      indicator.style.transform = `translateY(${labelTop}px)`;
    } else {
      const labelWidth = selectedLabel.offsetWidth;
      const labelLeft = selectedLabel.offsetLeft;

      indicator.style.height = ''; // Reset to CSS default.
      indicator.style.width = `${labelWidth}px`;
      indicator.style.transform = `translateX(${labelLeft}px)`;
    }
  };

  // --- Chrome Storage Logic ---

  /**
   * Saves the current state of the options to chrome.storage.sync.
   */
  const saveOptions = (): void => {
    const selectedAction =
      document.querySelector<HTMLInputElement>('input[name="defaultAction"]:checked')?.value || 'open';
    const saveAs = saveAsCheckbox.checked;

    const settings: ExtensionSettings = {
      defaultAction: selectedAction as ExtensionSettings['defaultAction'],
      saveAs: saveAs,
    };
    chrome.storage.sync.set(settings);
  };

  /**
   * Restores options from chrome.storage.sync by updating the input states.
   */
  const restoreOptionsState = async (): Promise<void> => {
    const defaults: ExtensionSettings = { defaultAction: 'open', saveAs: true };
    const settings = (await chrome.storage.sync.get(defaults)) as ExtensionSettings;

    const selectedRadio = document.querySelector<HTMLInputElement>(
      `input[name="defaultAction"][value="${settings.defaultAction}"]`
    );
    if (selectedRadio) {
      selectedRadio.checked = true;
    }

    saveAsCheckbox.checked = settings.saveAs;
  };

  // --- Event Listener Initialization ---

  document.addEventListener('DOMContentLoaded', async () => {
    localizePage();
    await restoreOptionsState();

    const selectedRadio = document.querySelector<HTMLInputElement>('input[name="defaultAction"]:checked');
    const selectedLabel = selectedRadio?.nextElementSibling as HTMLLabelElement | null;

    // Use requestAnimationFrame to ensure the indicator moves after the initial render,
    // preventing a visual flash.
    requestAnimationFrame(() => {
      moveIndicator(selectedLabel);
    });
  });

  radioButtons.forEach((radio) => {
    radio.addEventListener('change', (event) => {
      saveOptions();
      const targetLabel = (event.target as HTMLInputElement).nextElementSibling as HTMLLabelElement | null;
      moveIndicator(targetLabel);
    });
  });

  saveAsCheckbox.addEventListener('change', saveOptions);

  // Recalculate indicator on window resize to handle responsive layout changes.
  let resizeTimeout: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    // A simple debounce is used to prevent rapid, unnecessary recalculations during a resize.
    resizeTimeout = window.setTimeout(() => {
      const selectedRadio = document.querySelector<HTMLInputElement>('input[name="defaultAction"]:checked');
      const selectedLabel = selectedRadio?.nextElementSibling as HTMLLabelElement | null;
      moveIndicator(selectedLabel);
    }, 100);
  });
})();
