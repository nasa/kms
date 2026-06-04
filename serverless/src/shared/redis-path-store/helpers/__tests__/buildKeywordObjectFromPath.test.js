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
  })

  test('reconstructs platforms short-name paths into keyword objects', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Space-based Platforms > Earth Observation Satellites > Aqua'
    })).toEqual({
      Category: '',
      Class: 'Space-based Platforms',
      Type: 'Earth Observation Satellites',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
    })).toEqual({
      Category: 'Platforms',
      Class: 'Space-based Platforms',
      Type: 'Earth Observation Satellites',
      ShortName: 'Aqua'
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
      Category: '',
      Class: '',
      Type: '',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Platforms > Aqua'
    })).toEqual({
      Category: 'Platforms',
      Class: '',
      Type: '',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Sensors > Aqua'
    })).toEqual({
      Category: '',
      Class: 'Sensors',
      Type: '',
      ShortName: 'Aqua'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'instruments',
      keywordPath: 'Sensors > MODIS'
    })).toEqual({
      Category: 'Sensors',
      Class: '',
      Subclass: '',
      ShortName: 'MODIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'instruments',
      keywordPath: 'MODIS'
    })).toEqual({
      Category: '',
      Class: '',
      Subclass: '',
      ShortName: 'MODIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'projects',
      keywordPath: 'EOSDIS'
    })).toEqual({
      Category: '',
      ShortName: 'EOSDIS'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'providers',
      keywordPath: 'NASA > GHRC_DAAC'
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
      keywordPath: 'NASA > Earthdata'
    })).toEqual({
      ShortName: 'NASA > Earthdata'
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

  test('returns scalar Value objects for non-slotted schemes and empty objects for blank input', () => {
    expect(buildKeywordObjectFromPath({
      scheme: 'temporalresolutionrange',
      keywordPath: 'P1D'
    })).toEqual({
      Value: 'P1D'
    })

    expect(buildKeywordObjectFromPath({
      scheme: 'sciencekeywords',
      keywordPath: '   '
    })).toEqual({})

    expect(buildKeywordPathObjectFromPath({
      scheme: 'platforms',
      keywordPath: 'Aqua'
    })).toEqual({})
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
})
