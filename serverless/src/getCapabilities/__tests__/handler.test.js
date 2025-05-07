import { XMLBuilder } from 'fast-xml-parser'
import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getCapabilities } from '@/getCapabilities/handler'

// Mock the getApplicationConfig function
vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'X-Custom-Header': 'CustomValue' },
    version: '1.2.3'
  }))
}))

describe('getCapabilities', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should return XML capabilities', async () => {
      const result = await getCapabilities()

      // Check that the response has the correct structure
      expect(result).toHaveProperty('body')
      expect(result).toHaveProperty('headers')

      // Check the Content-Type header
      expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')

      // Check that the default header from getApplicationConfig is included
      expect(result.headers['X-Custom-Header']).toBe('CustomValue')

      // Check that the body is a non-empty string
      expect(typeof result.body).toBe('string')
      expect(result.body.length).toBeGreaterThan(0)

      // Check that the XML is well-formed and contains expected elements
      expect(result.body).toContain('<capabilities version="0.5">')
      expect(result.body).toContain('<software>')
      expect(result.body).toContain('<version>1.2.3</version>')
      expect(result.body).toContain('<documentation>')
      expect(result.body).toContain('<termsOfUse>')
      expect(result.body).toContain('<urls>')
      expect(result.body).toContain('<a name="get_status"')
      expect(result.body).toContain('<a name="get_concept_fullpaths"')
      expect(result.body).toContain('<a name="get_concept"')
      expect(result.body).toContain('<a name="get_concepts_all"')
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors and return a 500 status', async () => {
      // Mock XMLBuilder to throw an error
      vi.spyOn(XMLBuilder.prototype, 'build').mockImplementation(() => {
        throw new Error('XML build error')
      })

      const result = await getCapabilities()

      expect(result.statusCode).toBe(500)
      expect(result.headers).toEqual({ 'X-Custom-Header': 'CustomValue' })
      expect(JSON.parse(result.body)).toEqual({ error: 'Error: XML build error' })
    })
  })
})
