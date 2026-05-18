import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithTemporalResolution = `<DIF>
    <Data_Resolution>
        <Temporal_Resolution_Range>Monthly</Temporal_Resolution_Range>
        <Temporal_Resolution_Range>Daily</Temporal_Resolution_Range>
    </Data_Resolution>
</DIF>`

describe('applyDif10TemporalResolutionRangeCorrection', () => {
  describe('Replace Action', () => {
    test('replaces a specific temporal range in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithTemporalResolution,
        corrections: [{
          scheme: 'temporalresolutionrange',
          action: 'replace',
          ummPath: ['TemporalResolutionRanges', 1],
          newKeywordPath: 'Hourly'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Hourly</Temporal_Resolution_Range>')
      expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Monthly</Temporal_Resolution_Range>')
      expect(result.correctedMetadata).not.toContain('<Temporal_Resolution_Range>Daily</Temporal_Resolution_Range>')
    })

    test('replaces a single temporal range value (non-array object)', async () => {
      const singleXml = '<DIF><Data_Resolution><Temporal_Resolution_Range>Weekly</Temporal_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'temporalresolutionrange',
          action: 'replace',
          ummPath: ['TemporalResolutionRanges', 0],
          newKeywordPath: 'Yearly'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Yearly</Temporal_Resolution_Range>')
    })
  })

  describe('Delete Action and Cleanup', () => {
    test('deletes a range from an array and keeps parent if other fields exist', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithTemporalResolution,
        corrections: [{
          scheme: 'temporalresolutionrange',
          action: 'delete',
          ummPath: ['TemporalResolutionRanges', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('Monthly')
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('Daily')
    })

    test('deletes parent Data_Resolution property when the last range is removed (Cleanup)', async () => {
      const singleXml = '<DIF><Data_Resolution><Temporal_Resolution_Range>One-Off</Temporal_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'temporalresolutionrange',
          action: 'delete',
          ummPath: ['TemporalResolutionRanges', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)
      // The parent element should be pruned if it has no more children
      expect(result.correctedMetadata).not.toContain('<Temporal_Resolution_Range>')
      expect(result.correctedMetadata).not.toContain('<Data_Resolution>')
    })

    test('deletes the target field when an array becomes empty but keeps Data_Resolution if other fields exist', async () => {
      // XML with multiple ranges and an unrelated field in Data_Resolution
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
            ummPath: ['VerticalResolutionRanges', 0]
          },
          {
            scheme: 'verticalresolutionrange',
            action: 'delete',
            ummPath: ['VerticalResolutionRanges', 0] // Index 0 again as array shifts
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // This specifically covers: if (ranges.length === 0) { delete resolution[targetField] }
      expect(result.correctedMetadata).not.toContain('<Vertical_Resolution_Range>')

      // Ensure the parent Data_Resolution was NOT cleaned up because Horizontal_Resolution_Range remains
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>Keep Me</Horizontal_Resolution_Range>')
    })

    test('deletes a single temporal range value (non-array branch)', async () => {
      // XML with only one range tag, parsed as a single object/string
      const singleXml = `<DIF>
      <Data_Resolution>
          <Temporal_Resolution_Range>Weekly</Temporal_Resolution_Range>
          <Horizontal_Resolution_Range>Keep Me</Horizontal_Resolution_Range>
      </Data_Resolution>
  </DIF>`

      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'temporalresolutionrange',
          action: 'delete',
          ummPath: ['TemporalResolutionRanges', 0]
        }]
      })

      expect(result.correctionCount).toBe(1)

      // This triggers: } else if (index === 0) { delete resolution[targetField] }
      expect(result.correctedMetadata).not.toContain('<Temporal_Resolution_Range>')

      // Ensure the parent Data_Resolution is preserved because Horizontal_Resolution_Range exists
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('Keep Me')
    })
  })

  describe('Guard Clause Coverage (Return False)', () => {
    test('returns false if ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithTemporalResolution,
        corrections: [{
          scheme: 'temporalresolutionrange',
          ummPath: ['TemporalResolutionRanges'] // Invalid path without index
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if Data_Resolution tag is missing', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'temporalresolutionrange',
          ummPath: ['TemporalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if Temporal_Resolution_Range is missing', async () => {
      const xmlNoRange = '<DIF><Data_Resolution><Some_Other_Field>Value</Some_Other_Field></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: xmlNoRange,
        corrections: [{
          scheme: 'temporalresolutionrange',
          ummPath: ['TemporalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for unrecognized action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithTemporalResolution,
        corrections: [{
          scheme: 'temporalresolutionrange',
          action: 'unsupported',
          ummPath: ['TemporalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })
  })
})
