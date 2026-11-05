import { backfillAuditProviderIds } from './backfillAuditProviderIds'

/**
 * Calls deployment migrations in order. Add future migration calls here; each migration
 * checks its own status in the migrations collection before changing data.
 *
 * @returns {Promise<Array<Object>>} Migration outcomes for deployment logging.
 */
export const runMigrations = async () => [
  await backfillAuditProviderIds()
]
