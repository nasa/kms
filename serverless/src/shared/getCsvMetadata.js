import { format } from 'date-fns'
/**
 * Generates metadata for CSV files
 * @param {string} scheme - The scheme name for the XML representation URL
 * @returns {string[]} An array of metadata strings
 */
const getCsvMetadata = (scheme) => {
  // Initialize an empty array to store metadata
  const metadata = []
  // Add standard metadata information
  metadata.push('Keyword Version: N')
  metadata.push('Revision: N')
  // Add timestamp in the format 'yyyy-MM-dd HH:mm:ss'
  metadata.push(`Timestamp: ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`)
  // Add Terms of Use URL
  metadata.push('Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf')
  // Add URL for the most up-to-date XML representations
  metadata.push(`The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}/?format=xml`)

  // Return the completed metadata array
  return metadata
}

// Export the function as the default export
export default getCsvMetadata
