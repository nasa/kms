import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getCsvPaths from '../getCsvPaths'
import getRootConcept from '../getRootConcept'
import getNarrowersMap from '../getNarrowersMap'
import getLongNamesMap from '../getLongNamesMap'
import getProviderUrlsMap from '../getProviderUrlsMap'
import traverseGraph from '../traverseGraph'

// Mock the imported functions
vi.mock('../getRootConcept')
vi.mock('../getNarrowersMap')
vi.mock('../getLongNamesMap')
vi.mock('../getProviderUrlsMap')
vi.mock('../traverseGraph')

describe('getCsvPaths', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()
  })

  it('should return reversed keywords array', async () => {
    // Mock the return values of the imported functions
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
  })

  it('should pass correct arguments to traverseGraph', async () => {
    const mockNarrowersMap = { mock: 'narrowersMap' }
    const mockLongNamesMap = { mock: 'longNamesMap' }
    const mockProviderUrlsMap = { mock: 'providerUrlsMap' }

    getRootConcept.mockResolvedValue({
      prefLabel: { value: 'Root' },
      subject: { value: 'http://example.com/root' }
    })

    getNarrowersMap.mockResolvedValue(mockNarrowersMap)
    getLongNamesMap.mockResolvedValue(mockLongNamesMap)
    getProviderUrlsMap.mockResolvedValue(mockProviderUrlsMap)

    await getCsvPaths('providers', 3)

    expect(traverseGraph).toHaveBeenCalledWith(
      3,
      mockProviderUrlsMap,
      mockLongNamesMap,
      'providers',
      {
        prefLabel: 'Root',
        narrowerPrefLabel: 'Root',
        uri: 'http://example.com/root'
      },
      mockNarrowersMap,
      [],
      []
    )
  })
})
