/**
 * Cleans up a JSON object by removing empty strings, null values, and empty objects or arrays.
 *
 * @param {Object|Array} obj - The object or array to clean up.
 * @returns {Object|Array} A new object or array with empty values removed.
 *
 * @example
 * // Cleaning up a simple object
 * const simpleObj = {
 *   name: "John",
 *   age: 30,
 *   email: "",
 *   phone: null
 * };
 * console.log(cleanupJsonObject(simpleObj));
 * // Output: { name: "John", age: 30 }
 *
 * @example
 * // Cleaning up a nested object
 * const nestedObj = {
 *   user: {
 *     id: 1,
 *     details: {
 *       firstName: "Alice",
 *       lastName: "Smith",
 *       middleName: ""
 *     },
 *     preferences: {}
 *   },
 *   settings: null
 * };
 * console.log(cleanupJsonObject(nestedObj));
 * // Output: { user: { id: 1, details: { firstName: "Alice", lastName: "Smith" } } }
 *
 * @example
 * // Cleaning up an object with arrays
 * const objWithArrays = {
 *   prefLabel: "KB",
 *   root: false,
 *   numberOfCollections: null,
 *   scheme: "DistributionSizeUnit",
 *   version: "20.6",
 *   uuid: "dfa902e9-a19e-4f85-9cb3-983ddff45011",
 *   fullPath: "KB",
 *   longName: "",
 *   narrower: [],
 *   broader: {
 *     prefLabel: "Distribution Size Unit",
 *     uuid: "e0e6f883-9dee-4908-bb76-20adae968df1"
 *   }
 * };
 * console.log(cleanupJsonObject(objWithArrays));
 * // Output:
 * // {
 * //   prefLabel: "KB",
 * //   root: false,
 * //   scheme: "DistributionSizeUnit",
 * //   version: "20.6",
 * //   uuid: "dfa902e9-a19e-4f85-9cb3-983ddff45011",
 * //   fullPath: "KB",
 * //   broader: {
 * //     prefLabel: "Distribution Size Unit",
 * //     uuid: "e0e6f883-9dee-4908-bb76-20adae968df1"
 * //   }
 * // }
 */
export const cleanupJsonObject = (obj) => {
  // If the input is not an object or is null, return it as-is
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  // If the input is an array, process each element recursively
  if (Array.isArray(obj)) {
    return obj
      .map(cleanupJsonObject)
      .filter((item) => item !== undefined
        && item !== null
        && (typeof item !== 'object' || Object.keys(item).length > 0))
  }

  // If the input is an object, process its key-value pairs
  return Object.entries(obj).reduce((cleanedObj, [key, value]) => {
    // Skip empty strings
    if (typeof value === 'string' && value.trim() === '') {
      return cleanedObj
    }

    // Skip null values
    if (value === null) {
      return cleanedObj
    }

    // If the value is an object or array, process it recursively
    if (typeof value === 'object') {
      const cleanedValue = cleanupJsonObject(value)
      // Include the cleaned value only if it's not null and not empty
      if (cleanedValue !== null
        && (Array.isArray(cleanedValue)
          ? cleanedValue.length > 0
          : Object.keys(cleanedValue).length > 0)) {
        return {
          ...cleanedObj,
          [key]: cleanedValue
        }
      }
    } else {
      // For non-object values, include them as-is
      return {
        ...cleanedObj,
        [key]: value
      }
    }

    // If none of the above conditions are met, return the object without this key-value pair
    return cleanedObj
  }, {})
}
