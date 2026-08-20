import {
  parseCsv,
  parseFullPathCsvRecords,
  parseKeywordCsvContent,
  parseShortNameCsvRecords,
  prepareCsvRows
} from '../keywordCsv'

describe('when preparing CSV rows by header name', () => {
  test('places a platform leaf hierarchy under reordered headers', () => {
    expect(prepareCsvRows({
      csvHeaders: ['Long_Name', 'UUID', 'Sub_Category', 'Short_Name', 'Category', 'Basis'],
      csvRows: [{
        path: [
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
      '',
      'GOSAT',
      'Earth Observation Satellites',
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
        keywordPath: ' >  >  > GOSAT',
        keywordObject: {
          Basis: '',
          Category: '',
          SubCategory: '',
          ShortName: 'GOSAT',
          LongName: 'Greenhouse Gases Observing Satellite'
        }
      },
      {
        uuid: '',
        shortName: 'AQUA',
        longName: '',
        providerUrl: '',
        keywordPath: ' >  >  > AQUA',
        keywordObject: {
          Basis: '',
          Category: '',
          SubCategory: '',
          ShortName: 'AQUA',
          LongName: ''
        }
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
        keywordPath: ' >  >  > "GOSAT "Test""',
        keywordObject: {
          Basis: '',
          Category: '',
          SubCategory: '',
          ShortName: '"GOSAT "Test""',
          LongName: ''
        }
      }
    ])
  })

  test('uses exact platform CSV columns regardless of header order', () => {
    expect(parseCsv([
      '"Keyword Version: test"',
      '"Short_Name","Sub_Category","UUID","Basis","Category"',
      '"A1","Auxiliary","uuid-a","Other","Aqua"'
    ].join('\n'), {
      scheme: 'platforms'
    })).toEqual([{
      uuid: 'uuid-a',
      shortName: 'A1',
      longName: '',
      providerUrl: '',
      keywordPath: 'Other > Aqua > Auxiliary > A1',
      keywordObject: {
        Basis: 'Other',
        Category: 'Aqua',
        SubCategory: 'Auxiliary',
        ShortName: 'A1',
        LongName: ''
      }
    }])
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
          LongName: '',
          DataCenterURL: 'https://ghrc.nsstc.nasa.gov'
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
      '"Long_Name","UUID","Sub_Category","Short_Name","Category","Basis"',
      '"Greenhouse Gases Observing Satellite","uuid-gosat","","GOSAT","Earth Observation Satellites","Space-based Platforms"'
    ].join('\n')

    expect(parseShortNameCsvRecords({
      csvContent,
      scheme: 'platforms'
    })).toEqual(new Map([
      ['GOSAT', {
        uuid: 'uuid-gosat',
        fullPath: 'Space-based Platforms > Earth Observation Satellites >  > GOSAT',
        longName: 'Greenhouse Gases Observing Satellite',
        providerUrl: '',
        keywordObject: {
          Basis: 'Space-based Platforms',
          Category: 'Earth Observation Satellites',
          SubCategory: '',
          ShortName: 'GOSAT',
          LongName: 'Greenhouse Gases Observing Satellite'
        }
      }]
    ]))
  })

  test('parses other short-name types with blank slots without shifting hierarchy', () => {
    expect(parseShortNameCsvRecords({
      csvContent: [
        '"Keyword Version: test"',
        '"Category","Class","Type","Subtype","Short_Name","Long_Name","UUID"',
        '"Earth Remote Sensing Instruments","","","","MODIS","Moderate Resolution Imaging Spectroradiometer","uuid-instrument-modis"'
      ].join('\n'),
      scheme: 'instruments'
    })).toEqual(new Map([
      ['MODIS', {
        uuid: 'uuid-instrument-modis',
        fullPath: 'Earth Remote Sensing Instruments >  >  >  > MODIS',
        longName: 'Moderate Resolution Imaging Spectroradiometer',
        providerUrl: '',
        keywordObject: {
          Category: 'Earth Remote Sensing Instruments',
          Class: '',
          Type: '',
          Subtype: '',
          ShortName: 'MODIS',
          LongName: 'Moderate Resolution Imaging Spectroradiometer'
        }
      }]
    ]))

    expect(parseShortNameCsvRecords({
      csvContent: [
        '"Keyword Version: test"',
        '"Bucket","Short_Name","Long_Name","UUID"',
        '"","EOSDIS","EOSDIS","uuid-project-eosdis"'
      ].join('\n'),
      scheme: 'projects'
    })).toEqual(new Map([
      ['EOSDIS', {
        uuid: 'uuid-project-eosdis',
        fullPath: ' > EOSDIS',
        longName: 'EOSDIS',
        providerUrl: '',
        keywordObject: {
          Bucket: '',
          ShortName: 'EOSDIS',
          LongName: 'EOSDIS'
        }
      }]
    ]))

    expect(parseShortNameCsvRecords({
      csvContent: [
        '"Keyword Version: test"',
        '"Bucket_Level_0","Bucket_Level_1","Bucket_Level_2","Bucket_Level_3","Short_Name","Long_Name","UUID"',
        '"NASA","","EOSDIS","GHRC","GHRC_DAAC","NASA GHRC_DAAC","uuid-provider-middle-blank"'
      ].join('\n'),
      scheme: 'providers'
    })).toEqual(new Map([
      ['GHRC_DAAC', {
        uuid: 'uuid-provider-middle-blank',
        fullPath: 'NASA >  > EOSDIS > GHRC > GHRC_DAAC',
        longName: 'NASA GHRC_DAAC',
        providerUrl: '',
        keywordObject: {
          BucketLevel0: 'NASA',
          BucketLevel1: '',
          BucketLevel2: 'EOSDIS',
          BucketLevel3: 'GHRC',
          ShortName: 'GHRC_DAAC',
          LongName: 'NASA GHRC_DAAC',
          DataCenterURL: ''
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
          LongName: '',
          DataCenterURL: 'https://ghrc.nsstc.nasa.gov'
        }
      }]
    ]))
  })

  test('builds one-slot short-name scheme records without hierarchy slots', () => {
    expect(parseShortNameCsvRecords({
      csvContent: [
        '"Keyword Version: test"',
        '"Short_Name","Long_Name","UUID"',
        '"NetCDF","Network Common Data Form","uuid-netcdf"'
      ].join('\n'),
      scheme: 'dataformat'
    })).toEqual(new Map([
      ['NetCDF', {
        uuid: 'uuid-netcdf',
        fullPath: 'NetCDF',
        longName: 'Network Common Data Form',
        providerUrl: '',
        keywordObject: {
          ShortName: 'NetCDF',
          LongName: 'Network Common Data Form'
        }
      }]
    ]))

    expect(parseShortNameCsvRecords({
      csvContent: [
        '"Keyword Version: test"',
        '"Short_Name","Long_Name","UUID"',
        '"HDF5","Hierarchical Data Format version 5","uuid-hdf5"'
      ].join('\n'),
      scheme: 'granuledataformat'
    })).toEqual(new Map([
      ['HDF5', {
        uuid: 'uuid-hdf5',
        fullPath: 'HDF5',
        longName: 'Hierarchical Data Format version 5',
        providerUrl: '',
        keywordObject: {
          ShortName: 'HDF5',
          LongName: 'Hierarchical Data Format version 5'
        }
      }]
    ]))

    expect(parseShortNameCsvRecords({
      csvContent: [
        '"Keyword Version: test"',
        '"Short_Name","Long_Name","UUID"',
        '"ACADIS","Australia Data and...","uuid-acadis"'
      ].join('\n'),
      scheme: 'idnnode'
    })).toEqual(new Map([
      ['ACADIS', {
        uuid: 'uuid-acadis',
        fullPath: 'ACADIS',
        longName: 'Australia Data and...',
        providerUrl: '',
        keywordObject: {
          ShortName: 'ACADIS',
          LongName: 'Australia Data and...'
        }
      }]
    ]))
  })
})
