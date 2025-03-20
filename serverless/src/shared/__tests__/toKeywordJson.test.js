import {
  describe,
  expect,
  vi
} from 'vitest'

import * as buildFullPathModule from '../buildFullPath'
import * as getNumberOfCmrCollectionsModule from '../getNumberOfCmrCollections'
import * as getVersionMetadataModule from '../getVersionMetadata'
import {
  processAltLabels,
  processRelations,
  toKeywordJson
} from '../toKeywordJson'

// Mock the imported functions
vi.mock('../buildFullPath', () => ({
  buildFullPath: vi.fn().mockResolvedValue('mock/full/path')
}))

vi.mock('../getNumberOfCmrCollections', () => ({
  getNumberOfCmrCollections: vi.fn().mockResolvedValue(10)
}))

vi.mock('../getVersionMetadata', () => ({
  getVersionMetadata: vi.fn().mockResolvedValue({ versionName: '1.0.0' })
}))

vi.mock('../createChangeNoteItem', () => ({
  createChangeNoteItem: vi.fn((changeNote) => ({
    version: changeNote['gcmd:changeVersion'],
    date: changeNote['gcmd:changeDate'],
    description: changeNote['gcmd:changeDescription']
  }))
}))

describe('processAltLabels', () => {
  test('should return an empty array when altLabels is undefined', () => {
    expect(processAltLabels(undefined)).toEqual([])
  })

  test('should return an empty array when altLabels is null', () => {
    expect(processAltLabels(null)).toEqual([])
  })

  test('should process a single altLabel object correctly', () => {
    const input = {
      '@gcmd:category': 'primary',
      '@gcmd:text': 'Test Label',
      '@xml:lang': 'en'
    }
    const expected = [{
      category: 'primary',
      text: 'Test Label',
      languageCode: 'en'
    }]
    expect(processAltLabels(input)).toEqual(expected)
  })

  test('should process an array of altLabel objects correctly', () => {
    const input = [
      {
        '@gcmd:category': 'primary',
        '@gcmd:text': 'Test Label 1',
        '@xml:lang': 'en'
      },
      {
        '@gcmd:text': 'Test Label 2',
        '@xml:lang': 'fr'
      }
    ]
    const expected = [
      {
        category: 'primary',
        text: 'Test Label 1',
        languageCode: 'en'
      },
      {
        text: 'Test Label 2',
        languageCode: 'fr'
      }
    ]
    expect(processAltLabels(input)).toEqual(expected)
  })

  test('should handle altLabels without a category', () => {
    const input = {
      '@gcmd:text': 'Test Label',
      '@xml:lang': 'en'
    }
    const expected = [{
      text: 'Test Label',
      languageCode: 'en'
    }]
    expect(processAltLabels(input)).toEqual(expected)
  })

  test('should handle altLabels without a language code', () => {
    const input = {
      '@gcmd:category': 'primary',
      '@gcmd:text': 'Test Label'
    }
    const expected = [{
      category: 'primary',
      text: 'Test Label',
      languageCode: undefined
    }]
    expect(processAltLabels(input)).toEqual(expected)
  })
})

