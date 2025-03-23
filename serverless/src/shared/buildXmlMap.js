const { XMLParser } = require('fast-xml-parser')

/**
 * Builds a map of XML concepts indexed by their UUIDs.
 *
 * This function parses an XML string and creates a map where each concept
 * is indexed by its UUID. It preserves attributes and handles both single
 * and multiple concept scenarios.
 *
 * @async
 * @function buildXmlMap
 * @param {string} content - The XML string containing concept data.
 * @returns {Promise<Object>} A promise that resolves to an object where keys are UUIDs and values are the corresponding XML concept objects.
 * @throws {Error} If there's an error parsing the XML or building the map.
 *
 * @example
 * const xmlContent = '<results><concept uuid="123"><data>value1</data></concept></results>';
 * const xmlMap = await buildXmlMap(xmlContent);
 * console.log(xmlMap);
 * // Output: { '123': { '@_uuid': '123', data: 'value1' } }
 */
export const buildXmlMap = async (content) => {
  // Configure the XML parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    numberParseOptions: {
      hex: false,
      leadingZeros: false,
      skipLike: /./
    }
  })

  // Parse the XML content
  const result = parser.parse(content)

  // Create a map from the parsed XML
  const xmlMap = {}
  if (result.results && result.results.concept) {
    const concepts = Array.isArray(result.results.concept)
      ? result.results.concept
      : [result.results.concept]

    concepts.forEach((concept) => {
      if (concept['@_uuid']) {
        xmlMap[concept['@_uuid']] = concept
      } else {
        console.warn('Found concept without UUID:', concept)
      }
    })
  } else {
    console.warn('Unexpected XML structure')
  }

  return xmlMap
}
