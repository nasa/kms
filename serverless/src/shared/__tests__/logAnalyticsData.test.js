import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import * as removeEmptyModule from '@/shared/removeEmpty'

import { logAnalyticsData } from '../logAnalyticsData'

describe('logAnalyticsData', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(removeEmptyModule, 'removeEmpty').mockImplementation((obj) => obj)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should log analytics data when all required fields are present', () => {
    const event = {
      queryStringParameters: {
        scheme: 'test',
        format: 'json'
      },
      pathParameters: { conceptId: '123' },
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'client-id': 'test-client'
      },
      requestContext: {
        domainName: 'example.com',
        path: '/test',
        httpMethod: 'GET'
      }
    }
    const context = { functionName: 'testFunction' }

    logAnalyticsData({
      event,
      context
    })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"analytics":'))
  })

  test('should not log when required fields are missing', () => {
    const event = {
      queryStringParameters: {},
      pathParameters: {},
      headers: {},
      requestContext: {}
    }
    const context = {}

    logAnalyticsData({
      event,
      context
    })

    expect(console.log).not.toHaveBeenCalled()
  })

  test('should use correct values for analytics object', () => {
    const event = {
      queryStringParameters: {
        scheme: 'test',
        format: 'json',
        version: '1.0'
      },
      pathParameters: { conceptId: '123' },
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'client-id': 'test-client',
        'user-agent': 'TestAgent',
        'x-forwarded-proto': 'http'
      },
      requestContext: {
        domainName: 'example.com',
        path: '/test',
        httpMethod: 'GET'
      }
    }
    const context = { functionName: 'testFunction' }

    logAnalyticsData({
      event,
      context
    })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"clientIp":"127.0.0.1"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"clientId":"test-client"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"url":"http://example.com/test?scheme=test&format=json&version=1.0"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"resource":"testFunction"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"action":"GET"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"format":"json"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"version":"1.0"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"scheme":"test"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"concept":"123"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"userAgent":"TestAgent"'))
  })

  test('should include search parameter in analytics log when provided', () => {
    const event = {
      queryStringParameters: {
        scheme: 'test',
        format: 'json',
        version: '1.0'
      },
      pathParameters: { conceptId: '123' },
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'client-id': 'test-client',
        'user-agent': 'TestAgent',
        'x-forwarded-proto': 'http'
      },
      requestContext: {
        domainName: 'example.com',
        path: '/test',
        httpMethod: 'GET'
      }
    }
    const context = { functionName: 'testFunction' }
    const search = 'test search pattern'

    logAnalyticsData({
      event,
      context,
      search
    })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"search":"test search pattern"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"clientIp":"127.0.0.1"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"clientId":"test-client"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"url":"http://example.com/test?scheme=test&format=json&version=1.0"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"resource":"testFunction"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"action":"GET"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"format":"json"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"version":"1.0"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"scheme":"test"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"concept":"123"'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"userAgent":"TestAgent"'))
  })

  test('should not include query string in URL when queryStringParameters is empty', () => {
    const event = {
      queryStringParameters: {},
      pathParameters: { conceptId: '123' },
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'client-id': 'test-client',
        'user-agent': 'TestAgent',
        'x-forwarded-proto': 'http'
      },
      requestContext: {
        domainName: 'example.com',
        path: '/test',
        httpMethod: 'GET'
      }
    }
    const context = { functionName: 'testFunction' }

    logAnalyticsData({
      event,
      context
    })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"url":"http://example.com/test"'))
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('http://example.com/test?'))
  })
})
