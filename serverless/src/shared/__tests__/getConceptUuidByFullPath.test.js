import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptUuidByFullPath } from '../getConceptUuidByFullPath'
import { createConceptResponseCacheKeyByFullPath } from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'

vi.mock('../redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

vi.mock('../redisCacheKeys', () => ({
  createConceptResponseCacheKeyByFullPath: vi.fn(({ fullPath, scheme }) => `${scheme}:${fullPath}`)
}))

describe('getConceptUuidByFullPath', () => {
  test('returns the cached historical concept body for a full path lookup', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(getConceptUuidByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })).resolves.toEqual({
      uuid: 'uuid-123',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    expect(createConceptResponseCacheKeyByFullPath).toHaveBeenCalledWith({
      fullPath: 'earth science > atmosphere > aerosols',
      scheme: 'sciencekeywords'
    })
  })

  test('returns undefined when the cached concept is missing', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

    await expect(getConceptUuidByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()
  })

  test('throws when full path is missing', async () => {
    await expect(getConceptUuidByFullPath({
      scheme: 'sciencekeywords'
    })).rejects.toThrow(
      'Missing full path for historical concept lookup'
    )
  })

  test('throws when scheme is missing', async () => {
    await expect(getConceptUuidByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })).rejects.toThrow(
      'Missing scheme for historical concept lookup'
    )
  })
})
