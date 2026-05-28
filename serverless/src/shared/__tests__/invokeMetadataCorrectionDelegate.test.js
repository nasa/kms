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

describe('invokeMetadataCorrectionDelegate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('routes UMM to the UMM delegate', async () => {
    vi.mocked(applyUmmMetadataCorrections).mockResolvedValue({ delegateName: 'umm' })

    await expect(invokeMetadataCorrectionDelegate({
      nativeFormat: 'UMM',
      collectionConceptId: 'C1'
    })).resolves.toEqual({ delegateName: 'umm' })

    expect(applyUmmMetadataCorrections).toHaveBeenCalledWith({
      collectionConceptId: 'C1'
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
