import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { backfillAuditProviderIds } from '../migrations/backfillAuditProviderIds'
import { runMigrations } from '../migrations/runMigrations'

vi.mock('../migrations/backfillAuditProviderIds', () => ({ backfillAuditProviderIds: vi.fn() }))

describe('runMigrations', () => {
  beforeEach(() => { vi.resetAllMocks() })

  test('directly calls the provider migration and returns its result', async () => {
    const result = {
      id: '2026-10-29-backfill-audit-provider-ids',
      skipped: true
    }
    vi.mocked(backfillAuditProviderIds).mockResolvedValue(result)

    await expect(runMigrations()).resolves.toEqual([result])

    expect(backfillAuditProviderIds).toHaveBeenCalledOnce()
  })

  test('propagates migration failures to deployment', async () => {
    vi.mocked(backfillAuditProviderIds).mockRejectedValue(new Error('backfill failed'))

    await expect(runMigrations()).rejects.toThrow('backfill failed')
  })
})
