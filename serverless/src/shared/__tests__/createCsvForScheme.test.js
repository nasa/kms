import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createCsv } from '../createCsv'
import { createCsvForScheme } from '../createCsvForScheme'
import { generateCsvHeaders } from '../generateCsvHeaders'
import { getApplicationConfig } from '../getConfig'
import { getCsvHeaders } from '../getCsvHeaders'
import { getCsvMetadata } from '../getCsvMetadata'
import { getCsvPaths } from '../getCsvPaths'
import { getMaxLengthOfSubArray } from '../getMaxLengthOfSubArray'

// Mock the imported functions
vi.mock('../getConfig')
vi.mock('../getCsvMetadata')
vi.mock('../getCsvHeaders')
vi.mock('../getCsvPaths')
vi.mock('../createCsv')
vi.mock('../generateCsvHeaders')
vi.mock('../getMaxLengthOfSubArray')

describe('createCsvForScheme', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should create a CSV for a given scheme successfully', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockHeaders = ['Header1', 'Header2']
      const mockPaths = ['path1', 'path2']
      const mockCsvContent = 'csv,content'

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue(mockMetadata)
      getCsvHeaders.mockResolvedValue(mockHeaders)
      getCsvPaths.mockResolvedValue(mockPaths)
      createCsv.mockResolvedValue(mockCsvContent)

      const result = await createCsvForScheme(scheme, version)

      expect(result).toEqual({
        statusCode: 200,
        body: mockCsvContent,
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${scheme}.csv`
        }
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme, version)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, mockHeaders.length, version)
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockHeaders, mockPaths)
    })

    test('should sort paths correctly when shorter arrays come first', async () => {
      const scheme = 'testScheme'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockHeaders = ['Header1', 'Header2', 'Header3']
      const mockPaths = [
        ['A', '1', '3'],
        ['A', '1'],
        ['A', '1', '2'],
        ['A', '1', '1']
      ]
      const mockCsvContent = 'csv,content'

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue(mockMetadata)
      getCsvHeaders.mockResolvedValue(mockHeaders)
      getCsvPaths.mockResolvedValue(mockPaths)
      createCsv.mockResolvedValue(mockCsvContent)

      await createCsvForScheme(scheme)

      // Check if createCsv was called with correctly sorted paths
      const expectedSortedPaths = [
        ['A', '1'],
        ['A', '1', '1'],
        ['A', '1', '2'],
        ['A', '1', '3']
      ]
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockHeaders, expectedSortedPaths)
    })

    test('should generate headers if none are retrieved', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockPaths = [['A', '1', '2'], ['B', '2', '3']]
      const mockGeneratedHeaders = ['Header1', 'Header2', 'Header3']
      const mockCsvContent = 'csv,content'

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue(mockMetadata)
      getCsvHeaders.mockResolvedValue([]) // Return empty array to trigger header generation
      getCsvPaths.mockResolvedValue(mockPaths)
      getMaxLengthOfSubArray.mockReturnValue(3)
      generateCsvHeaders.mockReturnValue(mockGeneratedHeaders)
      createCsv.mockResolvedValue(mockCsvContent)

      const result = await createCsvForScheme(scheme, version)

      expect(result).toEqual({
        statusCode: 200,
        body: mockCsvContent,
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${scheme}.csv`
        }
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme, version)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, 0, version) // Called with 0 since initial headers were empty
      expect(getMaxLengthOfSubArray).toHaveBeenCalledWith(mockPaths)
      expect(generateCsvHeaders).toHaveBeenCalledWith(scheme, version, 3)
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockGeneratedHeaders, mockPaths)
    })

    test('should handle "granuledataformat" scheme correctly', async () => {
      const scheme = 'granuledataformat'
      const version = 'draft'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockHeaders = ['Header1', 'Header2']
      const mockPaths = ['path1', 'path2']
      const mockCsvContent = 'csv,content'

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue(mockMetadata)
      getCsvHeaders.mockResolvedValue(mockHeaders)
      getCsvPaths.mockResolvedValue(mockPaths)
      createCsv.mockResolvedValue(mockCsvContent)

      const result = await createCsvForScheme(scheme, version)

      expect(result).toEqual({
        statusCode: 200,
        body: mockCsvContent,
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=dataformat.csv'
        }
      })

      // Check if the functions were called with 'dataformat' instead of 'granuledataformat'
      expect(getCsvMetadata).toHaveBeenCalledWith('dataformat', version)
      expect(getCsvHeaders).toHaveBeenCalledWith('dataformat', version)
      expect(getCsvPaths).toHaveBeenCalledWith('dataformat', mockHeaders.length, version)
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockHeaders, mockPaths)
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Test error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockRejectedValue(mockError)

      const result = await createCsvForScheme(scheme, version)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme, version)
    })

    test('should handle errors from getCsvHeaders and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Headers error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue({})
      getCsvHeaders.mockRejectedValue(mockError)

      const result = await createCsvForScheme(scheme, version)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme, version)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
    })

    test('should handle errors from getCsvPaths and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const version = 'version'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Paths error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue({})
      getCsvHeaders.mockResolvedValue(['Header1', 'Header2'])
      getCsvPaths.mockRejectedValue(mockError)

      const result = await createCsvForScheme(scheme, version)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme, version)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, 2, version)
    })
  })
})
