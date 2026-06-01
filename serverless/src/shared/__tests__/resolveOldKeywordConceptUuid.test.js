import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptUuidByFullPath } from '../getConceptUuidByFullPath'
import { getConceptUuidByShortName } from '../getConceptUuidByShortName'
import { getPublishedConceptByUuid } from '../getPublishedConceptByUuid'
import { resolveOldKeywordConceptUuid } from '../resolveOldKeywordConceptUuid'

vi.mock('../getConceptUuidByFullPath', () => ({
  getConceptUuidByFullPath: vi.fn()
}))

vi.mock('../getConceptUuidByShortName', () => ({
  getConceptUuidByShortName: vi.fn()
}))

vi.mock('../getPublishedConceptByUuid', () => ({
  getPublishedConceptByUuid: vi.fn()
}))

describe('resolveOldKeywordConceptUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes hierarchy schemes to the full path stub using keywordValue', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue({
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
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ',
      newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ',
      action: 'replace'
    })

    expect(getConceptUuidByFullPath).toHaveBeenCalledWith({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ',
      scheme: 'sciencekeywords'
    })

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-full-path',
      scheme: 'sciencekeywords'
    })
  })

  test('preserves interior holes for full-path lookups when keywordValue has sparse levels', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      keywordValue: {
        Category: 'EARTH SCIENCE',
        Topic: 'CRYOSPHERE',
        VariableLevel1: 'SNOW/ICE'
      }
    })).resolves.toBeUndefined()

    expect(getConceptUuidByFullPath).toHaveBeenCalledWith({
      fullPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > ',
      scheme: 'sciencekeywords'
    })
  })

  test('routes short-name schemes to the short-name stub', async () => {
    vi.mocked(getConceptUuidByShortName).mockResolvedValue({
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
      oldKeywordPath: 'AIR-BASED PLATFORMS > HU-25A',
      newKeywordPath: 'AIR-BASED PLATFORMS > HU-25A',
      oldLongName: 'Dassault HU-25A Guardian',
      newLongName: 'Dassault HU-25A Guardian',
      action: 'replace'
    })

    expect(getConceptUuidByShortName).toHaveBeenCalledWith({
      shortName: 'HU-25A',
      scheme: 'platforms'
    })

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-short-name',
      scheme: 'platforms'
    })
  })

  test('requires keywordValue for full-path lookups', async () => {
    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()

    expect(getConceptUuidByFullPath).not.toHaveBeenCalled()
  })

  test('returns undefined when the historical lookup misses', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue(undefined)

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
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue({
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
    vi.mocked(getConceptUuidByShortName).mockResolvedValue({
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
      oldKeywordPath: 'Projects > Legacy Climate Study',
      newKeywordPath: '',
      action: 'delete'
    })

    expect(getPublishedConceptByUuid).not.toHaveBeenCalled()
  })

  test('returns a delete action for full-path schemes when the delete event matches the historical concept', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue({
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
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > ',
      newKeywordPath: '',
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
