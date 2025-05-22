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
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sortKeywordNodes } from '@/shared/sortKeywordNodes'
import { sortKeywordSchemes } from '@/shared/sortKeywordSchemes'
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
vi.mock('@/shared/getVersionMetadata')
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

vi.mocked(getVersionMetadata).mockResolvedValue({
  version: 'published',
  versionName: '20.8',
  versionType: 'published',
  created: '2023-01-01T00:00:00Z',
  modified: '2023-01-01T00:00:00Z'
})

describe('getKeywordsTree', () => {
  beforeEach(() => {
    vi.mocked(sortKeywordNodes).mockImplementation((arr) => arr)
    vi.mocked(sortKeywordSchemes).mockImplementation(() => 0)

    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('When successful', () => {
    test('should handle "all" concept scheme with Other Keywords correctly', async () => {
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

      vi.mocked(buildKeywordsTree).mockImplementation((node) => {
        if (node.prefLabel === 'Science Keywords') {
          return {
            title: 'Science Keywords',
            children: [
              {
                title: 'Earth Science',
                children: []
              },
              {
                title: 'Biological Classification',
                children: []
              }
            ]
          }
        }

        return {
          title: node.prefLabel,
          children: []
        }
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

      vi.mocked(toTitleCase).mockImplementation((str) => str)

      const event = {
        pathParameters: { conceptScheme: 'all' },
        queryStringParameters: {}
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)

      expect(parsedBody.tree.treeData).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].title).toBe('Keywords')

      const { children } = parsedBody.tree.treeData[0]
      expect(children).toHaveLength(2) // Earth Science and Other Keywords

      expect(children[0].title).toBe('Earth Science')
      expect(children[1].title).toBe('Other Keywords')

      expect(children[1].children).toHaveLength(2) // Biological Classification and Other Keyword
      expect(children[1].children[0].title).toBe('Biological Classification')
      expect(children[1].children[1].title).toBe('Other Keyword')
    })

    test('should handle missing queryStringParameters', async () => {
      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptForScheme).mockResolvedValue([{
        prefLabel: { value: 'Earth Science' },
        subject: { value: 'uri1' }
      }])

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
        pathParameters: { conceptScheme: 'Earth Science' }
        // QueryStringParameters is intentionally omitted
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

      // Verify that filterKeywordTree was not called (since there's no filter)
      expect(filterKeywordTree).not.toHaveBeenCalled()
    })

    test('should handle missing pathParameters', async () => {
      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })

      // Create an event object without pathParameters
      const event = {
        queryStringParameters: {} // This is optional and can be omitted
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(400)
      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('error')
      expect(parsedBody.error).toBe('Missing required parameters')
    })

    test('should handle missing conceptScheme in pathParameters', async () => {
      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })

      // Create an event object with empty pathParameters
      const event = {
        pathParameters: {},
        queryStringParameters: {} // This is optional and can be omitted
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(400)
      const parsedBody = JSON.parse(result.body)
      expect(parsedBody).toHaveProperty('error')
      expect(parsedBody.error).toBe('Missing conceptScheme parameter')
    })

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
      vi.mocked(getRootConceptForScheme).mockResolvedValue([{
        prefLabel: { value: 'Earth Science' },
        subject: { value: 'uri1' }
      }])

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
        {
          title: 'Earth Science',
          children: [
            {
              title: 'Atmosphere',
              children: []
            }
          ]
        },
        'Earth Science'
      )

      // Verify that getNarrowersMap was called with 'sciencekeywords'
      expect(getNarrowersMap).toHaveBeenCalledWith('sciencekeywords', 'published')

      // Verify that the timestamp is in the correct format
      const { timestamp } = parsedBody.tree
      expect(() => format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')).not.toThrow()
    })

    test('should handle "instruments" concept scheme correctly', async () => {
      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptForScheme).mockResolvedValue([{
        prefLabel: { value: 'Instruments' },
        subject: { value: 'uri1' }
      }])

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
      expect(getNarrowersMap).toHaveBeenCalledWith('instruments', 'published')

      // Verify that getRootConceptForScheme was called with 'instruments'
      expect(getRootConceptForScheme).toHaveBeenCalledWith('instruments', 'published')

      // Verify that the timestamp is in the correct format
      const { timestamp } = parsedBody.tree
      expect(() => format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')).not.toThrow()
    })

    test('should apply filter when provided', async () => {
      const filterPattern = 'atmosphere'

      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptForScheme).mockResolvedValue([{
        prefLabel: { value: 'Earth Science' },
        subject: { value: 'uri1' }
      }])

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Earth Science',
        children: [{
          title: 'Atmosphere',
          children: []
        }]
      })

      vi.mocked(filterScienceKeywordsTree).mockImplementation((tree) => tree)
      vi.mocked(filterKeywordTree).mockImplementation((tree) => ({
        ...tree,
        filtered: true
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
        expect.objectContaining({
          title: 'Earth Science',
          children: expect.any(Array)
        }),
        filterPattern
      )

      // Check the structure and content of the response
      expect(parsedBody).toHaveProperty('versions')
      expect(parsedBody).toHaveProperty('tree')

      expect(parsedBody.tree).toHaveProperty('scheme', 'Earth Science')
      expect(parsedBody.tree).toHaveProperty('version', '20.8')
      expect(parsedBody.tree).toHaveProperty('timestamp')
      expect(parsedBody.tree).toHaveProperty('treeData')

      expect(parsedBody.tree.treeData).toHaveLength(1)
      expect(parsedBody.tree.treeData[0]).toHaveProperty('key', 'keywords-uuid')
      expect(parsedBody.tree.treeData[0]).toHaveProperty('title', 'Keywords')
      expect(parsedBody.tree.treeData[0]).toHaveProperty('children')

      // Check if the filtered property is present in the result
      expect(parsedBody.tree.treeData[0].children).toHaveProperty('filtered', true)
      expect(parsedBody.tree.treeData[0].children).toHaveProperty('title', 'Earth Science')
      expect(parsedBody.tree.treeData[0].children).toHaveProperty('children')
      expect(parsedBody.tree.treeData[0].children.children).toHaveLength(1)
      expect(parsedBody.tree.treeData[0].children.children[0]).toHaveProperty('title', 'Atmosphere')
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
      expect(getNarrowersMap).toHaveBeenCalledWith(undefined, 'published')
    })

    test('should apply toTitleCase to direct descendants of Science Keywords and handle Other Keywords', async () => {
      vi.mocked(getNarrowersMap).mockResolvedValue({})
      vi.mocked(getRootConceptsForAllSchemes).mockResolvedValue([
        {
          prefLabel: { value: 'Science Keywords' },
          subject: { value: 'uri1' }
        }
      ])

      vi.mocked(buildKeywordsTree).mockResolvedValue({
        title: 'Science Keywords',
        children: [
          {
            title: 'EARTH SCIENCE',
            children: []
          },
          {
            title: 'BIOLOGICAL CLASSIFICATION',
            children: []
          },
          {
            title: 'GEOGRAPHIC REGION',
            children: []
          }
        ]
      })

      vi.mocked(getConceptSchemeDetails).mockResolvedValue([
        {
          notation: 'sciencekeywords',
          prefLabel: 'Science Keywords'
        }
      ])

      vi.mocked(getApplicationConfig).mockReturnValue({ defaultResponseHeaders: {} })
      vi.mocked(sortKeywordNodes).mockImplementation((arr) => arr)
      vi.mocked(sortKeywordSchemes).mockImplementation(() => 0)
      vi.mocked(toTitleCase).mockImplementation((str) => str.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '))

      const event = {
        pathParameters: { conceptScheme: 'all' },
        queryStringParameters: {}
      }

      const result = await getKeywordsTree(event)

      expect(result.statusCode).toBe(200)
      const parsedBody = JSON.parse(result.body)

      const keywordChildren = parsedBody.tree.treeData[0].children

      // Check that the Science Keywords node was removed
      expect(keywordChildren.some((child) => child.title === 'Science Keywords')).toBe(false)

      // Check that Earth Science is at the top level
      expect(keywordChildren).toContainEqual(expect.objectContaining({ title: 'Earth Science' }))

      // Check for the Other Keywords category
      const otherKeywords = keywordChildren.find((child) => child.title === 'Other Keywords')
      expect(otherKeywords).toBeDefined()
      expect(otherKeywords.children).toContainEqual(expect.objectContaining({ title: 'Biological Classification' }))
      expect(otherKeywords.children).toContainEqual(expect.objectContaining({ title: 'Geographic Region' }))

      // Verify that toTitleCase was called for each child
      expect(toTitleCase).toHaveBeenCalledWith('EARTH SCIENCE')
      expect(toTitleCase).toHaveBeenCalledWith('BIOLOGICAL CLASSIFICATION')
      expect(toTitleCase).toHaveBeenCalledWith('GEOGRAPHIC REGION')
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
