import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithChronounits = `<DIF>
    <Entry_ID>
        <Short_Name>CHRONO_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Chronostratigraphic Units</Entry_Title>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Paleo_Start_Date>1970-01-01</Paleo_Start_Date>
            <Paleo_Stop_Date>2000-01-01</Paleo_Stop_Date>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
                <Era>CENOZOIC</Era>
                <Period>QUATERNARY</Period>
                <Epoch>HOLOCENE</Epoch>
            </Chronostratigraphic_Unit>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
                <Era>MESOZOIC</Era>
                <Period>CRETACEOUS</Period>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
    </Temporal_Coverage>
</DIF>`

describe('applyDif10MetadataCorrections - chronounits scheme', () => {
  test('applies chronostratigraphic unit correction', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > HOLOCENE >  > ',
          newKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > PLEISTOCENE >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the epoch was updated
    expect(result.correctedMetadata).toContain('<Epoch>PLEISTOCENE</Epoch>')
    expect(result.correctedMetadata).not.toContain('<Epoch>HOLOCENE</Epoch>')

    // Other fields should remain
    expect(result.correctedMetadata).toContain('<Eon>PHANEROZOIC</Eon>')
    expect(result.correctedMetadata).toContain('<Era>CENOZOIC</Era>')
    expect(result.correctedMetadata).toContain('<Period>QUATERNARY</Period>')
  })

  test('updates entire chronostratigraphic hierarchy', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 1],
          oldKeywordPath: 'PHANEROZOIC > MESOZOIC > CRETACEOUS >  >  > ',
          newKeywordPath: 'PHANEROZOIC > PALEOZOIC > PERMIAN > LOPINGIAN >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify the second unit was completely updated
    expect(result.correctedMetadata).toContain('<Era>PALEOZOIC</Era>')
    expect(result.correctedMetadata).toContain('<Period>PERMIAN</Period>')
    expect(result.correctedMetadata).toContain('<Epoch>LOPINGIAN</Epoch>')

    // Old values should be gone
    expect(result.correctedMetadata).not.toContain('MESOZOIC')
    expect(result.correctedMetadata).not.toContain('CRETACEOUS')
  })

  test('adds stage and detailed classification levels', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > HOLOCENE >  > ',
          newKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > HOLOCENE > GREENLANDIAN > EARLY HOLOCENE'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    expect(result.correctedMetadata).toContain('<Epoch>HOLOCENE</Epoch>')
    expect(result.correctedMetadata).toContain('<Stage>GREENLANDIAN</Stage>')
    expect(result.correctedMetadata).toContain('<Detailed_Classification>EARLY HOLOCENE</Detailed_Classification>')
  })

  test('deletes chronostratigraphic unit at index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 1],
          oldKeywordPath: 'PHANEROZOIC > MESOZOIC > CRETACEOUS >  >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Second unit should be removed
    expect(result.correctedMetadata).not.toContain('MESOZOIC')
    expect(result.correctedMetadata).not.toContain('CRETACEOUS')

    // First unit should remain
    expect(result.correctedMetadata).toContain('HOLOCENE')
  })

  test('deletes parent property when the last unit in an array is removed', async () => {
    const multiChronoXml = `<DIF>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Chronostratigraphic_Unit>
                <Eon>EON1</Eon>
            </Chronostratigraphic_Unit>
            <Chronostratigraphic_Unit>
                <Eon>EON2</Eon>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
    </Temporal_Coverage>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiChronoXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'EON1 >  >  >  >  > '
        },
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'EON2 >  >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // The entire Chronostratigraphic_Unit tag should be removed from the XML
    expect(result.correctedMetadata).not.toContain('<Chronostratigraphic_Unit>')
    expect(result.correctedMetadata).not.toContain('</Chronostratigraphic_Unit>')
  })

  test('handles missing Chronostratigraphic_Unit element', async () => {
    const xmlWithoutChronoUnits = `<DIF>
    <Entry_ID>
        <Short_Name>NO_CHRONO</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutChronoUnits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'PHANEROZOIC > CENOZOIC >  >  >  > ',
          newKeywordPath: 'PHANEROZOIC > MESOZOIC >  >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('deletes single chronostratigraphic unit', async () => {
    const singleChronoUnitXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_CHRONO</Short_Name>
    </Entry_ID>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
    </Temporal_Coverage>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleChronoUnitXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'PHANEROZOIC >  >  >  >  > ',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // The Chronostratigraphic_Unit element should be completely removed
    expect(result.correctedMetadata).not.toContain('Chronostratigraphic_Unit')
  })
})

describe('applyDif10ChronounitsCorrection - return false coverage', () => {
  test('returns false when ummPath does not contain a numeric index', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [{
        scheme: 'chronounits',
        action: 'replace',
        ummPath: ['Chronostratigraphic_Unit'], // Missing numeric index
        newKeywordPath: 'EON > ERA > PERIOD > EPOCH >  > '
      }]
    })

    // The delegate returns false, so the orchestrator does not increment the count
    expect(result.correctionCount).toBe(0)
  })

  test('returns false when Chronostratigraphic_Unit element is missing', async () => {
    const xmlNoChrono = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: xmlNoChrono,
      corrections: [{
        scheme: 'chronounits',
        action: 'replace',
        ummPath: ['Chronostratigraphic_Unit', 0],
        newKeywordPath: 'EON > ERA > PERIOD > EPOCH >  > '
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('returns false when index is out of bounds for an array', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [{
        scheme: 'chronounits',
        action: 'replace',
        ummPath: ['Chronostratigraphic_Unit', 99], // Index out of range
        newKeywordPath: 'EON > ERA > PERIOD > EPOCH >  > '
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('returns false for unsupported action (final fall-through)', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [{
        scheme: 'chronounits',
        action: 'unsupported_action', // Triggers the final return false in the delegate logic
        ummPath: ['Chronostratigraphic_Unit', 0]
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('handles chronounits where leaves are parsed as objects with a #text property', async () => {
    // Injecting an attribute into <Eon> to force fast-xml-parser to create an object instead of a string
    const complexChronoXml = `<DIF>
      <Temporal_Coverage>
          <Paleo_DateTime>
              <Chronostratigraphic_Unit>
                  <Eon xml:lang="en">PHANEROZOIC</Eon>
                  <Era>CENOZOIC</Era>
                  <Period>QUATERNARY</Period>
              </Chronostratigraphic_Unit>
          </Paleo_DateTime>
      </Temporal_Coverage>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: complexChronoXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY >  >  > ',
          newKeywordPath: 'PHANEROZOIC > CENOZOIC > NEOGENE >  >  > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify line 23 fallback cleanly extracted values and updated successfully
    expect(result.correctedMetadata).toContain('<Period>NEOGENE</Period>')
    expect(result.correctedMetadata).not.toContain('QUATERNARY')
  })

  test('returns false for unsupported action type using value-based lookup (final fall-through)', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'unsupported_action_type', // Neither 'replace' nor 'delete'
          oldKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > HOLOCENE >  > '
        }
      ]
    })

    // Line 113 triggers: correctionCount does not increment because the delegate returns false
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})
