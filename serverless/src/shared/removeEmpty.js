import compactDeep from 'compact-object-deep'

/**
 * Removes empty values from an object, preserving boolean values.
 * This function uses the 'compact-object-deep' library to recursively remove
 * empty values from nested objects and arrays.
 *
 * @param {Object} obj - The object to clean up.
 * @returns {Object} A new object with empty values removed.
 *
 * @example
 * const dirtyObject = {
 *   name: 'John',
 *   age: null,
 *   address: {
 *     street: '',
 *     city: 'New York',
 *     country: undefined
 *   },
 *   hobbies: [],
 *   isStudent: false
 * };
 *
 * const cleanObject = removeEmpty(dirtyObject);
 *
 * // cleanObject will be:
 * // {
 * //   name: 'John',
 * //   address: {
 * //     city: 'New York'
 * //   },
 * //   isStudent: false
 * // }
 */
export const removeEmpty = (obj) => compactDeep(obj, (val) => {
  if (typeof val === 'boolean') { return val }

  return undefined
})