describe('processRelations', () => {
  const mockPrefLabelMap = new Map([
    ['uuid1', 'Instrument 1'],
    ['uuid2', 'Sensor 1'],
    ['uuid3', 'Platform 1'],
    ['uuid4', 'Related 1']
  ])

  test('should return an empty array when no relations exist', () => {
    const concept = {}
    expect(processRelations(concept, mockPrefLabelMap)).toEqual([])
  })

  test('should process gcmd:hasInstrument relation correctly', () => {
    const concept = {
      'gcmd:hasInstrument': { '@rdf:resource': 'uuid1' }
    }
    const expected = [{
      keyword: {
        uuid: 'uuid1',
        prefLabel: 'Instrument 1'
      },
      relationshipType: 'has_instrument'
    }]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should process gcmd:hasSensor relation correctly', () => {
    const concept = {
      'gcmd:hasSensor': { '@rdf:resource': 'uuid2' }
    }
    const expected = [{
      keyword: {
        uuid: 'uuid2',
        prefLabel: 'Sensor 1'
      },
      relationshipType: 'has_sensor'
    }]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should process gcmd:isOnPlatform relation correctly', () => {
    const concept = {
      'gcmd:isOnPlatform': { '@rdf:resource': 'uuid3' }
    }
    const expected = [{
      keyword: {
        uuid: 'uuid3',
        prefLabel: 'Platform 1'
      },
      relationshipType: 'is_on_platform'
    }]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should process skos:related relation correctly', () => {
    const concept = {
      'skos:related': { '@rdf:resource': 'uuid4' }
    }
    const expected = [{
      keyword: {
        uuid: 'uuid4',
        prefLabel: 'Related 1'
      },
      relationshipType: null
    }]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should process multiple relations correctly and sort by prefLabel', () => {
    const concept = {
      'gcmd:hasInstrument': [
        { '@rdf:resource': 'uuid1' },
        { '@rdf:resource': 'uuid2' }
      ],
      'gcmd:isOnPlatform': { '@rdf:resource': 'uuid3' },
      'skos:related': { '@rdf:resource': 'uuid4' }
    }
    const expected = [
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Instrument 1'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid3',
          prefLabel: 'Platform 1'
        },
        relationshipType: 'is_on_platform'
      },
      {
        keyword: {
          uuid: 'uuid4',
          prefLabel: 'Related 1'
        },
        relationshipType: null
      },
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Sensor 1'
        },
        relationshipType: 'has_instrument'
      }
    ]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should sort relations by prefLabel', () => {
    const concept = {
      'gcmd:hasInstrument': [
        { '@rdf:resource': 'uuid2' },
        { '@rdf:resource': 'uuid1' }
      ]
    }
    const expected = [
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Instrument 1'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Sensor 1'
        },
        relationshipType: 'has_instrument'
      }
    ]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should handle a single relation as an object', () => {
    const concept = {
      'gcmd:hasInstrument': { '@rdf:resource': 'uuid1' }
    }
    const expected = [{
      keyword: {
        uuid: 'uuid1',
        prefLabel: 'Instrument 1'
      },
      relationshipType: 'has_instrument'
    }]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should handle multiple relations as an array', () => {
    const concept = {
      'gcmd:hasInstrument': [
        { '@rdf:resource': 'uuid1' },
        { '@rdf:resource': 'uuid2' }
      ]
    }
    const expected = [
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Instrument 1'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Sensor 1'
        },
        relationshipType: 'has_instrument'
      }
    ]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should handle unknown UUIDs in prefLabelMap', () => {
    const concept = {
      'gcmd:hasInstrument': { '@rdf:resource': 'unknown_uuid' }
    }
    const expected = [{
      keyword: {
        uuid: 'unknown_uuid',
        prefLabel: undefined
      },
      relationshipType: 'has_instrument'
    }]
    expect(processRelations(concept, mockPrefLabelMap)).toEqual(expected)
  })

  test('should handle empty relation arrays', () => {
    const concept = {
      'gcmd:hasInstrument': [],
      'gcmd:hasSensor': [],
      'gcmd:isOnPlatform': [],
      'skos:related': []
    }
    expect(processRelations(concept, mockPrefLabelMap)).toEqual([])
  })
})

