import {
  describe,
  expect,
  test
} from 'vitest'

import { detectNativeMetadataFormat } from '../detectNativeMetadataFormat'

describe('detectNativeMetadataFormat', () => {
  test('detects UMM from the CMR format string', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/vnd.nasa.cmr.umm+json'
    })).toBe('UMM')
  })

  test('detects ECHO10 from the CMR format string', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/echo10+xml'
    })).toBe('ECHO10')
  })

  test('detects DIF10 from the CMR format string', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/dif10+xml'
    })).toBe('DIF10')
  })

  test('detects DIF10 from the DIF+xml alias used by CMR', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/dif+xml'
    })).toBe('DIF10')
  })

  test('detects ISO19115 from the CMR format string', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/iso19115+xml'
    })).toBe('ISO19115')
  })

  test('detects ISO_SMAP from the CMR format string', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/iso:smap+xml'
    })).toBe('ISO_SMAP')
  })

  test('returns UNKNOWN when format cannot be determined', () => {
    expect(detectNativeMetadataFormat({
      format: 'application/octet-stream'
    })).toBe('UNKNOWN')
  })

  test('returns UNKNOWN when format is omitted', () => {
    expect(detectNativeMetadataFormat()).toBe('UNKNOWN')
  })
})
