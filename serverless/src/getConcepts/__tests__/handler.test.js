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
import { getTotalConceptCount } from '@/shared/getTotalConceptCount'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
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
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/operations/queries/getTotalCountQuery')
vi.mock('@/shared/getTotalConceptCount')

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
    getVersionMetadata.mockResolvedValue({ versionName: '21.0' })
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
      getTotalConceptCount.mockResolvedValue(1)

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
        pageNum: 1,
        pageSize: 2000,
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
      getTotalConceptCount.mockResolvedValue(1)

      const event = { pathParameters: { conceptScheme: 'scheme1' } }
      const result = await getConcepts(event)

      expect(getFilteredTriples).toHaveBeenCalledWith({
        conceptScheme: 'scheme1',
        pageNum: 1,
        pageSize: 2000,
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

      getTotalConceptCount.mockResolvedValue(1)
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
        pageNum: 1,
        pageSize: 2000,
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
      getTotalConceptCount.mockResolvedValue(2)
      const result = await getConcepts(event)

      expect(getRootConcepts).toHaveBeenCalled()
      expect(getFilteredTriples).not.toHaveBeenCalled()
      expect(result.body).toContain('<rdf:RDF')
      expect(result.body).toContain('<skos:Concept rdf:about="rootUri1">')
      expect(result.body).toContain('<skos:Concept rdf:about="rootUri2">')
      expect(result.body).toContain('<skos:prefLabel>Root Concept rootUri1</skos:prefLabel>')
      expect(result.body).toContain('<skos:prefLabel>Root Concept rootUri2</skos:prefLabel>')
    })
  })

  describe('when paginating', () => {
    const allMockTriples = Array(100).fill().map((_, i) => ({
      s: { value: `uri${i}` },
      p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
      o: { value: `Concept ${i}` }
    }))

    beforeEach(() => {
      vi.resetAllMocks()
      getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
      getGcmdMetadata.mockResolvedValue({})
      getTotalConceptCount.mockResolvedValue(100)
      processTriples.mockImplementation((triples) => ({
        bNodeMap: {},
        nodes: Object.fromEntries(triples.map((t) => [t.s.value, new Set([t])])),
        conceptURIs: triples.map((t) => t.s.value)
      }))

      toSkosJson.mockImplementation((uri) => ({
        '@rdf:about': uri,
        'skos:prefLabel': { _text: `Concept ${uri.split('uri')[1]}` }
      }))
    })

    test('handles basic pagination case', async () => {
      const event = {
        queryStringParameters: {
          page_num: '1',
          page_size: '10',
          format: 'rdf'
        }
      }

      getFilteredTriples.mockResolvedValue(allMockTriples.slice(0, 10))

      const result = await getConcepts(event)

      expect(result.headers['X-Total-Count']).toBe('100')
      expect(result.headers['X-Page-Number']).toBe('1')
      expect(result.headers['X-Page-Size']).toBe('10')
      expect(result.headers['X-Total-Pages']).toBe('10')

      const conceptMatches = result.body.match(/<skos:Concept/g) || []
      expect(conceptMatches.length).toBe(10)

      for (let i = 0; i < 10; i += 1) {
        expect(result.body).toContain(`<skos:Concept rdf:about="uri${i}">`)
        expect(result.body).toContain(`<skos:prefLabel>Concept ${i}</skos:prefLabel>`)
      }

      expect(getFilteredTriples).toHaveBeenCalledWith({
        conceptScheme: undefined,
        pattern: undefined,
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })
    })

    it('handles pagination for second page', async () => {
      const event = {
        queryStringParameters: {
          page_num: '2',
          page_size: '25',
          format: 'rdf'
        }
      }

      getFilteredTriples.mockResolvedValue(allMockTriples.slice(25, 50))

      const result = await getConcepts(event)

      expect(result.headers['X-Total-Count']).toBe('100')
      expect(result.headers['X-Page-Number']).toBe('2')
      expect(result.headers['X-Page-Size']).toBe('25')
      expect(result.headers['X-Total-Pages']).toBe('4')

      const conceptMatches = result.body.match(/<skos:Concept/g) || []
      expect(conceptMatches.length).toBe(25)

      for (let i = 25; i < 50; i += 1) {
        expect(result.body).toContain(`<skos:Concept rdf:about="uri${i}">`)
        expect(result.body).toContain(`<skos:prefLabel>Concept ${i}</skos:prefLabel>`)
      }

      expect(getFilteredTriples).toHaveBeenCalledWith({
        conceptScheme: undefined,
        pattern: undefined,
        version: 'published',
        pageNum: 2,
        pageSize: 25
      })
    })

    it('handles pagination for last page with fewer items', async () => {
      const event = {
        queryStringParameters: {
          page_num: '4',
          page_size: '30',
          format: 'rdf'
        }
      }

      getFilteredTriples.mockResolvedValue(allMockTriples.slice(90, 100))

      const result = await getConcepts(event)

      expect(result.headers['X-Total-Count']).toBe('100')
      expect(result.headers['X-Page-Number']).toBe('4')
      expect(result.headers['X-Page-Size']).toBe('30')
      expect(result.headers['X-Total-Pages']).toBe('4')

      const conceptMatches = result.body.match(/<skos:Concept/g) || []
      expect(conceptMatches.length).toBe(10)

      for (let i = 90; i < 100; i += 1) {
        expect(result.body).toContain(`<skos:Concept rdf:about="uri${i}">`)
        expect(result.body).toContain(`<skos:prefLabel>Concept ${i}</skos:prefLabel>`)
      }

      expect(getFilteredTriples).toHaveBeenCalledWith({
        conceptScheme: undefined,
        pattern: undefined,
        version: 'published',
        pageNum: 4,
        pageSize: 30
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

      getTotalConceptCount.mockResolvedValue(2)

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

      getTotalConceptCount.mockResolvedValue(2)

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
      getTotalConceptCount.mockResolvedValue(0)

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