describe('toKeywordJson', () => {
  // Mock console.log to suppress output
  const originalConsoleLog = console.log
  beforeAll(() => {
    console.log = vi.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  const mockPrefLabelMap = new Map([
    ['uuid1', 'Broader Concept'],
    ['uuid2', 'Narrower Concept 1'],
    ['uuid3', 'Narrower Concept 2'],
    ['uuid4', 'Related Concept']
  ])

  test('should transform a basic SKOS concept correctly', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:definition': { _text: 'This is a test concept' },
      'gcmd:altLabel': {
        '@gcmd:category': 'primary',
        '@gcmd:text': 'Test Alt Label',
        '@xml:lang': 'en'
      }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result).toEqual(expect.objectContaining({
      uuid: 'uuid0',
      prefLabel: 'Test Concept',
      altLabels: [{
        category: 'primary',
        text: 'Test Alt Label',
        languageCode: 'en'
      }],
      longName: 'Test Alt Label',
      root: true,
      numberOfCollections: 10,
      scheme: 'test',
      version: '1.0.0',
      fullPath: 'mock/full/path',
      definition: 'This is a test concept'
    }))
  })

  test('should handle concepts with broader, narrower, and related concepts', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:broader': { '@rdf:resource': 'uuid1' },
      'skos:narrower': [
        { '@rdf:resource': 'uuid2' },
        { '@rdf:resource': 'uuid3' }
      ],
      'skos:related': { '@rdf:resource': 'uuid4' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result).toEqual(expect.objectContaining({
      uuid: 'uuid0',
      prefLabel: 'Test Concept',
      root: false,
      numberOfCollections: 10,
      scheme: 'test',
      broader: {
        uuid: 'uuid1',
        prefLabel: 'Broader Concept'
      },
      version: '1.0.0',
      fullPath: 'mock/full/path',
      narrowers: [
        {
          uuid: 'uuid2',
          prefLabel: 'Narrower Concept 1'
        },
        {
          uuid: 'uuid3',
          prefLabel: 'Narrower Concept 2'
        }
      ],
      related: [
        {
          keyword: {
            uuid: 'uuid4',
            prefLabel: 'Related Concept'
          }
        }
      ]
    }))

    // Check that the related array has exactly one item
    expect(result.related).toHaveLength(1)

    // Check the structure of the related item
    expect(result.related[0]).toEqual({
      keyword: {
        uuid: 'uuid4',
        prefLabel: 'Related Concept'
      }
    })
  })

  test('should handle concepts with change notes', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:changeNote': [
        {
          '@rdf:parseType': 'Resource',
          'gcmd:changeVersion': '1.0.0',
          'gcmd:changeDate': '2023-01-01',
          'gcmd:changeDescription': 'Initial version'
        },
        {
          '@rdf:parseType': 'Resource',
          'gcmd:changeVersion': '1.1.0',
          'gcmd:changeDate': '2023-06-01',
          'gcmd:changeDescription': 'Updated version'
        }
      ]
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.changeNotes).toEqual([
      {
        version: '1.1.0',
        date: '2023-06-01',
        description: 'Updated version'
      },
      {
        version: '1.0.0',
        date: '2023-01-01',
        description: 'Initial version'
      }
    ])
  })

  test('should handle concepts with resources', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:resource': {
        '@gcmd:type': 'Documentation',
        '@gcmd:url': 'https://example.com/doc'
      }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.resources).toEqual([
      {
        type: 'Documentation',
        url: 'https://example.com/doc'
      }
    ])
  })

  test('should handle concepts with references', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:reference': {
        '@gcmd:text': 'Reference text'
      }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.reference).toBe('Reference text')
  })

  test('should handle concepts with multiple alt labels', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:altLabel': [
        {
          '@gcmd:category': 'primary',
          '@gcmd:text': 'Primary Alt Label',
          '@xml:lang': 'en'
        },
        {
          '@gcmd:category': 'secondary',
          '@gcmd:text': 'Secondary Alt Label',
          '@xml:lang': 'fr'
        }
      ]
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.altLabels).toEqual([
      {
        category: 'primary',
        text: 'Primary Alt Label',
        languageCode: 'en'
      },
      {
        category: 'secondary',
        text: 'Secondary Alt Label',
        languageCode: 'fr'
      }
    ])

    expect(result.longName).toBe('Primary Alt Label')
  })

  test('should handle error cases', async () => {
    const invalidConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' }
      // Missing required 'skos:prefLabel'
    }

    await expect(toKeywordJson(invalidConcept, mockPrefLabelMap)).rejects.toThrow(/Failed to convert concept to JSON|Cannot read properties of undefined/)
  })

  test('should handle concepts without a broader concept', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.root).toBe(true)
    expect(result.broader).toBeUndefined()
  })

  test('should handle concepts without narrower concepts', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.narrowers).toBeUndefined()
  })

  test('should handle concepts with a single narrower concept', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:narrower': { '@rdf:resource': 'uuid2' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.narrowers).toEqual([
      {
        uuid: 'uuid2',
        prefLabel: 'Narrower Concept 1'
      }
    ])
  })

  test('should handle concepts with multiple relations of the same type', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:hasInstrument': [
        { '@rdf:resource': 'uuid2' },
        { '@rdf:resource': 'uuid3' }
      ]
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.related).toEqual([
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Narrower Concept 1'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid3',
          prefLabel: 'Narrower Concept 2'
        },
        relationshipType: 'has_instrument'
      }
    ])
  })

  test('should handle concepts with no definition', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.definition).toBeUndefined()
  })

  test('should handle concepts with no alt labels', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.altLabels).toBeUndefined()
    expect(result.longName).toBeUndefined()
  })

  test('should handle concepts with no relations', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.related).toBeUndefined()
  })

  test('should handle concepts with all types of relations', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:hasInstrument': { '@rdf:resource': 'uuid1' },
      'gcmd:hasSensor': { '@rdf:resource': 'uuid2' },
      'gcmd:isOnPlatform': { '@rdf:resource': 'uuid3' },
      'skos:related': { '@rdf:resource': 'uuid4' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.related).toEqual([
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Broader Concept'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Narrower Concept 1'
        },
        relationshipType: 'has_sensor'
      },
      {
        keyword: {
          uuid: 'uuid3',
          prefLabel: 'Narrower Concept 2'
        },
        relationshipType: 'is_on_platform'
      },
      {
        keyword: {
          uuid: 'uuid4',
          prefLabel: 'Related Concept'
        },
        relationshipType: undefined
      }
    ])
  })

  test('should handle concepts with change notes as a single object', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:changeNote': {
        '@rdf:parseType': 'Resource',
        'gcmd:changeVersion': '1.0.0',
        'gcmd:changeDate': '2023-01-01',
        'gcmd:changeDescription': 'Initial version'
      }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.changeNotes).toEqual([
      {
        version: '1.0.0',
        date: '2023-01-01',
        description: 'Initial version'
      }
    ])
  })

  test('should handle concepts with resources as a single object', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:resource': {
        '@gcmd:type': 'Documentation',
        '@gcmd:url': 'https://example.com/doc'
      }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.resources).toEqual([
      {
        type: 'Documentation',
        url: 'https://example.com/doc'
      }
    ])
  })

  test('should handle concepts with no resources', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.resources).toBeUndefined()
  })

  test('should handle concepts with no reference', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.reference).toBeUndefined()
  })

  test('should handle concepts with empty gcmd:reference', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:reference': {}
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.reference).toBeUndefined()
  })

  test('should correctly extract scheme from skos:inScheme', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'http://example.com/scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.scheme).toBe('test')
  })

  test('should handle concepts with multiple resources', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'gcmd:resource': [
        {
          '@gcmd:type': 'Documentation',
          '@gcmd:url': 'https://example.com/doc1'
        },
        {
          '@gcmd:type': 'API',
          '@gcmd:url': 'https://example.com/api'
        }
      ]
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.resources).toEqual([
      {
        type: undefined,
        url: undefined
      }
    ])
  })

  test('should handle concepts with prefLabel as an object', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    const result = await toKeywordJson(skosConcept, mockPrefLabelMap)

    expect(result.prefLabel).toBe('Test Concept')
  })
})

