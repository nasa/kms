import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import toLegacyJSON from '../toLegacyJSON'

describe('toLegacyJSON', () => {
  let mockSkosConcept
  let mockConceptSchemeMap
  let mockPrefLabelMap
  let mockShortNameMap

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
      }
    }

    mockConceptSchemeMap = new Map([
      ['testScheme', 'Test Scheme'],
      ['testBroaderScheme', 'Test Broader Scheme'],
      ['testNarrowerScheme', 'Test Narrower Scheme'],
      ['testRelatedScheme', 'Test Related Scheme']
    ])

    mockPrefLabelMap = new Map([
      ['testUUID', 'Test Concept'],
      ['broaderUUID', 'Broader Concept'],
      ['narrowerUUID1', 'Narrower Concept 1'],
      ['narrowerUUID2', 'Narrower Concept 2'],
      ['relatedUUID1', 'Related Concept 1'],
      ['relatedUUID2', 'Related Concept 2']
    ])

    mockShortNameMap = new Map([
      ['testUUID', 'testScheme'],
      ['broaderUUID', 'testBroaderScheme'],
      ['narrowerUUID1', 'testNarrowerScheme'],
      ['narrowerUUID2', 'testNarrowerScheme'],
      ['relatedUUID1', 'testRelatedScheme'],
      ['relatedUUID2', 'testRelatedScheme']
    ])
  })

  describe('when given a basic skos concept', () => {
    test('should return legacy JSON', () => {
      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

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
    test('should return correct broader information', () => {
      mockSkosConcept['skos:broader'] = { '@rdf:resource': 'broaderUUID' }

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.broader).toEqual([{
        uuid: 'broaderUUID',
        prefLabel: 'Broader Concept',
        scheme: {
          shortName: 'testBroaderScheme',
          longName: 'Test Broader Scheme'
        }
      }])
    })
  })

  describe('when provided with narrower data', () => {
    test('should return correct narrower information for multiple narrowers', () => {
      mockSkosConcept['skos:narrower'] = [
        { '@rdf:resource': 'narrowerUUID1' },
        { '@rdf:resource': 'narrowerUUID2' }
      ]

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.narrower).toEqual([
        {
          uuid: 'narrowerUUID1',
          prefLabel: 'Narrower Concept 1',
          scheme: {
            shortName: 'testNarrowerScheme',
            longName: 'Test Narrower Scheme'
          }
        },
        {
          uuid: 'narrowerUUID2',
          prefLabel: 'Narrower Concept 2',
          scheme: {
            shortName: 'testNarrowerScheme',
            longName: 'Test Narrower Scheme'
          }
        }
      ])
    })

    test('should return correct narrower information for a single narrower concept', () => {
      mockSkosConcept['skos:narrower'] = { '@rdf:resource': 'narrowerUUID1' }

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.narrower).toEqual([
        {
          uuid: 'narrowerUUID1',
          prefLabel: 'Narrower Concept 1',
          scheme: {
            shortName: 'testNarrowerScheme',
            longName: 'Test Narrower Scheme'
          }
        }
      ])
    })
  })

  describe('when provided with related data', () => {
    test('should return correct related information for hasInstrument', () => {
      mockSkosConcept['gcmd:hasInstrument'] = [
        { '@rdf:resource': 'relatedUUID1' },
        { '@rdf:resource': 'relatedUUID2' }
      ]

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.related).toEqual([
        {
          uuid: 'relatedUUID1',
          prefLabel: 'Test Concept',
          scheme: {
            shortName: 'testRelatedScheme',
            longName: 'Test Related Scheme'
          },
          type: 'has_instrument'
        },
        {
          uuid: 'relatedUUID2',
          prefLabel: 'Test Concept',
          scheme: {
            shortName: 'testRelatedScheme',
            longName: 'Test Related Scheme'
          },
          type: 'has_instrument'
        }
      ])
    })

    test('should return correct related information for isOnPlatform', () => {
      mockSkosConcept['gcmd:isOnPlatform'] = [
        { '@rdf:resource': 'relatedUUID1' },
        { '@rdf:resource': 'relatedUUID2' }
      ]

      mockShortNameMap.set('relatedUUID1', 'testRelatedScheme')
      mockShortNameMap.set('relatedUUID2', 'testRelatedScheme')

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.related).toEqual([
        {
          uuid: 'relatedUUID1',
          prefLabel: 'Test Concept',
          scheme: {
            shortName: 'testRelatedScheme',
            longName: 'Test Related Scheme'
          },
          type: 'is_on_platform'
        },
        {
          uuid: 'relatedUUID2',
          prefLabel: 'Test Concept',
          scheme: {
            shortName: 'testRelatedScheme',
            longName: 'Test Related Scheme'
          },
          type: 'is_on_platform'
        }
      ])
    })
  })

  describe('when provided with a definition and no reference', () => {
    test('should return correctly formatted definition', () => {
      mockSkosConcept['gcmd:reference'] = {
        '@gcmd:text': '',
        '@xml:lang': 'en'
      }

      mockSkosConcept['skos:definition'] = {
        _text: 'Definition Text',
        '@xml:lang': 'en'
      }

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.definitions).toEqual([
        {
          text: 'Definition Text',
          reference: ''
        }
      ])
    })
  })

  describe('when provided with no definition', () => {
    test('should return empty definitions array', () => {
      delete mockSkosConcept['skos:definition']
      delete mockSkosConcept['gcmd:reference']

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.definitions).toEqual([])
    })
  })

  describe('when provided altLabel information', () => {
    test('should return multiple altLabels when multiple altLabels are provided', () => {
      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

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

    test('should return a single altLabel when only one is provided', () => {
      mockSkosConcept['gcmd:altLabel'] = {
        '@gcmd:text': 'Alternative Label 1',
        '@gcmd:category': 'primary'
      }

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.altLabels).toEqual([{
        text: 'Alternative Label 1',
        category: 'primary'
      }])
    })

    test('should return empty altLabels if no altLabels are provided', () => {
      delete mockSkosConcept['gcmd:altLabel']

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.altLabels).toEqual([])
    })
  })

  describe('when there is an error converting to JSON', () => {
    test('should throw an appropriate error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      // Cause an error by providing invalid data
      const invalidSkosConcept = {
        '@rdf:about': undefined
      }

      expect(() => toLegacyJSON(
        invalidSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      ))
        .toThrow('Failed to convert concept to JSON')

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error converting concept to JSON'))
    })
  })

  describe('when the concept has no narrower concepts', () => {
    test('should set isLeaf to true', () => {
      delete mockSkosConcept['skos:narrower']

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.isLeaf).toBe(true)
    })
  })

  describe('when the concept has narrower concepts', () => {
    test('should set isLeaf to false', () => {
      mockSkosConcept['skos:narrower'] = [{ '@rdf:resource': 'narrowerUUID1' }]

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.isLeaf).toBe(false)
    })
  })

  describe('when the concept has a resource', () => {
    test('should include the resource in the output', () => {
      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.resources).toEqual([{
        type: 'image',
        url: 'https://example.com/image.jpg'
      }])
    })
  })

  describe('when the concept has no resource', () => {
    test('should return an empty array for resources', () => {
      delete mockSkosConcept['gcmd:resource']

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.resources).toEqual([])
    })
  })

  describe('when the concept has both hasInstrument and isOnPlatform relations', () => {
    test('should include both types of relations in the related array', () => {
      mockSkosConcept['gcmd:hasInstrument'] = { '@rdf:resource': 'relatedUUID1' }
      mockSkosConcept['gcmd:isOnPlatform'] = { '@rdf:resource': 'relatedUUID2' }

      const result = toLegacyJSON(
        mockSkosConcept,
        mockConceptSchemeMap,
        mockPrefLabelMap,
        mockShortNameMap
      )

      expect(result.related).toEqual([
        {
          uuid: 'relatedUUID1',
          prefLabel: 'Test Concept',
          scheme: {
            shortName: 'testRelatedScheme',
            longName: 'Test Related Scheme'
          },
          type: 'has_instrument'
        },
        {
          uuid: 'relatedUUID2',
          prefLabel: 'Test Concept',
          scheme: {
            shortName: 'testRelatedScheme',
            longName: 'Test Related Scheme'
          },
          type: 'is_on_platform'
        }
      ])
    })
  })
})
