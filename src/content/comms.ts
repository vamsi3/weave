// A unique error name to identify when the script is terminated by navigation.
export const PORT_CLOSED_ERROR_NAME = "WEAVE_PORT_CLOSED"

/**
 * A strongly-typed wrapper for chrome.runtime.sendMessage.
 * It includes special handling for when the message port closes due to page navigation.
 * @param message - The message object, conforming to the RuntimeMessage union.
 * @returns A promise that resolves with the typed response from the listener.
 */
export const sendMessage = <T>(message: RuntimeMessage): Promise<T> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        if (
          chrome.runtime.lastError.message?.includes(
            "The message port closed before a response was received",
          )
        ) {
          const navigationError = new Error(
            "Message port closed, likely due to page navigation.",
          )
          navigationError.name = PORT_CLOSED_ERROR_NAME
          reject(navigationError)
        } else {
          reject(new Error(chrome.runtime.lastError.message))
        }
      } else {
        resolve(response)
      }
    })
  })
}
