import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithResolution = `<DIF>
    <Data_Resolution>
        <Horizontal_Resolution_Range>0 - 1 meter</Horizontal_Resolution_Range>
        <Horizontal_Resolution_Range>1 - 10 meters</Horizontal_Resolution_Range>
    </Data_Resolution>
</DIF>`

describe('applyDif10HorizontalResolutionRangeCorrection', () => {
  describe('Replace Action', () => {
    test('replaces a specific range in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'replace',
          ummPath: ['HorizontalResolutionRanges', 1],
          newKeywordPath: 'Updated Range'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>Updated Range</Horizontal_Resolution_Range>')
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>0 - 1 meter</Horizontal_Resolution_Range>')
    })

    test('replaces a single range value (not an array)', async () => {
      const singleXml = '<DIF><Data_Resolution><Horizontal_Resolution_Range>Old</Horizontal_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'replace',
          ummPath: ['HorizontalResolutionRanges', 0],
          newKeywordPath: 'New'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>New</Horizontal_Resolution_Range>')
    })
  })

  describe('Delete Action and Cleanup', () => {
    test('deletes a range from an array and keeps parent if not empty', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'delete',
          ummPath: ['HorizontalResolutionRanges', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('0 - 1 meter')
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
    })

    test('deletes parent Data_Resolution when the last range is removed (cleanup)', async () => {
      const singleXml = '<DIF><Data_Resolution><Horizontal_Resolution_Range>Only One</Horizontal_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'delete',
          ummPath: ['HorizontalResolutionRanges', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<Horizontal_Resolution_Range>')
      expect(result.correctedMetadata).not.toContain('<Data_Resolution>')
    })

    test('deletes the target field when the last element of an array is removed', async () => {
      // Starting with two elements
      const twoElementsXml = `<DIF>
        <Data_Resolution>
            <Horizontal_Resolution_Range>Range 1</Horizontal_Resolution_Range>
            <Horizontal_Resolution_Range>Range 2</Horizontal_Resolution_Range>
            <Temporal_Resolution_Range>Other Field</Temporal_Resolution_Range>
        </Data_Resolution>
      </DIF>`

      const result = await applyDif10MetadataCorrections({
        metadataPayload: twoElementsXml,
        corrections: [
          {
            scheme: 'horizontalresolutionrange',
            action: 'delete',
            ummPath: ['HorizontalResolutionRanges', 0]
          },
          {
            scheme: 'horizontalresolutionrange',
            action: 'delete',
            ummPath: ['HorizontalResolutionRanges', 0] // Index 0 again because array shifted
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // Horizontal_Resolution_Range should be gone
      expect(result.correctedMetadata).not.toContain('<Horizontal_Resolution_Range>')
      // Data_Resolution should still exist because Temporal_Resolution_Range remains
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Other Field</Temporal_Resolution_Range>')
    })
  })

  describe('Guard Clause Coverage (Return False)', () => {
    test('returns false if ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          ummPath: ['HorizontalResolutionRanges'] // Missing index
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if Data_Resolution is missing from metadata', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          ummPath: ['HorizontalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for unsupported action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'invalid_action',
          ummPath: ['HorizontalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })
  })
})
