import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getFilteredTriples from '../getFilteredTriples'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getFilteredTriples', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: { bindings: [] } })
    })
  })

  it('should return all triples when no filters are applied', async () => {
    await getFilteredTriples({})
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('WHERE {')
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.not.stringContaining('skos:inScheme')
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.not.stringContaining('skos:prefLabel')
    }))
  })

  it('should filter by pattern', async () => {
    await getFilteredTriples({ pattern: 'snow' })
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("snow")))')
    }))
  })

  it('should filter by concept scheme', async () => {
    await getFilteredTriples({ conceptScheme: 'sciencekeywords' })
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords>')
    }))
  })

  it('should filter by both pattern and concept scheme', async () => {
    await getFilteredTriples({
      pattern: 'snow',
      conceptScheme: 'sciencekeywords'
    })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("snow")))')
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords>')
    }))
  })

  it('should include blank node handling in the query', async () => {
    await getFilteredTriples({})
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('UNION')
    }))

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('FILTER(isBlank(?s))')
    }))
  })

  test('should handle error from sparqlRequest', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))
    await expect(getFilteredTriples({})).rejects.toThrow('SPARQL request failed')
  })

  test('should handle non-ok response from sparqlRequest', async () => {
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500
    })

    await expect(getFilteredTriples({})).rejects.toThrow('HTTP error! status: 500')
  })
})
