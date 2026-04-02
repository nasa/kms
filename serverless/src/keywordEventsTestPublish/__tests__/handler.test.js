import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { publishKeywordEvent } from '@/shared/publishKeywordEvent'

import { keywordEventsTestPublish } from '../handler'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/publishKeywordEvent')
vi.mock('@/shared/logAnalyticsData')

describe('when the keyword events publish handler is invoked', () => {
  const validPayload = {
    event_type: 'keyword_updated',
    scheme: 'sciencekeywords',
    uuid: '1234-5678',
    old_keyword_path: 'EARTH SCIENCE > ATMOSPHERE',
    new_keyword_path: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
    timestamp: '2026-04-02T12:00:00.000Z'
  }

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: {},
      keywordEventsTopicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events'
    })

    publishKeywordEvent.mockResolvedValue({
      topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events',
      messageId: 'message-123'
    })
  })

  describe('when the request is successful', () => {
    describe('when the request body contains a valid keyword event', () => {
      test('should publish the event and return a success response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify(validPayload)
        })

        expect(result.statusCode).toBe(200)
        expect(publishKeywordEvent).toHaveBeenCalledWith(validPayload)
        expect(JSON.parse(result.body)).toMatchObject({
          message: 'Keyword event published successfully',
          topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events',
          messageId: 'message-123',
          event: validPayload
        })
      })
    })

    describe('when the application config does not include a topic ARN', () => {
      test('should fall back to the publish result topic ARN', async () => {
        getApplicationConfig.mockReturnValue({
          defaultResponseHeaders: {}
        })

        const result = await keywordEventsTestPublish({
          body: JSON.stringify(validPayload)
        })

        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body)).toMatchObject({
          topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events'
        })
      })
    })
  })

  describe('when the request is unsuccessful', () => {
    describe('when the request body is invalid JSON', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: '{bad-json'
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toContain('JSON')
      })
    })

    describe('when the request body is missing', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({})

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Missing or invalid field: event_type')
      })
    })

    describe('when the request body is not a JSON object', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify([])
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Request body must be a JSON object')
      })
    })

    describe('when required fields are missing', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            event_type: 'keyword_updated'
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Missing or invalid field: scheme')
      })
    })

    describe('when old_keyword_path is invalid', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            old_keyword_path: 123
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: old_keyword_path')
      })
    })

    describe('when the timestamp is missing', () => {
      test('should return a 400 response', async () => {
        const payload = { ...validPayload }
        delete payload.timestamp

        const result = await keywordEventsTestPublish({
          body: JSON.stringify(payload)
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Missing or invalid field: timestamp')
      })
    })

    describe('when the timestamp is not a string', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            timestamp: 123
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: timestamp must be ISO-8601')
      })
    })

    describe('when the timestamp is invalid', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            timestamp: 'not-a-date'
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: timestamp must be ISO-8601')
      })
    })

    describe('when publishing the event fails after validation', () => {
      test('should return a 400 response', async () => {
        publishKeywordEvent.mockRejectedValue(new Error('publish failed'))

        const result = await keywordEventsTestPublish({
          body: JSON.stringify(validPayload)
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('publish failed')
      })
    })
  })
})
