/**
 * Resolves after the requested delay in milliseconds.
 *
 * @param {number} ms Delay duration in milliseconds.
 * @returns {Promise<void>} Promise that resolves after the timer elapses.
 */
export const delay = async (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})
