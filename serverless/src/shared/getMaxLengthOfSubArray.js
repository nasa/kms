/**
 * Finds the maximum length of sub-arrays in a given two-dimensional array.
 *
 * @param {Array} array - The input two-dimensional array.
 * @returns {number} The length of the longest sub-array.
 *
 * @example
 * // Regular 2D array
 * const regularArray = [[1, 2, 3], [4, 5], [6, 7, 8, 9]];
 * console.log(getMaxLengthOfSubArray(regularArray));
 * // Output: 4
 *
 * @example
 * // Array with mixed types
 * const mixedArray = [[1, 2], 'string', [3, 4, 5]];
 * console.log(getMaxLengthOfSubArray(mixedArray));
 * // Output: 3
 *
 * @example
 * // Empty array
 * const emptyArray = [];
 * console.log(getMaxLengthOfSubArray(emptyArray));
 * // Output: 0
 *
 * @example
 * // Array with empty sub-arrays
 * const emptySubArrays = [[], [], [1, 2]];
 * console.log(getMaxLengthOfSubArray(emptySubArrays));
 * // Output: 2
 *
 * @example
 * // Non-array input
 * console.log(getMaxLengthOfSubArray('not an array'));
 * // Output: 0
 */
export const getMaxLengthOfSubArray = (array) => {
  // Check if the input is an array and not empty
  if (!Array.isArray(array) || array.length === 0) {
    // If not, return 0 as there are no sub-arrays
    return 0
  }

  // Use map to create an array of sub-array lengths
  // For each element in the array:
  //   - If it's an array, take its length
  //   - If it's not an array, consider its length as 0
  const subArrayLengths = array.map((subArray) => (Array.isArray(subArray) ? subArray.length : 0))

  // Use the spread operator to pass all lengths as separate arguments to Math.max
  // Math.max then returns the largest number, which is the length of the longest sub-array
  return Math.max(...subArrayLengths)
}
