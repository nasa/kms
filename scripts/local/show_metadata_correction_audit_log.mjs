#!/usr/bin/env node

const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || 'C1234567890-LOCAL'
const rdf4jUserName = process.env.RDF4J_USER_NAME || 'rdf4j'
const rdf4jPassword = process.env.RDF4J_PASSWORD || 'rdf4j'
const rdf4jServiceUrl = process.env.RDF4J_SERVICE_URL || 'http://localhost:8081'
const rdf4jRepository = process.env.RDF4J_REPOSITORY || 'kms'
const rdf4jRepositoryUrl = `${rdf4jServiceUrl.replace(/\/$/, '')}/rdf4j-server/repositories/${rdf4jRepository}`

const createAuthHeader = () => (
  `Basic ${Buffer.from(`${rdf4jUserName}:${rdf4jPassword}`).toString('base64')}`
)

const executeSparqlQuery = async (query) => {
  const response = await fetch(rdf4jRepositoryUrl, {
    method: 'POST',
    headers: {
      Authorization: createAuthHeader(),
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json'
    },
    body: query
  })

  if (!response.ok) {
    const responseText = await response.text()

    throw new Error(`RDF4J query failed: ${response.status} ${responseText}`)
  }

  return response.json()
}

const parseBindings = (results = []) => results.map((binding) => Object.fromEntries(
  Object.entries(binding).map(([key, value]) => [key, value?.value || ''])
))

const getAuditRowCount = async () => {
  const responseBody = await executeSparqlQuery(`
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>

    SELECT (COUNT(?record) AS ?count)
    WHERE {
      GRAPH <https://gcmd.earthdata.nasa.gov/kms/audit/metadata-corrections> {
        ?record a gcmd:MetadataCorrectionAuditRecord ;
                gcmd:collectionConceptId "${collectionConceptId}" .
      }
    }
  `)

  const parsedRows = parseBindings(responseBody?.results?.bindings || [])

  return Number(parsedRows[0]?.count || 0)
}

const getAuditRows = async () => {
  const responseBody = await executeSparqlQuery(`
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?timestamp ?publishedVersionName ?collectionConceptId ?scheme ?action ?oldKeywordPath ?newKeywordPath ?status
    WHERE {
      GRAPH <https://gcmd.earthdata.nasa.gov/kms/audit/metadata-corrections> {
        ?record a gcmd:MetadataCorrectionAuditRecord ;
                dcterms:created ?timestamp ;
                gcmd:publishedVersionName ?publishedVersionName ;
                gcmd:collectionConceptId ?collectionConceptId ;
                gcmd:scheme ?scheme ;
                gcmd:action ?action ;
                gcmd:oldKeywordPath ?oldKeywordPath ;
                gcmd:newKeywordPath ?newKeywordPath ;
                gcmd:status ?status .
        FILTER(?collectionConceptId = "${collectionConceptId}")
      }
    }
    ORDER BY DESC(?timestamp)
  `)

  return parseBindings(responseBody?.results?.bindings || []).map((row) => ({
    timestamp: row.timestamp,
    version: row.publishedVersionName,
    conceptId: row.collectionConceptId,
    scheme: row.scheme,
    action: row.action,
    status: row.status,
    oldPath: row.oldKeywordPath,
    newPath: row.newKeywordPath
  }))
}

const main = async () => {
  const count = await getAuditRowCount()
  const rows = await getAuditRows()

  console.log(`Metadata correction audit rows for ${collectionConceptId}: ${count}`)

  if (rows.length === 0) {
    console.log('No audit rows found.')

    return
  }

  console.table(rows)
}

main().catch((error) => {
  console.error('[show-metadata-correction-audit-log] Failed to query audit log', error)
  process.exitCode = 1
})
