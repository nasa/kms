/* eslint-disable no-underscore-dangle */
import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getVersionMetadata } from '@/shared/getVersionMetadata'

import { getConceptSchemeOfConcept } from '../getConceptSchemeOfConcept'

vi.mock('../getConceptSchemeOfConcept')
vi.mock('@/shared/getVersionMetadata')
vi.mocked(getVersionMetadata).mockResolvedValue({
  version: 'published',
  versionName: '20.8',
  versionType: 'published',
  created: '2023-01-01T00:00:00Z',
  modified: '2023-01-01T00:00:00Z'
})

describe('getGcmdMetadata', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should return base metadata when no arguments are provided', async () => {
      const result = await getGcmdMetadata({})
      expect(result).toEqual({
        'gcmd:termsOfUse': { _text: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf' },
        'gcmd:keywordVersion': { _text: '20.8' },
        'gcmd:viewer': { _text: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all' }
      })
    })

    test('should include scheme-specific metadata when conceptIRI is provided', async () => {
      const mockConceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/1234'
      const mockScheme = 'https://gcmd.earthdata.nasa.gov/kms/concept/scheme/5678'
      getConceptSchemeOfConcept.mockResolvedValue(mockScheme)

      const result = await getGcmdMetadata({
        conceptIRI: mockConceptIRI,
        version: 'draft'
      })
      expect(result).toMatchObject({
        'gcmd:schemeVersion': { _text: '2023-01-01T00:00:00Z' },
        'gcmd:viewer': { _text: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/5678/1234' }
      })

      expect(getConceptSchemeOfConcept).toHaveBeenCalledWith(mockConceptIRI, 'draft')
    })

    test('should include all metadata when both gcmdHits and conceptIRI are provided', async () => {
      const mockConceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/1234'
      const mockScheme = 'https://gcmd.earthdata.nasa.gov/kms/concept/scheme/5678'
      getConceptSchemeOfConcept.mockResolvedValue(mockScheme)

      const result = await getGcmdMetadata({
        conceptIRI: mockConceptIRI,
        gcmdHits: 100,
        version: 'draft'
      })
      expect(result).toMatchObject({
        'gcmd:hits': { _text: '100' },
        'gcmd:page_num': { _text: '1' },
        'gcmd:page_size': { _text: '2000' },
        'gcmd:termsOfUse': { _text: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf' },
        'gcmd:keywordVersion': { _text: '20.8' },
        'gcmd:schemeVersion': { _text: '2023-01-01T00:00:00Z' },
        'gcmd:viewer': { _text: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/5678/1234' }
      })

      expect(getConceptSchemeOfConcept).toHaveBeenCalledWith(mockConceptIRI, 'draft')
    })

    test('should handle conceptIRI with unexpected format', async () => {
      const mockConceptIRI = 'https://example.com/invalid/concept'
      getConceptSchemeOfConcept.mockResolvedValue('https://example.com/invalid/scheme')

      const result = await getGcmdMetadata({ conceptIRI: mockConceptIRI })
      expect(result['gcmd:viewer']._text).toBe('https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/scheme/concept')
    })

    test('should use default values when optional parameters are omitted', async () => {
      const result = await getGcmdMetadata({})
      expect(result).not.toHaveProperty('gcmd:hits')
      expect(result).not.toHaveProperty('gcmd:page_num')
      expect(result).not.toHaveProperty('gcmd:page_size')
      expect(result).not.toHaveProperty('gcmd:schemeVersion')
      expect(result['gcmd:viewer']._text).toBe('https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all')
    })
  })

  describe('when unsuccessful', () => {
    test('should log error when getConceptSchemeOfConcept fails', async () => {
      const mockConceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/1234'
      const mockVersion = 'published'
      getConceptSchemeOfConcept.mockRejectedValue(new Error('Scheme not found'))

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error')

      // Call the function
      await getGcmdMetadata({
        conceptIRI: mockConceptIRI,
        version: mockVersion
      })

      // Check if console.error was called with the expected message
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get concept scheme:', expect.any(Error))

      // Optionally, you can also check the specific error message
      expect(consoleErrorSpy.mock.calls[0][1].message).toBe('Scheme not found')

      // Clean up the spy
      consoleErrorSpy.mockRestore()
    })
  })

  describe('when unsuccessful', () => {
    test('should log error when getConceptSchemeOfConcept fails', async () => {
      const mockConceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/1234'
      const mockVersion = 'published'
      getConceptSchemeOfConcept.mockRejectedValue(new Error('Scheme not found'))

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error')

      // Call the function
      await getGcmdMetadata({
        conceptIRI: mockConceptIRI,
        version: mockVersion
      })

      // Check if console.error was called with the expected message
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get concept scheme:', expect.any(Error))

      // Optionally, you can also check the specific error message
      expect(consoleErrorSpy.mock.calls[0][1].message).toBe('Scheme not found')

      // Clean up the spy
      consoleErrorSpy.mockRestore()
    })
  })
})

describe('getGcmdMetadata pagination', () => {
  test('should include gcmd:hits, gcmd:page_num, and gcmd:page_size when gcmdHits is provided', async () => {
    const result = await getGcmdMetadata({ gcmdHits: 100 })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '1' },
      'gcmd:page_size': { _text: '2000' }
    })
  })

  test('should handle non-numeric gcmdHits', async () => {
    const result = await getGcmdMetadata({ gcmdHits: 'invalid' })
    expect(result['gcmd:hits']._text).toBe('invalid')
  })

  test('should include gcmd:hits, gcmd:page_num, and gcmd:page_size when provided', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: 2,
      pageSize: 50
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '2' },
      'gcmd:page_size': { _text: '50' }
    })
  })

  test('should handle string values for pageNum and pageSize', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: '2',
      pageSize: '50'
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '2' },
      'gcmd:page_size': { _text: '50' }
    })
  })

  test('should handle non-numeric pageNum and pageSize', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: 'invalid',
      pageSize: 'invalid'
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: 'invalid' },
      'gcmd:page_size': { _text: 'invalid' }
    })
  })

  test('should handle zero values for pageNum and pageSize', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: 0,
      pageSize: 0
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '0' },
      'gcmd:page_size': { _text: '0' }
    })
  })

  test('should handle negative values for pageNum and pageSize', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: -1,
      pageSize: -10
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '-1' },
      'gcmd:page_size': { _text: '-10' }
    })
  })

  test('should handle very large values for pageNum and pageSize', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: 1000000,
      pageSize: 1000000
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '1000000' },
      'gcmd:page_size': { _text: '1000000' }
    })
  })

  test('should handle decimal values for pageNum and pageSize', async () => {
    const result = await getGcmdMetadata({
      gcmdHits: 100,
      pageNum: 2.5,
      pageSize: 50.5
    })
    expect(result).toMatchObject({
      'gcmd:hits': { _text: '100' },
      'gcmd:page_num': { _text: '2.5' },
      'gcmd:page_size': { _text: '50.5' }
    })
  })
})
