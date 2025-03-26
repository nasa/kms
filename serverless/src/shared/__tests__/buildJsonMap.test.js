import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { buildJsonMap } from '../buildJsonMap'

describe('buildJsonMap', () => {
  // Mock console.warn and console.error
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should build a JSON map from valid content', async () => {
    const content = JSON.stringify([
      {
        uuid: '1',
        value: 'test1'
      },
      {
        uuid: '2',
        value: 'test2'
      }
    ])

    const result = await buildJsonMap(content)

    expect(result).toEqual({
      1: {
        uuid: '1',
        value: 'test1'
      },
      2: {
        uuid: '2',
        value: 'test2'
      }
    })
  })

  test('should preserve number-like strings', async () => {
    const content = JSON.stringify([
      {
        uuid: '1',
        value: '1.0'
      },
      {
        uuid: '2',
        value: '-2.5e10'
      }
    ])

    const result = await buildJsonMap(content)

    expect(result['1'].value).toBe('1.0')
    expect(result['2'].value).toBe('-2.5e10')
  })

  test('should handle objects without UUID', async () => {
    const content = JSON.stringify([
      {
        uuid: '1',
        value: 'test1'
      },
      { value: 'test2' }
    ])

    await buildJsonMap(content)

    expect(console.warn).toHaveBeenCalledWith(
      'Found JSON object without UUID:',
      expect.objectContaining({ value: 'test2' })
    )
  })

  test('should throw an error for invalid JSON', async () => {
    const invalidContent = 'invalid json'

    await expect(buildJsonMap(invalidContent)).rejects.toThrow()
    expect(console.error).toHaveBeenCalledWith(
      'Error building JSON map:',
      expect.any(Error)
    )
  })
})
