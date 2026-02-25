import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { primeKeywordTrees } from '@/shared/primeKeywordTrees'

describe('when priming keyword trees', () => {
  test('should prime all tree and per-scheme tree routes', async () => {
    const getKeywordsTree = vi.fn().mockResolvedValue({ statusCode: 200 })
    const createTreeCacheKeyFromEvent = vi.fn((event) => `key:${event.path}`)

    const result = await primeKeywordTrees({
      schemes: [{ notation: 'platforms' }, { notation: 'instruments' }],
      getKeywordsTree,
      createTreeCacheKeyFromEvent,
      primeVersion: 'published'
    })

    expect(result.treeSettled).toHaveLength(3)
    expect(getKeywordsTree).toHaveBeenCalledTimes(3)
    expect(getKeywordsTree).toHaveBeenCalledWith(expect.objectContaining({
      path: '/tree/concept_scheme/all'
    }), {})

    expect(getKeywordsTree).toHaveBeenCalledWith(expect.objectContaining({
      path: '/tree/concept_scheme/platforms'
    }), {})

    expect(getKeywordsTree).toHaveBeenCalledWith(expect.objectContaining({
      path: '/tree/concept_scheme/instruments'
    }), {})
  })

  test('should return rejected result when a tree request throws', async () => {
    const getKeywordsTree = vi.fn()
      .mockResolvedValueOnce({ statusCode: 200 })
      .mockRejectedValueOnce(new Error('tree failed'))
    const createTreeCacheKeyFromEvent = vi.fn((event) => `key:${event.path}`)

    const result = await primeKeywordTrees({
      schemes: [{ notation: 'platforms' }],
      getKeywordsTree,
      createTreeCacheKeyFromEvent,
      primeVersion: 'published'
    })

    expect(result.treeSettled).toHaveLength(2)
    expect(result.treeSettled[0].status).toBe('fulfilled')
    expect(result.treeSettled[1].status).toBe('rejected')
  })

  test('should prime only all route when no schemes are provided', async () => {
    const getKeywordsTree = vi.fn().mockResolvedValue({ statusCode: 200 })
    const createTreeCacheKeyFromEvent = vi.fn((event) => `key:${event.path}`)

    const result = await primeKeywordTrees({
      schemes: [],
      getKeywordsTree,
      createTreeCacheKeyFromEvent,
      primeVersion: 'published'
    })

    expect(result.treeSettled).toHaveLength(1)
    expect(getKeywordsTree).toHaveBeenCalledTimes(1)
    expect(getKeywordsTree).toHaveBeenCalledWith(expect.objectContaining({
      path: '/tree/concept_scheme/all'
    }), {})
  })
})
