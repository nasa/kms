import { gzipSync } from 'zlib'

import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCmrSystemToken } from '@/shared/getCmrWriterToken'
import { logger } from '@/shared/logger'

import { mirrorRdf } from '../handler'

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: {
      'Access-Control-Allow-Origin': '*'
    }
  }))
}))

vi.mock('@/shared/getCmrWriterToken', () => ({
  getCmrSystemToken: vi.fn()
}))

vi.mock('@/shared/logger')

const createArchiveResponse = (rdfXml) => {
  const archive = gzipSync(rdfXml)
  const arrayBuffer = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength
  )

  return {
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer)
  }
}

const createTextResponse = ({
  ok = true,
  status = 200,
  text = ''
} = {}) => ({
  ok,
  status,
  text: vi.fn().mockResolvedValue(text)
})

const configureSuccessfulFetch = () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
    })
    .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>published</rdf:RDF>'))
    .mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/draft.rdf.xml.gz' })
    })
    .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>draft</rdf:RDF>'))
    .mockResolvedValueOnce(createTextResponse())
    .mockResolvedValueOnce(createTextResponse())
    .mockResolvedValueOnce(createTextResponse())
    .mockResolvedValueOnce(createTextResponse())
}

const createApiEvent = () => ({
  requestContext: {},
  headers: { Authorization: 'api-token' }
})

describe('mirrorRdf', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    delete process.env.RDF_MIRROR_SOURCE_ENV
    vi.mocked(getCmrSystemToken).mockResolvedValue('system-token')
    process.env.RDF4J_SERVICE_URL = 'http://rdf4j.test:8080'
    process.env.RDF4J_REPOSITORY_ID = 'kms-test'
    process.env.RDF4J_USER_NAME = 'rdf-user'
    process.env.RDF4J_PASSWORD = 'rdf-password'
  })

  test('skips the mirror when no source environment is configured', async () => {
    const response = await mirrorRdf()

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      status: 'skipped',
      reason: 'RDF_MIRROR_SOURCE_ENV is not configured'
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  test('downloads both graphs before replacing the destination contexts', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'SIT'
    configureSuccessfulFetch()

    const response = await mirrorRdf({
      requestContext: {},
      headers: { authorization: 'Bearer manual-token' }
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      status: 'mirrored',
      sourceEnvironment: 'sit',
      versions: ['published', 'draft']
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://cmr.sit.earthdata.nasa.gov/kms/rdf/export?version=published',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer manual-token'
        }
      }
    )

    expect(getCmrSystemToken).not.toHaveBeenCalled()

    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://cmr.sit.earthdata.nasa.gov/kms/rdf/export?version=draft',
      expect.any(Object)
    )

    const publishedContext = encodeURIComponent(
      '<https://gcmd.earthdata.nasa.gov/kms/version/published>'
    )
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toContain(`context=${publishedContext}`)
    expect(vi.mocked(fetch).mock.calls[4][1]).toEqual({
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from('rdf-user:rdf-password').toString('base64')}`
      }
    })

    expect(vi.mocked(fetch).mock.calls[5][1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: '<rdf:RDF>published</rdf:RDF>'
    }))

    expect(logger.info).toHaveBeenCalledWith('[rdf-mirror] Mirrored RDF graphs', {
      sourceEnvironment: 'sit',
      versions: ['published', 'draft']
    })
  })

  test('uses the CMR system token for a scheduled invocation', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'uat'
    vi.mocked(getCmrSystemToken).mockResolvedValue('scheduled-system-token')
    configureSuccessfulFetch()

    await mirrorRdf({ source: 'aws.events' })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://cmr.uat.earthdata.nasa.gov/kms/rdf/export?version=published',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'scheduled-system-token'
        }
      })
    )
  })

  test('returns an API error without clearing graphs when a source export fails', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch).mockResolvedValueOnce(createTextResponse({
      ok: false,
      status: 503,
      text: 'unavailable'
    }))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Source published export failed: 503 unavailable'
    )
  })

  test('returns an API error when the source export has no download URL', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    })

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Source published export did not return a download URL'
    )
  })

  test('returns an API error when the source gzip download fails', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createTextResponse({
        ok: false,
        status: 504
      }))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Source published download failed: 504'
    )
  })

  test('returns an API error when the source download is not valid gzip', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('not-gzip'))
      })

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Source published download is not valid gzip:')
    )
  })

  test('returns an API error when rdf.xml does not contain RDF/XML', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<not-rdf />'))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Source published download does not contain RDF/XML'
    )
  })

  test('returns an API error when clearing a destination graph fails', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>published</rdf:RDF>'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/draft.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>draft</rdf:RDF>'))
      .mockResolvedValueOnce(createTextResponse({
        ok: false,
        status: 500,
        text: 'clear failed'
      }))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Failed to clear destination published graph: 500 clear failed'
    )
  })

  test('returns an API error when importing a destination graph fails', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>published</rdf:RDF>'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/draft.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>draft</rdf:RDF>'))
      .mockResolvedValueOnce(createTextResponse())
      .mockResolvedValueOnce(createTextResponse({
        ok: false,
        status: 500,
        text: 'import failed'
      }))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Failed to import destination published graph: 500 import failed'
    )
  })

  test('uses local RDF4J defaults and permits an absent destination context', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    delete process.env.RDF4J_SERVICE_URL
    delete process.env.RDF4J_REPOSITORY_ID
    delete process.env.RDF4J_USER_NAME
    delete process.env.RDF4J_PASSWORD
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/published.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>published</rdf:RDF>'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ downloadUrl: 'https://download.test/draft.rdf.xml.gz' })
      })
      .mockResolvedValueOnce(createArchiveResponse('<rdf:RDF>draft</rdf:RDF>'))
      .mockResolvedValueOnce(createTextResponse({
        ok: false,
        status: 404
      }))
      .mockResolvedValueOnce(createTextResponse())
      .mockResolvedValueOnce(createTextResponse())
      .mockResolvedValueOnce(createTextResponse())

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(200)
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toContain(
      'http://localhost:8081/rdf4j-server/repositories/kms/statements'
    )

    expect(vi.mocked(fetch).mock.calls[4][1]).toEqual({
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from('rdf4j:rdf4j').toString('base64')}`
      }
    })
  })

  test('does not call the source when an API request has no Authorization header', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'

    const response = await mirrorRdf({ requestContext: {} })

    expect(response.statusCode).toBe(500)
    expect(fetch).not.toHaveBeenCalled()
    expect(getCmrSystemToken).not.toHaveBeenCalled()
  })

  test('throws when a scheduled invocation has no CMR system token', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    vi.mocked(getCmrSystemToken).mockResolvedValue(undefined)

    await expect(mirrorRdf({ source: 'aws.events' }))
      .rejects.toThrow('CMR system token is unavailable')

    expect(fetch).not.toHaveBeenCalled()
  })

  test('throws a scheduled invocation error so EventBridge can report the failure', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'invalid'

    await expect(mirrorRdf({ source: 'aws.events' }))
      .rejects.toThrow('RDF_MIRROR_SOURCE_ENV must be sit, uat, or prod')
  })
})
