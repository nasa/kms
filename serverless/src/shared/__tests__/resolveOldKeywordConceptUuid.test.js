import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConceptUuidByFullPath } from '../getConceptUuidByFullPath'
import { getConceptUuidByShortName } from '../getConceptUuidByShortName'
import { resolveOldKeywordConceptUuid } from '../resolveOldKeywordConceptUuid'

vi.mock('../getConceptUuidByFullPath', () => ({
  getConceptUuidByFullPath: vi.fn()
}))

vi.mock('../getConceptUuidByShortName', () => ({
  getConceptUuidByShortName: vi.fn()
}))

describe('resolveOldKeywordConceptUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes hierarchy schemes to the full path stub', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue('resolved-full-path')

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|AEROSOLS]'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-full-path',
      oldKeywordPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS',
      newKeywordPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })

    expect(getConceptUuidByFullPath).toHaveBeenCalledWith({
      fullPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })
  })

  test('routes short-name schemes to the short-name stub', async () => {
    vi.mocked(getConceptUuidByShortName).mockResolvedValue('resolved-short-name')

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'platforms',
      oldKeyword: '[resolve old keyword from UMM-C value: HU-25A]'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-short-name',
      oldKeywordPath: 'HU-25A',
      newKeywordPath: 'HU-25A'
    })

    expect(getConceptUuidByShortName).toHaveBeenCalledWith({
      shortName: 'HU-25A'
    })
  })

  test('passes through raw lookup values that are already normalized', async () => {
    vi.mocked(getConceptUuidByFullPath).mockResolvedValue('resolved-full-path')

    await expect(resolveOldKeywordConceptUuid({
      scheme: 'sciencekeywords',
      oldKeyword: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })).resolves.toEqual({
      keywordConceptUuid: 'resolved-full-path',
      oldKeywordPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS',
      newKeywordPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })

    expect(getConceptUuidByFullPath).toHaveBeenCalledWith({
      fullPath: 'EARTH SCIENCE|ATMOSPHERE|AEROSOLS'
    })
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
