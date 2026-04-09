import { readFileSync } from 'fs'
import { join } from 'path'

import {
  beforeEach,
  describe,
  expect,
  test
} from 'vitest'

import { CsvComparator } from '../csvComparator'

describe('CsvComparator', () => {
  let comparator
  let publishedCsv
  let draftCsv

  beforeEach(() => {
    comparator = new CsvComparator()

    // Load the mock CSV files
    publishedCsv = readFileSync(
      join(__dirname, '../__mocks__/sciencekeywords-published.csv'),
      'utf-8'
    )

    draftCsv = readFileSync(
      join(__dirname, '../__mocks__/sciencekeywords-draft.csv'),
      'utf-8'
    )
  })

  describe('parseCsvContent', () => {
    test('should parse CSV content and create UUID to path map', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBeGreaterThan(0)
    })

    test('should correctly parse paths for root concepts', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Root EARTH SCIENCE concept
      expect(result.get('91697b7d-8f2b-4954-850e-61d5f61c867d')).toBe('EARTH SCIENCE > OCEANS')
    })

    test('should correctly parse paths for nested concepts', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // AQUACULTURE concept
      expect(result.get('f6c057c9-c789-4cd5-ba22-e9b08aae152b')).toBe(
        'EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > AQUACULTURE'
      )
    })

    test('should correctly parse paths with multiple levels', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // COASTAL BATHYMETRY concept (5 levels deep)
      expect(result.get('d80c015f-a383-4883-8309-6aab1c39f5b6')).toBe(
        'EARTH SCIENCE > OCEANS > BATHYMETRY/SEAFLOOR TOPOGRAPHY > BATHYMETRY > COASTAL BATHYMETRY'
      )
    })

    test('should skip header rows correctly', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Should not include header row text as a UUID
      expect(result.has('UUID')).toBe(false)
      expect(result.has('Category')).toBe(false)
    })

    test('should handle empty fields in path', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Concept with empty middle fields
      expect(result.get('f27ad52c-3dfd-4788-851a-427e60ae1b8f')).toBe(
        'EARTH SCIENCE > OCEANS > AQUATIC SCIENCES'
      )
    })

    test('should use custom path separator', () => {
      const customComparator = new CsvComparator(2, ' / ')
      const result = customComparator.parseCsvContent(publishedCsv)

      expect(result.get('f6c057c9-c789-4cd5-ba22-e9b08aae152b')).toBe(
        'EARTH SCIENCE / OCEANS / AQUATIC SCIENCES / AQUACULTURE'
      )
    })

    test('should handle coral reef hierarchy correctly', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Parent CORAL REEFS
      expect(result.get('ad497e7a-48fa-45e1-90a5-b052508bdb30')).toBe(
        'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > CORAL REEFS'
      )

      // Child CORAL BLEACHING
      expect(result.get('f5df87b6-ed50-4da0-9ba5-7ce4c907bdb3')).toBe(
        'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > CORAL REEFS > CORAL BLEACHING'
      )
    })
  })

  describe('compare', () => {
    test('should identify added keywords', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      expect(result.addedKeywords).toBeInstanceOf(Map)
      expect(result.addedKeywords.size).toBeGreaterThan(0)

      // Check for specifically added keyword: NEW SHORELINES
      expect(result.addedKeywords.has('3472f70b-874f-6dc5-87db-4b3ebc4b9a73')).toBe(true)
      expect(result.addedKeywords.get('3472f70b-874f-6dc5-87db-4b3ebc4b9a73')).toEqual({
        oldPath: undefined,
        newPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > SHORELINES > NEW SHORELINES'
      })
    })

    test('should identify removed keywords', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      expect(result.removedKeywords).toBeInstanceOf(Map)
      expect(result.removedKeywords.size).toBeGreaterThan(0)

      // Check for specifically removed keywords
      // ROCKY COASTS is in published but not in draft
      expect(result.removedKeywords.has('488f4df2-712e-4fac-98d1-46ab134b84ee')).toBe(true)
      expect(result.removedKeywords.get('488f4df2-712e-4fac-98d1-46ab134b84ee')).toEqual({
        oldPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > ROCKY COASTS',
        newPath: undefined
      })

      // SHORELINE DISPLACEMENT is in published but not in draft
      expect(result.removedKeywords.has('1a740c3e-7032-4f72-93e8-d0ba343d82e0')).toBe(true)
      expect(result.removedKeywords.get('1a740c3e-7032-4f72-93e8-d0ba343d82e0')).toEqual({
        oldPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > SHORELINE DISPLACEMENT',
        newPath: undefined
      })
    })

    test('should identify changed keywords', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      expect(result.changedKeywords).toBeInstanceOf(Map)
      expect(result.changedKeywords.size).toBeGreaterThan(0)

      // MARINE MAGNETICS changed to MARINE MAGNETICS MODIFIED
      expect(result.changedKeywords.has('7863ce31-0e06-42a5-bcf8-25981c44dec8')).toBe(true)
      expect(result.changedKeywords.get('7863ce31-0e06-42a5-bcf8-25981c44dec8')).toEqual({
        oldPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS',
        newPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS MODIFIED'
      })

      // DIAGENESIS changed to DIAGENESIS MODIFIED
      expect(result.changedKeywords.has('4bfed15d-b8b4-4fb1-940b-ef342c4c2225')).toBe(true)
      expect(result.changedKeywords.get('4bfed15d-b8b4-4fb1-940b-ef342c4c2225')).toEqual({
        oldPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS > DIAGENESIS',
        newPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS > DIAGENESIS MODIFIED'
      })
    })

    test('should not flag unchanged keywords', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      // AQUACULTURE should not be in any change set as it's unchanged
      const aquacultureUuid = 'f6c057c9-c789-4cd5-ba22-e9b08aae152b'

      expect(result.addedKeywords.has(aquacultureUuid)).toBe(false)
      expect(result.removedKeywords.has(aquacultureUuid)).toBe(false)
      expect(result.changedKeywords.has(aquacultureUuid)).toBe(false)
    })

    test('should handle comparison of identical CSVs', () => {
      const result = comparator.compare(publishedCsv, publishedCsv)

      expect(result.addedKeywords.size).toBe(0)
      expect(result.removedKeywords.size).toBe(0)
      expect(result.changedKeywords.size).toBe(0)
    })

    test('should handle comparison when draft has fewer entries', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      // Draft should have fewer entries overall
      expect(result.removedKeywords.size).toBeGreaterThan(0)
    })

    test('should correctly categorize all changes', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      // Total changes should account for differences
      const totalChanges = result.addedKeywords.size
                          + result.removedKeywords.size
                          + result.changedKeywords.size

      expect(totalChanges).toBeGreaterThan(0)

      // Verify no UUID appears in multiple categories
      const addedUuids = Array.from(result.addedKeywords.keys())
      const removedUuids = Array.from(result.removedKeywords.keys())
      const changedUuids = Array.from(result.changedKeywords.keys())

      const allUuids = [...addedUuids, ...removedUuids, ...changedUuids]
      const uniqueUuids = new Set(allUuids)

      expect(allUuids.length).toBe(uniqueUuids.size)
    })
  })

  describe('getSummary', () => {
    test('should return correct counts for all change types', () => {
      const result = comparator.compare(publishedCsv, draftCsv)
      const summary = comparator.getSummary(result)

      expect(summary).toHaveProperty('addedCount')
      expect(summary).toHaveProperty('removedCount')
      expect(summary).toHaveProperty('changedCount')

      expect(summary.addedCount).toBeGreaterThan(0)
      expect(summary.removedCount).toBeGreaterThan(0)
      expect(summary.changedCount).toBeGreaterThan(0)

      expect(summary.addedCount).toBe(result.addedKeywords.size)
      expect(summary.removedCount).toBe(result.removedKeywords.size)
      expect(summary.changedCount).toBe(result.changedKeywords.size)
    })

    test('should return zero counts for identical CSVs', () => {
      const result = comparator.compare(publishedCsv, publishedCsv)
      const summary = comparator.getSummary(result)

      expect(summary.addedCount).toBe(0)
      expect(summary.removedCount).toBe(0)
      expect(summary.changedCount).toBe(0)
    })
  })

  describe('toJSON', () => {
    test('should convert Maps to plain objects', () => {
      const result = comparator.compare(publishedCsv, draftCsv)
      const json = comparator.toJSON(result)

      expect(json).toHaveProperty('addedKeywords')
      expect(json).toHaveProperty('removedKeywords')
      expect(json).toHaveProperty('changedKeywords')

      expect(json.addedKeywords).not.toBeInstanceOf(Map)
      expect(json.removedKeywords).not.toBeInstanceOf(Map)
      expect(json.changedKeywords).not.toBeInstanceOf(Map)

      expect(typeof json.addedKeywords).toBe('object')
      expect(typeof json.removedKeywords).toBe('object')
      expect(typeof json.changedKeywords).toBe('object')
    })

    test('should preserve all data in JSON conversion', () => {
      const result = comparator.compare(publishedCsv, draftCsv)
      const json = comparator.toJSON(result)

      // Check that specific changes are preserved
      expect(json.addedKeywords['3472f70b-874f-6dc5-87db-4b3ebc4b9a73']).toEqual({
        oldPath: undefined,
        newPath: 'EARTH SCIENCE > OCEANS > COASTAL PROCESSES > SHORELINES > NEW SHORELINES'
      })

      expect(json.changedKeywords['7863ce31-0e06-42a5-bcf8-25981c44dec8']).toEqual({
        oldPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS',
        newPath: 'EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE MAGNETICS MODIFIED'
      })
    })

    test('should be serializable to JSON string', () => {
      const result = comparator.compare(publishedCsv, draftCsv)
      const json = comparator.toJSON(result)

      expect(() => JSON.stringify(json)).not.toThrow()

      const jsonString = JSON.stringify(json, null, 2)
      expect(jsonString).toContain('addedKeywords')
      expect(jsonString).toContain('removedKeywords')
      expect(jsonString).toContain('changedKeywords')
    })
  })

  describe('edge cases', () => {
    test('should handle CSV with only header rows', () => {
      const headerOnlyCsv = '"Keyword Version: 23.4"\n"Category","Topic","UUID"'
      const result = comparator.parseCsvContent(headerOnlyCsv)

      expect(result.size).toBe(0)
    })

    test('should treat all published keywords as deleted when draft is empty', () => {
      // This simulates when a scheme is not found in draft (renamed or deleted)
      const result = comparator.compare(publishedCsv, '')

      // All published keywords should be marked as removed
      expect(result.removedKeywords.size).toBeGreaterThan(0)
      expect(result.addedKeywords.size).toBe(0)
      expect(result.changedKeywords.size).toBe(0)

      // Verify some specific keywords are marked as removed
      expect(result.removedKeywords.has('f6c057c9-c789-4cd5-ba22-e9b08aae152b')).toBe(true) // AQUACULTURE
      expect(result.removedKeywords.get('f6c057c9-c789-4cd5-ba22-e9b08aae152b')).toEqual({
        oldPath: 'EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > AQUACULTURE',
        newPath: undefined
      })

      // Verify the count matches the total number of published keywords
      const publishedRecords = comparator.parseCsvContent(publishedCsv)
      expect(result.removedKeywords.size).toBe(publishedRecords.size)
    })

    test('should handle custom skip header rows', () => {
      const customComparator = new CsvComparator(1, ' > ')
      const result = customComparator.parseCsvContent(publishedCsv)

      // With only 1 skipped row, we'd include the column header row
      expect(result.size).toBeGreaterThan(0)
    })

    test('should handle concepts with special characters in paths', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // BATHYMETRY/SEAFLOOR TOPOGRAPHY has a forward slash
      expect(result.get('c16bda61-353b-4668-af2f-bbb98785b6fa')).toBe(
        'EARTH SCIENCE > OCEANS > BATHYMETRY/SEAFLOOR TOPOGRAPHY'
      )
    })

    test('should handle UUIDs in different formats', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Verify various UUID formats are handled
      const uuids = Array.from(result.keys())

      uuids.forEach((uuid) => {
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      })
    })

    test('should handle empty path elements correctly', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Concepts with empty fields should not have extra separators
      const path = result.get('91697b7d-8f2b-4954-850e-61d5f61c867d')
      expect(path).not.toContain(' >  > ')
      expect(path).not.toMatch(/>\s+>/)
    })

    test('should maintain path order correctly', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Verify hierarchical path order: Category > Topic > Term > Variable_Level_1
      const coralBleachingPath = result.get('f5df87b6-ed50-4da0-9ba5-7ce4c907bdb3')
      const pathParts = coralBleachingPath.split(' > ')

      expect(pathParts[0]).toBe('EARTH SCIENCE')
      expect(pathParts[1]).toBe('OCEANS')
      expect(pathParts[2]).toBe('COASTAL PROCESSES')
      expect(pathParts[3]).toBe('CORAL REEFS')
      expect(pathParts[4]).toBe('CORAL BLEACHING')
    })
  })

  describe('real-world scenarios', () => {
    test('should detect eds-favorite-ocean custom keyword', () => {
      const publishedRecords = comparator.parseCsvContent(publishedCsv)
      const draftRecords = comparator.parseCsvContent(draftCsv)
      const customKeywordUuid = '1110aecb-34ad-4e4b-94c0-3f2e8333fb2f'

      expect(publishedRecords.has(customKeywordUuid)).toBe(true)
      expect(draftRecords.has(customKeywordUuid)).toBe(true)
      expect(publishedRecords.get(customKeywordUuid)).toBe(
        'EARTH SCIENCE > OCEANS > eds-favorite-ocean'
      )
    })

    test('should handle complex marine environment hierarchy', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      // Parent: MARINE SURFACE ELEMENTS
      const parentPath = result.get('e6c6507d-59dd-49f4-9afa-bb7393a718c6')
      expect(parentPath).toBe(
        'EARTH SCIENCE > OCEANS > MARINE ENVIRONMENT MONITORING > MARINE SURFACE ELEMENTS'
      )

      // Child: MARINE VESSELS
      const childPath = result.get('f81de12c-5f0c-4027-8ff1-de84d1bacb60')
      expect(childPath).toBe(
        'EARTH SCIENCE > OCEANS > MARINE ENVIRONMENT MONITORING > MARINE SURFACE ELEMENTS > MARINE VESSELS'
      )

      // Verify parent is substring of child
      expect(childPath.startsWith(parentPath)).toBe(true)
    })

    test('should identify version-specific differences', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      // Draft has modifications not in published
      expect(result.changedKeywords.size).toBeGreaterThan(0)

      // Published has entries not in draft
      expect(result.removedKeywords.size).toBeGreaterThan(0)

      // Draft may have new entries
      expect(result.addedKeywords.size).toBeGreaterThan(0)
    })

    test('should handle all bathymetry concepts correctly', () => {
      const result = comparator.parseCsvContent(publishedCsv)

      const bathymetryUuids = [
        'c16bda61-353b-4668-af2f-bbb98785b6fa', // BATHYMETRY/SEAFLOOR TOPOGRAPHY
        '0b011562-ee55-4ba0-a026-4faa7493ca5b', // ABYSSAL HILLS/PLAINS
        '80d79c7e-6c64-4ada-bfcc-4093969758a5', // BATHYMETRY
        'd80c015f-a383-4883-8309-6aab1c39f5b6', // COASTAL BATHYMETRY
        'a91a00f7-05ed-4633-9fac-1772a48b6342', // CONTINENTAL MARGINS
        '58c12630-a889-44c1-a951-56bbbe9758c9', // FRACTURE ZONES
        '73e02157-9df9-415f-93fc-cb457989ddb1', // OCEAN PLATEAUS/RIDGES
        'b6b51058-1111-4498-a9ac-e1515270fb27', // SEAFLOOR TOPOGRAPHY
        '83520258-413c-4842-93c0-58a23dc58638', // SEAMOUNTS
        '8b22d265-0f46-46c1-b307-1957527c13bb', // SUB-BOTTOM PROFILE
        '18ce5577-26e9-4b76-860b-1ba31cafa9d0', // SUBMARINE CANYONS
        '36040c6a-5e3a-49fe-b519-162fb77a0fd4', // TRENCHES
        'ca477721-473b-40d7-a72b-4ffa963e48fb' // WATER DEPTH
      ]

      bathymetryUuids.forEach((uuid) => {
        expect(result.has(uuid)).toBe(true)
        const path = result.get(uuid)
        expect(path).toContain('BATHYMETRY')
      })
    })

    test('should detect all coastal process changes between versions', () => {
      const result = comparator.compare(publishedCsv, draftCsv)

      // Count coastal process related changes
      const coastalChanges = Array.from(result.changedKeywords.values())
        .filter((change) => change.oldPath?.includes('COASTAL PROCESSES')
          || change.newPath?.includes('COASTAL PROCESSES'))

      const coastalAdditions = Array.from(result.addedKeywords.values())
        .filter((change) => change.newPath?.includes('COASTAL PROCESSES'))

      const coastalRemovals = Array.from(result.removedKeywords.values())
        .filter((change) => change.oldPath?.includes('COASTAL PROCESSES'))

      expect(coastalChanges.length + coastalAdditions.length + coastalRemovals.length)
        .toBeGreaterThan(0)
    })
  })

  describe('performance', () => {
    test('should parse large CSV efficiently', () => {
      const startTime = Date.now()
      comparator.parseCsvContent(publishedCsv)
      const endTime = Date.now()

      // Should complete in reasonable time (< 100ms for ~75 rows)
      expect(endTime - startTime).toBeLessThan(100)
    })

    test('should compare CSVs efficiently', () => {
      const startTime = Date.now()
      comparator.compare(publishedCsv, draftCsv)
      const endTime = Date.now()

      // Should complete in reasonable time (< 200ms)
      expect(endTime - startTime).toBeLessThan(200)
    })

    test('should handle repeated parsing without memory issues', () => {
      const iterations = 100

      for (let i = 0; i < iterations; i += 1) {
        comparator.parseCsvContent(publishedCsv)
      }

      // If we get here without crashing, memory handling is acceptable
      expect(true).toBe(true)
    })
  })
})
