import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcepts } from '@/getConcepts/handler'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import {
  createConceptToConceptSchemeShortNameMap
} from '@/shared/createConceptToConceptSchemeShortNameMap'
import { createCsvForScheme } from '@/shared/createCsvForScheme'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getRootConcepts } from '@/shared/getRootConcepts'
import { processTriples } from '@/shared/processTriples'
import { toLegacyJSON } from '@/shared/toLegacyJSON'
import { toSkosJson } from '@/shared/toSkosJson'

// Mock the specified dependencies
vi.mock('@/shared/createCsvForScheme')
vi.mock('@/shared/getFilteredTriples')
vi.mock('@/shared/toSkosJson')
vi.mock('@/shared/processTriples')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getGcmdMetadata')
vi.mock('@/shared/getRootConcepts')
vi.mock('@/shared/createPrefLabelMap')
vi.mock('@/shared/createConceptSchemeMap')
vi.mock('@/shared/createConceptToConceptSchemeShortNameMap')
vi.mock('@/shared/toLegacyJSON')

describe('getConcepts', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    createCsvForScheme.mockReset()
    createPrefLabelMap.mockResolvedValue(new Map())
    createConceptSchemeMap.mockResolvedValue(new Map())
    createConceptToConceptSchemeShortNameMap.mockResolvedValue(new Map())
    toLegacyJSON.mockReturnValue({})
  })

  describe('when format is CSV', () => {
    test('calls createCsvForScheme when format is csv and conceptScheme is provided', async () => {
      getFilteredTriples.mockResolvedValue([])
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {},
        conceptURIs: []
      })

      const mockCsvResponse = {
        statusCode: 200,
        body: 'csv data',
        headers: { 'Content-Type': 'text/csv' }
      }
      createCsvForScheme.mockResolvedValue(mockCsvResponse)

      const event = {
        queryStringParameters: {
          format: 'csv'
        },
        pathParameters: {
          conceptScheme: 'testScheme'
        }
      }

      const result = await getConcepts(event)

      expect(createCsvForScheme).toHaveBeenCalledWith('testScheme', 'published')
      expect(result).toEqual(mockCsvResponse)
    })

    test('returns 400 when format is csv but conceptScheme is not provided', async () => {
      getFilteredTriples.mockResolvedValue([])
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {},
        conceptURIs: []
      })

      const event = {
        queryStringParameters: {
          format: 'csv'
        }
      }

      const result = await getConcepts(event)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 400,
        body: JSON.stringify({ error: 'Scheme parameter is required for CSV format' })
      })
    })

    test('returns 400 when format is csv and pattern is provided', async () => {
      getFilteredTriples.mockResolvedValue([])
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {},
        conceptURIs: []
      })

      const event = {
        queryStringParameters: {
          format: 'csv'
        },
        pathParameters: {
          conceptScheme: 'testScheme',
          pattern: 'testPattern'
        }
      }

      const result = await getConcepts(event)

      expect(result).toEqual({
        headers: mockDefaultHeaders,
        statusCode: 400,
        body: JSON.stringify({ error: 'Pattern parameter is not allowed for CSV format' })
      })
    })
  })

  describe('when successful', () => {
    test('returns concepts by pattern', async () => {
      const mockTriples = [
        {
          s: { value: 'uri1' },
          p: { value: 'p1' },
          o: { value: 'matching pattern' }
        },
        {
          s: { value: 'uri2' },
          p: { value: 'p1' },
          o: { value: 'non-matching' }
        }
      ]
      getFilteredTriples.mockResolvedValue(mockTriples)
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: { uri1: new Set([mockTriples[0]]) },
        conceptURIs: ['uri1']
      })

      toSkosJson.mockReturnValue({
        '@rdf:about': 'uri1',
        'skos:prefLabel': { _text: 'Matching Concept' }
      })

      getGcmdMetadata.mockResolvedValue({})

      const event = { pathParameters: { pattern: 'matching' } }
      const result = await getConcepts(event)

      expect(getFilteredTriples).toHaveBeenCalledWith({
        pattern: 'matching',
        conceptScheme: undefined,
        version: 'published'
      })

      expect(result.body).toContain('<skos:Concept rdf:about="uri1">')
      expect(result.body).not.toContain('<skos:Concept rdf:about="uri2">')
    })

    test('returns concepts by concept scheme', async () => {
      const mockTriples = [
        {
          s: { value: 'uri1' },
          p: { value: 'inScheme' },
          o: { value: 'scheme1' }
        },
        {
          s: { value: 'uri2' },
          p: { value: 'inScheme' },
          o: { value: 'scheme2' }
        }
      ]
      getFilteredTriples.mockResolvedValue(mockTriples)
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: { uri1: new Set([mockTriples[0]]) },
        conceptURIs: ['uri1']
      })

      toSkosJson.mockReturnValue({
        '@rdf:about': 'uri1',
        'skos:prefLabel': 'Scheme 1 Concept'
      })

      getGcmdMetadata.mockResolvedValue({})

      const event = { pathParameters: { conceptScheme: 'scheme1' } }
      const result = await getConcepts(event)

      expect(getFilteredTriples).toHaveBeenCalledWith({
        conceptScheme: 'scheme1',
        pattern: undefined,
        version: 'published'
      })

      expect(result.body).toContain('<skos:Concept rdf:about="uri1">')
      expect(result.body).not.toContain('<skos:Concept rdf:about="uri2">')
    })

    test('returns concepts by both pattern and concept scheme', async () => {
      const mockTriples = [
        {
          s: { value: 'uri1' },
          p: { value: 'inScheme' },
          o: { value: 'scheme1' }
        },
        {
          s: { value: 'uri1' },
          p: { value: 'prefLabel' },
          o: { value: 'matching pattern' }
        },
        {
          s: { value: 'uri2' },
          p: { value: 'inScheme' },
          o: { value: 'scheme2' }
        }
      ]
      getFilteredTriples.mockResolvedValue(mockTriples)
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: { uri1: new Set([mockTriples[0], mockTriples[1]]) },
        conceptURIs: ['uri1']
      })

      toSkosJson.mockReturnValue({
        '@rdf:about': 'uri1',
        'skos:prefLabel': 'Matching Concept in Scheme 1'
      })

      getGcmdMetadata.mockResolvedValue({})

      const event = {
        pathParameters: {
          conceptScheme: 'scheme1',
          pattern: 'matching'
        }
      }
      const result = await getConcepts(event)

      expect(getFilteredTriples).toHaveBeenCalledWith({
        conceptScheme: 'scheme1',
        pattern: 'matching',
        version: 'published'
      })

      expect(result.body).toContain('<skos:Concept rdf:about="uri1">')
      expect(result.body).not.toContain('<skos:Concept rdf:about="uri2">')
    })

    test('returns root concepts', async () => {
      const mockRootTriples = [
        {
          s: { value: 'rootUri1' },
          p: { value: 'p1' },
          o: { value: 'o1' }
        },
        {
          s: { value: 'rootUri2' },
          p: { value: 'p2' },
          o: { value: 'o2' }
        }
      ]
      const mockProcessedTriples = {
        bNodeMap: {},
        nodes: {
          rootUri1: new Set([mockRootTriples[0]]),
          rootUri2: new Set([mockRootTriples[1]])
        },
        conceptURIs: ['rootUri1', 'rootUri2']
      }
      getRootConcepts.mockResolvedValue(mockRootTriples)
      processTriples.mockReturnValue(mockProcessedTriples)
      toSkosJson.mockImplementation((uri) => ({
        '@rdf:about': uri,
        'skos:prefLabel': `Root Concept ${uri}`
      }))

      getGcmdMetadata.mockResolvedValue({ 'gcmd:keywordVersion': { _text: '1.0' } })

      const event = { path: '/concepts/root' }
      const result = await getConcepts(event)

      expect(getRootConcepts).toHaveBeenCalled()
      expect(getFilteredTriples).not.toHaveBeenCalled()
      expect(result.body).toContain('<rdf:RDF')
      expect(result.body).toContain('<skos:Concept rdf:about="rootUri1">')
      expect(result.body).toContain('<skos:Concept rdf:about="rootUri2">')
      expect(result.body).toContain('<skos:prefLabel>Root Concept rootUri1</skos:prefLabel>')
      expect(result.body).toContain('<skos:prefLabel>Root Concept rootUri2</skos:prefLabel>')
    })

    describe('when paging', () => {
      test('handles pagination correctly for different page sizes', async () => {
        const mockTriples = Array(100).fill().map((_, i) => ({
          s: { value: `uri${i}` },
          p: { value: 'p1' },
          o: { value: 'o1' }
        }))
        const mockProcessedTriples = {
          bNodeMap: {},
          nodes: Object.fromEntries(mockTriples.map((t) => [t.s.value, new Set([t])])),
          conceptURIs: mockTriples.map((t) => t.s.value)
        }

        getFilteredTriples.mockResolvedValue(mockTriples)
        processTriples.mockReturnValue(mockProcessedTriples)
        toSkosJson.mockImplementation((uri) => ({
          '@rdf:about': uri,
          'skos:prefLabel': { _text: `Concept ${uri}` }
        }))

        getGcmdMetadata.mockResolvedValue({})

        const testCases = [
          {
            pageNum: '1',
            pageSize: '10',
            expectedConceptCount: 10,
            expectedTotalPages: '10'
          },
          {
            pageNum: '2',
            pageSize: '25',
            expectedConceptCount: 25,
            expectedTotalPages: '4'
          },
          {
            pageNum: '2',
            pageSize: '50',
            expectedConceptCount: 50,
            expectedTotalPages: '2'
          }
        ]

        await Promise.all(testCases.map(async ({
          pageNum, pageSize, expectedConceptCount, expectedTotalPages
        }) => {
          const event = {
            queryStringParameters: {
              page_num: pageNum,
              page_size: pageSize
            }
          }

          const result = await getConcepts(event)

          expect(result.headers['X-Total-Count']).toBe('100')
          expect(result.headers['X-Page-Number']).toBe(pageNum)
          expect(result.headers['X-Page-Size']).toBe(pageSize)
          expect(result.headers['X-Total-Pages']).toBe(expectedTotalPages)

          const conceptMatches = result.body.match(/<skos:Concept/g) || []
          expect(conceptMatches.length).toBe(expectedConceptCount)

          // Check that the correct range of concepts is included
          const startIndex = (parseInt(pageNum, 10) - 1) * parseInt(pageSize, 10)
          const endIndex = Math.min(startIndex + parseInt(pageSize, 10), 100)
          const expectedConcepts = Array.from(
            { length: endIndex - startIndex },
            (_, i) => i + startIndex
          )

          expectedConcepts.forEach((i) => {
            expect(result.body).toContain(`<skos:Concept rdf:about="uri${i}">`)
            expect(result.body).toContain(`<skos:prefLabel>Concept uri${i}</skos:prefLabel>`)
          })

          expect(getGcmdMetadata).toHaveBeenCalledWith({
            pageNum: parseInt(pageNum, 10),
            pageSize: parseInt(pageSize, 10),
            gcmdHits: 100,
            version: 'published'
          })
        }))
      })
    })
  })

  describe('when returning JSON format', () => {
    test('returns concepts in JSON format when requested', async () => {
      const mockTriples = [
        {
          s: { value: 'http://example.com/concept1' },
          p: { value: 'p1' },
          o: { value: 'o1' }
        },
        {
          s: { value: 'http://example.com/concept2' },
          p: { value: 'p2' },
          o: { value: 'o2' }
        }
      ]
      getFilteredTriples.mockResolvedValue(mockTriples)
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {
          'http://example.com/concept1': new Set([mockTriples[0]]),
          'http://example.com/concept2': new Set([mockTriples[1]])
        },
        conceptURIs: ['http://example.com/concept1', 'http://example.com/concept2']
      })

      toSkosJson.mockImplementation((uri) => ({
        '@rdf:about': uri,
        'skos:prefLabel': { _text: `Concept ${uri.split('/').pop()}` },
        'skos:definition': { _text: `Definition for ${uri.split('/').pop()}` },
        'gcmd:reference': { '@gcmd:text': `Reference for ${uri.split('/').pop()}` }
      }))

      createPrefLabelMap.mockResolvedValue(new Map([
        ['http://example.com/concept1', 'Concept 1'],
        ['http://example.com/concept2', 'Concept 2']
      ]))

      createConceptSchemeMap.mockResolvedValue(new Map([
        ['SN', 'Long Name']
      ]))

      createConceptToConceptSchemeShortNameMap.mockResolvedValue(new Map([
        ['http://example.com/concept1', 'SN'],
        ['http://example.com/concept2', 'SN']
      ]))

      toLegacyJSON.mockImplementation((concept) => ({
        uuid: concept['@rdf:about'],
        // eslint-disable-next-line no-underscore-dangle
        prefLabel: concept['skos:prefLabel']._text,
        scheme: {
          shortName: 'SN',
          longName: 'Long Name'
        },
        definitions: [{
          // eslint-disable-next-line no-underscore-dangle
          text: concept['skos:definition']._text,
          reference: concept['gcmd:reference']['@gcmd:text']
        }]
      }))

      const event = {
        queryStringParameters: {
          format: 'json'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(200)
      expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8')

      const body = JSON.parse(result.body)
      expect(body).toHaveProperty('hits', 2)
      expect(body).toHaveProperty('page_num', 1)
      expect(body).toHaveProperty('page_size', 2000)
      expect(body).toHaveProperty('concepts')
      expect(body.concepts).toHaveLength(2)
      expect(body.concepts[0]).toEqual({
        uuid: 'http://example.com/concept1',
        prefLabel: 'Concept concept1',
        scheme: {
          shortName: 'SN',
          longName: 'Long Name'
        },
        definitions: [{
          text: 'Definition for concept1',
          reference: 'Reference for concept1'
        }]
      })
    })
  })

  describe('when returning XML format', () => {
    test('returns concepts in XML format when requested', async () => {
      const mockTriples = [
        {
          s: { value: 'http://example.com/concept1' },
          p: { value: 'p1' },
          o: { value: 'o1' }
        },
        {
          s: { value: 'http://example.com/concept2' },
          p: { value: 'p2' },
          o: { value: 'o2' }
        }
      ]
      getFilteredTriples.mockResolvedValue(mockTriples)
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {
          'http://example.com/concept1': new Set([mockTriples[0]]),
          'http://example.com/concept2': new Set([mockTriples[1]])
        },
        conceptURIs: ['http://example.com/concept1', 'http://example.com/concept2']
      })

      toSkosJson.mockImplementation((uri) => ({
        '@rdf:about': uri,
        'skos:prefLabel': { _text: `Concept ${uri.split('/').pop()}` }
      }))

      createConceptToConceptSchemeShortNameMap.mockResolvedValue(new Map([
        ['http://example.com/concept1', 'SN1'],
        ['http://example.com/concept2', 'SN2']
      ]))

      const event = {
        queryStringParameters: {
          format: 'xml'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(200)
      expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')

      expect(result.body).toContain('<concepts xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
      expect(result.body).toContain('<conceptBrief conceptScheme="SN1" prefLabel="Concept concept1" uuid="http://example.com/concept1"/>')
      expect(result.body).toContain('<conceptBrief conceptScheme="SN2" prefLabel="Concept concept2" uuid="http://example.com/concept2"/>')
    })
  })

  describe('when unsuccessful', () => {
    test('returns 400 status code for invalid page_size parameter', async () => {
      const event = {
        queryStringParameters: {
          page_size: '3000'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Invalid page_size parameter. Must be between 1 and 2000.'
      })
    })

    test('returns 500 status code and error message when an exception is thrown', async () => {
      const mockError = new Error('Test error')
      getFilteredTriples.mockRejectedValue(mockError)

      const event = {} // Empty event object
      const result = await getConcepts(event)

      expect(result).toEqual({
        headers: { 'X-Custom-Header': 'value' },
        statusCode: 500,
        body: JSON.stringify({
          error: mockError.toString()
        })
      })

      expect(console.error).toHaveBeenCalledWith(`Error retrieving concepts, error=${mockError.toString()}`)
    })
  })

  describe('edge cases', () => {
    test('handles empty result set', async () => {
      getFilteredTriples.mockResolvedValue([])
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {},
        conceptURIs: []
      })

      getGcmdMetadata.mockResolvedValue({})

      const event = {}
      const result = await getConcepts(event)

      expect(result.headers['X-Total-Count']).toBe('0')
      expect(result.headers['X-Page-Number']).toBe('1')
      expect(result.headers['X-Page-Size']).toBe('2000')
      expect(result.headers['X-Total-Pages']).toBe('0')
      expect(result.body).not.toContain('<skos:Concept')
    })
  })

  describe('parameter validation', () => {
    test('returns 400 for negative page number', async () => {
      const event = {
        queryStringParameters: {
          page_num: '-1'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Invalid page_num parameter'
      })
    })

    test('returns 400 for non-integer page number', async () => {
      const event = {
        queryStringParameters: {
          page_num: '1.5'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Invalid page_num parameter'
      })
    })

    test('returns 400 for page size less than 1', async () => {
      const event = {
        queryStringParameters: {
          page_size: '0'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Invalid page_size parameter. Must be between 1 and 2000.'
      })
    })

    test('returns 400 for non-integer page size', async () => {
      const event = {
        queryStringParameters: {
          page_size: '1.5'
        }
      }
      const result = await getConcepts(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Invalid page_size parameter. Must be between 1 and 2000.'
      })
    })
  })

  describe('error handling', () => {
    test('logs error message when exception occurs', async () => {
      const mockError = new Error('Test error')
      getFilteredTriples.mockRejectedValue(mockError)

      const consoleSpy = vi.spyOn(console, 'error')

      await getConcepts({})

      expect(consoleSpy).toHaveBeenCalledWith(`Error retrieving concepts, error=${mockError.toString()}`)
    })
  })
})
