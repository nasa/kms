import { parseCachedConceptResponse } from '../parseCachedConceptResponse'

describe('parseCachedConceptResponse', () => {
  test('merges canonical keyword objects with cached supplemental fields', () => {
    expect(parseCachedConceptResponse({
      cachedResponse: {
        body: JSON.stringify({
          uuid: 'uuid-1',
          fullPath: 'NASA > GSFC > EOSDIS > GHRC > GHRC_DAAC',
          longName: 'Global Hydrology Resource Center',
          providerUrl: 'https://ghrc.nsstc.nasa.gov',
          keywordObject: {
            ShortName: 'GHRC_DAAC'
          }
        })
      },
      scheme: 'providers'
    })).toEqual({
      uuid: 'uuid-1',
      fullPath: 'NASA > GSFC > EOSDIS > GHRC > GHRC_DAAC',
      longName: 'Global Hydrology Resource Center',
      providerUrl: 'https://ghrc.nsstc.nasa.gov',
      keywordObject: {
        BucketLevel0: 'NASA',
        BucketLevel1: 'GSFC',
        BucketLevel2: 'EOSDIS',
        BucketLevel3: 'GHRC',
        ShortName: 'GHRC_DAAC',
        LongName: 'Global Hydrology Resource Center',
        DataCenterUrl: 'https://ghrc.nsstc.nasa.gov'
      }
    })
  })

  test('returns undefined for missing cached bodies and preserves parsed null payloads', () => {
    expect(parseCachedConceptResponse({
      cachedResponse: undefined,
      scheme: 'sciencekeywords'
    })).toBeUndefined()

    expect(parseCachedConceptResponse({
      cachedResponse: {
        body: 'null'
      },
      scheme: 'sciencekeywords'
    })).toBeUndefined()
  })

  test('rebuilds keyword objects from cached full paths when no keywordObject is stored', () => {
    expect(parseCachedConceptResponse({
      cachedResponse: {
        body: JSON.stringify({
          uuid: 'uuid-2',
          fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        })
      },
      scheme: 'sciencekeywords'
    })).toEqual({
      uuid: 'uuid-2',
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
  })

  test('falls back to an empty keyword object when the cached payload stores a non-object keywordObject', () => {
    expect(parseCachedConceptResponse({
      cachedResponse: {
        body: JSON.stringify({
          uuid: 'uuid-3',
          keywordObject: 'invalid'
        })
      },
      scheme: 'sciencekeywords'
    })).toEqual({
      uuid: 'uuid-3',
      keywordObject: {}
    })
  })
})
