import { sparqlRequest } from '@/shared/sparqlRequest'

export const createVersionMetadata = async ({
  version,
  versionType,
  createdDate,
  modifiedDate
}) => {
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'
  console.log('Creating version:', versionUri, 'as', versionType)

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    WITH <${graphUri}>
    INSERT {
      <${versionUri}> a gcmd:Version ;
        gcmd:versionType "${versionType}" ;
        dcterms:created "${createdDate}"^^xsd:dateTime ;
        dcterms:modified "${modifiedDate}"^^xsd:dateTime .
    }
    WHERE {
      # This empty WHERE clause will always evaluate to true,
      # effectively making this an unconditional insert
    }
  `

  try {
    const response = await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: query,
      contentType: 'application/sparql-update',
      accept: 'application/json',
      version
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create version metadata: ${response.status} ${response.statusText}\n${errorText}`)
    }

    return response
  } catch (error) {
    console.error('Error creating version metadata:', error)
    throw error
  }
}
