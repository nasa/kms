// Serverless/src/updateConcept/handler.js

import { deleteTriples } from '@/shared/deleteTriples'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptById } from '@/shared/getConceptById'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

export const updateConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: newRdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  try {
    if (!newRdfXml) {
      throw new Error('Missing RDF/XML data in request body')
    }

    // Check conceptId
    const conceptId = getConceptId(newRdfXml)
    if (!conceptId) {
      throw new Error('Invalid or missing concept ID')
    }

    const oldRdfXml = await getConceptById(conceptId, version)
    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

    // Start transaction
    const transactionUrl = await startTransaction()

    try {
      if (oldRdfXml) {
        // Remove existing concept
        const deleteResponse = await deleteTriples(conceptIRI, version, transactionUrl)
        if (!deleteResponse.ok) {
          throw new Error('Failed to delete existing concept')
        }
      }

      // Insert updated concept
      const insertResponse = await sparqlRequest({
        method: 'PUT',
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        body: newRdfXml,
        version,
        transaction: {
          transactionUrl,
          action: 'ADD'
        }
      })

      if (!insertResponse.ok) {
        throw new Error(`HTTP error! insert/update data status: ${insertResponse.status}`)
      }

      // Ensure reciprocal relationships
      await ensureReciprocal({
        oldRdfXml,
        newRdfXml,
        conceptId,
        version,
        transactionUrl
      })

      // Update the modified date
      const today = new Date().toISOString()
      const updateModifiedSuccess = await updateModifiedDate(
        conceptId,
        version,
        today,
        transactionUrl
      )

      if (!updateModifiedSuccess) {
        throw new Error('HTTP error! updating last modified date failed')
      }

      // Commit transaction
      await commitTransaction(transactionUrl)

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully updated concept: ${conceptId}` }),
        headers: defaultResponseHeaders
      }
    } catch (error) {
      // Rollback the transaction if an error occurred
      if (transactionUrl) {
        try {
          await rollbackTransaction(transactionUrl)
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError)
        }
      }

      throw error
    }
  } catch (error) {
    console.error('Error updating concept:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default updateConcept
