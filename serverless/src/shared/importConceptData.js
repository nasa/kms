import { buildJsonMap } from '@/shared/buildJsonMap'
import { createSchemes } from '@/shared/createSchemes'
import { removeGraph } from '@/shared/removeGraph'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { toRDF } from '@/shared/toRDF'

const BATCH_SIZE = 100
const DEFAULT_MIN_CONCEPTS = 10000

/**
 * Imports concept data into the SPARQL endpoint.
 *
 * This function performs the following steps:
 * 1. Removes the existing graph for the given version.
 * 2. Creates concept schemes.
 * 3. Builds JSON map from the input content.
 * 4. Processes concepts in batches and uploads them to the SPARQL endpoint.
 *
 * @async
 * @function importData
 * @param {string} jsonContent - JSON content containing concept data.
 * @param {string} version - Version of the concepts being imported.
 * @param {string} versionType - Type of version (e.g., 'published', 'draft').
 * @returns {Promise<void>}
 * @throws {Error} If there's an issue during the import process.
 */
export const importConceptData = async (
  jsonContent,
  version,
  versionType,
  options = {}
) => {
  const processBatch = async (batch, jsonMap) => {
    let rdfBatch = '<?xml version="1.0" encoding="UTF-8"?>\n'
    rdfBatch += '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#" xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#">\n'

    const processedConcepts = await batch.reduce(async (accPromise, conceptId) => {
      const acc = await accPromise
      const json = jsonMap[conceptId]
      try {
        if (json) {
          const skosConcept = await toRDF(json)

          return `${acc}${skosConcept}\n`
        }
      } catch (error) {
        console.log('json=', json)
        console.error('Error processing ', conceptId, error)
      }

      return acc
    }, Promise.resolve(''))

    rdfBatch += processedConcepts
    rdfBatch += '</rdf:RDF>'
    try {
      const response = await sparqlRequest({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        method: 'POST',
        body: rdfBatch,
        version
      })

      if (!response.ok) {
        const responseText = await response.text()
        console.log('Response text:', responseText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      console.log(`Batch of ${batch.length} concepts loaded successfully`)
    } catch (error) {
      console.error('Error loading batch:', error)
    }
  }

  let versionName = version
  if (versionType === 'published') {
    versionName = 'published'
  }

  const { minConceptsRequired = DEFAULT_MIN_CONCEPTS } = options

  const jsonMap = await buildJsonMap(jsonContent)
  const conceptIds = Object.keys(jsonMap)

  if (conceptIds.length < minConceptsRequired) {
    throw new Error(`Refusing to import data, # of concepts < ${minConceptsRequired}`)
  }

  await removeGraph(versionName)

  await createSchemes(versionName, versionType)

  const batchCount = Math.ceil(conceptIds.length / BATCH_SIZE)
  await Array.from({ length: batchCount }).reduce(async (previousPromise, _, index) => {
    await previousPromise
    const start = index * BATCH_SIZE
    const batch = conceptIds.slice(start, start + BATCH_SIZE)
    console.log(`Processing batch ${index + 1} of ${Math.ceil(conceptIds.length / BATCH_SIZE)}`)

    return processBatch(batch, jsonMap)
  }, Promise.resolve())

  console.log('All batches processed')
}
