import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithProviders = `<DIF>
    <Entry_ID>
        <Short_Name>Providers_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Providers</Entry_Title>
    <Organization>
        <Organization_Type>ARCHIVER</Organization_Type>
        <Organization_Name>
            <Short_Name>BROWN/GEO</Short_Name>
            <Long_Name>Department of Geological Sciences, Brown University</Long_Name>
        </Organization_Name>
        <Hours_Of_Service>0800-1600</Hours_Of_Service>
        <Instructions>In addition to the address below there are other ESIC offices throught the country. Afull list of these offices is at:&lt;URL: http://www-nmd.usgs.gov/esic/esic_index.html&gt;</Instructions>
        <Personnel>
            <Role>DATA CENTER CONTACT</Role>
            <Contact_Person>
                <First_Name>Customer</First_Name>
                <Middle_Name>Services</Middle_Name>
                <Last_Name>Representative</Last_Name>
            </Contact_Person>
        </Personnel>
    </Organization>
    <Organization>
        <Organization_Type>DISTRIBUTOR</Organization_Type>
        <Organization_Name>
            <Short_Name>ESRI-CANADA</Short_Name>
            <Long_Name>Environmental Systems Research Institute, Inc. - Canada</Long_Name>
        </Organization_Name>
        <Hours_Of_Service>0800-1630</Hours_Of_Service>
        <Instructions>In addition to the address below there are other ESIC offices throught the country. Afull list of these offices is at:&lt;URL: http://www-nmd.usgs.gov/esic/esic_index.html&gt;</Instructions>
        <Personnel>
            <Role>DATA CENTER CONTACT</Role>
            <Contact_Person>
                <Last_Name>Not provided</Last_Name>
            </Contact_Person>
        </Personnel>
    </Organization>
</DIF>`

describe('applyDif10MetadataCorrections - providers scheme', () => {
  test('applies long name correction to first provider', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          ummPath: ['Organization_Name', 0],
          oldKeywordPath: 'ACADEMIC >  >  >  > BROWN/GEO',
          newKeywordPath: 'ACADEMIC >  >  >  > BROWN/GEO',
          newLongName: 'Department of Geological Sciences, Brown University East'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Department of Geological Sciences, Brown University East</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Department of Geological Sciences, Brown University</Long_Name>')

    // Other long name should remain unchanged
    expect(result.correctedMetadata).toContain('<Long_Name>Environmental Systems Research Institute, Inc. - Canada</Long_Name>')

    // Hours of service stays untouched
    expect(result.correctedMetadata).toContain('<Hours_Of_Service>0800-1600</Hours_Of_Service>')
  })

  test('updates both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          ummPath: ['Organization_Name', 1],
          oldKeywordPath: 'COMMERCIAL >  >  >  > ESRI-CANADA',
          newKeywordPath: 'COMMERCIAL >  >  >  > ESRI2-CANADA',
          newLongName: 'Environmental Systems Research Institute 2, Inc. - Canada'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>ESRI2-CANADA</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>ESRI-CANADA</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Environmental Systems Research Institute 2, Inc. - Canada</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Environmental Systems Research Institute, Inc. - Canada</Long_Name>')
  })

  test('deletes Provider', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'delete',
          ummPath: ['Organization_Name', 1],
          oldKeywordPath: 'COMMERCIAL >  >  >  > ESRI-CANADA',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Provider should be removed
    expect(result.correctedMetadata).not.toContain('ESRI-CANADA')

    // Other Provider should be unchanged
    expect(result.correctedMetadata).toContain('<Short_Name>BROWN/GEO</Short_Name>')
  })

  test('handles missing Provider element', async () => {
    const xmlWithoutProvider = `<DIF>
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
      metadataPayload: xmlWithoutProvider,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          ummPath: ['Organization_Name', 1],
          oldKeywordPath: 'COMMERCIAL >  >  >  > ESRI-CANADA',
          newKeywordPath: 'COMMERCIAL >  >  >  > ESRI2-CANADA'
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
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          ummPath: ['Organization_Name', 10],
          oldKeywordPath: 'COMMERCIAL >  >  >  > ESRI-CANADA',
          newKeywordPath: 'COMMERCIAL >  >  >  > ESRI2-CANADA'
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('initializes the Organization_Name object if it is missing during a replace action', async () => {
    // Organization block without the Organization_Name child
    const missingNameXml = `<DIF>
        <Organization>
            <Organization_Type>ARCHIVER</Organization_Type>
        </Organization>
      </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: missingNameXml,
      corrections: [{
        scheme: 'providers',
        action: 'replace',
        ummPath: ['Organization_Name', 0],
        newKeywordPath: ' >  >  >  >  > SHORT',
        newLongName: 'LONG'
      }]
    })

    expect(result.correctionCount).toBe(1)
    // This triggers: if (!targetOrg.Organization_Name && action === 'replace') { targetOrg.Organization_Name = {} }
    expect(result.correctedMetadata).toContain('<Organization_Name>')
    expect(result.correctedMetadata).toContain('<Short_Name>SHORT</Short_Name>')
  })

  test('removes the Organization key entirely when the last provider in an array is deleted', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'delete',
          ummPath: ['Organization_Name', 0]
        },
        {
          scheme: 'providers',
          action: 'delete',
          ummPath: ['Organization_Name', 0]
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // This triggers: if (parent.Organization.length === 0) { delete parent.Organization }
    expect(result.correctedMetadata).not.toContain('<Organization>')
  })

  test('deletes the Organization key when it contains a single object instead of an array', async () => {
    const singleOrgXml = '<DIF><Organization><Organization_Name><Short_Name>O</Short_Name></Organization_Name></Organization></DIF>'
    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleOrgXml,
      corrections: [{
        scheme: 'providers',
        action: 'delete',
        ummPath: ['Organization_Name', 0]
      }]
    })

    // This triggers the 'else' branch: delete parent.Organization
    expect(result.correctedMetadata).not.toContain('<Organization>')
  })

  test('removes a specific provider field when the replacement value is empty or undefined', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProviders,
      corrections: [{
        scheme: 'providers',
        action: 'replace',
        ummPath: ['Organization_Name', 0],
        // Providing only one segment and NO newLongName results in index [1] being undefined
        newKeywordPath: ' >  >  >  >  > ONLY_SHORT'
      }]
    })

    // This triggers: } else { delete target[field] }
    expect(result.correctedMetadata).toContain('<Short_Name>ONLY_SHORT</Short_Name>')
    // Check that the specific Long_Name of the first provider was deleted
    expect(result.correctedMetadata).not.toContain('Department of Geological Sciences, Brown University')
  })

  test('returns false and makes no changes when an unsupported action is provided', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProviders,
      corrections: [{
        scheme: 'providers',
        action: 'invalid_action',
        ummPath: ['Organization_Name', 0]
      }]
    })

    // This triggers the final: return false
    expect(result.correctionCount).toBe(0)
  })
})
