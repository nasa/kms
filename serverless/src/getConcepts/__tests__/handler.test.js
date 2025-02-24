import {
  describe,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getConcepts from '../handler'
import getFilteredTriples from '../../utils/getFilteredTriples'
import toSkosJson from '../../utils/toSkosJson'
import processTriples from '../../utils/processTriples'
import { getApplicationConfig } from '../../utils/getConfig'
import getGcmdMetadata from '../../utils/getGcmdMetadata'
import getRootConcepts from '../../utils/getRootConcepts'
import getCsvMetadata from '../../utils/getCsvMetadata'
import getCsvHeaders from '../../utils/getCsvHeaders'
import getCsvPaths from '../../utils/getCsvPaths'
import createCsv from '../../utils/createCsv'

// Mock the specified dependencies
vi.mock('../../utils/getFilteredTriples')
vi.mock('../../utils/toSkosJson')
vi.mock('../../utils/processTriples')
vi.mock('../../utils/getConfig')
vi.mock('../../utils/getGcmdMetadata')
vi.mock('../../utils/getRootConcepts')
vi.mock('../../utils/getCsvPaths', () => ({ default: vi.fn() }))
vi.mock('../../utils/createCsv', () => ({ default: vi.fn() }))
vi.mock('../../utils/getCsvHeaders', () => ({ default: vi.fn() }))
vi.mock('../../utils/getCsvMetadata', () => ({ default: vi.fn() }))

describe('getConcepts', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  it('should return CSV when format is csv', async () => {
    // Mock the necessary functions
    vi.mocked(getApplicationConfig).mockReturnValue({
      defaultResponseHeaders: { 'Content-Type': 'text/csv' }
    })

    vi.mocked(getCsvMetadata).mockResolvedValue('mockCsvMetadata')
    vi.mocked(getCsvHeaders).mockResolvedValue(['header1', 'header2'])
    vi.mocked(getCsvPaths).mockResolvedValue(['path1', 'path2'])
    vi.mocked(createCsv).mockResolvedValue('mockCsvContent')

    const event = {
      queryStringParameters: {
        format: 'csv',
        scheme: 'testScheme'
      }
    }

    const result = await getConcepts(event)

    expect(result).toEqual({
      body: 'mockCsvContent',
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=testScheme.csv'
      }
    })

    expect(getCsvMetadata).toHaveBeenCalledWith('testScheme')
    expect(getCsvHeaders).toHaveBeenCalledWith('testScheme')
    expect(getCsvPaths).toHaveBeenCalledWith('testScheme', 2)
    expect(createCsv).toHaveBeenCalledWith('mockCsvMetadata', ['header1', 'header2'], ['path1', 'path2'])
  })

  describe('Basic functionality', () => {
    test('should successfully retrieve concepts and return RDF/XML with pagination', async () => {
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
        'skos:prefLabel': `Concept ${uri}`
      }))

      getGcmdMetadata.mockResolvedValue({ 'gcmd:keywordVersion': { _text: '1.0' } })

      const event = {
        queryStringParameters: {
          page_num: '2',
          page_size: '20'
        }
      }

      const result = await getConcepts(event)

      expect(result.headers).toEqual({
        ...mockDefaultHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Total-Count': '100',
        'X-Page-Number': '2',
        'X-Page-Size': '20',
        'X-Total-Pages': '5'
      })

      expect(result.body).toContain('<rdf:RDF')
      expect(result.body).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
      expect(result.body).toContain('xmlns:skos="http://www.w3.org/2004/02/skos/core#"')
      expect(result.body).toContain('xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"')
      expect(result.body).toContain('<skos:Concept')
      expect(result.body).toContain('<gcmd:gcmd')
      expect(result.body).toContain('<gcmd:keywordVersion>1.0</gcmd:keywordVersion>')

      expect(toSkosJson).toHaveBeenCalledTimes(20)

      const conceptMatches = result.body.match(/<skos:Concept/g) || []
      expect(conceptMatches.length).toBe(20)

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 2,
        pageSize: 20,
        gcmdHits: 100
      })

      // Verify that the correct range of concepts is returned
      for (let i = 20; i < 40; i += 1) {
        expect(result.body).toContain(`<skos:Concept rdf:about="uri${i}">`)
        expect(result.body).toContain(`<skos:prefLabel>Concept uri${i}</skos:prefLabel>`)
      }
    })

    test('should handle errors and return a 500 status code', async () => {
      getFilteredTriples.mockRejectedValue(new Error('Test error'))

      const result = await getConcepts()

      expect(result.statusCode).toBe(500)
      expect(result.headers).toEqual(mockDefaultHeaders)
      expect(JSON.parse(result.body)).toEqual({
        error: expect.stringContaining('Test error')
      })
    })

    test('should call getGcmdMetadata with the correct parameters', async () => {
      const mockProcessedTriples = {
        bNodeMap: {},
        nodes: {},
        conceptURIs: Array(3000).fill().map((_, i) => `uri${i}`)
      }
      mockProcessedTriples.conceptURIs.forEach((uri) => {
        mockProcessedTriples.nodes[uri] = new Set([{
          s: { value: uri },
          p: { value: 'p1' },
          o: { value: 'o1' }
        }])
      })

      getFilteredTriples.mockResolvedValue([])
      processTriples.mockReturnValue(mockProcessedTriples)
      toSkosJson.mockReturnValue({})
      getGcmdMetadata.mockResolvedValue({})

      await getConcepts()

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 2000,
        gcmdHits: 3000
      })
    })

    test('should handle empty result from getFilteredTriples', async () => {
      getFilteredTriples.mockResolvedValue([])
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {},
        conceptURIs: []
      })

      getGcmdMetadata.mockResolvedValue({})

      const result = await getConcepts()

      expect(result.body).toContain('<rdf:RDF')
      expect(result.body).not.toContain('<skos:Concept')
    })

    test('should correctly process and include multiple concepts', async () => {
      const mockProcessedTriples = {
        bNodeMap: {},
        nodes: {
          uri1: new Set([{
            s: { value: 'uri1' },
            p: { value: 'p1' },
            o: { value: 'o1' }
          }]),
          uri2: new Set([{
            s: { value: 'uri2' },
            p: { value: 'p2' },
            o: { value: 'o2' }
          }])
        },
        conceptURIs: ['uri1', 'uri2']
      }
      processTriples.mockReturnValue(mockProcessedTriples)
      toSkosJson.mockImplementation((uri) => ({
        '@rdf:about': uri,
        'skos:prefLabel': `Concept ${uri}`
      }))

      getGcmdMetadata.mockResolvedValue({ 'gcmd:keywordVersion': { _text: '1.0' } })

      const result = await getConcepts()

      expect(result.body).toContain('<skos:Concept rdf:about="uri1">')
      expect(result.body).toContain('<skos:Concept rdf:about="uri2">')
      expect(result.body).toContain('<skos:prefLabel>Concept uri1</skos:prefLabel>')
      expect(result.body).toContain('<skos:prefLabel>Concept uri2</skos:prefLabel>')
    })

    test('should handle cases where no concepts are found', async () => {
      processTriples.mockReturnValue({
        bNodeMap: {},
        nodes: {},
        conceptURIs: []
      })

      getGcmdMetadata.mockResolvedValue({ 'gcmd:keywordVersion': { _text: '1.0' } })

      const result = await getConcepts()

      expect(result.body).toContain('<rdf:RDF')
      expect(result.body).toContain('<gcmd:gcmd>')
      expect(result.body).not.toContain('<skos:Concept')
    })

    test('should fetch root concepts when path is /concepts/root', async () => {
      const mockRootTriples = [{
        s: { value: 'rootUri1' },
        p: { value: 'p1' },
        o: { value: 'o1' }
      }]
      const mockProcessedTriples = {
        bNodeMap: {},
        nodes: {
          rootUri1: new Set([{
            s: { value: 'rootUri1' },
            p: { value: 'p1' },
            o: { value: 'o1' }
          }])
        },
        conceptURIs: ['rootUri1']
      }
      const mockConcept = {
        '@rdf:about': 'rootUri1',
        'skos:prefLabel': 'Root Concept 1'
      }
      const mockGcmdMetadata = { 'gcmd:keywordVersion': { _text: '1.0' } }

      getRootConcepts.mockResolvedValue(mockRootTriples)
      processTriples.mockReturnValue(mockProcessedTriples)
      toSkosJson.mockReturnValue(mockConcept)
      getGcmdMetadata.mockResolvedValue(mockGcmdMetadata)

      const event = { path: '/concepts/root' }
      const result = await getConcepts(event)

      expect(getRootConcepts).toHaveBeenCalled()
      expect(getFilteredTriples).not.toHaveBeenCalled()
      expect(result.body).toContain('<rdf:RDF')
      expect(result.body).toContain('<skos:Concept rdf:about="rootUri1">')
      expect(result.body).toContain('<skos:prefLabel>Root Concept 1</skos:prefLabel>')
    })
  })

  describe('Pagination', () => {
    test('should handle pagination correctly for different page sizes', async () => {
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
          gcmdHits: 100
        })
      }
    })

    test('should return last page correctly when not full', async () => {
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
        gcmdHits: 95
      })
    })

    test('should handle requests for pages beyond available data', async () => {
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
        gcmdHits: 50
      })
    })

    test('should use default pagination when no parameters are provided', async () => {
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
        gcmdHits: 2500
      })
    })

    test('should handle pagination for root concepts', async () => {
      const mockRootTriples = Array(150).fill().map((_, i) => ({
        s: { value: `rootUri${i}` },
        p: { value: 'p1' },
        o: { value: 'o1' }
      }))
      const mockProcessedTriples = {
        bNodeMap: {},
        nodes: Object.fromEntries(mockRootTriples.map((t) => [t.s.value, new Set([t])])),
        conceptURIs: mockRootTriples.map((t) => t.s.value)
      }

      getRootConcepts.mockResolvedValue(mockRootTriples)
      processTriples.mockReturnValue(mockProcessedTriples)
      toSkosJson.mockImplementation((uri) => ({
        '@rdf:about': uri,
        'skos:prefLabel': `Root Concept ${uri}`
      }))

      getGcmdMetadata.mockResolvedValue({ 'gcmd:keywordVersion': { _text: '1.0' } })

      const event = {
        path: '/concepts/root',
        queryStringParameters: {
          page_num: '2',
          page_size: '50'
        }
      }

      const result = await getConcepts(event)

      expect(result.headers['X-Total-Count']).toBe('150')
      expect(result.headers['X-Page-Number']).toBe('2')
      expect(result.headers['X-Page-Size']).toBe('50')
      expect(result.headers['X-Total-Pages']).toBe('3')

      expect(getRootConcepts).toHaveBeenCalled()
      expect(getFilteredTriples).not.toHaveBeenCalled()

      const conceptMatches = result.body.match(/<skos:Concept/g) || []
      expect(conceptMatches.length).toBe(50)

      expect(result.body).toContain('<skos:Concept rdf:about="rootUri50">')
      expect(result.body).toContain('<skos:prefLabel>Root Concept rootUri50</skos:prefLabel>')
      expect(result.body).toContain('<skos:Concept rdf:about="rootUri99">')
      expect(result.body).toContain('<skos:prefLabel>Root Concept rootUri99</skos:prefLabel>')

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 2,
        pageSize: 50,
        gcmdHits: 150
      })
    })

    test('should return 400 for invalid pagination parameters', async () => {
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

    test('should handle edge cases in pagination', async () => {
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

      // Verify that getGcmdMetadata was called with correct parameters for each case
      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 20,
        gcmdHits: 10
      })

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 3,
        pageSize: 5,
        gcmdHits: 10
      })

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 1,
        gcmdHits: 10
      })

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 2000,
        gcmdHits: 10
      })

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 2,
        pageSize: 7,
        gcmdHits: 10
      })

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 10,
        gcmdHits: 0
      })
    })
  })

  describe('Large datasets', () => {
    test('should handle large number of concepts correctly', async () => {
      const largeConceptURIs = Array(3000).fill().map((_, i) => `uri${i}`)
      const mockProcessedTriples = {
        bNodeMap: {},
        nodes: largeConceptURIs.reduce((acc, uri) => {
          acc[uri] = new Set([{
            s: { value: uri },
            p: { value: 'p1' },
            o: { value: 'o1' }
          }])

          return acc
        }, {}),
        conceptURIs: largeConceptURIs
      }
      processTriples.mockReturnValue(mockProcessedTriples)
      toSkosJson.mockImplementation((uri) => ({ '@rdf:about': uri }))
      getGcmdMetadata.mockResolvedValue({ 'gcmd:keywordVersion': { _text: '1.0' } })

      const result = await getConcepts()

      expect(toSkosJson).toHaveBeenCalledTimes(2000)
      expect(result.body.match(/<skos:Concept/g)).toHaveLength(2000)
      expect(getGcmdMetadata).toHaveBeenCalledWith({
        gcmdHits: 3000,
        pageNum: 1,
        pageSize: 2000
      })

      // Additional checks for pagination headers
      expect(result.headers['X-Total-Count']).toBe('3000')
      expect(result.headers['X-Page-Number']).toBe('1')
      expect(result.headers['X-Page-Size']).toBe('2000')
      expect(result.headers['X-Total-Pages']).toBe('2')
    })
  })
})