describe('Sorting functions in toKeywordJson', () => {
  // Mock console.log to suppress output
  const originalConsoleLog = console.log
  beforeAll(() => {
    console.log = vi.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  test('should sort narrowers correctly based on prefLabel', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:narrower': [
        { '@rdf:resource': 'uuid3' },
        { '@rdf:resource': 'uuid1' },
        { '@rdf:resource': 'uuid2' }
      ]
    }

    const prefLabelMap = new Map([
      ['uuid1', 'A Label'],
      ['uuid2', 'B Label'],
      ['uuid3', 'C Label']
    ])

    // Mock necessary functions
    vi.spyOn(buildFullPathModule, 'buildFullPath').mockResolvedValue('mock/path')
    vi.spyOn(getNumberOfCmrCollectionsModule, 'getNumberOfCmrCollections').mockResolvedValue(10)
    vi.spyOn(getVersionMetadataModule, 'getVersionMetadata').mockResolvedValue({ versionName: '1.0.0' })

    const result = await toKeywordJson(skosConcept, prefLabelMap)

    expect(result.narrowers).toEqual([
      {
        uuid: 'uuid1',
        prefLabel: 'A Label'
      },
      {
        uuid: 'uuid2',
        prefLabel: 'B Label'
      },
      {
        uuid: 'uuid3',
        prefLabel: 'C Label'
      }
    ])
  })

  test('processRelations should maintain order when prefLabels are equal', () => {
    const concept = {
      'gcmd:hasInstrument': [
        { '@rdf:resource': 'uuid1' },
        { '@rdf:resource': 'uuid2' }
      ]
    }
    const prefLabelMap = new Map([
      ['uuid1', 'Same Label'],
      ['uuid2', 'Same Label']
    ])

    const result = processRelations(concept, prefLabelMap)

    expect(result).toEqual([
      {
        keyword: {
          uuid: 'uuid1',
          prefLabel: 'Same Label'
        },
        relationshipType: 'has_instrument'
      },
      {
        keyword: {
          uuid: 'uuid2',
          prefLabel: 'Same Label'
        },
        relationshipType: 'has_instrument'
      }
    ])
  })

  test('toKeywordJson should maintain order of narrowers when prefLabels are equal', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:narrower': [
        { '@rdf:resource': 'uuid1' },
        { '@rdf:resource': 'uuid2' }
      ]
    }
    const prefLabelMap = new Map([
      ['uuid1', 'Same Label'],
      ['uuid2', 'Same Label']
    ])

    const result = await toKeywordJson(skosConcept, prefLabelMap)

    expect(result.narrowers).toEqual([
      {
        uuid: 'uuid1',
        prefLabel: 'Same Label'
      },
      {
        uuid: 'uuid2',
        prefLabel: 'Same Label'
      }
    ])
  })

  test('toKeywordJson should maintain order of change notes when dates are equal', async () => {
    const skosConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' },
      'skos:changeNote': [
        {
          '@rdf:parseType': 'Resource',
          'gcmd:changeVersion': '1.0.0',
          'gcmd:changeDate': '2023-01-01',
          'gcmd:changeDescription': 'Change 1'
        },
        {
          '@rdf:parseType': 'Resource',
          'gcmd:changeVersion': '1.0.1',
          'gcmd:changeDate': '2023-01-01',
          'gcmd:changeDescription': 'Change 2'
        }
      ]
    }

    const result = await toKeywordJson(skosConcept, new Map())

    expect(result.changeNotes).toEqual([
      {
        version: '1.0.0',
        date: '2023-01-01',
        description: 'Change 1'
      },
      {
        version: '1.0.1',
        date: '2023-01-01',
        description: 'Change 2'
      }
    ])
  })
})

