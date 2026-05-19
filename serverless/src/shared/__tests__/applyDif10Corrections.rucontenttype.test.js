import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithRelatedURLs = `<DIF>
    <Entry_ID>
        <Short_Name>RELATED_URL_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Related URLs</Entry_Title>
    <Related_URL>
        <URL_Content_Type>
            <Type>GET DATA</Type>
        </URL_Content_Type>
        <URL>https://example.com/data</URL>
    </Related_URL>
    <Related_URL>
        <URL_Content_Type>
            <Type>GET CAPABILITIES</Type>
            <Subtype>OpenSearch</Subtype>
        </URL_Content_Type>
        <URL>https://example.com/opensearch</URL>
    </Related_URL>
    <Related_URL>
        <URL_Content_Type>
            <Type>USE SERVICE API</Type>
            <Subtype>REST</Subtype>
        </URL_Content_Type>
        <URL>https://example.com/api</URL>
    </Related_URL>
</DIF>`

describe('applyDif10MetadataCorrections - rucontenttype scheme', () => {
  test('applies URL content type correction to first Related_URL', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > GET DATA > ', // Last 2 segments: 'GET DATA' and ''
          newKeywordPath: 'DistributionURL > GET SERVICE > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first URL's type was updated
    expect(result.correctedMetadata).toContain('<Type>GET SERVICE</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>GET DATA</Type>')

    // Other URLs should remain unchanged
    expect(result.correctedMetadata).toContain('<Type>GET CAPABILITIES</Type>')
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('updates both type and subtype', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > GET CAPABILITIES > OpenSearch', // Last 2 segments: 'GET CAPABILITIES' and 'OpenSearch'
          newKeywordPath: 'DistributionURL > GET CAPABILITIES > OGC WMS'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify subtype was updated
    expect(result.correctedMetadata).toContain('<Subtype>OGC WMS</Subtype>')
    expect(result.correctedMetadata).not.toContain('<Subtype>OpenSearch</Subtype>')

    // Type should remain the same
    expect(result.correctedMetadata).toContain('<Type>GET CAPABILITIES</Type>')
  })

  test('adds subtype to URL that only had type', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > GET DATA > ',
          newKeywordPath: 'DistributionURL > GET DATA > DIRECT DOWNLOAD'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    expect(result.correctedMetadata).toContain('<Type>GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Subtype>DIRECT DOWNLOAD</Subtype>')
  })

  test('removes subtype when moving to type-only', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > USE SERVICE API > REST',
          newKeywordPath: 'DistributionURL > GET DATA > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Type should be updated
    const getDataMatches = result.correctedMetadata.match(/<Type>GET DATA<\/Type>/g)
    expect(getDataMatches.length).toBeGreaterThan(0)

    // REST subtype should be removed from third URL
    expect(result.correctedMetadata).not.toContain('<Subtype>REST</Subtype>')
  })

  test('deletes URL_Content_Type from Related_URL', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'delete',
          oldKeywordPath: 'DistributionURL > GET CAPABILITIES > OpenSearch',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // URL_Content_Type should be removed from second Related_URL
    expect(result.correctedMetadata).not.toContain('OpenSearch')

    // But the Related_URL itself should remain
    expect(result.correctedMetadata).toContain('https://example.com/opensearch')

    // Other Related_URLs should be unchanged
    expect(result.correctedMetadata).toContain('<Type>GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('handles single Related_URL (not array)', async () => {
    const singleUrlXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_URL</Short_Name>
    </Entry_ID>
    <Related_URL>
        <URL_Content_Type>
            <Type>VIEW PROJECT HOME PAGE</Type>
        </URL_Content_Type>
        <URL>https://example.com</URL>
    </Related_URL>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleUrlXml,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > VIEW PROJECT HOME PAGE > ',
          newKeywordPath: 'DistributionURL > VIEW RELATED INFORMATION > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Type>VIEW RELATED INFORMATION</Type>')
    expect(result.correctedMetadata).not.toContain('VIEW PROJECT HOME PAGE')
  })

  test('handles missing Related_URL element', async () => {
    const xmlWithoutRelatedURL = `<DIF>
    <Entry_ID>
        <Short_Name>NO_URL</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutRelatedURL,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > GET DATA > ',
          newKeywordPath: 'DistributionURL > GET SERVICE > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('removes a specific content type field when the replacement value is empty or undefined', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'replace',
        oldKeywordPath: 'DistributionURL > GET CAPABILITIES > OpenSearch',
        newKeywordPath: ' > JUST_A_TYPE > ' // Last 2 segments: 'JUST_A_TYPE' and ''
      }]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify the specific target was updated
    expect(result.correctedMetadata).toContain('<Type>JUST_A_TYPE</Type>')

    // 2. Verify the specific OLD Subtype is gone
    expect(result.correctedMetadata).not.toContain('OpenSearch')

    // 3. Verify that other Subtypes in different blocks are UNTOUCHED
    expect(result.correctedMetadata).toContain('<Subtype>REST</Subtype>')
  })

  test('returns false and makes no changes when an unsupported action is provided', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'unsupported_action',
        oldKeywordPath: 'DistributionURL > GET DATA > '
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('removes the URL_Content_Type container entirely if all its fields are deleted', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'replace',
        oldKeywordPath: 'DistributionURL > GET DATA > ',
        newKeywordPath: ' > ' // Last 2 segments: '' and ''
      }]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify the specific value is gone
    expect(result.correctedMetadata).not.toContain('GET DATA')

    // 2. Verify the structure has dropped URL_Content_Type for index 0 completely
    expect(result.correctedMetadata).toContain(
      '<Related_URL>\n        <URL>https://example.com/data</URL>\n    </Related_URL>'
    )

    // 3. Verify we didn't accidentally delete URL_Content_Type from other blocks
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('returns false when oldKeywordPath does not match any current elements', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'DistributionURL > NOT_REAL_TYPE > ', // Will not find a value match
          newKeywordPath: 'DistributionURL > GET SERVICE > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('handles fast-xml-parser object leaves with attributes (Covers Line 16)', async () => {
    const xmlWithAttributes = `<DIF>
        <Related_URL>
            <URL_Content_Type>
                <Type secure="true">GET DATA</Type>
            </URL_Content_Type>
            <URL>https://example.com/data</URL>
        </Related_URL>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: xmlWithAttributes,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordPath: 'GET DATA > ',
          newKeywordPath: 'GET SERVICE > '
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Type>GET SERVICE</Type>')
    expect(result.correctedMetadata).not.toContain('GET DATA')
  })
})
