import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName
} from '../../redisCacheKeys'
import { getCachedJsonResponse } from '../../redisCacheStore'
import { getHistoricalConceptByKeyword } from '../getHistoricalConceptByKeyword'

vi.mock('../../redisCacheStore', async () => {
  const actual = await vi.importActual('../../redisCacheStore')

  return {
    ...actual,
    getCachedJsonResponse: vi.fn()
  }
})

describe('getHistoricalConceptByKeyword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes slotted keyword objects to the historical full-path lookup', async () => {
    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > cryosphere >  > snow/ice >  >  > ',
      scheme: 'sciencekeywords'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
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
    }, {
      cachedJsonResponseReader
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

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: false
    })
  })

  test('pads array-based full-path keyword values into canonical historical lookup paths', async () => {
    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > atmosphere >  >  >  >  > ',
      scheme: 'sciencekeywords'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'science-uuid',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE >  >  >  >  > '
      })
    })

    await getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordValue: ['EARTH SCIENCE', 'ATMOSPHERE']
    }, {
      cachedJsonResponseReader
    })

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: false
    })
  })

  test('routes short-name keyword objects to the historical short-name lookup', async () => {
    const cacheKey = createConceptResponseCacheKeyByShortName({
      shortName: 'aqua',
      scheme: 'platforms'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'platform-uuid',
        fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > AQUA',
        longName: 'Aqua satellite'
      })
    })

    await expect(getHistoricalConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {
        ShortName: 'AQUA'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'platform-uuid',
      fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > AQUA',
      longName: 'Aqua satellite',
      keywordObject: {
        Category: 'Platforms',
        Class: 'Space-based Platforms',
        Type: 'Earth Observation Satellites',
        ShortName: 'AQUA',
        LongName: 'Aqua satellite'
      }
    })

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by shortName',
      bypassCache: false
    })
  })

  test('returns undefined for unsupported or blank lookup flows', async () => {
    const cachedJsonResponseReader = vi.fn()

    await expect(getHistoricalConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {}
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    await expect(getHistoricalConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {}
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    await expect(getHistoricalConceptByKeyword({
      scheme: 'unsupported-scheme',
      keywordValue: 'anything'
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    await expect(getHistoricalConceptByKeyword({
      scheme: 'granuledataformat',
      keywordValue: {
        ShortName: 'HDF4'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    expect(cachedJsonResponseReader).not.toHaveBeenCalled()
  })

  test('uses the default cached json response reader when no context is provided', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'platform-uuid',
        fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > AQUA',
        longName: 'Aqua satellite'
      })
    })

    await expect(getHistoricalConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {
        ShortName: 'AQUA'
      }
    })).resolves.toMatchObject({
      uuid: 'platform-uuid',
      keywordObject: expect.objectContaining({
        ShortName: 'AQUA'
      })
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: createConceptResponseCacheKeyByShortName({
        shortName: 'aqua',
        scheme: 'platforms'
      }),
      entityLabel: 'Historical Concept by shortName',
      bypassCache: false
    })
  })
})
