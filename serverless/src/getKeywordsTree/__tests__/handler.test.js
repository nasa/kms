import { format } from 'date-fns'
import {
  describe,
  expect,
  vi
} from 'vitest'

import { buildKeywordsTree } from '@/shared/buildKeywordsTree'
import { filterKeywordTree } from '@/shared/filterKeywordTree'
import { filterScienceKeywordsTree } from '@/shared/filterScienceKeywordsTree'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getNarrowersMap } from '@/shared/getNarrowersMap'
import { getRootConceptForScheme } from '@/shared/getRootConceptForScheme'
import { getRootConceptsForAllSchemes } from '@/shared/getRootConceptsForAllSchemes'
import { sortKeywordNodes } from '@/shared/sortKeywordNodes'
import { keywordSchemeSequence, sortKeywordSchemes } from '@/shared/sortKeywordSchemes'
import { toTitleCase } from '@/shared/toTitleCase'

import { getKeywordsTree } from '../handler'

// Mock dependencies
vi.mock('@/shared/buildKeywordsTree')
vi.mock('@/shared/filterKeywordTree')
vi.mock('@/shared/filterScienceKeywordsTree')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getNarrowersMap')
vi.mock('@/shared/getRootConceptForScheme')
vi.mock('@/shared/getRootConceptsForAllSchemes')
vi.mock('@/shared/sortKeywordNodes')
vi.mock('@/shared/sortKeywordSchemes')
vi.mock('@/shared/toTitleCase')
vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

// Mock the entire sortKeywordSchemes module
vi.mock('@/shared/sortKeywordSchemes', () => ({
  keywordSchemeSequence: ['Earth Science', 'Platforms', 'Instruments'],
  sortKeywordSchemes: vi.fn((a, b) => {
    const sequence = ['Earth Science', 'Platforms', 'Instruments']

    return sequence.indexOf(a.title) - sequence.indexOf(b.title)
  })
}))

