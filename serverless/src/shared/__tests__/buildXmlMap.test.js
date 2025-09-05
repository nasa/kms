import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { buildXmlMap } from '../buildXmlMap'

describe('buildXmlMap', () => {
  // Mock console.warn and console.error
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should build an XML map from valid content', async () => {
    const content = `
      <concepts>
        <concept uuid="1">
          <skos:Concept>
            <skos:prefLabel>Concept 1</skos:prefLabel>
            <skos:definition>Definition 1</skos:definition>
          </skos:Concept>
        </concept>
        <concept uuid="2">
          <skos:Concept>
            <skos:prefLabel>Concept 2</skos:prefLabel>
            <skos:definition>Definition 2</skos:definition>
          </skos:Concept>
        </concept>
      </concepts>
    `

    const result = await buildXmlMap(content)

    expect(result).toEqual({
      1: {
        '@_uuid': '1',
        'skos:Concept': {
          'skos:prefLabel': 'Concept 1',
          'skos:definition': 'Definition 1'
        }
      },
      2: {
        '@_uuid': '2',
        'skos:Concept': {
          'skos:prefLabel': 'Concept 2',
          'skos:definition': 'Definition 2'
        }
      }
    })
  })

  test('should preserve number-like strings', async () => {
    const content = `
      <concepts>
        <concept uuid="1">
          <skos:Concept>
            <skos:notation>1.0</skos:notation>
          </skos:Concept>
        </concept>
        <concept uuid="2">
          <skos:Concept>
            <skos:notation>-2.5e10</skos:notation>
          </skos:Concept>
        </concept>
      </concepts>
    `

    const result = await buildXmlMap(content)

    expect(result['1']['skos:Concept']['skos:notation']).toBe('1.0')
    expect(result['2']['skos:Concept']['skos:notation']).toBe('-2.5e10')
  })

  test('should handle concepts without UUID', async () => {
    const content = `
      <concepts>
        <concept uuid="1">
          <skos:Concept>
            <skos:prefLabel>Concept 1</skos:prefLabel>
          </skos:Concept>
        </concept>
        <concept>
          <skos:Concept>
            <skos:prefLabel>Concept 2</skos:prefLabel>
          </skos:Concept>
        </concept>
      </concepts>
    `

    await buildXmlMap(content)

    expect(console.warn).toHaveBeenCalledWith(
      'Found concept without UUID:',
      expect.objectContaining({
        'skos:Concept': {
          'skos:prefLabel': 'Concept 2'
        }
      })
    )
  })

  test('should handle unexpected XML structure', async () => {
    const content = `
      <unexpectedRoot>
        <concept uuid="1">
          <skos:Concept>
            <skos:prefLabel>Concept 1</skos:prefLabel>
          </skos:Concept>
        </concept>
      </unexpectedRoot>
    `

    await buildXmlMap(content)

    expect(console.warn).toHaveBeenCalledWith('Unexpected XML structure')
  })

  test('should handle empty results', async () => {
    const content = `
      <concepts>
      </concepts>
    `

    const result = await buildXmlMap(content)

    expect(result).toEqual({})
    expect(console.warn).toHaveBeenCalledWith('Unexpected XML structure')
  })

  test('should handle a single concept', async () => {
    const content = `
      <concepts>
        <concept uuid="1">
          <skos:Concept>
            <skos:prefLabel>Single Concept</skos:prefLabel>
          </skos:Concept>
        </concept>
      </concepts>
    `

    const result = await buildXmlMap(content)

    expect(result).toEqual({
      1: {
        '@_uuid': '1',
        'skos:Concept': {
          'skos:prefLabel': 'Single Concept'
        }
      }
    })
  })

  describe('buildXmlMap with mocked XMLParser', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('should warn about unexpected XML structure', async () => {
      const result = await buildXmlMap('<dummy xml>')

      expect(result).toEqual({})
      expect(console.warn).toHaveBeenCalledWith('Unexpected XML structure')
    })
  })
})
