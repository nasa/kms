import { createCsv } from '../../createCsv'
import { createCsvMetadata } from '../../createCsvMetadata'
import { generateCsvHeaders } from '../../generateCsvHeaders'
import { getCsvHeaders } from '../../getCsvHeaders'
import { getLongNamesMap } from '../../getLongNamesMap'
import { getMaxLengthOfSubArray } from '../../getMaxLengthOfSubArray'
import { getNarrowers } from '../../getNarrowers'
import { getNarrowersMap } from '../../getNarrowersMap'
import { getProviderUrlsMap } from '../../getProviderUrlsMap'
import { getRootConceptForScheme } from '../../getRootConceptForScheme'
import { isCsvLongNameFlag } from '../../isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '../../isCsvProviderUrlFlag'
import { formatKeywordCsvPath, getCsvForScheme } from '../getCsvForScheme'

vi.mock('../../createCsv', () => ({
  createCsv: vi.fn()
}))

vi.mock('../../createCsvMetadata', () => ({
  createCsvMetadata: vi.fn()
}))

vi.mock('../../generateCsvHeaders', () => ({
  generateCsvHeaders: vi.fn()
}))

vi.mock('../../getCsvHeaders', () => ({
  getCsvHeaders: vi.fn()
}))

vi.mock('../../getLongNamesMap', () => ({
  getLongNamesMap: vi.fn()
}))

vi.mock('../../getMaxLengthOfSubArray', () => ({
  getMaxLengthOfSubArray: vi.fn()
}))

vi.mock('../../getNarrowers', () => ({
  getNarrowers: vi.fn()
}))

vi.mock('../../getNarrowersMap', () => ({
  getNarrowersMap: vi.fn()
}))

vi.mock('../../getProviderUrlsMap', () => ({
  getProviderUrlsMap: vi.fn()
}))

vi.mock('../../getRootConceptForScheme', () => ({
  getRootConceptForScheme: vi.fn()
}))

vi.mock('../../isCsvLongNameFlag', () => ({
  isCsvLongNameFlag: vi.fn()
}))

vi.mock('../../isCsvProviderUrlFlag', () => ({
  isCsvProviderUrlFlag: vi.fn()
}))

