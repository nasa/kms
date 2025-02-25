import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getProviderUrlsMap from '../getProviderUrlsMap'
import * as sparqlRequestModule from '../sparqlRequest'

describe('getProviderUrlsMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a correct map of provider URLs', async () => {
    vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [
            {
              subject: { value: 'subject1' },
              bo: { value: 'provider' }
            },
            {
              subject: { value: 'subject1' },
              bo: { value: 'http://example1.com' }
            },
            {
              subject: { value: 'subject2' },
              bo: { value: 'http://example2.com' }
            },
            {
              subject: { value: 'subject2' },
              bo: { value: 'http://example3.com' }
            }
          ]
        }
      })
    })

    const result = await getProviderUrlsMap('testScheme')

    expect(result).toEqual({
      subject1: ['http://example1.com'],
      subject2: ['http://example2.com', 'http://example3.com']
    })

    expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: expect.any(String)
    })
  })

  it('should ignore "provider" values (case-insensitive)', async () => {
    vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [
            {
              subject: { value: 'subject1' },
              bo: { value: 'Provider' }
            },
            {
              subject: { value: 'subject1' },
              bo: { value: 'http://example1.com' }
            },
            {
              subject: { value: 'subject1' },
              bo: { value: 'PROVIDER' }
            }
          ]
        }
      })
    })

    const result = await getProviderUrlsMap('testScheme')

    expect(result).toEqual({
      subject1: ['http://example1.com']
    })
  })

  it('should throw an error if the response is not ok', async () => {
    vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
      ok: false,
      status: 400
    })

    await expect(getProviderUrlsMap('testScheme')).rejects.toThrow('HTTP error! status: 400')
  })

  it('should throw an error if sparqlRequest fails', async () => {
    vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockRejectedValue(new Error('Network error'))

    await expect(getProviderUrlsMap('testScheme')).rejects.toThrow('Network error')
  })

  it('should handle empty response correctly', async () => {
    vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: []
        }
      })
    })

    const result = await getProviderUrlsMap('testScheme')

    expect(result).toEqual({})
  })
})
