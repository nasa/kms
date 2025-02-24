import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcept } from '@/getConcept/handler'
import { getApplicationConfig } from '@/shared/getConfig'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/getSkosConcept')
vi.mock('@/shared/getConceptScheme')
vi.mock('@/shared/getGcmdMetadata')

describe('getConcept', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  const mockSuccessfulResponse = (mockSkosConcept) => {
    const mockGcmdMetadata = { 'gcmd:keywordVersion': { _text: '1.0' } }
    getSkosConcept.mockResolvedValue(mockSkosConcept)
    getGcmdMetadata.mockResolvedValue(mockGcmdMetadata)
  }

  describe('when successful', () => {
    describe('when retrieving by concept identifier', () => {
      test('returns successfully with concept and return RDF/XML representation', async () => {
        const mockEvent = { pathParameters: { conceptId: '123' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Concept'
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<rdf:RDF')
        expect(result.body).toContain('<skos:Concept')
        expect(result.body).toContain('<gcmd:keywordVersion>1.0</gcmd:keywordVersion>')
      })
    })

    describe('when retrieving by short name', () => {
      test('should successfully with concept using short name', async () => {
        const mockEvent = { pathParameters: { shortName: 'Test+Short+Name' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Short Name'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test Short Name'
        }))
      })
    })

    describe('when retrieving by altLabel', () => {
      test('should successfully with concept using altLabel', async () => {
        const mockEvent = { pathParameters: { altLabel: 'Alt%2BLabel' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:altLabel': 'Alt+Label'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          altLabel: 'Alt+Label'
        }))
      })
    })

    describe('when retrieving by short name with a scheme', () => {
      test('should successfully with concept using short name and scheme', async () => {
        const mockEvent = {
          pathParameters: { shortName: 'Test+Short+Name' },
          queryStringParameters: { scheme: 'Test%20Scheme' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Short Name'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test Short Name',
          scheme: 'Test Scheme'
        }))
      })
    })

    describe('when retrieving by altLabel with scheme', () => {
      test('should successfully with concept using altLabel and scheme', async () => {
        const mockEvent = {
          pathParameters: { altLabel: 'Alt%2BLabel' },
          queryStringParameters: { scheme: 'Test%20Scheme' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:altLabel': 'Alt+Label'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          altLabel: 'Alt+Label',
          scheme: 'Test Scheme'
        }))
      })
    })

    describe('decode function', () => {
      test('should decode URI encoded strings', async () => {
        const mockEvent = { pathParameters: { shortName: 'Test%20Concept%2BWith%2BSpaces' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Concept+With+Spaces'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test Concept+With+Spaces'
        }))
      })

      test('should handle null values', async () => {
        const mockEvent = { pathParameters: { shortName: null } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Concept'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: null
        }))
      })

      test('should handle undefined values', async () => {
        const mockEvent = { pathParameters: {} }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Concept'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: null,
          altLabel: null,
          conceptIRI: null
        }))
      })

      test('should use decoded values in getSkosConcept call', async () => {
        const mockEvent = {
          pathParameters: {
            shortName: 'Short%20Name',
            altLabel: 'Alt%2BLabel'
          },
          queryStringParameters: {
            scheme: 'Test%20Scheme'
          }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Short Name',
          'skos:altLabel': 'Alt+Label'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith({
          conceptIRI: null,
          shortName: 'Short Name',
          altLabel: 'Alt+Label',
          scheme: 'Test Scheme'
        })
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors and return a 500 status code', async () => {
      const mockEvent = { pathParameters: { conceptId: '123' } }
      getSkosConcept.mockRejectedValue(new Error('Test error'))

      const result = await getConcept(mockEvent)

      expect(result.statusCode).toBe(500)
      expect(result.headers).toEqual(mockDefaultHeaders)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Error: Test error'
      })
    })
  })
})
