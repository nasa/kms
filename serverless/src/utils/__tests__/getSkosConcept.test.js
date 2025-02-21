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
  const mockSkosJson = {
    '@rdf:about': '123',
    'skos:prefLabel': 'Test Concept'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sparqlRequest.mockResolvedValue(mockSparqlResponse)
    mockSparqlResponse.json.mockReset() // Reset the mock before each test
    toSkosJson.mockReturnValue(mockSkosJson)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('should fetch and process SKOS concept data successfully', async () => {
    // eslint-disable-next-line no-shadow
    const mockConceptIRI = 'http://example.com/concept/123'
    // eslint-disable-next-line no-shadow
    const mockSparqlResults = {
      results: {
        bindings: [
          {
            s: { value: mockConceptIRI },
            p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
          },
          {
            s: { value: mockConceptIRI },
            p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
            o: { value: 'Test Concept' }
          }
        ]
      }
    }

    mockSparqlResponse.json.mockResolvedValue(mockSparqlResults)

    const result = await getSkosConcept({ conceptIRI: mockConceptIRI })

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

    await expect(getSkosConcept({ conceptIRI: mockConceptIRI })).rejects.toThrow('HTTP error! status: 404')
  })

  test('should throw an error if no results are found', async () => {
    mockSparqlResponse.json.mockResolvedValue({ results: { bindings: [] } })

    await expect(getSkosConcept({ conceptIRI: mockConceptIRI })).rejects.toThrow('No results found for concept')
  })

  test('should throw an error if sparqlRequest fails', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getSkosConcept({ conceptIRI: mockConceptIRI })).rejects.toThrow('Network error')
  })

  test('should handle errors during JSON parsing', async () => {
    mockSparqlResponse.json.mockRejectedValue(new Error('Invalid JSON'))

    await expect(getSkosConcept({ conceptIRI: mockConceptIRI })).rejects.toThrow('Invalid JSON')
  })

  test('should generate correct query when shortName is provided', async () => {
    const mockShortName = 'TestShortName'
    const mockScheme = 'TestScheme'
    const mockConceptURI = 'http://example.com/concept/123'

    // Mock the SPARQL response to include a triple identifying the concept
    mockSparqlResponse.json.mockResolvedValue({
      results: {
        bindings: [
          {
            s: { value: mockConceptURI },
            p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
          }
          // Add other triples as needed
        ]
      }
    })

    await getSkosConcept({
      shortName: mockShortName,
      scheme: mockScheme
    })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`gcmd:text "${mockShortName}"@en`)
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${mockScheme}>`)
    }))

    // Verify that toSkosJson was called with the correct conceptURI
    expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
  })

  test('should generate correct query when altLabel is provided', async () => {
    const mockAltLabel = 'TestAltLabel'
    const mockScheme = 'TestScheme'
    const mockConceptURI = 'http://example.com/concept/456'

    // Mock the SPARQL response to include a triple identifying the concept
    mockSparqlResponse.json.mockResolvedValue({
      results: {
        bindings: [
          {
            s: { value: mockConceptURI },
            p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
          }
          // You can add other triples here if needed
        ]
      }
    })

    await getSkosConcept({
      altLabel: mockAltLabel,
      scheme: mockScheme
    })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`gcmd:text "${mockAltLabel}"@en`)
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`skos:altLabel "${mockAltLabel}"@en`)
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${mockScheme}>`)
    }))

    // Verify that toSkosJson was called with the correct conceptURI
    expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
  })

  test('should not include scheme in query when not provided', async () => {
    const mockShortName = 'TestShortName'
    const mockConceptURI = 'http://example.com/concept/789'

    // Mock the SPARQL response
    mockSparqlResponse.json.mockResolvedValue({
      results: {
        bindings: [
          {
            s: { value: mockConceptURI },
            p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
          }
          // You can add other triples here if needed
        ]
      }
    })

    await getSkosConcept({ shortName: mockShortName })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`gcmd:text "${mockShortName}"@en`)
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.not.stringContaining('skos:inScheme')
    }))

    // Verify that toSkosJson was called with the correct conceptURI
    expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
  })

  test('should throw an error when no identifier is provided', async () => {
    await expect(getSkosConcept({})).rejects.toThrow('Either conceptIRI, shortName, or altLabel must be provided')
  })

  test('should extract conceptIRI from results when using shortName or altLabel', async () => {
    const mockResults = {
      results: {
        bindings: [
          {
            s: { value: 'http://example.com/extracted-concept' },
            p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
          }
        ]
      }
    }
    mockSparqlResponse.json.mockResolvedValue(mockResults)

    await getSkosConcept({ shortName: 'TestShortName' })

    expect(toSkosJson).toHaveBeenCalledWith('http://example.com/extracted-concept', mockResults.results.bindings)
  })

  test('should throw an error if conceptIRI cannot be extracted from results', async () => {
    const mockResults = {
      results: {
        bindings: [
          {
            s: { value: 'http://example.com/not-a-concept' },
            p: { value: 'http://example.com/some-predicate' },
            o: { value: 'Some value' }
          }
        ]
      }
    }
    mockSparqlResponse.json.mockResolvedValue(mockResults)

    await expect(getSkosConcept({ shortName: 'TestShortName' })).rejects.toThrow('Could not find concept URI in retrieved concept')
  })

  test('should handle empty results', async () => {
    mockSparqlResponse.json.mockResolvedValue({ results: { bindings: [] } })

    await expect(getSkosConcept({ shortName: 'NonexistentShortName' })).rejects.toThrow('No results found for concept query.')
  })

  test('should handle network errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getSkosConcept({ conceptIRI: mockConceptIRI })).rejects.toThrow('Network error')
  })

  test('should use conceptIRI directly when provided', async () => {
    // eslint-disable-next-line no-shadow
    const mockConceptIRI = 'http://example.com/concept/123'

    // Mock the SPARQL response
    mockSparqlResponse.json.mockResolvedValue({
      results: {
        bindings: [
          {
            s: { value: mockConceptIRI },
            p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
          },
          {
            s: { value: mockConceptIRI },
            p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
            o: { value: 'Test Concept' }
          }
        ]
      }
    })

    await getSkosConcept({ conceptIRI: mockConceptIRI })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(mockConceptIRI)
    }))

    expect(toSkosJson).toHaveBeenCalledWith(mockConceptIRI, expect.any(Array))
  })

  test('should handle different types of URIs', async () => {
    const uris = [
      'http://example.com/concept/123',
      'https://example.com/concept/456',
      'urn:example:concept:789'
    ]

    // eslint-disable-next-line no-restricted-syntax
    for (const uri of uris) {
      // Reset mocks for each iteration
      vi.clearAllMocks()

      // Mock the SPARQL response for each URI
      mockSparqlResponse.json.mockResolvedValue({
        results: {
          bindings: [
            {
              s: { value: uri },
              p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
              o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
            },
            {
              s: { value: uri },
              p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
              o: { value: 'Test Concept' }
            }
          ]
        }
      })

      // eslint-disable-next-line no-await-in-loop
      await getSkosConcept({ conceptIRI: uri })

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining(uri)
      }))

      expect(toSkosJson).toHaveBeenCalledWith(uri, expect.any(Array))
    }
  })
})
