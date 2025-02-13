import {
  describe,
  expect,
  vi,
  beforeEach,
  afterEach
} from 'vitest'
import getSkosConcept from '../getSkosConcept'
import { sparqlRequest } from '../sparqlRequest'
import toSkosJson from '../toSkosJson'

// Mock the dependencies
vi.mock('../sparqlRequest')
vi.mock('../toSkosJson')

describe('getSkosConcept', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  const mockConceptIRI = 'http://example.com/concept/123'
  const mockSparqlResponse = {
    ok: true,
    json: vi.fn()
  }
  const mockSparqlResults = {
    results: {
      bindings: [
        {
          s: { value: mockConceptIRI },
          p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
          o: { value: 'Test Concept' }
        }
      ]
    }
  }
  const mockSkosJson = {
    '@rdf:about': '123',
    'skos:prefLabel': 'Test Concept'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sparqlRequest.mockResolvedValue(mockSparqlResponse)
    mockSparqlResponse.json.mockResolvedValue(mockSparqlResults)
    toSkosJson.mockReturnValue(mockSkosJson)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('should fetch and process SKOS concept data successfully', async () => {
    const result = await getSkosConcept(mockConceptIRI)

    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: expect.stringContaining(mockConceptIRI)
    })

    expect(mockSparqlResponse.json).toHaveBeenCalled()
    expect(toSkosJson).toHaveBeenCalledWith(mockConceptIRI, mockSparqlResults.results.bindings)
    expect(result).toEqual(mockSkosJson)
  })

  test('should throw an error if the HTTP request fails', async () => {
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 404
    })

    await expect(getSkosConcept(mockConceptIRI)).rejects.toThrow('HTTP error! status: 404')
  })

  test('should throw an error if no results are found', async () => {
    mockSparqlResponse.json.mockResolvedValue({ results: { bindings: [] } })

    await expect(getSkosConcept(mockConceptIRI)).rejects.toThrow('No results found for concept:')
  })

  test('should throw an error if sparqlRequest fails', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getSkosConcept(mockConceptIRI)).rejects.toThrow('Network error')
  })

  test('should handle errors during JSON parsing', async () => {
    mockSparqlResponse.json.mockRejectedValue(new Error('Invalid JSON'))

    await expect(getSkosConcept(mockConceptIRI)).rejects.toThrow('Invalid JSON')
  })
})
