import { describe, expect } from 'vitest'

import { generateCsvHeaders } from '../generateCsvHeaders'

describe('generateCsvHeaders', () => {
  test('should generate headers for 2 columns', () => {
    const headers = generateCsvHeaders('MyScheme', 2)
    expect(headers).toEqual(['MyScheme', 'UUID'])
  })

  test('should generate headers for 5 columns', () => {
    const headers = generateCsvHeaders('AnotherScheme', 5)
    expect(headers).toEqual(['AnotherScheme', 'Level1', 'Level2', 'Level3', 'UUID'])
  })

  test('should generate headers for 3 columns', () => {
    const headers = generateCsvHeaders('TestScheme', 3)
    expect(headers).toEqual(['TestScheme', 'Level1', 'UUID'])
  })

  test('should handle large number of columns', () => {
    const headers = generateCsvHeaders('LargeScheme', 10)
    expect(headers).toEqual([
      'LargeScheme',
      'Level1',
      'Level2',
      'Level3',
      'Level4',
      'Level5',
      'Level6',
      'Level7',
      'Level8',
      'UUID'
    ])
  })
})
