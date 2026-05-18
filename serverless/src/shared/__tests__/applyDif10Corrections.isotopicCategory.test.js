import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithCategories = `<DIF>
    <ISO_Topic_Category>BIOTA</ISO_Topic_Category>
    <ISO_Topic_Category>CLIMATOLOGY/METEOROLOGY/ATMOSPHERE</ISO_Topic_Category>
</DIF>`

describe('applyDif10IsoTopicCategoryCorrection', () => {
  describe('Replace Action', () => {
    test('replaces a specific category in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          ummPath: ['ISOTopicCategories', 1],
          newKeywordPath: 'FARMING'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>FARMING</ISO_Topic_Category>')
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>BIOTA</ISO_Topic_Category>')
      expect(result.correctedMetadata).not.toContain('CLIMATOLOGY/METEOROLOGY/ATMOSPHERE')
    })

    test('replaces a single category value (not an array)', async () => {
      const singleXml = '<DIF><ISO_Topic_Category>OLD_CAT</ISO_Topic_Category></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          ummPath: ['ISOTopicCategories', 0],
          newKeywordPath: 'NEW_CAT'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>NEW_CAT</ISO_Topic_Category>')
    })
  })

  describe('Delete Action', () => {
    test('deletes a specific category from an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'delete',
          ummPath: ['ISOTopicCategories', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>BIOTA</ISO_Topic_Category>')
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>CLIMATOLOGY/METEOROLOGY/ATMOSPHERE</ISO_Topic_Category>')
    })

    test('deletes the property entirely when the last item in an array is removed', async () => {
      const singleXml = '<DIF><ISO_Topic_Category>LAST_ONE</ISO_Topic_Category></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'delete',
          ummPath: ['ISOTopicCategories', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>')
    })

    test('handles deletion of a single non-array property (else if branch)', async () => {
      // This targets the "else if (index === 0)" branch for deletion
      const singleXml = '<DIF><ISO_Topic_Category>SINGLE_STRING</ISO_Topic_Category></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'delete',
          ummPath: ['ISOTopicCategories', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>')
    })

    test('deletes the ISO_Topic_Category key when an array becomes empty', async () => {
      // Starting with an array of two categories
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [
          {
            scheme: 'isotopiccategory',
            action: 'delete',
            ummPath: ['ISOTopicCategories', 0]
          },
          {
            scheme: 'isotopiccategory',
            action: 'delete',
            ummPath: ['ISOTopicCategories', 0] // Index 0 again as the array shifts
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // This specifically triggers: if (parent.ISO_Topic_Category.length === 0) { delete parent.ISO_Topic_Category }
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>')
    })
  })

  describe('Guard Clause Coverage (Return False)', () => {
    test('returns false if ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          ummPath: ['ISOTopicCategories'] // Missing index
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if ISO_Topic_Category is missing from metadata', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          ummPath: ['ISOTopicCategories', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for unrecognized action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'invalid_action',
          ummPath: ['ISOTopicCategories', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for replace when index is out of bounds', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          ummPath: ['ISOTopicCategories', 99], // Out of bounds
          newKeywordPath: 'FAIL'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })
  })
})
