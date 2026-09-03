import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

const PHYSICAL_RESOURCE_ID = 'metadata-correction-audit-indexes'

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

  const collection = await getMetadataCorrectionAuditCollection()
  const indexNames = await collection.createIndexes(indexDefinitions)
  console.log('Metadata correction audit indexes are ready', { indexNames })

  return {
    PhysicalResourceId: physicalResourceId,
    Data: {
      IndexCount: indexDefinitions.length
    }
  }
}

export default initializeMetadataCorrectionAudit
