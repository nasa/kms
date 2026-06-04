import { createCmrCollectionQuery } from '../createCmrCollectionQuery'

describe('createCmrCollectionQuery', () => {
  test('creates a provider hierarchy query for leaf providers', () => {
    expect(createCmrCollectionQuery({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2|LEVEL_3|LEVEL_4',
      prefLabel: 'SHORT_NAME',
      isLeaf: true
    })).toEqual({
      cmrScheme: 'data_center',
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_1: 'LEVEL_2',
            level_2: 'LEVEL_3',
            short_name: 'SHORT_NAME',
            ignore_case: false
          }
        }
      }
    })
  })

  test('creates a provider hierarchy query for non-leaf providers without short names', () => {
    expect(createCmrCollectionQuery({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2',
      prefLabel: 'IGNORED',
      isLeaf: false
    })).toEqual({
      cmrScheme: 'data_center',
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_1: 'LEVEL_2',
            ignore_case: false
          }
        }
      }
    })
  })

  test('skips blank provider hierarchy segments and preserves single-segment leaf paths', () => {
    expect(createCmrCollectionQuery({
      scheme: 'providers',
      fullPath: 'LEVEL_1||',
      prefLabel: 'IGNORED',
      isLeaf: false
    })).toEqual({
      cmrScheme: 'data_center',
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            ignore_case: false
          }
        }
      }
    })

    expect(createCmrCollectionQuery({
      scheme: 'providers',
      fullPath: 'ONLY_LEVEL',
      prefLabel: 'ONLY_LEVEL',
      isLeaf: true
    })).toEqual({
      cmrScheme: 'data_center',
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          data_center: {
            level_0: 'ONLY_LEVEL',
            short_name: 'ONLY_LEVEL',
            ignore_case: false
          }
        }
      }
    })
  })

  test('treats missing provider full paths as empty hierarchy input', () => {
    expect(createCmrCollectionQuery({
      scheme: 'providers',
      fullPath: undefined,
      prefLabel: 'IGNORED',
      isLeaf: false
    })).toEqual({
      cmrScheme: 'data_center',
      method: 'POST',
      queryType: 'hierarchy',
      query: {
        condition: {
          data_center: {
            ignore_case: false
          }
        }
      }
    })
  })

  test('creates uuid-backed CMR collection queries for uuid-driven schemes', () => {
    expect(createCmrCollectionQuery({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })).toEqual({
      cmrScheme: 'science_keywords',
      method: 'POST',
      queryType: 'uuid',
      query: {
        condition: {
          science_keywords: {
            uuid: '1234-5678-9ABC-DEF0'
          }
        }
      }
    })

    expect(createCmrCollectionQuery({
      scheme: 'platforms',
      uuid: 'platform-uuid'
    })).toMatchObject({
      cmrScheme: 'platform',
      queryType: 'uuid',
      query: {
        condition: {
          platform: {
            uuid: 'platform-uuid'
          }
        }
      }
    })

    expect(createCmrCollectionQuery({
      scheme: 'instruments',
      uuid: 'instrument-uuid'
    })).toMatchObject({
      cmrScheme: 'instrument',
      queryType: 'uuid',
      query: {
        condition: {
          instrument: {
            uuid: 'instrument-uuid'
          }
        }
      }
    })

    expect(createCmrCollectionQuery({
      scheme: 'locations',
      uuid: 'location-uuid'
    })).toMatchObject({
      cmrScheme: 'location_keyword',
      queryType: 'uuid',
      query: {
        condition: {
          location_keyword: {
            uuid: 'location-uuid'
          }
        }
      }
    })
  })

  test('creates prefLabel-backed CMR collection queries for project-like schemes', () => {
    expect(createCmrCollectionQuery({
      scheme: 'projects',
      prefLabel: 'Legacy Climate Study'
    })).toEqual({
      cmrScheme: 'project',
      method: 'POST',
      queryType: 'prefLabel',
      query: {
        condition: {
          project: 'Legacy Climate Study'
        }
      }
    })

    expect(createCmrCollectionQuery({
      scheme: 'productlevelid',
      prefLabel: '1A'
    })).toEqual({
      cmrScheme: 'processing_level_id',
      method: 'POST',
      queryType: 'prefLabel',
      query: {
        condition: {
          processing_level_id: '1A'
        }
      }
    })
  })

  test('falls back to query-string collection queries for scalar schemes', () => {
    expect(createCmrCollectionQuery({
      scheme: 'dataformat',
      prefLabel: 'HDF5'
    })).toEqual({
      cmrScheme: 'granule_data_format',
      method: 'GET',
      queryType: 'queryString',
      query: 'granule_data_format=HDF5'
    })

    expect(createCmrCollectionQuery({
      scheme: 'granuledataformat',
      prefLabel: 'netCDF-4'
    })).toEqual({
      cmrScheme: 'granule_data_format',
      method: 'GET',
      queryType: 'queryString',
      query: 'granule_data_format=netCDF-4'
    })

    expect(createCmrCollectionQuery({
      scheme: '',
      prefLabel: 'fallback'
    })).toEqual({
      cmrScheme: '',
      method: 'GET',
      queryType: 'queryString',
      query: '=fallback'
    })
  })
})
