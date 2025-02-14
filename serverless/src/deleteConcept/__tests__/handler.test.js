import {
  describe,
  test,
  expect,
  vi,
  beforeEach
} from 'vitest'
import deleteConcept from '../handler'
import deleteTriples from '../../utils/deleteTriples'
import { getApplicationConfig } from '../../utils/getConfig'

// Mock the dependencies
vi.mock('../../utils/deleteTriples')
vi.mock('../../utils/getConfig')

describe('deleteConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockEvent = {
    pathParameters: { conceptId: '123' }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  test('should successfully delete a concept', async () => {
    deleteTriples.mockResolvedValue({ deleteResponse: { ok: true } })

    const result = await deleteConcept(mockEvent)

    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully deleted concept: 123' }),
      headers: mockDefaultHeaders
    })
  })

  test('should return 500 if deleteTriples fails', async () => {
    const mockError = new Error('Delete failed')
    deleteTriples.mockRejectedValue(mockError)

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
      deleteResponse: {
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      }
    })

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

  test('should use correct conceptIRI format', async () => {
    deleteTriples.mockResolvedValue({ deleteResponse: { ok: true } })

    await deleteConcept(mockEvent)

    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
  })
})
