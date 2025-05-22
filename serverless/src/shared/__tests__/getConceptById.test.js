import { XMLBuilder } from 'fast-xml-parser'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptById } from '@/shared/getConceptById'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'

vi.mock('@/shared/getSkosConcept')
vi.mock('@/shared/getGcmdMetadata')
vi.mock('fast-xml-parser')

describe('getConceptById', () => {
  const mockConceptId = '123'
  const mockVersion = 'draft'
  const mockConceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`
  const mockConcept = {
    '@rdf:about': mockConceptId,
    'skos:prefLabel': 'Test Concept'
  }
  const mockGcmdMetadata = { 'dcterms:modified': '2023-05-22' }

  beforeEach(() => {
    vi.resetAllMocks()

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    getSkosConcept.mockResolvedValue(mockConcept)
    getGcmdMetadata.mockResolvedValue(mockGcmdMetadata)
    XMLBuilder.prototype.build = vi.fn().mockReturnValue('<rdf:RDF>mocked XML</rdf:RDF>')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when successful', () => {
    test('should return RDF/XML for an existing concept', async () => {
      const result = await getConceptById(mockConceptId, mockVersion)

      expect(getSkosConcept).toHaveBeenCalledWith({
        conceptIRI: mockConceptIRI,
        version: mockVersion
      })

      expect(getGcmdMetadata).toHaveBeenCalledWith({
        conceptIRI: mockConceptIRI,
        version: mockVersion
      })

      expect(result).toBe('<rdf:RDF>mocked XML</rdf:RDF>')
    })

    test('should use default version when not provided', async () => {
      await getConceptById(mockConceptId)

      expect(getSkosConcept).toHaveBeenCalledWith({
        conceptIRI: mockConceptIRI,
        version: 'published'
      })
    })
  })

  describe('when errors occur', () => {
    test('should return null when concept is not found', async () => {
      getSkosConcept.mockResolvedValue(null)

      const result = await getConceptById(mockConceptId, mockVersion)

      expect(result).toBeNull()
    })

    test('should throw an error when getSkosConcept fails', async () => {
      getSkosConcept.mockRejectedValue(new Error('Network error'))

      await expect(getConceptById(mockConceptId, mockVersion)).rejects.toThrow('Network error')
    })

    test('should throw an error when getGcmdMetadata fails', async () => {
      getGcmdMetadata.mockRejectedValue(new Error('Metadata error'))

      await expect(getConceptById(mockConceptId, mockVersion)).rejects.toThrow('Metadata error')
    })

    test('should throw an error when XMLBuilder fails', async () => {
      XMLBuilder.prototype.build = vi.fn().mockImplementation(() => {
        throw new Error('XML build error')
      })

      await expect(getConceptById(mockConceptId, mockVersion)).rejects.toThrow('XML build error')
    })
  })

  describe('when building RDF/XML', () => {
    test('should build XML with correct structure', async () => {
      await getConceptById(mockConceptId, mockVersion)

      expect(XMLBuilder.prototype.build).toHaveBeenCalledWith(expect.objectContaining({
        'rdf:RDF': expect.objectContaining({
          '@xml:base': 'https://gcmd.earthdata.nasa.gov/kms/concept/',
          'gcmd:gcmd': mockGcmdMetadata,
          'skos:Concept': [mockConcept]
        })
      }))
    })

    test('should include namespaces in the XML', async () => {
      await getConceptById(mockConceptId, mockVersion)

      expect(XMLBuilder.prototype.build).toHaveBeenCalledWith(expect.objectContaining({
        'rdf:RDF': expect.objectContaining({
          '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
          '@xmlns:dcterms': 'http://purl.org/dc/terms/',
          '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#'
        })
      }))
    })
  })

  describe('edge cases', () => {
    test('should handle concepts with no properties', async () => {
      getSkosConcept.mockResolvedValue({ '@rdf:about': mockConceptId })

      await getConceptById(mockConceptId, mockVersion)

      expect(XMLBuilder.prototype.build).toHaveBeenCalledWith(expect.objectContaining({
        'rdf:RDF': expect.objectContaining({
          'skos:Concept': [{ '@rdf:about': mockConceptId }]
        })
      }))
    })

    test('should handle very large concepts', async () => {
      const largeConcept = { '@rdf:about': mockConceptId }
      for (let i = 0; i < 1000; i += 1) {
        largeConcept[`property${i}`] = `value${i}`
      }

      getSkosConcept.mockResolvedValue(largeConcept)

      const result = await getConceptById(mockConceptId, mockVersion)

      expect(result).toBe('<rdf:RDF>mocked XML</rdf:RDF>')
    })
  })

  describe('input validation', () => {
    test('should throw an error for invalid conceptId', async () => {
      await expect(getConceptById('', mockVersion)).rejects.toThrow()
    })

    test('should handle special characters in conceptId', async () => {
      const specialConceptId = 'test/special?id#123'
      await getConceptById(specialConceptId, mockVersion)

      expect(getSkosConcept).toHaveBeenCalledWith({
        conceptIRI: `https://gcmd.earthdata.nasa.gov/kms/concept/${specialConceptId}`,
        version: mockVersion
      })
    })
  })
})
