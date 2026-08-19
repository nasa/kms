import {
  parseCsv,
  parseFullPathCsvRecords,
  parseKeywordCsvContent,
  parseShortNameCsvRecords,
  prepareCsvRows
} from '../keywordCsv'

describe('when preparing CSV rows by header name', () => {
  test('places GOSAT platform values under reordered headers', () => {
    expect(prepareCsvRows({
      csvHeaders: ['Long_Name', 'UUID', 'Type', 'Short_Name', 'Category', 'Class'],
      csvRows: [{
        path: [
          'Platforms',
          'Space-based Platforms',
          'Earth Observation Satellites',
          'GOSAT'
        ],
        isLeaf: true,
        uuid: 'uuid-gosat',
        longName: 'Greenhouse Gases Observing Satellite',
        dataCenterUrl: ''
      }],
      scheme: 'platforms'
    })).toEqual([[
      'Greenhouse Gases Observing Satellite',
      'uuid-gosat',
      'Earth Observation Satellites',
      'GOSAT',
      'Platforms',
      'Space-based Platforms'
    ]])
  })
})

describe('when parsing CSV rows by header name', () => {
  test('returns normalized fields when optional column values are missing', () => {
    expect(parseCsv([
      '"Keyword Version: test"',
      '"Short_Name","Long_Name","UUID"',
      '',
      '"GOSAT","Greenhouse Gases Observing Satellite","uuid-gosat"',
      '"AQUA"'
    ].join('\n'), {
      scheme: 'platforms'
    })).toEqual([
      {
        uuid: 'uuid-gosat',
        shortName: 'GOSAT',
        longName: 'Greenhouse Gases Observing Satellite',
        providerUrl: '',
        keywordPath: ' >  >  > GOSAT'
      },
      {
        uuid: '',
        shortName: 'AQUA',
        longName: '',
        providerUrl: '',
        keywordPath: ' >  >  > AQUA'
      }
    ])
  })

  test('accepts relaxed quotes in keyword values', () => {
    expect(parseCsv([
      '"Keyword Version: test"',
      '"Short_Name"',
      '"GOSAT "Test""'
    ].join('\n'), {
      scheme: 'platforms'
    })).toEqual([
      {
        uuid: '',
        shortName: '"GOSAT "Test""',
        longName: '',
        providerUrl: '',
        keywordPath: ' >  >  > "GOSAT "Test""'
      }
    ])
  })
})

describe('when parsing keyword CSV content for publication', () => {
  test('uses generated fields for a scheme without configured path fields', () => {
    const csvContent = [
      '"Keyword Version: test"',
      '"ProductFlag","UUID"',
      '"SCIENCE_QUALITY","uuid-science-quality"'
    ].join('\n')

    expect(parseKeywordCsvContent(csvContent, {
      scheme: 'productflag'
    })).toEqual(new Map([
      ['uuid-science-quality', {
        path: 'SCIENCE_QUALITY',
        keywordObject: {
          Value: 'SCIENCE_QUALITY'
        }
      }]
    ]))
  })

  test('includes the GHRC_DAAC provider URL in its keyword object', () => {
    const csvContent = [
      '"Keyword Version: test"',
      '"Data_Center_URL","Short_Name","Bucket_Level_3","UUID","Bucket_Level_0","Bucket_Level_2","Bucket_Level_1"',
      '"https://ghrc.nsstc.nasa.gov","GHRC_DAAC","GHRC","uuid-ghrc","NASA","EOSDIS","GSFC"'
    ].join('\n')

    expect(parseKeywordCsvContent(csvContent, {
      scheme: 'providers'
    })).toEqual(new Map([
      ['uuid-ghrc', {
        path: 'NASA > GSFC > EOSDIS > GHRC > GHRC_DAAC',
        keywordObject: {
          BucketLevel0: 'NASA',
          BucketLevel1: 'GSFC',
          BucketLevel2: 'EOSDIS',
          BucketLevel3: 'GHRC',
          ShortName: 'GHRC_DAAC',
          DataCenterUrl: 'https://ghrc.nsstc.nasa.gov'
        }
      }]
    ]))
  })
})

