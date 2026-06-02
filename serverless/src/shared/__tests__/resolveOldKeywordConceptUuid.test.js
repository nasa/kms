import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getHistoricalConceptByKeyword, getPublishedConceptByUuid } from '../redisPathStore'
import { resolveOldKeywordConceptUuid } from '../resolveOldKeywordConceptUuid'

vi.mock('../redisPathStore', () => ({
  buildKeywordObjectFromPath: vi.fn(({ scheme, keywordPath }) => (
    keywordPath
      ? {
        scheme,
        keywordPath
      }
      : {}
  )),
  getHistoricalConceptByKeyword: vi.fn(),
  getPublishedConceptByUuid: vi.fn()
}))

describe('resolveOldKeywordConceptUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes hierarchy schemes to the full path stub using keywordValue', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-full-path',
      oldKeywordObject: {
        scheme: 'sciencekeywords',
        keywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
      },
      newKeywordObject: {
        scheme: 'sciencekeywords',
        keywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
      },
      action: 'replace'
    })

    expect(getHistoricalConceptByKeyword).toHaveBeenCalledWith({
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      },
      scheme: 'sciencekeywords'
    })

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-full-path',
      scheme: 'sciencekeywords'
    })
  })

  test('preserves interior holes for full-path lookups when keywordValue has sparse levels', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        VariableLevel1: 'SNOW/ICE'
      }
    })).resolves.toBeUndefined()

    expect(getHistoricalConceptByKeyword).toHaveBeenCalledWith({
      keywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        Term: '',
        VariableLevel1: 'SNOW/ICE',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      },
      scheme: 'sciencekeywords'
    })
  })

  test('routes short-name schemes to the short-name stub', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-short-name',
      fullPath: 'AIR-BASED PLATFORMS > HU-25A',
      longName: 'Dassault HU-25A Guardian'
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-short-name',
      fullPath: 'AIR-BASED PLATFORMS > HU-25A',
      longName: 'Dassault HU-25A Guardian'
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'platforms',
      keywordValue: {
        ShortName: 'HU-25A',
        LongName: 'Dassault HU-25A Guardian'
      }
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-short-name',
      oldKeywordObject: {
        scheme: 'platforms',
        keywordPath: 'AIR-BASED PLATFORMS > HU-25A'
      },
      newKeywordObject: {
        scheme: 'platforms',
        keywordPath: 'AIR-BASED PLATFORMS > HU-25A'
      },
      oldLongName: 'Dassault HU-25A Guardian',
      newLongName: 'Dassault HU-25A Guardian',
      action: 'replace'
    })

    expect(getHistoricalConceptByKeyword).toHaveBeenCalledWith({
      keywordObject: {
        ShortName: 'HU-25A'
      },
      scheme: 'platforms'
    })

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-short-name',
      scheme: 'platforms'
    })
  })

  test('requires keywordValue for full-path lookups', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()

    expect(getHistoricalConceptByKeyword).not.toHaveBeenCalled()
  })

  test('returns undefined when the historical lookup misses', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).resolves.toBeUndefined()
  })

  test('returns undefined when the current published path cannot be built', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).resolves.toBeUndefined()

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-full-path',
      scheme: 'sciencekeywords'
    })
  })

  test('returns a delete action when a delete event uuid matches the historical concept', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'deleted-project-uuid',
      fullPath: 'Projects > Legacy Climate Study'
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'projects',
      keywordValue: {
        ShortName: 'Legacy Climate Study'
      },
      keywordEvent: {
        eventType: 'DELETED',
        scheme: 'projects',
        uuid: 'deleted-project-uuid'
      }
    })).resolves.toEqual({
      keywordConceptUuid: 'deleted-project-uuid',
      oldKeywordObject: {
        scheme: 'projects',
        keywordPath: 'Projects > Legacy Climate Study'
      },
      newKeywordObject: {},
      action: 'delete'
    })

    expect(getPublishedConceptByUuid).not.toHaveBeenCalled()
  })

  test('returns a delete action for full-path schemes when the delete event matches the historical concept', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'deleted-science-uuid',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > ',
      longName: 'Legacy Aerosols'
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: 'LEGACY AEROSOLS'
      },
      keywordEvent: {
        eventType: 'DELETED',
        scheme: 'sciencekeywords',
        uuid: 'deleted-science-uuid'
      }
    })).resolves.toEqual({
      keywordConceptUuid: 'deleted-science-uuid',
      oldKeywordObject: {
        scheme: 'sciencekeywords',
        keywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > '
      },
      newKeywordObject: {},
      oldLongName: 'Legacy Aerosols',
      action: 'delete'
    })

    expect(getPublishedConceptByUuid).not.toHaveBeenCalled()
  })

  test('returns undefined when inputs are missing', async () => {
    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()

    await expect(resolveOldKeywordConceptUuid({
      keywordValue: 'something'
    })).resolves.toBeUndefined()
  })

  test('returns undefined for unsupported schemes', async () => {
    await expect(resolveOldKeywordConceptUuid({
      scheme: 'unsupported',
      keywordValue: 'SOMETHING'
    })).resolves.toBeUndefined()
  })
})
