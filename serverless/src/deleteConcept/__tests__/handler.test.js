import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { deleteConcept } from '@/deleteConcept/handler'
import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { getApplicationConfig } from '@/shared/getConfig'

// Mock the dependencies
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/conceptIdExists')

describe('deleteConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockEvent = {
    pathParameters: { conceptId: '123' }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  describe('when successful', () => {
    test('should successfully delete a concept', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({ ok: true })

      const result = await deleteConcept(mockEvent)

      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully deleted concept: 123' }),
        headers: mockDefaultHeaders
      })
    })

    test('should use correct conceptIRI format', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({ deleteResponse: { ok: true } })

      await deleteConcept(mockEvent)

      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
    })
  })

  describe('when unsuccessful', () => {
    test('should return 404 if concept does not exist', async () => {
      conceptIdExists.mockResolvedValue(false)

      const result = await deleteConcept(mockEvent)

      expect(conceptIdExists).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(deleteTriples).not.toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ message: 'Concept not found: 123' }),
        headers: mockDefaultHeaders
      })
    })

    test('should return 500 if deleteTriples fails', async () => {
      const mockError = new Error('Delete failed')
      deleteTriples.mockRejectedValue(mockError)
      conceptIdExists.mockResolvedValue(true)

      const result = await deleteConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error deleting concept',
          error: 'Delete failed'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should return 500 if deleteTriples returns non-ok response', async () => {
      deleteTriples.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      })

      conceptIdExists.mockResolvedValue(true)

      const result = await deleteConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error deleting concept',
          error: 'HTTP error! status: 400'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle missing conceptId', async () => {
      const eventWithoutConceptId = { pathParameters: {} }

      conceptIdExists.mockResolvedValue(true)
      const result = await deleteConcept(eventWithoutConceptId)

      expect(result).toMatchObject({
        statusCode: 500,
        headers: mockDefaultHeaders
      })

      const body = JSON.parse(result.body)
      expect(body).toHaveProperty('message', 'Error deleting concept')
      expect(body).toHaveProperty('error')
      expect(typeof body.error).toBe('string')
    })
  })
})
