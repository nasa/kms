import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

describe('applyProductLevelIdCorrection', () => {
  const mockDif10WithProductLevel = `<DIF>
    <Product_Level_Id>Level 1B</Product_Level_Id>
</DIF>`

  describe('Action: replace', () => {
    test('should successfully update the Product_Level_Id with a new string', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordPath: 'Level 2'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 2</Product_Level_Id>')
      expect(result.correctedMetadata).not.toContain('Level 1B')
    })

    test('should default to replace action if no action is provided', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          newKeywordPath: 'Level 3'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 3</Product_Level_Id>')
    })

    test('should return false and not modify the field if newKeywordPath is empty or invalid', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordPath: '   ' // Empty spaces
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 1B</Product_Level_Id>')
    })
  })

  describe('Action: delete', () => {
    test('should successfully delete the Product_Level_Id key from the object', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<Product_Level_Id>')
    })

    test('should return false if trying to delete a Product_Level_Id that does not exist', async () => {
      const missingFieldXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: missingFieldXml,
        corrections: [{
          scheme: 'productlevelid',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })
  })

  describe('Edge Cases & Guard Clauses', () => {
    test('should return empty count if metadataPayload is null or undefined', async () => {
      const resultNull = await applyDif10MetadataCorrections({
        metadataPayload: null,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordPath: 'Level 4'
        }]
      })

      expect(resultNull.correctionCount).toBe(0)
      expect(resultNull.stubbed).toBe(true)
    })

    test('should return false if parsedMetadata does not contain a DIF object', async () => {
      const malformedXml = '<NOT_DIF><Product_Level_Id>Level 1B</Product_Level_Id></NOT_DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: malformedXml,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordPath: 'Level 4'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false if an unknown action type is provided', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'invalid_action_type',
          newKeywordPath: 'Level 2'
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 1B</Product_Level_Id>')
    })
  })
})
