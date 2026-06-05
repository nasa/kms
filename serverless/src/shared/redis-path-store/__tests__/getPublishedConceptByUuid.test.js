import { createPublishedConceptResponseCacheKeyByUuid } from '../../redisCacheKeys'
import { getPublishedConceptByUuid } from '../getPublishedConceptByUuid'

describe('getPublishedConceptByUuid', () => {
  test('reads published concepts by uuid through the canonical cache key', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'uuid-1',
        fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    }, {
      cachedJsonResponseReader
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

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by uuid'
    })
  })

  test('returns undefined when the cached concept body is missing or parses to null', async () => {
    const cachedJsonResponseReader = vi.fn()
      .mockResolvedValueOnce({ statusCode: 200 })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: 'null'
      })

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1',
      scheme: 'sciencekeywords'
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-null',
      scheme: 'sciencekeywords'
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()
  })

  test('throws when required arguments are missing', async () => {
    await expect(getPublishedConceptByUuid({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('Missing uuid for published concept lookup')

    await expect(getPublishedConceptByUuid({
      uuid: 'uuid-1'
    })).rejects.toThrow('Missing scheme for published concept lookup')
  })
})
