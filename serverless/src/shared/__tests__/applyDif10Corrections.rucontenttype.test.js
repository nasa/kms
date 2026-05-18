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
          ummPath: ['RelatedUrls', 0, 'URLContentType'],
          oldKeywordPath: 'DistributionURL > GET DATA > ',
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
          ummPath: ['RelatedUrls', 1, 'URLContentType'],
          oldKeywordPath: 'DistributionURL > GET CAPABILITIES > OpenSearch',
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
          ummPath: ['RelatedUrls', 0, 'URLContentType'],
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
          ummPath: ['RelatedUrls', 2, 'URLContentType'],
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
          ummPath: ['RelatedUrls', 1, 'URLContentType'],
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
          ummPath: ['RelatedUrls', 0, 'URLContentType'],
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
          ummPath: ['RelatedUrls', 0, 'URLContentType'],
          oldKeywordPath: 'DistributionURL > GET DATA > ',
          newKeywordPath: 'DistributionURL > GET SERVICE > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('initializes the URL_Content_Type object if it is missing during a replace action', async () => {
    // Related_URL block without the URL_Content_Type child
    const missingContentTypeXml = `<DIF>
        <Related_URL>
            <URL>https://example.com/missing</URL>
        </Related_URL>
      </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: missingContentTypeXml,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'replace',
        ummPath: ['RelatedUrls', 0],
        // Last two segments: Type = "GET DATA", Subtype = "DIRECT DOWNLOAD"
        newKeywordPath: 'DATA SET LANDING PAGE > GET DATA > DIRECT DOWNLOAD'
      }]
    })

    expect(result.correctionCount).toBe(1)
    // Triggers initialization of the missing container
    expect(result.correctedMetadata).toContain('<URL_Content_Type>')
    expect(result.correctedMetadata).toContain('<Type>GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Subtype>DIRECT DOWNLOAD</Subtype>')
  })

  test('removes a specific content type field when the replacement value is empty or undefined', async () => {
    // Start with a URL that has both Type and Subtype
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'replace',
        ummPath: ['RelatedUrls', 1], // Index 1 has Type "GET CAPABILITIES" and Subtype "OpenSearch"
        // Providing only one segment makes normalizedSegments[1] (Subtype) undefined
        newKeywordPath: ' > JUST_A_TYPE > '
      }]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify the specific target was updated
    expect(result.correctedMetadata).toContain('<Type>JUST_A_TYPE</Type>')

    // 2. Verify the specific OLD Subtype is gone (triggers: delete target[field])
    expect(result.correctedMetadata).not.toContain('OpenSearch')

    // 3. Verify that other Subtypes in different blocks are UNTOUCHED
    // This proves we didn't delete the tag globally
    expect(result.correctedMetadata).toContain('<Subtype>REST</Subtype>')
  })

  test('returns false and makes no changes when an unsupported action is provided', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'unsupported_action',
        ummPath: ['RelatedUrls', 0]
      }]
    })

    // Triggers the final fall-through: return false
    expect(result.correctionCount).toBe(0)
  })

  test('removes the URL_Content_Type container entirely if all its fields are deleted', async () => {
    // Start with a Related_URL that has a Content Type
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'replace',
        ummPath: ['RelatedUrls', 0], // Index 0 has <Type>GET DATA</Type>
        // Providing empty segments or segments that are just whitespace
        // causes the loop to delete both 'Type' and 'Subtype'
        newKeywordPath: ' > '
      }]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify the specific value is gone
    expect(result.correctedMetadata).not.toContain('GET DATA')

    // 2. This specifically triggers: if (Object.keys(target).length === 0) { delete targetUrlBlock.URL_Content_Type }
    // Because we modified index 0, and index 0's URL_Content_Type should be completely removed.
    // We check for the absence of the specific block structure for that URL.
    expect(result.correctedMetadata).toContain(
      '<Related_URL>\n        <URL>https://example.com/data</URL>\n    </Related_URL>'
    )

    // 3. Verify we didn't accidentally delete URL_Content_Type from other blocks
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('handles out of bounds index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          ummPath: ['RelatedUrls', 10, 'URLContentType'],
          oldKeywordPath: 'DistributionURL > GET DATA > ',
          newKeywordPath: 'DistributionURL > GET SERVICE > '
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})
