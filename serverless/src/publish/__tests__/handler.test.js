import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

import { publish } from '../handler'

// Mock the imported functions
vi.mock('@/shared/copyGraph')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/renameGraph')
vi.mock('@/shared/updateVersionMetadata')

describe('publish handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('when publishing a draft', () => {
    describe('when published version exists', () => {
      test('should copy published graph to past_published graph and copy draft to published', async () => {
        getVersionMetadata.mockResolvedValue({ versionName: 'old_version' })

        const event = { queryStringParameters: { name: 'new_version' } }
        const result = await publish(event)

        expect(renameGraph).toHaveBeenCalledWith({
          oldGraphName: 'published',
          newGraphName: 'old_version'
        })

        expect(updateVersionMetadata).toHaveBeenCalledWith({
          graphId: 'old_version',
          versionType: 'past_published'
        })

        expect(copyGraph).toHaveBeenCalledWith({
          sourceGraphName: 'draft',
          targetGraphName: 'published'
        })

        expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
          graphId: 'published',
          version: 'new_version',
          versionType: 'published'
        }))

        expect(result.statusCode).toBe(200)
      })
    })

    describe('when published version does not exist', () => {
      test('should just copy draft graph to published graph', async () => {
        getVersionMetadata.mockResolvedValue(null)

        const event = { queryStringParameters: { name: 'new_version' } }
        const result = await publish(event)

        expect(renameGraph).not.toHaveBeenCalled()
        expect(copyGraph).toHaveBeenCalledWith({
          sourceGraphName: 'draft',
          targetGraphName: 'published'
        })

        expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
          graphId: 'published',
          version: 'new_version',
          versionType: 'published'
        }))

        expect(result.statusCode).toBe(200)
      })
    })
  })

  describe('when errors occur', () => {
    test('should return a 400 error when name is not provided', async () => {
      const event = { queryStringParameters: {} }
      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
    })

    test('should return a 500 error when an operation fails', async () => {
      getVersionMetadata.mockRejectedValue(new Error('Database error'))

      const event = { queryStringParameters: { name: 'new_version' } }
      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toContain('Error publishing draft to new_version')
    })
  })
})
