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
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

import { publish } from '../handler'

// Mock the imported functions
vi.mock('@/shared/copyGraph')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/renameGraph')
vi.mock('@/shared/updateVersionMetadata')

vi.mock('@/shared/transactionHelpers', () => ({
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn()
}))

describe('publish handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    startTransaction.mockResolvedValue('mock-transaction-url')
  })

  describe('when successful', () => {
    test('should successfully publish a new version', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockResolvedValue(null)
      copyGraph.mockResolvedValue()
      updateVersionMetadata.mockResolvedValue()

      const result = await publish(event)

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe('Publish process completed for version new_version')
      expect(copyGraph).toHaveBeenCalledWith({
        sourceGraphName: 'draft',
        targetGraphName: 'published',
        transactionUrl: 'mock-transaction-url'
      })

      expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        graphId: 'published',
        version: 'new_version',
        versionType: 'published',
        transactionUrl: 'mock-transaction-url'
      }))

      expect(commitTransaction).toHaveBeenCalledWith('mock-transaction-url')
    })

    test('should rename existing published graph when it exists', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockResolvedValue({ versionName: 'old_version' })
      renameGraph.mockResolvedValue()
      updateVersionMetadata.mockResolvedValue()
      copyGraph.mockResolvedValue()

      await publish(event)

      expect(renameGraph).toHaveBeenCalledWith({
        oldGraphName: 'published',
        newGraphName: 'old_version',
        transactionUrl: 'mock-transaction-url'
      })

      expect(updateVersionMetadata).toHaveBeenCalledWith({
        graphId: 'old_version',
        versionType: 'past_published',
        transactionUrl: 'mock-transaction-url'
      })

      expect(commitTransaction).toHaveBeenCalledWith('mock-transaction-url')
    })
  })

  describe('when unsuccessful', () => {
    test('should return a 400 error when name is not provided', async () => {
      const event = {}
      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
    })

    test('should handle errors during the publish process', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockRejectedValue(new Error('Database error'))

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error in publish process')
      expect(console.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
      expect(startTransaction).toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith('mock-transaction-url')
      expect(commitTransaction).not.toHaveBeenCalled()
    })

    test('should rollback transaction if an error occurs during publish process', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockResolvedValue(null)
      copyGraph.mockRejectedValue(new Error('Copy failed'))

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error in publish process')
      expect(startTransaction).toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith('mock-transaction-url')
      expect(commitTransaction).not.toHaveBeenCalled()
    })
  })
})
