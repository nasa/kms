import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrGetRequest } from '../cmrGetRequest'
import { cmrPostRequest } from '../cmrPostRequest'
import { getNumberOfCmrCollections } from '../getNumberOfCmrCollections'
import { logger } from '../logger'

// Mock the cmrGetRequest and cmrPostRequest functions
vi.mock('../cmrGetRequest')
vi.mock('../cmrPostRequest')
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}))

describe('getNumberOfCmrCollections', () => {
  const originalConsoleLog = console.log
  beforeEach(() => {
    vi.resetAllMocks()
    console.log = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
    console.log = originalConsoleLog
  })

  test('should return the correct number of collections for science keywords', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '100']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
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

  test('should return the correct number of collections for projects', async () => {
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

  test('should return null when an error occurs', async () => {
    const originalConsoleError = console.error
    console.error = vi.fn()

    cmrPostRequest.mockRejectedValue(new Error('API Error'))
    cmrPostRequest.mockRejectedValue(new Error('API Error'))

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBeNull()
    // Restore console.error
    console.error = originalConsoleError
  })

  test('should use GET request for unsupported schemes', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '25']])
    }
    cmrGetRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'unsupported_scheme',
      prefLabel: 'test_label'
    })

    expect(result).toBe(25)
    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?unsupported_scheme=test_label'
    })
  })

  test('should handle processing_level_id scheme correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '30']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'ProductLevelId',
      prefLabel: 'Level 1'
    })

    expect(result).toBe(30)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          processing_level_id: 'Level 1'
        }
      })
    })
  })

  test('should handle data_center scheme with non-leaf node correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '40']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2',
      isLeaf: false
    })

    expect(result).toBe(40)
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

  test('should handle granule_data_format scheme correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '60']])
    }
    cmrGetRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'dataformat',
      prefLabel: 'HDF5'
    })

    expect(result).toBe(60)
    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?granule_data_format=HDF5'
    })
  })

  test('should return 0 when cmr-hits header is missing', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map()
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBe(0)
  })

  test('should log an error and return null when the response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 400
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith('Error in getNumberOfCmrCollections:', expect.any(Error))
    expect(logger.error).toHaveBeenCalledWith('Error stack:', expect.any(String))
  })

  test('should handle instruments scheme correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '45']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'instruments',
      uuid: 'ABCD-1234-5678-EFGH'
    })

    expect(result).toBe(45)
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

  test('should handle platforms scheme correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '55']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'platforms',
      uuid: 'EFGH-5678-1234-ABCD'
    })

    expect(result).toBe(55)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          platform: {
            uuid: 'EFGH-5678-1234-ABCD'
          }
        }
      })
    })
  })

  test('should handle locations scheme correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '35']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'locations',
      uuid: 'IJKL-9012-3456-MNOP'
    })

    expect(result).toBe(35)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          location_keyword: {
            uuid: 'IJKL-9012-3456-MNOP'
          }
        }
      })
    })
  })

  test('should handle granuledataformat scheme correctly', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '70']])
    }
    cmrGetRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'granuledataformat',
      prefLabel: 'NetCDF-4'
    })

    expect(result).toBe(70)
    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?granule_data_format=NetCDF-4'
    })
  })

  test('should handle case-insensitive scheme matching', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '80']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'ScienceKeywords',
      uuid: 'QRST-5678-1234-UVWX'
    })

    expect(result).toBe(80)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          science_keywords: {
            uuid: 'QRST-5678-1234-UVWX'
          }
        }
      })
    })
  })

  test('should handle empty response from CMR', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '0']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: 'EMPTY-0000-0000-0000'
    })

    expect(result).toBe(0)
  })

  test('should handle network errors', async () => {
    cmrPostRequest.mockRejectedValue(new Error('Network Error'))

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith('Error in getNumberOfCmrCollections:', expect.any(Error))
    expect(logger.error).toHaveBeenCalledWith('Error stack:', expect.any(String))
  })

  test('should handle malformed JSON responses', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', 'not-a-number']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(result).toBe(0)
  })

  test('should handle providers scheme with full hierarchy', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '15']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2|LEVEL_3|LEVEL_4',
      prefLabel: 'SHORT_NAME',
      isLeaf: true
    })

    expect(result).toBe(15)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            level_1: 'LEVEL_2',
            level_2: 'LEVEL_3',
            short_name: 'SHORT_NAME',
            ignore_case: false
          }
        }
      })
    })
  })

  test('should handle providers scheme with partial hierarchy', async () => {
    const mockResponse = {
      ok: true,
      headers: new Map([['cmr-hits', '25']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1',
      isLeaf: false
    })

    expect(result).toBe(25)
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          data_center: {
            level_0: 'LEVEL_1',
            ignore_case: false
          }
        }
      })
    })
  })

  test('should handle errors for unknown schemes', async () => {
  // Mock the cmrGetRequest to throw an error
    cmrGetRequest.mockRejectedValue(new Error('Network error'))

    const result = await getNumberOfCmrCollections({
      scheme: 'unknown_scheme',
      prefLabel: 'Some Label'
    })

    // Check if the function returns null on error
    expect(result).toBeNull()

    // Check if the error is logged
    expect(logger.error).toHaveBeenCalledWith(
      'Error in getNumberOfCmrCollections:',
      expect.any(Error)
    )

    expect(logger.error).toHaveBeenCalledWith(
      'Error stack:',
      expect.any(String)
    )

    // Verify that cmrGetRequest was called with the correct arguments
    expect(cmrGetRequest).toHaveBeenCalledWith({
      path: '/search/collections?unknown_scheme=Some Label'
    })
  })

  test('should handle errors for processing_level_id scheme', async () => {
    // Mock cmrPostRequest to return a failed response
    cmrPostRequest.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Map()
    })

    const result = await getNumberOfCmrCollections({
      scheme: 'ProductLevelId',
      prefLabel: 'Level 1'
    })

    // Check if the function returns null on error
    expect(result).toBeNull()

    // Check if the error is logged
    expect(logger.error).toHaveBeenCalledWith(
      'Error in getNumberOfCmrCollections:',
      expect.any(Error)
    )

    // Verify that cmrPostRequest was called with the correct arguments
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          processing_level_id: 'Level 1'
        }
      })
    })
  })

  test('should handle errors for data_center scheme', async () => {
    // Mock cmrPostRequest to return a failed response
    cmrPostRequest.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Map()
    })

    const result = await getNumberOfCmrCollections({
      scheme: 'providers',
      fullPath: 'LEVEL_1|LEVEL_2|LEVEL_3',
      prefLabel: 'SHORT_NAME',
      isLeaf: true
    })

    // Check if the function returns null on error
    expect(result).toBeNull()

    // Check if the error is logged
    expect(logger.error).toHaveBeenCalledWith(
      'Error in getNumberOfCmrCollections:',
      expect.any(Error)
    )

    // Verify that cmrPostRequest was called
    expect(cmrPostRequest).toHaveBeenCalled()

    // You can add more specific checks for the cmrPostRequest arguments if needed
  })

  test('should handle errors for project scheme', async () => {
    // Mock cmrPostRequest to return a failed response
    cmrPostRequest.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Map()
    })

    const result = await getNumberOfCmrCollections({
      scheme: 'projects',
      prefLabel: 'SOME_PROJECT'
    })

    // Check if the function returns null on error
    expect(result).toBeNull()

    // Check if the error is logged
    expect(logger.error).toHaveBeenCalledWith(
      'Error in getNumberOfCmrCollections:',
      expect.any(Error)
    )

    // Verify that cmrPostRequest was called with the correct arguments
    expect(cmrPostRequest).toHaveBeenCalledWith({
      path: '/search/collections',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        condition: {
          project: 'SOME_PROJECT'
        }
      })
    })
  })

  test('should log info and debug messages', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      headers: new Map([['cmr-hits', '100']])
    }
    cmrPostRequest.mockResolvedValue(mockResponse)

    await getNumberOfCmrCollections({
      scheme: 'sciencekeywords',
      uuid: '1234-5678-9ABC-DEF0'
    })

    expect(logger.info).toHaveBeenCalledWith('getNumberOfCmrCollections called with params:', expect.any(Object))
    expect(logger.debug).toHaveBeenCalledWith('Mapped CMR scheme:', 'science_keywords')
    expect(logger.debug).toHaveBeenCalledWith('Using UUID-based query:', expect.any(String))
    expect(logger.debug).toHaveBeenCalledWith('Performing POST request to CMR with query:', expect.any(String))
    expect(logger.debug).toHaveBeenCalledWith('CMR response status:', 200)
    expect(logger.debug).toHaveBeenCalledWith('CMR hits:', 100)
    expect(logger.info).toHaveBeenCalledWith('Number of collections found:', 100)
  })
})
