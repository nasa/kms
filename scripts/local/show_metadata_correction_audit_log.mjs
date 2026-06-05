#!/usr/bin/env node

/**
 * Local audit-log inspector for the metadata-correction smoke flow.
 *
 * This script queries the RDF4J audit graph used by the metadata-correction service and prints
 * a small summary table for one collection concept id. It is mainly a convenience tool for the
 * local smoke test so we can quickly confirm which corrections were written, in what order, and
 * with what final status.
 */
const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || 'C1234567890-LOCAL'
const rdf4jUserName = process.env.RDF4J_USER_NAME || 'rdf4j'
const rdf4jPassword = process.env.RDF4J_PASSWORD || 'rdf4j'
const rdf4jServiceUrl = process.env.RDF4J_SERVICE_URL || 'http://localhost:8081'
const rdf4jRepository = process.env.RDF4J_REPOSITORY || 'kms'
const rdf4jRepositoryUrl = `${rdf4jServiceUrl.replace(/\/$/, '')}/rdf4j-server/repositories/${rdf4jRepository}`

// Build the basic-auth header expected by the local RDF4J container.
const createAuthHeader = () => (
  `Basic ${Buffer.from(`${rdf4jUserName}:${rdf4jPassword}`).toString('base64')}`
)

// Execute a SPARQL query against the configured RDF4J repository and return JSON bindings.
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

// Flatten SPARQL JSON bindings into plain row objects for easier post-processing.
const parseBindings = (results = []) => results.map((binding) => Object.fromEntries(
  Object.entries(binding).map(([key, value]) => [key, value?.value || ''])
))

// Count how many audit records exist for the requested collection concept id.
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

// Fetch the detailed audit rows we want to display in the local smoke summary table.
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
                gcmd:status ?status .
        OPTIONAL { ?record gcmd:oldKeywordPath ?oldKeywordPath }
        OPTIONAL { ?record gcmd:newKeywordPath ?newKeywordPath }
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
    oldKeywordPath: row.oldKeywordPath,
    newKeywordPath: row.newKeywordPath
  }))
}

/**
 * Queries RDF4J for audit rows and prints a simple summary table for local smoke verification.
 *
 * @returns {Promise<void>}
 */
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
