// This script handles the logic for the extension's options page.

;(() => {
  /**
   * Applies localized strings to the DOM. It finds all elements with a
   * `data-i18n` attribute and sets their text content to the corresponding
   * message from the `_locales` directory.
   */
  const localize = (): void => {
    const i18nElements = document.querySelectorAll<HTMLElement>("[data-i18n]")
    for (const element of i18nElements) {
      const messageKey = element.dataset.i18n
      if (messageKey) {
        const message = chrome.i18n.getMessage(messageKey)
        // Use textContent for security and performance.
        element.textContent = message
      }
    }
  }

  const radioButtons = document.querySelectorAll<HTMLInputElement>(
    'input[name="defaultAction"]',
  )
  const saveAsCheckbox = document.querySelector<HTMLInputElement>("#saveAs")
  const scrollingCheckbox =
    document.querySelector<HTMLInputElement>("#scrollingEnabled")
  const indicator = document.querySelector<HTMLDivElement>(
    ".selection-indicator",
  )

  // Early exit if essential elements are not found. This makes subsequent code safer.
  if (!saveAsCheckbox || !indicator || !scrollingCheckbox) {
    console.error("Essential UI elements for options page are missing.")
    return
  }

  /**
   * Moves the selection indicator for the segmented button. It dynamically adjusts
   * for horizontal or vertical layouts and supports both LTR and RTL directions.
   * @param selectedLabel - The label element corresponding to the checked radio button.
   */
  const moveIndicator = (selectedLabel: HTMLLabelElement | null): void => {
    if (!selectedLabel) {
      console.error("Cannot move indicator: selected label not found.")
      return
    }

    const segmentedButton = selectedLabel.closest(".segmented-button")
    if (!segmentedButton) return

    const isVertical =
      getComputedStyle(segmentedButton).flexDirection === "column"
    const isRtl = getComputedStyle(document.documentElement).direction === "rtl"

    if (isVertical) {
      const labelHeight = selectedLabel.offsetHeight
      const labelTop = selectedLabel.offsetTop

      indicator.style.width = "100%"
      indicator.style.height = `${labelHeight}px`
      indicator.style.transform = `translateY(${labelTop}px)`
    } else {
      const labelWidth = selectedLabel.offsetWidth

      // For horizontal movement, we need to calculate the offset from the correct starting edge.
      // getBoundingClientRect provides coordinates relative to the viewport, which is reliable.
      const parentRect = segmentedButton.getBoundingClientRect()
      const labelRect = selectedLabel.getBoundingClientRect()

      // In LTR, offset is from the left. In RTL, it's from the right.
      const offset = isRtl
        ? parentRect.right - labelRect.right
        : labelRect.left - parentRect.left

      indicator.style.height = "" // Reset to CSS default.
      indicator.style.width = `${labelWidth}px`
      indicator.style.transform = `translateX(${offset}px)`
    }
  }

  /**
   * Saves the current state of the options to chrome.storage.sync.
   */
  const saveOptions = (): void => {
    const selectedAction =
      document.querySelector<HTMLInputElement>(
        'input[name="defaultAction"]:checked',
      )?.value ?? "open"
    const saveAs = saveAsCheckbox.checked
    const scrollingEnabled = scrollingCheckbox.checked

    const settings: ExtensionSettings = {
      defaultAction: selectedAction as ExtensionSettings["defaultAction"],
      saveAs,
      scrollingEnabled,
    }
    chrome.storage.sync.set(settings)
  }

  /**
   * Restores options from chrome.storage.sync by updating the input states.
   */
  const restoreOptionsState = async (): Promise<void> => {
    const defaults: ExtensionSettings = {
      defaultAction: "open",
      saveAs: true,
      scrollingEnabled: true,
    }
    const settings: ExtensionSettings = await chrome.storage.sync.get(defaults)

    const selectedRadio = document.querySelector<HTMLInputElement>(
      `input[name="defaultAction"][value="${settings.defaultAction}"]`,
    )
    if (selectedRadio) {
      selectedRadio.checked = true
    }

    saveAsCheckbox.checked = settings.saveAs
    scrollingCheckbox.checked = settings.scrollingEnabled
  }

  document.addEventListener("DOMContentLoaded", async () => {
    localize()
    await restoreOptionsState()

    const selectedRadio = document.querySelector<HTMLInputElement>(
      'input[name="defaultAction"]:checked',
    )
    const selectedLabel =
      selectedRadio?.nextElementSibling instanceof HTMLLabelElement
        ? selectedRadio.nextElementSibling
        : null

    // Use a short timeout to ensure the browser has computed the layout,
    // especially for RTL, before we calculate the indicator's position.
    setTimeout(() => {
      moveIndicator(selectedLabel)
    }, 50)
  })

  for (const radio of radioButtons) {
    radio.addEventListener("change", (event) => {
      saveOptions()
      const target = event.target as HTMLInputElement
      const targetLabel =
        target.nextElementSibling instanceof HTMLLabelElement
          ? target.nextElementSibling
          : null
      moveIndicator(targetLabel)
    })
  }

  saveAsCheckbox.addEventListener("change", saveOptions)
  scrollingCheckbox.addEventListener("change", saveOptions)

  // Recalculate indicator on window resize to handle responsive layout changes.
  let resizeTimeout: number
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = window.setTimeout(() => {
      const selectedRadio = document.querySelector<HTMLInputElement>(
        'input[name="defaultAction"]:checked',
      )
      const selectedLabel =
        selectedRadio?.nextElementSibling instanceof HTMLLabelElement
          ? selectedRadio.nextElementSibling
          : null
      moveIndicator(selectedLabel)
    }, 100)
  })
})()
