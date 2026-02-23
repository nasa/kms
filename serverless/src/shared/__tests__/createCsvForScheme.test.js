import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createCsv } from '../createCsv'
import { createCsvForScheme } from '../createCsvForScheme'
import { createCsvMetadata } from '../createCsvMetadata'
import { generateCsvHeaders } from '../generateCsvHeaders'
import { getApplicationConfig } from '../getConfig'
import { getCsvHeaders } from '../getCsvHeaders'
import { getCsvPaths } from '../getCsvPaths'
import { getMaxLengthOfSubArray } from '../getMaxLengthOfSubArray'

// Mock the imported functions
vi.mock('../getConfig')
vi.mock('../createCsvMetadata')
vi.mock('../getCsvHeaders')
vi.mock('../getCsvPaths')
vi.mock('../createCsv')
vi.mock('../generateCsvHeaders')
vi.mock('../getMaxLengthOfSubArray')
vi.mock('../getSchemeUpdateDate')

describe('createCsvForScheme', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
  })

  describe('when successful', () => {
    test('should create a CSV for a given scheme successfully', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const versionName = 'Test Version'
      const versionCreationDate = '2023-01-01'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockHeaders = ['Header1', 'Header2']
      const mockPaths = ['path1', 'path2']
      const mockCsvContent = 'csv,content'

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      createCsvMetadata.mockReturnValue(mockMetadata)
      getCsvHeaders.mockResolvedValue(mockHeaders)
      getCsvPaths.mockResolvedValue(mockPaths)
      createCsv.mockResolvedValue(mockCsvContent)

      const result = await createCsvForScheme({
        scheme,
        version,
        versionName,
        versionCreationDate
      })

      expect(result).toEqual({
        statusCode: 200,
        body: mockCsvContent,
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${scheme}.csv`
        }
      })

      expect(createCsvMetadata).toHaveBeenCalledWith({
        versionName,
        scheme,
        versionCreationDate: '2023-01-01'
      })

      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, mockHeaders.length, version)
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockHeaders, mockPaths)
    })

    test('should sort paths correctly when shorter arrays come first', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const versionName = 'Test Version'
      const versionCreationDate = '2023-01-01'
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
      createCsvMetadata.mockReturnValue(mockMetadata)
      getCsvHeaders.mockResolvedValue(mockHeaders)
      getCsvPaths.mockResolvedValue(mockPaths)
      createCsv.mockResolvedValue(mockCsvContent)

      await createCsvForScheme({
        scheme,
        version,
        versionName,
        versionCreationDate
      })

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
      const versionName = 'Test Version'
      const versionCreationDate = '2023-01-01'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockMetadata = { some: 'metadata' }
      const mockPaths = [['A', '1', '2'], ['B', '2', '3']]
      const mockGeneratedHeaders = ['Header1', 'Header2', 'Header3']
      const mockCsvContent = 'csv,content'

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      createCsvMetadata.mockReturnValue(mockMetadata)
      getCsvHeaders.mockResolvedValue([]) // Return empty array to trigger header generation
      getCsvPaths.mockResolvedValue(mockPaths)
      getMaxLengthOfSubArray.mockReturnValue(3)
      generateCsvHeaders.mockReturnValue(mockGeneratedHeaders)
      createCsv.mockResolvedValue(mockCsvContent)

      const result = await createCsvForScheme({
        scheme,
        version,
        versionName,
        versionCreationDate
      })

      expect(result).toEqual({
        statusCode: 200,
        body: mockCsvContent,
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${scheme}.csv`
        }
      })

      expect(createCsvMetadata).toHaveBeenCalledWith({
        versionName,
        scheme,
        versionCreationDate: '2023-01-01'
      })

      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, 0, version) // Called with 0 since initial headers were empty
      expect(getMaxLengthOfSubArray).toHaveBeenCalledWith(mockPaths)
      expect(generateCsvHeaders).toHaveBeenCalledWith(scheme, version, 3)
      expect(createCsv).toHaveBeenCalledWith(mockMetadata, mockGeneratedHeaders, mockPaths)
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const versionName = 'Test Version'
      const versionCreationDate = '2023-01-01'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Test error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      createCsvMetadata.mockImplementation(() => { throw mockError })

      const result = await createCsvForScheme({
        scheme,
        version,
        versionName,
        versionCreationDate
      })

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(createCsvMetadata).toHaveBeenCalledWith({
        versionName,
        scheme,
        versionCreationDate: '2023-01-01'
      })
    })

    test('should handle errors from getCsvHeaders and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const version = 'draft'
      const versionName = 'Test Version'
      const versionCreationDate = '2023-01-01'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Headers error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      createCsvMetadata.mockReturnValue({})
      getCsvHeaders.mockRejectedValue(mockError)

      const result = await createCsvForScheme({
        scheme,
        version,
        versionName,
        versionCreationDate
      })

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(createCsvMetadata).toHaveBeenCalledWith({
        versionName,
        scheme,
        versionCreationDate: '2023-01-01'
      })

      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
    })

    test('should handle errors from getCsvPaths and return a 500 status code', async () => {
      const scheme = 'testScheme'
      const version = 'version'
      const versionName = 'Test Version'
      const versionCreationDate = '2023-01-01'
      const mockDefaultHeaders = { 'Default-Header': 'value' }
      const mockError = new Error('Paths error')

      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      createCsvMetadata.mockReturnValue({})
      getCsvHeaders.mockResolvedValue(['Header1', 'Header2'])
      getCsvPaths.mockRejectedValue(mockError)

      const result = await createCsvForScheme({
        scheme,
        version,
        versionName,
        versionCreationDate
      })

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(createCsvMetadata).toHaveBeenCalledWith({
        versionName,
        scheme,
        versionCreationDate: '2023-01-01'
      })

      expect(getCsvHeaders).toHaveBeenCalledWith(scheme, version)
      expect(getCsvPaths).toHaveBeenCalledWith(scheme, 2, version)
    })
  })

  test('should use "N/A" as schemeUpdateDate when getSchemeUpdateDate returns falsy value', async () => {
    const scheme = 'testScheme'
    const version = 'draft'
    const versionName = 'Test Version'
    const versionCreationDate = 'N/A'
    const mockDefaultHeaders = { 'Default-Header': 'value' }
    const mockMetadata = { some: 'metadata' }
    const mockHeaders = ['Header1', 'Header2']
    const mockPaths = ['path1', 'path2']
    const mockCsvContent = 'csv,content'

    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    createCsvMetadata.mockReturnValue(mockMetadata)
    getCsvHeaders.mockResolvedValue(mockHeaders)
    getCsvPaths.mockResolvedValue(mockPaths)
    createCsv.mockResolvedValue(mockCsvContent)

    await createCsvForScheme({
      scheme,
      version,
      versionName,
      versionCreationDate
    })

    expect(createCsvMetadata).toHaveBeenCalledWith({
      versionName,
      scheme,
      versionCreationDate: 'N/A'
    })
  })
})
