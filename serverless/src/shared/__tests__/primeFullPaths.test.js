import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { primeFullPaths } from '@/shared/primeFullPaths'

describe('when priming full paths', () => {
  test('returns empty warm list when csv body is missing', async () => {
    const getConcepts = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {
        'X-Total-Pages': '1'
      },
      body: null
    })
    const getConcept = vi.fn()
    const createConceptCacheKeyFromEvent = vi.fn().mockReturnValue('cache-key')

    const result = await primeFullPaths({
      schemes: [{ notation: 'platforms' }],
      getConcepts,
      getConcept,
      createConceptCacheKeyFromEvent,
      getTotalPagesFromResponse: () => 1,
      maxFullPaths: 100,
      primeVersion: 'published',
      pageSize: 2000
    })

    expect(result.schemeCsvSettled).toHaveLength(1)
    expect(result.limitedFullPathWarmEntries).toHaveLength(0)
    expect(result.fullPathSettled).toHaveLength(0)
    expect(getConcept).not.toHaveBeenCalled()
  })

  test('handles malformed csv and continues without full path entries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const getConcepts = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {
        'X-Total-Pages': '1'
      },
      body: '"unterminated'
    })
    const getConcept = vi.fn()
    const createConceptCacheKeyFromEvent = vi.fn().mockReturnValue('cache-key')

    const result = await primeFullPaths({
      schemes: [{ notation: 'platforms' }],
      getConcepts,
      getConcept,
      createConceptCacheKeyFromEvent,
      getTotalPagesFromResponse: () => 1,
      maxFullPaths: 100,
      primeVersion: 'published',
      pageSize: 2000
    })

    expect(result.schemeCsvSettled[0].status).toBe('fulfilled')
    expect(result.limitedFullPathWarmEntries).toHaveLength(0)
    expect(result.fullPathSettled).toHaveLength(0)
  })

  test('returns no full path entries when csv has fewer than three rows', async () => {
    const getConcepts = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {
        'X-Total-Pages': '1'
      },
      body: '"meta"\n"Category","Type"'
    })
    const getConcept = vi.fn()
    const createConceptCacheKeyFromEvent = vi.fn().mockReturnValue('cache-key')

    const result = await primeFullPaths({
      schemes: [{ notation: 'platforms' }],
      getConcepts,
      getConcept,
      createConceptCacheKeyFromEvent,
      getTotalPagesFromResponse: () => 1,
      maxFullPaths: 100,
      primeVersion: 'published',
      pageSize: 2000
    })

    expect(result.limitedFullPathWarmEntries).toHaveLength(0)
    expect(result.fullPathSettled).toHaveLength(0)
  })

  test('limits warmed full paths to maxFullPaths', async () => {
    const getConcepts = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {
        'X-Total-Pages': '1'
      },
      body: '"meta"\n"Category","Type"\n"PLATFORMS","Earth Observation"\n"PLATFORMS","Airborne"'
    })
    const getConcept = vi.fn().mockResolvedValue({ statusCode: 200 })
    const createConceptCacheKeyFromEvent = vi.fn().mockReturnValue('cache-key')

    const result = await primeFullPaths({
      schemes: [{ notation: 'platforms' }],
      getConcepts,
      getConcept,
      createConceptCacheKeyFromEvent,
      getTotalPagesFromResponse: () => 1,
      maxFullPaths: 1,
      primeVersion: 'published',
      pageSize: 2000
    })

    expect(result.limitedFullPathWarmEntries).toHaveLength(1)
    expect(result.fullPathSettled).toHaveLength(1)
    expect(getConcept).toHaveBeenCalledTimes(1)
  })

  test('collects rejected scheme csv requests', async () => {
    const getConcepts = vi.fn().mockRejectedValue(new Error('csv failed'))
    const getConcept = vi.fn()
    const createConceptCacheKeyFromEvent = vi.fn().mockReturnValue('cache-key')

    const result = await primeFullPaths({
      schemes: [{ notation: 'platforms' }],
      getConcepts,
      getConcept,
      createConceptCacheKeyFromEvent,
      getTotalPagesFromResponse: () => 1,
      maxFullPaths: 100,
      primeVersion: 'published',
      pageSize: 2000
    })

    expect(result.schemeCsvSettled).toHaveLength(1)
    expect(result.schemeCsvSettled[0].status).toBe('rejected')
    expect(result.limitedFullPathWarmEntries).toHaveLength(0)
    expect(result.fullPathSettled).toHaveLength(0)
    expect(getConcept).not.toHaveBeenCalled()
  })

  test('collects rejected full-path warm requests', async () => {
    const getConcepts = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {
        'X-Total-Pages': '1'
      },
      body: '"meta"\n"Category","Type"\n"PLATFORMS","Earth Observation"'
    })
    const getConcept = vi.fn().mockRejectedValue(new Error('warm full-path failed'))
    const createConceptCacheKeyFromEvent = vi.fn().mockReturnValue('cache-key')

    const result = await primeFullPaths({
      schemes: [{ notation: 'platforms' }],
      getConcepts,
      getConcept,
      createConceptCacheKeyFromEvent,
      getTotalPagesFromResponse: () => 1,
      maxFullPaths: 100,
      primeVersion: 'published',
      pageSize: 2000
    })

    expect(result.schemeCsvSettled).toHaveLength(1)
    expect(result.schemeCsvSettled[0].status).toBe('fulfilled')
    expect(result.fullPathSettled).toHaveLength(2)
    expect(result.fullPathSettled[0].status).toBe('rejected')
    expect(result.fullPathSettled[1].status).toBe('rejected')
  })
})
