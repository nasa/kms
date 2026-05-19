import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10Xml = `<DIF
    xmlns:dif="http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/ http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/dif_v10.2.xsd">
            <Entry_ID>
                <Short_Name>DEM_100M</Short_Name>
                <Version>001</Version>
            </Entry_ID>
            <Entry_Title>100m Digital Elevation Model Data V001</Entry_Title>
            <Science_Keywords>
                <Category>EARTH SCIENCE</Category>
                <Topic>LAND SURFACE</Topic>
                <Term>TOPOGRAPHY</Term>
                <Variable_Level_1>LANDFORMS</Variable_Level_1>
                <Variable_Level_2>DEM</Variable_Level_2>
            </Science_Keywords>
            <Science_Keywords>
                <Category>EARTH SCIENCE</Category>
                <Topic>LAND SURFACE</Topic>
                <Term>TOPOGRAPHY</Term>
                <Variable_Level_1>TERRAIN ELEVATION</Variable_Level_1>
                <Variable_Level_2>DIGITAL TERRAIN MODEL</Variable_Level_2>
            </Science_Keywords>
            <Platform>
                <Type>Not provided</Type>
                <Short_Name>Not provided</Short_Name>
            </Platform>
</DIF>`

const mockSimpleDif10Xml = `<DIF>
    <Entry_ID>
        <Short_Name>TEST_COLLECTION</Short_Name>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
        <Term>AEROSOLS</Term>
        <Variable_Level_1>LEGACY AEROSOLS</Variable_Level_1>
    </Science_Keywords>
</DIF>`

