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

  test('routes hierarchy schemes to the full path stub', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|AEROSOLS]'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-full-path',
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      action: 'replace'
    })

    expect(getConceptUuidByFullPath).toHaveBeenCalledWith({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })

    expect(getPublishedConceptByUuid).toHaveBeenCalledWith({
      uuid: 'resolved-full-path',
      scheme: 'sciencekeywords'
    })
  })

  test('routes short-name schemes to the short-name stub', async () => {
    vi.mocked(getConceptUuidByShortName).mockResolvedValue({
      uuid: 'resolved-short-name',
      fullPath: 'AIR-BASED PLATFORMS > HU-25A'
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-short-name',
      fullPath: 'AIR-BASED PLATFORMS > HU-25A'
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'platforms',
      oldKeyword: '[resolve old keyword from UMM-C value: HU-25A]'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-short-name',
      oldKeywordPath: 'AIR-BASED PLATFORMS > HU-25A',
      newKeywordPath: 'AIR-BASED PLATFORMS > HU-25A',
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

  test('passes through raw lookup values that are already normalized', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-full-path',
      oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      action: 'replace'
    })

    expect(getConceptUuidByFullPath).toHaveBeenCalledWith({
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
      scheme: 'sciencekeywords'
    })
  })

  test('returns undefined when the historical lookup misses', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })).resolves.toBeUndefined()
  })

  test('returns undefined when the current published path cannot be built', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue({
      uuid: 'resolved-full-path',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    vi.mocked(getPublishedConceptByUuid).mockResolvedValue(undefined)

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
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
      oldKeyword: '[resolve old keyword from UMM-C value: Legacy Climate Study]',
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

  test('returns undefined when inputs are missing', async () => {
    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords'
    })).resolves.toBeUndefined()

    await expect(resolveOldKeywordConceptUuid({
      oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE]'
    })).resolves.toBeUndefined()
  })

  test('returns undefined for unsupported schemes', async () => {
    await expect(resolveOldKeywordConceptUuid({
      scheme: 'unsupported',
      oldKeyword: '[resolve old keyword from UMM-C value: SOMETHING]'
    })).resolves.toBeUndefined()
  })

  test('returns undefined when a placeholder has no lookup value inside it', async () => {
    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: '[resolve old keyword from UMM-C value: ]'
    })).resolves.toBeUndefined()
  })
})
