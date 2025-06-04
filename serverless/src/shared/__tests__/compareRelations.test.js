import {
  describe,
  expect,
  test
} from 'vitest'

import { compareRelations } from '../compareRelations'

describe('compareRelations', () => {
  test('should correctly identify added relations', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      },
      {
        from: 'concept1',
        relation: 'narrower',
        to: 'concept4',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 4'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'narrower',
        to: 'concept4',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 4'
      }
    ])

    expect(result.removedRelations).toEqual([])
  })

  test('should correctly identify removed relations', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ])
  })

  test('should handle both added and removed relations', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'narrower',
        to: 'concept4',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 4'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'narrower',
        to: 'concept4',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 4'
      }
    ])

    expect(result.removedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ])
  })

  test('should handle empty before relations', () => {
    const beforeRelations = []
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ])

    expect(result.removedRelations).toEqual([])
  })

  test('should handle empty after relations', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]
    const afterRelations = []

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ])
  })

  test('should handle no changes in relations', () => {
    const relations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ]

    const result = compareRelations(relations, relations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([])
  })

  test('should handle completely different before and after relations', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'narrower',
        to: 'concept4',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 4'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept5',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 5'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual(afterRelations)
    expect(result.removedRelations).toEqual(beforeRelations)
  })

  test('should handle relations with different order', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      },
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'related',
        to: 'concept3',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 3'
      },
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([])
  })

  test('should handle relations with different case', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'Broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ])

    expect(result.removedRelations).toEqual([
      {
        from: 'concept1',
        relation: 'Broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ])
  })

  test('should handle relations with extra properties', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2',
        extra: 'data'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2',
        newExtra: 'newData'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([])
  })

  test('should not detect changes in preferred labels as additions or removals', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1 Updated',
        toPrefLabel: 'Concept 2'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([])
  })

  test('should not consider missing preferred labels as changes', () => {
    const beforeRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2'
      }
    ]
    const afterRelations = [
      {
        from: 'concept1',
        relation: 'broader',
        to: 'concept2',
        fromPrefLabel: 'Concept 1',
        toPrefLabel: 'Concept 2'
      }
    ]

    const result = compareRelations(beforeRelations, afterRelations)

    expect(result.addedRelations).toEqual([])
    expect(result.removedRelations).toEqual([])
  })
})
