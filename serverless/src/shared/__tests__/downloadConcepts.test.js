import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcepts } from '@/getConcepts/handler'

import { downloadConcepts } from '../downloadConcepts'

vi.mock('@/getConcepts/handler')
vi.mock('@/shared/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

describe('downloadConcepts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when successful', () => {
    test('should download CSV format by default', async () => {
      const mockCsvContent = '"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z","Timestamp: 2026-03-17 17:35:41"\n"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"\n"EARTH SCIENCE","AGRICULTURE","AGRICULTURAL AQUATIC SCIENCES","AQUACULTURE","","","","8916dafb-5ad5-45c6-ab64-3500ea1e9577"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockCsvContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'sciencekeywords'
      })

      expect(getConcepts).toHaveBeenCalledWith({
        pathParameters: { conceptScheme: 'sciencekeywords' },
        queryStringParameters: {
          format: 'csv',
          version: 'published'
        },
        resource: '/concepts/concept_scheme/{conceptScheme}'
      })

      expect(result).toBe(mockCsvContent)
    })

    test('should download published version by default', async () => {
      const mockCsvContent = '"Category","Topic","Term","Variable_Level_1","UUID"\n"EARTH SCIENCE","AGRICULTURE","AGRICULTURAL CHEMICALS","FERTILIZERS12","18a8197e-3a3f-408c-9c51-e9fe89dd6b45"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockCsvContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'platforms',
        format: 'csv'
      })

      expect(getConcepts).toHaveBeenCalledWith({
        pathParameters: { conceptScheme: 'platforms' },
        queryStringParameters: {
          format: 'csv',
          version: 'published'
        },
        resource: '/concepts/concept_scheme/{conceptScheme}'
      })

      expect(result).toBe(mockCsvContent)
    })

    test('should download CSV content for a specific concept scheme', async () => {
      const mockCsvContent = '"Category","Series_Entity","Short_Name","Long_Name","UUID"\n"EARTH OBSERVATION SATELLITES","TERRA","AM-1","Advanced Microwave Technology Satellite-1","d3c8e1f2-9b7a-4c5d-8e6f-1a2b3c4d5e6f"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockCsvContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'instruments',
        format: 'csv',
        version: 'draft'
      })

      expect(getConcepts).toHaveBeenCalledWith({
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: {
          format: 'csv',
          version: 'draft'
        },
        resource: '/concepts/concept_scheme/{conceptScheme}'
      })

      expect(result).toBe(mockCsvContent)
    })

    test('should download JSON content when format is json', async () => {
      const mockJsonContent = {
        concepts: [
          {
            uuid: 'e9f67a66-e9fc-435c-b720-ae32a2c3d8f5',
            category: 'EARTH SCIENCE',
            topic: '',
            term: ''
          },
          {
            uuid: 'a956d045-3b12-441c-8a18-fac7d33b2b4e',
            category: 'EARTH SCIENCE',
            topic: 'AGRICULTURE',
            term: ''
          }
        ]
      }
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify(mockJsonContent)
      })

      const result = await downloadConcepts({
        conceptScheme: 'providers',
        format: 'json',
        version: 'published'
      })

      expect(getConcepts).toHaveBeenCalledWith({
        pathParameters: { conceptScheme: 'providers' },
        queryStringParameters: {
          format: 'json',
          version: 'published'
        },
        resource: '/concepts/concept_scheme/{conceptScheme}'
      })

      expect(result).toEqual(mockJsonContent)
    })

    test('should handle draft version downloads', async () => {
      const mockCsvContent = '"Category","Type","Subregion_1","UUID"\n"CONTINENT","AFRICA","CENTRAL AFRICA","f4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8c"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockCsvContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'locations',
        format: 'csv',
        version: 'draft'
      })

      expect(getConcepts).toHaveBeenCalledWith({
        pathParameters: { conceptScheme: 'locations' },
        queryStringParameters: {
          format: 'csv',
          version: 'draft'
        },
        resource: '/concepts/concept_scheme/{conceptScheme}'
      })

      expect(result).toBe(mockCsvContent)
    })

    test('should handle sciencekeywords scheme', async () => {
      const mockContent = '"Category","Topic","Term","UUID"\n"EARTH SCIENCE","AGRICULTURE","AGRICULTURAL PLANT SCIENCE","25be3b9a-9d4c-4b5b-8d24-b1f519913d90"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'sciencekeywords',
        format: 'csv',
        version: 'published'
      })

      expect(result).toBe(mockContent)
    })

    test('should handle platforms scheme', async () => {
      const mockContent = '"Category","Series_Entity","Short_Name","UUID"\n"EARTH OBSERVATION SATELLITES","AQUA","AQUA","b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'platforms',
        format: 'csv',
        version: 'published'
      })

      expect(result).toBe(mockContent)
    })

    test('should handle instruments scheme', async () => {
      const mockContent = '"Category","Class","Type","Short_Name","Long_Name","UUID"\n"EARTH REMOTE SENSING INSTRUMENTS","ACTIVE REMOTE SENSING","ALTIMETERS","ATMS","Advanced Technology Microwave Sounder","c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f"'
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: mockContent
      })

      const result = await downloadConcepts({
        conceptScheme: 'instruments',
        format: 'csv',
        version: 'published'
      })

      expect(result).toBe(mockContent)
    })
  })

  describe('when unsuccessful', () => {
    test('should only mark matching 404 signatures as scheme-not-found', async () => {
      const cases = [
        {
          conceptScheme: 'nonexistent',
          body: { error: 'Invalid concept scheme parameter. Concept scheme not found' },
          expectedMessage: 'Failed to download CSV. Status: 404 - Invalid concept scheme parameter. Concept scheme not found',
          expectedIsSchemeNotFound: true
        },
        {
          conceptScheme: 'sciencekeywords',
          body: { error: 'Repository not found' },
          expectedMessage: 'Failed to download CSV. Status: 404 - Repository not found',
          expectedIsSchemeNotFound: false
        },
        {
          conceptScheme: 'sciencekeywords',
          body: { message: 'Missing resource' },
          expectedMessage: 'Failed to download CSV. Status: 404',
          expectedIsSchemeNotFound: false
        }
      ]

      for (const testCase of cases) {
        getConcepts.mockResolvedValue({
          statusCode: 404,
          body: JSON.stringify(testCase.body)
        })

        await expect(downloadConcepts({
          conceptScheme: testCase.conceptScheme,
          format: 'csv',
          version: 'published'
        })).rejects.toMatchObject({
          message: testCase.expectedMessage,
          isSchemeNotFound: testCase.expectedIsSchemeNotFound,
          statusCode: 404
        })
      }
    })

    test('should throw error when getConcepts returns 500 status code', async () => {
      getConcepts.mockResolvedValue({
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      })

      await expect(downloadConcepts({
        conceptScheme: 'sciencekeywords',
        format: 'csv',
        version: 'published'
      })).rejects.toThrow('Failed to download CSV. Status: 500 - Internal server error')
    })

    test('should include format in error message', async () => {
      getConcepts.mockResolvedValue({
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request' })
      })

      await expect(downloadConcepts({
        conceptScheme: 'platforms',
        format: 'json',
        version: 'published'
      })).rejects.toThrow('Failed to download JSON. Status: 400 - Invalid request')
    })

    test('should handle error when getConcepts throws an exception', async () => {
      getConcepts.mockRejectedValue(new Error('Network error'))

      await expect(downloadConcepts({
        conceptScheme: 'instruments',
        format: 'csv',
        version: 'draft'
      })).rejects.toThrow('Network error')
    })

    test('should handle error response without error field', async () => {
      getConcepts.mockResolvedValue({
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden' })
      })

      await expect(downloadConcepts({
        conceptScheme: 'platforms',
        format: 'csv',
        version: 'published'
      })).rejects.toThrow('Failed to download CSV. Status: 403')
    })

    test('should handle malformed JSON in error response', async () => {
      getConcepts.mockResolvedValue({
        statusCode: 400,
        body: 'Not valid JSON'
      })

      await expect(downloadConcepts({
        conceptScheme: 'projects',
        format: 'csv',
        version: 'published'
      })).rejects.toThrow()
    })
  })

  describe('edge cases', () => {
    test('should handle empty CSV content', async () => {
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: ''
      })

      const result = await downloadConcepts({
        conceptScheme: 'sciencekeywords',
        format: 'csv',
        version: 'published'
      })

      expect(result).toBe('')
    })

    test('should handle empty JSON array', async () => {
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([])
      })

      const result = await downloadConcepts({
        conceptScheme: 'providers',
        format: 'json',
        version: 'published'
      })

      expect(result).toEqual([])
    })

    test('should handle case-insensitive format parameter', async () => {
      const mockContent = { data: 'test' }
      getConcepts.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify(mockContent)
      })

      const result = await downloadConcepts({
        conceptScheme: 'platforms',
        format: 'JSON',
        version: 'published'
      })

      expect(result).toEqual(mockContent)
    })
  })
})
