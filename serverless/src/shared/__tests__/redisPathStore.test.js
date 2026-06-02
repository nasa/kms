import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'
import {
  getHistoricalConceptByFullPath,
  getHistoricalConceptByKeyword,
  getHistoricalConceptByShortName,
  getPublishedConceptByKeyword,
  getPublishedConceptByUuid
} from '../redisPathStore'

vi.mock('../redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

describe('redisPathStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes slotted keyword objects to the historical full-path lookup', async () => {
    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > cryosphere >  > snow/ice >  >  > ',
      scheme: 'sciencekeywords'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'science-uuid',
        fullPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
      })
    })

    await expect(getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })).resolves.toMatchObject({
      uuid: 'science-uuid',
      fullPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath'
    })
  })

  test('routes short-name keyword objects to the historical short-name lookup', async () => {
    const cacheKey = createConceptResponseCacheKeyByShortName({
      shortName: 'aqua',
      scheme: 'platforms'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'platform-uuid',
        fullPath: 'Space-based Platforms > Earth Observation Satellites >  > AQUA'
      })
    })

    await expect(getHistoricalConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {
        ShortName: 'AQUA'
      }
    })).resolves.toMatchObject({
      uuid: 'platform-uuid',
      fullPath: 'Space-based Platforms > Earth Observation Satellites >  > AQUA',
      keywordObject: {
        Class: 'Space-based Platforms',
        Type: 'Earth Observation Satellites',
        ShortName: 'AQUA'
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by shortName'
    })
  })

  test('reads published full-path concepts using the canonical path built from the object', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByFullPath({
      fullPath: 'collectionurl > project home page > ',
      scheme: 'rucontenttype'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'ru-uuid',
        fullPath: 'CollectionURL > PROJECT HOME PAGE > '
      })
    })

    await expect(getPublishedConceptByKeyword({
      scheme: 'rucontenttype',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })).resolves.toMatchObject({
      uuid: 'ru-uuid',
      fullPath: 'CollectionURL > PROJECT HOME PAGE > ',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('reads published short-name concepts using the keyword object short name', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'modis',
      scheme: 'instruments'
    })

    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'instrument-uuid',
        fullPath: 'Instruments > Radiometers > MODIS'
      })
    })

    await expect(getPublishedConceptByKeyword({
      scheme: 'instruments',
      keywordObject: {
        ShortName: 'MODIS'
      }
    })).resolves.toMatchObject({
      uuid: 'instrument-uuid',
      fullPath: 'Instruments > Radiometers > MODIS',
      keywordObject: {
        ShortName: 'MODIS'
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('reads published concepts by uuid through the same store', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })

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
    })).resolves.toMatchObject({
      uuid: 'uuid-1',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by uuid'
    })
  })

  test('returns undefined when the normalized keyword object does not contain a usable lookup value', async () => {
    await expect(getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: '',
        Topic: '',
        Term: '',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })).resolves.toBeUndefined()

    await expect(getPublishedConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {}
    })).resolves.toBeUndefined()

    expect(getCachedJsonResponse).not.toHaveBeenCalled()
  })

  test('preserves the direct full-path and short-name entrypoints for compatibility', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    })

    await expect(getHistoricalConceptByShortName({
      shortName: 'MODIS',
      scheme: 'instruments'
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      keywordObject: {
        ShortName: 'AEROSOLS'
      }
    })
  })

  test('returns undefined when the direct lookup entrypoints do not have a cached body', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200
    })

    await expect(getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()

    await expect(getHistoricalConceptByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    })).resolves.toBeUndefined()

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()
  })

  test('preserves direct short-name lookups with long-name payloads', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'AIR-BASED PLATFORMS > PROPELLER > AC-690A',
        longName: 'Aerocommander aircraft'
      })
    })

    await expect(getHistoricalConceptByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'AIR-BASED PLATFORMS > PROPELLER > AC-690A',
      longName: 'Aerocommander aircraft',
      keywordObject: {
        ShortName: 'AC-690A'
      }
    })
  })

  test('throws when the direct full-path lookup arguments are missing', async () => {
    await expect(getHistoricalConceptByFullPath({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing full path for historical concept lookup')

    await expect(getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })).rejects.toThrow('Missing scheme for historical concept lookup')
  })

  test('throws when the direct short-name lookup arguments are missing', async () => {
    await expect(getHistoricalConceptByShortName({
      scheme: 'instruments'
    })).rejects.toThrow('Missing short name for historical concept lookup')

    await expect(getHistoricalConceptByShortName({
      shortName: 'AC-690A'
    })).rejects.toThrow('Missing scheme for historical concept lookup')
  })

  test('throws when the direct published-uuid lookup arguments are missing', async () => {
    await expect(getPublishedConceptByUuid({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing uuid for published concept lookup')

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1'
    })).rejects.toThrow('Missing scheme for published concept lookup')
  })
})
