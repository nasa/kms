import {
  describe,
  expect,
  test
} from 'vitest'

import { getTotalConceptCount } from '@/shared/getTotalConceptCount'
import { sparqlRequest } from '@/shared/sparqlRequest'

vi.mock('@/shared/sparqlRequest')

describe('when fetching count', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('should return correct count', async () => {
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [{ count: { value: '42' } }]
        }
      })
    })

    const count = await getTotalConceptCount({
      conceptScheme: 'sciencekeywords',
      pattern: 'earth',
      version: 'published'
    })

    expect(count).toBe(42)
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version: 'published'
    }))
  })

  test('should handle error from sparqlRequest', async () => {
    sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

    await expect(getTotalConceptCount({
      conceptScheme: 'sciencekeywords',
      version: 'published'
    })).rejects.toThrow('SPARQL request failed')
  })

  test('should handle non-ok response from sparqlRequest', async () => {
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500
    })

    await expect(getTotalConceptCount({
      conceptScheme: 'sciencekeywords',
      version: 'published'
    })).rejects.toThrow('HTTP error! status: 500')
  })
})
