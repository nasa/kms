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
import { applyUmmcMetadataCorrections } from '../applyUmmcMetadataCorrections'
import { invokeMetadataCorrectionDelegate } from '../invokeMetadataCorrectionDelegate'
import { logger } from '../logger'

vi.mock('../applyUmmcMetadataCorrections', () => ({
  applyUmmcMetadataCorrections: vi.fn()
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

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn()
  }
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

describe('invokeMetadataCorrectionDelegate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes UMM to the UMM delegate', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1'
    })).resolves.toEqual({ delegateName: 'umm' })

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })
  })

  test('normalizes correction keyword objects before delegating', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

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

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
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

  test('preserves plain-object keyword objects before delegating', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

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

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
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

  test('preserves non-keyword-object correction fields before delegating', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

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

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
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

  test('normalizes array keyword objects to plain empty objects before delegating', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

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

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          oldKeywordObject: {},
          newKeywordObject: {}
        })
      ]
    })
  })

  test('treats non-array corrections as an empty correction list', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: {
        scheme: 'sciencekeywords'
      }
    })

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })
  })

  test('normalizes undefined correction entries to empty keyword objects', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1',
      corrections: [undefined]
    })

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          oldKeywordObject: {},
          newKeywordObject: {}
        })
      ]
    })
  })

  test('drops unknown correction fields while preserving the normalized contract', async () => {
    vi.mocked(applyUmmcMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await invokeMetadataCorrectionDelegate({
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
    })

    expect(applyUmmcMetadataCorrections).toHaveBeenCalledWith({
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

  test('skips replace corrections when the replacement object is empty', async () => {
    vi.mocked(applyEcho10MetadataCorrections).mockResolvedValue({ delegateName: 'echo10' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'ECHO10',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {}
        }
      ]
    })).resolves.toEqual({ delegateName: 'echo10' })

    expect(applyEcho10MetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Skipping invalid replacement correction payload',
      expect.objectContaining({
        scheme: 'rucontenttype',
        action: 'replace',
        keywordConceptUuid: 'uuid-1'
      })
    )
  })

  test('skips whitespace-only replace corrections when the replacement object has no meaningful values', async () => {
    vi.mocked(applyEcho10MetadataCorrections).mockResolvedValue({ delegateName: 'echo10' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'ECHO10',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: '',
            Type: '   ',
            Subtype: ''
          }
        }
      ]
    })

    expect(applyEcho10MetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Skipping invalid replacement correction payload',
      expect.objectContaining({
        scheme: 'rucontenttype',
        action: 'replace',
        keywordConceptUuid: 'uuid-1'
      })
    )
  })

  test('preserves rucontenttype delete corrections even when the replacement object is empty', async () => {
    vi.mocked(applyEcho10MetadataCorrections).mockResolvedValue({ delegateName: 'echo10' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'ECHO10',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'delete',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(applyEcho10MetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          scheme: 'rucontenttype',
          action: 'delete',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {}
        })
      ]
    })
  })

  test('preserves rucontenttype replacements when the replacement object contains a meaningful value', async () => {
    vi.mocked(applyEcho10MetadataCorrections).mockResolvedValue({ delegateName: 'echo10' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'ECHO10',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: 'EARTHDATA SEARCH'
          }
        }
      ]
    })

    expect(applyEcho10MetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: [
        createExpectedCorrection({
          scheme: 'rucontenttype',
          action: 'replace',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: 'EARTHDATA SEARCH'
          }
        })
      ]
    })

    expect(logger.error).not.toHaveBeenCalled()
  })

  test('skips empty replacements for other schemes as well', async () => {
    vi.mocked(applyEcho10MetadataCorrections).mockResolvedValue({ delegateName: 'echo10' })

    await invokeMetadataCorrectionDelegate({
      nativeFormat: 'ECHO10',
      collectionConceptId: 'C1',
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          keywordConceptUuid: 'uuid-2',
          oldKeywordObject: {
            ShortName: 'NSIDC'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(applyEcho10MetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1',
      corrections: []
    })

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Skipping invalid replacement correction payload',
      expect.objectContaining({
        scheme: 'providers',
        action: 'replace',
        keywordConceptUuid: 'uuid-2'
      })
    )
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
