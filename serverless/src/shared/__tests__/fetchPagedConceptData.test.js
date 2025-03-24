import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { fetchPagedConceptData } from '../fetchPagedConceptData'

vi.mock('@/shared/delay', () => ({
  delay: vi.fn(() => Promise.resolve())
}))

describe('fetchPagedConceptData', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  const generateMockData = (format, count, startIndex = 0) => {
    if (format === 'json') {
      return Array.from({ length: count }, (_, i) => ({ uuid: `uuid-${startIndex + i + 1}` }))
    }

    return Array.from({ length: count }, (_, i) => `<concept uuid="uuid-${startIndex + i + 1}"/>`)
      .join('')
  }

  describe('when retrieving xml content', () => {
    test('should correctly parse and return XML data for multiple pages', async () => {
      const totalHits = 5500
      const pageSize = 2000
      const pages = Math.ceil(totalHits / pageSize)

      for (let i = 0; i < pages; i += 1) {
        const remainingHits = totalHits - i * pageSize
        const pageHits = Math.min(remainingHits, pageSize)
        const startIndex = i * pageSize
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'Total-Count': totalHits.toString() }),
          text: () => Promise.resolve(`<concepts>${generateMockData('xml', pageHits, startIndex)}</concepts>`)
        })
      }

      const result = await fetchPagedConceptData('xml', 'http://api.example.com', 'published')

      expect(result).toMatch(/<concepts>(<concept uuid="uuid-\d+"\/>\s*){5500}<\/concepts>/)
      expect(mockFetch).toHaveBeenCalledTimes(pages)

      // Additional checks
      expect(result).toMatch(/<concept uuid="uuid-1"/)
      expect(result).toMatch(/<concept uuid="uuid-5500"/)
    })

    test('should handle XML content with no concepts correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Total-Count': '0' }),
        text: () => Promise.resolve('<concepts></concepts>')
      })

      const result = await fetchPagedConceptData('xml', 'http://api.example.com', 'published')

      expect(result).toBe('<concepts></concepts>')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('when retrieving json content', () => {
    test('should correctly parse and return JSON data for multiple pages', async () => {
      const totalHits = 5500
      const pageSize = 2000
      const pages = Math.ceil(totalHits / pageSize)

      for (let i = 0; i < pages; i += 1) {
        const remainingHits = totalHits - i * pageSize
        const pageHits = Math.min(remainingHits, pageSize)
        const startIndex = i * pageSize
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'Total-Count': totalHits.toString() }),
          text: () => Promise.resolve(JSON.stringify(generateMockData('json', pageHits, startIndex)))
        })
      }

      const result = await fetchPagedConceptData('json', 'http://api.example.com', 'published')

      const parsedResult = JSON.parse(result)
      expect(parsedResult).toHaveLength(5500)
      expect(parsedResult[0]).toEqual({ uuid: 'uuid-1' })
      expect(parsedResult[5499]).toEqual({ uuid: 'uuid-5500' })
      expect(mockFetch).toHaveBeenCalledTimes(pages)
    })
  })

  describe('when add version parameter correct to url', () => {
    test('should not include version in the URL for published data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Total-Count': '1' }),
        text: () => Promise.resolve('[]')
      })

      await fetchPagedConceptData('json', 'http://api.example.com', 'published')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).not.toContain('&version=')
    })

    test('should include version in the URL for non-published data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Total-Count': '1' }),
        text: () => Promise.resolve('[]')
      })

      await fetchPagedConceptData('json', 'http://api.example.com', 'draft')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('&version=draft')
    })
  })

  describe('when an error occurs', () => {
    test('should throw an error when X-Total-Hits header is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({}),
        text: () => Promise.resolve('[]')
      })

      await expect(fetchPagedConceptData('json', 'http://api.example.com', 'published'))
        .rejects.toThrow('Invalid Total-Count header')
    })

    test('should throw an error when JSON response is not an array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Total-Count': '1' }),
        text: () => Promise.resolve('{}')
      })

      await expect(fetchPagedConceptData('json', 'http://api.example.com', 'published'))
        .rejects.toThrow('Invalid JSON response: expected an array')
    })

    test('should throw an error when parsing invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Total-Count': '1' }),
        text: () => Promise.resolve('invalid json')
      })

      await expect(fetchPagedConceptData('json', 'http://api.example.com', 'published'))
        .rejects.toThrow(SyntaxError)
    })

    test('should throw an error when parsing invalid XML', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'Total-Count': '1' }),
        text: () => Promise.resolve('<invalid>xml')
      })

      await expect(fetchPagedConceptData('xml', 'http://api.example.com', 'published'))
        .rejects.toThrow()
    })

    test('should throw an HTTP error when the response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(fetchPagedConceptData('json', 'http://api.example.com', 'published'))
        .rejects.toThrow('HTTP error! status: 404')
    })
  })
})
