import {
  describe,
  it,
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

// Mock the specified dependencies
vi.mock('../../utils/getFilteredTriples')
vi.mock('../../utils/toSkosJson')
vi.mock('../../utils/processTriples')
vi.mock('../../utils/getConfig')
vi.mock('../../utils/getGcmdMetadata')

describe('getConcepts', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  test('should successfully retrieve concepts and return RDF/XML', async () => {
    const mockTriples = [{
      s: { value: 'uri1' },
      p: { value: 'p1' },
      o: { value: 'o1' }
    }]
    const mockProcessedTriples = {
      bNodeMap: {},
      nodes: {
        uri1: new Set([{
          s: { value: 'uri1' },
          p: { value: 'p1' },
          o: { value: 'o1' }
        }])
      },
      conceptURIs: ['uri1']
    }
    const mockConcept = {
      '@rdf:about': 'uri1',
      'skos:prefLabel': 'Concept 1'
    }
    const mockGcmdMetadata = { 'gcmd:keywordVersion': { _text: '1.0' } }

    getFilteredTriples.mockResolvedValue(mockTriples)
    processTriples.mockReturnValue(mockProcessedTriples)
    toSkosJson.mockReturnValue(mockConcept)
    getGcmdMetadata.mockResolvedValue(mockGcmdMetadata)

    const result = await getConcepts()

    // Check if headers include both the default headers and the Content-Type
    expect(result.headers).toEqual({
      ...mockDefaultHeaders,
      'Content-Type': 'application/xml; charset=utf-8'
    })

    expect(result.body).toContain('<rdf:RDF')
    expect(result.body).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
    expect(result.body).toContain('xmlns:skos="http://www.w3.org/2004/02/skos/core#"')
    expect(result.body).toContain('xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"')
    expect(result.body).toContain('<skos:Concept')
    expect(result.body).toContain('<gcmd:gcmd')
    expect(result.body).toContain('<gcmd:keywordVersion>1.0</gcmd:keywordVersion>')
  })

  test('should limit the number of concepts to 2000', async () => {
    const mockTriples = [{
      s: { value: 'uri1' },
      p: { value: 'p1' },
      o: { value: 'o1' }
    }]
    const mockProcessedTriples = {
      bNodeMap: {},
      nodes: {},
      conceptURIs: Array(3000).fill().map((_, i) => `uri${i}`)
    }
    // Populate nodes with mock data for each URI
    mockProcessedTriples.conceptURIs.forEach((uri) => {
      mockProcessedTriples.nodes[uri] = new Set([{
        s: { value: uri },
        p: { value: 'p1' },
        o: { value: 'o1' }
      }])
    })

    getFilteredTriples.mockResolvedValue(mockTriples)
    processTriples.mockReturnValue(mockProcessedTriples)
    toSkosJson.mockReturnValue({})
    getGcmdMetadata.mockResolvedValue({})

    const result = await getConcepts()

    expect(toSkosJson).toHaveBeenCalledTimes(2000)
    expect(result.body).toContain('<rdf:RDF')
    // Check that we have exactly 2000 <skos:Concept> elements
    const conceptMatches = result.body.match(/<skos:Concept/g) || []
    expect(conceptMatches.length).toBe(2000)
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

  test('should call getGcmdMetadata with the correct number of hits', async () => {
    const mockProcessedTriples = {
      bNodeMap: {},
      nodes: {},
      conceptURIs: Array(3000).fill().map((_, i) => `uri${i}`)
    }
    // Populate nodes with mock data for each URI
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

    // The function processes 2000 concepts and passes the remaining count to getGcmdMetadata
    expect(getGcmdMetadata).toHaveBeenCalledWith({ gcmdHits: 3000 }) // 3000 total - 2000 processed = 1000
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
    expect(getGcmdMetadata).toHaveBeenCalledWith({ gcmdHits: 3000 }) // 3000 total - 2000 processed
  })
})
