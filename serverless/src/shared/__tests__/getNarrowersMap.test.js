/// GetNarrowersMap.test.js
import {
  afterEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getNarrowersMap } from '../getNarrowersMap'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getNarrowersMap', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when successful', () => {
    test('should return a map of narrower concepts', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                subject: { value: 'concept1' },
                prefLabel: { value: 'Concept 1' },
                narrower: { value: 'narrower1' },
                narrowerPrefLabel: { value: 'Narrower 1' }
              },
              {
                subject: { value: 'concept1' },
                prefLabel: { value: 'Concept 1' },
                narrower: { value: 'narrower2' },
                narrowerPrefLabel: { value: 'Narrower 2' }
              },
              {
                subject: { value: 'concept2' },
                prefLabel: { value: 'Concept 2' },
                narrower: { value: 'narrower3' },
                narrowerPrefLabel: { value: 'Narrower 3' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getNarrowersMap('testScheme')

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: expect.any(String)
      })

      expect(result).toEqual({
        concept1: [
          {
            subject: { value: 'concept1' },
            prefLabel: { value: 'Concept 1' },
            narrower: { value: 'narrower1' },
            narrowerPrefLabel: { value: 'Narrower 1' }
          },
          {
            subject: { value: 'concept1' },
            prefLabel: { value: 'Concept 1' },
            narrower: { value: 'narrower2' },
            narrowerPrefLabel: { value: 'Narrower 2' }
          }
        ],
        concept2: [
          {
            subject: { value: 'concept2' },
            prefLabel: { value: 'Concept 2' },
            narrower: { value: 'narrower3' },
            narrowerPrefLabel: { value: 'Narrower 3' }
          }
        ]
      })
    })

    test('should return an empty map when no results are returned', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: []
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getNarrowersMap('testScheme')
      expect(result).toEqual({})
    })

    test('should handle a single result correctly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                subject: { value: 'concept1' },
                prefLabel: { value: 'Concept 1' },
                narrower: { value: 'narrower1' },
                narrowerPrefLabel: { value: 'Narrower 1' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getNarrowersMap('testScheme')

      expect(result).toEqual({
        concept1: [
          {
            subject: { value: 'concept1' },
            prefLabel: { value: 'Concept 1' },
            narrower: { value: 'narrower1' },
            narrowerPrefLabel: { value: 'Narrower 1' }
          }
        ]
      })
    })

    test('should use the correct SPARQL query', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await getNarrowersMap('testScheme')

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/testScheme')
      }))
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error when the HTTP request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getNarrowersMap('testScheme')).rejects.toThrow('HTTP error! status: 500')
    })

    test('should throw an error when sparqlRequest throws', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(getNarrowersMap('testScheme')).rejects.toThrow('Network error')
    })
  })
})
