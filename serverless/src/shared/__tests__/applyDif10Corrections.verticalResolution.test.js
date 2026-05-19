import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithVerticalResolution = `<DIF>
    <Data_Resolution>
        <Vertical_Resolution_Range>1 - 10 meters</Vertical_Resolution_Range>
        <Vertical_Resolution_Range>10 - 50 meters</Vertical_Resolution_Range>
    </Data_Resolution>
</DIF>`

describe('applyDif10VerticalResolutionRangeCorrection', () => {
  describe('Replace Action', () => {
    test('replaces a specific vertical range in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'replace',
          ummPath: ['VerticalResolutionRanges', 1],
          newKeywordPath: 'Updated Range',
          oldKeywordPath: '10 - 50 meters'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>Updated Range</Vertical_Resolution_Range>')
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>1 - 10 meters</Vertical_Resolution_Range>')
    })

    test('replaces a single vertical range value (non-array object)', async () => {
      const singleXml = '<DIF><Data_Resolution><Vertical_Resolution_Range>Old Range</Vertical_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'replace',
          ummPath: ['VerticalResolutionRanges', 0],
          newKeywordPath: 'New Range',
          oldKeywordPath: 'Old Range'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>New Range</Vertical_Resolution_Range>')
    })
  })

  describe('Delete Action and Cleanup', () => {
    test('deletes a range from an array and keeps parent if not empty', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'delete',
          ummPath: ['VerticalResolutionRanges', 0],
          oldKeywordPath: '1 - 10 meters'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('1 - 10 meters')
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
    })

    test('deletes parent Data_Resolution property when the last range is removed (Cleanup)', async () => {
      const singleXml = '<DIF><Data_Resolution><Vertical_Resolution_Range>Final Range</Vertical_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'delete',
          ummPath: ['VerticalResolutionRanges', 0],
          oldKeywordPath: 'Final Range'
        }]
      })

      expect(result.correctionCount).toBe(1)
      // Both the field and parent container should be pruned
      expect(result.correctedMetadata).not.toContain('<Vertical_Resolution_Range>')
      expect(result.correctedMetadata).not.toContain('<Data_Resolution>')
    })

    test('deletes the target field when an array becomes empty but keeps Data_Resolution if other fields exist', async () => {
      // Setup XML with multiple vertical ranges and another unrelated field
      const multiFieldXml = `<DIF>
          <Data_Resolution>
              <Vertical_Resolution_Range>Range 1</Vertical_Resolution_Range>
              <Vertical_Resolution_Range>Range 2</Vertical_Resolution_Range>
              <Horizontal_Resolution_Range>Keep Me</Horizontal_Resolution_Range>
          </Data_Resolution>
      </DIF>`

      const result = await applyDif10MetadataCorrections({
        metadataPayload: multiFieldXml,
        corrections: [
          {
            scheme: 'verticalresolutionrange',
            action: 'delete',
            ummPath: ['VerticalResolutionRanges', 0],
            oldKeywordPath: 'Range 1'
          },
          {
            scheme: 'verticalresolutionrange',
            action: 'delete',
            ummPath: ['VerticalResolutionRanges', 0],
            oldKeywordPath: 'Range 2'
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // This explicitly triggers: if (ranges.length === 0) { delete resolution[targetField] }
      expect(result.correctedMetadata).not.toContain('<Vertical_Resolution_Range>')

      // Data_Resolution should still exist because Horizontal_Resolution_Range is present
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>Keep Me</Horizontal_Resolution_Range>')
    })
  })

  describe('Guard Clause Coverage (Return False)', () => {
    test('returns false if ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          ummPath: ['VerticalResolutionRanges'] // Missing numeric index
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if Data_Resolution tag is missing', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'verticalresolutionrange',
          ummPath: ['VerticalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if Vertical_Resolution_Range is missing', async () => {
      const xmlNoRange = '<DIF><Data_Resolution><Other_Field>Value</Other_Field></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: xmlNoRange,
        corrections: [{
          scheme: 'verticalresolutionrange',
          ummPath: ['VerticalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for unrecognized action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'unsupported_action',
          ummPath: ['VerticalResolutionRanges', 0],
          oldKeywordPath: '1 - 10 meters'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })
  })
})
