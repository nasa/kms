import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10WithProjects = `<DIF>
    <Entry_ID>
        <Short_Name>Projects_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Projects</Entry_Title>
    <Project>
        <Short_Name>ESIP</Short_Name>
        <Long_Name>Earth Science Information Partners Program</Long_Name>
    </Project>
    <Project>
        <Short_Name>ALIENS</Short_Name>
        <Long_Name>Aliens in Antarctica</Long_Name>
    </Project>
</DIF>`

describe('applyDif10MetadataCorrections - projects scheme', () => {
  test('applies long name correction to first Project', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          ummPath: ['Project', 0],
          oldKeywordPath: 'D - F > ESIP',
          newKeywordPath: 'D - F > ESIP',
          newLongName: 'Updated Earth Science Information Partners Program'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Updated Earth Science Information Partners Program</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Earth Science Information Partners Program</Long_Name>')

    // Second long name stays untouched
    expect(result.correctedMetadata).toContain('<Long_Name>Aliens in Antarctica</Long_Name>')
  })

  test('updates both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          ummPath: ['Project', 1],
          oldKeywordPath: 'A - C > ALIENS',
          newKeywordPath: 'A - C > ALIENS UP',
          newLongName: 'Aliens research in Antarctica'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>ALIENS UP</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>ALIENS</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Aliens research in Antarctica</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Aliens in Antarctica</Long_Name>')
  })

  test('deletes Project', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Project', 0],
          oldKeywordPath: 'D - F > ESIP',
          newKeywordPath: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Project should be removed
    expect(result.correctedMetadata).not.toContain('<Short_Name>ESIP</Short_Name>')

    // Other Project should be unchanged
    expect(result.correctedMetadata).toContain('<Short_Name>ALIENS</Short_Name>')
  })

  test('deletes the Project key when the last element of an array is removed', async () => {
    // Starting with an array of two projects (from mockDif10WithProjects)
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Project', 0]
        },
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Project', 0] // Index 0 again because the array shifts
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // This specifically triggers:
    // if (parent.Project.length === 0) { delete parent.Project }
    expect(result.correctedMetadata).not.toContain('<Project>')
  })

  test('deletes the Project key when it is a single object (non-array)', async () => {
    // XML with only one Project tag, which is parsed as a single object
    const singleProjectXml = `<DIF>
        <Project>
            <Short_Name>SINGLE-PROJ</Short_Name>
            <Long_Name>Single Project Test</Long_Name>
        </Project>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleProjectXml,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Project', 0] // Index 0 targets the single object
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // This specifically triggers:
    // } else { delete parent.Project }
    expect(result.correctedMetadata).not.toContain('<Project>')
    expect(result.correctedMetadata).not.toContain('SINGLE-PROJ')
  })

  test('deletes the Project key when it is a single object (non-array branch)', async () => {
    // XML with only one Project tag, which is parsed as a single object
    const singleProjectXml = `<DIF>
        <Project>
            <Short_Name>SINGLE-PROJ</Short_Name>
            <Long_Name>Single Project Test</Long_Name>
        </Project>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleProjectXml,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Project', 0] // Index 0 targets the single object
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // This specifically triggers:
    // } else { delete parent.Project }
    expect(result.correctedMetadata).not.toContain('<Project>')
    expect(result.correctedMetadata).not.toContain('SINGLE-PROJ')
  })

  test('handles missing Project element', async () => {
    const xmlWithoutProject = `<DIF>
        <Entry_ID>
            <Short_Name>No_project</Short_Name>
        </Entry_ID>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutProject,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          ummPath: ['Project', 0],
          oldKeywordPath: 'D - F > ESIP',
          newKeywordPath: 'D - F > ESIP-7'
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('deletes a specific field (Long_Name) within a Project when the new value is undefined', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          ummPath: ['Project', 0],
          // Providing a single segment and NO newLongName
          // results in normalizedSegments[1] (Long_Name) being undefined
          newKeywordPath: 'M - O > ONLY_SHORT'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify Short_Name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>ONLY_SHORT</Short_Name>')

    // 2. Verify the OLD Long_Name for Project 0 is gone
    expect(result.correctedMetadata).not.toContain('Earth Science Information Partners Program')

    // 3. Verify that Project 1 still HAS its Long_Name (proving we didn't delete everything)
    expect(result.correctedMetadata).toContain('<Long_Name>Aliens in Antarctica</Long_Name>')
  })

  test('handles out of bounds index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          ummPath: ['Project', 10],
          oldKeywordPath: 'D - F > ESIP',
          newKeywordPath: 'D - F > ESIP-7'
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  describe('Guard Clause Coverage (Return False)', () => {
    test('returns false if ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProjects,
        corrections: [{
          scheme: 'projects',
          ummPath: ['Project'] // Missing numeric index
        }]
      })

      // This triggers: if (typeof index !== 'number') return false
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if Project tag is missing from metadata', async () => {
      const xmlWithoutProject = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: xmlWithoutProject,
        corrections: [{
          scheme: 'projects',
          ummPath: ['Project', 0]
        }]
      })

      // This triggers: if (!projects) return false
      expect(result.correctionCount).toBe(0)
    })

    test('returns false if target project is not found (index out of bounds)', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProjects,
        corrections: [{
          scheme: 'projects',
          ummPath: ['Project', 99] // Out of bounds
        }]
      })

      // This triggers: if (!target) return false
      expect(result.correctionCount).toBe(0)
    })

    test('returns false for unsupported action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProjects,
        corrections: [{
          scheme: 'projects',
          action: 'invalid_action',
          ummPath: ['Project', 0]
        }]
      })

      // This triggers the final return false at the end of the function
      expect(result.correctionCount).toBe(0)
    })
  })
})
