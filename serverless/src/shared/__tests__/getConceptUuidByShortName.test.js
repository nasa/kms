import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptUuidByShortName } from '../getConceptUuidByShortName'
import { createConceptResponseCacheKeyByShortName } from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'

vi.mock('../redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

vi.mock('../redisCacheKeys', () => ({
  createConceptResponseCacheKeyByShortName: vi.fn(({ shortName, scheme }) => `${scheme}:${shortName}`)
}))

describe('getConceptUuidByShortName', () => {
  test('returns the cached historical concept body for a short-name lookup', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'AIR-BASED PLATFORMS > PROPELLER > AC-690A',
        longName: 'Aerocommander aircraft'
      })
    })

    await expect(getConceptUuidByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    })).resolves.toEqual({
      uuid: 'uuid-123',
      fullPath: 'AIR-BASED PLATFORMS > PROPELLER > AC-690A',
      longName: 'Aerocommander aircraft'
    })

    expect(createConceptResponseCacheKeyByShortName).toHaveBeenCalledWith({
      shortName: 'ac-690a',
      scheme: 'instruments'
    })
  })

  test('returns undefined when the cached concept is missing', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

    await expect(getConceptUuidByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    })).resolves.toBeUndefined()
  })

  test('throws when short name is missing', async () => {
    await expect(getConceptUuidByShortName({
      scheme: 'instruments'
    })).rejects.toThrow(
      'Missing short name for historical concept lookup'
    )
  })

  test('throws when scheme is missing', async () => {
    await expect(getConceptUuidByShortName({
      shortName: 'AC-690A'
    })).rejects.toThrow(
      'Missing scheme for historical concept lookup'
    )
  })
})
