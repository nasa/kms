import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import getConceptSchemes from '@/getConceptSchemes/handler'

import { createConceptSchemeMap } from '../createConceptSchemeMap'

// Mock the getConceptSchemes function
vi.mock('@/getConceptSchemes/handler')

describe('createConceptSchemeMap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('when getConceptSchemes returns valid XML', () => {
    test('should create a Map with short names as keys and long names as values', async () => {
      const mockXml = `
        <schemes>
          <scheme name="scienceKeywords" longName="Science Keywords"/>
          <scheme name="platforms" longName="Platforms"/>
        </schemes>
      `
      getConceptSchemes.mockResolvedValue({ body: mockXml })

      const result = await createConceptSchemeMap()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('scienceKeywords')).toBe('Science Keywords')
      expect(result.get('platforms')).toBe('Platforms')
    })
  })

  describe('when getConceptSchemes throws an error', () => {
    test('should throw an error', async () => {
      getConceptSchemes.mockRejectedValue(new Error('Failed to fetch concept schemes'))

      await expect(createConceptSchemeMap()).rejects.toThrow('Failed to fetch concept schemes')
    })
  })

  describe('when getConceptSchemes returns invalid XML', () => {
    test('should throw an error', async () => {
      const mockInvalidXml = '<invalid>xml</invalid>'
      getConceptSchemes.mockResolvedValue({ body: mockInvalidXml })

      await expect(createConceptSchemeMap()).rejects.toThrow()
    })
  })
})
