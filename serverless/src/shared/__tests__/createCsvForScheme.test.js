import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createCsv } from '../createCsv'
import { createCsvForScheme } from '../createCsvForScheme'
import { getApplicationConfig } from '../getConfig'
import { getCsvHeaders } from '../getCsvHeaders'
import { getCsvMetadata } from '../getCsvMetadata'
import { getCsvPaths } from '../getCsvPaths'

// Mock the imported functions
vi.mock('../getConfig')
vi.mock('../getCsvMetadata')
vi.mock('../getCsvHeaders')
vi.mock('../getCsvPaths')
vi.mock('../createCsv')

describe('createCsvForScheme', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()
  })

  describe('when successful', () => {
    test('should create a CSV for a given scheme successfully', async () => {
      const scheme = 'testScheme'
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

      const result = await createCsvForScheme(scheme)

      expect(result).toEqual({
        statusCode: 200,
        body: mockCsvContent,
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${scheme}.csv`
        }
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, mockHeaders.length)
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockHeaders, mockPaths)
    })

    test('should sort paths correctly when they have different lengths', async () => {
      const scheme = 'testScheme'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockHeaders = ['Header1', 'Header2', 'Header3']
      const mockPaths = [
        ['B', '2', '3'],
        ['A', '1'],
        ['A', '2', '3'],
        ['B', '1']
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
        ['A', '2', '3'],
        ['B', '1'],
        ['B', '2', '3']
      ]
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockHeaders, expectedSortedPaths)
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Test error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockRejectedValue(mockError)

      const result = await createCsvForScheme(scheme)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme)
    })

    test('should handle errors from getCsvHeaders and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Headers error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue({})
      getCsvHeaders.mockRejectedValue(mockError)

      const result = await createCsvForScheme(scheme)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme)
    })

    test('should handle errors from getCsvPaths and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Paths error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getCsvMetadata.mockResolvedValue({})
      getCsvHeaders.mockResolvedValue(['Header1', 'Header2'])
      getCsvPaths.mockRejectedValue(mockError)

      const result = await createCsvForScheme(scheme)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(getCsvMetadata).toHaveBeenCalledWith(scheme)
      expect(getCsvHeaders).toHaveBeenCalledWith(scheme)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, 2)
    })
  })
})
