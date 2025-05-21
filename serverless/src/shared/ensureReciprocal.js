import { ensureReciprocalDeletions } from '@/shared/ensureReciprocalDeletions'
import { ensureReciprocalInsertions } from '@/shared/ensureReciprocalInsertions'

export const ensureReciprocal = async ({
  oldRdfXml,
  newRdfXml,
  conceptId,
  version,
  transactionUrl
}) => {
  try {
    // Handle deletions
    if (oldRdfXml) {
      await ensureReciprocalDeletions({
        conceptId,
        oldRdfXml,
        newRdfXml,
        version,
        transactionUrl
      })
    }

    // Handle insertions only if newRdfXml is provided (i.e., not a deletion)
    if (newRdfXml) {
      await ensureReciprocalInsertions({
        rdfXml: newRdfXml,
        conceptId,
        version,
        transactionUrl
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('Error ensuring reciprocal relationships:', error)
    throw error
  }
}
