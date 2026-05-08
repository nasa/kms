import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '../logger'
import {
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName
} from '../redisCacheKeys'
import { getCachedJsonResponse, getRedisClient } from '../redisCacheStore'
import { validateCmrCollectionUmm } from '../validateCmrCollectionUmm'

vi.mock('../redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn(),
  getRedisClient: vi.fn()
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn()
  }
}))

const createCachedResponse = (body) => ({
  statusCode: 200,
  body: JSON.stringify(body)
})

describe('validateCmrCollectionUmm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRedisClient).mockResolvedValue({
      get: vi.fn()
    })
  })

  test('should validate a collection and return an empty error list when all published lookups exist', async () => {
    const scienceKeywordKey = createPublishedConceptResponseCacheKeyByFullPath({
      fullPath: 'earth science > atmosphere > aerosols',
      scheme: 'sciencekeywords'
    })
    const platformKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'aqua',
      scheme: 'platforms'
    })
    const instrumentKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'modis',
      scheme: 'instruments'
    })
    const granuleDataFormatKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'netcdf-4',
      scheme: 'granuledataformat'
    })

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === scienceKeywordKey) {
        return createCachedResponse({
          uuid: 'science-keyword-uuid',
          fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        })
      }

      if (cacheKey === platformKey) {
        return createCachedResponse({
          uuid: 'platform-uuid',
          fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
        })
      }

      if (cacheKey === instrumentKey) {
        return createCachedResponse({
          uuid: 'instrument-uuid',
          fullPath: 'Instruments > Spectrometers/Radiometers > MODIS'
        })
      }

      if (cacheKey === granuleDataFormatKey) {
        return createCachedResponse({
          uuid: 'data-format-uuid',
          fullPath: 'Data Format > netCDF-4'
        })
      }

      return null
    })

    const result = await validateCmrCollectionUmm({
      providerId: 'LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      umm: {
        ShortName: 'TEST',
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS'
          }
        ],
        Platforms: [
          {
            ShortName: 'Aqua',
            Instruments: [
              {
                ShortName: 'MODIS'
              }
            ]
          }
        ],
        RelatedUrls: [
          {
            GetData: {
              Format: 'netCDF-4'
            }
          }
        ]
      }
    })

    expect(result).toEqual({
      status: 200,
      errors: [],
      warnings: [],
      responseBody: {
        warnings: []
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledTimes(4)
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[metadata-correction] Validated collection UMM through published keyword cache ')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('status=200')
    )
  })

  test('should return CMR-like validation errors when published keyword lookups are missing', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

    const result = await validateCmrCollectionUmm({
      providerId: 'LARC_ASDC',
      nativeId: 'ACTIVATE_Aerosol_AircraftInSitu_Falcon_Data_1',
      umm: {
        ShortName: 'TEST',
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS'
          }
        ],
        Projects: [
          {
            ShortName: 'LEGACY_PROJECT',
            LongName: 'Legacy Project'
          }
        ],
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
    })

    expect(result).toEqual({
      status: 400,
      errors: [
        {
          path: ['ScienceKeywords', 0],
          errors: ['Science keyword was not a valid keyword combination.']
        },
        {
          path: ['Projects', 0],
          errors: ['Project short name was not a valid keyword combination.']
        },
        {
          path: ['RelatedUrls', 0],
          errors: ['Related URL Content Type was not a valid set together.']
        },
        {
          path: ['RelatedUrls', 0, 'GetData', 'Format'],
          errors: ['Format was not a valid keyword.']
        }
      ],
      warnings: [],
      responseBody: {
        errors: [
          {
            path: ['ScienceKeywords', 0],
            errors: ['Science keyword was not a valid keyword combination.']
          },
          {
            path: ['Projects', 0],
            errors: ['Project short name was not a valid keyword combination.']
          },
          {
            path: ['RelatedUrls', 0],
            errors: ['Related URL Content Type was not a valid set together.']
          },
          {
            path: ['RelatedUrls', 0, 'GetData', 'Format'],
            errors: ['Format was not a valid keyword.']
          }
        ],
        warnings: []
      }
    })

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('status=400')
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('errorCount=4')
    )
  })

  test('should normalize granule data format lookups to the shared dataformat cache namespace', async () => {
    const granuleDataFormatKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: 'hdf5',
      scheme: 'granuledataformat'
    })

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === granuleDataFormatKey) {
        return createCachedResponse({
          uuid: 'data-format-uuid',
          fullPath: 'Data Format > HDF5'
        })
      }

      return null
    })

    await validateCmrCollectionUmm({
      providerId: 'PROV',
      nativeId: 'native-id',
      umm: {
        ShortName: 'TEST',
        RelatedUrls: [
          {
            GetData: {
              Format: 'HDF5'
            }
          }
        ]
      }
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:dataformat:published_concept:short_name:hdf5',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should throw when the published keyword cache is unavailable', async () => {
    vi.mocked(getRedisClient).mockResolvedValue(null)

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      nativeId: 'native-id',
      umm: {
        ShortName: 'TEST'
      }
    })).rejects.toThrow('Published keyword cache is unavailable for metadata correction validation')
  })

  test('should throw when required inputs are missing', async () => {
    await expect(validateCmrCollectionUmm({
      nativeId: 'native-id',
      umm: {}
    })).rejects.toThrow('Missing provider id for CMR collection validation')

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      umm: {}
    })).rejects.toThrow('Missing native id for CMR collection validation')

    await expect(validateCmrCollectionUmm({
      providerId: 'PROV',
      nativeId: 'native-id'
    })).rejects.toThrow('Missing UMM-C payload for CMR collection validation')
  })
})
