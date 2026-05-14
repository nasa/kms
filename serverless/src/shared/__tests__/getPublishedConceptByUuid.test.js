import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getPublishedConceptByUuid } from '../getPublishedConceptByUuid'
import { getCachedJsonResponse } from '../redisCacheStore'

vi.mock('../redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

describe('getPublishedConceptByUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns a parsed published concept payload when redis has a cached body', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-1',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })).resolves.toEqual({
      uuid: 'uuid-1',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:sciencekeywords:published_concept:uuid:uuid-1',
      entityLabel: 'Published Concept by uuid'
    })
  })

  test('returns undefined when redis has no cached body', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200
    })

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()
  })

  test('throws when uuid is missing', async () => {
    await expect(getPublishedConceptByUuid({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing uuid for published concept lookup')
  })

  test('throws when scheme is missing', async () => {
    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1'
    })).rejects.toThrow('Missing scheme for published concept lookup')
  })
})
