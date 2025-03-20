import {
  describe,
  expect,
  test
} from 'vitest'

import { toLegacyXML } from '../toLegacyXML'

describe('toLegacyXML', () => {
  const mockConceptToConceptSchemeShortNameMap = new Map([
    ['testUUID', 'testScheme'],
    ['broaderUUID', 'testBroaderScheme'],
    ['narrowerUUID1', 'testNarrowerScheme'],
    ['narrowerUUID2', 'testNarrowerScheme'],
    ['relatedUUID1', 'testRelatedScheme'],
    ['relatedUUID2', 'testRelatedScheme']
  ])

  const mockConceptSchemeDetails = [
    {
      notation: 'testScheme',
      prefLabel: 'Test Scheme',
      modified: '2023-01-01'
    }
  ]

  const mockCsvHeaders = ['Header1', 'Header2']

  const mockPrefLabelMap = new Map([
    ['http://example.com/broader', 'Broader Concept'],
    ['http://example.com/narrower1', 'Narrower Concept 1'],
    ['http://example.com/narrower2', 'Narrower Concept 2'],
    ['http://example.com/instrument', 'Test Instrument'],
    ['http://example.com/platform', 'Test Platform'],
    ['http://example.com/sensor', 'Test Sensor'],
    ['http://example.com/sciencekeyword', 'Test Science Keyword']
  ])

  describe('when processing a basic concept', () => {
    test('should correctly transform basic concept properties', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'dcterms:modified': '2023-01-01 12:00:00'
      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(result.concept['@uuid']).toBe('http://example.com/concept')
      expect(result.concept.prefLabel).toBe('Test Concept')
      expect(result.concept.lastModifiedDate).toBe('2023-01-01')
      expect(result.concept.conceptScheme['@name']).toBe('testScheme')
      expect(result.concept.conceptScheme['@longName']).toBe('Test Scheme')
    })
  })

  describe('when processing a concept with hierarchical relationships', () => {
    test('should correctly handle broader and narrower concepts', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'gcmd:altLabel': {
          '@gcmd:category': 'cat1',
          '@gcmd:text': 'Alt Label 1'
        },
        'skos:broader': { '@rdf:resource': 'http://example.com/broader' },
        'skos:narrower': [
          { '@rdf:resource': 'http://example.com/narrower1' },
          { '@rdf:resource': 'http://example.com/narrower2' }
        ]
      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(result.concept.broader.conceptBrief['@prefLabel']).toBe('Broader Concept')
      expect(result.concept.narrower.conceptBrief).toHaveLength(2)
      expect(result.concept.narrower.conceptBrief[0]['@prefLabel']).toBe('Narrower Concept 1')
      expect(result.concept.narrower.conceptBrief[1]['@prefLabel']).toBe('Narrower Concept 2')
    })
  })

  describe('when processing a concept with additional properties', () => {
    test('should correctly handle altLabels, definition, and resources', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'gcmd:altLabel': [
          {
            '@gcmd:category': 'cat1',
            '@gcmd:text': 'Alt Label 1'
          },
          {
            '@gcmd:category': 'cat2',
            '@gcmd:text': 'Alt Label 2'
          }
        ],
        'skos:definition': { _text: 'Test Definition' },
        'gcmd:reference': { '@gcmd:text': 'Test Reference' },
        'gcmd:resource': {
          '@gcmd:type': 'testType',
          '@gcmd:url': 'http://example.com/resource'
        }
      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(result.concept.altLabels.altLabel).toHaveLength(2)
      expect(result.concept.altLabels.altLabel[0]).toEqual({
        '@category': 'cat1',
        '#text': 'Alt Label 1'
      })

      expect(result.concept.definition['#text']).toBe('Test Definition')
      expect(result.concept.definition['@reference']).toBe('Test Reference')
      expect(result.concept.resources.resource['@type']).toBe('testType')
      expect(result.concept.resources.resource['#text']).toBe('http://example.com/resource')
    })
  })

  describe('when processing a concept with related concepts', () => {
    test('should correctly handle hasInstrument, hasSensor, and onPlatform relations', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'gcmd:hasInstrument': [
          { '@rdf:resource': 'http://example.com/instrument' }
        ],
        'gcmd:isOnPlatform': { '@rdf:resource': 'http://example.com/platform' },
        'gcmd:hasSensor': { '@rdf:resource': 'http://example.com/sensor' },
        'skos:definition': { _text: 'Test Definition' }

      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')
      expect(result.concept.related.weightedRelation).toHaveLength(3)
      expect(result.concept.related.weightedRelation[0]['@type']).toBe('has_instrument')
      expect(result.concept.related.weightedRelation[0]['@prefLabel']).toBe('Test Instrument')
      expect(result.concept.related.weightedRelation[1]['@type']).toBe('has_sensor')
      expect(result.concept.related.weightedRelation[1]['@prefLabel']).toBe('Test Sensor')
      expect(result.concept.related.weightedRelation[2]['@type']).toBe('is_on_platform')
      expect(result.concept.related.weightedRelation[2]['@prefLabel']).toBe('Test Platform')
    })

    test('should correctly handle skos:related relations', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'skos:related': [
          { '@rdf:resource': 'http://example.com/sciencekeyword' }
        ],
        'skos:definition': { _text: 'Test Definition' }

      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')
      expect(result.concept.related.weightedRelation).toHaveLength(1)
      expect(result.concept.related.weightedRelation[0]['@type']).not.toBeDefined()
      expect(result.concept.related.weightedRelation[0]['@prefLabel']).toBe('Test Science Keyword')
    })
  })

  describe('when processing a concept with change notes', () => {
    test('should correctly handle single change notes', () => {
      const conceptSingleNote = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'skos:changeNote': `
        Change Note Information
        [Date]: 2020-01-06
        [User Id]: tstevens
        [User Note]: Rename Concept
        [System Note]: update PrefLabel
        [New Value]: EARLY
        [Old Value]: LOWER
        [Entity]: PrefLabel
        [Operation]: UPDATE
        [Field]: text
      `
      }

      const resultSingle = toLegacyXML(conceptSingleNote, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(resultSingle.concept.changeNotes.changeNote).toEqual({
        '@date': '2020-01-06',
        '@userId': 'tstevens',
        '@userNote': 'Rename Concept',
        changeNoteItems: {
          changeNoteItem: [
            {
              '@systemNote': 'update PrefLabel',
              '@newValue': 'EARLY',
              '@oldValue': 'LOWER',
              '@entity': 'PrefLabel',
              '@operation': 'UPDATE',
              '@field': 'text'
            }
          ]
        }
      })
    })
  })

  describe('when processing a concept with missing optional properties', () => {
    test('should handle missing properties gracefully', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' }
      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(result.concept.altLabels).toBeNull()
      expect(result.concept.definition).toBeUndefined()
      expect(result.concept.broader).toEqual({})
      expect(result.concept.narrower).toEqual({})
      expect(result.concept.related).toEqual({})
      expect(result.concept.resources).toBeUndefined()
      expect(result.concept.changeNotes).toBeUndefined()
      expect(result.concept.lastModifiedDate).toBeUndefined()
    })
  })

  describe('when processing a concept with a non-existent scheme', () => {
    test('should throw an error for non-existent scheme', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' }
      }

      expect(() => toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'nonExistentScheme'))
        .toThrow('No matching scheme found for: nonExistentScheme')
    })
  })

  describe('when processing a concept with a single narrower concept', () => {
    test('should correctly handle a single narrower concept', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'skos:narrower': { '@rdf:resource': 'http://example.com/narrower1' }
      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(result.concept.narrower.conceptBrief).toHaveLength(1)
      expect(result.concept.narrower.conceptBrief[0]['@prefLabel']).toBe('Narrower Concept 1')
    })
  })

  describe('when processing a concept with a single instrument', () => {
    test('should correctly handle a single instrument', () => {
      const concept = {
        '@rdf:about': 'http://example.com/concept',
        'skos:prefLabel': { _text: 'Test Concept' },
        'gcmd:hasInstrument': { '@rdf:resource': 'http://example.com/instrument' }
      }

      const result = toLegacyXML(concept, mockConceptSchemeDetails, mockCsvHeaders, mockConceptToConceptSchemeShortNameMap, mockPrefLabelMap, 'testScheme')

      expect(result.concept.related.weightedRelation).toHaveLength(1)
      expect(result.concept.related.weightedRelation[0]['@type']).toBe('has_instrument')
      expect(result.concept.related.weightedRelation[0]['@prefLabel']).toBe('Test Instrument')
    })
  })
})
