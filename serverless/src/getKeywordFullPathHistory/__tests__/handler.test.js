import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { buildFullPath } from '@/shared/buildFullPath'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionNames } from '@/shared/getVersionNames'

import { getKeywordFullPathHistory } from '../handler'

// Mock the dependencies
vi.mock('@/shared/buildFullPath')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getVersionNames')

describe('getKeywordFullPathHistory', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()
  })

  test('should return keyword full path history successfully', async () => {
    // Mock the dependencies
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: { 'Content-Type': 'application/json' } })
    getVersionNames.mockResolvedValue(['v1', 'v2', 'v3'])
    buildFullPath.mockImplementation((uuid, version) => Promise.resolve(`/path/to/${uuid}/${version}`))

    const event = {
      pathParameters: {
        uuid: '123e4567-e89b-12d3-a456-426614174000'
      }
    }

    const response = await getKeywordFullPathHistory(event)

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      KeywordVersionReport: [
        {
          Version: 'v1',
          FullPath: '/path/to/123e4567-e89b-12d3-a456-426614174000/v1'
        },
        {
          Version: 'v2',
          FullPath: '/path/to/123e4567-e89b-12d3-a456-426614174000/v2'
        },
        {
          Version: 'v3',
          FullPath: '/path/to/123e4567-e89b-12d3-a456-426614174000/v3'
        }
      ]
    })

    expect(response.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  test('should handle errors and return a 500 status code', async () => {
    // Mock the dependencies to throw an error
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: { 'Content-Type': 'application/json' } })
    getVersionNames.mockRejectedValue(new Error('Failed to get version names'))

    const event = {
      pathParameters: {
        uuid: '123e4567-e89b-12d3-a456-426614174000'
      }
    }

    const response = await getKeywordFullPathHistory(event)

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Error: Failed to get version names'
    })

    expect(response.headers).toEqual({ 'Content-Type': 'application/json' })
  })
})
