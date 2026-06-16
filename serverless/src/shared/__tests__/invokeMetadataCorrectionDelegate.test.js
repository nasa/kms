import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from '../applyEcho10MetadataCorrections'
import { applyIso19115MetadataCorrections } from '../applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from '../applyIsoSmapMetadataCorrections'
import { applyUmmMetadataCorrections } from '../applyUmmMetadataCorrections'
import { invokeMetadataCorrectionDelegate } from '../invokeMetadataCorrectionDelegate'

vi.mock('../applyUmmMetadataCorrections', () => ({
  applyUmmMetadataCorrections: vi.fn()
}))

vi.mock('../applyIso19115MetadataCorrections', () => ({
  applyIso19115MetadataCorrections: vi.fn()
}))

vi.mock('../applyIsoSmapMetadataCorrections', () => ({
  applyIsoSmapMetadataCorrections: vi.fn()
}))

vi.mock('../applyEcho10MetadataCorrections', () => ({
  applyEcho10MetadataCorrections: vi.fn()
}))

vi.mock('../applyDif10MetadataCorrections', () => ({
  applyDif10MetadataCorrections: vi.fn()
}))

const createExpectedCorrection = (correction = {}) => ({
  scheme: correction.scheme,
  action: correction.action,
  keywordConceptUuid: correction.keywordConceptUuid,
  oldKeywordObject: correction.oldKeywordObject ?? {},
  newKeywordObject: correction.newKeywordObject ?? {},
  ummPath: correction.ummPath,
  oldLongName: correction.oldLongName,
  newLongName: correction.newLongName
})

const enableLocalMode = () => {
  process.env.USE_LOCALSTACK = 'true'
}

describe('invokeMetadataCorrectionDelegate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.USE_LOCALSTACK
    delete process.env.useLocalstack
  })

  test('rejects UMM outside local mode', async () => {
    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: 'not-an-object',
          newKeywordObject: null,
          ummPath: [
            'Platforms',
            0
          ]
        }
      ]
    })).rejects.toThrow(
      'Unsupported native metadata format for delegate selection: UMM'
    )
  })

  test('routes UMM to the UMM delegate in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: []
    })).resolves.toEqual({ delegateName: 'umm' })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })
  })

  test('normalizes correction keyword objects before delegating UMM in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'sciencekeywords',
          oldKeywordObject: 'not-an-object',
          newKeywordObject: null
        }
      ]
    })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          scheme: 'sciencekeywords',
          oldKeywordObject: {},
          newKeywordObject: {}
        })
      ]
    })
  })

  test('preserves plain-object keyword objects before delegating UMM in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [
        {
          oldKeywordObject: {
            ShortName: 'Aqua'
          },
          newKeywordObject: {
            ShortName: 'Terra'
          }
        }
      ]
    })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          oldKeywordObject: {
            ShortName: 'Aqua'
          },
          newKeywordObject: {
            ShortName: 'Terra'
          }
        })
      ]
    })
  })

  test('preserves non-keyword-object correction fields before delegating UMM in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: [
            'ScienceKeywords',
            0
          ],
          oldKeywordObject: {},
          newKeywordObject: {}
        }
      ]
    })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: [
            'ScienceKeywords',
            0
          ],
          oldKeywordObject: {},
          newKeywordObject: {}
        })
      ]
    })
  })

  test('normalizes array keyword objects to plain empty objects before delegating UMM in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [
        {
          oldKeywordObject: [],
          newKeywordObject: []
        }
      ]
    })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          oldKeywordObject: {},
          newKeywordObject: {}
        })
      ]
    })
  })

  test('treats non-array corrections as an empty correction list before delegating UMM in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: {
        scheme: 'sciencekeywords'
      }
    })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })
  })

  test('normalizes undefined correction entries to empty keyword objects before delegating UMM in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [undefined]
    })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          oldKeywordObject: {},
          newKeywordObject: {}
        })
      ]
    })
  })

  test('drops unknown correction fields while preserving the normalized UMM contract in local mode', async () => {
    enableLocalMode()
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {
            ShortName: 'SPOT-4-UPDATED'
          },
          ummPath: [
            'Platforms',
            0
          ],
          oldLongName: 'Systeme Observation de la Terre-4',
          newLongName: 'Systeme Observation de la Terre-4 Updated',
          ignoredExtraField: 'ignored'
        }
      ]
    })).resolves.toEqual({ delegateName: 'umm' })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          scheme: 'platforms',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {
            ShortName: 'SPOT-4-UPDATED'
          },
          ummPath: [
            'Platforms',
            0
          ],
          oldLongName: 'Systeme Observation de la Terre-4',
          newLongName: 'Systeme Observation de la Terre-4 Updated'
        })
      ]
    })
  })

  test('routes ISO19115 to the ISO19115 delegate', async () => {
    vi.mocked(applyIso19115MetadataCorrections).mockResolvedValue({ delegateName: 'iso19115' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'ISO19115',
      collectionConceptId: 'C1'
    })).resolves.toEqual({ delegateName: 'iso19115' })
  })

  test('routes ISO_SMAP to the ISO SMAP delegate', async () => {
    vi.mocked(applyIsoSmapMetadataCorrections).mockResolvedValue({ delegateName: 'iso_smap' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'ISO_SMAP',
      collectionConceptId: 'C1'
    })).resolves.toEqual({ delegateName: 'iso_smap' })
  })

  test('routes ECHO10 to the ECHO10 delegate', async () => {
    vi.mocked(applyEcho10MetadataCorrections).mockResolvedValue({ delegateName: 'echo10' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'ECHO10',
      collectionConceptId: 'C1'
    })).resolves.toEqual({ delegateName: 'echo10' })
  })

  test('routes DIF10 to the DIF10 delegate', async () => {
    vi.mocked(applyDif10MetadataCorrections).mockResolvedValue({ delegateName: 'dif10' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'DIF10',
      collectionConceptId: 'C1'
    })).resolves.toEqual({ delegateName: 'dif10' })
  })

  test('throws on unsupported formats', async () => {
    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'UNKNOWN',
      collectionConceptId: 'C1'
    })).rejects.toThrow('Unsupported native metadata format for delegate selection: UNKNOWN')
  })
})
