import {
  afterEach,
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
  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
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

  afterEach(() => {
    vi.useRealTimers()
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

  test('retries while the new DocumentDB endpoint is not resolvable', async () => {
    vi.useFakeTimers()

    vi.mocked(getMetadataCorrectionAuditCollection)
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND audit.cluster.example'))
      .mockResolvedValue({ createIndexes })

    const resultPromise = initializeMetadataCorrectionAudit({
      RequestType: 'Create',
      ResourceProperties: { IndexDefinitions: indexDefinitions }
    })

    await vi.advanceTimersByTimeAsync(5_000)

    await expect(resultPromise).resolves.toEqual({
      PhysicalResourceId: 'metadata-correction-audit-indexes',
      Data: { IndexCount: 1 }
    })

    expect(getMetadataCorrectionAuditCollection).toHaveBeenCalledTimes(2)
    expect(consoleWarn).toHaveBeenCalledWith(
      'DocumentDB endpoint is not ready; retrying audit index creation',
      {
        attempt: 1,
        error: 'Error: getaddrinfo ENOTFOUND audit.cluster.example'
      }
    )
  })

  test('does not retry non-connection failures', async () => {
    vi.mocked(getMetadataCorrectionAuditCollection)
      .mockRejectedValue(new Error('DocumentDB secret is missing username'))

    await expect(initializeMetadataCorrectionAudit({
      RequestType: 'Create',
      ResourceProperties: { IndexDefinitions: indexDefinitions }
    })).rejects.toThrow('DocumentDB secret is missing username')

    expect(getMetadataCorrectionAuditCollection).toHaveBeenCalledTimes(1)
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  test('stops retrying when the DocumentDB readiness window expires', async () => {
    vi.useFakeTimers()

    vi.mocked(getMetadataCorrectionAuditCollection)
      .mockRejectedValue(new Error('connect ETIMEDOUT audit.cluster.example'))

    const resultPromise = initializeMetadataCorrectionAudit({
      RequestType: 'Create',
      ResourceProperties: { IndexDefinitions: indexDefinitions }
    })
    const rejection = expect(resultPromise).rejects.toThrow(
      'connect ETIMEDOUT audit.cluster.example'
    )

    await vi.runAllTimersAsync()
    await rejection

    expect(getMetadataCorrectionAuditCollection).toHaveBeenCalledTimes(24)
    expect(consoleWarn).toHaveBeenCalledTimes(23)
  })
})
