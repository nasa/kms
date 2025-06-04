import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { getSkosRootConcept } from '../getSkosRootConcept'
import { toSkosJson } from '../toSkosJson'

vi.mock('@/shared/sparqlRequest')
vi.mock('../toSkosJson')

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getSkosRootConcept', () => {
  const mockSchemeId = 'mockSchemeId'
  const mockVersion = 'mockVersion'

  describe('When the sparqlRequest is successful', () => {
    test('should return the SKOS concept when bindings are present', async () => {
      const mockBindings = [{ s: { value: 'mockConceptIRI' } }]
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ results: { bindings: mockBindings } })
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      const mockSkosJson = { concept: 'mockConcept' }
      toSkosJson.mockReturnValue(mockSkosJson)

      const result = await getSkosRootConcept(mockSchemeId, mockVersion)

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        version: mockVersion
      }))

      expect(toSkosJson).toHaveBeenCalledWith('mockConceptIRI', mockBindings)
      expect(result).toEqual(mockSkosJson)
    })

    test('should return null when no bindings are present', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getSkosRootConcept(mockSchemeId, mockVersion)

      expect(result).toBeNull()
    })
  })

  describe('When the sparqlRequest fails', () => {
    test('should throw an error when the response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getSkosRootConcept(mockSchemeId, mockVersion)).rejects.toThrow('HTTP error! status: 404')
    })

    test('should throw an error when sparqlRequest throws', async () => {
      const mockError = new Error('Network error')
      sparqlRequest.mockRejectedValue(mockError)

      await expect(getSkosRootConcept(mockSchemeId, mockVersion)).rejects.toThrow('Network error')
    })
  })
})
