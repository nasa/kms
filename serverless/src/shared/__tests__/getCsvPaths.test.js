import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import getLongNamesMap from '@/shared/getLongNamesMap'
import getNarrowersMap from '@/shared/getNarrowersMap'
import getProviderUrlsMap from '@/shared/getProviderUrlsMap'
import getRootConcept from '@/shared/getRootConcept'
import traverseGraph from '@/shared/traverseGraph'

import getCsvPaths from '../getCsvPaths'

// Mock the imported functions
vi.mock('@/shared/getLongNamesMap')
vi.mock('@/shared/getNarrowersMap')
vi.mock('@/shared/getProviderUrlsMap')
vi.mock('@/shared/getRootConcept')
vi.mock('@/shared/traverseGraph')

describe('getCsvPaths', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return reversed keywords array', async () => {
    // Mock the imported functions
    getRootConcept.mockResolvedValue({
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    })

    getNarrowersMap.mockResolvedValue({})
    getLongNamesMap.mockResolvedValue({})
    getProviderUrlsMap.mockResolvedValue({})
    traverseGraph.mockImplementation((_, __, ___, ____, _____, ______, _______, keywords) => {
      keywords.push('Keyword1', 'Keyword2', 'Keyword3')
    })

    const result = await getCsvPaths('testScheme', 3)

    expect(result).toEqual(['Keyword3', 'Keyword2', 'Keyword1'])
    expect(getRootConcept).toHaveBeenCalledWith('testScheme')
    expect(getNarrowersMap).toHaveBeenCalledWith('testScheme')
    expect(getLongNamesMap).toHaveBeenCalledWith('testScheme')
    expect(getProviderUrlsMap).not.toHaveBeenCalled()
    expect(traverseGraph).toHaveBeenCalled()
  })

  it('should call getProviderUrlsMap when scheme is "providers"', async () => {
    getRootConcept.mockResolvedValue({
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    })

    getNarrowersMap.mockResolvedValue({})
    getLongNamesMap.mockResolvedValue({})
    getProviderUrlsMap.mockResolvedValue({})
    traverseGraph.mockImplementation(() => {})

    await getCsvPaths('providers', 3)

    expect(getProviderUrlsMap).toHaveBeenCalledWith('providers')
  })

  it('should handle errors gracefully', async () => {
    getRootConcept.mockRejectedValue(new Error('Root concept error'))

    await expect(getCsvPaths('testScheme', 3)).rejects.toThrow('Root concept error')
  })
})
