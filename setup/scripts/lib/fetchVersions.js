import { XMLParser } from 'fast-xml-parser'
import fetch from 'node-fetch'

/**
 * Fetches and parses version information for a specified version type from the GCMD KMS API.
 *
 * This function makes a request to the GCMD (Global Change Master Directory) Keyword Management
 * System (KMS) API to retrieve version information for a given version type. It then parses
 * the XML response and extracts the version numbers.
 *
 * @async
 * @function fetchVersions
 * @param {string} legacyServerEndpoint - The legacy kms endpoint to use.
 * @param {string} versionType - The type of version to fetch. Possible values include 'published', 'draft', and 'past_published'.
 * @returns {Promise<string[]>} A promise that resolves to an array of version strings.
 * @throws {Error} If there's an HTTP error during the fetch operation or if parsing fails.
 *
 * @example
 * // Fetch published versions
 * try {
 *   const publishedVersions = await fetchVersions('published');
 *   console.log('Published versions:', publishedVersions);
 * } catch (error) {
 *   console.error('Failed to fetch published versions:', error);
 * }
 *
 * @example
 * // Fetch draft versions
 * try {
 *   const draftVersions = await fetchVersions('draft');
 *   console.log('Draft versions:', draftVersions);
 * } catch (error) {
 *   console.error('Failed to fetch draft versions:', error);
 * }
 *
 * @note This function uses the fast-xml-parser library to parse the XML response.
 *       It handles both single version responses and multiple version responses.
 *
 * @see {@link https://gcmd.earthdata.nasa.gov/kms/concept_versions/version_type/|GCMD KMS API}
 */
export const fetchVersions = async (legacyServerEndpoint, versionType) => {
  try {
    const response = await fetch(`${legacyServerEndpoint}/kms/concept_versions/version_type/${versionType}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const xmlContent = await response.text()

    // Parse the XML content
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: 'value',
      parseAttributeValue: false,
      parseTagValue: false,
      tagValueProcessor: (tagName, tagValue) => tagValue?.toString() || '',
      attributeValueProcessor: (attrName, attrValue) => attrValue?.toString() || ''
    })
    const result = parser.parse(xmlContent)

    // Extract versions, ensuring we always work with an array
    // eslint-disable-next-line max-len
    const versionsArray = Array.isArray(result.versions) ? result.versions[0].version : result.versions.version
    const versions = (Array.isArray(versionsArray) ? versionsArray : [versionsArray])
      .map((v) => (typeof v === 'string' ? v : v.value))

    return versions
  } catch (error) {
    console.error('Error fetching or parsing versions:', error)
    throw error
  }
}
