import { getMetadataCorrectionAuditCollection } from '../../serverless/src/shared/documentDbClient'

/**
 * Removes prior audit documents for a smoke collection so assertions start from a clean state.
 *
 * @example
 * await clearAuditDocumentsForCollection('C1234567890-LOCAL')
 *
 * @param {string} collectionConceptId Collection whose local audit documents should be removed.
 * @returns {Promise<void>} Resolves after matching audit documents are deleted.
 */
export const clearAuditDocumentsForCollection = async (collectionConceptId) => {
  process.env.DOCUMENTDB_URI = process.env.DOCUMENTDB_URI
    || `mongodb://localhost:${process.env.DOCUMENTDB_HOST_PORT || 27018}`

  const auditCollection = await getMetadataCorrectionAuditCollection()

  await auditCollection.deleteMany({ collectionConceptId })
}
