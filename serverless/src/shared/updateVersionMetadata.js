import { sparqlRequest } from '@/shared/sparqlRequest'

export const updateVersionMetadata = async ({
  graphId,
  version,
  versionType,
  createdDate,
  modifiedDate
}) => {
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${graphId}`
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'

  let deleteClause = ''
  let insertClause = ''

  if (version !== undefined) {
    deleteClause += `<${versionUri}> gcmd:versionName ?oldVersionName .\n`
    insertClause += `<${versionUri}> gcmd:versionName "${version}" .\n`
  }

  if (versionType !== undefined) {
    deleteClause += `<${versionUri}> gcmd:versionType ?oldVersionType .\n`
    insertClause += `<${versionUri}> gcmd:versionType "${versionType}" .\n`
  }

  if (createdDate !== undefined) {
    deleteClause += `<${versionUri}> dcterms:created ?oldCreatedDate .\n`
    insertClause += `<${versionUri}> dcterms:created "${createdDate}"^^xsd:dateTime .\n`
  }

  if (modifiedDate !== undefined) {
    deleteClause += `<${versionUri}> dcterms:modified ?oldModifiedDate .\n`
    insertClause += `<${versionUri}> dcterms:modified "${modifiedDate}"^^xsd:dateTime .\n`
  }

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    WITH <${graphUri}>
    DELETE {
      ${deleteClause}
    }
    INSERT {
      <${versionUri}> a gcmd:Version .
      ${insertClause}
    }
    WHERE {
      OPTIONAL { ${deleteClause} }
    }
  `

  try {
    const response = await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: query,
      contentType: 'application/sparql-update',
      accept: 'application/json'
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to update version metadata: ${response.status} ${response.statusText}\n${errorText}`)
    }

    return response
  } catch (error) {
    console.error('Error updating version metadata:', error)
    throw error
  }
}
