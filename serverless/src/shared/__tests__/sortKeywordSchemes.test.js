import {
  describe,
  expect,
  test
} from 'vitest'

import { keywordSchemeSequence, sortKeywordSchemes } from '../sortKeywordSchemes'

describe('sortKeywordSchemes', () => {
  test('should sort schemes according to the predefined sequence', () => {
    const schemes = [
      { title: 'Platforms' },
      { title: 'Earth Science' },
      { title: 'Instruments' }
    ]
    const sortedSchemes = [...schemes].sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual([
      { title: 'Earth Science' },
      { title: 'Platforms' },
      { title: 'Instruments' }
    ])
  })

  test('should sort schemes not in the predefined sequence alphabetically', () => {
    const schemes = [
      { title: 'Custom Scheme B' },
      { title: 'Custom Scheme A' },
      { title: 'Earth Science' }
    ]
    const sortedSchemes = [...schemes].sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual([
      { title: 'Earth Science' },
      { title: 'Custom Scheme A' },
      { title: 'Custom Scheme B' }
    ])
  })

  test('should handle mixed predefined and custom schemes', () => {
    const schemes = [
      { title: 'Custom Scheme' },
      { title: 'Platforms' },
      { title: 'Another Custom' },
      { title: 'Earth Science' }
    ]
    const sortedSchemes = [...schemes].sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual([
      { title: 'Earth Science' },
      { title: 'Platforms' },
      { title: 'Another Custom' },
      { title: 'Custom Scheme' }
    ])
  })

  test('should maintain the order of predefined schemes', () => {
    const schemes = keywordSchemeSequence.map((title) => ({ title }))
    const shuffledSchemes = [...schemes].sort(() => Math.random() - 0.5)
    const sortedSchemes = shuffledSchemes.sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual(schemes)
  })

  test('should handle empty input', () => {
    const schemes = []
    const sortedSchemes = [...schemes].sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual([])
  })

  test('should handle schemes with identical titles', () => {
    const schemes = [
      { title: 'Earth Science' },
      { title: 'Custom Scheme' },
      { title: 'Earth Science' },
      { title: 'Custom Scheme' }
    ]
    const sortedSchemes = [...schemes].sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual([
      { title: 'Earth Science' },
      { title: 'Earth Science' },
      { title: 'Custom Scheme' },
      { title: 'Custom Scheme' }
    ])
  })

  test('should handle invalid input schemes', () => {
    const schemes = [
      { title: 'Valid Scheme' },
      null,
      undefined,
      {},
      { notTitle: 'Invalid Scheme' },
      { title: 'Another Valid Scheme' }
    ]
    const sortedSchemes = [...schemes].sort(sortKeywordSchemes)
    expect(sortedSchemes).toEqual([
      null,
      {},
      { notTitle: 'Invalid Scheme' },
      { title: 'Another Valid Scheme' },
      { title: 'Valid Scheme' },
      undefined
    ])
  })
})
