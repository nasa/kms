import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

const PHYSICAL_RESOURCE_ID = 'metadata-correction-audit-indexes'
const INDEX_CREATION_MAX_ATTEMPTS = 24
const INDEX_CREATION_RETRY_DELAY_MS = 5_000
const RETRYABLE_CONNECTION_ERROR_CODES = [
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT'
]

/**
 * Returns whether DocumentDB is still becoming reachable after cluster creation.
 *
 * @example
 * isRetryableConnectionError(new Error('getaddrinfo ENOTFOUND cluster.example')) // true
 *
 * @param {unknown} error Connection error from the MongoDB driver.
 * @returns {boolean} Whether retrying may succeed once the endpoint is ready.
 */
const isRetryableConnectionError = (error) => {
  const errorMessage = String(error)

  return RETRYABLE_CONNECTION_ERROR_CODES.some((code) => errorMessage.includes(code))
}

/**
 * Creates the configured indexes, retrying while a new DocumentDB endpoint becomes reachable.
 *
 * @param {Array<object>} indexDefinitions MongoDB index definitions.
 * @param {number} attempt Current connection attempt.
 * @returns {Promise<Array<string>>} Names returned by MongoDB for the created indexes.
 */
const createAuditIndexes = async (indexDefinitions, attempt = 1) => {
  try {
    const collection = await getMetadataCorrectionAuditCollection()

    return await collection.createIndexes(indexDefinitions)
  } catch (error) {
    if (
      !isRetryableConnectionError(error)
      || attempt >= INDEX_CREATION_MAX_ATTEMPTS
    ) {
      throw error
    }

    console.warn('DocumentDB endpoint is not ready; retrying audit index creation', {
      attempt,
      error: String(error)
    })

    await new Promise((resolve) => {
      setTimeout(resolve, INDEX_CREATION_RETRY_DELAY_MS)
    })

    return createAuditIndexes(indexDefinitions, attempt + 1)
  }
}

/**
 * Creates the metadata-correction audit indexes during CloudFormation deployment.
 * Delete events intentionally leave indexes in place because the audit database is retained.
 *
 * @example
 * await initializeMetadataCorrectionAudit({
 *   RequestType: 'Create',
 *   ResourceProperties: {
 *     IndexDefinitions: [{ key: { createdAt: -1 }, name: 'createdAt_desc' }]
 *   }
 * })
 * // { PhysicalResourceId: 'metadata-correction-audit-indexes', Data: { IndexCount: 1 } }
 *
 * @param {Object} event CloudFormation custom-resource event.
 * @returns {Promise<Object>} Stable resource identity and deployment details.
 */
export const initializeMetadataCorrectionAudit = async (event) => {
  // The custom-resource provider forwards CloudFormation Create, Update, and Delete events here.
  const physicalResourceId = event.PhysicalResourceId || PHYSICAL_RESOURCE_ID

  // The DocumentDB cluster is retained, so stack deletion must not remove its data or indexes.
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: physicalResourceId }
  }

  const indexDefinitions = event.ResourceProperties?.IndexDefinitions

  if (!Array.isArray(indexDefinitions) || indexDefinitions.length === 0) {
    throw new Error('Metadata correction audit index definitions are required')
  }

  const indexNames = await createAuditIndexes(indexDefinitions)
  console.log('Metadata correction audit indexes are ready', { indexNames })

  return {
    PhysicalResourceId: physicalResourceId,
    Data: {
      IndexCount: indexDefinitions.length
    }
  }
}

export default initializeMetadataCorrectionAudit
