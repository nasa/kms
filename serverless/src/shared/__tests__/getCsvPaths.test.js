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
      getRootConceptForScheme.mockResolvedValue({
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      })

      getNarrowersMap.mockResolvedValue({})
      getLongNamesMap.mockResolvedValue({})
      getProviderUrlsMap.mockResolvedValue({})

      buildHierarchicalCsvPaths.mockImplementation((params) => {
        params.paths.push('Keyword1', 'Keyword2', 'Keyword3')
      })

      const result = await getCsvPaths('testScheme', 3)

      expect(result).toEqual(['Keyword3', 'Keyword2', 'Keyword1'])
      expect(getRootConceptForScheme).toHaveBeenCalledWith('testScheme')
      expect(getNarrowersMap).toHaveBeenCalledWith('testScheme')
      expect(getLongNamesMap).toHaveBeenCalledWith('testScheme')
      expect(getProviderUrlsMap).not.toHaveBeenCalled()
      expect(buildHierarchicalCsvPaths).toHaveBeenCalled()
    })

    test('should call getProviderUrlsMap when scheme is "providers"', async () => {
      getRootConceptForScheme.mockResolvedValue({
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      })

      getNarrowersMap.mockResolvedValue({})
      getLongNamesMap.mockResolvedValue({})
      getProviderUrlsMap.mockResolvedValue({})
      buildHierarchicalCsvPaths.mockImplementation(() => {})

      await getCsvPaths('providers', 3)

      expect(getProviderUrlsMap).toHaveBeenCalledWith('providers')
    })
  })

  describe('when unsuccessful', () => {
    test('should handle errors gracefully', async () => {
      getRootConceptForScheme.mockRejectedValue(new Error('Root concept error'))

      await expect(getCsvPaths('testScheme', 3)).rejects.toThrow('Root concept error')
    })
  })
})
