import { format } from 'date-fns'

/**
 * Creates CSV metadata for a keyword version.
 *
 * @param {Object} options - The options for creating metadata.
 * @param {string} options.versionName - The name of the keyword version.
 * @param {string} options.versionCreationDate - The creation date of the version.
 * @param {string} options.scheme - The scheme identifier for the XML representation URL.
 * @returns {string[]} An array of metadata strings.
 */
export const createCsvMetadata = ({
  versionName, versionCreationDate, scheme
}) => {
  // Initialize an empty array to store metadata
  const metadata = []
  // Add standard metadata information
  metadata.push(`Keyword Version: ${versionName}`)
  metadata.push(`Revision: ${versionCreationDate}`)
  // Add timestamp in the format 'yyyy-MM-dd HH:mm:ss'
  metadata.push(`Timestamp: ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`)
  // Add Terms of Use URL
  metadata.push('Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf')
  // Add URL for the most up-to-date XML representations
  metadata.push(`The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}/?format=xml`)

  // Return the completed metadata array
  return metadata
}
