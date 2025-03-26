import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'

import { publish } from '../../publish/handler'
import triggerPublish from '../handler'

// Mock the dependencies
vi.mock('@/shared/getConfig')
vi.mock('../../publish/handler')

describe('triggerPublish', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.IS_OFFLINE = 'false'
    process.env.PUBLISH_STATE_MACHINE_ARN = 'test-arn'

    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'Content-Type': 'application/json' }
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    // Set up the spy on SFNClient.prototype.send
    vi.spyOn(SFNClient.prototype, 'send').mockResolvedValue({ executionArn: 'test-execution-arn' })
  })

  it('should return 400 if name is not provided', async () => {
    const event = { body: JSON.stringify({}) }
    const result = await triggerPublish(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
  })

  it('should call publish function directly when offline', async () => {
    process.env.IS_OFFLINE = 'true'
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    publish.mockResolvedValue({ status: 'success' })

    const result = await triggerPublish(event)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).message).toContain('Publish process completed')
    expect(publish).toHaveBeenCalledWith({ name: 'test-version' })
  })

  it('should handle errors in offline mode', async () => {
    process.env.IS_OFFLINE = 'true'
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    publish.mockRejectedValue(new Error('Test error'))

    const result = await triggerPublish(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toContain('Error in publish process')
  })

  it('should trigger Step Function when not offline', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    SFNClient.prototype.send.mockResolvedValue({ executionArn: 'test-execution-arn' })

    const result = await triggerPublish(event)

    expect(result.statusCode).toBe(202)
    expect(JSON.parse(result.body).message).toContain('Publish process initiated')
    expect(JSON.parse(result.body).executionArn).toBe('test-execution-arn')
    expect(SFNClient.prototype.send).toHaveBeenCalledWith(expect.any(StartExecutionCommand))
  })

  it('should handle Step Function execution errors', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    SFNClient.prototype.send.mockRejectedValue(new Error('Test error'))

    const result = await triggerPublish(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toContain('Error initiating publish process')
  })
})
