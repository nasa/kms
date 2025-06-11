import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSchemeInfo } from '@/shared/getSchemeInfo'
import { getSkosRootConcept } from '@/shared/getSkosRootConcept'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import {
  getDeleteTriplesForSchemeQuery
} from '@/shared/operations/queries/getDeleteTriplesForSchemeQuery'
import {
  getSchemeUpdateModifiedDateQuery
} from '@/shared/operations/queries/getSchemeUpdateModifiedDateQuery'
import { getUpdatePrefLabelQuery } from '@/shared/operations/updates/getUpdatePrefLabelQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateModifiedDate } from '@/shared/updateModifiedDate'
import { validateSchemeNotation } from '@/shared/validateSchemeNotation'

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
export const updateConceptScheme = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: schemeRdf, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  logAnalyticsData({
    event,
    context
  })

  let transactionUrl

  try {
    // Validate that RDF/XML data is provided in the request body
    if (!schemeRdf) {
      throw new Error('Missing RDF/XML data in request body')
    }

    // Validate that skos:notation matches the schemeId. Validator throws error if
    // checks fails
    validateSchemeNotation(schemeRdf)

    // Extract scheme information from the provided RDF
    const schemeInfo = getSchemeInfo(schemeRdf)
    const { schemeId, schemePrefLabel } = schemeInfo
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

    // Start a new transaction
    transactionUrl = await startTransaction()

    // Get the root concept of the scheme
    const skosRootConcept = await getSkosRootConcept(schemeId)
    // Extract concept ID
    const conceptId = skosRootConcept['@rdf:about']
    // Construct scheme IRI
    const schemeIRI = `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}`
    // Today's date
    const today = new Date().toISOString()

    // Remove existing scheme
    const deleteResponse = await sparqlRequest({
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
      method: 'PUT',
      body: getDeleteTriplesForSchemeQuery(schemeIRI),
      version,
      transaction: {
        transactionUrl,
        action: 'UPDATE'
      }
    })
    if (!deleteResponse.ok) {
      throw new Error('Failed to delete existing scheme')
    }

    // Insert updated scheme
    const insertResponse = await sparqlRequest({
      method: 'PUT',
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      body: schemeRdf,
      version,
      transaction: {
        transactionUrl,
        action: 'ADD'
      }
    })

    if (!insertResponse.ok) {
      throw new Error(`HTTP error! insert/update data status: ${insertResponse.status}`)
    }

    // Update scheme modified date
    const updateResponse = await sparqlRequest({
      method: 'PUT',
      body: getSchemeUpdateModifiedDateQuery(schemeId, today),
      contentType: 'application/sparql-update',
      version,
      transaction: {
        transactionUrl,
        action: 'UPDATE'
      }
    })
    if (!updateResponse.ok) {
      throw new Error('Failed to update scheme modified date')
    }

    // Check if prefLabel changed, if so, update root concept prefLabel
    if (schemePrefLabel && schemePrefLabel !== scheme.prefLabel) {
      // Update root concept prefLabel
      const conceptUpdateResponse = await sparqlRequest({
        method: 'PUT',
        body: getUpdatePrefLabelQuery(conceptId, schemePrefLabel),
        contentType: 'application/sparql-update',
        version,
        transaction: {
          transactionUrl,
          action: 'UPDATE'
        }
      })
      if (!conceptUpdateResponse.ok) {
        throw new Error('Failed to update root concept prefLabel')
      }

      // Update root concept modified date
      const updateConceptModifiedSuccess = await updateModifiedDate(
        conceptId,
        version,
        today,
        transactionUrl
      )

      if (!updateConceptModifiedSuccess) {
        throw new Error('HTTP error! updating last modified date failed')
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
