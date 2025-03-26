/**
 * Builds a map of JSON objects indexed by their UUIDs.
 *
 * This function parses a JSON string while preserving number-like strings,
 * and creates a map where each JSON object is indexed by its UUID.
 *
 * @async
 * @function buildJsonMap
 * @param {string} content - The JSON string containing an array of objects.
 * @returns {Promise<Object>} A promise that resolves to an object where keys are UUIDs and values are the corresponding JSON objects.
 * @throws {Error} If there's an error parsing the JSON or building the map.
 *
 * @example
 * const jsonContent = '[{"uuid": "123", "value": "1.0"}, {"uuid": "456", "value": 2}]';
 * const jsonMap = await buildJsonMap(jsonContent);
 * console.log(jsonMap);
 * // Output: { '123': { uuid: '123', value: '1.0' }, '456': { uuid: '456', value: 2 } }
 */
export const buildJsonMap = async (content) => {
  const parseJsonPreserveNumbers = (jsonString) => JSON.parse(jsonString, (key, value) => {
    if (typeof value === 'string') {
      // Check if the string looks like a number but preserve it as a string
      // i.e., we don't want 1.0 to be converted to 1
      if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(value)) {
        return value // Return the original string
      }
    }

    return value
  })

  try {
    // Parse the JSON content while preserving number-like strings
    const jsonArray = parseJsonPreserveNumbers(content)

    // Create a map from the JSON array
    const jsonMap = {}
    jsonArray.forEach((jsonObj) => {
      if (jsonObj.uuid) {
        // Store the object directly, no need to stringify
        jsonMap[jsonObj.uuid] = jsonObj
      } else {
        console.warn('Found JSON object without UUID:', jsonObj)
      }
    })

    return jsonMap
  } catch (error) {
    console.error('Error building JSON map:', error)
    throw error
  }
}
