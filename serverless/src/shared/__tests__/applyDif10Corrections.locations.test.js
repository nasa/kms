import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithLocations = `<DIF>
    <Entry_ID>
        <Short_Name>LOCATION_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Locations</Entry_Title>
    <Location>
        <Location_Category>CONTINENT</Location_Category>
        <Location_Type>NORTH AMERICA</Location_Type>
    </Location>
    <Location>
        <Location_Category>OCEAN</Location_Category>
        <Location_Type>PACIFIC OCEAN</Location_Type>
    </Location>
    <Location>
        <Location_Category>CONTINENT</Location_Category>
        <Location_Type>NORTH AMERICA</Location_Type>
        <Location_Subregion1>UNITED STATES OF AMERICA</Location_Subregion1>
    </Location>
</DIF>`

describe('applyDif10LocationCorrection', () => {
  test('applies location correction to first location', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 0],
          oldKeywordPath: 'CONTINENT > NORTH AMERICA >  >  >  > ',
          newKeywordPath: 'CONTINENT > SOUTH AMERICA >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the first location was updated
    expect(result.correctedMetadata).toContain('<Location_Type>SOUTH AMERICA</Location_Type>')

    // Second location should remain unchanged (PACIFIC OCEAN)
    expect(result.correctedMetadata).toContain('<Location_Type>PACIFIC OCEAN</Location_Type>')

    // Third location should still have NORTH AMERICA
    const northAmericaMatches = result.correctedMetadata.match(/<Location_Type>NORTH AMERICA<\/Location_Type>/g)
    expect(northAmericaMatches).toHaveLength(1) // Only in third location now
  })

  test('applies location correction with subregion', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 2],
          oldKeywordPath: 'CONTINENT > NORTH AMERICA > UNITED STATES OF AMERICA >  >  > ',
          newKeywordPath: 'CONTINENT > NORTH AMERICA > CANADA >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify subregion was updated
    expect(result.correctedMetadata).toContain('<Location_Subregion1>CANADA</Location_Subregion1>')
    expect(result.correctedMetadata).not.toContain('UNITED STATES OF AMERICA')
  })

  test('adds multiple subregion levels', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 2],
          oldKeywordPath: 'CONTINENT > NORTH AMERICA > UNITED STATES OF AMERICA >  >  > ',
          newKeywordPath: 'CONTINENT > NORTH AMERICA > UNITED STATES OF AMERICA > CALIFORNIA > LOS ANGELES > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    expect(result.correctedMetadata).toContain('<Location_Subregion1>UNITED STATES OF AMERICA</Location_Subregion1>')
    expect(result.correctedMetadata).toContain('<Location_Subregion2>CALIFORNIA</Location_Subregion2>')
    expect(result.correctedMetadata).toContain('<Location_Subregion3>LOS ANGELES</Location_Subregion3>')
  })

  test('removes subregion levels when moving to higher level', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 2],
          oldKeywordPath: 'CONTINENT > NORTH AMERICA > UNITED STATES OF AMERICA  >  >  > ',
          newKeywordPath: 'CONTINENT > EUROPE >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    expect(result.correctedMetadata).toContain('<Location_Type>EUROPE</Location_Type>')
    expect(result.correctedMetadata).not.toContain('UNITED STATES OF AMERICA')
  })

  test('deletes location at index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          ummPath: ['Locations', 1],
          oldKeywordPath: 'OCEAN > PACIFIC OCEAN >  >  >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // PACIFIC OCEAN should be removed
    expect(result.correctedMetadata).not.toContain('PACIFIC OCEAN')

    // Other locations should remain
    expect(result.correctedMetadata).toContain('NORTH AMERICA')
    expect(result.correctedMetadata).toContain('UNITED STATES OF AMERICA')
  })

  test('triggers array pruning when the last element of an array is spliced', async () => {
    const multiLocationXml = `<DIF>
      <Location><Location_Category>A</Location_Category></Location>
      <Location><Location_Category>B</Location_Category></Location>
  </DIF>`

    // To reach the 'length === 0' line, we must delete both or
    // ensure the logic splices the last remaining item in an array.
    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          ummPath: ['Locations', 0]
        },
        {
          scheme: 'locations',
          action: 'delete',
          ummPath: ['Locations', 0]
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    expect(result.correctedMetadata).not.toContain('<Location>')
  })

  test('handles single location (not array)', async () => {
    const singleLocationXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_LOCATION</Short_Name>
    </Entry_ID>
    <Location>
        <Location_Category>OCEAN</Location_Category>
        <Location_Type>ATLANTIC OCEAN</Location_Type>
    </Location>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 0],
          oldKeywordPath: 'OCEAN > ATLANTIC OCEAN >  >  >  > ',
          newKeywordPath: 'OCEAN > INDIAN OCEAN >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Location_Type>INDIAN OCEAN</Location_Type>')
    expect(result.correctedMetadata).not.toContain('ATLANTIC OCEAN')
  })

  test('handles missing Location element', async () => {
    const xmlWithoutLocation = `<DIF>
    <Entry_ID>
        <Short_Name>NO_LOCATION</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutLocation,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 0],
          oldKeywordPath: 'OCEAN > ATLANTIC OCEAN >  >  >  > ',
          newKeywordPath: 'OCEAN > PACIFIC OCEAN >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})

describe('applyDif10LocationCorrections - guard clauses', () => {
  test('returns false when ummPath does not contain a numeric index', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithLocations,
      corrections: [{
        scheme: 'locations',
        action: 'replace',
        ummPath: ['Locations', 'first'], // String instead of Number
        newKeywordPath: 'CONTINENT > EUROPE >  >  >  > '
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('returns false when index is out of bounds', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithLocations,
      corrections: [{
        scheme: 'locations',
        action: 'replace',
        ummPath: ['Locations', 99], // Index does not exist
        newKeywordPath: 'CONTINENT > EUROPE >  >  >  > '
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('returns false when action is unsupported', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithLocations,
      corrections: [{
        scheme: 'locations',
        action: 'invalid_action', // Not replace or delete
        ummPath: ['Locations', 0],
        newKeywordPath: 'CONTINENT > EUROPE >  >  >  > '
      }]
    })

    expect(result.correctionCount).toBe(0)
  })
})
