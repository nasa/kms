import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcept } from '@/getConcept/handler'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { createShortNameMap } from '@/shared/createShortNameMap'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getCsvHeaders } from '@/shared/getCsvHeaders'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'
import toLegacyJSON from '@/shared/toLegacyJSON'
import toLegacyXML from '@/shared/toLegacyXML'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/getSkosConcept')
vi.mock('@/shared/getGcmdMetadata')
vi.mock('@/shared/createConceptSchemeMap')
vi.mock('@/shared/createPrefLabelMap')
vi.mock('@/shared/createShortNameMap')
vi.mock('@/shared/getCsvHeaders')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/toLegacyJSON')
vi.mock('@/shared/toLegacyXML')

describe('getConcept', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    createConceptSchemeMap.mockResolvedValue(new Map())
    createPrefLabelMap.mockResolvedValue(new Map())
    createShortNameMap.mockResolvedValue(new Map())
    getCsvHeaders.mockResolvedValue([])
    getConceptSchemeDetails.mockResolvedValue({})
    toLegacyJSON.mockReturnValue({})
    toLegacyXML.mockReturnValue({})
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
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<rdf:RDF')
        expect(result.body).toContain('<skos:Concept')
        expect(result.body).toContain('<gcmd:keywordVersion>1.0</gcmd:keywordVersion>')
      })
    })

    describe('format handling', () => {
      test('returns RDF format by default', async () => {
        const mockEvent = { pathParameters: { conceptId: '123' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<rdf:RDF')
      })

      test('returns JSON format when specified', async () => {
        const mockEvent = {
          pathParameters: { conceptId: '123' },
          queryStringParameters: { format: 'json' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)
        toLegacyJSON.mockReturnValue({
          id: '123',
          label: 'Test Concept'
        })

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8')
        expect(() => JSON.parse(result.body)).not.toThrow()
        const parsedBody = JSON.parse(result.body)
        expect(parsedBody).toEqual({
          id: '123',
          label: 'Test Concept'
        })
      })

      test('returns XML format when specified', async () => {
        const mockEvent = {
          pathParameters: { conceptId: '123' },
          queryStringParameters: { format: 'xml' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/shortName' }
        }
        mockSuccessfulResponse(mockSkosConcept)
        toLegacyXML.mockReturnValue({
          concept: {
            '@id': '123',
            label: 'Test Concept'
          }
        })

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<concept id="123">')
        expect(result.body).toContain('<label>Test Concept</label>')
      })
    })

    describe('decode function', () => {
      test('should decode URI encoded strings', async () => {
        const mockEvent = { pathParameters: { shortName: 'Test%20PrefLabel%2BWith%2BSpaces' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel+With+Spaces' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test PrefLabel+With+Spaces'
        }))
      })

      test('should handle null values', async () => {
        const mockEvent = { pathParameters: { shortName: null } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
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
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
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
          'skos:prefLabel': { _text: 'Short Name' },
          'skos:altLabel': { _text: 'Alt+Label' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
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

    test('should log the error', async () => {
      const mockEvent = { pathParameters: { conceptId: '123' } }
      const testError = new Error('Test error')
      getSkosConcept.mockRejectedValue(testError)

      await getConcept(mockEvent)

      expect(console.error).toHaveBeenCalledWith(`Error retrieving concept, error=${testError.toString()}`)
    })

    test('should return 404 when concept is not found', async () => {
      const mockEvent = { pathParameters: { conceptId: '123' } }
      getSkosConcept.mockResolvedValue(null)

      const result = await getConcept(mockEvent)

      expect(result.statusCode).toBe(404)
      expect(result.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(result.body)).toEqual({
        error: 'Concept not found'
      })
    })
  })
})
