import getFilteredTriples from '../getFilteredTriples'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    sparqlEndpoint: 'http://mock-sparql-endpoint'
  }))
}))

vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getFilteredTriples', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when called with no filter', () => {
    test('should make a request to the SPARQL endpoint with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: []
          }
        })
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      await getFilteredTriples()

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  SELECT DISTINCT ?s ?p ?o
  WHERE
    {
      ?s ?p ?o .
    } 
  `
      })
    })

    test('should return the parsed results from the SPARQL query', async () => {
      const mockBindings = [
        {
          s: { value: 'subject1' },
          p: { value: 'predicate1' },
          o: { value: 'object1' }
        },
        {
          s: { value: 'subject2' },
          p: { value: 'predicate2' },
          o: { value: 'object2' }
        }
      ]
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: mockBindings
          }
        })
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getFilteredTriples()

      expect(result).toEqual(mockBindings)
    })

    test('should throw an error if the response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request')
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getFilteredTriples()).rejects.toThrow('HTTP error! status: 400')
    })

    test('should throw an error if the sparqlRequest fails', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(getFilteredTriples()).rejects.toThrow('Network error')
    })
  })
})
