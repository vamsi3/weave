/**
 * A robust function to wait for the page to settle by waiting for two
 * animation frames after a minimum timeout. This helps ensure that any
 * rendering updates triggered by scrolling have completed.
 * @param timeout - The minimum time to wait in milliseconds.
 */
export const waitForIdle = (timeout = 300): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    }, timeout)
  })
}
