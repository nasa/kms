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
    vi.useFakeTimers()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('when publishing a draft', () => {
    test('should initiate the publish process and return immediately', async () => {
      const event = { body: { name: 'new_version' } }
      const result = await publish(event)

      expect(result.statusCode).toBe(202)
      expect(JSON.parse(result.body).message).toBe('Publish process initiated for version new_version')
    })

    test('should start the publish process asynchronously', async () => {
      const event = { body: { name: 'new_version' } }
      await publish(event)

      // Run all pending timers
      await vi.runAllTimersAsync()

      expect(getVersionMetadata).toHaveBeenCalledWith('published')
      expect(copyGraph).toHaveBeenCalledWith({
        sourceGraphName: 'draft',
        targetGraphName: 'published'
      })

      expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        graphId: 'published',
        version: 'new_version',
        versionType: 'published'
      }))
    })

    test('should rename existing published graph when it exists', async () => {
      getVersionMetadata.mockResolvedValue({ versionName: 'old_version' })
      const event = { body: { name: 'new_version' } }
      await publish(event)

      // Run all pending timers
      await vi.runAllTimersAsync()

      expect(renameGraph).toHaveBeenCalledWith({
        oldGraphName: 'published',
        newGraphName: 'old_version'
      })

      expect(updateVersionMetadata).toHaveBeenCalledWith({
        graphId: 'old_version',
        versionType: 'past_published'
      })
    })
  })

  describe('when errors occur', () => {
    test('should return a 400 error when name is not provided', async () => {
      const event = { body: {} }
      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
    })

    test('should log errors that occur during the publish process', async () => {
      getVersionMetadata.mockRejectedValue(new Error('Database error'))

      const event = { body: { name: 'new_version' } }
      await publish(event)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(console.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })
  })
})
