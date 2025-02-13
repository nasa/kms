import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getConcept from '../handler'
import { getApplicationConfig } from '../../utils/getConfig'
import getSkosConcept from '../../utils/getSkosConcept'
import getGcmdMetadata from '../../utils/getGcmdMetadata'

// Mock the dependencies
vi.mock('../../utils/getConfig')
vi.mock('../../utils/getSkosConcept')
vi.mock('../../utils/getConceptScheme')
vi.mock('../../utils/getGcmdMetadata')

describe('getConcept', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }
  const mockConceptId = '123'
  const mockEvent = {
    pathParameters: { conceptId: mockConceptId }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  it('should successfully retrieve a concept and return RDF/XML', async () => {
    const mockSkosConcept = {
      '@rdf:about': mockConceptId,
      'skos:prefLabel': 'Test Concept'
    }
    const mockGcmdMetadata = { 'gcmd:keywordVersion': { _text: '1.0' } }

    getSkosConcept.mockResolvedValue(mockSkosConcept)
    getGcmdMetadata.mockResolvedValue(mockGcmdMetadata)

    const result = await getConcept(mockEvent)

    expect(result.headers).toEqual({
      ...mockDefaultHeaders,
      'Content-Type': 'application/xml; charset=utf-8'
    })

    expect(result.body).toContain('<rdf:RDF')
    expect(result.body).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
    expect(result.body).toContain('xmlns:skos="http://www.w3.org/2004/02/skos/core#"')
    expect(result.body).toContain('xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"')
    expect(result.body).toContain('<skos:Concept')
    expect(result.body).toContain('<gcmd:gcmd')
    expect(result.body).toContain('<gcmd:keywordVersion>1.0</gcmd:keywordVersion>')
  })

  it('should handle errors and return a 500 status code', async () => {
    getSkosConcept.mockRejectedValue(new Error('Test error'))

    const result = await getConcept(mockEvent)

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(mockDefaultHeaders)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Test error'
    })
  })
})
