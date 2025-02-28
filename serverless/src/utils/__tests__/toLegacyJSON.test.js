import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import getConceptSchemes from '@/getConceptSchemes/handler'
import {getSkosConcept} from '@/shared/getSkosConcept'

import toLegacyJSON from '../toLegacyJSON'

// Mock the imported functions
vi.mock('@/getConceptSchemes/handler')
vi.mock('@/shared/getSkosConcept')

describe('toLegacyJSON', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  getSkosConcept.mockResolvedValue({
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
  })

  getConceptSchemes.mockResolvedValue({
    body: `<schemes>
      <scheme name="testScheme" longName="Test Scheme"/>
      <scheme name="testScheme 2" longName="Test Scheme 2"/>
    </schemes>`
  })

  describe('when given a basic skos concept', () => {
    test('returns legacy JSON', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = await getSkosConcept({ conceptIRI })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

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
        definitions: [
          {
            text: 'This is a test concept definition',
            reference: 'https://example.com/reference'
          }
        ],
        altLabels: [
          {
            category: 'primary',
            text: 'Alternative Label 1'
          },
          {
            text: 'Alternative Label 2'
          }
        ],
        resources: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg'
          }
        ]
      })
    })
  })

  describe('when provided with broader data', () => {
    test('returns correct broader information', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        ...await getSkosConcept({ conceptIRI }),
        'skos:broader': { '@rdf:resource': 'broaderUUID' }
      }

      getSkosConcept.mockResolvedValueOnce({
        '@rdf:about': 'broaderUUID',
        'skos:prefLabel': { _text: 'Broader Concept' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' }
      })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

      expect(result.broader).toEqual([{
        uuid: 'broaderUUID',
        prefLabel: 'Broader Concept',
        isLeaf: false,
        scheme: {
          shortName: 'testScheme',
          longName: 'Test Scheme'
        }
      }])
    })
  })

  describe('when provided with narrower data', () => {
    test('returns correct narrower information', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        ...await getSkosConcept({ conceptIRI }),
        'skos:narrower': [
          { '@rdf:resource': 'narrowerUUID1' },
          { '@rdf:resource': 'narrowerUUID2' }
        ]
      }

      // Mock responses for narrower concepts
      getSkosConcept
        .mockResolvedValueOnce({
          '@rdf:about': 'narrowerUUID1',
          'skos:prefLabel': { _text: 'Narrower Concept 1' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' }
        })
        .mockResolvedValueOnce({
          '@rdf:about': 'narrowerUUID2',
          'skos:prefLabel': { _text: 'Narrower Concept 2' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' }
        })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

      expect(result.narrower).toEqual([
        {
          uuid: 'narrowerUUID1',
          prefLabel: 'Narrower Concept 1',
          isLeaf: true,
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          }
        },
        {
          uuid: 'narrowerUUID2',
          prefLabel: 'Narrower Concept 2',
          isLeaf: true,
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          }
        }
      ])
    })
  })

  describe('when provided with related data', () => {
    test('returns correct related information', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        ...await getSkosConcept({ conceptIRI }),
        'skos:related': [
          { '@rdf:resource': 'relatedUUID1' },
          { '@rdf:resource': 'relatedUUID2' }
        ]
      }

      // Mock responses for related concepts
      getSkosConcept
        .mockResolvedValueOnce({
          '@rdf:about': 'relatedUUID1',
          'skos:prefLabel': { _text: 'Related Concept 1' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' },
          'gcmd:type': 'hasInstrument'
        })
        .mockResolvedValueOnce({
          '@rdf:about': 'relatedUUID2',
          'skos:prefLabel': { _text: 'Related Concept 2' },
          'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' },
          'gcmd:type': 'onPlatform'
        })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

      expect(result.related).toEqual([
        {
          uuid: 'relatedUUID1',
          prefLabel: 'Related Concept 1',
          isLeaf: true, // Assuming no narrower concepts
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          },
          type: 'has_instrument'
        },
        {
          uuid: 'relatedUUID2',
          prefLabel: 'Related Concept 2',
          isLeaf: true,
          scheme: {
            shortName: 'testScheme',
            longName: 'Test Scheme'
          },
          type: 'on_platform'
        }
      ])
    })
  })

  describe('when provided with a definition and no reference', () => {
    test('returns correctly formatted definition', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        ...await getSkosConcept({ conceptIRI }),
        'gcmd:reference': {
          '@gcmd:text': '',
          '@xml:lang': 'en'
        },
        'skos:definition': {
          _text: 'Definition Text',
          '@xml:lang': 'en'
        }
      }

      const result = await toLegacyJSON(conceptIRI, skosConcept)
      console.log('🚀 ~ test ~ result:', result)

      expect(result.definitions).toEqual([
        {
          text: 'Definition Text',
          reference: ''
        }
      ])
    })
  })

  describe('when provided altLabel information', () => {
    test('returns multiple altLables when multiple altLabels are provided', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = await getSkosConcept({ conceptIRI })

      // Mock getConceptSchemes to return a valid response
      getConceptSchemes.mockResolvedValue({
        body: `<schemes>
          <scheme name="testScheme" longName="Test Scheme"/>
          <scheme name="testScheme2" longName="Test Scheme 2"/>
        </schemes>`
      })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

      // Check that altLabels is an empty array
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

    test('returns a single altLabel when only one is provided', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        '@rdf:about': 'testUUID',
        'skos:prefLabel': { _text: 'Test Concept' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' },
        'gcmd:altLabel': {
          '@gcmd:text': 'Alternative Label 1',
          '@gcmd:category': 'primary'
        }
      }

      // Mock getConceptSchemes to return a valid response
      getConceptSchemes.mockResolvedValue({
        body: `<schemes>
          <scheme name="testScheme" longName="Test Scheme"/>
          <scheme name="testScheme2" longName="Test Scheme 2"/>
        </schemes>`
      })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

      // Check that altLabels is an empty array
      expect(result.altLabels).toEqual([{
        text: 'Alternative Label 1',
        category: 'primary'
      }])
    })

    test('returns empty altLabels if no altLabels are provided', async () => {
      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        '@rdf:about': 'testUUID',
        'skos:prefLabel': { _text: 'Test Concept' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' },
        'dcterms:modified': '2023-01-01'
        // Note: gcmd:altLabel is intentionally omitted
      }

      // Mock getConceptSchemes to return a valid response
      getConceptSchemes.mockResolvedValue({
        body: `<schemes>
          <scheme name="testScheme" longName="Test Scheme"/>
          <scheme name="testScheme2" longName="Test Scheme 2"/>
        </schemes>`
      })

      const result = await toLegacyJSON(conceptIRI, skosConcept)

      // Check that altLabels is an empty array
      expect(result.altLabels).toEqual([])
    })
  })

  describe('when there is an error converting to JSON', () => {
    test('return appropriate error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      // Mock an error in getConceptSchemes
      getConceptSchemes.mockRejectedValueOnce(new Error('Failed to fetch concept schemes'))

      const conceptIRI = 'http://example.com/concept/testUUID'
      const skosConcept = {
        '@rdf:about': 'testUUID',
        'skos:prefLabel': { _text: 'Test Concept' },
        'skos:inScheme': { '@rdf:resource': 'https://example.com/testScheme' }
      }

      // Use async/await with expect().rejects to test for thrown errors
      await expect(toLegacyJSON(conceptIRI, skosConcept)).rejects.toThrow('Failed to convert concept to JSON: Failed to fetch concept schemes')

      // Verify that the error was logged
      expect(console.error).toHaveBeenCalledWith('Error converting concept to JSON: Failed to fetch concept schemes')
    })
  })
})
