import {
  describe,
  expect,
  test
} from 'vitest'

import { buildNativeMetadataDiff } from '../buildNativeMetadataDiff'

describe('buildNativeMetadataDiff', () => {
  test('creates a unified diff for native XML metadata', () => {
    const result = buildNativeMetadataDiff({
      originalMetadata: '<Platform>GOSAT</Platform>',
      correctedMetadata: '<Platform>GOSAT - Test1</Platform>',
      priorRevisionId: 3
    })

    expect(result).toEqual(expect.objectContaining({
      changed: true,
      format: 'unified',
      truncated: false,
      originalBytes: 26,
      correctedBytes: 34
    }))

    expect(result.patch).toContain('--- cmr-revision-3')
    expect(result.patch).toContain('+++ corrected-metadata')
    expect(result.patch).toContain('-<Platform>GOSAT</Platform>')
    expect(result.patch).toContain('+<Platform>GOSAT - Test1</Platform>')
  })

  test('formats minified XML into a readable line-level diff', () => {
    const result = buildNativeMetadataDiff({
      originalMetadata: '<?xml version="1.0"?><Collection><ShortName>TEST</ShortName><Platforms><Platform><ShortName>GOSAT</ShortName><LongName>Greenhouse Gases Observing Satellite</LongName></Platform></Platforms></Collection>',
      correctedMetadata: '<?xml version="1.0"?><Collection><ShortName>TEST</ShortName><Platforms><Platform><ShortName>GOSAT - Test1</ShortName><LongName>Greenhouse Gases Observing Satellite</LongName></Platform></Platforms></Collection>',
      priorRevisionId: 5
    })

    expect(result.patch).toContain('     <Platform>')
    expect(result.patch).toContain('-      <ShortName>GOSAT</ShortName>')
    expect(result.patch).toContain('+      <ShortName>GOSAT - Test1</ShortName>')
    expect(result.patch).toContain('       <LongName>Greenhouse Gases Observing Satellite</LongName>')
    expect(result.patch).not.toContain('-<?xml version="1.0"?><Collection>')
  })

  test('ignores XML formatting differences', () => {
    const result = buildNativeMetadataDiff({
      originalMetadata: '<Collection>\n  <ShortName>TEST</ShortName>\n</Collection>',
      correctedMetadata: '<Collection><ShortName>TEST</ShortName></Collection>'
    })

    expect(result.changed).toBe(false)
    expect(result.patch).toBe('')
  })

  test('leaves invalid XML text unchanged for diffing', () => {
    const result = buildNativeMetadataDiff({
      originalMetadata: '<Collection><ShortName>OLD</Collection>',
      correctedMetadata: '<Collection><ShortName>NEW</Collection>'
    })

    expect(result.patch).toContain('-<Collection><ShortName>OLD</Collection>')
    expect(result.patch).toContain('+<Collection><ShortName>NEW</Collection>')
  })

  test('serializes JSON metadata and reports identical payloads without a patch', () => {
    const metadata = { Platforms: [{ ShortName: 'GOSAT' }] }

    expect(buildNativeMetadataDiff({
      originalMetadata: metadata,
      correctedMetadata: structuredClone(metadata),
      priorRevisionId: 4
    })).toEqual({
      changed: false,
      format: 'unified',
      patch: '',
      truncated: false,
      originalBytes: 63,
      correctedBytes: 63
    })
  })

  test('caps a large diff and marks it as truncated', () => {
    const result = buildNativeMetadataDiff({
      originalMetadata: `old-${'a'.repeat(300_000)}`,
      correctedMetadata: `new-${'b'.repeat(300_000)}`
    })

    expect(result.changed).toBe(true)
    expect(result.truncated).toBe(true)
    expect(result.patch).toHaveLength(250_000)
  })

  test('returns undefined when metadata cannot be serialized', () => {
    const circularMetadata = {}
    circularMetadata.self = circularMetadata

    expect(buildNativeMetadataDiff({
      originalMetadata: circularMetadata,
      correctedMetadata: {}
    })).toBeUndefined()
  })
})
