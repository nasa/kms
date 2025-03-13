const { XMLParser } = require('fast-xml-parser')

const fetchVersions = async (versionType) => {
  try {
    // Fetch the XML content
    const response = await fetch(`https://gcmd.earthdata.nasa.gov/kms/concept_versions/version_type/${versionType}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const xmlContent = await response.text()

    // Parse the XML content
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    })
    const result = parser.parse(xmlContent)

    // Extract versions, ensuring we always work with an array
    // eslint-disable-next-line max-len
    const versionsArray = Array.isArray(result.versions) ? result.versions[0].version : result.versions.version
    const versions = (Array.isArray(versionsArray) ? versionsArray : [versionsArray])
      .map((v) => (typeof v === 'string' ? v : v['#text']))

    return versions
  } catch (error) {
    console.error('Error fetching or parsing versions:', error)
    throw error
  }
}

module.exports = { fetchVersions }
