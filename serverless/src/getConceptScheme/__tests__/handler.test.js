import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'

import { getConceptScheme } from '../handler'

vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getVersionMetadata')

describe('getConceptScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: { 'X-Custom-Header': 'Value' } })
  })

  let consoleErrorSpy

  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('When called with valid parameters', () => {
    test('should return a 200 status code and XML content', async () => {
      getConceptSchemeDetails.mockResolvedValue({
        uri: 'http://example.com/scheme',
        prefLabel: 'Test Scheme',
        notation: 'TEST',
        modified: '2023-06-01'
      })

      getVersionMetadata.mockResolvedValue({
        versionName: '1.0',
        versionType: 'Published',
        created: '2023-06-01'
      })

      const event = {
        pathParameters: { schemeId: 'test-scheme' },
        queryStringParameters: { version: '1.0' }
      }

      const response = await getConceptScheme(event)

      expect(response.statusCode).toBe(200)
      expect(response.headers['Content-Type']).toBe('application/xml; charset=utf-8')
      expect(response.body).toContain('<rdf:RDF')
      expect(response.body).toContain('<skos:ConceptScheme')
    })
  })

  describe('When the scheme is not found', () => {
    test('should return a 404 status code', async () => {
      getConceptSchemeDetails.mockResolvedValue(null)

      const event = {
        pathParameters: { schemeId: 'non-existent-scheme' },
        queryStringParameters: { version: 'published' }
      }

      const response = await getConceptScheme(event)

      expect(response.statusCode).toBe(404)
      expect(response.body).toContain('Scheme not found')
    })
  })

  describe('When an error occurs during processing', () => {
    test('should return a 500 status code', async () => {
      getConceptSchemeDetails.mockRejectedValue(new Error('Test error'))

      const event = {
        pathParameters: { schemeId: 'error-scheme' },
        queryStringParameters: { version: 'published' }
      }

      const response = await getConceptScheme(event)

      expect(response.statusCode).toBe(500)
      expect(response.body).toContain('Test error')
    })
  })

  describe('When no version is specified', () => {
    test('should use "published" as the default version', async () => {
      getConceptSchemeDetails.mockResolvedValue({
        uri: 'http://example.com/scheme',
        prefLabel: 'Test Scheme',
        notation: 'TEST',
        modified: '2023-06-01'
      })

      getVersionMetadata.mockResolvedValue({
        versionName: 'published',
        versionType: 'Published',
        created: '2023-06-01'
      })

      const event = {
        pathParameters: { schemeId: 'test-scheme' },
        queryStringParameters: {}
      }

      await getConceptScheme(event)

      expect(getConceptSchemeDetails).toHaveBeenCalledWith({
        schemeName: 'test-scheme',
        version: 'published'
      })
    })
  })

  describe('When the scheme has csvHeaders', () => {
    test('should include csvHeaders in the XML output', async () => {
      getConceptSchemeDetails.mockResolvedValue({
        uri: 'http://example.com/scheme',
        prefLabel: 'Test Scheme',
        notation: 'TEST',
        modified: '2023-06-01',
        csvHeaders: 'Header1,Header2,Header3'
      })

      getVersionMetadata.mockResolvedValue({
        versionName: '1.0',
        versionType: 'Published',
        created: '2023-06-01'
      })

      const event = {
        pathParameters: { schemeId: 'test-scheme' },
        queryStringParameters: { version: '1.0' }
      }

      const response = await getConceptScheme(event)

      expect(response.body).toContain('<gcmd:csvHeaders>Header1,Header2,Header3</gcmd:csvHeaders>')
    })
  })

  describe('When the version metadata includes lastSynced', () => {
    test('should include dcterms:modified in the XML output', async () => {
      getConceptSchemeDetails.mockResolvedValue({
        uri: 'http://example.com/scheme',
        prefLabel: 'Test Scheme',
        notation: 'TEST',
        modified: '2023-06-01'
      })

      getVersionMetadata.mockResolvedValue({
        versionName: '1.0',
        versionType: 'Published',
        created: '2023-06-01',
        lastSynced: '2023-06-02'
      })

      const event = {
        pathParameters: { schemeId: 'test-scheme' },
        queryStringParameters: { version: '1.0' }
      }

      const response = await getConceptScheme(event)

      expect(response.body).toContain('<dcterms:modified>2023-06-02</dcterms:modified>')
    })
  })

  describe('When custom response headers are set', () => {
    test('should include custom headers in the response', async () => {
      getConceptSchemeDetails.mockResolvedValue({
        uri: 'http://example.com/scheme',
        prefLabel: 'Test Scheme',
        notation: 'TEST',
        modified: '2023-06-01'
      })

      getVersionMetadata.mockResolvedValue({
        versionName: '1.0',
        versionType: 'Published',
        created: '2023-06-01'
      })

      const event = {
        pathParameters: { schemeId: 'test-scheme' },
        queryStringParameters: { version: '1.0' }
      }

      const response = await getConceptScheme(event)

      expect(response.headers['X-Custom-Header']).toBe('Value')
    })
  })

  describe('When the scheme has a created date', () => {
    test('should include dcterms:created in the XML output', async () => {
      getConceptSchemeDetails.mockResolvedValue({
        uri: 'http://example.com/scheme',
        prefLabel: 'Test Scheme',
        notation: 'TEST',
        modified: '2023-06-01',
        created: '2023-05-01'
      })

      getVersionMetadata.mockResolvedValue({
        versionName: '1.0',
        versionType: 'Published',
        created: '2023-06-01'
      })

      const event = {
        pathParameters: { schemeId: 'test-scheme' },
        queryStringParameters: { version: '1.0' }
      }

      const response = await getConceptScheme(event)

      expect(response.body).toContain('<dcterms:created>2023-05-01</dcterms:created>')
    })
  })
})
