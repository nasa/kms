import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { createSchemes } from '../createSchemes'

vi.mock('@/shared/sparqlRequest')

global.fetch = vi.fn()

describe('createSchemes', () => {
  const mockXmlResponse = `
    <schemes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd">
      <scheme updateDate="2025-03-03" longName="Chained Operations" name="ChainedOperations" id="6037"/>
      <scheme updateDate="2025-03-03" longName="Collection Data Type" name="CollectionDataType" id="6022"/>
      <scheme updateDate="2025-03-10" csvHeaders="Category,Topic,Term,Variable_Level_1,Variable_Level_2,Variable_Level_3,Detailed_Variable,UUID" longName="Science Keywords" name="sciencekeywords" id="6040"/>
    </schemes>
  `

  beforeEach(() => {
    vi.resetAllMocks()

    fetch.mockResolvedValue({
      text: () => Promise.resolve(mockXmlResponse)
    })

    XMLParser.prototype.parse = vi.fn().mockReturnValue({
      schemes: {
        scheme: [
          {
            '@_updateDate': '2025-03-03',
            '@_longName': 'Chained Operations',
            '@_name': 'ChainedOperations',
            '@_id': '6037'
          },
          {
            '@_updateDate': '2025-03-03',
            '@_longName': 'Collection Data Type',
            '@_name': 'CollectionDataType',
            '@_id': '6022'
          },
          {
            '@_updateDate': '2025-03-10',
            '@_csvHeaders': 'Category,Topic,Term,Variable_Level_1,Variable_Level_2,Variable_Level_3,Detailed_Variable,UUID',
            '@_longName': 'Science Keywords',
            '@_name': 'sciencekeywords',
            '@_id': '6040'
          }
        ]
      }
    })

    XMLBuilder.prototype.build = vi.fn().mockReturnValue('<mocked-xml></mocked-xml>')

    sparqlRequest.mockResolvedValue({ status: 200 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should fetch and process schemes correctly', async () => {
    const versionType = 'draft'
    const version = '1.0'

    await createSchemes(versionType, version)

    expect(fetch).toHaveBeenCalledWith('http://gcmd.earthdata.nasa.gov/kms/concept_schemes?version=1.0')

    const buildCall = XMLBuilder.prototype.build.mock.calls[0][0]

    expect(buildCall['rdf:RDF']['skos:ConceptScheme']).toHaveLength(3)
    expect(buildCall['rdf:RDF']['skos:ConceptScheme'][0]['skos:notation']).toBe('ChainedOperations')
    expect(buildCall['rdf:RDF']['skos:ConceptScheme'][2]['gcmd:csvHeaders']).toBe('Category,Topic,Term,Variable_Level_1,Variable_Level_2,Variable_Level_3,Detailed_Variable,UUID')

    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: '<mocked-xml></mocked-xml>',
      version: '1.0'
    })
  })

  test('should use the most recent update date', async () => {
    const versionType = 'draft'
    const version = '1.0'

    await createSchemes(versionType, version)

    const buildCall = XMLBuilder.prototype.build.mock.calls[0][0]

    expect(buildCall['rdf:RDF']['gcmd:Version']['dcterms:modified']).toBe('2025-03-10T00:00:00.000Z')
    expect(buildCall['rdf:RDF']['gcmd:Version']['dcterms:created']).toBe('2025-03-10T00:00:00.000Z')
  })

  test('should handle schemes without csvHeaders', async () => {
    const versionType = 'published'
    const version = null

    await createSchemes(versionType, version)

    expect(fetch).toHaveBeenCalledWith('http://gcmd.earthdata.nasa.gov/kms/concept_schemes')

    const buildCall = XMLBuilder.prototype.build.mock.calls[0][0]
    expect(buildCall['rdf:RDF']['skos:ConceptScheme'][0]['gcmd:csvHeaders']).toBeUndefined()
  })

  test('should handle errors gracefully', async () => {
    const versionType = 'draft'
    const version = '1.0'

    fetch.mockRejectedValue(new Error('Network error'))

    await expect(createSchemes(versionType, version)).rejects.toThrow('Network error')
  })

  test('should handle empty schemes', async () => {
    const versionType = 'draft'
    const version = '1.0'

    XMLParser.prototype.parse = vi.fn().mockReturnValue({
      schemes: {
        scheme: []
      }
    })

    await createSchemes(versionType, version)

    const buildCall = XMLBuilder.prototype.build.mock.calls[0][0]
    expect(buildCall['rdf:RDF']['skos:ConceptScheme']).toEqual([])
    expect(buildCall['rdf:RDF']['gcmd:Version']['dcterms:modified']).toBe('1970-01-01T00:00:00.000Z')
  })
})
