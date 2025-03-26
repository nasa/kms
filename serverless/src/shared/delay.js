/**
 * Creates a promise that resolves after a specified delay.
 *
 * This function is useful for introducing controlled delays in asynchronous operations,
 * such as rate limiting API requests or creating timed intervals in animations.
 *
 * @function delay
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 *
 * @example
 * // Wait for 2 seconds
 * await delay(2000);
 * console.log('This logs after a 2-second delay');
 *
 * @example
 * // Use in a loop to add delays between iterations
 * for (let i = 0; i < 5; i++) {
 *   console.log(i);
 *   await delay(1000); // Wait 1 second between each log
 * }
 */
export const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})
