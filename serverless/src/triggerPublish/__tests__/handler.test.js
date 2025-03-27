import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'

import publish from '../../publish/handler'
import triggerPublish from '../handler'

// Mock the dependencies
vi.mock('@/shared/getConfig')
vi.mock('../../publish/handler')

describe('triggerPublish', () => {
  let mockLambdaSend

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.IS_OFFLINE = 'false'
    process.env.AWS_REGION = 'us-east-1'

    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'Content-Type': 'application/json' }
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    // Spy on LambdaClient and mock its send method
    mockLambdaSend = vi.fn().mockResolvedValue({})
    vi.spyOn(LambdaClient.prototype, 'send').mockImplementation(mockLambdaSend)
  })

  it('should return 400 if name is not provided', async () => {
    const event = { body: JSON.stringify({}) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }
    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
  })

  it('should call publish function directly when offline', async () => {
    process.env.IS_OFFLINE = 'true'
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }
    publish.mockResolvedValue({ status: 'success' })

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(202)
    expect(JSON.parse(result.body).message).toContain('Publish process initiated for version test-version in offline mode')
    expect(publish).toHaveBeenCalledWith({ name: 'test-version' })
  })

  it('should invoke Lambda function when not offline', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(202)
    expect(JSON.parse(result.body).message).toBe('Publish process initiated for version test-version')
    expect(mockLambdaSend).toHaveBeenCalledWith(expect.any(InvokeCommand))

    const invokeCommand = mockLambdaSend.mock.calls[0][0]
    expect(invokeCommand.input).toEqual({
      FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:kms-sit-publishHandler',
      InvocationType: 'Event',
      Payload: JSON.stringify({ name: 'test-version' })
    })
  })

  it('should handle Lambda invocation errors', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }
    mockLambdaSend.mockRejectedValue(new Error('Test error'))

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toBe('Error initiating publish process')
    expect(JSON.parse(result.body).errorDetails).toEqual({
      name: 'Error',
      message: 'Test error'
    })

    expect(console.error).toHaveBeenCalledWith('Error in triggerPublish:', expect.any(Error))
  })

  it('should handle JSON parsing errors in the event body', async () => {
    const event = { body: 'invalid-json' }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toBe('Error initiating publish process')
    expect(JSON.parse(result.body).errorDetails.name).toBe('SyntaxError')
  })

  it('should log appropriate messages', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    await triggerPublish(event, context)

    expect(console.log).toHaveBeenCalledWith('triggerPublish function started', expect.objectContaining({
      timestamp: expect.any(String),
      region: 'us-east-1'
    }))

    expect(console.log).toHaveBeenCalledWith('Application config loaded')
    expect(console.log).toHaveBeenCalledWith('Received event body:', '{"name":"test-version"}')
    expect(console.log).toHaveBeenCalledWith('Parsed name from body:', 'test-version')
    expect(console.log).toHaveBeenCalledWith('Environment:', { isOffline: false })
    expect(console.log).toHaveBeenCalledWith('Invoking function:', expect.stringContaining('arn:aws:lambda:us-east-1:123456789012:function:kms-sit-publishHandler'))
    expect(console.log).toHaveBeenCalledWith('Attempting to invoke publish Lambda function', expect.any(Object))
    expect(console.log).toHaveBeenCalledWith('Publish Lambda function invoked successfully')
  })

  it('should handle errors from publish function in offline mode', async () => {
    process.env.IS_OFFLINE = 'true'
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    const publishError = new Error('Simulated publish error')
    publish.mockRejectedValue(publishError)

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(202)
    expect(JSON.parse(result.body).message).toBe('Publish process initiated for version test-version in offline mode')
    expect(publish).toHaveBeenCalledWith({ name: 'test-version' })
    expect(console.error).not.toHaveBeenCalled() // Error is caught in the background
  })

  it('should handle ResourceNotFoundException', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    const resourceNotFoundError = new Error('Function not found')
    resourceNotFoundError.name = 'ResourceNotFoundException'
    mockLambdaSend.mockRejectedValue(resourceNotFoundError)

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toBe('Error initiating publish process')
    expect(JSON.parse(result.body).errorDetails).toEqual({
      name: 'ResourceNotFoundException',
      message: 'Function not found'
    })

    expect(console.error).toHaveBeenCalledWith('Error in triggerPublish:', expect.any(Error))
    expect(console.error).toHaveBeenCalledWith('The specified Lambda function does not exist')
  })

  it('should handle ServiceException', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    const serviceError = new Error('AWS Lambda service error')
    serviceError.name = 'ServiceException'
    mockLambdaSend.mockRejectedValue(serviceError)

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toBe('Error initiating publish process')
    expect(JSON.parse(result.body).errorDetails).toEqual({
      name: 'ServiceException',
      message: 'AWS Lambda service error'
    })

    expect(console.error).toHaveBeenCalledWith('Error in triggerPublish:', expect.any(Error))
    expect(console.error).toHaveBeenCalledWith('AWS Lambda service error occurred')
  })

  it('should handle unexpected errors', async () => {
    const event = { body: JSON.stringify({ name: 'test-version' }) }
    const context = {
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
    }

    const unexpectedError = new Error('Unexpected error')
    mockLambdaSend.mockRejectedValue(unexpectedError)

    const result = await triggerPublish(event, context)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).message).toBe('Error initiating publish process')
    expect(JSON.parse(result.body).errorDetails).toEqual({
      name: 'Error',
      message: 'Unexpected error'
    })

    expect(console.error).toHaveBeenCalledWith('Error in triggerPublish:', expect.any(Error))
  })
})
