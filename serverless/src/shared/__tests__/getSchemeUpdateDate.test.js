import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'

import { getSchemeUpdateDate } from '../getSchemeUpdateDate'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../sparqlRequest')
vi.mock('@/shared/operations/queries/getConceptSchemeDetailsQuery')

describe('getSchemeUpdateDate', () => {
  const mockScheme = 'http://example.com/scheme'
  const mockVersion = 'published'
  const mockQuery = 'SPARQL query'
  const mockResponse = {
    ok: true,
    json: vi.fn()
  }

  beforeEach(() => {
    getConceptSchemeDetailsQuery.mockReturnValue(mockQuery)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('When called with valid scheme and version, should return the update date', async () => {
    const mockResult = {
      results: {
        bindings: [{ modified: { value: '2023-06-15' } }]
      }
    }
    mockResponse.json.mockResolvedValue(mockResult)
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getSchemeUpdateDate({
      scheme: mockScheme,
      version: mockVersion
    })

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: mockQuery,
      version: mockVersion
    })

    expect(getConceptSchemeDetailsQuery).toHaveBeenCalledWith(mockScheme)
    expect(result).toEqual('2023-06-15')
  })

  test('When the response is not ok, should throw an HTTP error', async () => {
    mockResponse.ok = false
    mockResponse.status = 500
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getSchemeUpdateDate({
      scheme: mockScheme,
      version: mockVersion
    }))
      .rejects.toThrow('HTTP error! status: 500')
  })

  test('When no update date is found, should return undefined', async () => {
    const mockResult = {
      results: {
        bindings: []
      }
    }
    mockResponse.ok = true // Ensure the response is ok
    mockResponse.json.mockResolvedValue(mockResult)
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getSchemeUpdateDate({
      scheme: mockScheme,
      version: mockVersion
    })

    expect(result).toBeUndefined()
  })

  test('When sparqlRequest fails, should throw an error', async () => {
    const mockError = new Error('Network error')
    sparqlRequest.mockRejectedValue(mockError)

    await expect(getSchemeUpdateDate({
      scheme: mockScheme,
      version: mockVersion
    }))
      .rejects.toThrow('Network error')

    expect(console.error).toHaveBeenCalledWith('Error fetching triples:', mockError)
  })
})
