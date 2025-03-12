import {
  describe,
  expect,
  test
} from 'vitest'

import toLegacyXML from '../toLegacyXML'

describe('toLegacyXML', () => {
  const mockConcept = {
    '@rdf:about': 'test-uuid',
    'skos:prefLabel': { _text: 'Test Preflabel' },
    'dcterms:modified': '2023-06-01 12:00:00'
  }
  const mockConceptSchemeDetails = [
    {
      notation: 'testScheme',
      prefLabel: 'Test Scheme',
      modified: '2023-06-01'
    }
  ]
  const mockCsvHeaders = ['Header1', 'Header2']
  const mockPrefLabelMap = new Map()
  const mockSchemeShortName = 'testScheme'

  describe('when given a basic concept', () => {
    test('should return a correctly structured legacy XML object', () => {
      const result = toLegacyXML(
        mockConcept,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result).toHaveProperty('concept')
      expect(result.concept).toHaveProperty('@uuid', 'test-uuid')
      expect(result.concept).toHaveProperty('prefLabel', 'Test Preflabel')
      expect(result.concept).toHaveProperty('lastModifiedDate', '2023-06-01')
    })
  })

  describe('when given a concept with alternative labels', () => {
    test('should process alternative labels correctly', () => {
      const conceptWithAltLabels = {
        ...mockConcept,
        'gcmd:altLabel': [
          {
            '@gcmd:category': 'cat1',
            '@gcmd:text': 'Alt Label 1'
          },
          {
            '@gcmd:category': 'cat2',
            '@gcmd:text': 'Alt Label 2'
          }
        ]
      }

      const result = toLegacyXML(
        conceptWithAltLabels,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept).toHaveProperty('altLabels')
      expect(result.concept.altLabels.altLabel).toHaveLength(2)
      expect(result.concept.altLabels.altLabel[0]).toEqual({
        '@category': 'cat1',
        '#text': 'Alt Label 1'
      })
    })
  })

  describe('when given a concept with a definition', () => {
    test('should include the definition in the result', () => {
      const conceptWithDefinition = {
        ...mockConcept,
        'skos:definition': { _text: 'Test Definition' },
        'gcmd:reference': { '@gcmd:text': 'Test Reference' }
      }

      const result = toLegacyXML(
        conceptWithDefinition,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept).toHaveProperty('definition')
      expect(result.concept.definition).toEqual({
        '@reference': 'Test Reference',
        '#text': 'Test Definition'
      })
    })
  })

  describe('when given a concept with broader and narrower concepts', () => {
    test('should include broader and narrower concepts in the result', () => {
      const conceptWithRelations = {
        ...mockConcept,
        'skos:broader': { '@rdf:resource': 'broader-uuid' },
        'skos:narrower': [
          { '@rdf:resource': 'narrower-uuid-1' },
          { '@rdf:resource': 'narrower-uuid-2' }
        ]
      }

      mockPrefLabelMap.set('broader-uuid', 'Broader Concept')
      mockPrefLabelMap.set('narrower-uuid-1', 'Narrower Concept 1')
      mockPrefLabelMap.set('narrower-uuid-2', 'Narrower Concept 2')

      const result = toLegacyXML(
        conceptWithRelations,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept).toHaveProperty('broader')
      expect(result.concept.broader.conceptBrief).toEqual({
        '@conceptScheme': 'testScheme',
        '@prefLabel': 'Broader Concept',
        '@uuid': 'broader-uuid'
      })

      expect(result.concept).toHaveProperty('narrower')
      expect(result.concept.narrower).toHaveLength(2)
      expect(result.concept.narrower[0].conceptBrief).toEqual({
        '@conceptScheme': 'testScheme',
        '@prefLabel': 'Narrower Concept 1',
        '@uuid': 'narrower-uuid-1'
      })
    })
  })

  describe('when given a concept with related concepts', () => {
    test('should include related concepts in the result', () => {
      const conceptWithRelated = {
        ...mockConcept,
        'gcmd:hasInstrument': { '@rdf:resource': 'instrument-uuid' },
        'gcmd:isOnPlatform': { '@rdf:resource': 'platform-uuid' }
      }

      mockPrefLabelMap.set('instrument-uuid', 'Related Instrument')
      mockPrefLabelMap.set('platform-uuid', 'Related Platform')

      const result = toLegacyXML(
        conceptWithRelated,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept).toHaveProperty('related')
      expect(result.concept.related.weightedRelation).toHaveLength(2)
      expect(result.concept.related.weightedRelation[0]).toEqual({
        '@type': 'has_instrument',
        '@generatedBy': 'server',
        '@conceptScheme': 'instruments',
        '@prefLabel': 'Related Instrument',
        '@uuid': 'instrument-uuid'
      })

      expect(result.concept.related.weightedRelation[1]).toEqual({
        '@type': 'is_on_platform',
        '@generatedBy': 'server',
        '@conceptScheme': 'platforms',
        '@prefLabel': 'Related Platform',
        '@uuid': 'platform-uuid'
      })
    })
  })

  describe('when given a concept with resources', () => {
    test('should include resources in the result', () => {
      const conceptWithResource = {
        ...mockConcept,
        'gcmd:resource': {
          '@gcmd:type': 'image',
          '@gcmd:url': 'http://example.com/image.jpg'
        }
      }

      const result = toLegacyXML(
        conceptWithResource,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept).toHaveProperty('resources')
      expect(result.concept.resources.resource).toEqual({
        '@type': 'image',
        '#text': 'http://example.com/image.jpg'
      })
    })
  })

  describe('when given a concept with change notes', () => {
    test('should process change notes correctly', () => {
      const conceptWithChangeNote = {
        ...mockConcept,
        'skos:changeNote': 'date: 2023-06-01\nuserId: testUser\nuserNote: Test change\nChangeNoteItem #1\nsystemNote: System update\nnewValue: New value\nentity: Entity\noperation: Update'
      }

      const result = toLegacyXML(
        conceptWithChangeNote,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept).toHaveProperty('changeNotes')
      expect(result.concept.changeNotes.changeNote).toEqual({
        '@date': '2023-06-01',
        '@userId': 'testUser',
        '@userNote': 'Test change',
        changeNoteItems: {
          changeNoteItem: [{
            '@systemNote': 'System update',
            '@newValue': 'New value',
            '@entity': 'Entity',
            '@operation': 'Update'
          }]
        }
      })
    })
  })

  describe('when given an invalid scheme short name', () => {
    test('should throw an error', () => {
      expect(() => toLegacyXML(mockConcept, mockConceptSchemeDetails, mockCsvHeaders, mockPrefLabelMap, 'invalidScheme'))
        .toThrow('No matching scheme found for: invalidScheme')
    })
  })

  describe('when given a concept with multiple change notes', () => {
    test('should process all change notes', () => {
      const conceptWithMultipleChangeNotes = {
        ...mockConcept,
        'skos:changeNote': [
          'date: 2023-06-01\nuserId: user1\nuserNote: Change 1\nChangeNoteItem #1\nsystemNote: Update 1\noperation: Add',
          'date: 2023-06-02\nuserId: user2\nuserNote: Change 2\nChangeNoteItem #1\nsystemNote: Update 2\noperation: Modify'
        ]
      }

      const result = toLegacyXML(
        conceptWithMultipleChangeNotes,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept.changeNotes.changeNote).toHaveLength(2)
      expect(result.concept.changeNotes.changeNote[0]['@date']).toBe('2023-06-01')
      expect(result.concept.changeNotes.changeNote[1]['@date']).toBe('2023-06-02')
    })
  })

  describe('when given a concept with no alternative labels', () => {
    test('should set altLabels to null', () => {
      const result = toLegacyXML(
        mockConcept,
        mockConceptSchemeDetails,
        mockCsvHeaders,
        mockPrefLabelMap,
        mockSchemeShortName
      )

      expect(result.concept.altLabels).toBeNull()
    })
  })
})
