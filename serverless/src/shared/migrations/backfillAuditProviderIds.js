import { normalizeProviderId } from '@/shared/cmrWritebackProviders'
import {
  getDatabaseMigrationsCollection,
  getMetadataCorrectionAuditCollection
} from '@/shared/documentDbClient'

const BATCH_SIZE = 500
const MIGRATION_ID = '2026-10-29-backfill-audit-provider-ids'

/**
 * Fills missing audit providers without rewriting existing values or lifecycle timestamps.
 * Updates guard the missing field again so a concurrent audit writer always wins.
 *
 * @returns {Promise<Object>} Counts for this attempt, stored with the migration status.
 */
const backfillMissingProviders = async () => {
  const collection = await getMetadataCorrectionAuditCollection()
  const cursor = collection.find({
    providerId: { $in: [null, ''] },
    collectionConceptId: { $type: 'string' }
  }, {
    projection: {
      _id: 1,
      collectionConceptId: 1
    }
  }).batchSize(BATCH_SIZE)
  let operations = []
  let scannedCount = 0
  let updatedCount = 0

  const flush = async () => {
    if (!operations.length) return

    const result = await collection.bulkWrite(operations, { ordered: false })
    updatedCount += result.modifiedCount
    operations = []
  }

  try {
    // Stream bounded batches instead of materializing the complete audit history in Lambda memory.
    // eslint-disable-next-line no-restricted-syntax
    for await (const { _id: id, collectionConceptId } of cursor) {
      scannedCount += 1
      const match = collectionConceptId.match(/^C\d+-([a-z\d_-]+)$/i)
      if (match) {
        operations.push({
          updateOne: {
            filter: {
              _id: id,
              providerId: { $in: [null, ''] }
            },
            update: { $set: { providerId: normalizeProviderId(match[1]) } }
          }
        })
      }

      if (operations.length === BATCH_SIZE) {
        // Await each batch to bound database load and retain failures for the migration runner.
        // eslint-disable-next-line no-await-in-loop
        await flush()
      }
    }

    await flush()
  } finally {
    await cursor.close()
  }

  return {
    scannedCount,
    updatedCount,
    skippedCount: scannedCount - updatedCount
  }
}

/**
 * Runs this specific backfill once to completion per database, recording its status separately.
 * Failed or interrupted work can safely resume because each provider update is guarded
 * and completed migrations are never repeated.
 *
 * @returns {Promise<Object>} Completion or skip result.
 */
export const backfillAuditProviderIds = async () => {
  const migrations = await getDatabaseMigrationsCollection()
  const existing = await migrations.findOne({ _id: MIGRATION_ID })
  if (existing?.status === 'completed') {
    return {
      id: MIGRATION_ID,
      skipped: true
    }
  }

  const startedAt = new Date()
  await migrations.updateOne({ _id: MIGRATION_ID }, {
    $set: {
      status: 'running',
      startedAt,
      updatedAt: startedAt
    },
    $setOnInsert: { createdAt: startedAt },
    $inc: { attempts: 1 },
    $unset: {
      error: '',
      failedAt: '',
      completedAt: '',
      result: ''
    }
  }, { upsert: true })

  try {
    const result = await backfillMissingProviders()
    const completedAt = new Date()
    await migrations.updateOne({ _id: MIGRATION_ID }, {
      $set: {
        status: 'completed',
        completedAt,
        updatedAt: completedAt,
        result
      }
    })

    return {
      id: MIGRATION_ID,
      skipped: false,
      result
    }
  } catch (error) {
    const failedAt = new Date()
    await migrations.updateOne({ _id: MIGRATION_ID }, {
      $set: {
        status: 'failed',
        failedAt,
        updatedAt: failedAt,
        error: { message: error?.message || String(error) }
      }
    })

    // Leave deployment failed rather than treating a partial backfill as completed.
    throw error
  }
}
