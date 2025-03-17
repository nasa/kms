import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrGetRequest, cmrPostRequest } from '../cmrRequest'
import { getNumberOfCmrCollections } from '../getNumberOfCmrCollections'

// Mock the cmrGetRequest and cmrPostRequest functions
vi.mock('../cmrRequest', () => ({
  cmrGetRequest: vi.fn(),
  cmrPostRequest: vi.fn()
}))

// Mock console.error
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('getNumberOfCmrCollections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('should handle science keywords search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '100']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      conceptId: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBe(100)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          science_keywords: {
            uuid: '1234-5678-9ABC-DEF0'
          }
        }
      })
    })
  })

  test('should handle project search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '50']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'projects',
      prefLabel: 'CALIPSO'
    })

    expect(result).toBe(50)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          project: 'CALIPSO'
        }
      })
    })
  })

  test('should handle various schemes correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '10']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)
    cmrGetRequest.mockResolvedValue(mockResponse)

    const testCases = [
      {
        scheme: 'sciencekeywords',
        expectedScheme: 'science_keywords'
      },
      {
        scheme: 'platforms',
        expectedScheme: 'platform'
      },
      {
        scheme: 'instruments',
        expectedScheme: 'instrument'
      },
      {
        scheme: 'locations',
        expectedScheme: 'location_keyword'
      },
      {
        scheme: 'projects',
        expectedScheme: 'project'
      },
      {
        scheme: 'providers',
        expectedScheme: 'data_center'
      },
      {
        scheme: 'productlevelid',
        expectedScheme: 'processing_level_id'
      },
      {
        scheme: 'dataformat',
        expectedScheme: 'granule_data_format'
      },
      {
        scheme: 'granuledataformat',
        expectedScheme: 'granule_data_format'
      },
      {
        scheme: 'unknownscheme',
        expectedScheme: 'unknownscheme'
      }
    ]

    await Promise.all(testCases.map(async (testCase) => {
      const result = await getNumberOfCmrCollections({
        scheme: testCase.scheme,
        conceptId: 'test-id',
        prefLabel: 'test-label',
        fullPath: 'LEVEL_1|LEVEL_2',
        isLeaf: true
      })

      expect(result).toBe(10)

      if (['science_keywords', 'platform', 'instrument', 'location_keyword'].includes(testCase.expectedScheme)) {
        expect(cmrPostRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining(`"${testCase.expectedScheme}":{"uuid":"test-id"}`)
        }))
      } else if (['project', 'processing_level_id'].includes(testCase.expectedScheme)) {
        expect(cmrPostRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining(`"${testCase.expectedScheme}":"test-label"`)
        }))
      } else if (testCase.expectedScheme === 'data_center') {
        expect(cmrPostRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining(`"${testCase.expectedScheme}":`)
        }))
      } else {
        expect(cmrGetRequest).toHaveBeenCalledWith(expect.objectContaining({
          path: expect.stringContaining(`${testCase.expectedScheme}=test-label`)
        }))
      }
    }))
  })

  test('should handle provider search with null and empty values in hierarchy', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '55']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1||LEVEL_3|',
      prefLabel: 'SHORT_NAME',
      isLeaf: true
    })

    expect(result).toBe(55)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_2: 'LEVEL_3',
            short_name: 'SHORT_NAME',
            ignore_case: false
          }
        }
      })
    })
  })

  test('should handle location keyword search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '35']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'locations',
      conceptId: 'LOC-1234-5678-ABCD'
    })

    expect(result).toBe(35)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          location_keyword: {
            uuid: 'LOC-1234-5678-ABCD'
          }
        }
      })
    })
  })

  test('should handle provider search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '75']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2|LEVEL_3',
      prefLabel: 'SHORT_NAME',
      isLeaf: true
    })

    expect(result).toBe(75)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_1: 'LEVEL_2',
            short_name: 'SHORT_NAME',
            ignore_case: false
          }
        }
      })
    })
  })

  test('should handle instrument search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '25']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'instruments',
      conceptId: 'ABCD-1234-5678-EFGH'
    })

    expect(result).toBe(25)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          instrument: {
            uuid: 'ABCD-1234-5678-EFGH'
          }
        }
      })
    })
  })

  test('should handle processing level id search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '30']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'ProductLevelId',
      prefLabel: '1B'
    })

    expect(result).toBe(30)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          processing_level_id: '1B'
        }
      })
    })
  })

  test('should handle other schemes using GET request', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '40']])
    }
    cmrGetRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'otherScheme',
      prefLabel: 'someValue'
    })

    expect(result).toBe(40)
    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?otherScheme=someValue'
    })
  })

  test('should return null for invalid response', async () => {
    const mockResponse = {
      ok: false,
      status: 400
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      conceptId: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      'Error in getNumberOfCmrCollections:',
      expect.any(Error)
    )
  })

  test('should handle missing cmr-hits header', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map()
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      conceptId: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBe(0)
  })

  test('should handle granule data format search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '60']])
    }
    cmrGetRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'granuledataformat',
      prefLabel: 'HDF5'
    })

    expect(result).toBe(60)
    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?granule_data_format=HDF5'
    })
  })

  test('should handle platform search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '45']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'platforms',
      conceptId: 'PLAT-1234-5678'
    })

    expect(result).toBe(45)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          platform: {
            uuid: 'PLAT-1234-5678'
          }
        }
      })
    })
  })

  test('should handle non-leaf provider search', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '80']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2',
      isLeaf: false
    })

    expect(result).toBe(80)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_1: 'LEVEL_2',
            ignore_case: false
          }
        }
      })
    })
  })

  test('should handle errors for various schemes', async () => {
    cmrPostRequest.mockRejectedValue(new Error('Network error'))
    cmrGetRequest.mockRejectedValue(new Error('Network error'))

    const schemes = ['sciencekeywords', 'projects', 'providers', 'ProductLevelId', 'otherScheme']

    await Promise.all(schemes.map(async (scheme) => {
      const result = await getNumberOfCmrCollections({
        scheme,
        conceptId: 'test-id',
        prefLabel: 'test-label',
        fullPath: 'LEVEL_1|LEVEL_2',
        isLeaf: true
      })

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        'Error in getNumberOfCmrCollections:',
        expect.any(Error)
      )
    }))
  })
})
