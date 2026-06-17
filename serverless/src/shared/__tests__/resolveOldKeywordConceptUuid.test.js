import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getHistoricalConceptByKeyword } from '../redis-path-store/getHistoricalConceptByKeyword'
import { getPublishedConceptByUuid } from '../redis-path-store/getPublishedConceptByUuid'
import { resolveOldKeywordConceptUuid } from '../resolveOldKeywordConceptUuid'

vi.mock('../redis-path-store/getHistoricalConceptByKeyword', () => ({
  getHistoricalConceptByKeyword: vi.fn()
}))

vi.mock('../redis-path-store/getPublishedConceptByUuid', () => ({
  getPublishedConceptByUuid: vi.fn()
}))

const SCIENCE_KEYWORD_OBJECT = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'AEROSOLS',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const SCIENCE_LEGACY_KEYWORD_OBJECT = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'AEROSOLS',
  VariableLevel1: 'LEGACY AEROSOLS',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const PLATFORM_KEYWORD_OBJECT = {
  ShortName: 'HU-25A'
}

const PROJECT_KEYWORD_OBJECT = {
  ShortName: 'Legacy Climate Study'
}

describe('resolveOldKeywordConceptUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes hierarchy schemes to the full path stub using keywordValue', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-full-path',
      keywordObject: SCIENCE_KEYWORD_OBJECT
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-full-path',
      keywordObject: SCIENCE_KEYWORD_OBJECT
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
      oldKeywordObject: SCIENCE_KEYWORD_OBJECT,
      newKeywordObject: SCIENCE_KEYWORD_OBJECT,
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ',
      newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ',
      action: 'replace'
    })

    expect(getHistoricalConceptByKeyword).toHaveBeenCalledWith({
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
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
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        VariableLevel1: 'SNOW/ICE'
      },
      scheme: 'sciencekeywords'
    })
  })

  test('routes short-name schemes to the short-name stub', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-short-name',
      keywordObject: PLATFORM_KEYWORD_OBJECT,
      longName: 'Dassault HU-25A Guardian'
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-short-name',
      keywordObject: PLATFORM_KEYWORD_OBJECT,
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
      oldKeywordObject: PLATFORM_KEYWORD_OBJECT,
      newKeywordObject: PLATFORM_KEYWORD_OBJECT,
      oldLongName: 'Dassault HU-25A Guardian',
      newLongName: 'Dassault HU-25A Guardian',
      oldKeywordPath: 'HU-25A',
      newKeywordPath: 'HU-25A',
      action: 'replace'
    })

    expect(getHistoricalConceptByKeyword).toHaveBeenCalledWith({
      keywordValue: {
        ShortName: 'HU-25A',
        LongName: 'Dassault HU-25A Guardian'
      },
      scheme: 'platforms'
    })

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-short-name',
      scheme: 'platforms'
    })
  })

  test('omits oldKeywordPath when the historical keyword object has no meaningful path value', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-scalar',
      keywordObject: {
        Value: ''
      }
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-scalar',
      keywordObject: {
        Value: 'BOUNDARIES'
      }
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'isotopiccategory',
      keywordValue: 'BOUNDARIES'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-scalar',
      oldKeywordObject: {
        Value: ''
      },
      newKeywordObject: {
        Value: 'BOUNDARIES'
      },
      newKeywordPath: 'BOUNDARIES',
      action: 'replace'
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
      keywordObject: SCIENCE_KEYWORD_OBJECT
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

  test('returns undefined when the historical concept is missing a uuid', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      keywordObject: null
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).resolves.toBeUndefined()

    expect(getPublishedConceptByUuid).not.toHaveBeenCalled()
  })

  test('returns undefined when a published replacement keyword object is not a plain object', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-full-path',
      keywordObject: SCIENCE_KEYWORD_OBJECT
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-full-path',
      keywordObject: []
    })

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
      keywordObject: PROJECT_KEYWORD_OBJECT
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
      oldKeywordObject: PROJECT_KEYWORD_OBJECT,
      newKeywordObject: {},
      oldKeywordPath: 'Legacy Climate Study',
      action: 'delete'
    })

    expect(getPublishedConceptByUuid).not.toHaveBeenCalled()
  })

  test('returns a delete action for full-path schemes when the delete event matches the historical concept', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'deleted-science-uuid',
      keywordObject: SCIENCE_LEGACY_KEYWORD_OBJECT,
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
      oldKeywordObject: SCIENCE_LEGACY_KEYWORD_OBJECT,
      newKeywordObject: {},
      oldLongName: 'Legacy Aerosols',
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > ',
      action: 'delete'
    })

    expect(getPublishedConceptByUuid).not.toHaveBeenCalled()
  })

  test('returns undefined when the historical concept does not include a keyword object', async () => {
    vi.mocked(getHistoricalConceptByKeyword).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-full-path',
      keywordObject: SCIENCE_KEYWORD_OBJECT
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }
    })).resolves.toBeUndefined()
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
