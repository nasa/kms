// GetRootConceptsForAllSchemes.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getRootConceptsForAllSchemes } from '../getRootConceptsForAllSchemes'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getRootConceptsForAllSchemes', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks()
  })

  describe('When successful', () => {
    test('should fetch root concepts successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                subject: { value: 'https://example.com/concept1' },
                prefLabel: { value: 'Concept 1' },
                scheme: { value: 'scheme1' }
              },
              {
                subject: { value: 'https://example.com/concept2' },
                prefLabel: { value: 'Concept 2' },
                scheme: { value: 'scheme2' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getRootConceptsForAllSchemes()

      expect(sparqlRequest).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[0].subject.value).toBe('https://example.com/concept1')
      expect(result[1].prefLabel.value).toBe('Concept 2')
    })
  })

  describe('When unsuccessful', () => {
    test('should throw an error when HTTP request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getRootConceptsForAllSchemes()).rejects.toThrow('HTTP error! status: 500')
    })

    test('should throw an error when no root concepts are found', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: []
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getRootConceptsForAllSchemes()).rejects.toThrow('No root concepts found')
    })

    test('should handle and re-throw other errors', async () => {
      const mockError = new Error('Network error')

      sparqlRequest.mockRejectedValue(mockError)

      await expect(getRootConceptsForAllSchemes()).rejects.toThrow('Network error')
    })
  })
})
