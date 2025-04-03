import { beforeEach } from 'vitest'

import { toRDF } from '../toRDF'

describe('toRDF', () => {
  const baseJson = {
    uuid: 'test-uuid',
    prefLabel: 'Test Concept',
    scheme: { shortName: 'testScheme' },
    altLabels: [{
      category: 'cat1',
      text: 'alt1'
    }],
    definitions: [{
      text: 'Test definition',
      reference: ''
    }],
    resources: [{
      type: 'type1',
      url: 'http://example.com'
    }],
    broader: [{ uuid: 'broader-uuid' }],
    narrower: [{ uuid: 'narrower-uuid' }],
    related: [],
    lastModifiedDate: '2023-01-01',
    creationDate: '2022-01-01'
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when contains changeNotes', () => {
    test('should handle single change note', () => {
      const json = {
        uuid: 'test-uuid',
        prefLabel: 'Test Concept',
        scheme: { shortName: 'testScheme' },
        changeNotes: [{
          date: '2023-01-01',
          userId: 'user1',
          userNote: 'Test note',
          changeNoteItems: [{
            systemNote: 'System note',
            newValue: 'New value',
            oldValue: 'Old value',
            entity: 'Entity',
            operation: 'Update',
            field: 'Field'
          }
          ]
        }]
      }
      const result = toRDF(json)
      expect(result).toContain('<skos:changeNote>')
      expect(result).toContain('Date=2023-01-01')
    })

    test('should handle multiple change notes', () => {
      const json = {
        ...baseJson,
        changeNotes: [{
          date: '2023-01-01',
          userId: 'user1',
          userNote: 'Test note 1',
          changeNoteItems: [
            {
              systemNote: 'System note 1',
              newValue: 'New value 1',
              oldValue: 'Old value 1',
              entity: 'Entity 1',
              operation: 'Update',
              field: 'Field 1'
            }
          ]
        },
        {
          date: '2023-01-02',
          userId: 'user2',
          userNote: 'Test note 2',
          changeNoteItems: [
            {
              systemNote: 'System note 2',
              newValue: 'New value 2',
              oldValue: 'Old value 2',
              entity: 'Entity 2',
              operation: 'Insert',
              field: 'Field 2'
            }
          ]
        }
        ]
      }
      const result = toRDF(json)
      expect(result).toContain('<skos:changeNote>')
      expect(result).toContain('Date=2023-01-01')
      expect(result).toContain('Date=2023-01-02')
    })

    test('should handle changeNotes with no changeNoteItems', () => {
      const json = {
        ...baseJson,
        changeNotes: [{
          date: '2023-01-01',
          userId: 'user1',
          userNote: 'Test note'
        }]
      }
      const result = toRDF(json)
      expect(result).not.toContain('<skos:changeNote>')
    })

    test('should handle single changeNote item not in an array', () => {
      const json = {
        ...baseJson,
        changeNotes: [{
          date: '2023-01-01',
          userId: 'user1',
          userNote: 'Test note',
          changeNoteItems: [{
            systemNote: 'System note',
            newValue: 'New value',
            oldValue: 'Old value',
            entity: 'Entity',
            operation: 'Update',
            field: 'Field'
          }]
        }]
      }
      const result = toRDF(json)
      expect(result).toContain('<skos:changeNote>')
      expect(result).toContain('Date=2023-01-01')
    })

    test('should handle empty values in addText function', () => {
      const json = {
        ...baseJson,
        prefLabel: ''
      }
      const result = toRDF(json)
      expect(result).not.toContain('<skos:prefLabel')
    })

    test('should remove empty skos:changeNote', () => {
      const json = {
        ...baseJson,
        changeNotes: [{
          date: '',
          userId: '',
          userNote: '',
          changeNoteItems: [{
            systemNote: '',
            newValue: '',
            oldValue: '',
            entity: '',
            operation: '',
            field: ''
          }]
        }]
      }
      const result = toRDF(json)
      expect(result).not.toContain('<skos:changeNote')
    })

    test('should handle undefined values in addText function', () => {
      const json = {
        ...baseJson,
        prefLabel: undefined
      }
      const result = toRDF(json)
      expect(result).not.toContain('<skos:prefLabel')
    })
  })

  describe('when contains gcmd:reference', () => {
    test('should include gcmd:reference in the RDF output', () => {
      const json = {
        ...baseJson,
        definitions: [{
          text: 'Test definition',
          reference: 'Test reference'
        }]
      }

      const result = toRDF(json)
      expect(result).toContain('<gcmd:reference gcmd:text="Test reference" xml:lang="en"/>')
    })

    test('should handle missing or undefined changeNoteItem attributes', () => {
      const json = {
        uuid: 'test-uuid',
        prefLabel: 'Test Concept',
        scheme: { shortName: 'testScheme' },
        changeNotes: [{
          date: '2023-01-01',
          userId: 'user1',
          userNote: 'Test note',
          changeNoteItems: [{}]
        }]
      }
      const result = toRDF(json)
      expect(result).toContain('<skos:changeNote>')
      expect(result).toContain('Date=2023-01-01')
      expect(result).toContain('User Id=user1')
      expect(result).toContain('User Note=Test note')
      expect(result).not.toContain('System Note=')
      expect(result).not.toContain('New Value=')
      expect(result).not.toContain('Old Value=')
      expect(result).not.toContain('Entity=')
      expect(result).not.toContain('Operation=')
      expect(result).not.toContain('Field=')
    })

    test('should handle empty string changeNoteItem attributes', () => {
      const json = {
        uuid: 'test-uuid',
        prefLabel: 'Test Concept',
        scheme: { shortName: 'testScheme' },
        changeNotes: [{
          date: '2023-01-01',
          userId: 'user1',
          userNote: 'Test note',
          changeNoteItems: [{
            systemNote: '',
            newValue: '',
            oldValue: '',
            entity: '',
            operation: '',
            field: ''
          }]
        }]
      }
      const result = toRDF(json)
      expect(result).toContain('<skos:changeNote>')
      expect(result).toContain('Date=2023-01-01')
      expect(result).toContain('User Id=user1')
      expect(result).toContain('User Note=Test note')
      expect(result).not.toContain('System Note=')
      expect(result).not.toContain('New Value=')
      expect(result).not.toContain('Old Value=')
      expect(result).not.toContain('Entity=')
      expect(result).not.toContain('Operation=')
      expect(result).not.toContain('Field=')
    })
  })

  describe('when contains related concepts', () => {
    test('should include gcmd:hasInstrument for platforms related to instruments', () => {
      const json = {
        ...baseJson,
        scheme: { shortName: 'platforms' },
        related: [{
          uuid: 'instrument-uuid',
          scheme: { shortName: 'instruments' }
        }]
      }

      const result = toRDF(json)
      expect(result).toContain('<gcmd:hasInstrument rdf:resource="instrument-uuid"/>')
    })

    test('should include gcmd:isOnPlatform for instruments related to platforms', () => {
      const json = {
        ...baseJson,
        scheme: { shortName: 'instruments' },
        related: [{
          uuid: 'platform-uuid',
          scheme: { shortName: 'platforms' }
        }]
      }

      const result = toRDF(json)
      expect(result).toContain('<gcmd:isOnPlatform rdf:resource="platform-uuid"/>')
    })

    test('should include gcmd:hasSensor for instruments related to instruments', () => {
      const json = {
        ...baseJson,
        scheme: { shortName: 'instruments' },
        related: [{
          uuid: 'sensor-uuid',
          scheme: { shortName: 'instruments' }
        }]
      }

      const result = toRDF(json)
      expect(result).toContain('<gcmd:hasSensor rdf:resource="sensor-uuid"/>')
    })

    test('should include skos:related for other related concepts', () => {
      const json = {
        ...baseJson,
        scheme: { shortName: 'otherScheme' },
        related: [{
          uuid: 'other-uuid',
          scheme: { shortName: 'otherScheme' }
        }]
      }

      const result = toRDF(json)
      expect(result).toContain('<skos:related rdf:resource="other-uuid"/>')
    })
  })

  describe('when handling empty or missing fields', () => {
    test('should not include empty arrays in the RDF output', () => {
      const json = {
        ...baseJson,
        altLabels: [],
        broader: [],
        narrower: [],
        related: []
      }

      const result = toRDF(json)
      expect(result).not.toContain('<gcmd:altLabel')
      expect(result).not.toContain('<skos:broader')
      expect(result).not.toContain('<skos:narrower')
      expect(result).not.toContain('<skos:related')
    })

    test('should handle missing optional fields', () => {
      const json = {
        uuid: 'test-uuid',
        prefLabel: 'Test Concept',
        scheme: { shortName: 'testScheme' }
      }

      const result = toRDF(json, {})
      expect(result).toContain('<skos:Concept')
      expect(result).toContain('<skos:prefLabel')
      expect(result).not.toContain('<dcterms:modified')
      expect(result).not.toContain('<dcterms:created')
      expect(result).not.toContain('<gcmd:altLabel')
      expect(result).not.toContain('<skos:definition')
      expect(result).not.toContain('<gcmd:resource')
      expect(result).not.toContain('<skos:broader')
      expect(result).not.toContain('<skos:narrower')
    })
  })

  describe('error handling', () => {
    test('should throw an error for invalid input', () => {
      expect(() => toRDF(null)).toThrow('Invalid JSON input')
    })

    test('should handle non-string values in decodeHtmlEntities', () => {
      const json = {
        ...baseJson,
        prefLabel: 123
      }
      const result = toRDF(json)
      expect(result).toContain('<skos:prefLabel xml:lang="en">123</skos:prefLabel>')
    })
  })
})
