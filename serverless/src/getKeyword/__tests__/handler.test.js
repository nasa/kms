// GetKeyword.test.js
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSkosConcept } from '@/shared/getSkosConcept'
import { toKeywordJson } from '@/shared/toKeywordJson'

import getKeyword from '../handler'

// Mock the imported functions
vi.mock('@/shared/createConceptSchemeMap', () => ({
  createConceptSchemeMap: vi.fn()
}))

vi.mock('@/shared/createPrefLabelMap', () => ({
  createPrefLabelMap: vi.fn()
}))

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'Content-Type': 'application/json' }
  }))
}))

vi.mock('@/shared/getSkosConcept', () => ({
  getSkosConcept: vi.fn()
}))

vi.mock('@/shared/toKeywordJson', () => ({
  toKeywordJson: vi.fn()
}))

describe('getKeyword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 404 if concept is null', async () => {
    const event = {
      pathParameters: { conceptId: 'nonexistent' }
    }

    vi.mocked(getSkosConcept).mockResolvedValue(null)

    const result = await getKeyword(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({ error: 'Keyword not found' })
  })

  it('should return 200 with keyword data if concept exists', async () => {
    const event = {
      pathParameters: { conceptId: 'existingConcept' }
    }

    const mockConcept = { id: 'existingConcept' }
    const mockKeywordJson = { keyword: 'Test Keyword' }

    vi.mocked(getSkosConcept).mockResolvedValue(mockConcept)
    vi.mocked(createPrefLabelMap).mockResolvedValue({})
    vi.mocked(createConceptSchemeMap).mockResolvedValue({})
    vi.mocked(toKeywordJson).mockResolvedValue(mockKeywordJson)

    const result = await getKeyword(event)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual(mockKeywordJson)
  })

  it('should return 500 if an error occurs', async () => {
    const event = {
      pathParameters: { conceptId: 'errorConcept' }
    }

    vi.mocked(getSkosConcept).mockRejectedValue(new Error('Test error'))

    const result = await getKeyword(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Test error' })
  })
})
