/* eslint-disable no-underscore-dangle */
// /* eslint-disable no-underscore-dangle */
import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcepts } from '@/getConcepts/handler'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import { createCsvForScheme } from '@/shared/createCsvForScheme'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getRootConcepts } from '@/shared/getRootConcepts'
import { processTriples } from '@/shared/processTriples'
import toLegacyJSON from '@/shared/toLegacyJSON'
import { toSkosJson } from '@/shared/toSkosJson'

// Mock the specified dependencies
vi.mock('@/shared/createCsvForScheme', () => ({
  createCsvForScheme: vi.fn()
}))

vi.mock('@/shared/getFilteredTriples')
vi.mock('@/shared/toSkosJson')
vi.mock('@/shared/processTriples')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getGcmdMetadata')
vi.mock('@/shared/getRootConcepts')
vi.mock('@/shared/createPrefLabelMap')
vi.mock('@/shared/createConceptSchemeMap')
vi.mock('@/shared/toLegacyJSON')

describe('getConcepts', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    createCsvForScheme.mockReset()
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
        'skos:prefLabel': 'Matching Concept'
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
            expectedConcepts: 10,
            expectedTotalPages: '10'
          },
          {
            pageNum: '2',
            pageSize: '25',
            expectedConcepts: 25,
            expectedTotalPages: '4'
          },
          {
            pageNum: '2',
            pageSize: '50',
            expectedConcepts: 50,
            expectedTotalPages: '2'
          }
        ]

        // eslint-disable-next-line no-restricted-syntax
        for (const {
          pageNum, pageSize, expectedConcepts, expectedTotalPages
        } of testCases) {
          const event = {
            queryStringParameters: {
              page_num: pageNum,
              page_size: pageSize
            }
          }

          // eslint-disable-next-line no-await-in-loop
          const result = await getConcepts(event)

          expect(result.headers['X-Total-Count']).toBe('100')
          expect(result.headers['X-Page-Number']).toBe(pageNum)
          expect(result.headers['X-Page-Size']).toBe(pageSize)
          expect(result.headers['X-Total-Pages']).toBe(expectedTotalPages)

          const conceptMatches = result.body.match(/<skos:Concept/g) || []
          expect(conceptMatches.length).toBe(expectedConcepts)

          // Check that the correct range of concepts is included
          const startIndex = (parseInt(pageNum, 10) - 1) * parseInt(pageSize, 10)
          const endIndex = Math.min(startIndex + parseInt(pageSize, 10), 100)
          for (let i = startIndex; i < endIndex; i += 1) {
            expect(result.body).toContain(`<skos:Concept rdf:about="uri${i}">`)
            expect(result.body).toContain(`<skos:prefLabel>Concept uri${i}</skos:prefLabel>`)
          }

          expect(getGcmdMetadata).toHaveBeenCalledWith({
            pageNum: parseInt(pageNum, 10),
            pageSize: parseInt(pageSize, 10),
            gcmdHits: 100,
            version: 'published'
          })
        }
      })

      test('returns last page correctly when not full', async () => {
        const mockTriples = Array(95).fill().map((_, i) => ({
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
        toSkosJson.mockImplementation((uri) => ({ '@rdf:about': uri }))
        getGcmdMetadata.mockResolvedValue({})

        const event = {
          queryStringParameters: {
            page_num: '4',
            page_size: '30'
          }
        }

        const result = await getConcepts(event)

        expect(result.headers['X-Total-Count']).toBe('95')
        expect(result.headers['X-Page-Number']).toBe('4')
        expect(result.headers['X-Page-Size']).toBe('30')
        expect(result.headers['X-Total-Pages']).toBe('4')

        const conceptMatches = result.body.match(/<skos:Concept/g) || []
        expect(conceptMatches.length).toBe(5) // Only 5 concepts on the last page

        expect(getGcmdMetadata).toHaveBeenCalledWith({
          pageNum: 4,
          pageSize: 30,
          gcmdHits: 95,
          version: 'published'
        })
      })

      test('uses default pagination when no parameters are provided', async () => {
        const mockTriples = Array(2500).fill().map((_, i) => ({
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
        toSkosJson.mockImplementation((uri) => ({ '@rdf:about': uri }))
        getGcmdMetadata.mockResolvedValue({})

        const event = {} // No query parameters

        const result = await getConcepts(event)

        expect(result.headers['X-Total-Count']).toBe('2500')
        expect(result.headers['X-Page-Number']).toBe('1')
        expect(result.headers['X-Page-Size']).toBe('2000')
        expect(result.headers['X-Total-Pages']).toBe('2')

        const conceptMatches = result.body.match(/<skos:Concept/g) || []
        expect(conceptMatches.length).toBe(2000) // Default page size

        expect(getGcmdMetadata).toHaveBeenCalledWith({
          pageNum: 1,
          pageSize: 2000,
          gcmdHits: 2500,
          version: 'published'
        })
      })

      test('handles edge cases in pagination', async () => {
        const mockTriples = Array(10).fill().map((_, i) => ({
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
        toSkosJson.mockImplementation((uri) => ({ '@rdf:about': uri }))
        getGcmdMetadata.mockResolvedValue({})

        // Test case 1: Page size larger than total concepts
        const event1 = {
          queryStringParameters: {
            page_num: '1',
            page_size: '20'
          }
        }
        const result1 = await getConcepts(event1)
        expect(result1.headers['X-Total-Count']).toBe('10')
        expect(result1.headers['X-Page-Number']).toBe('1')
        expect(result1.headers['X-Page-Size']).toBe('20')
        expect(result1.headers['X-Total-Pages']).toBe('1')
        expect(result1.body.match(/<skos:Concept/g).length).toBe(10)

        // Test case 2: Requesting a page beyond available data
        const event2 = {
          queryStringParameters: {
            page_num: '3',
            page_size: '5'
          }
        }
        const result2 = await getConcepts(event2)
        expect(result2.headers['X-Total-Count']).toBe('10')
        expect(result2.headers['X-Page-Number']).toBe('3')
        expect(result2.headers['X-Page-Size']).toBe('5')
        expect(result2.headers['X-Total-Pages']).toBe('2')
        expect(result2.body.match(/<skos:Concept/g)).toBeNull() // No concepts on this page

        // Test case 3: Minimum page size
        const event3 = {
          queryStringParameters: {
            page_num: '1',
            page_size: '1'
          }
        }
        const result3 = await getConcepts(event3)
        expect(result3.headers['X-Total-Count']).toBe('10')
        expect(result3.headers['X-Page-Number']).toBe('1')
        expect(result3.headers['X-Page-Size']).toBe('1')
        expect(result3.headers['X-Total-Pages']).toBe('10')
        expect(result3.body.match(/<skos:Concept/g).length).toBe(1)

        // Test case 4: Maximum page size
        const event4 = {
          queryStringParameters: {
            page_num: '1',
            page_size: '2000'
          }
        }
        const result4 = await getConcepts(event4)
        expect(result4.headers['X-Total-Count']).toBe('10')
        expect(result4.headers['X-Page-Number']).toBe('1')
        expect(result4.headers['X-Page-Size']).toBe('2000')
        expect(result4.headers['X-Total-Pages']).toBe('1')
        expect(result4.body.match(/<skos:Concept/g).length).toBe(10)

        // Test case 5: Last page with remaining concepts
        const event5 = {
          queryStringParameters: {
            page_num: '2',
            page_size: '7'
          }
        }
        const result5 = await getConcepts(event5)
        expect(result5.headers['X-Total-Count']).toBe('10')
        expect(result5.headers['X-Page-Number']).toBe('2')
        expect(result5.headers['X-Page-Size']).toBe('7')
        expect(result5.headers['X-Total-Pages']).toBe('2')
        expect(result5.body.match(/<skos:Concept/g).length).toBe(3)

        // Test case 6: Page number less than 1
        const event6 = {
          queryStringParameters: {
            page_num: '0',
            page_size: '5'
          }
        }
        const result6 = await getConcepts(event6)
        expect(result6.statusCode).toBe(400)
        expect(JSON.parse(result6.body)).toEqual({
          error: 'Invalid page_num parameter'
        })

        // Test case 7: Non-integer page number
        const event7 = {
          queryStringParameters: {
            page_num: '1.5',
            page_size: '5'
          }
        }
        const result7 = await getConcepts(event7)
        expect(result7.statusCode).toBe(400)
        expect(JSON.parse(result7.body)).toEqual({
          error: 'Invalid page_num parameter'
        })

        // Test case 8: Empty result set
        const emptyTriples = []
        const emptyProcessedTriples = {
          bNodeMap: {},
          nodes: {},
          conceptURIs: []
        }
        getFilteredTriples.mockResolvedValue(emptyTriples)
        processTriples.mockReturnValue(emptyProcessedTriples)

        const event8 = {
          queryStringParameters: {
            page_num: '1',
            page_size: '10'
          }
        }
        const result8 = await getConcepts(event8)
        expect(result8.headers['X-Total-Count']).toBe('0')
        expect(result8.headers['X-Page-Number']).toBe('1')
        expect(result8.headers['X-Page-Size']).toBe('10')
        expect(result8.headers['X-Total-Pages']).toBe('0')
        expect(result8.body.match(/<skos:Concept/g)).toBeNull()
      })

      test('returns 400 for invalid pagination parameters', async () => {
        const eventInvalidPageNum = {
          queryStringParameters: {
            page_num: 'invalid',
            page_size: '20'
          }
        }

        const resultInvalidPageNum = await getConcepts(eventInvalidPageNum)
        expect(resultInvalidPageNum.statusCode).toBe(400)
        expect(JSON.parse(resultInvalidPageNum.body)).toEqual({
          error: 'Invalid page_num parameter'
        })

        const eventInvalidPageSize = {
          queryStringParameters: {
            page_num: '1',
            page_size: '3000'
          }
        }

        const resultInvalidPageSize = await getConcepts(eventInvalidPageSize)
        expect(resultInvalidPageSize.statusCode).toBe(400)
        expect(JSON.parse(resultInvalidPageSize.body)).toEqual({
          error: 'Invalid page_size parameter. Must be between 1 and 2000.'
        })
      })

      test('handles requests for pages beyond available data', async () => {
        const mockTriples = Array(50).fill().map((_, i) => ({
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
        toSkosJson.mockImplementation((uri) => ({ '@rdf:about': uri }))
        getGcmdMetadata.mockResolvedValue({})

        const event = {
          queryStringParameters: {
            page_num: '3',
            page_size: '25'
          }
        }

        const result = await getConcepts(event)

        expect(result.headers['X-Total-Count']).toBe('50')
        expect(result.headers['X-Page-Number']).toBe('3')
        expect(result.headers['X-Page-Size']).toBe('25')
        expect(result.headers['X-Total-Pages']).toBe('2')

        const conceptMatches = result.body.match(/<skos:Concept/g) || []
        expect(conceptMatches.length).toBe(0) // No concepts on this page

        expect(getGcmdMetadata).toHaveBeenCalledWith({
          pageNum: 3,
          pageSize: 25,
          gcmdHits: 50,
          version: 'published'
        })
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

      toLegacyJSON.mockImplementation((concept) => ({
        uuid: concept['@rdf:about'],
        prefLabel: concept['skos:prefLabel']._text,
        scheme: {
          shortName: 'SN',
          longName: 'Long Name'
        },
        definitions: [{
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
})

describe('when unsuccessful', () => {
  test('returns 400 status code for invalid page_num parameter', async () => {
    const event = {
      queryStringParameters: {
        page_num: 'invalid'
      }
    }
    const result = await getConcepts(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Invalid page_num parameter'
    })
  })

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

describe('format handling', () => {
  test('returns RDF format by default', async () => {
    getFilteredTriples.mockResolvedValue([])
    processTriples.mockReturnValue({
      bNodeMap: {},
      nodes: {},
      conceptURIs: []
    })

    getGcmdMetadata.mockResolvedValue({})

    const event = {}
    const result = await getConcepts(event)

    expect(result.headers['Content-Type']).toBe('application/rdf+xml; charset=utf-8')
    expect(result.body).toContain('<rdf:RDF')
  })

  test('returns JSON format when specified', async () => {
    getFilteredTriples.mockResolvedValue([])
    processTriples.mockReturnValue({
      bNodeMap: {},
      nodes: {},
      conceptURIs: []
    })

    const event = { queryStringParameters: { format: 'json' } }
    const result = await getConcepts(event)

    expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(() => JSON.parse(result.body)).not.toThrow()
  })

  test('returns CSV format when specified and conceptScheme is provided', async () => {
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
      queryStringParameters: { format: 'csv' },
      pathParameters: { conceptScheme: 'testScheme' }
    }
    const result = await getConcepts(event)

    expect(result).toEqual(mockCsvResponse)
  })
})
