import { gzipSync } from 'zlib'

import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'

import { mirrorRdf } from '../handler'

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: {
      'Access-Control-Allow-Origin': '*'
    }
  }))
}))

vi.mock('@/shared/logger')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/transactionHelpers')

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
}

const createApiEvent = () => ({
  requestContext: {}
})

describe('mirrorRdf', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    delete process.env.RDF_MIRROR_SOURCE_ENV
    delete process.env.AWS_SAM_LOCAL
    process.env.RDF4J_SERVICE_URL = 'http://rdf4j.test:8080'
    process.env.RDF4J_REPOSITORY_ID = 'kms-test'
    process.env.RDF4J_USER_NAME = 'rdf-user'
    process.env.RDF4J_PASSWORD = 'rdf-password'
    vi.mocked(startTransaction).mockResolvedValue('transaction-url')
    vi.mocked(sparqlRequest).mockResolvedValue(createTextResponse())
    vi.mocked(commitTransaction).mockResolvedValue()
    vi.mocked(rollbackTransaction).mockResolvedValue()
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

    const response = await mirrorRdf(createApiEvent())

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
          Accept: 'application/json'
        }
      }
    )

    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://cmr.sit.earthdata.nasa.gov/kms/rdf/export?version=draft',
      expect.any(Object)
    )

    expect(startTransaction).toHaveBeenCalledTimes(2)
    expect(sparqlRequest).toHaveBeenNthCalledWith(1, {
      method: 'PUT',
      body: 'CLEAR GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published>',
      contentType: 'application/sparql-update',
      transaction: {
        transactionUrl: 'transaction-url',
        action: 'UPDATE'
      }
    })

    expect(sparqlRequest).toHaveBeenNthCalledWith(2, {
      method: 'PUT',
      body: '<rdf:RDF>published</rdf:RDF>',
      contentType: 'application/rdf+xml',
      version: 'published',
      transaction: {
        transactionUrl: 'transaction-url',
        action: 'ADD'
      }
    })

    expect(commitTransaction).toHaveBeenCalledTimes(2)
    expect(rollbackTransaction).not.toHaveBeenCalled()

    expect(logger.info).toHaveBeenCalledWith('[rdf-mirror] Mirrored RDF graphs', {
      sourceEnvironment: 'sit',
      versions: ['published', 'draft']
    })
  })

  test('uses the local SAM API as the source during local testing', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'local'
    process.env.AWS_SAM_LOCAL = 'true'
    configureSuccessfulFetch()

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(200)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://host.docker.internal:3013/rdf/export?version=published',
      expect.any(Object)
    )
  })

  test('downloads public source exports for a scheduled invocation', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'uat'
    configureSuccessfulFetch()

    await mirrorRdf({ source: 'aws.events' })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://cmr.uat.earthdata.nasa.gov/kms/rdf/export?version=published',
      expect.objectContaining({
        headers: {
          Accept: 'application/json'
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
    configureSuccessfulFetch()
    vi.mocked(sparqlRequest).mockRejectedValueOnce(new Error('clear failed'))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    expect(commitTransaction).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Failed to replace destination published graph: clear failed'
    )
  })

  test('returns an API error when importing a destination graph fails', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    configureSuccessfulFetch()
    vi.mocked(sparqlRequest)
      .mockResolvedValueOnce(createTextResponse())
      .mockRejectedValueOnce(new Error('import failed'))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    expect(commitTransaction).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Failed to replace destination published graph: import failed'
    )
  })

  test('reports the original replacement error when rollback also fails', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'prod'
    configureSuccessfulFetch()
    vi.mocked(sparqlRequest).mockRejectedValueOnce(new Error('clear failed'))
    vi.mocked(rollbackTransaction).mockRejectedValueOnce(new Error('rollback failed'))

    const response = await mirrorRdf(createApiEvent())

    expect(response.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to roll back published graph replacement, error=Error: rollback failed'
    )

    expect(logger.error).toHaveBeenCalledWith(
      '[rdf-mirror] Failed to mirror RDF graphs, error=Error: Failed to replace destination published graph: clear failed'
    )
  })

  test('throws a scheduled invocation error so EventBridge can report the failure', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'invalid'

    await expect(mirrorRdf({ source: 'aws.events' }))
      .rejects.toThrow('RDF_MIRROR_SOURCE_ENV must be local, sit, uat, or prod')
  })

  test('rejects the local source outside SAM local', async () => {
    process.env.RDF_MIRROR_SOURCE_ENV = 'local'

    await expect(mirrorRdf({ source: 'aws.events' }))
      .rejects.toThrow('RDF_MIRROR_SOURCE_ENV local is only supported by SAM local')
  })
})
