import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCmrSystemToken } from '../getCmrWriterToken'
import { getChangedCmrSchemes, refreshCmrKeywordSchemes } from '../refreshCmrKeywordSchemes'

vi.mock('../getCmrWriterToken', () => ({ getCmrSystemToken: vi.fn() }))
vi.mock('../logger', () => ({ logger: { info: vi.fn() } }))

describe('CMR keyword scheme refresh', () => {
  let fetchMock
  const events = [{
    Scheme: 'platforms',
    EventType: 'UPDATED'
  }]

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('CMR_BASE_URL', 'https://cmr.example.com')
    fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => 'cmr-request-id' },
      text: vi.fn().mockResolvedValue('')
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(getCmrSystemToken).mockResolvedValue('system-token')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test('maps every supported KMS scheme to its CMR API name', () => {
    const schemes = [
      'providers', 'platforms', 'instruments', 'projects', 'temporalresolutionrange',
      'locations', 'sciencekeywords', 'measurementname', 'idnnode', 'isotopiccategory',
      'rucontenttype', 'DataFormat', 'mimetype', 'ProductLevelId'
    ]

    expect(getChangedCmrSchemes(schemes.map((Scheme) => ({ Scheme })))).toEqual([
      'concepts', 'granule_data_format', 'instruments', 'iso_topic_categories',
      'measurement_name', 'mime_type', 'platforms', 'processing_levels', 'projects',
      'providers', 'related_urls', 'science_keywords', 'spatial_keywords', 'temporal_keywords'
    ])
  })

  test('deduplicates and normalizes insertions, updates, and deletions without forwarding unknown schemes', () => {
    expect(getChangedCmrSchemes([
      {
        Scheme: ' DataFormat ',
        EventType: 'INSERTED'
      },
      {
        Scheme: 'dataformat',
        EventType: 'DELETED'
      },
      {
        Scheme: 'PLATFORMS',
        EventType: 'UPDATED'
      },
      { Scheme: 'verticalresolutionrange' },
      { Scheme: '__proto__' },
      { Scheme: 'constructor' },
      {}
    ])).toEqual(['granule_data_format', 'platforms'])
  })

  test('skips an empty or unsupported-only batch without authentication or a full-cache refresh', async () => {
    await expect(refreshCmrKeywordSchemes()).resolves.toEqual({
      schemes: [],
      refreshed: false
    })

    await expect(refreshCmrKeywordSchemes({
      keywordEvents: [{ Scheme: 'chronounits' }]
    })).resolves.toEqual({
      schemes: [],
      refreshed: false
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getCmrSystemToken).not.toHaveBeenCalled()
  })

  test('performs one authenticated synchronous POST and consumes its empty success body', async () => {
    vi.useFakeTimers()
    await expect(refreshCmrKeywordSchemes({ keywordEvents: events })).resolves.toEqual({
      schemes: ['platforms'],
      refreshed: true
    })

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://cmr.example.com/bootstrap/caches/refresh/kms?concept_scheme=platforms',
      {
        method: 'POST',
        headers: {
          Authorization: 'system-token',
          'Client-Id': 'kms-publisher',
          Accept: 'application/json'
        },
        signal: expect.any(AbortSignal),
        redirect: 'error'
      }
    )

    expect(vi.getTimerCount()).toBe(0)
  })

  test('handles a trailing slash in CMR_BASE_URL and sends all changed schemes in one request', async () => {
    vi.stubEnv('CMR_BASE_URL', 'http://internal-cmr:3000/')
    await refreshCmrKeywordSchemes({
      keywordEvents: [...events, { Scheme: 'rucontenttype' }, { Scheme: 'platforms' }]
    })

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.origin).toBe('http://internal-cmr:3000')
    expect(url.pathname).toBe('/bootstrap/caches/refresh/kms')
    expect(url.searchParams.get('concept_scheme')).toBe('platforms,related_urls')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each([202, 204, 400, 401, 403, 500, 503])('does not accept HTTP %i as a confirmed refresh or retry it', async (status) => {
    fetchMock.mockResolvedValue({
      status,
      statusText: 'Failure',
      text: async () => 'details'
    })

    await expect(refreshCmrKeywordSchemes({ keywordEvents: events })).rejects.toMatchObject({
      status,
      cmrResponseBody: 'details',
      cmrRequest: {
        schemes: ['platforms'],
        timedOut: false
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('propagates a network error with request diagnostics and no retry', async () => {
    fetchMock.mockRejectedValue(new Error('Connection refused'))
    await expect(refreshCmrKeywordSchemes({ keywordEvents: events })).rejects.toMatchObject({
      message: 'Connection refused',
      cmrRequest: {
        method: 'POST',
        timeoutMs: 120000,
        timedOut: false
      }
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('requires an endpoint and a system token before sending the refresh', async () => {
    vi.stubEnv('CMR_BASE_URL', '')
    await expect(refreshCmrKeywordSchemes({ keywordEvents: events })).rejects.toThrow('is required')
    vi.stubEnv('CMR_BASE_URL', 'https://cmr.example.com/')
    vi.mocked(getCmrSystemToken).mockResolvedValue(undefined)
    await expect(refreshCmrKeywordSchemes({ keywordEvents: events })).rejects.toThrow('system token is required')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('times out a stalled POST and marks its completion unknown', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))

    const request = refreshCmrKeywordSchemes({ keywordEvents: events })
    const pending = expect(request).rejects.toMatchObject({
      message: expect.stringContaining('completion is unknown'),
      cmrRequest: {
        timeoutMs: 120000,
        timedOut: true
      }
    })
    await vi.advanceTimersByTimeAsync(120000)
    await pending
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('keeps the timeout active while reading a stalled response body', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(async (url, { signal }) => ({
      status: 200,
      text: () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }))

    const request = refreshCmrKeywordSchemes({ keywordEvents: events })
    const pending = expect(request).rejects.toMatchObject({
      cmrRequest: {
        timeoutMs: 120000,
        timedOut: true
      }
    })
    await vi.advanceTimersByTimeAsync(120000)
    await pending
    expect(vi.getTimerCount()).toBe(0)
  })

  test('caps the deadline and reserves time for failure auditing', async () => {
    vi.useFakeTimers()
    await refreshCmrKeywordSchemes({ keywordEvents: events })
    expect(vi.getTimerCount()).toBe(0)
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))

    const pending = expect(refreshCmrKeywordSchemes({
      keywordEvents: events,
      remainingTimeMs: 31000
    })).rejects.toMatchObject({
      cmrRequest: {
        timeoutMs: 1000,
        timedOut: true
      }
    })
    await vi.advanceTimersByTimeAsync(1000)
    await pending
    await expect(refreshCmrKeywordSchemes({
      keywordEvents: events,
      remainingTimeMs: 30000
    })).rejects.toThrow('Insufficient publisher time')
  })
})
