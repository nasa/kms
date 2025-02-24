import {
  describe,
  it,
  expect,
  vi
} from 'vitest'
import getCsvPaths from '../getCsvPaths'
import getRootConcept from '../getRootConcept'
import getNarrowersMap from '../getNarrowersMap'
import getLongNamesMap from '../getLongNamesMap'
import getProviderUrlsMap from '../getProviderUrlsMap'

// Mock the imported functions
vi.mock('../getRootConcept')
vi.mock('../getNarrowersMap')
vi.mock('../getLongNamesMap')
vi.mock('../getProviderUrlsMap')

describe('getCsvPaths', () => {
  it('should return correct paths for platforms', async () => {
    // Mock the necessary data
    getRootConcept.mockResolvedValue({
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    })

    getNarrowersMap.mockResolvedValue({
      'http://example.com/root': [
        {
          prefLabel: { value: 'Root' },
          narrower: { value: 'http://example.com/child' },
          narrowerPrefLabel: { value: 'Child' }
        }
      ]
    })

    getLongNamesMap.mockResolvedValue({
      'http://example.com/child': ['Long Name']
    })

    const result = await getCsvPaths('platforms', 4)

    expect(result).toEqual([
      [' ', 'Child', 'Long Name', 'child']
    ])
  })

  it('should return correct paths for providers', async () => {
    // Mock the necessary data
    getRootConcept.mockResolvedValue({
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    })

    getNarrowersMap.mockResolvedValue({
      'http://example.com/root': [
        {
          prefLabel: { value: 'Root' },
          narrower: { value: 'http://example.com/provider' },
          narrowerPrefLabel: { value: 'Provider' }
        }
      ]
    })

    getLongNamesMap.mockResolvedValue({
      'http://example.com/provider': ['Long Name']
    })

    getProviderUrlsMap.mockResolvedValue({
      'http://example.com/provider': ['http://provider.com']
    })

    const result = await getCsvPaths('providers', 5)

    expect(result).toEqual([
      [' ', 'Provider', 'Long Name', 'http://provider.com', 'provider']
    ])
  })

  it('should return correct paths for providers', async () => {
    // Mock the necessary data
    getRootConcept.mockResolvedValue({
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    })

    getNarrowersMap.mockResolvedValue({
      'http://example.com/root': [
        {
          prefLabel: { value: 'Root' },
          narrower: { value: 'http://example.com/provider' },
          narrowerPrefLabel: { value: 'Provider' }
        }
      ]
    })

    getLongNamesMap.mockResolvedValue({
      'http://example.com/provider': ['Long Name']
    })

    getProviderUrlsMap.mockResolvedValue({
      'http://example.com/provider': ['http://provider.com']
    })

    const result = await getCsvPaths('providers', 5)

    expect(result).toEqual([
      [' ', 'Provider', 'Long Name', 'http://provider.com', 'provider']
    ])
  })
})
