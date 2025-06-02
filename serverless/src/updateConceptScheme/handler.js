import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSchemeInfo } from '@/shared/getSchemeInfo'
import {
  getSchemeUpdateCsvHeadersQuery
} from '@/shared/operations/queries/getSchemeUpdateCsvHeadersQuery'
import {
  getSchemeUpdateModifiedDateQuery
} from '@/shared/operations/queries/getSchemeUpdateModifiedDateQuery'
import {
  getSchemeUpdatePrefLabelQuery
} from '@/shared/operations/queries/getSchemeUpdatePrefLabelQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'

/**
 * Updates a concept scheme based on the provided RDF data.
 * Fields can be updated: 'skos:prefLabel' and 'gcmd:csvHeaders'
 * @async
 * @function updateConceptScheme
 * @param {Object} event - The event object containing the request details
 * @param {string} event.body - The RDF/XML data of the scheme to be updated
 * @param {Object} event.queryStringParameters - The query string parameters
 * @param {string} [event.queryStringParameters.version='draft'] - The version of the scheme to update
 * @returns {Promise<Object>} The response object with status code, body, and headers
 *
 * @example
 * // Usage example:
 * const event = {
 *   body: `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 *                   xmlns:skos="http://www.w3.org/2004/02/skos/core#"
 *                   xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"
 *                   xmlns:dcterms="http://purl.org/dc/terms/">
 *     <skos:ConceptScheme rdf:about="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/schemeA">
 *       <skos:prefLabel>schemeA updated long name</skos:prefLabel>
 *       <skos:notation>schemeA</skos:notation>
 *       <dcterms:modified>2025-03-31</dcterms:modified>
 *       <gcmd:csvHeaders>Category,Topic,Term,UpdatedColumn</gcmd:csvHeaders>
 *     </skos:ConceptScheme>
 *   </rdf:RDF>`,
 *   queryStringParameters: { version: 'draft' }
 * };
 *
 * try {
 *   const result = await updateConceptScheme(event);
 *   console.log(result);
 *   // Expected output: {
 *   //   statusCode: 201,
 *   //   body: '{"message":"Successfully updated concept scheme","schemeId":"a3"}',
 *   //   headers: {...}
 *   // }
 * } catch (error) {
 *   console.error(error);
 * }
 */
export const updateConceptScheme = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: schemeRdf, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  let transactionUrl

  try {
    // Validate that RDF/XML data is provided in the request body
    if (!schemeRdf) {
      throw new Error('Missing RDF/XML data in request body')
    }

    // Extract scheme information from the provided RDF
    const schemeInfo = getSchemeInfo(schemeRdf)
    const { schemeId, schemePrefLabel, csvHeaders } = schemeInfo
    // Validate that a scheme ID is present
    if (!schemeId) {
      throw new Error('Invalid or missing scheme ID')
    }

    // Check if the scheme already exists
    const scheme = await getConceptSchemeDetails({
      schemeName: schemeId,
      version
    })
    if (!scheme) {
      // Return a error if the scheme does not exist
      return {
        statusCode: 409,
        body: JSON.stringify({ message: `Scheme ${schemeId} not found.` }),
        headers: defaultResponseHeaders
      }
    }

    let updated

    // Start a new transaction
    transactionUrl = await startTransaction()

    if (schemePrefLabel && schemePrefLabel !== scheme.prefLabel) {
      // Update scheme prefLabel
      const response = await sparqlRequest({
        method: 'PUT',
        body: getSchemeUpdatePrefLabelQuery(schemeId, schemePrefLabel),
        contentType: 'application/sparql-update',
        version,
        transaction: {
          transactionUrl,
          action: 'UPDATE'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to update scheme prefLabel')
      }

      updated = true
    }

    if (csvHeaders && csvHeaders !== scheme.csvHeaders) {
      // Update scheme csvHeaders
      const response = await sparqlRequest({
        method: 'PUT',
        body: getSchemeUpdateCsvHeadersQuery(schemeId, csvHeaders),
        contentType: 'application/sparql-update',
        version,
        transaction: {
          transactionUrl,
          action: 'UPDATE'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to update scheme csvHeaders')
      }

      updated = true
    }

    if (updated) {
      // Update scheme modified date
      const today = new Date().toISOString()
      const response = await sparqlRequest({
        method: 'PUT',
        body: getSchemeUpdateModifiedDateQuery(schemeId, today),
        contentType: 'application/sparql-update',
        version,
        transaction: {
          transactionUrl,
          action: 'UPDATE'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to update scheme modified date')
      }
    }

    // Commit the transaction
    await commitTransaction(transactionUrl)

    console.log('Successfully updated concept scheme')

    // Return a success response
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Successfully updated concept scheme',
        schemeId
      }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error updating scheme:', error)

    // Rollback the transaction if an error occurred
    if (transactionUrl) {
      try {
        await rollbackTransaction(transactionUrl)
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError)
      }
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error updating scheme',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default updateConceptScheme
