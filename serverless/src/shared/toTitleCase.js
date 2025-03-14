/**
 * Converts a string to title case.
 *
 * This function takes a string input and converts it to title case, where the first
 * letter of each word is capitalized and the rest are in lowercase.
 *
 * @param {string} str - The input string to convert.
 * @returns {string} The string converted to title case.
 *
 * @example
 * // Returns "Hello World"
 * toTitleCase("hello world");
 *
 * @example
 * // Returns "The Quick Brown Fox"
 * toTitleCase("THE QUICK BROWN FOX");
 *
 * @example
 * // Returns "A Mixed Case String"
 * toTitleCase("a MiXeD cAsE string");
 *
 * @example
 * // Returns "This Is A Long Sentence With Many Words"
 * toTitleCase("this is a long sentence with many words");
 */
export const toTitleCase = (str) => str.toLowerCase().split(' ')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')