describe('getKeywordsTree', () => {
  describe('When successful', () => {
    test('should handle "all" concept scheme correctly', async () => {
      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptsForAllSchemes).mockResolvedValue([
        {
          prefLabel: { value: 'Science Keywords' },
          subject: { value: 'uri1' }
        },
        {
          prefLabel: { value: 'Other Keyword' },
          subject: { value: 'uri2' }
        }
      ])

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Mocked Tree',
        children: [{
          title: 'Child',
          children: []
        }]
      })

      vi.mocked(getConceptSchemeDetails).mockResolvedValue([
        {
          notation: 'sciencekeywords',
          prefLabel: 'Science Keywords'
        },
        {
          notation: 'other',
          prefLabel: 'Other'
        }
      ])

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })
      vi.mocked(sortKeywordNodes).mockImplementation((arr) => arr)
      vi.mocked(sortKeywordSchemes).mockImplementation(() => 0)
      vi.mocked(toTitleCase).mockImplementation((str) => str)

      const event = {
        pathParameters: { conceptScheme: 'all' },
        queryStringParameters: {}
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('versions')
      expect(parsedBody).toHaveProperty('tree')
      expect(parsedBody.tree.scheme).toBe('all')
      expect(parsedBody.tree.treeData).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].title).toBe('Keywords')
      expect(parsedBody.versions[0].schemes).toHaveLength(3) // 2 for Science Keywords, 1 for Other
    })

    test('should handle "Earth Science" concept scheme correctly', async () => {
      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptForScheme).mockResolvedValue({
        prefLabel: { value: 'Earth Science' },
        subject: { value: 'uri1' }
      })

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Earth Science',
        children: [{
          title: 'Atmosphere',
          children: []
        }]
      })

      vi.mocked(filterScienceKeywordsTree).mockImplementation((tree) => tree)

      vi.mocked(getConceptSchemeDetails).mockResolvedValue([
        {
          notation: 'sciencekeywords',
          prefLabel: 'Science Keywords'
        }
      ])

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })

      const event = {
        pathParameters: { conceptScheme: 'Earth Science' },
        queryStringParameters: {}
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('versions')
      expect(parsedBody).toHaveProperty('tree')
      expect(parsedBody.tree.scheme).toBe('Earth Science')
      expect(parsedBody.tree.treeData).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].title).toBe('Keywords')
      expect(parsedBody.tree.treeData[0].children).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].children[0].title).toBe('Earth Science')
      expect(parsedBody.versions[0].schemes).toHaveLength(2) // Earth Science and Earth Science Services
      expect(parsedBody.versions[0].schemes[0].scheme).toBe('Earth Science')
      expect(parsedBody.versions[0].schemes[1].scheme).toBe('Earth Science Services')

      // Verify that filterScienceKeywordsTree was called
      expect(filterScienceKeywordsTree).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Earth Science' }),
        'Earth Science'
      )

      // Verify that getNarrowersMap was called with 'sciencekeywords'
      expect(getNarrowersMap).toHaveBeenCalledWith('sciencekeywords')

      // Verify that the timestamp is in the correct format
      const { timestamp } = parsedBody.tree
      expect(() => format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')).not.toThrow()
    })

    test('should handle "instruments" concept scheme correctly', async () => {
      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptForScheme).mockResolvedValue({
        prefLabel: { value: 'Instruments' },
        subject: { value: 'uri1' }
      })

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Instruments',
        children: [{
          title: 'Sensor',
          children: []
        }]
      })

      vi.mocked(getConceptSchemeDetails).mockResolvedValue([
        {
          notation: 'instruments',
          prefLabel: 'Instruments'
        }
      ])

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: {}
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('versions')
      expect(parsedBody).toHaveProperty('tree')
      expect(parsedBody.tree.scheme).toBe('instruments')
      expect(parsedBody.tree.treeData).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].title).toBe('Keywords')
      expect(parsedBody.tree.treeData[0].children).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].children[0].title).toBe('Instruments')
      expect(parsedBody.versions[0].schemes).toHaveLength(1)
      expect(parsedBody.versions[0].schemes[0].scheme).toBe('instruments')
      expect(parsedBody.versions[0].schemes[0].longName).toBe('Instruments')

      // Verify that getNarrowersMap was called with 'instruments'
      expect(getNarrowersMap).toHaveBeenCalledWith('instruments')

      // Verify that getRootConceptForScheme was called with 'instruments'
      expect(getRootConceptForScheme).toHaveBeenCalledWith('instruments')

      // Verify that the timestamp is in the correct format
      const { timestamp } = parsedBody.tree
      expect(() => format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')).not.toThrow()
    })

    test('should apply filter when provided', async () => {
      const filterPattern = 'atmosphere'

      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptForScheme).mockResolvedValue({
        prefLabel: { value: 'Earth Science' },
        subject: { value: 'uri1' }
      })

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Earth Science',
        children: [{
          title: 'Atmosphere',
          children: []
        }]
      })

      vi.mocked(filterScienceKeywordsTree).mockImplementation((tree) => tree)
      vi.mocked(filterKeywordTree).mockImplementation((tree, filter) => ({
        ...tree,
        filtered: filter
      }))

      vi.mocked(getConceptSchemeDetails).mockResolvedValue([
        {
          notation: 'sciencekeywords',
          prefLabel: 'Science Keywords'
        }
      ])

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })

      const event = {
        pathParameters: { conceptScheme: 'Earth Science' },
        queryStringParameters: { filter: filterPattern }
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)

      // Verify that filterKeywordTree was called with the correct arguments
      expect(filterKeywordTree).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Earth Science' }),
        filterPattern
      )

      // Check if the filtered property is present in the result
      expect(parsedBody.tree.treeData[0].children[0]).toHaveProperty('filtered', filterPattern)
    })

    test('should handle "all" concept scheme with filter correctly', async () => {
      const filterPattern = 'water'

      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptsForAllSchemes).mockResolvedValue([
        {
          prefLabel: { value: 'Science Keywords' },
          subject: { value: 'uri1' }
        },
        {
          prefLabel: { value: 'Other Keyword' },
          subject: { value: 'uri2' }
        }
      ])

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Mocked Tree',
        children: [{
          title: 'Water',
          children: []
        }]
      })

      vi.mocked(filterKeywordTree).mockImplementation((tree, filter) => ({
        ...tree,
        filtered: filter
      }))

      vi.mocked(getConceptSchemeDetails).mockResolvedValue([
        {
          notation: 'sciencekeywords',
          prefLabel: 'Science Keywords'
        },
        {
          notation: 'other',
          prefLabel: 'Other'
        }
      ])

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })
      vi.mocked(sortKeywordNodes).mockImplementation((arr) => arr)
      vi.mocked(sortKeywordSchemes).mockImplementation(() => 0)
      vi.mocked(toTitleCase).mockImplementation((str) => str)

      const event = {
        pathParameters: { conceptScheme: 'all' },
        queryStringParameters: { filter: filterPattern }
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('versions')
      expect(parsedBody).toHaveProperty('tree')
      expect(parsedBody.tree.scheme).toBe('all')
      expect(parsedBody.tree.treeData).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].title).toBe('Keywords')

      // Check if filterKeywordTree was called for each root concept
      expect(filterKeywordTree).toHaveBeenCalledTimes(2)

      // Check if the filtered property is present in the result
      expect(parsedBody.tree.treeData[0].children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filtered: filterPattern })
        ])
      )

      // Verify that getRootConceptsForAllSchemes was called
      expect(getRootConceptsForAllSchemes).toHaveBeenCalled()

      // Verify that getNarrowersMap was called with undefined
      expect(getNarrowersMap).toHaveBeenCalledWith(undefined)
    })
  })

  describe('When unsuccessful', () => {
    test('should handle errors and return a 500 status code', async () => {
      const errorMessage = 'Test error message'

      // Mock a function to throw an error
      vi.mocked(getNarrowersMap).mockRejectedValue(new Error(errorMessage))

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })

      // Mock console.error to capture the error log
      const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})

      const event = {
        pathParameters: { conceptScheme: 'Earth Science' },
        queryStringParameters: {}
      }

      const result = await getKeywordsTree(event)

      // Check the response structure
      expect(result.statusCode).toBe(500)
      expect(result.headers).toEqual({})

      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('error')
      expect(parsedBody.error).toContain(errorMessage)

      // Verify that the error was logged
      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining(`Error retrieving concept, error=Error: ${errorMessage}`)
      )

      // Restore console.error
      consoleErrorMock.mockRestore()
    })
  })
})
