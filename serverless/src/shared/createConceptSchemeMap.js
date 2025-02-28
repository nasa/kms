import { XMLParser } from 'fast-xml-parser'

import getConceptSchemes from '@/getConceptSchemes/handler'

/**
 * Creates a map of concept scheme short names to their corresponding long names.
 *
 * This function fetches concept schemes from a specified source, parses the XML response,
 * and creates a Map where the keys are the short names of the concept schemes and the values
 * are their corresponding long names.
 *
 * @async
 * @function createConceptSchemeMap
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where:
 *   - key: The short name of the concept scheme (string)
 *   - value: The long name of the concept scheme (string)
 * @throws {Error} If there's an error fetching or parsing the concept schemes.
 *
 * @example
 * try {
 *   const conceptSchemeMap = await createConceptSchemeMap();
 *   console.log('Concept Scheme Map:', conceptSchemeMap);
 *   // Example output:
 *   // Concept Scheme Map: Map(2) {
 *   //   'scienceKeywords' => 'Science Keywords',
 *   //   'platforms' => 'Platforms'
 *   // }
 * } catch (error) {
 *   console.error('Error creating concept scheme map:', error);
 * }
 */

function createConceptSchemeMap() {
  return getConceptSchemes()
    .then((conceptSchemes) => {
      const xmlConceptSchemes = conceptSchemes.body
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@'
      })
      const parsedConceptSchemes = parser.parse(xmlConceptSchemes)

      return new Map(
        parsedConceptSchemes.schemes.scheme.map((scheme) => [
          scheme['@name'],
          scheme['@longName']
        ])
      )
    })
}

export { createConceptSchemeMap }