describe('when parsing full-path keyword CSV content', () => {
  test('builds canonical science keyword paths when columns are reordered', () => {
    const csvContent = [
      '"Science_Keywords_v99.0.0"',
      '"UUID","Term","Category","Variable_Level_3","Topic","Detailed_Variable","Variable_Level_1","Variable_Level_2"',
      '"uuid-aerosols","AEROSOLS","EARTH SCIENCE","","ATMOSPHERE","","",""',
      '"uuid-cryosphere","","EARTH SCIENCE","","CRYOSPHERE","","",""'
    ].join('\n')

    expect(parseFullPathCsvRecords({
      csvContent,
      scheme: 'sciencekeywords'
    })).toEqual(new Map([
      ['EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ', 'uuid-aerosols'],
      ['EARTH SCIENCE > CRYOSPHERE >  >  >  >  > ', 'uuid-cryosphere']
    ]))
  })

  test('skips science keyword rows without a UUID', () => {
    const csvContent = [
      '"Science_Keywords_v99.0.0"',
      '"Category","Topic","Term","UUID"',
      '"EARTH SCIENCE"'
    ].join('\n')

    expect(parseFullPathCsvRecords({
      csvContent,
      scheme: 'sciencekeywords'
    })).toEqual(new Map())
  })

  test('builds an ISO topic category path from its named column', () => {
    const csvContent = [
      '"Keyword Version: test"',
      '"UUID","ISO_Topic_Category"',
      '"uuid-oceans","oceans"'
    ].join('\n')

    expect(parseFullPathCsvRecords({
      csvContent,
      scheme: 'isotopiccategory'
    })).toEqual(new Map([
      ['oceans', 'uuid-oceans']
    ]))
  })
})

describe('when parsing short-name keyword CSV content', () => {
  test('returns no records for empty content', () => {
    expect(parseShortNameCsvRecords({
      csvContent: '',
      scheme: 'platforms'
    })).toEqual(new Map())
  })

  test('builds a GOSAT platform record with its long name', () => {
    const csvContent = [
      '"Keyword Version: test"',
      '"Long_Name","UUID","Type","Short_Name","Category","Class"',
      '"Greenhouse Gases Observing Satellite","uuid-gosat","Earth Observation Satellites","GOSAT","Platforms","Space-based Platforms"'
    ].join('\n')

    expect(parseShortNameCsvRecords({
      csvContent,
      scheme: 'platforms'
    })).toEqual(new Map([
      ['GOSAT', {
        uuid: 'uuid-gosat',
        fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT',
        longName: 'Greenhouse Gases Observing Satellite',
        providerUrl: '',
        keywordObject: {
          Category: 'Platforms',
          Class: 'Space-based Platforms',
          Type: 'Earth Observation Satellites',
          ShortName: 'GOSAT',
          LongName: 'Greenhouse Gases Observing Satellite'
        }
      }]
    ]))
  })

  test('builds a GHRC_DAAC provider record and skips the row without a short name', () => {
    const csvContent = [
      '"Keyword Version: test"',
      '"Data_Center_URL","Short_Name","Bucket_Level_3","UUID","Bucket_Level_0","Bucket_Level_2","Bucket_Level_1"',
      '"https://ghrc.nsstc.nasa.gov","GHRC_DAAC","GHRC","uuid-ghrc","NASA","EOSDIS","GSFC"',
      '"https://ghrc.nsstc.nasa.gov","","GHRC","uuid-missing-short-name","NASA","EOSDIS","GSFC"'
    ].join('\n')

    expect(parseShortNameCsvRecords({
      csvContent,
      scheme: 'providers'
    })).toEqual(new Map([
      ['GHRC_DAAC', {
        uuid: 'uuid-ghrc',
        fullPath: 'NASA > GSFC > EOSDIS > GHRC > GHRC_DAAC',
        longName: '',
        providerUrl: 'https://ghrc.nsstc.nasa.gov',
        keywordObject: {
          BucketLevel0: 'NASA',
          BucketLevel1: 'GSFC',
          BucketLevel2: 'EOSDIS',
          BucketLevel3: 'GHRC',
          ShortName: 'GHRC_DAAC',
          DataCenterUrl: 'https://ghrc.nsstc.nasa.gov'
        }
      }]
    ]))
  })
})
