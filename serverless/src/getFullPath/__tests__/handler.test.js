import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { buildFullPath } from '@/shared/buildFullPath'
import { getApplicationConfig } from '@/shared/getConfig'

import { getFullPath } from '../handler'

// Mock dependencies
vi.mock('@/shared/buildFullPath')
vi.mock('@/shared/getConfig')

describe('getFullPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'X-Custom-Header': 'test-value' }
    })
  })

  describe('when successful', () => {
    test('should return XML response with correct content type', async () => {
      buildFullPath.mockResolvedValue('EARTH SCIENCE|ATMOSPHERE|AEROSOLS')

      const event = { pathParameters: { conceptId: 'test-concept-id' } }
      const response = await getFullPath(event)

      expect(response.headers['Content-Type']).toBe('application/xml')
      expect(response.headers['X-Custom-Header']).toBe('test-value')
      expect(response.body).toContain('<FullPaths>')
      expect(response.body).toContain('<FullPath')
      expect(response.body).toContain('EARTH SCIENCE|ATMOSPHERE|AEROSOLS')
      expect(response.statusCode).toBeUndefined()
    })

    test('should call buildFullPath with correct conceptId', async () => {
      buildFullPath.mockResolvedValue('TEST|PATH')

      const event = { pathParameters: { conceptId: 'test-concept-id' } }
      await getFullPath(event)

      expect(buildFullPath).toHaveBeenCalledWith('test-concept-id')
    })
  })

  describe('when an error occurs', () => {
    test('should return JSON error response on failure', async () => {
      buildFullPath.mockRejectedValue(new Error('Test error'))

      const event = { pathParameters: { conceptId: 'test-concept-id' } }
      const response = await getFullPath(event)

      expect(response.statusCode).toBe(500)
      expect(response.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(response.body).error).toContain('Test error')
    })
  })

  describe('when building the xml structure', () => {
    test('should include correct XML namespaces and attributes', async () => {
      buildFullPath.mockResolvedValue('TEST|PATH')

      const event = { pathParameters: { conceptId: 'test-concept-id' } }
      const response = await getFullPath(event)

      expect(response.body).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
      expect(response.body).toContain('xmlns:xs="http://www.w3.org/2001/XMLSchema"')
      expect(response.body).toContain('xsi:type="xs:string"')
    })
  })
})
