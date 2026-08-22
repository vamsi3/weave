/**
 * Runtime-validated access to extension settings.
 *
 * chrome.storage can return anything (corrupted sync data, values written
 * by older versions, manual edits), so instead of blindly casting we parse
 * every field and fall back to the default for anything unexpected.
 */

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultAction: "open",
  saveAs: true,
  scrollingEnabled: true,
}

const isDefaultAction = (
  value: unknown,
): value is ExtensionSettings["defaultAction"] =>
  value === "open" || value === "download" || value === "copy"

/**
 * Narrows an untrusted storage payload into a valid ExtensionSettings,
 * substituting defaults for any missing or malformed field.
 */
export const parseSettings = (
  raw: Record<string, unknown>,
): ExtensionSettings => ({
  defaultAction: isDefaultAction(raw.defaultAction)
    ? raw.defaultAction
    : DEFAULT_SETTINGS.defaultAction,
  saveAs:
    typeof raw.saveAs === "boolean" ? raw.saveAs : DEFAULT_SETTINGS.saveAs,
  scrollingEnabled:
    typeof raw.scrollingEnabled === "boolean"
      ? raw.scrollingEnabled
      : DEFAULT_SETTINGS.scrollingEnabled,
})

/** Loads and validates settings from chrome.storage.sync. */
export const loadSettings = async (): Promise<ExtensionSettings> =>
  parseSettings(
    await chrome.storage.sync.get(
      Object.fromEntries(Object.entries(DEFAULT_SETTINGS)),
    ),
  )

/** Persists settings to chrome.storage.sync. */
export const saveSettings = async (
  settings: ExtensionSettings,
): Promise<void> => {
  await chrome.storage.sync.set(Object.fromEntries(Object.entries(settings)))
}
