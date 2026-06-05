import { createConceptResponseCacheKeyByShortName } from '../../redisCacheKeys'
import { getHistoricalConceptByShortName } from '../getHistoricalConceptByShortName'

describe('getHistoricalConceptByShortName', () => {
  test('reads historical short-name concepts through the canonical cache key', async () => {
    const cacheKey = createConceptResponseCacheKeyByShortName({
      shortName: 'modis',
      scheme: 'instruments'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > MODIS'
      })
    })

    await expect(getHistoricalConceptByShortName({
      shortName: 'MODIS',
      scheme: 'instruments'
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > MODIS',
      keywordObject: {
        Category: 'AIR-BASED PLATFORMS',
        Class: 'PROPELLER',
        Subclass: '',
        ShortName: 'MODIS'
      }
    })

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by shortName',
      bypassCache: false
    })
  })

  test('preserves long-name payloads on direct short-name lookups', async () => {
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > AC-690A',
        longName: 'Aerocommander aircraft'
      })
    })

    await expect(getHistoricalConceptByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'uuid-123',
      fullPath: 'AIR-BASED PLATFORMS > PROPELLER >  > AC-690A',
      longName: 'Aerocommander aircraft',
      keywordObject: {
        Category: 'AIR-BASED PLATFORMS',
        Class: 'PROPELLER',
        Subclass: '',
        ShortName: 'AC-690A',
        LongName: 'Aerocommander aircraft'
      }
    })
  })

  test('returns undefined when the cached body is missing', async () => {
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200
    })

    await expect(getHistoricalConceptByShortName({
      shortName: 'AC-690A',
      scheme: 'instruments'
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()
  })

  test('throws when the scheme is unsupported or required arguments are missing', async () => {
    await expect(getHistoricalConceptByShortName({
      shortName: 'AQUA',
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Historical shortName lookup is not supported for scheme=sciencekeywords')

    await expect(getHistoricalConceptByShortName({
      scheme: 'instruments'
    })).rejects.toThrow('Missing short name for historical concept lookup')

    await expect(getHistoricalConceptByShortName({
      shortName: 'AC-690A'
    })).rejects.toThrow('Missing scheme for historical concept lookup')
  })
})
