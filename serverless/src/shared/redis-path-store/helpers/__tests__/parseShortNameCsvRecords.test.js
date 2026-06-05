import { parseShortNameCsvRecords } from '../parseShortNameCsvRecords'

describe('parseShortNameCsvRecords', () => {
  test('parses short-name rows with long-name metadata', () => {
    const csvContent = [
      'Category,Class,Type,ShortName,LongName,UUID',
      'Header,Header,Header,Header,Header,Header',
      'Space-based Platforms,Earth Observation Satellites,,Aqua,Aqua Satellite,uuid-1'
    ].join('\n')

    expect(parseShortNameCsvRecords({
      csvContent,
      scheme: 'platforms'
    })).toEqual(new Map([
      ['Aqua', {
        uuid: 'uuid-1',
        fullPath: 'Space-based Platforms > Earth Observation Satellites >  > Aqua',
        longName: 'Aqua Satellite',
        providerUrl: '',
        keywordObject: {
          Category: '',
          Class: 'Space-based Platforms',
          Type: 'Earth Observation Satellites',
          ShortName: 'Aqua',
          LongName: 'Aqua Satellite'
        }
      }]
    ]))
  })

  test('parses provider rows with provider urls and skips rows without short names', () => {
    const csvContent = [
      'BucketLevel0,BucketLevel1,BucketLevel2,BucketLevel3,ShortName,DataCenterUrl,UUID',
      'Header,Header,Header,Header,Header,Header,Header',
      'NASA,GSFC,EOSDIS,GHRC,GHRC_DAAC,https://ghrc.nsstc.nasa.gov,uuid-2',
      'NASA,GSFC,EOSDIS,GHRC,,https://ghrc.nsstc.nasa.gov,uuid-3'
    ].join('\n')

    expect(parseShortNameCsvRecords({
      csvContent,
      scheme: 'providers'
    })).toEqual(new Map([
      ['GHRC', {
        uuid: 'uuid-3',
        fullPath: 'NASA > GSFC > EOSDIS > GHRC',
        longName: '',
        providerUrl: 'https://ghrc.nsstc.nasa.gov',
        keywordObject: {
          BucketLevel0: 'NASA',
          BucketLevel1: 'GSFC',
          BucketLevel2: 'EOSDIS',
          BucketLevel3: '',
          ShortName: 'GHRC',
          DataCenterUrl: 'https://ghrc.nsstc.nasa.gov'
        }
      }]
    ]))
  })
})
