import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithInstruments = `<DIF>
    <Entry_ID>
        <Short_Name>Instruments_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Instruments</Entry_Title>
    <Platform>
      <Type>Air-based Platforms</Type>
      <Short_Name>UC-12B</Short_Name>
      <Long_Name>NASA Langley Beechcraft UC-12B Huron</Long_Name>
      <Instrument>
        <Short_Name>IRMSS</Short_Name>
        <Long_Name>Infrared Multispectral Scanner</Long_Name>
      </Instrument>
    </Platform>
    <Platform>
      <Type>Land-based Platforms</Type>
      <Short_Name>MINTS</Short_Name>
      <Long_Name>Multi-Scale Integrated Intelligent Interactive Sensing Consortium</Long_Name>
      <Instrument>
        <Short_Name>LISS-II</Short_Name>
        <Long_Name>Linear Imaging Self Scanning Sensor II</Long_Name>
      </Instrument>
    </Platform>
</DIF>`

describe('applyDif10MetadataCorrections - instruments scheme', () => {
  test('applies long name correction to first Instrument', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          ummPath: ['Platform', 0, 'Instrument', 0],
          oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
          newKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
          newLongName: 'Updated Infrared Multispectral Scanner'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Updated Infrared Multispectral Scanner</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Infrared Multispectral Scanner</Long_Name>')

    // Other long name should remain unchanged
    expect(result.correctedMetadata).toContain('<Long_Name>Linear Imaging Self Scanning Sensor II</Long_Name>')

    // Platform stays untouched
    expect(result.correctedMetadata).toContain('<Short_Name>UC-12B</Short_Name>')
  })

  test('updates both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          ummPath: ['Platform', 1, 'Instrument', 0],
          oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > LISS-II',
          newKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > LISSUPDATE-II',
          newLongName: 'Linear Imaging Self Scanning Sensor II Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>LISSUPDATE-II</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>LISS-II</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Linear Imaging Self Scanning Sensor II Updated</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Linear Imaging Self Scanning Sensor II</Long_Name>')
  })

  test('deletes Instrument', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          ummPath: ['Platform', 0, 'Instrument', 0],
          oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Instrument should be removed
    expect(result.correctedMetadata).not.toContain('<Short_Name>IRMSS</Short_Name>')

    // Other Instrument should be unchanged
    expect(result.correctedMetadata).toContain('<Short_Name>LISS-II</Short_Name>')
  })

  test('deletes parent Instrument property when the last instrument in an array is removed', async () => {
    const multiInstrumentXml = `<DIF>
      <Platform>
        <Short_Name>P1</Short_Name>
        <Instrument><Short_Name>I1</Short_Name></Instrument>
        <Instrument><Short_Name>I2</Short_Name></Instrument>
      </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiInstrumentXml,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          ummPath: ['Platform', 0, 'Instrument', 0]
        },
        {
          scheme: 'instruments',
          action: 'delete',
          ummPath: ['Platform', 0, 'Instrument', 0] // Target remaining item
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // The Instrument tag should be entirely removed from the XML
    expect(result.correctedMetadata).not.toContain('<Instrument>')
  })

  test('covers the else branch by deleting a single instrument object', async () => {
    const singleInstrumentXml = `<DIF>
      <Platform>
        <Short_Name>P1</Short_Name>
        <Instrument><Short_Name>I1</Short_Name></Instrument>
      </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleInstrumentXml,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          ummPath: ['Platform', 0, 'Instrument', 0]
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).not.toContain('<Instrument>')
  })

  test('covers the field pruning else branch by providing an empty long name', async () => {
    const instrumentXml = `<DIF>
      <Platform>
        <Short_Name>P1</Short_Name>
        <Instrument>
          <Short_Name>OLD-SHORT</Short_Name>
          <Long_Name>Old Long Name to delete</Long_Name>
        </Instrument>
      </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: instrumentXml,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          ummPath: ['Platform', 0, 'Instrument', 0],
          newKeywordPath: 'Category > Topic > Term > Variable > NEW-SHORT',
          newLongName: '' // Triggers delete target['Long_Name']
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>NEW-SHORT</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>')
  })

  test('handles missing Instrument element', async () => {
    const xmlWithoutPlatform = `<DIF>
        <Entry_ID>
            <Short_Name>No_instrument</Short_Name>
        </Entry_ID>
        <Platform>
          <Type>Air-based Platforms</Type>
          <Short_Name>UC-12B</Short_Name>
          <Long_Name>NASA Langley Beechcraft UC-12B Huron</Long_Name>
        </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutPlatform,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          ummPath: ['Platform', 0, 'Instrument', 0],
          oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
          newKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS1'
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
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          ummPath: ['Platform', 10, 'Instrument', 0],
          oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
          newKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS1'
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})

describe('applyDif10InstrumentCorrection - return false coverage', () => {
  test('returns false when ummPath does not contain a numeric index', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'replace',
        ummPath: ['Platform', 'Instrument'], // Missing numeric indices for Platform and Instrument
        newKeywordPath: 'Category > Topic > Term > Variable > NEW-SHORT'
      }]
    })

    // The delegate returns false, so the orchestrator does not increment the count
    expect(result.correctionCount).toBe(0)
  })

  test('returns false when Platform or Instrument element is missing from metadata', async () => {
    const xmlNoInstruments = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: xmlNoInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'replace',
        ummPath: ['Platform', 0, 'Instrument', 0],
        newKeywordPath: 'Category > Topic > Term > Variable > NEW-SHORT'
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('returns false when index is out of bounds', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'replace',
        ummPath: ['Platform', 0, 'Instrument', 99], // Instrument index 99 does not exist
        newKeywordPath: 'Category > Topic > Term > Variable > NEW-SHORT'
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('returns false for unsupported action (final fall-through)', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'invalid_action_type', // Triggers the final return false in the delegate
        ummPath: ['Platform', 0, 'Instrument', 0]
      }]
    })

    expect(result.correctionCount).toBe(0)
  })
})
