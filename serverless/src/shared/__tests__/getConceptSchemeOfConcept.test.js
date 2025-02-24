import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptSchemeOfConcept } from '../getConceptSchemeOfConcept'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../sparqlRequest')

describe('getConceptSchemeOfConcept', () => {
  const mockConceptUri = 'https://gcmd.earthdata.nasa.gov/kms/concept/1234'
  const mockSchemeUri = 'https://gcmd.earthdata.nasa.gov/kms/concept/scheme/5678'

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when successful', () => {
    test('should return the concept scheme URI when found', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: {
            bindings: [{ scheme: { value: mockSchemeUri } }]
          }
        })
      })

      const result = await getConceptSchemeOfConcept(mockConceptUri)
      expect(result).toBe(mockSchemeUri)
      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error when no scheme is found', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: {
            bindings: []
          }
        })
      })

      await expect(getConceptSchemeOfConcept(mockConceptUri)).rejects.toThrow('No scheme found for the given concept')
      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })

    test('should throw an error when the HTTP response is not ok', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 404
      })

      await expect(getConceptSchemeOfConcept(mockConceptUri)).rejects.toThrow('HTTP error! status: 404')
      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })

    test('should throw an error when sparqlRequest fails', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(getConceptSchemeOfConcept(mockConceptUri)).rejects.toThrow('Network error')
      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })
  })
})
