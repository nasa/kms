import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { getConceptVersions } from '../handler'

// Mock the shared functions
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/getConfig')

describe('getConceptVersions', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock getApplicationConfig
    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'X-Test': 'test-header' }
    })
  })

  describe('when successful', async () => {
    describe('when requesting all versions', async () => {
      test('should return XML of all versions', async () => {
        // Mock SPARQL response
        sparqlRequest.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            results: {
              bindings: [
                {
                  graph: { value: 'graph1' },
                  creationDate: { value: '2023-01-01' },
                  versionType: { value: 'PUBLISHED' },
                  versionName: { value: '1.0' }
                },
                {
                  graph: { value: 'graph2' },
                  creationDate: { value: '2023-02-01' },
                  versionType: { value: 'DRAFT' },
                  versionName: { value: '1.1' }
                }
              ]
            }
          })
        })

        const event = { pathParameters: { versionType: 'all' } }
        const response = await getConceptVersions(event)

        expect(response.statusCode).toBe(200)
        expect(response.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(response.headers['X-Test']).toBe('test-header')

        // Check XML content
        expect(response.body).toContain('<versions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
        expect(response.body).toContain('<version type="PUBLISHED" creation_date="2023-01-01">1.0</version>')
        expect(response.body).toContain('<version type="DRAFT" creation_date="2023-02-01">1.1</version>')
      })
    })

    describe('when requesting all published versions', async () => {
      test('should filter versions based on versionType parameter', async () => {
        sparqlRequest.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            results: {
              bindings: [
                {
                  graph: { value: 'graph1' },
                  creationDate: { value: '2023-01-01' },
                  versionType: { value: 'PUBLISHED' },
                  versionName: { value: '1.0' }
                }
              ]
            }
          })
        })

        const event = { pathParameters: { versionType: 'PUBLISHED' } }
        const response = await getConceptVersions(event)

        expect(response.statusCode).toBe(200)
        expect(response.body).toContain('<version type="PUBLISHED" creation_date="2023-01-01">1.0</version>')
        expect(response.body).not.toContain('type="DRAFT"')
      })
    })

    describe('when there are no results', () => {
      it('should return 0 version tags', async () => {
        sparqlRequest.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            results: {
              bindings: []
            }
          })
        })

        const event = { pathParameters: { versionType: 'all' } }
        const response = await getConceptVersions(event)

        expect(response.statusCode).toBe(200)
        expect(response.body).toContain('<versions')
        expect(response.body).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
        expect(response.body).toContain('xsi:noNamespaceSchemaLocation="https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd"')
        expect(response.body).toContain('</versions>')

        // More explicit check for absence of <version> tag
        const versionTagRegex = /<version.*>.*<\/version>/
        expect(response.body).not.toMatch(versionTagRegex)
      })
    })

    test('should handle invalid creation dates', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: {
            bindings: [
              {
                graph: { value: 'graph1' },
                creationDate: { value: 'invalid-date' },
                versionType: { value: 'PUBLISHED' },
                versionName: { value: '1.0' }
              }
            ]
          }
        })
      })

      const event = { pathParameters: { versionType: 'all' } }
      const response = await getConceptVersions(event)

      expect(response.statusCode).toBe(200)
      expect(response.body).toContain('<version type="PUBLISHED" creation_date="">1.0</version>')
    })
  })

  describe('when unsuccesful', () => {
    test('should handle SPARQL request errors', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const event = { pathParameters: { versionType: 'all' } }
      const response = await getConceptVersions(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toHaveProperty('error')
    })
  })
})
