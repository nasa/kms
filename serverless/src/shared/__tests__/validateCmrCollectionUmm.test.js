import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '../logger'
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

describe('when validating collection UMM-C against the published Redis cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRedisClient).mockResolvedValue({
      get: vi.fn()
    })
  })

  test('should produce the correct Redis cache key for science keywords', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'science-keyword-uuid',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS'
          }
        ]
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:sciencekeywords:published_concept:full_path:earth%20science%20%3E%20atmosphere%20%3E%20aerosols%20%3E%20%20%3E%20%20%3E%20%20%3E%20',
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('should produce the correct Redis cache key for platforms', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'platform-uuid',
      keywordObject: {
        ShortName: 'Aqua'
      }
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        Platforms: [
          {
            ShortName: 'Aqua'
          }
        ]
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:platforms:published_concept:short_name:aqua',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should produce the correct Redis cache keys for a platform and its nested instrument', async () => {
    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === 'kms:platforms:published_concept:short_name:aqua') {
        return createCachedResponse({
          uuid: 'platform-uuid',
          keywordObject: {
            ShortName: 'Aqua'
          }
        })
      }

      if (cacheKey === 'kms:instruments:published_concept:short_name:modis') {
        return createCachedResponse({
          uuid: 'instrument-uuid',
          keywordObject: {
            ShortName: 'MODIS'
          }
        })
      }

      return null
    })

    const result = await validateCmrCollectionUmm({
      umm: {
        Platforms: [
          {
            ShortName: 'Aqua',
            Instruments: [
              {
                ShortName: 'MODIS'
              }
            ]
          }
        ]
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(2)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:platforms:published_concept:short_name:aqua',
      entityLabel: 'Published Concept by shortName'
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:instruments:published_concept:short_name:modis',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should produce the correct Redis cache key for chronostratigraphic units', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'chronounit-uuid',
      fullPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > HOLOCENE > MEGHALAYAN > LATE'
    }))

    const result = await validateCmrCollectionUmm({
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
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:chronounits:published_concept:full_path:phanerozoic%20%3E%20cenozoic%20%3E%20quaternary%20%3E%20holocene%20%3E%20meghalayan%20%3E%20late',
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('should produce the correct Redis cache key for projects', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'project-uuid',
      keywordObject: {
        ShortName: 'EOSDIS'
      }
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        Projects: [
          {
            ShortName: 'EOSDIS'
          }
        ]
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:projects:published_concept:short_name:eosdis',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should produce the correct Redis cache key for providers', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'provider-uuid',
      keywordObject: {
        ShortName: 'GHRC_DAAC'
      }
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        DataCenters: [
          {
            ShortName: 'GHRC_DAAC'
          }
        ]
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:providers:published_concept:short_name:ghrc_daac',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should produce the correct Redis cache key for IDN nodes', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'idn-node-uuid',
      keywordObject: {
        ShortName: 'ACADIS'
      }
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        DirectoryNames: [
          {
            ShortName: 'ACADIS'
          }
        ]
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:idnnode:published_concept:short_name:acadis',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should produce the correct Redis cache key for ISO topic categories', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'iso-topic-category-uuid',
      fullPath: 'OCEANS'
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        ISOTopicCategories: ['OCEANS']
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:isotopiccategory:published_concept:full_path:oceans',
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('should produce the correct Redis cache key for processing-level IDs', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'product-level-uuid',
      fullPath: '2'
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        ProcessingLevel: {
          Id: '2'
        }
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:productlevelid:published_concept:full_path:2',
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('should produce the correct Redis cache key for archive data formats', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(createCachedResponse({
      uuid: 'data-format-uuid',
      keywordObject: {
        ShortName: 'NetCDF'
      }
    }))

    const result = await validateCmrCollectionUmm({
      umm: {
        ArchiveAndDistributionInformation: {
          FileArchiveInformation: [
            {
              Format: 'NetCDF'
            }
          ]
        }
      }
    })

    expect(result.status).toBe(200)
    expect(result.errors).toEqual([])
    expect(getCachedJsonResponse).toHaveBeenCalledTimes(1)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:dataformat:published_concept:short_name:netcdf',
      entityLabel: 'Published Concept by shortName'
    })
  })

  test('should produce the correct Redis cache key for Related URL content types', async () => {
    const ruContentTypeKey = 'kms:rucontenttype:published_concept:full_path:collectionurl%20%3E%20project%20home%20page%20%3E%20'

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === ruContentTypeKey) {
        return createCachedResponse({
          uuid: 'ru-content-type-uuid',
          fullPath: 'CollectionURL > PROJECT HOME PAGE > '
        })
      }

      return null
    })

    const result = await validateCmrCollectionUmm({
      umm: {
        ShortName: 'TEST',
        RelatedUrls: [
          {
            URLContentType: 'CollectionURL',
            Type: 'PROJECT HOME PAGE'
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

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: ruContentTypeKey,
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('should produce the correct Redis cache key for locations', async () => {
    const locationKey = 'kms:locations:published_concept:full_path:geographic%20region%20%3E%20western%20hemisphere%20%3E%20%20%3E%20%20%3E%20%20%3E%20'

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === locationKey) {
        return createCachedResponse({
          uuid: 'a29a6a2b-e0e5-4ba9-9768-df67db4f34a6',
          fullPath: 'GEOGRAPHIC REGION > WESTERN HEMISPHERE >  >  >  > '
        })
      }

      return null
    })

    const result = await validateCmrCollectionUmm({
      umm: {
        LocationKeywords: [
          {
            Category: 'GEOGRAPHIC REGION',
            Type: 'WESTERN HEMISPHERE'
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

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: locationKey,
      entityLabel: 'Published Concept by fullPath'
    })
  })

  test('should produce the correct Redis cache key for granule data formats', async () => {
    const granuleDataFormatKey = 'kms:dataformat:published_concept:short_name:hdf5'

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === granuleDataFormatKey) {
        return createCachedResponse({
          uuid: 'data-format-uuid',
          keywordObject: {
            ShortName: 'HDF5'
          }
        })
      }

      return null
    })

    await validateCmrCollectionUmm({
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

  test('should reject an ISO Topic Category when only its casing differs from the published value', async () => {
    const isoTopicCategoryKey = 'kms:isotopiccategory:published_concept:full_path:climatology%2Fmeteorology%2Fatmosphere'

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === isoTopicCategoryKey) {
        return createCachedResponse({
          uuid: 'iso-topic-category-uuid',
          // The actual published value uses different casing than the collection value.
          fullPath: 'Climatology/Meteorology/Atmosphere'
        })
      }

      return null
    })

    // Index 0 differs by case; index 1 exactly matches the canonical published value.
    const result = await validateCmrCollectionUmm({
      umm: {
        ShortName: 'TEST',
        ISOTopicCategories: [
          'CLIMATOLOGY/METEOROLOGY/ATMOSPHERE',
          'Climatology/Meteorology/Atmosphere'
        ]
      }
    })

    expect(result.errors).toEqual([
      {
        path: ['IsoTopicCategories', 0],
        errors: ['ISO Topic Category was not a valid keyword.']
      }
    ])
  })

  test('should reject a short name when only its casing differs from the published value', async () => {
    const platformKey = 'kms:platforms:published_concept:short_name:aqua'

    vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
      if (cacheKey === platformKey) {
        return createCachedResponse({
          uuid: 'platform-uuid',
          keywordObject: {
            // The actual published value uses different casing than the collection value.
            ShortName: 'Aqua'
          }
        })
      }

      return null
    })

    const result = await validateCmrCollectionUmm({
      umm: {
        ShortName: 'TEST',
        Platforms: [
          {
            ShortName: 'AQUA'
          }
        ]
      }
    })

    expect(result.errors).toEqual([
      {
        path: ['Platforms', 0],
        errors: ['Platform short name was not a valid keyword combination.']
      }
    ])
  })

  test('should return CMR-like validation errors when published keyword lookups are missing', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

    const result = await validateCmrCollectionUmm({
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

  test('should throw when the published keyword cache is unavailable', async () => {
    vi.mocked(getRedisClient).mockResolvedValue(null)

    await expect(validateCmrCollectionUmm({
      umm: {
        ShortName: 'TEST'
      }
    })).rejects.toThrow('Published keyword cache is unavailable for metadata correction validation')
  })

  test('should throw when the UMM-C payload is missing', async () => {
    await expect(validateCmrCollectionUmm({
    })).rejects.toThrow('Missing UMM-C payload for published keyword cache validation')
  })

  describe('when UMM-C contains null keyword entries', () => {
    test('should ignore null keyword candidates across supported families', async () => {
      vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

      const result = await validateCmrCollectionUmm({
        umm: {
          ShortName: 'TEST',
          ScienceKeywords: [null],
          Platforms: [null],
          LocationKeywords: [null],
          PaleoTemporalCoverages: [
            {
              ChronostratigraphicUnits: [null]
            }
          ],
          Projects: [null],
          DataCenters: [null],
          DirectoryNames: [null],
          ISOTopicCategories: [null],
          TemporalExtents: [
            {}
          ],
          SpatialExtent: {
            VerticalSpatialDomains: [null]
          },
          ArchiveAndDistributionInformation: {
            FileArchiveInformation: [null],
            FileDistributionInformation: [null]
          },
          RelatedUrls: [
            {},
            null
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
    })

    test('should ignore null instrument entries and null paleo coverage entries', async () => {
      const platformKey = 'kms:platforms:published_concept:short_name:aqua'

      vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => {
        if (cacheKey === platformKey) {
          return createCachedResponse({
            uuid: 'platform-uuid',
            keywordObject: {
              ShortName: 'Aqua'
            }
          })
        }

        return null
      })

      const result = await validateCmrCollectionUmm({
        umm: {
          ShortName: 'TEST',
          Platforms: [
            {
              ShortName: 'Aqua',
              Instruments: [null]
            }
          ],
          PaleoTemporalCoverages: [
            null
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
    })
  })

  test('should extract and validate the broader supported keyword families', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

    const result = await validateCmrCollectionUmm({
      umm: {
        ShortName: 'TEST',
        Platforms: [
          null
        ],
        LocationKeywords: [
          {
            Category: 'OCEAN'
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
        DataCenters: [
          {
            ShortName: 'GCMD'
          }
        ],
        DirectoryNames: [
          {
            ShortName: 'DIRECTORY'
          }
        ],
        ISOTopicCategories: ['BOUNDARIES'],
        TemporalExtents: [
          {
            TemporalResolution: 'P1D'
          }
        ],
        SpatialInformation: {
          ResolutionAndCoordinateSystem: {
            HorizontalDataResolution: {
              Unit: 'Meters'
            }
          }
        },
        SpatialExtent: {
          VerticalSpatialDomains: [
            {
              Type: 'Altitude'
            }
          ]
        },
        ProcessingLevel: {
          Id: 'L1'
        },
        ArchiveAndDistributionInformation: {
          FileArchiveInformation: [
            {
              Format: 'HDF5'
            }
          ],
          FileDistributionInformation: [
            {
              Format: 'NetCDF'
            }
          ]
        },
        RelatedUrls: [
          null
        ]
      }
    })

    expect(result.status).toBe(400)
    expect(result.errors).toEqual(expect.arrayContaining([
      {
        path: ['LocationKeywords', 0],
        errors: ['Location keyword was not a valid keyword combination.']
      },
      {
        path: ['PaleoTemporalCoverages', 0, 'ChronostratigraphicUnits', 0],
        errors: ['Chronostratigraphic unit was not a valid keyword combination.']
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
        errors: ['ISO Topic Category was not a valid keyword.']
      },
      {
        path: ['ProcessingLevel', 'Id'],
        errors: ['ProcessingLevel Id was not a valid keyword.']
      },
      {
        path: ['ArchiveAndDistributionInformation', 'FileArchiveInformation', 0],
        errors: ['Format was not a valid keyword.']
      },
      {
        path: ['ArchiveAndDistributionInformation', 'FileDistributionInformation', 0],
        errors: ['Format was not a valid keyword.']
      }
    ]))
  })

  describe('when UMM-C resolution fields cannot map directly to KMS range labels', () => {
    test('should ignore those fields', async () => {
      const result = await validateCmrCollectionUmm({
        umm: {
          TemporalExtents: [
            {
              TemporalResolution: {
                Value: 1,
                Unit: 'Day'
              }
            }
          ],
          SpatialInformation: {
            ResolutionAndCoordinateSystem: {
              HorizontalDataResolution: {
                NonGriddedResolutions: [
                  {
                    XDimension: 250,
                    YDimension: 250,
                    Unit: 'Meters'
                  }
                ]
              }
            }
          },
          SpatialExtent: {
            VerticalSpatialDomains: [
              {
                Type: 'Atmosphere Layer',
                Value: 'Troposphere'
              }
            ]
          }
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

      expect(getCachedJsonResponse).not.toHaveBeenCalled()
    })
  })

  test('should treat malformed keyword shapes as validation failures without crashing', async () => {
    vi.mocked(getCachedJsonResponse).mockResolvedValue(null)

    const result = await validateCmrCollectionUmm({
      umm: {
        ShortName: 'TEST',
        ScienceKeywords: [
          ['EARTH SCIENCE', 'ATMOSPHERE']
        ],
        Platforms: [
          {
            ShortName: null
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
          path: ['Platforms', 0],
          errors: ['Platform short name was not a valid keyword combination.']
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
            path: ['Platforms', 0],
            errors: ['Platform short name was not a valid keyword combination.']
          }
        ],
        warnings: []
      }
    })
  })
})
