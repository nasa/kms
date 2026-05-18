import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithIdnNodes = `<DIF>
    <Entry_ID>
        <Short_Name>IDN_NODE_TEST</Short_Name>
    </Entry_ID>
    <IDN_Node>
      <Short_Name>ARCTIC</Short_Name>
      <Long_Name>Arctic Council</Long_Name>
    </IDN_Node>
    <IDN_Node>
      <Short_Name>USA/NASA</Short_Name>
      <Long_Name>National Aeronautics and Space Administration</Long_Name>
    </IDN_Node>
</DIF>`

describe('applyDif10MetadataCorrections - idnnode scheme', () => {
  test('applies replace correction using single segment path as Short_Name', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'replace',
          ummPath: ['IDN_Node', 0], // Index must be a NUMBER
          newKeywordPath: 'NEW-ARCTIC', // The Short_Name
          newLongName: 'Updated Arctic Council' // The Long_Name
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>NEW-ARCTIC</Short_Name>')
    expect(result.correctedMetadata).toContain('<Long_Name>Updated Arctic Council</Long_Name>')
    // Verify second node remains untouched to ensure index targeting worked
    expect(result.correctedMetadata).toContain('<Short_Name>USA/NASA</Short_Name>')
  })

  test('covers field pruning by deleting Long_Name if newLongName is empty', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'replace',
          ummPath: ['IDN_Node', 1],
          newKeywordPath: 'NASA-UPDATED',
          newLongName: '' // Triggers the delete branch for Long_Name
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>NASA-UPDATED</Short_Name>')
    // Long_Name tag should be removed for the second node
    expect(result.correctedMetadata).not.toContain('National Aeronautics and Space Administration')
    // First node Long_Name remains
    expect(result.correctedMetadata).toContain('<Long_Name>Arctic Council</Long_Name>')
  })

  test('deletes a specific IDN_Node from an array', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'delete',
          ummPath: ['IDN_Node', 0]
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).not.toContain('<Short_Name>ARCTIC</Short_Name>')
    expect(result.correctedMetadata).toContain('<Short_Name>USA/NASA</Short_Name>')
  })

  test('deletes parent IDN_Node property when the last node is removed', async () => {
    const singleNodeXml = '<DIF><IDN_Node><Short_Name>ONLY-ONE</Short_Name></IDN_Node></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleNodeXml,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'delete',
          ummPath: ['IDN_Node', 0]
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // The entire IDN_Node element should be gone
    expect(result.correctedMetadata).not.toContain('<IDN_Node>')
  })

  test('deletes the IDN_Node key when the last element of an array is removed', async () => {
    // Starting with an array of two nodes
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'delete',
          ummPath: ['IDN_Node', 0]
        },
        {
          scheme: 'idnnode',
          action: 'delete',
          ummPath: ['IDN_Node', 0] // Index 0 again because array shifts
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // This triggers: if (parent.IDN_Node.length === 0) { delete parent.IDN_Node }
    expect(result.correctedMetadata).not.toContain('<IDN_Node>')
  })

  describe('Return False / Guard Clause Coverage', () => {
    test('returns false when ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithIdnNodes,
        corrections: [{
          scheme: 'idnnode',
          action: 'replace',
          ummPath: ['IDN_Node'], // Missing number
          newKeywordPath: 'A > B'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false when IDN_Node element is missing from metadata', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'idnnode',
          action: 'replace',
          ummPath: ['IDN_Node', 0],
          newKeywordPath: 'A > B'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for unrecognized action (fall-through)', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithIdnNodes,
        corrections: [{
          scheme: 'idnnode',
          action: 'invalid_action',
          ummPath: ['IDN_Node', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('idnnode delete handles single object vs array', async () => {
    // Test the "else" branch of the delete logic (single object)
      const singleNodeXml = '<DIF><IDN_Node><Short_Name>ONLY</Short_Name></IDN_Node></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleNodeXml,
        corrections: [{
          scheme: 'idnnode',
          action: 'delete',
          ummPath: ['IDN_Node', 0]
        }]
      })
      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<IDN_Node>')
    })
  })
})
