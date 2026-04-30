import {
  describe,
  expect,
  test
} from 'vitest'

import { extractKeywordValue } from '../extractKeywordValue'

describe('extractKeywordValue', () => {
  test('should normalize chronounits from UMM-C field names to KMS field names', () => {
    expect(extractKeywordValue({
      scheme: 'chronounits',
      path: ['PaleoTemporalCoverages', 0, 'ChronostratigraphicUnits', 0],
      umm: {
        PaleoTemporalCoverages: [
          {
            ChronostratigraphicUnits: [
              {
                Eon: 'PHANEROZOIC',
                Era: 'CENOZOIC',
                Period: 'QUATERNARY',
                Epoch: 'HOLOCENE',
                Stage: 'MEGHALAYAN',
                DetailedClassification: 'LATE'
              }
            ]
          }
        ]
      }
    })).toEqual({
      Eon: 'PHANEROZOIC',
      Era: 'CENOZOIC',
      Period: 'QUATERNARY',
      Epoch: 'HOLOCENE',
      Age: 'MEGHALAYAN',
      SubAge: 'LATE'
    })
  })

  test('should normalize related URL content type fields into the expected lookup shape', () => {
    expect(extractKeywordValue({
      scheme: 'rucontenttype',
      path: ['RelatedUrls', 0],
      umm: {
        RelatedUrls: [
          {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: 'DIRECT DOWNLOAD'
          }
        ]
      }
    })).toEqual({
      URLContentType: 'DistributionURL',
      Type: 'GET DATA',
      Subtype: 'DIRECT DOWNLOAD'
    })
  })

  test('should normalize ISO topic category validation paths before reading UMM-C', () => {
    expect(extractKeywordValue({
      scheme: 'isotopiccategory',
      path: ['IsoTopicCategories', 0],
      umm: {
        ISOTopicCategories: ['BOUNDARIES']
      }
    })).toBe('BOUNDARIES')
  })

  test('should unwrap ProductLevelId from the nested ProcessingLevel object', () => {
    expect(extractKeywordValue({
      scheme: 'ProductLevelId',
      path: ['ProcessingLevel', 'Id'],
      umm: {
        ProcessingLevel: {
          Id: '2'
        }
      }
    })).toBe('2')
  })

  test('should unwrap format strings for DataFormat and GranuleDataFormat', () => {
    expect(extractKeywordValue({
      scheme: 'DataFormat',
      path: ['ArchiveAndDistributionInformation', 'FileArchiveInformation', 0],
      umm: {
        ArchiveAndDistributionInformation: {
          FileArchiveInformation: [
            {
              Format: 'Binary'
            }
          ]
        }
      }
    })).toBe('Binary')

    expect(extractKeywordValue({
      scheme: 'GranuleDataFormat',
      path: ['RelatedUrls', 0, 'GetData', 'Format'],
      umm: {
        RelatedUrls: [
          {
            GetData: {
              Format: 'xml'
            }
          }
        ]
      }
    })).toBe('xml')
  })

  test('should return the raw value for schemes without special normalization', () => {
    const scienceKeyword = {
      Category: 'EARTH SCIENCE',
      Topic: 'ATMOSPHERE'
    }

    expect(extractKeywordValue({
      scheme: 'sciencekeywords',
      path: ['ScienceKeywords', 0],
      umm: {
        ScienceKeywords: [scienceKeyword]
      }
    })).toEqual(scienceKeyword)
  })

  test('should fall back to an empty path when one is not provided', () => {
    expect(extractKeywordValue({
      scheme: 'DataFormat',
      umm: {
        Format: 'Binary'
      }
    })).toBe('Binary')
  })
})