describe('getCsvForScheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createCsvMetadata).mockReturnValue(['mocked metadata'])
    vi.mocked(getNarrowersMap).mockResolvedValue(new Map())
    vi.mocked(getLongNamesMap).mockResolvedValue({})
    vi.mocked(isCsvLongNameFlag).mockReturnValue(false)
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(false)
    vi.mocked(createCsv).mockResolvedValue('csv,content')
  })

  test('formatKeywordCsvPath pads platforms and related short-name schemes correctly', () => {
    expect(formatKeywordCsvPath({
      scheme: 'platforms',
      csvHeadersCount: 5,
      path: ['a', 'b', 'c'],
      isLeaf: false
    })).toEqual(['a', 'b', 'c'])

    expect(formatKeywordCsvPath({
      scheme: 'instruments',
      csvHeadersCount: 6,
      path: ['Instrument1'],
      isLeaf: false
    })).toEqual(['Instrument1', '', '', ''])

    expect(formatKeywordCsvPath({
      scheme: 'projects',
      csvHeadersCount: 6,
      path: ['Project Category', 'ShortName'],
      isLeaf: true
    })).toEqual(['Project Category', '', '', 'ShortName'])
  })

  test('formatKeywordCsvPath pads full-path and provider schemes correctly', () => {
    expect(formatKeywordCsvPath({
      scheme: 'sciencekeywords',
      csvHeadersCount: 3,
      path: ['a', 'b'],
      isLeaf: false
    })).toEqual(['a', 'b'])

    expect(formatKeywordCsvPath({
      scheme: 'sciencekeywords',
      csvHeadersCount: 5,
      path: ['a', 'b'],
      isLeaf: false
    })).toEqual(['a', 'b', '', ''])

    expect(formatKeywordCsvPath({
      scheme: 'providers',
      csvHeadersCount: 5,
      path: ['a', 'b'],
      isLeaf: false
    })).toEqual(['a', 'b'])

    expect(formatKeywordCsvPath({
      scheme: 'providers',
      csvHeadersCount: 6,
      path: ['a', 'b'],
      isLeaf: false
    })).toEqual(['a', 'b', ''])

    expect(formatKeywordCsvPath({
      scheme: 'providers',
      csvHeadersCount: 6,
      path: ['a', 'b'],
      isLeaf: true
    })).toEqual(['a', '', 'b'])

    expect(formatKeywordCsvPath({
      scheme: 'sciencekeywords',
      csvHeadersCount: 5,
      path: ['a', 'b', 'c', 'd', 'e'],
      isLeaf: false
    })).toEqual(['a', 'b', 'c', 'd', 'e'])

    expect(formatKeywordCsvPath({
      scheme: 'providers',
      csvHeadersCount: 6,
      path: ['a', 'b', 'c', 'd'],
      isLeaf: true
    })).toEqual(['a', 'b', 'c', 'd'])

    expect(formatKeywordCsvPath({
      scheme: 'unknown',
      csvHeadersCount: 5,
      path: ['a', 'b', 'c'],
      isLeaf: false
    })).toEqual(['a', 'b', 'c'])
  })

  test('writes sorted csv rows for a scheme through the centralized hierarchy walk', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue(['Header1', 'Header2', 'UUID'])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'Zulu',
            uri: 'http://example.com/z'
          },
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/a'
          }
        ]
      }

      return []
    })

    await expect(getCsvForScheme({
      scheme: 'testScheme',
      version: 'draft',
      versionName: 'Test Version',
      versionCreationDate: '2023-01-01'
    })).resolves.toBe('csv,content')

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'Header2', 'UUID'],
      [
        ['Alpha', 'a'],
        ['Zulu', 'z']
      ]
    )
  })

  test('sorts csv rows by shorter length when the shared prefix is identical', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue(['Header1', 'Header2', 'Header3', 'UUID'])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/root') {
        return [
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/alpha-branch'
          },
          {
            narrowerPrefLabel: 'Alpha',
            uri: 'http://example.com/alpha-parent'
          }
        ]
      }

      if (uri === 'http://example.com/alpha-parent') {
        return [
          {
            narrowerPrefLabel: 'alpha-branch',
            uri: 'http://example.com/beta'
          }
        ]
      }

      return []
    })

    await getCsvForScheme({
      scheme: 'testScheme',
      version: 'draft',
      versionName: 'Test Version',
      versionCreationDate: '2023-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'Header2', 'Header3', 'UUID'],
      [
        ['Alpha', 'alpha-branch'],
        ['Alpha', 'alpha-branch', 'beta'],
        ['Alpha', 'alpha-parent']
      ]
    )
  })

  test('appends long-name columns when generating csv rows for long-name schemes', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Category',
      'Class',
      'Type',
      'Short_Name',
      'Long_Name',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Platforms' },
        subject: { value: 'http://example.com/platforms' }
      }
    ])

    vi.mocked(getLongNamesMap).mockResolvedValue({
      'http://example.com/aqua': 'Aqua satellite'
    })

    vi.mocked(isCsvLongNameFlag).mockReturnValue(true)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/platforms') {
        return [
          {
            narrowerPrefLabel: 'Aqua',
            uri: 'http://example.com/aqua'
          }
        ]
      }

      return []
    })

    await getCsvForScheme({
      scheme: 'platforms',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Category', 'Class', 'Type', 'Short_Name', 'Long_Name', 'UUID'],
      [
        ['', '', '', 'Aqua', 'Aqua satellite', 'aqua']
      ]
    )
  })

  test('writes blank long-name columns when the long-name flag is enabled but no long name exists', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Category',
      'Class',
      'Type',
      'Short_Name',
      'Long_Name',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Platforms' },
        subject: { value: 'http://example.com/platforms' }
      }
    ])

    vi.mocked(isCsvLongNameFlag).mockReturnValue(true)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/platforms') {
        return [
          {
            narrowerPrefLabel: 'Terra',
            uri: 'http://example.com/terra'
          }
        ]
      }

      return []
    })

    await getCsvForScheme({
      scheme: 'platforms',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Category', 'Class', 'Type', 'Short_Name', 'Long_Name', 'UUID'],
      [
        ['', '', '', 'Terra', '', 'terra']
      ]
    )
  })

  test('loads provider urls and appends them when generating provider csv content', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Bucket_Level_0',
      'Bucket_Level_1',
      'Bucket_Level_2',
      'Bucket_Level_3',
      'Short_Name',
      'Data_Center_URL',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'ARCHIVER' },
        subject: { value: 'http://example.com/archiver' }
      }
    ])

    vi.mocked(getProviderUrlsMap).mockResolvedValue({
      'http://example.com/provider': ['https://example.com/provider']
    })

    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(true)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/archiver') {
        return [
          {
            narrowerPrefLabel: 'KPDC',
            uri: 'http://example.com/provider'
          }
        ]
      }

      return []
    })

    await getCsvForScheme({
      scheme: 'providers',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(getProviderUrlsMap).toHaveBeenCalledWith('providers', 'published')
    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Bucket_Level_0', 'Bucket_Level_1', 'Bucket_Level_2', 'Bucket_Level_3', 'Short_Name', 'Data_Center_URL', 'UUID'],
      [
        ['', '', '', 'KPDC', 'https://example.com/provider', 'provider']
      ]
    )
  })

  test('writes blank provider url columns when the provider-url flag is enabled but no url exists', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue([
      'Bucket_Level_0',
      'Bucket_Level_1',
      'Bucket_Level_2',
      'Bucket_Level_3',
      'Short_Name',
      'Data_Center_URL',
      'UUID'
    ])

    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'ARCHIVER' },
        subject: { value: 'http://example.com/archiver' }
      }
    ])

    vi.mocked(getProviderUrlsMap).mockResolvedValue({})
    vi.mocked(isCsvProviderUrlFlag).mockReturnValue(true)
    vi.mocked(getNarrowers).mockImplementation((uri) => {
      if (uri === 'http://example.com/archiver') {
        return [
          {
            narrowerPrefLabel: 'KPDC',
            uri: 'http://example.com/provider'
          }
        ]
      }

      return []
    })

    await getCsvForScheme({
      scheme: 'providers',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Bucket_Level_0', 'Bucket_Level_1', 'Bucket_Level_2', 'Bucket_Level_3', 'Short_Name', 'Data_Center_URL', 'UUID'],
      [
        ['', '', '', 'KPDC', '', 'provider']
      ]
    )
  })

  test('generates csv headers when the scheme has no predefined headers and omits root-only rows', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue([])
    vi.mocked(getRootConceptForScheme).mockResolvedValue([
      {
        prefLabel: { value: 'Root' },
        subject: { value: 'http://example.com/root' }
      }
    ])

    vi.mocked(getNarrowers).mockReturnValue([])
    vi.mocked(getMaxLengthOfSubArray).mockReturnValue(0)
    vi.mocked(generateCsvHeaders).mockResolvedValue(['Header1', 'UUID'])

    await getCsvForScheme({
      scheme: 'testScheme',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(getMaxLengthOfSubArray).toHaveBeenCalledWith([])
    expect(generateCsvHeaders).toHaveBeenCalledWith('testScheme', 'published', 0)
    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'UUID'],
      []
    )
  })

  test('returns generated csv content when the root list is null', async () => {
    vi.mocked(getCsvHeaders).mockResolvedValue(['Header1', 'UUID'])
    vi.mocked(getRootConceptForScheme).mockResolvedValue(null)

    await getCsvForScheme({
      scheme: 'testScheme',
      version: 'published',
      versionName: 'Keyword Version',
      versionCreationDate: '2024-01-01'
    })

    expect(createCsv).toHaveBeenCalledWith(
      ['mocked metadata'],
      ['Header1', 'UUID'],
      []
    )
  })
})
