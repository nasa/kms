import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getConceptChangeNotes } from '../getConceptChangeNotes'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getConceptChangeNotes', () => {
  // Add these lines at the beginning of your describe block
  let consoleErrorSpy

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error before each test
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console.error after each test
    consoleErrorSpy.mockRestore()
  })

  test('fetches concept change notes successfully', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              concept: 'Concept1',
              changeNote: 'Note1'
            },
            {
              concept: 'Concept2',
              changeNote: 'Note2'
            }
          ]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getConceptChangeNotes({
      version: 'v1',
      scheme: 'earth_science',
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version: 'v1'
    }))

    expect(result).toEqual([
      {
        concept: 'Concept1',
        changeNote: 'Note1'
      },
      {
        concept: 'Concept2',
        changeNote: 'Note2'
      }
    ])
  })

  test('throws error when no results are found', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getConceptChangeNotes({ version: 'v1' }))
      .rejects.toThrow('No concept change notes found')
  })

  test('throws error when HTTP request fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getConceptChangeNotes({ version: 'v1' }))
      .rejects.toThrow('HTTP error! status: 500')
  })

  test('handles network errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getConceptChangeNotes({ version: 'v1' }))
      .rejects.toThrow('Network error')
  })

  test('calls sparqlRequest with correct parameters', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [{
            concept: 'Concept1',
            changeNote: 'Note1'
          }]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await getConceptChangeNotes({
      version: 'v2',
      scheme: 'test_scheme',
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    })

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version: 'v2',
      body: expect.stringContaining('https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/test_scheme')
    }))
  })
})
