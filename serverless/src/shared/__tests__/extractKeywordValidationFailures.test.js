import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { extractKeywordValidationFailures } from '../extractKeywordValidationFailures'
import { logger } from '../logger'

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn()
  }
}))

describe('extractKeywordValidationFailures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should extract supported keyword validation failures from UMM-C', () => {
    const umm = {
      ScienceKeywords: [
        {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS',
          VariableLevel1: 'AEROSOL ABSORPTION'
        }
      ],
      Platforms: [
        {
          ShortName: 'HU-25A',
          LongName: 'Dassault HU-25A Guardian',
          Type: 'Jet',
          Instruments: [
            {
              ShortName: 'AMS',
              LongName: 'AEROSOL MASS SPECTROMETER'
            }
          ]
        }
      ],
      LocationKeywords: [
        {
          Category: 'CONTINENT',
          Type: 'NORTH AMERICA'
        }
      ],
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
      ],
      Projects: [
        {
          ShortName: 'ACTIVATE',
          LongName: 'Aerosol Cloud meTeorology Interactions oVer the western ATlantic Experiment'
        }
      ],
      DataCenters: [
        {
          ShortName: 'NASA/LARC/SD/ASDC'
        }
      ],
      DirectoryNames: [
        {
          ShortName: 'GCMD',
          LongName: 'Global Change Master Directory'
        }
      ],
      ISOTopicCategories: [
        'BOUNDARIES'
      ],
      TemporalExtents: [
        {
          TemporalResolution: 'P1D'
        }
      ],
      SpatialInformation: {
        ResolutionAndCoordinateSystem: {
          HorizontalDataResolution: {
            Value: '250',
            Unit: 'm'
          }
        }
      },
      SpatialExtent: {
        VerticalSpatialDomains: [
          {
            Type: 'ALTITUDE',
            Value: '1000',
            Unit: 'm'
          }
        ]
      },
      ProcessingLevel: {
        Id: '2'
      },
      ArchiveAndDistributionInformation: {
        FileArchiveInformation: [
          {
            Format: 'Binary'
          }
        ],
        FileDistributionInformation: [
          {
            Format: 'netCDF-4'
          }
        ]
      },
      RelatedUrls: [
        {
          URLContentType: 'DistributionURL',
          Type: 'GET DATA',
          Subtype: 'DIRECT DOWNLOAD',
          GetData: {
            Format: 'xml'
          }
        }
      ]
    }
    const validationErrors = [
      {
        path: ['ScienceKeywords', 0],
        errors: ['Science keyword was not a valid keyword combination.']
      },
      {
        path: ['Platforms', 0],
        errors: ['Platform short name was not a valid keyword combination.']
      },
      {
        path: ['Platforms', 0, 'Instruments', 0],
        errors: ['Instrument short name was not a valid keyword combination.']
      },
      {
        path: ['LocationKeywords', 0],
        errors: ['Location keyword was not a valid keyword combination.']
      },
      {
        path: ['PaleoTemporalCoverages', 0, 'ChronostratigraphicUnits', 0],
        errors: ['Chronostratigraphic unit was not a valid keyword combination.']
      },
      {
        path: ['Projects', 0],
        errors: ['Project short name was not a valid keyword combination.']
      },
      {
        path: ['DataCenters', 0],
        errors: ['Data center short name was not a valid keyword.']
      },
      {
        path: ['DirectoryNames', 0],
        errors: ['Directory name short name was not a valid keyword.']
      },
      {
        path: ['IsoTopicCategories', 0],
        errors: ['ISO Topic Category [BOUNDARIES] was not a valid keyword.']
      },
      {
        path: ['TemporalExtents', 0, 'TemporalResolution'],
        errors: ['Temporal resolution [P1D] was not a valid keyword.']
      },
      {
        path: ['SpatialInformation', 'ResolutionAndCoordinateSystem', 'HorizontalDataResolution'],
        errors: ['Horizontal resolution was not a valid keyword range.']
      },
      {
        path: ['SpatialExtent', 'VerticalSpatialDomains', 0],
        errors: ['Vertical resolution was not a valid keyword range.']
      },
      {
        path: ['ProcessingLevel', 'Id'],
        errors: ['ProcessingLevel Id [2] was not a valid keyword.']
      },
      {
        path: ['ArchiveAndDistributionInformation', 'FileArchiveInformation', 0],
        errors: ['Format [Binary] was not a valid keyword.']
      },
      {
        path: ['ArchiveAndDistributionInformation', 'FileDistributionInformation', 0],
        errors: ['Format [netCDF-4] was not a valid keyword.']
      },
      {
        path: ['RelatedUrls', 0, 'GetData', 'Format'],
        errors: ['Format [xml] was not a valid keyword.']
      },
      {
        path: ['RelatedUrls', 0],
        errors: ['Related URL Content Type was not a valid set together.']
      }
    ]

    const result = extractKeywordValidationFailures({
      umm,
      validationErrors
    })

    expect(result).toEqual([
      {
        scheme: 'sciencekeywords',
        path: ['ScienceKeywords', 0],
        errors: ['Science keyword was not a valid keyword combination.'],
        oldKeyword: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS|AEROSOL ABSORPTION',
        keywordValue: {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS',
          VariableLevel1: 'AEROSOL ABSORPTION'
        }
      },
      {
        scheme: 'platforms',
        path: ['Platforms', 0],
        errors: ['Platform short name was not a valid keyword combination.'],
        oldKeyword: 'HU-25A',
        keywordValue: {
          ShortName: 'HU-25A',
          LongName: 'Dassault HU-25A Guardian',
          Type: 'Jet',
          Instruments: [
            {
              ShortName: 'AMS',
              LongName: 'AEROSOL MASS SPECTROMETER'
            }
          ]
        }
      },
      {
        scheme: 'instruments',
        path: ['Platforms', 0, 'Instruments', 0],
        errors: ['Instrument short name was not a valid keyword combination.'],
        oldKeyword: 'AMS',
        keywordValue: {
          ShortName: 'AMS',
          LongName: 'AEROSOL MASS SPECTROMETER'
        }
      },
      {
        scheme: 'locations',
        path: ['LocationKeywords', 0],
        errors: ['Location keyword was not a valid keyword combination.'],
        oldKeyword: 'CONTINENT|NORTH AMERICA',
        keywordValue: {
          Category: 'CONTINENT',
          Type: 'NORTH AMERICA'
        }
      },
      {
        scheme: 'chronounits',
        path: ['PaleoTemporalCoverages', 0, 'ChronostratigraphicUnits', 0],
        errors: ['Chronostratigraphic unit was not a valid keyword combination.'],
        oldKeyword: 'PHANEROZOIC|CENOZOIC|QUATERNARY|HOLOCENE|MEGHALAYAN|LATE',
        keywordValue: {
          Eon: 'PHANEROZOIC',
          Era: 'CENOZOIC',
          Period: 'QUATERNARY',
          Epoch: 'HOLOCENE',
          Age: 'MEGHALAYAN',
          SubAge: 'LATE'
        }
      },
      {
        scheme: 'projects',
        path: ['Projects', 0],
        errors: ['Project short name was not a valid keyword combination.'],
        oldKeyword: 'ACTIVATE',
        keywordValue: {
          ShortName: 'ACTIVATE',
          LongName: 'Aerosol Cloud meTeorology Interactions oVer the western ATlantic Experiment'
        }
      },
      {
        scheme: 'providers',
        path: ['DataCenters', 0],
        errors: ['Data center short name was not a valid keyword.'],
        oldKeyword: 'NASA/LARC/SD/ASDC',
        keywordValue: {
          ShortName: 'NASA/LARC/SD/ASDC'
        }
      },
      {
        scheme: 'idnnode',
        path: ['DirectoryNames', 0],
        errors: ['Directory name short name was not a valid keyword.'],
        oldKeyword: 'GCMD',
        keywordValue: {
          ShortName: 'GCMD',
          LongName: 'Global Change Master Directory'
        }
      },
      {
        scheme: 'isotopiccategory',
        path: ['IsoTopicCategories', 0],
        errors: ['ISO Topic Category [BOUNDARIES] was not a valid keyword.'],
        oldKeyword: 'BOUNDARIES',
        keywordValue: 'BOUNDARIES'
      },
      {
        scheme: 'temporalresolutionrange',
        path: ['TemporalExtents', 0, 'TemporalResolution'],
        errors: ['Temporal resolution [P1D] was not a valid keyword.'],
        oldKeyword: 'P1D',
        keywordValue: 'P1D'
      },
      {
        scheme: 'horizontalresolutionrange',
        path: ['SpatialInformation', 'ResolutionAndCoordinateSystem', 'HorizontalDataResolution'],
        errors: ['Horizontal resolution was not a valid keyword range.'],
        oldKeyword: '250|m',
        keywordValue: {
          Value: '250',
          Unit: 'm'
        }
      },
      {
        scheme: 'verticalresolutionrange',
        path: ['SpatialExtent', 'VerticalSpatialDomains', 0],
        errors: ['Vertical resolution was not a valid keyword range.'],
        oldKeyword: 'ALTITUDE|1000|m',
        keywordValue: {
          Type: 'ALTITUDE',
          Value: '1000',
          Unit: 'm'
        }
      },
      {
        scheme: 'ProductLevelId',
        path: ['ProcessingLevel', 'Id'],
        errors: ['ProcessingLevel Id [2] was not a valid keyword.'],
        oldKeyword: '2',
        keywordValue: '2'
      },
      {
        scheme: 'DataFormat',
        path: ['ArchiveAndDistributionInformation', 'FileArchiveInformation', 0],
        errors: ['Format [Binary] was not a valid keyword.'],
        oldKeyword: 'Binary',
        keywordValue: 'Binary'
      },
      {
        scheme: 'DataFormat',
        path: ['ArchiveAndDistributionInformation', 'FileDistributionInformation', 0],
        errors: ['Format [netCDF-4] was not a valid keyword.'],
        oldKeyword: 'netCDF-4',
        keywordValue: 'netCDF-4'
      },
      {
        scheme: 'GranuleDataFormat',
        path: ['RelatedUrls', 0, 'GetData', 'Format'],
        errors: ['Format [xml] was not a valid keyword.'],
        oldKeyword: 'xml',
        keywordValue: 'xml'
      },
      {
        scheme: 'rucontenttype',
        path: ['RelatedUrls', 0],
        errors: ['Related URL Content Type was not a valid set together.'],
        oldKeyword: 'DistributionURL|GET DATA|DIRECT DOWNLOAD',
        keywordValue: {
          URLContentType: 'DistributionURL',
          Type: 'GET DATA',
          Subtype: 'DIRECT DOWNLOAD'
        }
      }
    ])

    expect(logger.debug).toHaveBeenCalledWith(
      '[metadata-correction] Extracted keyword validation failures from UMM-C validationErrorCount=17 keywordFailureCount=17'
    )
  })

  test('should mark supported keyword failures as missing a lookup value when the path is missing in umm', () => {
    const result = extractKeywordValidationFailures({
      umm: {},
      validationErrors: [
        {
          path: ['ScienceKeywords', 0],
          errors: ['Science keyword was not a valid keyword combination.']
        }
      ]
    })

    expect(result).toEqual([
      {
        scheme: 'sciencekeywords',
        path: ['ScienceKeywords', 0],
        errors: ['Science keyword was not a valid keyword combination.'],
        oldKeyword: undefined,
        keywordValue: undefined
      }
    ])
  })

  test('should ignore validation errors that do not map to supported keyword schemes', () => {
    const result = extractKeywordValidationFailures({
      umm: {
        SpatialInformation: {
          VerticalCoordinateSystem: {
            Type: 'ALTITUDE',
            Value: '1000',
            Unit: 'm'
          }
        },
        Projects: [
          {
            LongName: 'Project without short name'
          }
        ]
      },
      validationErrors: [
        {
          path: ['SpatialInformation', 'VerticalCoordinateSystem'],
          errors: ['Vertical coordinate system keyword was not valid.']
        },
        {
          path: ['Projects', 0],
          errors: ['Project was missing a short name.']
        },
        {
          path: ['SpatialInformation', 'ResolutionAndCoordinateSystem'],
          errors: ['Unsupported spatial branch.']
        },
        {
          path: ['SpatialExtent', 'HorizontalSpatialDomain'],
          errors: ['Unsupported spatial extent branch.']
        },
        {
          path: ['TemporalExtents', 0, 'RangeDateTimes'],
          errors: ['Unsupported temporal branch.']
        },
        {
          path: ['PaleoTemporalCoverages', 0, 'OtherAges'],
          errors: ['Unsupported paleo branch.']
        },
        {
          path: ['ArchiveAndDistributionInformation', 'SomethingElse'],
          errors: ['Unsupported archive branch.']
        },
        {
          path: ['UnknownField', 0],
          errors: ['Unknown field.']
        },
        {
          path: ['ISOTopicCategories', 0],
          errors: ['ISO Topic Category [BOUNDARIES] was not a valid keyword.']
        },
        undefined
      ]
    })

    expect(result).toEqual([
      {
        scheme: 'verticalresolutionrange',
        path: ['SpatialInformation', 'VerticalCoordinateSystem'],
        errors: ['Vertical coordinate system keyword was not valid.'],
        oldKeyword: 'ALTITUDE|1000|m',
        keywordValue: {
          Type: 'ALTITUDE',
          Value: '1000',
          Unit: 'm'
        }
      },
      {
        scheme: 'projects',
        path: ['Projects', 0],
        errors: ['Project was missing a short name.'],
        oldKeyword: 'Project without short name',
        keywordValue: {
          LongName: 'Project without short name'
        }
      },
      {
        scheme: 'isotopiccategory',
        path: ['ISOTopicCategories', 0],
        errors: ['ISO Topic Category [BOUNDARIES] was not a valid keyword.'],
        oldKeyword: undefined,
        keywordValue: undefined
      }
    ])

    expect(logger.debug).toHaveBeenCalledWith(
      '[metadata-correction] Extracted keyword validation failures from UMM-C validationErrorCount=10 keywordFailureCount=3'
    )
  })

  test('should default to an empty validation error list when none is provided', () => {
    expect(extractKeywordValidationFailures({
      umm: {}
    })).toEqual([])
  })
})