describe('applyDif10MetadataCorrections - science keywords scheme', () => {
  test('applies science keyword renaming correction (same hierarchy, different name)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > AEROSOLS RENAMED >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)
    expect(result.stubbed).toBe(false)

    // Verify the corrected XML contains the renamed keyword
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).toContain('<Topic>ATMOSPHERE</Topic>')
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>AEROSOLS RENAMED</Variable_Level_1>')
    // Old name should be gone
    expect(result.correctedMetadata).not.toContain('LEGACY AEROSOLS')
  })

  test('applies science keyword hierarchy move (same name, different topic)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > AIR QUALITY > AEROSOLS > LEGACY AEROSOLS >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the keyword moved to the new topic
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).toContain('<Topic>AIR QUALITY</Topic>')
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>LEGACY AEROSOLS</Variable_Level_1>')
    // Old topic should be gone
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('applies hierarchy move with renaming at same level', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > LANDFORMS > DEM >  > ',
          newKeywordPath: 'EARTH SCIENCE > LAND SURFACE > ELEVATION > TERRAIN FEATURES > DIGITAL ELEVATION MODEL >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify new hierarchy
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).toContain('<Topic>LAND SURFACE</Topic>')
    expect(result.correctedMetadata).toContain('<Term>ELEVATION</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>TERRAIN FEATURES</Variable_Level_1>')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DIGITAL ELEVATION MODEL</Variable_Level_2>')

    // Old values should be gone from first keyword (second keyword still has TOPOGRAPHY)
    const topographyMatches = result.correctedMetadata.match(/<Term>TOPOGRAPHY<\/Term>/g)
    expect(topographyMatches).toHaveLength(1) // Only in second keyword
    expect(result.correctedMetadata).not.toContain('LANDFORMS')
  })

  test('applies correction to second keyword in array', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 1],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > TERRAIN ELEVATION > DIGITAL TERRAIN MODEL >  > ',
          newKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > ELEVATION DATA > DIGITAL ELEVATION DATA >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // First keyword should remain unchanged
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DEM</Variable_Level_2>')

    // Second keyword should be updated with new names
    expect(result.correctedMetadata).toContain('<Variable_Level_1>ELEVATION DATA</Variable_Level_1>')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DIGITAL ELEVATION DATA</Variable_Level_2>')
    // Old values should be gone
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('removes science keyword when delete action is applied', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > LANDFORMS > DEM >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // First keyword should be removed
    expect(result.correctedMetadata).not.toContain('LANDFORMS')
    expect(result.correctedMetadata).not.toContain('<Detailed_Variable>DEM</Detailed_Variable>')

    // Second keyword should remain
    expect(result.correctedMetadata).toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).toContain('DIGITAL TERRAIN MODEL')
  })

  test('removes second science keyword when delete action is applied', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 1],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > TERRAIN ELEVATION > DIGITAL TERRAIN MODEL >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // First keyword should remain
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Second keyword should be removed
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('deletes parent Science_Keywords property when the last keyword in an array is removed', async () => {
    const multiKeywordXml = `<DIF>
      <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>AEROSOLS</Term>
      </Science_Keywords>
      <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>OCEANS</Topic>
          <Term>MARINE SEDIMENTS</Term>
      </Science_Keywords>
  </DIF>`

    // Since lookups are by path format value string, we specify the exact old keyword path values
    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
        },
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['ScienceKeywords', 1],
          oldKeywordPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // Verify the entire container is gone from the XML
    expect(result.correctedMetadata).not.toContain('<Science_Keywords>')
    expect(result.correctedMetadata).not.toContain('</Science_Keywords>')
  })

  test('returns false when an unsupported action is provided', async () => {
    const mockDif10 = `<DIF>
      <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>AEROSOLS</Term>
      </Science_Keywords>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'invalid_action_type', // Neither 'replace' nor 'delete'
          ummPath: ['ScienceKeywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS'
        }
      ]
    })

    // The delegate returns false, so the orchestrator does not increment the count
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('applies multiple science keyword corrections (mix of rename and move)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > LANDFORMS > DEM >  > ',
          newKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > LANDFORMS > DIGITAL ELEVATION MODEL >  > '
        },
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 1],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > TERRAIN ELEVATION > DIGITAL TERRAIN MODEL >  > ',
          newKeywordPath: 'EARTH SCIENCE > TERRESTRIAL HYDROSPHERE > SURFACE WATER > ELEVATION > DTM >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    expect(result.correctionsApplied).toHaveLength(2)

    // First keyword: renamed DEM to DIGITAL ELEVATION MODEL
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DIGITAL ELEVATION MODEL</Variable_Level_2>')

    // Second keyword: moved to completely different hierarchy
    expect(result.correctedMetadata).toContain('TERRESTRIAL HYDROSPHERE')
    expect(result.correctedMetadata).toContain('SURFACE WATER')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DTM</Variable_Level_2>')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('applies term-level rename within same category and topic', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > LANDFORMS > DEM >  > ',
          newKeywordPath: 'EARTH SCIENCE > LAND SURFACE > SURFACE TOPOGRAPHY > LANDFORMS > DEM >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify term changed from TOPOGRAPHY to SURFACE TOPOGRAPHY
    expect(result.correctedMetadata).toContain('<Term>SURFACE TOPOGRAPHY</Term>')
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Old term should still exist in second keyword
    const topographyMatches = result.correctedMetadata.match(/<Term>TOPOGRAPHY<\/Term>/g)
    expect(topographyMatches).toHaveLength(1) // Only in second keyword
  })

  test('applies category-level change (moving keyword to different category)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > ',
          newKeywordPath: 'EARTH SCIENCE SERVICES > DATA ANALYSIS AND VISUALIZATION > AEROSOL ANALYSIS > LEGACY AEROSOLS >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify category changed completely
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE SERVICES</Category>')
    expect(result.correctedMetadata).toContain('<Topic>DATA ANALYSIS AND VISUALIZATION</Topic>')
    expect(result.correctedMetadata).toContain('<Term>AEROSOL ANALYSIS</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>LEGACY AEROSOLS</Variable_Level_1>')

    // Old category should be gone
    expect(result.correctedMetadata).not.toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('handles single science keyword (not array) with replacement', async () => {
    const singleKeywordXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_KEYWORD</Short_Name>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
        <Term>CLOUDS</Term>
    </Science_Keywords>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > CLOUDS >  >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > CLOUD PROPERTIES >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('CLOUD PROPERTIES')
    expect(result.correctedMetadata).not.toContain('<Term>CLOUDS</Term>')
  })

  test('deletes only science keyword and removes Science_Keywords element', async () => {
    const singleKeywordXml = `<DIF>
    <Entry_ID>
        <Short_Name>DELETE_ONLY_KEYWORD</Short_Name>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
    </Science_Keywords>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE >  >  >  >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // Science_Keywords element should be completely removed
    expect(result.correctedMetadata).not.toContain('Science_Keywords')
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('handles multiple deletes reducing array to single element', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 1],
          oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > TERRAIN ELEVATION > DIGITAL TERRAIN MODEL >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // First keyword remains
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Second keyword deleted
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('skips correction when keyword path does not match any items in document', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          // This path does not exist in mockSimpleDif10Xml, so lookup fails
          oldKeywordPath: 'EARTH SCIENCE > NON_EXISTENT_TOPIC > AEROSOLS >  >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > AIR QUALITY > AEROSOLS >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)

    // Original XML should be unchanged
    expect(result.correctedMetadata).toContain('LEGACY AEROSOLS')
  })

  test('handles missing Science_Keywords element', async () => {
    const xmlWithoutKeywords = `<DIF>
    <Entry_ID>
        <Short_Name>NO_KEYWORDS</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE >  >  >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > AIR QUALITY >  >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('handles science keywords where leaves are parsed as objects with a #text property', async () => {
    // Simulating an XML snippet where an attribute or formatting causes
    // fast-xml-parser to turn a node into an object structure rather than a raw string
    const xmlWithComplexNodes = `<DIF>
      <Entry_ID>
          <Short_Name>COMPLEX_LEAF_TEST</Short_Name>
      </Entry_ID>
      <Science_Keywords>
          <Category xml:lang="en">EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>CLOUDS</Term>
      </Science_Keywords>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithComplexNodes,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          // This should match despite <Category> being parsed as an object internally
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > CLOUDS >  >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > CLOUD PROPERTIES >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the substitution took place seamlessly
    expect(result.correctedMetadata).toContain('<Term>CLOUD PROPERTIES</Term>')
    expect(result.correctedMetadata).not.toContain('<Term>CLOUDS</Term>')
  })
})
