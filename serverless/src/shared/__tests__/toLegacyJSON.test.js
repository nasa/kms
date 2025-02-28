import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import toLegacyJSON from '../toLegacyJSON'

describe('toLegacyJSON', () => {
  let mockSkosConcept; let mockConceptSchemeMap; let
    mockPrefLabelMap

  beforeEach(() => {
    vi.clearAllMocks()

    mockSkosConcept = {
      '@rdf:about': 'testUUID',
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' },
      'dcterms:modified': '2023-01-01',
      'skos:definition': { _text: 'This is a test concept definition' },
      'gcmd:reference': { '@gcmd:text': 'https://example.com/reference' },
      'gcmd:altLabel': [
        {
          '@gcmd:text': 'Alternative Label 1',
          '@gcmd:category': 'primary'
        },
        { '@gcmd:text': 'Alternative Label 2' }
      ],
      'gcmd:resource': {
        '@gcmd:type': 'image',
        '@gcmd:url': 'https://example.com/image.jpg'
      },
      'gcmd:type': 'hasInstrument'
    }

    mockConceptSchemeMap = new Map([
      ['testScheme', 'Test Scheme']
    ])

    mockPrefLabelMap = new Map([
      ['testUUID', 'Test Concept'],
      ['broaderUUID', 'Broader Concept'],
      ['narrowerUUID1', 'Narrower Concept 1'],
      ['narrowerUUID2', 'Narrower Concept 2'],
      ['relatedUUID1', 'Related Concept 1'],
      ['relatedUUID2', 'Related Concept 2']
    ])
  })

  describe('when given a basic skos concept', () => {
    test('should return legacy JSON', async () => {
      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result).toEqual({
        termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
        keywordVersion: '20.6',
        schemeVersion: '2025-01-31 11:22:12',
        viewer: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/testScheme/testUUID',
        lastModifiedDate: '2023-01-01',
        uuid: 'testUUID',
        prefLabel: 'Test Concept',
        isLeaf: true,
        scheme: {
          shortName: 'testScheme',
          longName: 'Test Scheme'
        },
        broader: [],
        narrower: [],
        related: [],
        definitions: [{
          text: 'This is a test concept definition',
          reference: 'https://example.com/reference'
        }],
        altLabels: [
          {
            category: 'primary',
            text: 'Alternative Label 1'
          },
          { text: 'Alternative Label 2' }
        ],
        resources: [{
          type: 'image',
          url: 'https://example.com/image.jpg'
        }]
      })
    })
  })

  describe('when provided with broader data', () => {
    test('should return correct broader information', async () => {
      mockSkosConcept['skos:broader'] = { '@rdf:resource': 'broaderUUID' }

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.broader).toEqual([{
        uuid: 'broaderUUID',
        prefLabel: 'Broader Concept',
        scheme: {
          shortName: 'testScheme',
          longName: 'Test Scheme'
        }
      }])
    })
  })

  describe('when provided with narrower data', () => {
    test('should return correct narrower information', async () => {
      mockSkosConcept['skos:narrower'] = [
        { '@rdf:resource': 'narrowerUUID1' },
        { '@rdf:resource': 'narrowerUUID2' }
      ]

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.narrower).toEqual([
        {
          uuid: 'narrowerUUID1',
          prefLabel: 'Narrower Concept 1',
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          }
        },
        {
          uuid: 'narrowerUUID2',
          prefLabel: 'Narrower Concept 2',
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          }
        }
      ])
    })
  })

  describe('when provided with related data', () => {
    test('should return correct related information', async () => {
      mockSkosConcept['skos:related'] = [
        { '@rdf:resource': 'relatedUUID1' },
        { '@rdf:resource': 'relatedUUID2' }
      ]

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.related).toEqual([
        {
          uuid: 'relatedUUID1',
          prefLabel: 'Related Concept 1',
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          },
          type: 'has_instrument'
        },
        {
          uuid: 'relatedUUID2',
          prefLabel: 'Related Concept 2',
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          },
          type: 'has_instrument'
        }
      ])
    })
  })

  describe('when provided with a definition and no reference', () => {
    test('should return correctly formatted definition', async () => {
      mockSkosConcept['gcmd:reference'] = {
        '@gcmd:text': '',
        '@xml:lang': 'en'
      }

      mockSkosConcept['skos:definition'] = {
        _text: 'Definition Text',
        '@xml:lang': 'en'
      }

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.definitions).toEqual([
        {
          text: 'Definition Text',
          reference: ''
        }
      ])
    })
  })

  describe('when provided with no definition', () => {
    test('should return correctly formatted definition', async () => {
      delete mockSkosConcept['skos:definition']
      delete mockSkosConcept['gcmd:reference']

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.definitions).toEqual([])
    })
  })

  describe('when provided altLabel information', () => {
    test('should return multiple altLabels when multiple altLabels are provided', async () => {
      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.altLabels).toEqual([
        {
          text: 'Alternative Label 1',
          category: 'primary'
        },
        {
          text: 'Alternative Label 2'
        }
      ])
    })

    test('should return a single altLabel when only one is provided', async () => {
      mockSkosConcept['gcmd:altLabel'] = {
        '@gcmd:text': 'Alternative Label 1',
        '@gcmd:category': 'primary'
      }

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.altLabels).toEqual([{
        text: 'Alternative Label 1',
        category: 'primary'
      }])
    })

    test('should return empty altLabels if no altLabels are provided', async () => {
      delete mockSkosConcept['gcmd:altLabel']

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.altLabels).toEqual([])
    })
  })

  describe('when there is an error converting to JSON', () => {
    test('should throw an appropriate error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      // Cause an error by providing invalid data
      const invalidSkosConcept = {
        ...mockSkosConcept,
        'skos:inScheme': {} // Remove the @rdf:resource property to cause an error
      }

      expect(() => toLegacyJSON(invalidSkosConcept, mockConceptSchemeMap, mockPrefLabelMap))
        .toThrow('Failed to convert concept to JSON')

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error converting concept to JSON'))
    })
  })

  describe('when the concept has no narrower concepts', () => {
    test('should set isLeaf to true', async () => {
      delete mockSkosConcept['skos:narrower']

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.isLeaf).toBe(true)
    })
  })

  describe('when the concept has narrower concepts', () => {
    test('should set isLeaf to false', async () => {
      mockSkosConcept['skos:narrower'] = [{ '@rdf:resource': 'narrowerUUID1' }]

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.isLeaf).toBe(false)
    })
  })

  describe('when the concept has a resource', () => {
    test('should include the resource in the output', async () => {
      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.resources).toEqual([{
        type: 'image',
        url: 'https://example.com/image.jpg'
      }])
    })
  })

  describe('when the concept has no resource', () => {
    test('should return an empty array for resources', async () => {
      delete mockSkosConcept['gcmd:resource']

      const result = await toLegacyJSON(mockSkosConcept, mockConceptSchemeMap, mockPrefLabelMap)

      expect(result.resources).toEqual([])
    })
  })
})
