import { createConceptResponseCacheKeyByFullPath } from '../../redisCacheKeys'
import { getHistoricalConceptByFullPath } from '../getHistoricalConceptByFullPath'

describe('getHistoricalConceptByFullPath', () => {
  test('reads historical full-path concepts through the canonical cache key', async () => {
    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > atmosphere > aerosols',
      scheme: 'sciencekeywords'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-123',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    }, {
      cachedJsonResponseReader
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

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: false
    })
  })

  test('returns undefined when the cached body is missing', async () => {
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200
    })

    await expect(getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()
  })

  test('throws when the scheme is unsupported or required arguments are missing', async () => {
    await expect(getHistoricalConceptByFullPath({
      fullPath: 'Platforms > Aqua',
      scheme: 'platforms'
    })).rejects.toThrow('Historical fullPath lookup is not supported for scheme=platforms')

    await expect(getHistoricalConceptByFullPath({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing full path for historical concept lookup')

    await expect(getHistoricalConceptByFullPath({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })).rejects.toThrow('Missing scheme for historical concept lookup')
  })
})
