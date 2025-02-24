import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { sparqlRequest } from '@/shared/sparqlRequest'

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

  describe('when successful', () => {
    describe('when retrieving triples by concept scheme', () => {
      test('should filter by concept scheme for skos:Concept triples', async () => {
        await getFilteredTriples({ conceptScheme: 'sciencekeywords' })
        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?s rdf:type skos:Concept')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords>')
        }))
      })
    })

    describe('when retrieving triples by pattern', () => {
      test('should filter by pattern for skos:Concept triples', async () => {
        await getFilteredTriples({ pattern: 'snow' })
        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?s rdf:type skos:Concept')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("snow")))')
        }))
      })
    })

    describe('when retrieving triples by concept scheme and pattern', () => {
      test('should filter by both pattern and concept scheme for skos:Concept triples', async () => {
        await getFilteredTriples({
          pattern: 'snow',
          conceptScheme: 'sciencekeywords'
        })

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?s rdf:type skos:Concept')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('FILTER(CONTAINS(LCASE(?prefLabel), LCASE("snow")))')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords>')
        }))
      })
    })

    describe('when retrieving all triples (no scheme or pattern provided)', () => {
      test('should return all skos:Concept triples when no filters are applied', async () => {
        await getFilteredTriples({})
        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('WHERE {')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?s rdf:type skos:Concept')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.not.stringContaining('skos:inScheme')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.not.stringContaining('skos:prefLabel')
        }))
      })

      test('should include blank node handling in the query for skos:Concept triples', async () => {
        await getFilteredTriples({})
        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('UNION')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('FILTER(isBlank(?s))')
        }))

        expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
          body: expect.stringContaining('?original rdf:type skos:Concept')
        }))
      })
    })
  })

  describe('when unsuccessful', () => {
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
})
