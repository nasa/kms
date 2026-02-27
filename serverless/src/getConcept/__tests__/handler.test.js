import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcept } from '@/getConcept/handler'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import {
  createConceptToConceptSchemeShortNameMap
} from '@/shared/createConceptToConceptSchemeShortNameMap'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getCsvHeaders } from '@/shared/getCsvHeaders'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'
import { getCachedJsonResponse, setCachedJsonResponse } from '@/shared/redisCacheStore'
import { toLegacyJSON } from '@/shared/toLegacyJSON'
import { toLegacyXML } from '@/shared/toLegacyXML'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/getSkosConcept')
vi.mock('@/shared/getGcmdMetadata')
vi.mock('@/shared/createConceptSchemeMap')
vi.mock('@/shared/createPrefLabelMap')
vi.mock('@/shared/createConceptToConceptSchemeShortNameMap')
vi.mock('@/shared/getCsvHeaders')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/toLegacyJSON')
vi.mock('@/shared/toLegacyXML')
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/redisCacheStore', async () => {
  const actual = await vi.importActual('@/shared/redisCacheStore')

  return {
    ...actual,
    getCachedJsonResponse: vi.fn(),
    setCachedJsonResponse: vi.fn()
  }
})

describe('getConcept', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    createConceptSchemeMap.mockResolvedValue(new Map())
    createPrefLabelMap.mockResolvedValue(new Map())
    createConceptToConceptSchemeShortNameMap.mockResolvedValue(new Map())
    getCsvHeaders.mockResolvedValue([])
    getConceptSchemeDetails.mockResolvedValue({})
    toLegacyJSON.mockReturnValue({})
    toLegacyXML.mockReturnValue({})
    getCachedJsonResponse.mockResolvedValue(null)
    setCachedJsonResponse.mockResolvedValue(undefined)

    vi.mocked(getVersionMetadata).mockResolvedValue({
      version: 'published',
      versionName: '20.8',
      versionType: 'published',
      created: '2023-01-01T00:00:00Z',
      modified: '2023-01-01T00:00:00Z'
    })

    getGcmdMetadata.mockImplementation(async ({ version }) => {
      const versionInfo = await getVersionMetadata(version)

      return {
        'gcmd:keywordVersion': { _text: versionInfo?.versionName || 'n/a' },
        'gcmd:termsOfUse': { _text: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf' },
        'gcmd:viewer': { _text: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all' }
      }
    })
  })

  const mockSuccessfulResponse = (mockSkosConcept, mockVersionInfo = { versionName: '1.0' }) => {
    const mockGcmdMetadata = { 'gcmd:keywordVersion': { _text: mockVersionInfo.versionName } }
    getSkosConcept.mockResolvedValue(mockSkosConcept)
    getGcmdMetadata.mockResolvedValue(mockGcmdMetadata)
  }

  describe('version metadata handling', () => {
    test('should set keywordVersion and versionCreationDate when version metadata exists', async () => {
      const mockEvent = {
        pathParameters: { conceptId: '123' },
        queryStringParameters: { version: 'test_version' }
      }
      const mockSkosConcept = {
        '@rdf:about': '123',
        'skos:prefLabel': { _text: 'Test PrefLabel' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
      }
      const mockVersionInfo = {
        versionName: '1.2.3',
        created: '2023-06-15T00:00:00Z'
      }
      mockSuccessfulResponse(mockSkosConcept, mockVersionInfo)

      getVersionMetadata.mockResolvedValue(mockVersionInfo)

      const result = await getConcept(mockEvent)

      expect(result.statusCode).toBe(200)
      expect(result.body).toContain('<gcmd:keywordVersion>1.2.3</gcmd:keywordVersion>')
      expect(getGcmdMetadata).toHaveBeenCalledWith(expect.objectContaining({
        version: 'test_version'
      }))
    })

    test('should return 404 when version metadata does not exist', async () => {
      const mockEvent = {
        pathParameters: { conceptId: '123' },
        queryStringParameters: { version: 'non_existent_version' }
      }

      getVersionMetadata.mockResolvedValue(null)

      const result = await getConcept(mockEvent)

      expect(result.statusCode).toBe(404)
      expect(result.headers).toEqual(mockDefaultHeaders)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Invalid version parameter. Version not found'
      })
    })

    test('should use default version when not specified', async () => {
      const mockEvent = {
        pathParameters: { conceptId: '123' },
        queryStringParameters: {}
      }
      const mockSkosConcept = {
        '@rdf:about': '123',
        'skos:prefLabel': { _text: 'Test PrefLabel' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
      }
      mockSuccessfulResponse(mockSkosConcept)

      getVersionMetadata.mockResolvedValue({
        versionName: 'default',
        created: '2023-06-15T00:00:00Z'
      })

      await getConcept(mockEvent)

      expect(getVersionMetadata).toHaveBeenCalledWith('published')
    })
  })

  describe('when redis cache errors occur', () => {
    test('continues normally when redis concept cache read throws', async () => {
      getCachedJsonResponse.mockRejectedValue(new Error('cache read failed'))
      const mockSkosConcept = {
        '@rdf:about': '123',
        'skos:prefLabel': { _text: 'Test PrefLabel' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
      }
      mockSuccessfulResponse(mockSkosConcept)

      const result = await getConcept({
        pathParameters: { conceptId: '123' },
        queryStringParameters: {
          format: 'rdf',
          version: 'published'
        }
      })

      expect(result.statusCode).toBe(200)
    })

    test('continues normally when redis concept cache write throws', async () => {
      setCachedJsonResponse.mockRejectedValue(new Error('cache write failed'))
      const mockSkosConcept = {
        '@rdf:about': '123',
        'skos:prefLabel': { _text: 'Test PrefLabel' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
      }
      mockSuccessfulResponse(mockSkosConcept)

      const result = await getConcept({
        pathParameters: { conceptId: '123' },
        queryStringParameters: {
          format: 'rdf',
          version: 'published'
        }
      })

      expect(result.statusCode).toBe(200)
    })
  })

  describe('when successful', () => {
    describe('when redis cache has response', () => {
      test('returns cached payload for concept id lookup without querying RDF store', async () => {
        getCachedJsonResponse.mockResolvedValue({
          statusCode: 200,
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
          body: '<rdf:RDF/>'
        })

        const result = await getConcept({
          resource: '/concept/{conceptId}',
          path: '/concept/123',
          pathParameters: {
            conceptId: '123'
          },
          queryStringParameters: {
            version: 'published',
            format: 'rdf'
          }
        })

        expect(result.statusCode).toBe(200)
        expect(getSkosConcept).not.toHaveBeenCalled()
      })

      test('returns cached payload for full path lookup without querying RDF store', async () => {
        getCachedJsonResponse.mockResolvedValue({
          statusCode: 200,
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
          body: '<rdf:RDF/>'
        })

        const result = await getConcept({
          resource: '/concept/full_path/{fullPath+}',
          path: '/concept/full_path/platforms%7Cearth%20observation',
          pathParameters: {
            fullPath: 'platforms%7Cearth%20observation'
          },
          queryStringParameters: {
            version: 'published',
            format: 'rdf'
          }
        })

        expect(result.statusCode).toBe(200)
        expect(getSkosConcept).not.toHaveBeenCalled()
      })
    })

    describe('when retrieving by concept identifier', () => {
      test('returns concept in RDF/XML representation', async () => {
        const mockEvent = { pathParameters: { conceptId: '123' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<rdf:RDF')
        expect(result.body).toContain('<skos:Concept')
        expect(result.body).toContain('<gcmd:keywordVersion>1.0</gcmd:keywordVersion>')
      })
    })

    describe('when retrieving by short name', () => {
      test('should successfully retrieve concept using short name', async () => {
        const mockEvent = { pathParameters: { shortName: 'Test+Short+Name' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Short Name'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test Short Name'
        }))
      })
    })

    describe('when retrieving by altLabel', () => {
      test('should successfully retrieve concept using altLabel', async () => {
        const mockEvent = { pathParameters: { altLabel: 'Alt%2BLabel' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:altLabel': 'Alt+Label'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          altLabel: 'Alt+Label'
        }))
      })
    })

    describe('when retrieving by short name with a scheme', () => {
      test('should successfully retrieve concept using short name and scheme', async () => {
        const mockEvent = {
          pathParameters: { shortName: 'Test+Short+Name' },
          queryStringParameters: { scheme: 'Test%20Scheme' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': 'Test Short Name'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test Short Name',
          scheme: 'Test Scheme'
        }))
      })
    })

    describe('when retrieving by altLabel with scheme', () => {
      test('should successfully retrieve concept using altLabel and scheme', async () => {
        const mockEvent = {
          pathParameters: { altLabel: 'Alt%2BLabel' },
          queryStringParameters: { scheme: 'Test%20Scheme' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:altLabel': 'Alt+Label'
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          altLabel: 'Alt+Label',
          scheme: 'Test Scheme'
        }))
      })
    })

    describe('format handling', () => {
      test('returns RDF format by default', async () => {
        const mockEvent = { pathParameters: { conceptId: '123' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<rdf:RDF')
      })

      test('returns JSON format when specified', async () => {
        const mockEvent = {
          pathParameters: { conceptId: '123' },
          queryStringParameters: { format: 'json' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)
        toLegacyJSON.mockReturnValue({
          id: '123',
          label: 'Test Concept'
        })

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8')
        expect(() => JSON.parse(result.body)).not.toThrow()
        const parsedBody = JSON.parse(result.body)
        expect(parsedBody).toEqual({
          id: '123',
          label: 'Test Concept'
        })
      })

      test('returns XML format when specified', async () => {
        const mockEvent = {
          pathParameters: { conceptId: '123' },
          queryStringParameters: { format: 'xml' }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme/shortName' }
        }
        mockSuccessfulResponse(mockSkosConcept)
        toLegacyXML.mockReturnValue({
          concept: {
            '@id': '123',
            label: 'Test Concept'
          }
        })

        const result = await getConcept(mockEvent)

        expect(result.headers['Content-Type']).toBe('application/xml; charset=utf-8')
        expect(result.body).toContain('<concept id="123">')
        expect(result.body).toContain('<label>Test Concept</label>')
      })
    })

    describe('when writing responses to redis cache', () => {
      test('writes successful concept id responses to redis cache', async () => {
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept({
          resource: '/concept/{conceptId}',
          path: '/concept/123',
          pathParameters: {
            conceptId: '123'
          },
          queryStringParameters: {
            version: 'published',
            format: 'rdf'
          }
        })

        expect(result.statusCode).toBe(200)
        expect(setCachedJsonResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            cacheKey: expect.stringContaining('kms:concept:published:/concept/{conceptid}:/concept/123:rdf:123')
          })
        )
      })

      test('writes successful full path responses to redis cache', async () => {
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        const result = await getConcept({
          resource: '/concept/full_path/{fullPath+}',
          path: '/concept/full_path/platforms%7Cearth%20observation',
          pathParameters: {
            fullPath: 'platforms%7Cearth%20observation'
          },
          queryStringParameters: {
            version: 'published',
            format: 'rdf'
          }
        })

        expect(result.statusCode).toBe(200)
        expect(setCachedJsonResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            cacheKey: expect.stringContaining('kms:concept:published:/concept/full_path/{fullpath+}:/concept/full_path/platforms%7cearth%20observation:rdf')
          })
        )
      })
    })

    describe('decode function', () => {
      test('should decode URI encoded strings', async () => {
        const mockEvent = { pathParameters: { shortName: 'Test%20PrefLabel%2BWith%2BSpaces' } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel+With+Spaces' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: 'Test PrefLabel+With+Spaces'
        }))
      })

      test('should handle null values', async () => {
        const mockEvent = { pathParameters: { shortName: null } }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: null
        }))
      })

      test('should handle undefined values', async () => {
        const mockEvent = { pathParameters: {} }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Test PrefLabel' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: null,
          altLabel: null,
          conceptIRI: null
        }))
      })

      test('should handle missing pathParameters object', async () => {
        const mockEvent = {}
        getSkosConcept.mockResolvedValue(null)

        const result = await getConcept(mockEvent)

        expect(result.statusCode).toBe(404)
        expect(getSkosConcept).toHaveBeenCalledWith(expect.objectContaining({
          shortName: null,
          altLabel: null,
          conceptIRI: null
        }))
      })

      test('should use decoded values in getSkosConcept call', async () => {
        const mockEvent = {
          pathParameters: {
            shortName: 'Short%20Name',
            altLabel: 'Alt%2BLabel',
            fullPath: 'Full%20Path'
          },
          queryStringParameters: {
            scheme: 'Test%20Scheme'
          }
        }
        const mockSkosConcept = {
          '@rdf:about': '123',
          'skos:prefLabel': { _text: 'Short Name' },
          'skos:altLabel': { _text: 'Alt+Label' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/scheme' }
        }
        mockSuccessfulResponse(mockSkosConcept)

        await getConcept(mockEvent)

        expect(getSkosConcept).toHaveBeenCalledWith({
          conceptIRI: null,
          shortName: 'Short Name',
          altLabel: 'Alt+Label',
          fullPath: 'Full Path',
          scheme: 'Test Scheme',
          version: 'published'
        })
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors and return a 500 status code', async () => {
      const mockEvent = { pathParameters: { conceptId: '123' } }
      getSkosConcept.mockRejectedValue(new Error('Test error'))

      const result = await getConcept(mockEvent)

      expect(result.statusCode).toBe(500)
      expect(result.headers).toEqual(mockDefaultHeaders)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Error: Test error'
      })
    })

    test('should log the error', async () => {
      const mockEvent = { pathParameters: { conceptId: '123' } }
      const testError = new Error('Test error')
      getSkosConcept.mockRejectedValue(testError)
      const loggerErrorSpy = vi.spyOn(logger, 'error')

      await getConcept(mockEvent)

      expect(loggerErrorSpy).toHaveBeenCalledWith(`Error retrieving concept, error=${testError.toString()}`)
    })

    test('should return 404 when concept is not found', async () => {
      const mockEvent = { pathParameters: { conceptId: '123' } }
      getSkosConcept.mockResolvedValue(null)

      const result = await getConcept(mockEvent)

      expect(result.statusCode).toBe(404)
      expect(result.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(result.body)).toEqual({
        error: 'Concept not found'
      })
    })
  })
})
