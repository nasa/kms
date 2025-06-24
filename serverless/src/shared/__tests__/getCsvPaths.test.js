import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { buildHierarchicalCsvPaths } from '@/shared/buildHierarchicalCsvPaths'
import { getLongNamesMap } from '@/shared/getLongNamesMap'
import { getNarrowersMap } from '@/shared/getNarrowersMap'
import { getProviderUrlsMap } from '@/shared/getProviderUrlsMap'
import { getRootConceptForScheme } from '@/shared/getRootConceptForScheme'

import { getCsvPaths } from '../getCsvPaths'

// Mock the imported functions
vi.mock('@/shared/getLongNamesMap')
vi.mock('@/shared/getNarrowersMap')
vi.mock('@/shared/getProviderUrlsMap')
vi.mock('@/shared/getRootConceptForScheme')
vi.mock('@/shared/buildHierarchicalCsvPaths')

describe('getCsvPaths', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('when successful', () => {
    test('should return reversed keywords array', async () => {
      // Mock the imported functions
      getRootConceptForScheme.mockResolvedValue([
        {
          prefLabel: { value: 'Root1' },
          subject: { value: 'http://example.com/root1' }
        },
        {
          prefLabel: { value: 'Root2' },
          subject: { value: 'http://example.com/root2' }
        }
      ])

      getNarrowersMap.mockResolvedValue({})
      getLongNamesMap.mockResolvedValue({})
      getProviderUrlsMap.mockResolvedValue({})

      buildHierarchicalCsvPaths.mockImplementation((params) => {
        params.paths.push('Keyword1', 'Keyword2', 'Keyword3')
      })

      const result = await getCsvPaths('testScheme', 3, 'draft')

      expect(result).toEqual(['Keyword3', 'Keyword2', 'Keyword1', 'Keyword3', 'Keyword2', 'Keyword1'])
      expect(getRootConceptForScheme).toHaveBeenCalledWith('testScheme', 'draft')
      expect(getNarrowersMap).toHaveBeenCalledWith('testScheme', 'draft')
      expect(getLongNamesMap).toHaveBeenCalledWith('testScheme', 'draft')
      expect(getProviderUrlsMap).not.toHaveBeenCalled()
      expect(buildHierarchicalCsvPaths).toHaveBeenCalledTimes(2)
    })

    test('should handle multiple roots correctly', async () => {
      getRootConceptForScheme.mockResolvedValue([
        {
          prefLabel: { value: 'Root1' },
          subject: { value: 'http://example.com/root1' }
        },
        {
          prefLabel: { value: 'Root2' },
          subject: { value: 'http://example.com/root2' }
        },
        {
          prefLabel: { value: 'Root3' },
          subject: { value: 'http://example.com/root3' }
        }
      ])

      getNarrowersMap.mockResolvedValue({})
      getLongNamesMap.mockResolvedValue({})
      getProviderUrlsMap.mockResolvedValue({})

      buildHierarchicalCsvPaths.mockImplementation((params) => {
        if (params.n.prefLabel === 'Root1') {
          params.paths.push('KeywordA1', 'KeywordA2')
        } else if (params.n.prefLabel === 'Root2') {
          params.paths.push('KeywordB1', 'KeywordB2')
        } else if (params.n.prefLabel === 'Root3') {
          params.paths.push('KeywordC1', 'KeywordC2')
        }
      })

      const result = await getCsvPaths('testScheme', 3, 'draft')

      expect(result).toEqual(['KeywordC2', 'KeywordC1', 'KeywordB2', 'KeywordB1', 'KeywordA2', 'KeywordA1'])
      expect(getRootConceptForScheme).toHaveBeenCalledWith('testScheme', 'draft')
      expect(getNarrowersMap).toHaveBeenCalledWith('testScheme', 'draft')
      expect(getLongNamesMap).toHaveBeenCalledWith('testScheme', 'draft')
      expect(getProviderUrlsMap).not.toHaveBeenCalled()
      expect(buildHierarchicalCsvPaths).toHaveBeenCalledTimes(3)
    })

    test('should call getProviderUrlsMap when scheme is "providers"', async () => {
      getRootConceptForScheme.mockResolvedValue([
        {
          prefLabel: { value: 'Root' },
          subject: { value: 'http://example.com/root' }
        }
      ])

      getNarrowersMap.mockResolvedValue({})
      getLongNamesMap.mockResolvedValue({})
      getProviderUrlsMap.mockResolvedValue({})
      buildHierarchicalCsvPaths.mockImplementation(() => {})

      await getCsvPaths('providers', 3, 'draft')

      expect(getProviderUrlsMap).toHaveBeenCalledWith('providers', 'draft')
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors gracefully', async () => {
      getRootConceptForScheme.mockRejectedValue(new Error('Root concept error'))

      await expect(getCsvPaths('testScheme', 3)).rejects.toThrow('Root concept error')
    })
  })
})
