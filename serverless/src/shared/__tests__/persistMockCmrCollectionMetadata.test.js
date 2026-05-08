import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { persistMockCmrCollectionMetadata } from '../persistMockCmrCollectionMetadata'

describe('persistMockCmrCollectionMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.USE_LOCALSTACK
    delete process.env.useLocalstack
    delete process.env.MOCK_CMR_WRITEBACK_ENABLED
    delete process.env.MOCK_CMR_BASE_URL
    delete process.env.CMR_BASE_URL
  })

  test('returns disabled when local mock writeback is not enabled', async () => {
    await expect(persistMockCmrCollectionMetadata({
      collectionConceptId: 'C1',
      correctedMetadata: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      updated: false,
      enabled: false
    })
  })

  test('returns disabled when writeback is enabled but the process is not running in localstack mode', async () => {
    process.env.MOCK_CMR_WRITEBACK_ENABLED = 'true'
    process.env.MOCK_CMR_BASE_URL = 'http://127.0.0.1:3020'

    await expect(persistMockCmrCollectionMetadata({
      collectionConceptId: 'C1',
      correctedMetadata: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      updated: false,
      enabled: false
    })
  })

  test('writes corrected metadata to the mock CMR endpoint when enabled', async () => {
    process.env.USE_LOCALSTACK = 'true'
    process.env.MOCK_CMR_WRITEBACK_ENABLED = 'true'
    process.env.MOCK_CMR_BASE_URL = 'http://127.0.0.1:3020'

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        updated: true,
        revisionId: 2
      })
    })

    await expect(persistMockCmrCollectionMetadata({
      collectionConceptId: 'C1234567890-LOCAL',
      providerId: 'LOCAL',
      nativeId: 'native-1',
      nativeFormat: 'UMM',
      correctedMetadata: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      updated: true,
      revisionId: 2
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3020/local/collections/C1234567890-LOCAL',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )

    const [, requestOptions] = fetchSpy.mock.calls[0]

    expect(JSON.parse(requestOptions.body)).toEqual({
      providerId: 'LOCAL',
      nativeId: 'native-1',
      nativeFormat: 'UMM',
      umm: {
        ShortName: 'TEST'
      }
    })
  })
})
