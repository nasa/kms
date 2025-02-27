import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getSkosConcept } from '@/shared/getSkosConcept'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { toSkosJson } from '@/shared/toSkosJson'

vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/toSkosJson')

describe('getSkosConcept', () => {
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sparqlRequest.mockResolvedValue(mockSparqlResponse)
    mockSparqlResponse.json.mockReset()
    toSkosJson.mockReturnValue(mockSkosJson)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('when successful', () => {
    describe('Retrieving skos concept for a given IRI', () => {
      test('should fetch and process SKOS concept data successfully', async () => {
        const mockConceptIRI = 'http://example.com/concept/123'
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
          type: 'query',
          contentType: 'application/sparql-query',
          accept: 'application/sparql-results+json',
          method: 'POST',
          body: expect.stringContaining(mockConceptIRI)
        })

        expect(toSkosJson).toHaveBeenCalledWith(mockConceptIRI, mockSparqlResults.results.bindings)
        expect(result).toEqual(mockSkosJson)
      })

      test('should handle different types of URIs', async () => {
        const uris = [
          'http://example.com/concept/123',
          'https://example.com/concept/456',
          'urn:example:concept:789'
        ]

        // eslint-disable-next-line no-restricted-syntax
        for (const uri of uris) {
          vi.clearAllMocks()
          mockSparqlResponse.json.mockResolvedValue({
            results: {
              bindings: [
                {
                  s: { value: uri },
                  p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
                  o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
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

    describe('Retrieving skos concept for a given short name', () => {
      test('should generate correct query when shortName and scheme are provided', async () => {
        const mockShortName = 'TestShortName'
        const mockScheme = 'TestScheme'
        const mockConceptURI = 'http://example.com/concept/123'

        mockSparqlResponse.json.mockResolvedValue({
          results: {
            bindings: [
              {
                s: { value: mockConceptURI },
                p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
                o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
              }
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

        expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
      })

      test('should not include scheme in query when not provided', async () => {
        const mockShortName = 'TestShortName'
        const mockConceptURI = 'http://example.com/concept/789'

        mockSparqlResponse.json.mockResolvedValue({
          results: {
            bindings: [
              {
                s: { value: mockConceptURI },
                p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
                o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
              }
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

        expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
      })
    })

    describe('Retrieving skos concept for a given alt label', () => {
      test('should generate correct query when altLabel and scheme are provided', async () => {
        const mockAltLabel = 'TestAltLabel'
        const mockScheme = 'TestScheme'
        const mockConceptURI = 'http://example.com/concept/456'

        mockSparqlResponse.json.mockResolvedValue({
          results: {
            bindings: [
              {
                s: { value: mockConceptURI },
                p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
                o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
              }
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

        expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
      })

      test('should not include scheme in query when not provided for altLabel', async () => {
        const mockAltLabel = 'TestAltLabel'
        const mockConceptURI = 'http://example.com/concept/789'

        mockSparqlResponse.json.mockResolvedValue({
          results: {
            bindings: [
              {
                s: { value: mockConceptURI },
                p: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
                o: { value: 'http://www.w3.org/2004/02/skos/core#Concept' }
              }
            ]
          }
        })

        await getSkosConcept({ altLabel: mockAltLabel })

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining(`gcmd:text "${mockAltLabel}"@en`)
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining(`skos:altLabel "${mockAltLabel}"@en`)
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.not.stringContaining('skos:inScheme')
        }))

        expect(toSkosJson).toHaveBeenCalledWith(mockConceptURI, expect.any(Array))
      })
    })
  })

  describe('when unsuccessful', () => {
    describe('Error conditions', () => {
      test('should throw an error if the HTTP request fails', async () => {
        sparqlRequest.mockResolvedValue({
          ok: false,
          status: 404
        })

        await expect(getSkosConcept({ conceptIRI: 'http://example.com/concept/123' }))
          .rejects.toThrow('HTTP error! status: 404')
      })

      test('should throw an error if no results are found', async () => {
        mockSparqlResponse.json.mockResolvedValue({ results: { bindings: [] } })

        await expect(getSkosConcept({ conceptIRI: 'http://example.com/concept/123' }))
          .rejects.toThrow('No results found for concept query.')
      })

      test('should throw an error if no identifier is provided', async () => {
        await expect(getSkosConcept({}))
          .rejects.toThrow('Either conceptIRI, shortName, or altLabel must be provided')
      })

      test('should throw an error if conceptIRI cannot be extracted from results', async () => {
        mockSparqlResponse.json.mockResolvedValue({
          results: {
            bindings: [
              {
                s: { value: 'http://example.com/not-a-concept' },
                p: { value: 'http://example.com/some-predicate' },
                o: { value: 'Some value' }
              }
            ]
          }
        })

        await expect(getSkosConcept({ shortName: 'TestShortName' }))
          .rejects.toThrow('Could not find concept URI in retrieved concept')
      })

      test('should handle network errors', async () => {
        sparqlRequest.mockRejectedValue(new Error('Network error'))

        await expect(getSkosConcept({ conceptIRI: 'http://example.com/concept/123' }))
          .rejects.toThrow('Network error')
      })

      test('should handle errors during JSON parsing', async () => {
        mockSparqlResponse.json.mockRejectedValue(new Error('Invalid JSON'))

        await expect(getSkosConcept({ conceptIRI: 'http://example.com/concept/123' }))
          .rejects.toThrow('Invalid JSON')
      })
    })
  })
})
