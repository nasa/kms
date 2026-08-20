import {
  buildKeywordObjectFromPath,
  buildKeywordPathObjectFromPath
} from '../buildKeywordObjectFromPath'

describe('buildKeywordObjectFromPath', () => {
  test('buildKeywordPathObjectFromPath preserves empty slots from canonical paths', () => {
    expect(buildKeywordPathObjectFromPath({
      scheme: 'sciencekeywords',
      keywordPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'CRYOSPHERE',
      Term: '',
      VariableLevel1: 'SNOW/ICE',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })

    expect(buildKeywordPathObjectFromPath({
      scheme: 'sciencekeywords',
      keywordPath: 'EARTH SCIENCE > ATMOSPHERE'
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'ATMOSPHERE',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })

    expect(buildKeywordPathObjectFromPath({
      scheme: 'unsupported',
      keywordPath: 'VALUE'
    })).toEqual({})
  })

  test('reconstructs platforms short-name paths into keyword objects', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Other >  >  > Auxiliary Data'
    })).toEqual({
      Basis: 'Other',
      Category: '',
      SubCategory: '',
      ShortName: 'Auxiliary Data'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Space-based Platforms > Earth Observation Satellites > Aqua'
    })).toEqual({
      Basis: '',
      Category: 'Space-based Platforms',
      SubCategory: 'Earth Observation Satellites',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
    })).toEqual({
      Basis: 'Platforms',
      Category: 'Space-based Platforms',
      SubCategory: 'Earth Observation Satellites',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: ' > Space-based Platforms > Earth Observation Satellites > Amazonia-1'
    })).toEqual({
      Basis: '',
      Category: 'Space-based Platforms',
      SubCategory: 'Earth Observation Satellites',
      ShortName: 'Amazonia-1'
    })
  })

  test('reconstructs short-name paths with intentional blank slots from CSV-formatted inputs', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'instruments',
      keywordPath: 'Earth Remote Sensing Instruments >  >  >  > MODIS'
    })).toEqual({
      Category: 'Earth Remote Sensing Instruments',
      Class: '',
      Type: '',
      Subtype: '',
      ShortName: 'MODIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'projects',
      keywordPath: ' > EOSDIS'
    })).toEqual({
      Bucket: '',
      ShortName: 'EOSDIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'providers',
      keywordPath: 'NASA >  > EOSDIS > GHRC > GHRC_DAAC'
    })).toEqual({
      BucketLevel0: 'NASA',
      BucketLevel1: '',
      BucketLevel2: 'EOSDIS',
      BucketLevel3: 'GHRC',
      ShortName: 'GHRC_DAAC'
    })
  })

  test('reconstructs provider paths into bucketed short-name keyword objects', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'providers',
      keywordPath: 'NASA > GSFC > EOSDIS > GHRC > GHRC_DAAC'
    })).toEqual({
      BucketLevel0: 'NASA',
      BucketLevel1: 'GSFC',
      BucketLevel2: 'EOSDIS',
      BucketLevel3: 'GHRC',
      ShortName: 'GHRC_DAAC'
    })
  })

  test('pads missing hierarchy slots for short-name schemes', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Aqua'
    })).toEqual({
      Basis: '',
      Category: '',
      SubCategory: '',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Platforms > Aqua'
    })).toEqual({
      Basis: '',
      Category: '',
      SubCategory: 'Platforms',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Air-based Platforms > A340-600'
    })).toEqual({
      Basis: '',
      Category: '',
      SubCategory: 'Air-based Platforms',
      ShortName: 'A340-600'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'instruments',
      keywordPath: 'MODIS'
    })).toEqual({
      Category: '',
      Class: '',
      Type: '',
      Subtype: '',
      ShortName: 'MODIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'projects',
      keywordPath: 'EOSDIS'
    })).toEqual({
      Bucket: '',
      ShortName: 'EOSDIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'providers',
      keywordPath: 'NASA >  >  >  > GHRC_DAAC'
    })).toEqual({
      BucketLevel0: 'NASA',
      BucketLevel1: '',
      BucketLevel2: '',
      BucketLevel3: '',
      ShortName: 'GHRC_DAAC'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'providers',
      keywordPath: ' > '
    })).toEqual({
      BucketLevel0: '',
      BucketLevel1: '',
      BucketLevel2: '',
      BucketLevel3: '',
      ShortName: ''
    })
  })

  test('reconstructs idnnode paths into joined short-name values', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'idnnode',
      keywordPath: 'AMD/AU'
    })).toEqual({
      ShortName: 'AMD/AU'
    })
  })

  test('strips leading science keyword labels before rebuilding slotted objects', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'sciencekeywords',
      keywordPath: 'Science Keywords > EARTH SCIENCE > OCEANS >  >  >  >  > '
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'OCEANS',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'sciencekeywords',
      keywordPath: 'EARTH SCIENCE > OCEANS >  >  >  >  > '
    })).toEqual({
      Category: 'EARTH SCIENCE',
      Topic: 'OCEANS',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })
  })

  test('returns CSV-shaped scalar objects and empty objects for blank input', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'temporalresolutionrange',
      keywordPath: '< 1 second'
    })).toEqual({
      TemporalResolutionRange: '< 1 second'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'sciencekeywords',
      keywordPath: '   '
    })).toEqual({})

    expect(buildKeywordPathObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Aqua'
    })).toEqual({
      Basis: '',
      Category: '',
      SubCategory: '',
      ShortName: 'Aqua'
    })
  })

  test('returns empty short-name values when single-field paths contain only blanks', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'dataformat',
      keywordPath: ' >  '
    })).toEqual({
      ShortName: ''
    })
  })

  test('falls back to the last non-empty segment when a short-name scheme has no explicit mapping', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'unknownshortname',
      keywordPath: 'NASA > AQUA'
    })).toEqual({
      Value: 'NASA > AQUA'
    })
  })

  test('supports all known full-path lookup schemes', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'locations',
      keywordPath: 'CONTINENT > AFRICA > CENTRAL AFRICA > CAMEROON'
    })).toEqual({
      LocationCategory: 'CONTINENT',
      LocationType: 'AFRICA',
      LocationSubregion1: 'CENTRAL AFRICA',
      LocationSubregion2: 'CAMEROON',
      LocationSubregion3: '',
      LocationSubregion4: ''
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'chronounits',
      keywordPath: 'ARCHAEAN > MESOARCHEAN'
    })).toEqual({
      Eon: 'ARCHAEAN',
      Era: 'MESOARCHEAN',
      Period: '',
      Epoch: '',
      Age: '',
      SubAge: ''
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'rucontenttype',
      keywordPath: 'DistributionURL > USE SERVICE API > THREDDS DATA'
    })).toEqual({
      URLContentType: 'DistributionURL',
      Type: 'USE SERVICE API',
      Subtype: 'THREDDS DATA'
    })
  })

  test('supports remaining short-name schemes, including single-value and joined-value variants', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'dataformat',
      keywordPath: 'NetCDF'
    })).toEqual({
      ShortName: 'NetCDF'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'granuledataformat',
      keywordPath: 'HDF5'
    })).toEqual({
      ShortName: 'HDF5'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'idnnode',
      keywordPath: 'ACADIS'
    })).toEqual({
      ShortName: 'ACADIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'idnnode',
      keywordPath: '  ACADIS  '
    })).toEqual({
      ShortName: 'ACADIS'
    })
  })

  test('returns exact CSV fields for single-column schemes', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'isotopiccategory',
      keywordPath: 'OCEANS'
    })).toEqual({
      ISOTopicCategory: 'OCEANS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'verticalresolutionrange',
      keywordPath: '1 meter - < 10 meters'
    })).toEqual({
      VerticalResolutionRange: '1 meter - < 10 meters'
    })
  })
})
