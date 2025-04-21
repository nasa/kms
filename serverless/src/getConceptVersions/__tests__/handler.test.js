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
      test('should return XML of all versions including lastSynced', async () => {
        // Mock SPARQL response
        sparqlRequest.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            results: {
              bindings: [
                {
                  graph: { value: 'graph1' },
                  creationDate: { value: '2023-01-01' },
                  versionType: { value: 'published' },
                  versionName: { value: '1.0' },
                  lastSynced: { value: '2023-01-02T10:00:00Z' }
                },
                {
                  graph: { value: 'graph2' },
                  creationDate: { value: '2023-02-01' },
                  versionType: { value: 'draft' },
                  versionName: { value: '1.1' },
                  lastSynced: { value: '2023-02-02T11:00:00Z' }
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
        expect(response.body).toContain('<version type="published" creation_date="2023-01-01" last_synced="2023-01-02T10:00:00Z">1.0</version>')
        expect(response.body).toContain('<version type="draft" creation_date="2023-02-01" last_synced="2023-02-02T11:00:00Z">1.1</version>')
      })

      test('should return versions sorted correctly', async () => {
        sparqlRequest.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            results: {
              bindings: [
                {
                  creationDate: { value: '2023-01-01' },
                  versionType: { value: 'published' },
                  versionName: { value: '1.0' },
                  lastSynced: { value: '2023-01-02T10:00:00Z' }
                },
                {
                  creationDate: { value: '2023-02-01' },
                  versionType: { value: 'draft' },
                  versionName: { value: 'draft' },
                  lastSynced: { value: '2023-02-02T11:00:00Z' }
                },
                {
                  creationDate: { value: '2023-03-01' },
                  versionType: { value: 'published' },
                  versionName: { value: '2.0' },
                  lastSynced: { value: '2023-03-02T12:00:00Z' }
                },
                {
                  creationDate: { value: '2022-12-01' },
                  versionType: { value: 'past_published' },
                  versionName: { value: 'Jun122012' },
                  lastSynced: { value: '2022-12-02T09:00:00Z' }
                },
                {
                  creationDate: { value: '2023-04-01' },
                  versionType: { value: 'published' },
                  versionName: { value: '1.5' },
                  lastSynced: { value: '2023-04-02T13:00:00Z' }
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

        const xmlLines = response.body.split('\n').filter((line) => line.trim().startsWith('<version'))

        expect(xmlLines[1]).toBe('  <version type="draft" creation_date="2023-02-01" last_synced="2023-02-02T11:00:00Z">draft</version>')
        expect(xmlLines[2]).toBe('  <version type="published" creation_date="2023-03-01" last_synced="2023-03-02T12:00:00Z">2.0</version>')
        expect(xmlLines[3]).toBe('  <version type="published" creation_date="2023-04-01" last_synced="2023-04-02T13:00:00Z">1.5</version>')
        expect(xmlLines[4]).toBe('  <version type="published" creation_date="2023-01-01" last_synced="2023-01-02T10:00:00Z">1.0</version>')
        expect(xmlLines[5]).toBe('  <version type="past_published" creation_date="2022-12-01" last_synced="2022-12-02T09:00:00Z">Jun122012</version>')
      })
    })

    describe('when requesting all published versions', async () => {
      test('should filter versions based on versionType parameter and include lastSynced', async () => {
        sparqlRequest.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            results: {
              bindings: [
                {
                  graph: { value: 'graph1' },
                  creationDate: { value: '2023-01-01' },
                  versionType: { value: 'published' },
                  versionName: { value: '1.0' },
                  lastSynced: { value: '2023-01-02T10:00:00Z' }
                }
              ]
            }
          })
        })

        const event = { pathParameters: { versionType: 'published' } }
        const response = await getConceptVersions(event)

        expect(response.statusCode).toBe(200)
        expect(response.body).toContain('<version type="published" creation_date="2023-01-01" last_synced="2023-01-02T10:00:00Z">1.0</version>')
        expect(response.body).not.toContain('type="draft"')
      })
    })

    describe('when there are no results', () => {
      test('should return 0 version tags', async () => {
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

    test('should handle invalid creation dates and missing lastSynced', async () => {
      sparqlRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: {
            bindings: [
              {
                graph: { value: 'graph1' },
                creationDate: { value: 'invalid-date' },
                versionType: { value: 'published' },
                versionName: { value: '1.0' }
              }
            ]
          }
        })
      })

      const event = { pathParameters: { versionType: 'all' } }
      const response = await getConceptVersions(event)

      expect(response.statusCode).toBe(200)
      expect(response.body).toContain('<version type="published" creation_date="">1.0</version>')
      expect(response.body).not.toContain('last_synced')
    })
  })

  describe('when unsuccessful', () => {
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
