import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import * as removeEmptyModule from '@/shared/removeEmpty'

import { logAnalyticsData } from '../logAnalyticsData'

describe('when logging analytics data', () => {
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

  test('should log the client ID from the URL query parameter', () => {
    logAnalyticsData({
      event: {
        headers: { 'x-forwarded-for': '127.0.0.1' },
        queryStringParameters: { 'client-id': 'keyword-viewer-test' },
        requestContext: {
          domainName: 'example.com',
          path: '/kms/concept/123',
          httpMethod: 'GET'
        }
      }
    })

    const { analytics } = JSON.parse(console.log.mock.calls[0][0])
    expect(analytics.clientId).toBe('keyword-viewer-test')
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
