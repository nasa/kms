import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptSchemeDetails } from '../getConceptSchemeDetails'
import * as sparqlRequestModule from '../sparqlRequest'

vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getConceptSchemeDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should return single concept scheme details when schemeName is provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                scheme: { value: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/ChainedOperations' },
                prefLabel: { value: 'Chained Operations' },
                notation: { value: 'ChainedOperations' },
                modified: { value: '2025-01-31' },
                csvHeaders: { value: 'Header1,Header2' }
              }
            ]
          }
        })
      }

      sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getConceptSchemeDetails('ChainedOperations')

      expect(result).toEqual({
        uri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/ChainedOperations',
        prefLabel: 'Chained Operations',
        notation: 'ChainedOperations',
        modified: '2025-01-31',
        csvHeaders: 'Header1,Header2'
      })

      expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('FILTER(?notation = "ChainedOperations")'),
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json'
      }))
    })

    test('should return all concept schemes when no schemeName is provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                scheme: { value: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/ChainedOperations' },
                prefLabel: { value: 'Chained Operations' },
                notation: { value: 'ChainedOperations' },
                modified: { value: '2025-01-31' },
                csvHeaders: { value: 'Header1,Header2' }
              },
              {
                scheme: { value: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/CollectionDataType' },
                prefLabel: { value: 'Collection Data Type' },
                notation: { value: 'CollectionDataType' },
                modified: { value: '2025-01-31' },
                csvHeaders: null
              }
            ]
          }
        })
      }

      sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getConceptSchemeDetails()

      expect(result).toEqual([
        {
          uri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/ChainedOperations',
          prefLabel: 'Chained Operations',
          notation: 'ChainedOperations',
          modified: '2025-01-31',
          csvHeaders: 'Header1,Header2'
        },
        {
          uri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/CollectionDataType',
          prefLabel: 'Collection Data Type',
          notation: 'CollectionDataType',
          modified: '2025-01-31',
          csvHeaders: null
        }
      ])

      expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        body: expect.not.stringContaining('FILTER'),
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json'
      }))
    })

    test('should handle concept scheme without csvHeaders', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                scheme: { value: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/TestScheme' },
                prefLabel: { value: 'Test Scheme' },
                notation: { value: 'TestScheme' },
                modified: { value: '2025-01-31' }
              }
            ]
          }
        })
      }

      sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getConceptSchemeDetails('TestScheme')

      expect(result).toEqual({
        uri: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/TestScheme',
        prefLabel: 'Test Scheme',
        notation: 'TestScheme',
        modified: '2025-01-31',
        csvHeaders: null
      })
    })

    test('should return null when no concept schemes are found', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: []
          }
        })
      }

      sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getConceptSchemeDetails()

      expect(result).toBeNull()
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error when HTTP request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getConceptSchemeDetails()).rejects.toThrow('HTTP error! status: 500')
    })
  })
})
