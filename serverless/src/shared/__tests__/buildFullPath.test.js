import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { buildFullPath } from '@/shared/buildFullPath'
import { sparqlRequest } from '@/shared/sparqlRequest'

// Mock dependencies
vi.mock('@/shared/sparqlRequest')

describe('buildFullPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when successful', () => {
    test('should build full path correctly for multi-level concepts', async () => {
      const mockResponses = [
        {
          ok: true,
          json: vi.fn().mockResolvedValue({
            results: {
              bindings: [{
                prefLabel: { value: 'AEROSOLS' },
                broader: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/atmosphere' }
              }]
            }
          })
        },
        {
          ok: true,
          json: vi.fn().mockResolvedValue({
            results: {
              bindings: [{
                prefLabel: { value: 'ATMOSPHERE' },
                broader: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/earth-science' }
              }]
            }
          })
        },
        {
          ok: true,
          json: vi.fn().mockResolvedValue({
            results: {
              bindings: [{
                prefLabel: { value: 'EARTH SCIENCE' },
                broader: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/root' }
              }]
            }
          })
        },
        {
          ok: true,
          json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
        }
      ]

      sparqlRequest.mockImplementation(() => mockResponses.shift())

      const result = await buildFullPath('aerosols')
      expect(result).toBe('EARTH SCIENCE|ATMOSPHERE|AEROSOLS')
    })

    test('should handle single-level concepts', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [{
              prefLabel: { value: 'SINGLE CONCEPT' },
              broader: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/root' }
            }]
          }
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
      })

      const result = await buildFullPath('single-concept')
      expect(result).toBe('SINGLE CONCEPT')
    })
  })

  test('should handle a concept without a broader concept', async () => {
    sparqlRequest.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [{
            prefLabel: { value: 'TOP LEVEL CONCEPT' }
          }]
        }
      })
    })

    const result = await buildFullPath('top-level-concept')
    expect(result).toBe('TOP LEVEL CONCEPT')
  })

  describe('when unsuccessful', () => {
    test('should throw error on HTTP failure', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(buildFullPath('error-concept')).rejects.toThrow('HTTP error! status: 500')
    })
  })

  describe('Edge cases', () => {
    test('should handle empty response for non-existent concept', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
      })

      const result = await buildFullPath('non-existent-concept')
      expect(result).toBe('')
    })
  })
})
