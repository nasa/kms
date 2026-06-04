import { readFileSync } from 'fs'
import { join } from 'path'

import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { logger } from '@/shared/logger'

import {
  compareKeywordCsvContent,
  getKeywordChangeSummary,
  getPublishKeywordEvents,
  parseCsvContent,
  toJSON
} from '../getPublishKeywordEvents'

vi.mock('@/shared/getConceptSchemeDetails', () => ({
  getConceptSchemeDetails: vi.fn()
}))

vi.mock('@/shared/downloadConcepts', () => ({
  downloadConcepts: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../helpers/delay', () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}))

describe('getPublishKeywordEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  test('parseCsvContent creates a uuid-to-path map from keyword csv content', () => {
    const publishedCsv = readFileSync(
      join(__dirname, '../../__mocks__/sciencekeywords-published.csv'),
      'utf-8'
    )

    const result = parseCsvContent(publishedCsv)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('91697b7d-8f2b-4954-850e-61d5f61c867d')).toBe(
      'EARTH SCIENCE > OCEANS >  >  >  >  > '
    )

    expect(result.get('f6c057c9-c789-4cd5-ba22-e9b08aae152b')).toBe(
      'EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > AQUACULTURE >  >  > '
    )

    expect(parseCsvContent()).toEqual(new Map())
  })

  test('parseCsvContent ignores rows whose UUID cell is blank', () => {
    const csvContent = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE",""'
    ].join('\n')

    expect(parseCsvContent(csvContent)).toEqual(new Map())
  })

  test('compareKeywordCsvContent and related serializers categorize added removed and changed keywords', () => {
    const publishedCsv = readFileSync(
      join(__dirname, '../../__mocks__/sciencekeywords-published.csv'),
      'utf-8'
    )
    const draftCsv = readFileSync(
      join(__dirname, '../../__mocks__/sciencekeywords-draft.csv'),
      'utf-8'
    )

    const comparison = compareKeywordCsvContent({
      oldCsvContent: publishedCsv,
      newCsvContent: draftCsv
    })

    expect(comparison.addedKeywords.get('3472f70b-874f-6dc5-87db-4b3ebc4b9a73')).toEqual({
      oldPath: undefined,
      newPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > SHORELINES > NEW SHORELINES >  > '
    })

    expect(comparison.removedKeywords.get('488f4df2-712e-4fac-98d1-46ab134b84ee')).toEqual({
      oldPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > ROCKY COASTS >  >  > ',
      newPath: undefined
    })

    expect(comparison.changedKeywords.get('7863ce31-0e06-42a5-bcf8-25981c44dec8')).toEqual({
      oldPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS >  >  > ',
      newPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS MODIFIED >  >  > '
    })

    expect(getKeywordChangeSummary(comparison)).toEqual({
      addedCount: comparison.addedKeywords.size,
      removedCount: comparison.removedKeywords.size,
      changedCount: comparison.changedKeywords.size
    })

    expect(toJSON(comparison)).toMatchObject({
      addedKeywords: expect.any(Object),
      removedKeywords: expect.any(Object),
      changedKeywords: expect.any(Object)
    })
  })

  test('returns no publish keyword events when neither draft nor published has schemes', async () => {
    vi.mocked(getConceptSchemeDetails).mockResolvedValue([])

    await expect(getPublishKeywordEvents()).resolves.toEqual({
      keywordChangesMap: new Map(),
      keywordEvents: [],
      keywordChangeSummary: {
        addedCount: 0,
        removedCount: 0,
        changedCount: 0
      },
      failedSchemes: [],
      totalSchemeCount: 0,
      keywordChangeCount: 0
    })

    expect(downloadConcepts).not.toHaveBeenCalled()
  })

  test('treats missing concept scheme lists as empty arrays', async () => {
    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undefined)

    await expect(getPublishKeywordEvents()).resolves.toMatchObject({
      keywordEvents: [],
      totalSchemeCount: 0
    })
  })

  test('builds inserted updated and deleted keyword events from published and draft csv content', async () => {
    const publishedScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","","","","","uuid-updated"',
      '"PATH 1","","","","","","","uuid-removed"'
    ].join('\n')
    const draftScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","CLOUDS","","","","","uuid-updated"',
      '"PATH DRAFT","","","","","","","uuid-added"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockImplementation(async ({ version }) => (
      version === 'published' ? publishedScienceCsv : draftScienceCsv
    ))

    const result = await getPublishKeywordEvents()

    expect(result.keywordChangeSummary).toEqual({
      addedCount: 1,
      removedCount: 1,
      changedCount: 1
    })

    expect(result.keywordChangeCount).toBe(3)
    expect(result.failedSchemes).toEqual([])
    expect(result.keywordEvents).toContainEqual(expect.objectContaining({
      EventType: 'INSERTED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid-added',
      NewKeywordObject: {
        Category: 'PATH DRAFT',
        Topic: '',
        Term: '',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }))

    expect(result.keywordEvents).toContainEqual(expect.objectContaining({
      EventType: 'DELETED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid-removed',
      OldKeywordObject: {
        Category: 'PATH 1',
        Topic: '',
        Term: '',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }))

    expect(result.keywordEvents).toContainEqual(expect.objectContaining({
      EventType: 'UPDATED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid-updated',
      OldKeywordObject: expect.objectContaining({
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }),
      NewKeywordObject: expect.objectContaining({
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'CLOUDS'
      })
    }))
  })

  test('continues publish keyword analysis when a scheme fails and blocking is disabled', async () => {
    const emptyScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"'
    ].join('\n')
    const draftScienceCsv = [
      emptyScienceCsv,
      '"PATH","","","","","","","uuid-new"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ])
      .mockResolvedValueOnce([
        { notation: 'sciencekeywords' },
        { notation: 'platforms' }
      ])

    vi.mocked(downloadConcepts).mockImplementation(async ({ conceptScheme, version }) => {
      if (conceptScheme === 'platforms') {
        throw new Error('Failed to download CSV. Status: 500 - Download failed')
      }

      return version === 'published' ? emptyScienceCsv : draftScienceCsv
    })

    const result = await getPublishKeywordEvents()

    expect(result.keywordEvents).toHaveLength(1)
    expect(result.keywordChangeCount).toBe(1)
    expect(result.failedSchemes).toEqual([
      {
        notation: 'platforms',
        error: 'Failed to download CSV. Status: 500 - Download failed'
      }
    ])

    expect(logger.warn).toHaveBeenCalledWith(
      '[publisher] Keyword changes detection failed for 1 scheme(s): '
      + 'platforms: Failed to download CSV. Status: 500 - Download failed. '
      + 'Continuing with publish because BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE is disabled.'
    )
  })

  test('leaves blank keyword event objects undefined when a changed csv row contains no usable path values', async () => {
    const emptyScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"'
    ].join('\n')
    const draftScienceCsv = [
      emptyScienceCsv,
      '"","","","","","","","uuid-new"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockImplementation(async ({ version }) => (
      version === 'published' ? emptyScienceCsv : draftScienceCsv
    ))

    const result = await getPublishKeywordEvents()

    expect(result.keywordEvents).toContainEqual(expect.objectContaining({
      EventType: 'INSERTED',
      UUID: 'uuid-new',
      NewKeywordObject: undefined
    }))
  })

  test('treats publish-only schemes as deleted keyword events', async () => {
    const publishedScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","","","","","uuid-removed"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([])

    vi.mocked(downloadConcepts).mockResolvedValue(publishedScienceCsv)

    const result = await getPublishKeywordEvents()

    expect(result.keywordEvents).toEqual([
      expect.objectContaining({
        EventType: 'DELETED',
        UUID: 'uuid-removed',
        OldKeywordObject: expect.objectContaining({
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS'
        })
      })
    ])
  })

  test('treats draft-only schemes as inserted keyword events', async () => {
    const draftScienceCsv = [
      '"Keyword Version: 1.0"',
      '"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"',
      '"EARTH SCIENCE","ATMOSPHERE","CLOUDS","","","","","uuid-added"'
    ].join('\n')

    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockResolvedValue(draftScienceCsv)

    const result = await getPublishKeywordEvents()

    expect(result.keywordEvents).toEqual([
      expect.objectContaining({
        EventType: 'INSERTED',
        UUID: 'uuid-added',
        NewKeywordObject: expect.objectContaining({
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'CLOUDS'
        })
      })
    ])
  })

  test('throws when publish keyword analysis exhausts retries and blocking is enabled', async () => {
    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockRejectedValue(
      new Error('Failed to download CSV. Status: 500 - Download failed')
    )

    await expect(getPublishKeywordEvents({
      blockOnFailure: true
    })).rejects.toThrow(
      'Keyword changes detection failed for 1 scheme(s): '
      + 'sciencekeywords: Failed to download CSV. Status: 500 - Download failed'
    )
  })

  test('falls back to an unknown error message when a failed scheme does not provide one', async () => {
    vi.mocked(getConceptSchemeDetails)
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])
      .mockResolvedValueOnce([{ notation: 'sciencekeywords' }])

    vi.mocked(downloadConcepts).mockRejectedValue({})

    const result = await getPublishKeywordEvents()

    expect(result.failedSchemes).toEqual([
      {
        notation: 'sciencekeywords',
        error: 'Unknown error'
      }
    ])
  })
})
