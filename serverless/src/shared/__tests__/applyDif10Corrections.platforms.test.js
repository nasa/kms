import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithPlatforms = `<DIF>
    <Entry_ID>
        <Short_Name>Platforms_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Platforms</Entry_Title>
    <Platform>
      <Type>Earth Observation Satellites</Type>
      <Short_Name>SPOT-4</Short_Name>
      <Long_Name>Systeme Observation de la Terre-4</Long_Name>
      <Instrument>
        <Short_Name>VEGETATION-1</Short_Name>
        <Long_Name>VEGETATION INSTRUMENT 1 (SPOT 4)</Long_Name>
      </Instrument>
    </Platform>
    <Platform>
      <Type>Earth Observation planes</Type>
      <Short_Name>SPOT-5</Short_Name>
      <Long_Name>Systeme Observation de la Terre-5</Long_Name>
      <Instrument>
        <Short_Name>VEGETATION-2</Short_Name>
        <Long_Name>VEGETATION INSTRUMENT 2 (SPOT 5)</Long_Name>
      </Instrument>
    </Platform>
</DIF>`

describe('applyDif10MetadataCorrections - platforms scheme', () => {
  test('applies long name correction to first Platform', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platform', 0],
          oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
          newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
          newLongName: 'Systeme Observation de la Terre-4 Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Systeme Observation de la Terre-4 Updated</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Systeme Observation de la Terre-4</Long_Name>')

    // Other Type should remain unchanged
    expect(result.correctedMetadata).toContain('<Long_Name>Systeme Observation de la Terre-5</Long_Name>')

    // Instrument stays untouched
    expect(result.correctedMetadata).toContain('<Short_Name>VEGETATION-1</Short_Name>')

    // Platform type untouched
    expect(result.correctedMetadata).toContain('<Type>Earth Observation Satellites</Type>')
  })

  test('updates both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platform', 1],
          oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-5',
          newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-7-New',
          newLongName: 'Systeme Observation de la Terre-5 Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>SPOT-7-New</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>SPOT-7</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Systeme Observation de la Terre-5 Updated</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Systeme Observation de la Terre-5</Long_Name>')

    expect(result.correctedMetadata).toContain('<Type>Earth Observation Satellites</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>Earth Observation planes</Type>')
  })

  test('applies platform correction when there is only a single platform (object branch)', async () => {
    const singlePlatformXml = `<DIF>
      <Entry_ID>
          <Short_Name>SINGLE_PLAT_TEST</Short_Name>
          <Version>001</Version>
      </Entry_ID>
      <Platform>
          <Type>In Situ Land-based Platforms</Type>
          <Short_Name>GROUND STATIONS</Short_Name>
          <Long_Name>Long Name to be replaced</Long_Name>
      </Platform>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singlePlatformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platforms', 0],
          newKeywordPath: 'In Situ Land-based Platforms > Aircraft >  > C-130',
          newLongName: 'Lockheed C-130 Hercules'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify the object branch was taken and updated the fields correctly
    expect(result.correctedMetadata).toContain('<Type>Aircraft</Type>')
    expect(result.correctedMetadata).toContain('<Short_Name>C-130</Short_Name>')
    expect(result.correctedMetadata).toContain('<Long_Name>Lockheed C-130 Hercules</Long_Name>')
    expect(result.correctedMetadata).not.toContain('GROUND STATIONS')
  })

  test('deletes parent Platform property when the last platform in an array is removed', async () => {
    const multiPlatformXml = `<DIF>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>A1</Short_Name>
      </Platform>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>A2</Short_Name>
      </Platform>
  </DIF>`

    // Applying two deletions to empty the array and trigger the length === 0 check
    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiPlatformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          ummPath: ['Platforms', 0]
        },
        {
          scheme: 'platforms',
          action: 'delete',
          ummPath: ['Platforms', 0] // Target the remaining platform
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // The Platform key should be entirely removed from the resulting XML
    expect(result.correctedMetadata).not.toContain('<Platform>')
    expect(result.correctedMetadata).not.toContain('</Platform>')
  })

  test('deletes Platform', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          ummPath: ['Platform', 0],
          oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Platform should be removed
    expect(result.correctedMetadata).not.toContain('<Type>Earth Observation Satellites</Type>')

    // Other Platform should be unchanged
    expect(result.correctedMetadata).toContain('<Type>Earth Observation planes</Type>')
  })

  test('returns false when an unrecognized action is passed to platforms', async () => {
    const mockDif10 = '<DIF><Platform><Short_Name>TEST</Short_Name></Platform></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections: [
        {
          scheme: 'platforms',
          action: 'not_an_action', // Triggers the final return false
          ummPath: ['Platforms', 0],
          newKeywordPath: 'A > B > C > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('covers the else branch by deleting a single platform object', async () => {
    const singlePlatformXml = `<DIF>
      <Entry_ID>
          <Short_Name>SINGLE_DELETE_TEST</Short_Name>
      </Entry_ID>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>A1</Short_Name>
      </Platform>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singlePlatformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          ummPath: ['Platforms', 0] // Index 0 targets the single object
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // Verify the Platform tag is completely removed from the XML
    expect(result.correctedMetadata).not.toContain('<Platform>')
    expect(result.correctedMetadata).not.toContain('</Platform>')
  })

  test('covers the field pruning else branch by providing a shorter keyword path', async () => {
    const platformXml = `<DIF>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>OLD-SHORT</Short_Name>
          <Long_Name>Old Long Name that should be deleted</Long_Name>
      </Platform>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: platformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platforms', 0],
          // Providing only one segment forces the Long_Name field to hit the 'else { delete }' branch
          newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > NEW-SHORT',
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify Short_Name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>NEW-SHORT</Short_Name>')

    // Verify Long_Name was deleted (this is the branch we are covering)
    expect(result.correctedMetadata).not.toContain('<Long_Name>')
    expect(result.correctedMetadata).not.toContain('Old Long Name that should be deleted')
  })

  test('handles missing Platform element', async () => {
    const xmlWithoutPlatform = `<DIF>
        <Entry_ID>
            <Short_Name>NO_URL</Short_Name>
        </Entry_ID>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutPlatform,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platform', 0],
          oldKeywordPath: 'Earth Observation planes > SPOT-5 >  > ',
          newKeywordPath: 'Earth Observation rockets > SPOT-7 >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('handles out of bounds index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platform', 10],
          oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-5',
          newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-7'
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})
