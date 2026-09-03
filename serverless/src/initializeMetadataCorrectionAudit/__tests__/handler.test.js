import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

import { initializeMetadataCorrectionAudit } from '../handler'

vi.mock('@/shared/documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn()
}))

describe('initializeMetadataCorrectionAudit', () => {
  const createIndexes = vi.fn()
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
  const indexDefinitions = [
    {
      key: {
        createdAt: -1,
        _id: -1
      },
      name: 'createdAt_desc'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    createIndexes.mockResolvedValue(['createdAt_desc'])
    vi.mocked(getMetadataCorrectionAuditCollection).mockResolvedValue({ createIndexes })
  })

  test.each(['Create', 'Update'])('creates indexes for a %s deployment event', async (requestType) => {
    const result = await initializeMetadataCorrectionAudit({
      RequestType: requestType,
      ResourceProperties: { IndexDefinitions: indexDefinitions }
    })

    expect(createIndexes).toHaveBeenCalledWith(indexDefinitions)
    expect(consoleLog).toHaveBeenCalledWith(
      'Metadata correction audit indexes are ready',
      { indexNames: ['createdAt_desc'] }
    )

    expect(result).toEqual({
      PhysicalResourceId: 'metadata-correction-audit-indexes',
      Data: { IndexCount: 1 }
    })
  })

  test('does not change the retained database during stack deletion', async () => {
    const result = await initializeMetadataCorrectionAudit({
      RequestType: 'Delete',
      PhysicalResourceId: 'existing-audit-indexes'
    })

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
    expect(result).toEqual({ PhysicalResourceId: 'existing-audit-indexes' })
  })

  test('rejects a deployment without index definitions', async () => {
    await expect(initializeMetadataCorrectionAudit({
      RequestType: 'Create',
      ResourceProperties: {}
    })).rejects.toThrow('Metadata correction audit index definitions are required')

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
  })
})
