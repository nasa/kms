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
    EventType: 'UPDATED',
    Scheme: 'sciencekeywords',
    UUID: '1234-5678',
    OldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE',
    NewKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
    Timestamp: '2026-04-02T12:00:00.000Z'
  }
  const expectedPublishedPayload = {
    ...validPayload,
    MetadataSpecification: {
      Name: 'Kms-Keyword-Event',
      URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
      Version: '1.0'
    }
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
        expect(publishKeywordEvent).toHaveBeenCalledWith(expectedPublishedPayload)
        expect(JSON.parse(result.body)).toMatchObject({
          message: 'Keyword event published successfully',
          topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events',
          messageId: 'message-123',
          event: expectedPublishedPayload
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
          topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-keyword-events',
          event: expectedPublishedPayload
        })
      })
    })

    describe('when the request includes metadata specification values', () => {
      test('should preserve provided metadata fields and replace the schema URL with the current version', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            MetadataSpecification: {
              Name: 'Existing-Name',
              URL: 'https://example.com/old-schema',
              Version: '2.0'
            }
          })
        })

        expect(result.statusCode).toBe(200)
        expect(publishKeywordEvent).toHaveBeenCalledWith({
          ...validPayload,
          MetadataSpecification: {
            Name: 'Existing-Name',
            URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
            Version: '2.0'
          }
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
        expect(JSON.parse(result.body).error).toBe('Missing or invalid field: EventType')
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
            EventType: 'UPDATED'
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Missing or invalid field: Scheme')
      })
    })

    describe('when the event type is invalid', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            EventType: 'CREATED'
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: EventType must be one of INSERTED, UPDATED, DELETED')
      })
    })

    describe('when OldKeywordPath is invalid', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            OldKeywordPath: 123
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: OldKeywordPath')
      })
    })

    describe('when the timestamp is missing', () => {
      test('should return a 400 response', async () => {
        const payload = { ...validPayload }
        delete payload.Timestamp

        const result = await keywordEventsTestPublish({
          body: JSON.stringify(payload)
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Missing or invalid field: Timestamp')
      })
    })

    describe('when the timestamp is not a string', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            Timestamp: 123
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: Timestamp must be ISO-8601')
      })
    })

    describe('when the timestamp is invalid', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            Timestamp: 'not-a-date'
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: Timestamp must be ISO-8601')
      })
    })

    describe('when MetadataSpecification is invalid', () => {
      test('should return a 400 response', async () => {
        const result = await keywordEventsTestPublish({
          body: JSON.stringify({
            ...validPayload,
            MetadataSpecification: 'invalid'
          })
        })

        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).error).toBe('Invalid field: MetadataSpecification')
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
