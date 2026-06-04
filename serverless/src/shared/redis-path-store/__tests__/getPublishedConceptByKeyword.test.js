import {
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName
} from '../../redisCacheKeys'
import { getPublishedConceptByKeyword } from '../getPublishedConceptByKeyword'

describe('getPublishedConceptByKeyword', () => {
  test('reads published full-path concepts using canonical paths built from keyword objects', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByFullPath({
      fullPath: 'collectionurl > project home page > ',
      scheme: 'rucontenttype'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
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
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'ru-uuid',
      fullPath: 'CollectionURL > PROJECT HOME PAGE > ',
      keywordObject: {
        URLContentType: 'CollectionURL',
        Type: 'PROJECT HOME PAGE',
        Subtype: ''
      }
    })

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('reads published short-name concepts using the normalized short name', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'modis',
      scheme: 'instruments'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'instrument-uuid',
        fullPath: 'EARTH REMOTE SENSING INSTRUMENTS > ACTIVE REMOTE SENSING > ALTIMETERS > MODIS',
        longName: 'Moderate Resolution Imaging Spectroradiometer'
      })
    })

    await expect(getPublishedConceptByKeyword({
      scheme: 'instruments',
      keywordObject: {
        ShortName: 'MODIS'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'instrument-uuid',
      fullPath: 'EARTH REMOTE SENSING INSTRUMENTS > ACTIVE REMOTE SENSING > ALTIMETERS > MODIS',
      longName: 'Moderate Resolution Imaging Spectroradiometer',
      keywordObject: {
        Category: 'EARTH REMOTE SENSING INSTRUMENTS',
        Class: 'ACTIVE REMOTE SENSING',
        Subclass: 'ALTIMETERS',
        ShortName: 'MODIS',
        LongName: 'Moderate Resolution Imaging Spectroradiometer'
      }
    })

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('merges cached keywordObject payloads with canonical path fields on read', async () => {
    const cacheKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'nz/nzai/anz',
      scheme: 'providers'
    })
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'provider-uuid',
        fullPath: 'ARCHIVER >  >  >  > NZ/NZAI/ANZ',
        providerUrl: 'https://example.com/provider',
        keywordObject: {
          LongName: 'National Archive'
        }
      })
    })

    await expect(getPublishedConceptByKeyword({
      scheme: 'providers',
      keywordObject: {
        ShortName: 'NZ/NZAI/ANZ'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'provider-uuid',
      keywordObject: {
        BucketLevel0: 'ARCHIVER',
        BucketLevel1: '',
        BucketLevel2: '',
        BucketLevel3: '',
        ShortName: 'NZ/NZAI/ANZ',
        LongName: 'National Archive',
        DataCenterUrl: 'https://example.com/provider'
      }
    })

    expect(cachedJsonResponseReader).toHaveBeenCalledWith({
      cacheKey,
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('strips a leading science-keywords label when reconstructing keyword objects from cached paths', async () => {
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'science-uuid',
        fullPath: 'Science Keywords > EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
      })
    })

    await expect(getPublishedConceptByKeyword({
      scheme: 'sciencekeywords',
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'science-uuid',
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
  })

  test('reconstructs project keyword objects from cached short-name paths', async () => {
    const cachedJsonResponseReader = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        uuid: 'project-uuid',
        fullPath: 'A - C > ALIENS'
      })
    })

    await expect(getPublishedConceptByKeyword({
      scheme: 'projects',
      keywordObject: {
        ShortName: 'ALIENS'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toMatchObject({
      uuid: 'project-uuid',
      keywordObject: {
        Category: 'A - C',
        ShortName: 'ALIENS'
      }
    })
  })

  test('returns undefined when the normalized keyword object does not contain a usable lookup value', async () => {
    const cachedJsonResponseReader = vi.fn()

    await expect(getPublishedConceptByKeyword({
      scheme: 'rucontenttype',
      keywordObject: {
        URLContentType: '',
        Type: '',
        Subtype: ''
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    await expect(getPublishedConceptByKeyword({
      scheme: 'platforms',
      keywordObject: {}
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    await expect(getPublishedConceptByKeyword({
      scheme: 'unknownscheme',
      keywordObject: {
        Value: 'P1D'
      }
    }, {
      cachedJsonResponseReader
    })).resolves.toBeUndefined()

    expect(cachedJsonResponseReader).not.toHaveBeenCalled()
  })
})