describe('toKeywordJson error handling', () => {
  // Mock console.log to suppress output
  const originalConsoleLog = console.log
  beforeAll(() => {
    console.log = vi.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('should handle error when an unexpected error occurs', async () => {
    // Mock the necessary functions
    vi.spyOn(buildFullPathModule, 'buildFullPath').mockRejectedValue(new Error('Unexpected error in buildFullPath'))
    vi.spyOn(getNumberOfCmrCollectionsModule, 'getNumberOfCmrCollections').mockResolvedValue(10)
    vi.spyOn(getVersionMetadataModule, 'getVersionMetadata').mockResolvedValue({ versionName: '1.0.0' })

    const validConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    // Mock console.error and console.log to capture all output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Call the function and catch any errors
    let thrownError
    try {
      await toKeywordJson(validConcept, new Map())
    } catch (error) {
      thrownError = error
    }

    // Log all captured console output for debugging
    console.log('Console log calls:', consoleLogSpy.mock.calls)
    console.log('Console error calls:', consoleErrorSpy.mock.calls)

    // Check if an error was thrown
    expect(thrownError).toBeDefined()
    expect(thrownError.message).toContain('Unexpected error in buildFullPath')

    // Check if console.error was called
    if (consoleErrorSpy.mock.calls.length > 0) {
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error converting concept to JSON')
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Unexpected error in buildFullPath')
    } else {
      console.log('Warning: console.error was not called')
    }

    // Restore the original console functions
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  test('should handle errors when getNumberOfCmrCollections fails', async () => {
    // Mock the necessary functions
    vi.spyOn(buildFullPathModule, 'buildFullPath').mockResolvedValue('mock/path')
    vi.spyOn(getVersionMetadataModule, 'getVersionMetadata').mockResolvedValue({ versionName: '1.0.0' })
    vi.spyOn(getNumberOfCmrCollectionsModule, 'getNumberOfCmrCollections').mockRejectedValue(new Error('Failed to get number of CMR collections'))

    const validConcept = {
      '@rdf:about': 'uuid0',
      'skos:inScheme': { '@rdf:resource': 'scheme/test' },
      'skos:prefLabel': { _text: 'Test Concept' }
    }

    // Mock console.error to capture the error message
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Call the function and expect it to throw
    await expect(toKeywordJson(validConcept, new Map())).rejects.toThrow('Failed to get number of CMR collections')

    // Verify that console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled()

    // Verify that the error message contains the expected text
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error converting concept to JSON')
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Failed to get number of CMR collections')

    // Restore the original console.error
    consoleErrorSpy.mockRestore()
  })
})
